import { enrichStripeFinancialRows } from './stripeFinancialMode.js';

const COURSE_IDS = new Set(['formation-ia', 'formation-prompt-level-1', 'formation-ia-act']);

export function summarizeStripeFinance(rows = [], mode = 'live') {
  return rows.filter((row) => (row.stripe_mode || 'unknown') === mode).reduce((summary, row) => {
    const currency = typeof row.currency === 'string' && row.currency.trim()
      ? row.currency.trim().toLowerCase() : 'unknown';
    const current = summary[currency] || {
      currency, grossTrainingCents: 0, travelFeeCents: 0, successfulRefundCents: 0,
      openDisputeCents: 0, lostDisputeCents: 0, estimatedNetStripeCents: 0,
      estimatedNetTrainingCents: 0, transactionCount: 0,
    };
    current.grossTrainingCents += Number(row.gross_training_cents || 0);
    current.travelFeeCents += Number(row.travel_fee_cents || 0);
    current.successfulRefundCents += Number(row.successful_refund_cents || 0);
    current.openDisputeCents += Number(row.open_dispute_cents || 0);
    current.lostDisputeCents += Number(row.lost_dispute_cents || 0);
    current.estimatedNetStripeCents += Number(row.estimated_net_stripe_cents || 0);
    current.estimatedNetTrainingCents += Number(row.estimated_net_training_cents || 0);
    current.transactionCount += 1;
    summary[currency] = current;
    return summary;
  }, {});
}

function validateFinancialFilters(filters) {
  if (!filters?.dateFrom || !filters.dateTo || filters.dateTo < filters.dateFrom) throw new Error('La période sélectionnée est invalide.');
  if (filters.courseId && !COURSE_IDS.has(filters.courseId)) throw new Error('La formation sélectionnée est invalide.');
}

export async function fetchStripeFinancialRows(client, filters) {
  validateFinancialFilters(filters);
  const rows = [];
  let expectedCount;
  do {
    let query = client.from('admin_stripe_financial_summary').select('*', { count: 'exact' })
      .gte('occurred_on', filters.dateFrom).lte('occurred_on', filters.dateTo);
    if (filters.courseId) query = query.eq('course_id', filters.courseId);
    const result = await query.order('transaction_id', { ascending: true }).range(rows.length, rows.length + 499);
    if (result.error) throw new Error(result.error.message || 'La synthèse financière est indisponible.');
    if (!Number.isInteger(result.count) || result.count < 0) {
      throw new Error('Le nombre de transactions financières ne peut pas être vérifié.');
    }
    if (expectedCount !== undefined && result.count !== expectedCount) {
      throw new Error('Les transactions financières ont changé pendant le chargement. Réessayez.');
    }
    expectedCount = result.count;
    const page = result.data || [];
    if ((!page.length && rows.length < expectedCount) || rows.length + page.length > expectedCount) {
      throw new Error('Le chargement des transactions financières est incomplet. Réessayez.');
    }
    rows.push(...page);
    // Advance by the actual response length: a server cap may be below 500.
  } while (rows.length < expectedCount);
  return rows;
}

export async function fetchFinanceAdministration(client, filters) {
  validateFinancialFilters(filters);
  const [financial, cases] = await Promise.all([
    fetchStripeFinancialRows(client, filters),
    client.from('stripe_reconciliation_cases').select('id,status,severity').in('status', ['pending', 'reviewed']),
  ]);
  if (cases.error) throw new Error(cases.error.message || 'Les cas de réconciliation sont indisponibles.');
  return { rows: await enrichStripeFinancialRows(client, financial), openCases: cases.data || [] };
}
