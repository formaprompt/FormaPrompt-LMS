export const COURSE_PROMOTION = Object.freeze({
  targetType: 'course',
  orderContextType: 'commercial_checkout_intent',
  stripeCheckoutDurationSeconds: 31 * 60,
  minimumReservationBufferSeconds: 3 * 60,
  genericInvalidMessage: "Ce code n'est pas valide ou n'est plus disponible.",
});

const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,63}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeCoursePromotionCode(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return PROMO_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function hasCoursePromotionInput(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeCheckoutRequestId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

export function buildCourseStripeLineItem({
  purchase,
  catalogPriceId,
  catalogProductId,
  finalAmountCents,
  promotionApplied,
}) {
  if (
    !purchase
    || !Number.isInteger(finalAmountCents)
    || finalAmountCents <= 0
    || finalAmountCents > purchase.amountTotal
  ) {
    throw new Error('Montant de formation réservé invalide.');
  }
  if (!promotionApplied) {
    if (finalAmountCents !== purchase.amountTotal) {
      throw new Error('Le prix catalogue de la formation est incohérent.');
    }
    return { price: catalogPriceId, quantity: 1 };
  }
  if (typeof catalogProductId !== 'string' || !catalogProductId.startsWith('prod_')) {
    throw new Error('Produit Stripe de formation invalide.');
  }
  return {
    price_data: {
      currency: purchase.currency,
      product: catalogProductId,
      unit_amount: finalAmountCents,
    },
    quantity: 1,
  };
}

export function coursePromotionCheckoutExpiresAt({ promotionApplied, reservationExpiresAt, nowMs = Date.now() }) {
  if (!promotionApplied) return null;
  const stripeExpiresAt = Math.floor(nowMs / 1000) + COURSE_PROMOTION.stripeCheckoutDurationSeconds;
  const reservationExpirySeconds = Math.floor(new Date(reservationExpiresAt).getTime() / 1000);
  if (
    !Number.isInteger(reservationExpirySeconds)
    || reservationExpirySeconds - stripeExpiresAt < COURSE_PROMOTION.minimumReservationBufferSeconds
  ) {
    throw new Error('La réservation promotionnelle expire trop tôt pour Checkout.');
  }
  return stripeExpiresAt;
}

export function isAmbiguousCourseStripeCreationError(error) {
  return new Set(['StripeConnectionError', 'StripeAPIError']).has(error?.type);
}

export function validateCompletedCoursePromotionSession(session, purchase, expectedPriceId, intent) {
  if (session?.mode !== 'payment' || session?.status !== 'complete') {
    return 'La session Stripe n’est pas un paiement terminé.';
  }
  if (session.payment_status !== 'paid') return 'Le paiement Stripe n’est pas confirmé.';
  if (
    !intent
    || !Number.isInteger(intent.original_amount_cents)
    || intent.original_amount_cents !== purchase.amountTotal
    || !Number.isInteger(intent.discount_amount_cents)
    || !Number.isInteger(intent.final_amount_cents)
    || intent.final_amount_cents <= 0
    || intent.original_amount_cents - intent.discount_amount_cents !== intent.final_amount_cents
    || intent.catalog_price_id !== expectedPriceId
  ) return 'La configuration tarifaire de la formation est invalide.';
  if (session.amount_total !== intent.final_amount_cents || session.currency !== purchase.currency) {
    return `Le montant ou la devise ne correspond pas à la ${purchase.label}.`;
  }
  if (
    session.metadata?.user_id !== session.client_reference_id
    || session.metadata?.user_id !== intent.user_id
    || session.metadata?.course_id !== purchase.courseId
    || session.metadata?.course_id !== intent.course_id
    || session.metadata?.checkout_intent_id !== intent.id
    || session.metadata?.price_id !== expectedPriceId
    || session.metadata?.stripe_product_id !== intent.stripe_product_id
    || Number(session.metadata?.expected_amount_cents) !== intent.final_amount_cents
    || (session.metadata?.promo_redemption_id || null) !== (intent.promo_redemption_id || null)
  ) return 'La formation ou la configuration Stripe ne correspond pas à l’intention d’achat.';
  return null;
}

export function validateCoursePromotionEventIdentity(object, purchase, expectedPriceId, intent) {
  if (!intent || object?.metadata?.checkout_intent_id !== intent.id) {
    return 'L’intention d’achat formation est absente ou invalide.';
  }
  if (
    intent.catalog_price_id !== expectedPriceId
    ||
    object.metadata?.user_id !== intent.user_id
    || object.metadata?.course_id !== purchase.courseId
    || object.metadata?.price_id !== expectedPriceId
    || object.metadata?.stripe_product_id !== intent.stripe_product_id
    || Number(object.metadata?.expected_amount_cents) !== intent.final_amount_cents
    || (object.metadata?.promo_redemption_id || null) !== (intent.promo_redemption_id || null)
  ) return 'L’événement Stripe ne correspond pas à la formation attendue.';
  if (object.currency && object.currency !== purchase.currency) return 'La devise Stripe est incohérente.';
  // Un PaymentIntent échoué expose normalement amount_received=0 et conserve
  // le montant attendu dans amount. Checkout utilise amount_total.
  const amount = object.amount_total ?? object.amount ?? object.amount_received;
  if (amount !== undefined && amount !== null && amount !== intent.final_amount_cents) {
    return 'Le montant Stripe est incohérent.';
  }
  return null;
}
