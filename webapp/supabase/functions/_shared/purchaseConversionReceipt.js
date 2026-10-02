const SESSION_PATTERN = /^cs_(?:live|test)_[A-Za-z0-9_]{1,190}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAID_EVENTS = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);
const RESPONSE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export function buildPurchaseConversionReceipt({ transaction, event, purchase, order, userId, sessionId }) {
  if (!transaction || !event || !UUID_PATTERN.test(transaction.id || '')
    || transaction.user_id !== userId || transaction.stripe_checkout_session_id !== sessionId
    || !sessionId?.startsWith('cs_live_') || !SESSION_PATTERN.test(sessionId)
    || transaction.status !== 'paid' || transaction.amount_refunded !== 0
    || !Number.isSafeInteger(transaction.amount_total) || transaction.amount_total <= 0
    || !/^[a-z]{3}$/.test(transaction.currency || '')
    || event.event_id !== transaction.last_event_id || event.stripe_object_id !== sessionId
    || event.livemode !== true || !PAID_EVENTS.has(event.event_type)
    || event.processing_result !== 'processed' || !/^[0-9a-f]{64}$/.test(event.payload_sha256 || '')) return null;

  const business = transaction.payment_type === 'course' ? purchase
    : transaction.payment_type === 'diagnostic_ia_express' ? order : null;
  if (!business || business.user_id !== userId || business.stripe_checkout_session_id !== sessionId
    || business.amount_total !== transaction.amount_total || business.currency !== transaction.currency) return null;

  if (transaction.payment_type === 'course') {
    if (business.id !== transaction.purchase_id || transaction.diagnostic_order_id != null
      || transaction.booking_request_id != null || business.payment_status !== 'paid'
      || !transaction.course_id || business.course_id !== transaction.course_id) return null;
  } else if (business.id !== transaction.diagnostic_order_id || transaction.purchase_id != null
    || transaction.booking_request_id != null || business.status !== 'paid'
    || !business.paid_at || business.final_amount_cents !== transaction.amount_total) return null;

  return {
    verified: true,
    transaction_id: transaction.id,
    amount_total_cents: transaction.amount_total,
    currency: transaction.currency.toUpperCase(),
    livemode: true,
  };
}

export async function fetchPurchaseConversionReceipt(client, userId, sessionId) {
  const { data: transaction, error: transactionError } = await client.from('stripe_payment_transactions')
    .select('id,user_id,purchase_id,diagnostic_order_id,booking_request_id,course_id,payment_type,status,amount_total,amount_refunded,currency,stripe_checkout_session_id,last_event_id')
    .eq('user_id', userId).eq('stripe_checkout_session_id', sessionId).maybeSingle();
  if (transactionError) throw new Error('receipt_read_failed');
  if (!transaction || transaction.user_id !== userId || transaction.stripe_checkout_session_id !== sessionId) return null;

  const { data: event, error: eventError } = await client.from('stripe_webhook_events')
    .select('event_id,event_type,stripe_object_id,livemode,payload_sha256,processing_result')
    .eq('event_id', transaction.last_event_id).maybeSingle();
  if (eventError) throw new Error('receipt_read_failed');
  if (!event) return null;

  let purchase = null;
  let order = null;
  if (transaction.payment_type === 'course' && transaction.purchase_id) {
    const result = await client.from('purchases')
      .select('id,user_id,course_id,payment_status,amount_total,currency,stripe_checkout_session_id')
      .eq('user_id', userId).eq('id', transaction.purchase_id).eq('stripe_checkout_session_id', sessionId).maybeSingle();
    if (result.error) throw new Error('receipt_read_failed');
    purchase = result.data;
  } else if (transaction.payment_type === 'diagnostic_ia_express' && transaction.diagnostic_order_id) {
    const result = await client.from('diagnostic_ia_orders')
      .select('id,user_id,status,amount_total,final_amount_cents,currency,paid_at,stripe_checkout_session_id')
      .eq('user_id', userId).eq('id', transaction.diagnostic_order_id).eq('stripe_checkout_session_id', sessionId).maybeSingle();
    if (result.error) throw new Error('receipt_read_failed');
    order = result.data;
  }
  return buildPurchaseConversionReceipt({ transaction, event, purchase, order, userId, sessionId });
}

export function createPurchaseConversionReceiptHandler({ createAuthClient, createReadClient }) {
  const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: RESPONSE_HEADERS });
  return async (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: RESPONSE_HEADERS });
    if (request.method !== 'POST') return respond({ error: 'Méthode non autorisée.' }, 405);
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return respond({ error: 'Connexion requise.' }, 401);
    try {
      const { data, error } = await createAuthClient().auth.getUser(token);
      if (error || !UUID_PATTERN.test(data?.user?.id || '')) return respond({ error: 'Session invalide.' }, 401);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).length !== 1 || !SESSION_PATTERN.test(body.session_id || '')) {
        return respond({ error: 'Référence invalide.' }, 400);
      }
      const receipt = await fetchPurchaseConversionReceipt(createReadClient(), data.user.id, body.session_id);
      return respond({ receipt });
    } catch {
      return respond({ error: 'Vérification temporairement indisponible.' }, 503);
    }
  };
}
