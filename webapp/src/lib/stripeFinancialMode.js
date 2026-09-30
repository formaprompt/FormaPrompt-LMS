export const STRIPE_FINANCIAL_MODE_LABELS = Object.freeze({
  live: 'Paiements réels', test: 'Paiements de test', unknown: 'Mode indéterminé',
});

// PaymentIntent/Charge identifiers do not encode the environment. Only Checkout
// prefixes and the server-recorded webhook livemode provide usable evidence.
export function classifyStripeFinancialMode(transaction = {}) {
  const session = transaction.stripe_checkout_session_id || '';
  const prefixMode = session.startsWith('cs_live_') ? 'live'
    : session.startsWith('cs_test_') ? 'test' : null;
  const eventMode = transaction.last_event?.livemode === true ? 'live'
    : transaction.last_event?.livemode === false ? 'test' : null;
  if (prefixMode && eventMode && prefixMode !== eventMode) return 'unknown';
  return eventMode || prefixMode || 'unknown';
}

export async function enrichStripeFinancialRows(client, rows = []) {
  const ids = [...new Set(rows.map((row) => row.transaction_id).filter(Boolean))];
  const transactions = new Map();
  // Avoid oversized PostgREST URLs while retaining every row in the period.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const result = await client.from('stripe_payment_transactions')
      .select('id,stripe_checkout_session_id,last_event:stripe_webhook_events!last_event_id(livemode)')
      .in('id', ids.slice(offset, offset + 100));
    if (result.error) throw new Error(result.error.message || 'Le mode des paiements Stripe est indisponible.');
    for (const transaction of result.data || []) transactions.set(transaction.id, transaction);
  }
  return rows.map((row) => ({
    ...row,
    stripe_mode: classifyStripeFinancialMode(transactions.get(row.transaction_id)),
  }));
}
