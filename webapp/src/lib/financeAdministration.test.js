import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFinanceAdministration, fetchStripeFinancialRows, summarizeStripeFinance } from './financeAdministration.js';

test('la synthèse distingue formation, déplacement, remboursements, litiges et net', () => {
  const result = summarizeStripeFinance([
    { currency: 'eur', gross_training_cents: 100000, travel_fee_cents: 0, successful_refund_cents: 10000, open_dispute_cents: 5000, lost_dispute_cents: 2000, estimated_net_stripe_cents: 88000, estimated_net_training_cents: 88000 },
    { currency: 'eur', gross_training_cents: 0, travel_fee_cents: 15000, successful_refund_cents: 0, open_dispute_cents: 0, lost_dispute_cents: 0, estimated_net_stripe_cents: 15000, estimated_net_training_cents: 0 },
  ].map((row) => ({ ...row, stripe_mode: 'live' }))).eur;
  assert.equal(result.grossTrainingCents, 100000);
  assert.equal(result.travelFeeCents, 15000);
  assert.equal(result.successfulRefundCents, 10000);
  assert.equal(result.estimatedNetStripeCents, 103000);
  assert.equal(result.estimatedNetTrainingCents, 88000);
});

test('le chargement Finance ne déclenche aucun RPC ni appel Stripe', async () => {
  const sources = [];
  const resultFor = (table) => ({ data: table === 'admin_stripe_financial_summary' ? [] : [{ id: 'case-1' }], count: 0, error: null });
  const chain = (table) => {
    const builder = {
      select() { return builder; }, gte() { return builder; }, lte() { return builder; },
      eq() { return builder; }, in() { return Promise.resolve(resultFor(table)); },
      order() { return builder; }, range() { return Promise.resolve(resultFor(table)); },
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

test('Finance charge la preuve de mode après les filtres période et formation, et propage les erreurs', async () => {
  const filtersSeen = [];
  let metadataError = null;
  const client = { from(table) {
    const builder = {
      select() { return builder; },
      gte(key, value) { filtersSeen.push([key, value]); return builder; },
      lte(key, value) { filtersSeen.push([key, value]); return builder; },
      eq(key, value) { filtersSeen.push([key, value]); return builder; },
      order() { return builder; },
      range: async () => ({ data: [{ transaction_id: 'paid', currency: 'eur', estimated_net_stripe_cents: 100 }], count: 1, error: null }),
      in: async () => table === 'stripe_payment_transactions'
        ? { data: [{ id: 'paid', last_event: { livemode: true } }], error: metadataError }
        : { data: [], error: null },
    };
    return builder;
  } };
  const filters = { dateFrom: '2026-01-01', dateTo: '2026-09-30', courseId: 'formation-ia' };
  const result = await fetchFinanceAdministration(client, filters);
  assert.deepEqual(filtersSeen, [['occurred_on', filters.dateFrom], ['occurred_on', filters.dateTo], ['course_id', filters.courseId]]);
  assert.equal(result.rows[0].stripe_mode, 'live');
  metadataError = { message: 'Mode indisponible' };
  await assert.rejects(() => fetchFinanceAdministration(client, filters), /Mode indisponible/);
});

function paginatedClient(rows, cap = 500, failureOffset = -1) {
  const offsets = [];
  return {
    offsets,
    from(table) {
      assert.equal(table, 'admin_stripe_financial_summary');
      const builder = {
        select(fields, options) { assert.equal(fields, '*'); assert.deepEqual(options, { count: 'exact' }); return builder; },
        gte() { return builder; }, lte() { return builder; }, eq() { return builder; },
        order(field, options) { assert.equal(field, 'transaction_id'); assert.deepEqual(options, { ascending: true }); return builder; },
        range: async (from, to) => {
          offsets.push([from, to]);
          return from === failureOffset ? { error: { message: 'Page indisponible' } }
            : { data: rows.slice(from, Math.min(to + 1, from + cap)), count: rows.length, error: null };
        },
      };
      return builder;
    },
  };
}

test('toutes les pages financières sont conservées avec un ordre stable', async () => {
  const rows = Array.from({ length: 1103 }, (_, id) => ({ transaction_id: String(id).padStart(4, '0') }));
  const client = paginatedClient(rows);
  assert.deepEqual(await fetchStripeFinancialRows(client, { dateFrom: '2026-01-01', dateTo: '2026-12-31' }), rows);
  assert.deepEqual(client.offsets, [[0, 499], [500, 999], [1000, 1499]]);
});

test('un plafond serveur inférieur à la page demandée ne tronque pas la synthèse', async () => {
  const rows = Array.from({ length: 5 }, (_, transaction_id) => ({ transaction_id }));
  const client = paginatedClient(rows, 2);
  assert.deepEqual(await fetchStripeFinancialRows(client, { dateFrom: '2026-01-01', dateTo: '2026-12-31' }), rows);
  assert.deepEqual(client.offsets, [[0, 499], [2, 501], [4, 503]]);
});

test('une erreur ultérieure ou un comptage absent interdit des totaux partiels', async () => {
  const filters = { dateFrom: '2026-01-01', dateTo: '2026-12-31' };
  await assert.rejects(() => fetchStripeFinancialRows(paginatedClient([{}, {}, {}], 2, 2), filters), /Page indisponible/);
  const client = paginatedClient([]);
  const original = client.from;
  client.from = (table) => {
    const builder = original(table);
    builder.range = async () => ({ data: [], error: null });
    return builder;
  };
  await assert.rejects(() => fetchStripeFinancialRows(client, filters), /nombre de transactions/);
});

test('les devises absentes restent inconnues et les devises connues sont normalisées', () => {
  const summaries = summarizeStripeFinance([
    { currency: null, estimated_net_stripe_cents: 500 },
    { currency: ' ', estimated_net_stripe_cents: 100 },
    { currency: ' EUR ', estimated_net_stripe_cents: 200 },
    { currency: 'eur', estimated_net_stripe_cents: 300 },
    { currency: 'usd', estimated_net_stripe_cents: 700 },
  ].map((row) => ({ ...row, stripe_mode: 'live' })));
  assert.equal(summaries.unknown.estimatedNetStripeCents, 600);
  assert.equal(summaries.eur.estimatedNetStripeCents, 500);
  assert.equal(summaries.usd.estimatedNetStripeCents, 700);
});
