export const STRIPE_POST_PAYMENT_EVENTS = Object.freeze([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'payment_intent.payment_failed',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'refund.created',
  'refund.updated',
  'refund.failed',
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
  'charge.dispute.funds_withdrawn',
  'charge.dispute.funds_reinstated',
]);

const SUPPORTED_EVENTS = new Set(STRIPE_POST_PAYMENT_EVENTS);

export function isStripePostPaymentEvent(eventType) {
  return SUPPORTED_EVENTS.has(eventType);
}

function stripeId(value) {
  if (typeof value === 'string') return value;
  return typeof value?.id === 'string' ? value.id : null;
}

function unixSecondsToIso(value) {
  if (!Number.isInteger(value) || value < 0) return null;
  return new Date(value * 1000).toISOString();
}

function metadataValue(object, key) {
  const value = object?.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function paymentIntentId(object) {
  return stripeId(object?.payment_intent) || (object?.object === 'payment_intent' ? object.id : null);
}

export function buildStripePostPaymentPayload(event, payloadSha256, overrides = {}) {
  if (!event?.id || !isStripePostPaymentEvent(event.type) || !event.data?.object) {
    throw new Error('Événement Stripe après paiement invalide.');
  }

  const object = event.data.object;
  const base = {
    event_id: event.id,
    event_type: event.type,
    object_id: object.id,
    livemode: Boolean(event.livemode),
    api_version: event.api_version || null,
    payload_sha256: payloadSha256 || null,
    created_at: unixSecondsToIso(event.created),
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    checkout_intent_id: metadataValue(object, 'checkout_intent_id'),
    booking_request_id: metadataValue(object, 'booking_request_id'),
    user_id: metadataValue(object, 'user_id'),
    course_id: metadataValue(object, 'course_id'),
    payment_type: metadataValue(object, 'payment_type') || 'course',
    activation_policy: metadataValue(object, 'access_activation_policy'),
    status: object.status || null,
    amount_total: null,
    amount: null,
    currency: object.currency || null,
  };

  if (event.type.startsWith('checkout.session.')) {
    base.stripe_checkout_session_id = object.id;
    base.stripe_payment_intent_id = paymentIntentId(object);
    base.stripe_charge_id = stripeId(object.payment_intent?.latest_charge);
    base.amount_total = object.amount_total ?? null;
    base.status = event.type === 'checkout.session.expired' ? 'expired' : object.payment_status || object.status;
    base.customer_phone = object.customer_details?.phone || null;
  } else if (event.type === 'payment_intent.payment_failed') {
    base.stripe_payment_intent_id = object.id;
    base.stripe_charge_id = stripeId(object.latest_charge);
    base.amount_total = object.amount_received || object.amount || null;
    base.failure_reason = object.last_payment_error?.code || object.last_payment_error?.decline_code || null;
  } else if (event.type.startsWith('refund.')) {
    base.stripe_payment_intent_id = paymentIntentId(object);
    base.stripe_charge_id = stripeId(object.charge);
    base.amount = object.amount ?? null;
    base.reason = object.reason || null;
    base.failure_reason = object.failure_reason || null;
  } else if (event.type.startsWith('charge.dispute.')) {
    base.stripe_payment_intent_id = paymentIntentId(object);
    base.stripe_charge_id = stripeId(object.charge);
    base.amount = object.amount ?? null;
    base.reason = object.reason || null;
    base.evidence_due_at = unixSecondsToIso(object.evidence_details?.due_by);
  }

  return { ...base, ...overrides };
}

export function stripeReconciliationWindow(value, now = new Date()) {
  const defaultStart = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  if (!value) return defaultStart;
  const requested = new Date(value);
  if (Number.isNaN(requested.getTime()) || requested > now) return defaultStart;
  const oldest = new Date(now.getTime() - (31 * 24 * 60 * 60 * 1000));
  return requested < oldest ? oldest : requested;
}
