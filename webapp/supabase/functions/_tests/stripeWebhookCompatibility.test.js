import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import * as purchaseConfig from '../_shared/purchaseConfig.js';
import * as coursePromotion from '../_shared/coursePromotion.js';
import * as postPayment from '../_shared/stripePostPayment.js';
import * as diagnosticPayment from '../_shared/diagnosticPayment.js';
import * as diagnosticContract from '../_shared/diagnosticContractConfirmation.js';
import { buildDiagnosticPromoEvidence } from '../_shared/diagnosticContractEvidence.js';
import { buildCommercialEmail } from '../_shared/smtpReceipt.js';

const source = readFileSync(resolve('supabase/functions/stripe-webhook-ai-act/index.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  fileName: 'stripe-webhook-ai-act/index.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.deepEqual(compiled.diagnostics, []);
const userId = 'a2000000-0000-4000-8000-000000000001';
const intentId = 'a2000000-0000-4000-8000-000000000002';
const redemptionId = 'a2000000-0000-4000-8000-000000000003';
const orderId = 'a2000000-0000-4000-8000-000000000004';
const cgvId = 'a2000000-0000-4000-8000-000000000005';

function courseFixture({ prepared = false, promotion = false } = {}) {
  const intent = {
    id: intentId, user_id: userId, course_id: 'formation-ia-act',
    offer_classification: 'B2B', sales_context: 'professional_self', access_start_choice: null,
    access_activation_policy: 'immediate_after_payment', status: 'stripe_session_created',
    stripe_checkout_session_id: 'cs_test_course', cgv_document_version_id: cgvId,
    original_amount_cents: prepared ? 18700 : null,
    discount_amount_cents: prepared ? (promotion ? 1870 : 0) : null,
    final_amount_cents: prepared ? (promotion ? 16830 : 18700) : null,
    promo_redemption_id: promotion ? redemptionId : null,
    catalog_price_id: prepared ? 'price_test_course' : null,
    stripe_product_id: prepared ? 'prod_test_course' : null,
  };
  const object = {
    id: intent.stripe_checkout_session_id, object: 'checkout.session', mode: 'payment',
    status: 'complete', payment_status: 'paid', amount_total: intent.final_amount_cents ?? 18700,
    currency: 'eur', client_reference_id: userId, payment_intent: 'pi_test_course',
    metadata: {
      course_id: intent.course_id, user_id: userId, checkout_intent_id: intentId,
      price_id: 'price_test_course', payment_type: 'course', sales_context: intent.sales_context,
      access_activation_policy: intent.access_activation_policy,
      ...(prepared ? { stripe_product_id: intent.stripe_product_id,
        expected_amount_cents: String(intent.final_amount_cents),
        ...(promotion ? { promo_redemption_id: redemptionId } : {}) } : {}),
    },
  };
  const consents = [{
    checkout_intent_id: intentId, user_id: userId, course_id: intent.course_id,
    consent_type: 'cgv_acceptance', granted: true, legal_document_version_id: cgvId,
    legal_document_versions: { id: cgvId, version: 'CGV-B2B-2026-08-26' },
  }];
  return { intent, object, consents };
}

function diagnosticObject() {
  return {
    id: 'cs_test_diagnostic', object: 'checkout.session', mode: 'payment', status: 'complete',
    payment_status: 'paid', amount_total: 14900, currency: 'eur', client_reference_id: userId,
    customer: { id: 'cus_test_diagnostic' }, payment_intent: 'pi_test_diagnostic',
    metadata: { purchase_type: 'diagnostic_ia_express', diagnostic_order_id: orderId,
      user_id: userId, price_id: 'price_test_diagnostic' },
  };
}

function event(type, object, id = 'evt_test_compatibility') {
  return { id, type, livemode: false, created: 1788000000, data: { object } };
}

// Exécute le véritable Deno.serve transpilé, sans serveur ni accès réseau.
// Les validations métier sont réelles ; RPC, Stripe et transport SMTP sont simulés.
function harness(options = {}) {
  const calls = [], queries = [], deliveries = [], warnings = [];
  let handler, clientCount = 0;
  const env = {
    STRIPE_SECRET_KEY: 'sk_test_fixture_not_a_real_key', STRIPE_WEBHOOK_SIGNING_SECRET: 'fixture-only',
    SUPABASE_URL: 'https://supabase.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only',
    STRIPE_AI_ACT_PRICE_ID: 'price_test_course', STRIPE_DIAGNOSTIC_IA_PRICE_ID: 'price_test_diagnostic',
  };
  const project = (row, columns) => row && Object.fromEntries(Object.entries(row).filter(([key]) =>
    !columns || columns.includes(key)));
  function from(table) {
    assert.ok(['commercial_checkout_intents', 'commercial_consents', 'diagnostic_ia_orders',
      'legal_document_versions', 'diagnostic_ia_consents'].includes(table), `Accès table inattendu : ${table}`);
    const query = { table, filters: [] };
    queries.push(query);
    const result = () => {
      if (table === options.queryErrorTable) return { data: null, error: { code: 'fixture_db_error' } };
      let data;
      if (table === 'commercial_checkout_intents') data = options.intent ?? null;
      if (table === 'commercial_consents') data = options.consents ?? [];
      if (table === 'diagnostic_ia_consents') data = {
        legal_document_version_id: 'promo-acceptance',
        acceptance_text: buildDiagnosticPromoEvidence(options.diagnosticOrder).text,
        legal_document_versions: { version: buildDiagnosticPromoEvidence(options.diagnosticOrder).version },
      };
      if (table === 'legal_document_versions') data = {
        version: 'CGV-B2C-2026-08-26', content_text: 'Texte contractuel local de test.',
      };
      if (table === 'diagnostic_ia_orders') {
        if (query.update?.contract_confirmation_delivery_status === 'sending') {
          data = options.claimUnavailable ? null : {
            id: orderId, customer_email: 'diagnostic@example.test', sales_context: 'personal',
            paid_at: '2026-08-29T12:00:00Z', cgv_document_version_id: cgvId,
            amount_total: options.diagnosticOrder?.final_amount_cents ?? 14900,
            ...options.diagnosticOrder,
            cgv_acceptance_statement_version_id: 'promo-acceptance',
            contract_confirmation_delivery_attempts: options.deliveryAttempts ?? 0,
          };
        } else if (query.select?.includes('final_amount_cents')) {
          data = options.diagnosticOrder ?? { id: orderId, user_id: userId, final_amount_cents: 14900, promo_redemption_id: null };
        } else data = options.deliveryState ?? null;
      }
      return { data: Array.isArray(data) ? data.map((row) => project(row, query.select))
        : project(data, query.select), error: null };
    };
    const chain = {
      select(columns) { query.select = columns; return chain; },
      update(values) { assert.equal(table, 'diagnostic_ia_orders'); query.update = values; return chain; },
      eq(...args) { query.filters.push(['eq', ...args]); return chain; },
      in(...args) { query.filters.push(['in', ...args]); return chain; },
      lt(...args) { query.filters.push(['lt', ...args]); return chain; },
      or(...args) { query.filters.push(['or', ...args]); return chain; },
      async maybeSingle() { return result(); },
      async single() { return result(); },
      then(fulfilled, rejected) { return Promise.resolve(result()).then(fulfilled, rejected); },
    };
    return chain;
  }
  class FakeStripe {
    static createSubtleCryptoProvider() { return {}; }
    webhooks = { async constructEventAsync(raw, signature) {
      if (signature !== 'fixture-signature') throw new Error('fixture_signature_invalid');
      return JSON.parse(raw);
    } };
  }
  const dependencies = {
    'npm:stripe@^22': { default: FakeStripe },
    'npm:@supabase/supabase-js@2.105.1': { createClient() {
      clientCount += 1;
      return { from, async rpc(name, args) {
        calls.push({ name, payload: args.p_event });
        return { data: { ok: true, already_processed: options.alreadyProcessed ?? false },
          error: options.rpcError ? { code: 'fixture_rpc_error' } : null };
      } };
    } },
    '../_shared/purchaseConfig.js': purchaseConfig,
    '../_shared/coursePromotion.js': coursePromotion,
    '../_shared/stripePostPayment.js': postPayment,
    '../_shared/diagnosticPayment.js': diagnosticPayment,
    '../_shared/diagnosticContractConfirmation.js': {
      ...diagnosticContract,
      attemptDiagnosticContractConfirmationDelivery: (input) =>
        diagnosticContract.attemptDiagnosticContractConfirmationDelivery(input, {
          send: async (message) => {
            deliveries.push(message);
            if (options.smtpFails) throw new Error('fixture_smtp_failure');
          },
        }),
    },
  };
  const executable = options.mutate ? ts.transpileModule(options.mutate(source), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText : compiled.outputText;
  runInNewContext(executable, {
    exports: {}, require(name) { assert.ok(dependencies[name], `Import inattendu : ${name}`); return dependencies[name]; },
    Deno: { env: { get: (name) => env[name] }, serve: (callback) => { handler = callback; } },
    Response, TextEncoder, crypto: webcrypto, Error,
    console: { error() {}, warn(message) { warnings.push(message); } },
  });
  return { calls, queries, deliveries, warnings, get clientCount() { return clientCount; },
    dispatch: (payload, signature = 'fixture-signature', method = 'POST') => handler(new Request(
      'https://webhook.invalid', { method, headers: signature ? { 'Stripe-Signature': signature } : {},
        ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}) },
    )),
  };
}

for (const prepared of [false, true]) {
  test(`formation sans remise : pipeline ${prepared ? '1G-C puis historique' : 'historique v42'} conservé`, async () => {
    const fixture = courseFixture({ prepared });
    const h = harness(fixture);
    const response = await h.dispatch(event('checkout.session.completed', fixture.object));
    assert.equal(response.status, 200);
    assert.equal(h.calls[0].name, prepared ? 'process_course_stripe_event' : 'process_stripe_post_payment_event');
    assert.equal(h.calls[0].payload.amount_total, 18700);
    assert.equal(h.calls[0].payload.validation_status, 'validated');
    assert.equal(h.deliveries.length, 0);
  });
}

for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
  test(`formation remisée ${type} : délègue consommation et LMS à la RPC transactionnelle`, async () => {
    const fixture = courseFixture({ prepared: true, promotion: true });
    const h = harness(fixture);
    assert.equal((await h.dispatch(event(type, fixture.object))).status, 200);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].name, 'process_course_stripe_event');
    assert.equal(h.calls[0].payload.checkout_intent_id, intentId);
    assert.equal(h.calls[0].payload.amount_total, 16830);
    assert.equal(h.calls[0].payload.validation_status, 'validated');
    assert.equal(h.queries.some((query) => query.update), false);
  });
}

for (const type of ['checkout.session.expired', 'checkout.session.async_payment_failed', 'payment_intent.payment_failed']) {
  test(`formation ${type} : événement transmis sans libération dans l'Edge`, async () => {
    const fixture = courseFixture({ prepared: true, promotion: true });
    const object = type.startsWith('payment_intent') ? {
      ...fixture.object, id: 'pi_test_course', object: 'payment_intent', amount_total: undefined,
      amount_received: 0, amount: 16830,
    } : { ...fixture.object, status: 'expired', payment_status: 'unpaid' };
    const h = harness(fixture);
    assert.equal((await h.dispatch(event(type, object))).status, 200);
    assert.equal(h.calls[0].name, 'process_course_stripe_event');
    assert.equal(h.calls[0].payload.event_type, type);
    assert.equal(h.calls[0].payload.amount_total, 16830);
    assert.equal(h.queries.some((query) => query.update), false);
    if (type === 'payment_intent.payment_failed') {
      assert.equal((await h.dispatch(event('checkout.session.completed', fixture.object, 'evt_test_retry'))).status, 200);
      assert.equal(h.calls[1].name, 'process_course_stripe_event');
    }
  });
  test(`ancienne formation ${type} : ne passe pas par la RPC promotions`, async () => {
    const fixture = courseFixture();
    const h = harness(fixture);
    assert.equal((await h.dispatch(event(type, fixture.object))).status, 200);
    assert.equal(h.calls[0].name, 'process_stripe_post_payment_event');
    assert.equal(h.calls[0].payload.validation_status, 'not_required');
  });
}

for (const change of [
  (s) => { s.amount_total = 18700; },
  (s) => { s.currency = 'usd'; },
  (s) => { s.payment_status = 'unpaid'; },
  (s) => { s.metadata.promo_redemption_id = 'other-redemption'; },
  (s) => { s.metadata.stripe_product_id = 'prod_other'; },
  (s) => { s.metadata.user_id = orderId; },
]) {
  test(`formation remisée incohérente refusée : ${change.toString()}`, async () => {
    const fixture = courseFixture({ prepared: true, promotion: true });
    change(fixture.object);
    const h = harness(fixture);
    assert.equal((await h.dispatch(event('checkout.session.completed', fixture.object))).status, 400);
    assert.equal(h.calls.length, 0);
  });
}

test('le retry propage already_processed et les erreurs RPC ne deviennent pas des succès', async () => {
  const fixture = courseFixture({ prepared: true, promotion: true });
  const h = harness({ ...fixture, alreadyProcessed: true });
  const response = await h.dispatch(event('checkout.session.completed', fixture.object));
  assert.equal((await response.json()).already_processed, true);
  const failing = harness({ ...fixture, rpcError: true });
  assert.equal((await failing.dispatch(event('checkout.session.completed', fixture.object))).status, 500);
  assert.equal(failing.deliveries.length, 0);
});

for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
  test(`Diagnostic historique ${type} : RPC v42 et confirmation contractuelle exécutées`, async () => {
    const h = harness();
    assert.equal((await h.dispatch(event(type, diagnosticObject()))).status, 200);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].name, 'process_diagnostic_ia_stripe_event');
    assert.equal(h.calls[0].payload.diagnostic_order_id, orderId);
    assert.equal(h.calls[0].payload.stripe_customer_id, 'cus_test_diagnostic');
    assert.equal(h.calls[0].payload.payment_type, 'diagnostic_ia_express');
    assert.equal(h.calls[0].payload.amount_total, 14900);
    assert.equal(h.deliveries.length, 1);
    assert.equal(h.deliveries[0].messageId, `diagnostic-contract-${orderId}`);
    assert.match(h.deliveries[0].body, /Formulaire électronique/);
    const claim = h.queries.find((query) => query.update?.contract_confirmation_delivery_status === 'sending');
    assert.ok(claim.filters.some(([op, column, value]) => op === 'lt'
      && column === 'contract_confirmation_delivery_attempts' && value === 5));
    assert.ok(claim.filters.some(([op]) => op === 'or'));
    assert.ok(h.queries.some((query) => query.update?.contract_confirmation_delivery_status === 'sent'));
    assert.equal(h.queries.some((query) => query.table === 'commercial_checkout_intents'), false);
  });
}

for (const type of ['payment_intent.payment_failed', 'checkout.session.expired', 'checkout.session.async_payment_failed']) {
  test(`Diagnostic historique ${type} : RPC v42 sans confirmation ni promotions`, async () => {
    const h = harness();
    assert.equal((await h.dispatch(event(type, diagnosticObject()))).status, 200);
    assert.equal(h.calls[0].name, 'process_diagnostic_ia_stripe_event');
    assert.equal(h.deliveries.length, 0);
    assert.equal(h.queries.length, 0);
  });
}

test('Diagnostic : mauvais montant, identité et devise sont refusés avant la RPC', async () => {
  for (const mutate of [
    (s) => { s.amount_total = 13410; }, (s) => { s.currency = 'usd'; },
    (s) => { s.metadata.diagnostic_order_id = 'invalid'; }, (s) => { s.metadata.price_id = 'price_other'; },
  ]) {
    const object = diagnosticObject(); mutate(object);
    const h = harness();
    assert.equal((await h.dispatch(event('checkout.session.completed', object))).status, 400);
    assert.equal(h.calls.length, 0);
    assert.equal(h.deliveries.length, 0);
  }
});

test('Diagnostic : envoi déjà réclamé ou envoyé ne provoque pas un second email', async () => {
  const h = harness({ alreadyProcessed: true, claimUnavailable: true,
    deliveryState: { contract_confirmation_delivery_status: 'sent', contract_confirmation_delivery_attempts: 1 } });
  const response = await h.dispatch(event('checkout.session.completed', diagnosticObject()));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).already_processed, true);
  assert.equal(h.deliveries.length, 0);
});

test('Diagnostic : panne SMTP conserve la reprise HTTP 500 et un code non sensible', async () => {
  const h = harness({ smtpFails: true });
  assert.equal((await h.dispatch(event('checkout.session.completed', diagnosticObject()))).status, 500);
  assert.equal(h.calls[0].name, 'process_diagnostic_ia_stripe_event');
  assert.ok(h.queries.some((query) => query.update?.contract_confirmation_delivery_error_code === 'smtp_delivery_failed'));
  assert.deepEqual(h.warnings, ['diagnostic_contract_confirmation_delivery_failed']);
});

test('Diagnostic : reprise en attente et plafond de cinq tentatives conservés', async () => {
  const pending = harness({ claimUnavailable: true,
    deliveryState: { contract_confirmation_delivery_status: 'sending', contract_confirmation_delivery_attempts: 1 } });
  assert.equal((await pending.dispatch(event('checkout.session.completed', diagnosticObject()))).status, 500);
  const exhausted = harness({ smtpFails: true, deliveryAttempts: 4 });
  assert.equal((await exhausted.dispatch(event('checkout.session.completed', diagnosticObject()))).status, 200);
});

test('Diagnostic : une erreur RPC empêche la confirmation contractuelle', async () => {
  const h = harness({ rpcError: true });
  assert.equal((await h.dispatch(event('checkout.session.completed', diagnosticObject()))).status, 500);
  assert.equal(h.deliveries.length, 0);
  assert.equal(h.queries.length, 1);
  assert.equal(h.queries[0].update, undefined);
});

test('la limite SMTP v42 accepte une confirmation longue sans changer les accusés existants', () => {
  const message = diagnosticContract.buildDiagnosticContractConfirmationMessage({
    order: { id: orderId, customer_email: 'diagnostic@example.test', paid_at: '2026-08-29T12:00:00Z', sales_context: 'personal', amount_total: 14900 },
    cgv: { version: 'CGV-B2C-2026-08-26', content_text: 'x'.repeat(11000) },
    withdrawalForm: { content_text: 'Formulaire de test' },
  });
  assert.ok(buildCommercialEmail(message, 'sender@example.test').body.length > 10000);
  assert.throws(() => buildCommercialEmail({ ...message, body: 'x'.repeat(30001) }, 'sender@example.test'), /smtp_body_invalid/);
});

for (const type of ['customer.created', 'payment_intent.succeeded']) {
  test(`${type} reste ignoré comme en v42`, async () => {
    const h = harness();
    const response = await h.dispatch(event(type, diagnosticObject()));
    assert.deepEqual(await response.json(), { received: true, ignored: true });
    assert.equal(h.clientCount, 0);
  });
}

test('remboursements et litiges restent dans le processeur historique', async () => {
  for (const type of ['refund.updated', 'charge.dispute.created']) {
    const h = harness();
    assert.equal((await h.dispatch(event(type, { id: 'object_test', amount: 16830,
      payment_intent: 'pi_test_course', currency: 'eur' }))).status, 200);
    assert.equal(h.calls[0].name, 'process_stripe_post_payment_event');
    assert.equal(h.queries.length, 0);
  }
});

test('ancienne session sans intention et frais déplacement gardent leur routage v42', async () => {
  const fixture = courseFixture(); delete fixture.object.metadata.checkout_intent_id;
  const h = harness();
  assert.equal((await h.dispatch(event('checkout.session.completed', fixture.object))).status, 200);
  assert.equal(h.calls[0].payload.validation_status, 'legacy_review');
  const travel = { ...fixture.object, amount_total: 3000,
    metadata: { payment_type: 'in_person_travel_fee', booking_request_id: intentId, user_id: userId } };
  assert.equal((await h.dispatch(event('checkout.session.completed', travel))).status, 200);
  assert.equal(h.calls[1].name, 'process_stripe_post_payment_event');
  assert.equal(h.calls[1].payload.validation_status, 'validated');
});

test('signature, mode et méthode sont contrôlés avant tout accès Supabase', async () => {
  const h = harness();
  const payload = event('checkout.session.completed', diagnosticObject());
  assert.equal((await h.dispatch(payload, null)).status, 400);
  assert.equal((await h.dispatch(payload, 'bad-signature')).status, 400);
  assert.equal((await h.dispatch({ ...payload, livemode: true })).status, 400);
  assert.equal((await h.dispatch(payload, null, 'GET')).status, 405);
  assert.equal(h.clientCount, 0);
});

test('aucune reservation dans le webhook ni mutation directe LMS dans ses helpers', () => {
  const restored = ['diagnosticPayment.js', 'diagnosticContractConfirmation.js'].map((name) =>
    readFileSync(resolve('supabase/functions/_shared', name), 'utf8')).join('\n');
  assert.doesNotMatch(source + restored, /validate-diagnostic-promotion|process_diagnostic_stripe_event|reserve_diagnostic_promotion/);
  assert.doesNotMatch(source + restored, /from\(['"](?:promo_redemptions|purchases|course_access)['"]\)\s*\.(?:insert|update|upsert|delete)/s);
});
function promotedDiagnostic() {
  const object = diagnosticObject();
  object.amount_total = 745;
  object.metadata.promo_redemption_id = redemptionId;
  return { object, diagnosticOrder: { id: orderId, user_id: userId,
    original_amount_cents: 14900, discount_amount_cents: 14155, currency: 'eur',
    final_amount_cents: 745, promo_redemption_id: redemptionId } };
}

for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
  test(`Diagnostic remisé ${type} : RPC et confirmation du montant réellement payé`, async () => {
    const fixture = promotedDiagnostic();
    const h = harness(fixture);
    assert.equal((await h.dispatch(event(type, fixture.object))).status, 200);
    assert.equal(h.calls[0].name, 'process_diagnostic_ia_stripe_event');
    assert.equal(h.calls[0].payload.amount_total, 745);
    assert.equal(h.deliveries.length, 1);
    assert.match(h.deliveries[0].body, /Prix total payé : 7,45\s€/);
    assert.doesNotMatch(h.deliveries[0].body, /Prix total payé : 149/);
  });
}
for (const type of ['payment_intent.payment_failed', 'checkout.session.expired', 'checkout.session.async_payment_failed']) {
  test(`Diagnostic remisé ${type} : délégation transactionnelle sans libération Edge`, async () => {
    const fixture = promotedDiagnostic();
    const h = harness(fixture);
    assert.equal((await h.dispatch(event(type, fixture.object))).status, 200);
    assert.equal(h.calls[0].name, 'process_diagnostic_ia_stripe_event');
    assert.equal(h.calls[0].payload.event_type, type);
    assert.equal(h.deliveries.length, 0);
    assert.equal(h.queries.length, 0);
  });
}
for (const alter of [
  (f) => { f.object.amount_total = 14900; },
  (f) => { f.object.metadata.promo_redemption_id = orderId; },
  (f) => { f.diagnosticOrder.user_id = orderId; },
  (f) => { f.object.amount_total = f.diagnosticOrder.final_amount_cents = 0; },
]) {
  test(`Diagnostic remisé : montant ou liaison falsifiée refusés ${alter}`, async () => {
    const fixture = promotedDiagnostic(); alter(fixture);
    const h = harness(fixture);
    assert.equal((await h.dispatch(event('checkout.session.completed', fixture.object))).status, 400);
    assert.equal(h.calls.length, 0);
    assert.equal(h.deliveries.length, 0);
  });
}
test('Diagnostic remisé : panne SMTP puis retry du même événement déjà traité', async () => {
  const fixture = promotedDiagnostic();
  const payload = event('checkout.session.completed', fixture.object);
  const failed = harness({ ...fixture, smtpFails: true });
  assert.equal((await failed.dispatch(payload)).status, 500);
  const retry = harness({ ...fixture, alreadyProcessed: true, deliveryAttempts: 1 });
  const response = await retry.dispatch(payload);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).already_processed, true);
  assert.equal(retry.deliveries.length, 1);
  assert.match(retry.deliveries[0].body, /7,45\s€/);
  assert.equal(retry.deliveries[0].body, failed.deliveries[0].body);
});

// Contre-tests : les mêmes assertions comportementales doivent tuer les mutants.
async function requireHistoricalDiagnostic(h) {
  assert.equal((await h.dispatch(event('checkout.session.completed', diagnosticObject()))).status, 200);
  assert.equal(h.calls[0].name, 'process_diagnostic_ia_stripe_event');
  assert.equal(h.deliveries.length, 1);
  assert.match(h.deliveries[0].body, /Prix total payé : 149 €/);
}
test('contre-test : supprimer le routage Diagnostic fait réellement échouer le contrat', async () => {
  await requireHistoricalDiagnostic(harness());
  await assert.rejects(requireHistoricalDiagnostic(harness({
    mutate: (code) => code.replace("? 'process_diagnostic_ia_stripe_event'", "? 'process_stripe_post_payment_event'"),
  })), { name: 'AssertionError' });
});
test('contre-test : supprimer la confirmation Diagnostic fait réellement échouer le contrat', async () => {
  await assert.rejects(requireHistoricalDiagnostic(harness({
    mutate: (code) => code.replace("diagnosticEvent\n      && ['checkout.session.completed'", "false\n      && ['checkout.session.completed'"),
  })), { name: 'AssertionError' });
});
