import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as payment from '../_shared/diagnosticPayment.js';
import * as promotion from '../_shared/diagnosticPromotion.js';
import * as evidence from '../_shared/diagnosticContractEvidence.js';

const user = { id: 'a3000000-0000-4000-8000-000000000001', email: 'diagnostic@example.test' };
const orderId = 'a3000000-0000-4000-8000-000000000002';
const redemptionId = 'a3000000-0000-4000-8000-000000000003';
const consent = { sales_context: 'personal', cgv_accepted: true, cgv_version: 'CGV-B2C-2026-08-26' };
const quote = { valid: true, normalized_code: 'LOCAL95', original_amount_cents: 14900,
  discount_amount_cents: 14155, final_amount_cents: 745 };
function harness(endpoint, options = {}) {
  const calls = [], writes = [], sessions = [], documents = [];
  const order = { id: orderId, status: 'payment_pending', sales_context: 'personal',
    cgv_document_version_id: 'cgv', cgv_acceptance_statement_version_id: 'acceptance',
    original_amount_cents: 14900, discount_amount_cents: 0, final_amount_cents: 14900,
    promo_redemption_id: null, stripe_checkout_session_id: null, ...options.order };
  let handler;
  const env = { SUPABASE_URL: 'https://supabase.invalid', SUPABASE_ANON_KEY: 'fixture-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_DIAGNOSTIC_IA_PRICE_ID: 'price_fixture', SITE_URL: 'https://formaprompt.example' };
  const admin = {
    auth: { async getUser() { return { data: { user: options.noUser ? null : user }, error: null }; } },
    rpc(name, args) {
      calls.push({ name, args });
      const result = () => {
        if (name === 'validate_promo_code_for_checkout') return { data: options.quote ?? quote,
          error: options.validationError ?? null };
        if (name === 'prepare_diagnostic_promotion_checkout') return {
          data: { order_id: orderId, promo_redemption_id: args.p_promo_code ? redemptionId : null,
            original_amount_cents: 14900, discount_amount_cents: args.p_promo_code ? 14155 : 0,
            final_amount_cents: args.p_promo_code ? 745 : 14900, normalized_code: args.p_promo_code,
            reservation_expires_at: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
            ...options.configuration },
          error: options.configurationError ?? null };
        assert.ok(['reset_diagnostic_promotion_checkout', 'release_promo_redemption_for_checkout'].includes(name));
        return { data: true, error: null };
      };
      return { single: async () => result(), then: (resolve) => Promise.resolve(result()).then(resolve) };
    },
    from(table) {
      assert.ok(['legal_document_versions', 'diagnostic_ia_orders', 'diagnostic_ia_consents',
        'promo_redemptions'].includes(table), 'Aucune mutation LMS/formation autorisee');
      const filters = [];
      let action, columns;
      const result = () => {
        if (table === 'legal_document_versions') { documents.push(filters); return { data: {
          id: filters.some((f) => String(f[1]).endsWith('acceptance_statement')) ? 'acceptance' : 'cgv',
        }, error: null }; }
        if (table === 'promo_redemptions') return { data: { promo_codes: { code: options.frozenCode } }, error: null };
        if (table === 'diagnostic_ia_consents') return { data: null, error: options.consentError ?? null };
        if (filters.some((f) => f[0] === 'paid')) return { data: options.paid ? { id: orderId } : null, error: null };
        if (action === 'insert' && options.racingInsert) return { data: null, error: { code: '23505' } };
        if (!action && !options.order && columns !== 'id' && !options.racingInsert) return { data: null, error: null };
        return { data: order, error: options.orderUpdateError && action === 'update' ? { code: 'fixture' } : null };
      };
      const chain = {
        select(value) { columns = value; return chain; },
        eq(...args) { filters.push(args); return chain; },
        in(_name, value) { if (value.includes('paid')) filters.push(['paid']); return chain; },
        order() { return chain; }, limit() { return chain; },
        insert(values) { action = 'insert'; writes.push({ table, action, values }); return chain; },
        update(values) { action = 'update'; writes.push({ table, action, values }); return chain; },
        maybeSingle: async () => result(), single: async () => result(),
        then: (resolve) => Promise.resolve(result()).then(resolve),
      };
      return chain;
    },
  };
  class Stripe {
    prices = { retrieve: async () => ({ active: true, livemode: false, currency: 'eur',
      unit_amount: 14900, recurring: null, product: 'prod_fixture' }) };
    checkout = { sessions: {
      retrieve: async () => ({ status: 'open', url: 'https://checkout.stripe.com/c/pay/fixture', ...options.session }),
      create: async (params, settings) => {
        sessions.push({ params, settings });
        if (options.stripeError) throw options.stripeError;
        return { id: 'cs_fixture', url: 'https://checkout.stripe.com/c/pay/fixture', customer: 'cus_fixture' };
      },
    } };
  }
  const deps = {
    'npm:stripe@22.4.0': { default: Stripe },
    'npm:@supabase/supabase-js@2.105.1': { createClient: () => admin },
    '../_shared/cors.ts': { corsHeaders: {}, jsonResponse: (body, status = 200) => Response.json(body, { status }) },
    '../_shared/diagnosticPayment.js': payment, '../_shared/diagnosticPromotion.js': promotion,
    '../_shared/diagnosticContractEvidence.js': evidence,
  };
  const compiled = ts.transpileModule(readFileSync('supabase/functions/' + endpoint + '/index.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.deepEqual(compiled.diagnostics, []);
  runInNewContext(compiled.outputText, {
    exports: {}, require: (name) => { assert.ok(deps[name], name); return deps[name]; },
    Deno: { env: { get: (name) => env[name] }, serve: (value) => { handler = value; } },
    Response, URL, Error, console: { error() {}, warn() {} },
  });
  return { calls, writes, sessions, documents, run: (body, auth = true) => handler(new Request('https://edge.invalid', {
    method: 'POST', headers: auth ? { Authorization: 'Bearer fixture' } : {}, body: JSON.stringify({
      ...(body.promo_code ? { promo_acceptance_version: evidence.DIAGNOSTIC_PROMO_ACCEPTANCE_VERSION,
        promo_acceptance_text: evidence.buildDiagnosticPromoEvidence(quote).text } : {}), ...body,
    }),
  })) };
}

for (const code of [undefined, null, '', ' ', 'bad code!', 95, 'A'.repeat(65)]) {
  test('validation refuse un code absent ou mal forme : ' + JSON.stringify(code), async () => {
    const h = harness('validate-diagnostic-promotion');
    const response = await h.run({ promo_code: code });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, promotion.DIAGNOSTIC_PROMOTION.genericInvalidMessage);
    assert.equal(h.calls.length, 0); assert.equal(h.writes.length, 0);
  });
}
test('validation exige une authentification serveur', async () => {
  assert.equal((await harness('validate-diagnostic-promotion').run({}, false)).status, 401);
  assert.equal((await harness('validate-diagnostic-promotion', { noUser: true }).run({ promo_code: 'LOCAL95' })).status, 401);
});
for (const reason of ['inexistant', 'expire', 'futur', 'email', 'cible', 'quota_global', 'quota_utilisateur']) {
  test('validation masque le refus SQL : ' + reason, async () => {
    const h = harness('validate-diagnostic-promotion', { validationError: { code: 'P0001', message: reason } });
    const response = await h.run({ promo_code: 'LOCAL95' });
    const body = await response.json();
    assert.equal(body.valid, false); assert.equal(body.final_amount_cents, 14900);
    assert.equal(body.message, promotion.DIAGNOSTIC_PROMOTION.genericInvalidMessage);
    assert.equal(h.writes.length, 0);
  });
}
test('validation derive identite, cible et 14900 du serveur; devis 95 % = 745', async () => {
  const h = harness('validate-diagnostic-promotion');
  const body = await (await h.run({ promo_code: ' local95 ', amount: 1, email: 'forged@example.test', user_id: 'other',
    target_type: 'course', target_key: 'formation-ia' })).json();
  assert.equal(body.final_amount_cents, 745); assert.equal(body.discount_amount_cents, 14155);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].args)), { p_code: 'LOCAL95', p_user_id: user.id,
    p_email: user.email, p_target_type: 'diagnostic', p_target_key: 'diagnostic-ia-express',
    p_original_amount_cents: 14900 });
  assert.equal(h.sessions.length, 0);
});
for (const value of [0, -1, 0.5, 14901]) {
  test('validation refuse un devis non positif/incoherent : ' + value, async () => {
    const h = harness('validate-diagnostic-promotion', { quote: { ...quote, final_amount_cents: value,
      discount_amount_cents: 14900 - value } });
    assert.equal((await (await h.run({ promo_code: 'LOCAL95' })).json()).valid, false);
  });
}
test('checkout sans code preserve le Price, les CGV, les consents et idempotencyKey historiques', async () => {
  const h = harness('create-diagnostic-checkout');
  assert.equal((await h.run(consent)).status, 200);
  const { params, settings } = h.sessions[0];
  assert.deepEqual(JSON.parse(JSON.stringify(params.line_items)), [{ price: 'price_fixture', quantity: 1 }]);
  assert.equal(settings.idempotencyKey, 'diagnostic-ia-checkout-' + orderId);
  assert.equal(params.allow_promotion_codes, false);
  assert.equal(params.invoice_creation.enabled, true);
  assert.ok(params.payment_intent_data.metadata);
  assert.ok(h.writes.some((w) => w.table === 'diagnostic_ia_consents' && w.values.granted));
  assert.ok(h.documents.some((filters) => filters.some(([key, value]) => key === 'version'
    && value === 'DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26')));
  assert.equal(params.metadata.promo_redemption_id, undefined);
});
test('checkout avec promotion utilise uniquement les 745 cents reserves, jamais ceux du navigateur', async () => {
  const h = harness('create-diagnostic-checkout');
  assert.equal((await h.run({ ...consent, promo_code: ' local95 ', final_amount_cents: 1 })).status, 200);
  const { params } = h.sessions[0];
  assert.equal(params.line_items[0].price_data.unit_amount, 745);
  assert.equal(params.line_items[0].price_data.product, 'prod_fixture');
  assert.equal(params.metadata.promo_redemption_id, redemptionId);
  assert.equal(params.customer_email, user.email);
  assert.ok(params.expires_at > Date.now() / 1000 + 30 * 60);
  assert.ok(h.documents.some((filters) => filters.some(([key, value]) => key === 'version'
    && value === evidence.DIAGNOSTIC_PROMO_ACCEPTANCE_VERSION)));
  assert.ok(h.writes.some((w) => w.table === 'diagnostic_ia_consents' && w.values.granted));
});

test('une preuve client obsolete ou falsifiee ne peut ouvrir Stripe', async () => {
  const h = harness('create-diagnostic-checkout');
  const response = await h.run({ ...consent, promo_code: 'LOCAL95', promo_acceptance_text: 'Paiement de 149 €' });
  assert.equal(response.status, 409);
  assert.equal(h.sessions.length, 0);
  assert.equal(h.writes.some((w) => w.table === 'diagnostic_ia_consents'), false);
});
test('checkout conflit concurrent 23505 reutilise la meme commande et cle Stripe', async () => {
  const h = harness('create-diagnostic-checkout', { racingInsert: true });
  assert.equal((await h.run({ ...consent, promo_code: 'LOCAL95' })).status, 200);
  assert.equal(h.sessions[0].settings.idempotencyKey, 'diagnostic-ia-checkout-' + orderId);
});
for (const promoCode of ['LOCAL95', 'OTHER', null]) {
  test('session ouverte respecte son code fige : ' + promoCode, async () => {
    const h = harness('create-diagnostic-checkout', { order: { stripe_checkout_session_id: 'cs_existing',
      promo_redemption_id: redemptionId }, frozenCode: 'LOCAL95' });
    assert.equal((await h.run({ ...consent, promo_code: promoCode })).status, promoCode === 'LOCAL95' ? 200 : 400);
    assert.equal(h.sessions.length, 0); assert.equal(h.writes.length, 0);
  });
}
test('refus SQL ne libere pas une configuration valide concurrente', async () => {
  const h = harness('create-diagnostic-checkout', { configurationError: { code: 'P0001' } });
  assert.equal((await h.run({ ...consent, promo_code: 'LOCAL95' })).status, 400);
  assert.equal(h.sessions.length, 0);
  assert.equal(h.calls.some((c) => c.name === 'reset_diagnostic_promotion_checkout'), false);
});
for (const type of ['StripeConnectionError', 'StripeAPIError', 'StripeInvalidRequestError']) {
  test('erreur Stripe : preservation ou liberation selon ambiguite ' + type, async () => {
    const h = harness('create-diagnostic-checkout', { stripeError: { type } });
    assert.equal((await h.run({ ...consent, promo_code: 'LOCAL95' })).status, 500);
    assert.equal(h.calls.some((c) => c.name === 'reset_diagnostic_promotion_checkout'), type === 'StripeInvalidRequestError');
  });
}
test('zero refuse avant toute session Stripe meme si le devis RPC est corrompu', async () => {
  const h = harness('create-diagnostic-checkout', { configuration: { final_amount_cents: 0 } });
  assert.equal((await h.run({ ...consent, promo_code: 'LOCAL95' })).status, 500);
  assert.equal(h.sessions.length, 0);
});
test('session Stripe creee puis erreur DB : ne pas liberer la reservation', async () => {
  const h = harness('create-diagnostic-checkout', { orderUpdateError: true });
  assert.equal((await h.run({ ...consent, promo_code: 'LOCAL95' })).status, 500);
  assert.equal(h.sessions.length, 1);
  assert.equal(h.calls.some((c) => c.name === 'reset_diagnostic_promotion_checkout'), false);
});
