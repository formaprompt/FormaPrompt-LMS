import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStripeFinancialMode, enrichStripeFinancialRows } from './stripeFinancialMode.js';
import { summarizeStripeFinance } from './financeAdministration.js';

test('le mode repose sur le webhook, puis le préfixe Checkout historique ; les conflits sont inconnus', () => {
  for (const [transaction, expected] of [
    [{ last_event: { livemode: true } }, 'live'],
    [{ last_event: { livemode: false } }, 'test'],
    [{ stripe_checkout_session_id: 'cs_test_history' }, 'test'],
    [{ stripe_checkout_session_id: 'cs_live_history' }, 'live'],
    [{ stripe_payment_intent_id: 'pi_test_name' }, 'unknown'],
    [{ stripe_checkout_session_id: 'cs_live_conflict', last_event: { livemode: false } }, 'unknown'],
    [{ last_event: { livemode: 'true' } }, 'unknown'],
    [{}, 'unknown'],
  ]) assert.equal(classifyStripeFinancialMode(transaction), expected);
});

test('187 euros de test restent séparés du paiement réel remboursé ; net inconnu exclu', async () => {
  const rows = [
    { transaction_id: 'test', currency: 'eur', gross_training_cents: 18700, estimated_net_training_cents: 18700, estimated_net_stripe_cents: 18700 },
    { transaction_id: 'live', currency: 'eur', gross_training_cents: 935, successful_refund_cents: 935, lost_dispute_cents: 0, estimated_net_training_cents: 0, estimated_net_stripe_cents: 0 },
    { transaction_id: 'unknown', currency: 'eur', gross_training_cents: 1000, estimated_net_stripe_cents: 1000 },
  ];
  const client = { from(table) {
    assert.equal(table, 'stripe_payment_transactions');
    return { select(columns) {
      assert.match(columns, /last_event.*livemode/);
      return { in: async () => ({ data: [
        { id: 'test', stripe_checkout_session_id: 'cs_test_existing', last_event: { livemode: false } },
        { id: 'live', stripe_checkout_session_id: 'cs_live_existing', last_event: { livemode: true } },
      ], error: null }) };
    } };
  } };
  const enriched = await enrichStripeFinancialRows(client, rows);
  const live = summarizeStripeFinance(enriched).eur;
  assert.equal(live.grossTrainingCents, 935);
  assert.equal(live.successfulRefundCents, 935);
  assert.equal(live.estimatedNetStripeCents, 0);
  assert.equal(live.lostDisputeCents, 0);
  assert.equal(summarizeStripeFinance(enriched, 'test').eur.estimatedNetStripeCents, 18700);
  assert.equal(summarizeStripeFinance(enriched, 'unknown').eur.estimatedNetStripeCents, 1000);
  assert.equal(enriched[1].successful_refund_cents, rows[1].successful_refund_cents);
});

test('une erreur de lecture des modes bloque les totaux, une métadonnée absente reste inconnue', async () => {
  const client = { from: () => ({ select: () => ({ in: async () => ({ error: { message: 'Accès refusé' } }) }) }) };
  await assert.rejects(() => enrichStripeFinancialRows(client, [{ transaction_id: 'one' }]), /Accès refusé/);
  assert.deepEqual(await enrichStripeFinancialRows({}, []), []);
  assert.equal((await enrichStripeFinancialRows({}, [{}]))[0].stripe_mode, 'unknown');
  assert.deepEqual(summarizeStripeFinance([{ currency: 'eur', estimated_net_stripe_cents: 18700 }]), {});
});
