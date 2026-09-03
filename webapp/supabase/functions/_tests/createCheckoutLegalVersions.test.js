import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as purchaseConfig from '../_shared/purchaseConfig.js';
import * as coursePromotion from '../_shared/coursePromotion.js';

const compiled = ts.transpileModule(
  readFileSync(new URL('../create-checkout/index.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true },
);
assert.deepEqual(compiled.diagnostics, []);

function harness({ currentStatus = 'published', oldRuntime = false } = {}) {
  const queries = [], calls = [], errors = [];
  const documents = ['b2c', 'b2b'].flatMap((kind) => ['12', '26'].map((day) => ({
    id: `cgv_${kind}-${day}`,
    document_type: `cgv_${kind}`,
    version: `CGV-${kind.toUpperCase()}-2026-08-${day}`,
    status: day === '12' ? 'retired' : currentStatus,
  })));
  documents.push(...[
    ['early_service_start_statement', 'EARLY-SERVICE-2026-08-12'],
    ['digital_content_start_statement', 'DIGITAL-START-2026-08-12'],
    ['digital_content_withdrawal_acknowledgement', 'DIGITAL-ACK-2026-08-12'],
  ].map(([document_type, version]) => ({ id: version, document_type, version, status: 'published' })));
  const admin = {
    auth: { getUser: async () => ({ data: { user: {
      id: 'a4000000-0000-4000-8000-000000000001', email: 'checkout@example.test',
    } }, error: null }) },
    from(table) {
      assert.ok(['course_access', 'purchases', 'legal_document_versions'].includes(table));
      const filters = [], selections = [];
      if (table === 'legal_document_versions') queries.push({ filters, selections });
      const chain = {
        select() { return chain; },
        eq(column, value) { filters.push([column, value]); return chain; },
        in(column, values) { selections.push([column, Array.from(values)]); return chain; },
        or() { return chain; },
        maybeSingle: async () => ({ data: null, error: null }),
        then(resolve) {
          return Promise.resolve({ data: documents.filter((row) => (
            filters.every(([column, value]) => row[column] === value)
            && selections.every(([column, values]) => values.includes(row[column]))
          )), error: null }).then(resolve);
        },
      };
      return chain;
    },
    rpc(name, args) {
      assert.equal(name, 'prepare_course_checkout_intent');
      calls.push(JSON.parse(JSON.stringify(args)));
      return { single: async () => ({ data: {
        id: 'existing-intent', stripe_checkout_session_id: 'cs_test_existing', normalized_code: null,
      }, error: null }) };
    },
  };
  class Stripe {
    prices = { retrieve: async () => ({ active: true, livemode: false, currency: 'eur',
      unit_amount: 18700, recurring: null, product: 'prod_fixture' }) };
    // Une session existante simulée évite toute création de paiement, même dans le test.
    checkout = { sessions: { retrieve: async () => ({ status: 'complete' }) } };
  }
  const runtime = oldRuntime ? {
    ...purchaseConfig,
    getPurchaseConfig(courseId) {
      const purchase = purchaseConfig.getPurchaseConfig(courseId);
      return { ...purchase, legalVersions: { ...purchase.legalVersions,
        cgvB2c: 'CGV-B2C-2026-08-12', cgvB2b: 'CGV-B2B-2026-08-12' } };
    },
  } : purchaseConfig;
  const deps = {
    'npm:stripe@^22': { default: Stripe },
    'npm:@supabase/supabase-js@2.105.1': { createClient: () => admin },
    '../_shared/cors.ts': { corsHeaders: {}, jsonResponse: (body, status = 200) => Response.json(body, { status }) },
    '../_shared/purchaseConfig.js': runtime,
    '../_shared/coursePromotion.js': coursePromotion,
  };
  const env = { STRIPE_SECRET_KEY: 'sk_test_fixture', SUPABASE_URL: 'https://supabase.invalid',
    SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
    STRIPE_AI_ACT_PRICE_ID: 'price_fixture' };
  let handler;
  runInNewContext(compiled.outputText, {
    exports: {}, require: (name) => { assert.ok(deps[name]); return deps[name]; },
    Deno: { env: { get: (name) => env[name] }, serve: (value) => { handler = value; } },
    Response, URL, Error, console: { error: (...args) => errors.push(args), warn: (...args) => errors.push(args) },
  });
  return { queries, calls, errors, invoke: (context, kind, day = '26') => handler(new Request('https://checkout.invalid', {
    method: 'POST', headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ course_id: 'formation-ia-act',
      checkout_request_id: 'a4000000-0000-4000-8000-000000000002', checkout_context: context,
      consents: { cgv_version: `CGV-${kind.toUpperCase()}-2026-08-${day}`, cgv_acceptance: true,
        ...(kind === 'b2c' ? { early_service_start: true, digital_content_start: true,
          digital_content_withdrawal_acknowledgement: true } : {}) } }),
  })) };
}

const contexts = [
  ['particulier', 'b2c', { sales_context: 'personal', access_start_choice: 'immediate' }],
  ['professionnel', 'b2b', { sales_context: 'professional_self' }],
  ['bénéficiaire', 'b2b', { sales_context: 'beneficiary', beneficiary_email: 'beneficiaire@example.test',
    buyer_organization_name: 'Entreprise Test' }],
];

for (const [label, kind, context] of contexts) {
  test(`create-checkout ${label} sélectionne les CGV du 26/08 publiées`, async () => {
    const h = harness();
    const response = await h.invoke(context, kind);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { confirmationPending: true, checkoutIntentId: 'existing-intent' });
    assert.equal(h.queries.length, 1);
    assert.deepEqual(h.queries[0].filters, [['status', 'published']]);
    assert.ok(h.queries[0].selections.some(([column, values]) => column === 'document_type' && values.includes(`cgv_${kind}`)));
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].p_cgv_document_version_id, `cgv_${kind}-26`);
    assert.deepEqual(h.calls[0].p_consent_documents, [
      { consent_type: 'cgv_acceptance', legal_document_version_id: `cgv_${kind}-26` },
      ...(kind === 'b2c' ? [
        { consent_type: 'early_service_start', legal_document_version_id: 'EARLY-SERVICE-2026-08-12' },
        { consent_type: 'digital_content_start', legal_document_version_id: 'DIGITAL-START-2026-08-12' },
        { consent_type: 'digital_content_withdrawal_acknowledgement', legal_document_version_id: 'DIGITAL-ACK-2026-08-12' },
      ] : []),
    ]);
    assert.deepEqual(h.errors, []);
  });
}

for (const [label, kind, context] of contexts.slice(0, 2)) {
  test(`create-checkout ${label} refuse les CGV du 26/08 non publiées`, async () => {
    const h = harness({ currentStatus: 'retired' });
    const response = await h.invoke(context, kind);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'Une version juridique applicable est introuvable ou non publiée.' });
    assert.deepEqual(h.calls, []);
    assert.deepEqual(h.errors, []);
  });

  test(`contre-test ${label} : le runtime du 12/08 reproduit le refus 409`, async () => {
    const h = harness({ oldRuntime: true });
    const response = await h.invoke(context, kind, '12');
    assert.equal(response.status, 409);
    assert.deepEqual(h.calls, []);
    assert.deepEqual(h.errors, []);
  });
}
