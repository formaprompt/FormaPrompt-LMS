// The URL is only a lookup key. Only an authenticated server receipt proves a purchase.
export function isLiveCheckoutSessionId(sessionId) {
  return typeof sessionId === 'string' && /^cs_live_[A-Za-z0-9_]{1,190}$/.test(sessionId);
}

export function validatePurchaseConversionReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
    || receipt.verified !== true || receipt.livemode !== true
    || typeof receipt.transaction_id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt.transaction_id)
    || !Number.isSafeInteger(receipt.amount_total_cents) || receipt.amount_total_cents <= 0
    || typeof receipt.currency !== 'string' || !/^[A-Z]{3}$/.test(receipt.currency)) return null;

  return {
    verified: true,
    transaction_id: receipt.transaction_id,
    amount_total_cents: receipt.amount_total_cents,
    currency: receipt.currency,
    livemode: true,
  };
}
