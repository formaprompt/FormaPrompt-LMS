const COURSE_IDS = new Set(['formation-ia', 'formation-prompt-level-1', 'formation-ia-act']);

export function summarizeStripeFinance(rows = []) {
  return rows.reduce((summary, row) => {
    const currency = row.currency || 'eur';
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

export async function fetchFinanceAdministration(client, filters) {
  if (!filters.dateFrom || !filters.dateTo || filters.dateTo < filters.dateFrom) throw new Error('La période sélectionnée est invalide.');
  if (filters.courseId && !COURSE_IDS.has(filters.courseId)) throw new Error('La formation sélectionnée est invalide.');
  let query = client.from('admin_stripe_financial_summary').select('*')
    .gte('occurred_on', filters.dateFrom).lte('occurred_on', filters.dateTo);
  if (filters.courseId) query = query.eq('course_id', filters.courseId);
  const [financial, cases] = await Promise.all([
    query.order('occurred_on', { ascending: false }),
    client.from('stripe_reconciliation_cases').select('id,status,severity').in('status', ['pending', 'reviewed']),
  ]);
  if (financial.error) throw new Error(financial.error.message || 'La synthèse financière est indisponible.');
  if (cases.error) throw new Error(cases.error.message || 'Les cas de réconciliation sont indisponibles.');
  return { rows: financial.data || [], openCases: cases.data || [] };
}
