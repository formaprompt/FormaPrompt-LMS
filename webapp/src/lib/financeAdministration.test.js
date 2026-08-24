import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFinanceAdministration, summarizeStripeFinance } from './financeAdministration.js';

test('la synthèse distingue formation, déplacement, remboursements, litiges et net', () => {
  const result = summarizeStripeFinance([
    { currency: 'eur', gross_training_cents: 100000, travel_fee_cents: 0, successful_refund_cents: 10000, open_dispute_cents: 5000, lost_dispute_cents: 2000, estimated_net_stripe_cents: 88000, estimated_net_training_cents: 88000 },
    { currency: 'eur', gross_training_cents: 0, travel_fee_cents: 15000, successful_refund_cents: 0, open_dispute_cents: 0, lost_dispute_cents: 0, estimated_net_stripe_cents: 15000, estimated_net_training_cents: 0 },
  ]).eur;
  assert.equal(result.grossTrainingCents, 100000);
  assert.equal(result.travelFeeCents, 15000);
  assert.equal(result.successfulRefundCents, 10000);
  assert.equal(result.estimatedNetStripeCents, 103000);
  assert.equal(result.estimatedNetTrainingCents, 88000);
});

test('le chargement Finance ne déclenche aucun RPC ni appel Stripe', async () => {
  const sources = [];
  const resultFor = (table) => ({ data: table === 'admin_stripe_financial_summary' ? [] : [{ id: 'case-1' }], error: null });
  const chain = (table) => {
    const builder = {
      select() { return builder; }, gte() { return builder; }, lte() { return builder; },
      eq() { return builder; }, in() { return Promise.resolve(resultFor(table)); },
      order() { return Promise.resolve(resultFor(table)); },
    };
    return builder;
  };
  const client = { from(table) { sources.push(table); return chain(table); } };
  const result = await fetchFinanceAdministration(client, { dateFrom: '2026-01-01', dateTo: '2026-08-22', courseId: 'formation-ia' });
  assert.deepEqual(sources, ['admin_stripe_financial_summary', 'stripe_reconciliation_cases']);
  assert.equal(result.openCases.length, 1);
  assert.equal('rpc' in client, false);
  assert.equal('functions' in client, false);
});

test('une période ou une formation invalide est refusée avant toute requête', async () => {
  await assert.rejects(() => fetchFinanceAdministration({}, { dateFrom: '2026-08-22', dateTo: '2026-01-01', courseId: '' }), /période/);
  await assert.rejects(() => fetchFinanceAdministration({}, { dateFrom: '2026-01-01', dateTo: '2026-08-22', courseId: 'inconnue' }), /formation/);
});
