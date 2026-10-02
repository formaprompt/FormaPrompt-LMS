import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { buildPurchaseConversionReceipt, createPurchaseConversionReceiptHandler } from '../_shared/purchaseConversionReceipt.js';

const userId = '11000000-0000-4000-8000-000000000001';
const otherId = '22000000-0000-4000-8000-000000000002';
const sessionId = 'cs_live_receipt123';
function fixture(diagnostic = false) {
  const businessId = '33000000-0000-4000-8000-000000000003';
  return {
    userId, sessionId,
    transaction: {
      id: '44000000-0000-4000-8000-000000000004', user_id: userId,
      purchase_id: diagnostic ? null : businessId, diagnostic_order_id: diagnostic ? businessId : null,
      booking_request_id: null, course_id: diagnostic ? null : 'formation-ia',
      payment_type: diagnostic ? 'diagnostic_ia_express' : 'course', status: 'paid',
      amount_total: 11900, amount_refunded: 0, currency: 'eur',
      stripe_checkout_session_id: sessionId, last_event_id: 'evt_receipt123',
    },
    event: {
      event_id: 'evt_receipt123', event_type: 'checkout.session.completed',
      stripe_object_id: sessionId, livemode: true, payload_sha256: 'a'.repeat(64), processing_result: 'processed',
    },
    [diagnostic ? 'order' : 'purchase']: {
      id: businessId, user_id: userId, course_id: 'formation-ia', payment_status: 'paid', status: 'paid',
      amount_total: 11900, final_amount_cents: 11900, currency: 'eur',
      stripe_checkout_session_id: sessionId, paid_at: '2026-10-02T12:00:00Z',
    },
  };
}

for (const diagnostic of [false, true]) {
  test(`reçu ${diagnostic ? 'Diagnostic remisé simulé' : 'formation'} : uniquement les cinq champs publics`, () => {
    const f = fixture(diagnostic);
    assert.deepEqual(buildPurchaseConversionReceipt(f), {
      verified: true, transaction_id: f.transaction.id, amount_total_cents: 11900, currency: 'EUR', livemode: true,
    });
    f.event.event_type = 'checkout.session.async_payment_succeeded';
    assert.ok(buildPurchaseConversionReceipt(f));
  });
}

const mutations = {
  'propriétaire transaction croisé': f => { f.transaction.user_id = otherId; },
  'propriétaire achat croisé': f => { f.purchase.user_id = otherId; },
  'session transaction contradictoire': f => { f.transaction.stripe_checkout_session_id = 'cs_live_other'; },
  'session achat contradictoire': f => { f.purchase.stripe_checkout_session_id = 'cs_live_other'; },
  'session événement contradictoire': f => { f.event.stripe_object_id = 'cs_live_other'; },
  'événement non rattaché': f => { f.event.event_id = 'evt_other'; },
  'mode absent': f => { f.event.livemode = null; },
  'mode test': f => { f.event.livemode = false; },
  'préfixe test contradictoire': f => { f.sessionId = f.transaction.stripe_checkout_session_id = f.purchase.stripe_checkout_session_id = f.event.stripe_object_id = 'cs_test_receipt123'; },
  'empreinte absente': f => { f.event.payload_sha256 = null; },
  'événement historique': f => { f.event.event_type = 'legacy_import'; },
  'événement remboursé': f => { f.event.event_type = 'refund.updated'; },
  'événement non traité': f => { f.event.processing_result = 'review_required'; },
  'montant achat incohérent': f => { f.purchase.amount_total = 14900; },
  'montant nul': f => { f.transaction.amount_total = f.purchase.amount_total = 0; },
  'montant fractionnaire': f => { f.transaction.amount_total = f.purchase.amount_total = 11900.5; },
  'montant texte': f => { f.transaction.amount_total = f.purchase.amount_total = '11900'; },
  'devise incohérente': f => { f.purchase.currency = 'usd'; },
  'devise absente': f => { f.transaction.currency = null; },
  'remboursement positif': f => { f.transaction.amount_refunded = 1; },
  'achat administrateur': f => { f.purchase.payment_status = 'granted_by_admin'; },
  'formation croisée': f => { f.purchase.course_id = 'formation-other'; },
  'frais de déplacement': f => { f.transaction.payment_type = 'in_person_travel_fee'; },
  'identifiant transaction non opaque': f => { f.transaction.id = sessionId; },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`aucun reçu : ${name}`, () => {
    const f = fixture(); mutate(f); assert.equal(buildPurchaseConversionReceipt(f), null);
  });
}
for (const status of ['created', 'processing', 'payment_pending', 'pending', 'cancelled', 'expired', 'failed', 'refunded', 'partially_refunded', 'disputed', 'dispute_won', 'dispute_lost', 'chargeback']) {
  test(`aucun reçu : état ${status}`, () => {
    const f = fixture(); f.transaction.status = status; assert.equal(buildPurchaseConversionReceipt(f), null);
    const d = fixture(true); d.order.status = status; assert.equal(buildPurchaseConversionReceipt(d), null);
  });
}
test('Diagnostic : propriétaire, montant final, commande et date doivent correspondre', () => {
  for (const mutate of [f => { f.order.user_id = otherId; }, f => { f.order.final_amount_cents = 14900; },
    f => { f.order.id = otherId; }, f => { f.order.paid_at = null; }, f => { f.transaction.purchase_id = otherId; }]) {
    const f = fixture(true); mutate(f); assert.equal(buildPurchaseConversionReceipt(f), null);
  }
});

function harness(f = fixture(), { authError = false, readError = false } = {}) {
  const calls = [];
  const client = {
    from(table) {
      const filters = [];
      const query = {
        select(columns) { calls.push({ table, columns, filters }); return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        async maybeSingle() {
          return { data: { stripe_payment_transactions: f.transaction, stripe_webhook_events: f.event,
            purchases: f.purchase, diagnostic_ia_orders: f.order }[table] ?? null, error: readError ? {} : null };
        },
      };
      return query;
    },
  };
  let readClients = 0;
  const handler = createPurchaseConversionReceiptHandler({
    createAuthClient: () => ({ auth: { async getUser(token) {
      calls.push({ token }); return { data: { user: { id: userId } }, error: authError ? {} : null };
    } } }),
    createReadClient: () => { readClients++; return client; },
  });
  return { handler, calls, readClients: () => readClients };
}
function request(body = { session_id: sessionId }, method = 'POST', authenticated = true) {
  return new Request('https://receipt.invalid', {
    method, headers: authenticated ? { Authorization: 'Bearer test-jwt' } : {},
    ...(['GET', 'OPTIONS'].includes(method) ? {} : { body: JSON.stringify(body) }),
  });
}
test('handler réel : JWT vérifié et chaque lecture métier filtre le propriétaire et la session', async () => {
  for (const diagnostic of [false, true]) {
    const h = harness(fixture(diagnostic));
    const response = await h.handler(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { receipt: buildPurchaseConversionReceipt(fixture(diagnostic)) });
    assert.deepEqual(h.calls[0], { token: 'test-jwt' });
    for (const call of h.calls.filter(c => c.table && c.table !== 'stripe_webhook_events')) {
      assert.ok(call.filters.some(([key, value]) => key === 'user_id' && value === userId));
      assert.ok(call.filters.some(([key, value]) => key === 'stripe_checkout_session_id' && value === sessionId));
    }
  }
});
test('handler : référence URL seule, transaction absente ou étrangère ne produit rien', async () => {
  for (const mutate of [f => { f.transaction = null; }, f => { f.transaction.user_id = otherId; }, f => { f.purchase = null; }]) {
    const f = fixture(); mutate(f); const h = harness(f);
    assert.deepEqual(await (await h.handler(request())).json(), { receipt: null });
  }
});
test('handler : toutes les erreurs et prévol sont sans cache, sans fuite et sans accès métier avant authentification', async () => {
  const scenarios = [
    { req: request({}, 'GET'), status: 405 },
    { req: request({}, 'OPTIONS'), status: 204 },
    { req: request({}, 'POST', false), status: 401 },
    { req: request(), authError: true, status: 401 },
    { req: request({ session_id: sessionId, user_id: otherId }), status: 400 },
    { req: request({ session_id: 'invalid' }), status: 400 },
    { req: request(), readError: true, status: 503 },
  ];
  for (const scenario of scenarios) {
    const h = harness(fixture(), scenario); const response = await h.handler(scenario.req);
    assert.equal(response.status, scenario.status);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.doesNotMatch(await response.text(), /test-jwt|cs_live_|11000000|22000000/);
    if (scenario.status !== 503) assert.equal(h.readClients(), 0);
  }
});
test('endpoint déclaré, aucune API Stripe ni mutation ni journalisation', () => {
  const shared = readFileSync('supabase/functions/_shared/purchaseConversionReceipt.js', 'utf8');
  const endpoint = readFileSync('supabase/functions/get-purchase-conversion-receipt/index.ts', 'utf8');
  const config = readFileSync('supabase/config.toml', 'utf8');
  const compiled = ts.transpileModule(endpoint, {
    fileName: 'get-purchase-conversion-receipt/index.ts',
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.deepEqual(compiled.diagnostics, []);
  assert.match(config, /\[functions\.get-purchase-conversion-receipt\]\s*verify_jwt = true/);
  assert.doesNotMatch(shared + endpoint, /\.(?:insert|update|upsert|delete|rpc)\s*\(|console\.|STRIPE_SECRET|npm:stripe/);
});
