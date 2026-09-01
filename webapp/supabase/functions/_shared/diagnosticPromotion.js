import { DIAGNOSTIC_IA_PAYMENT } from './diagnosticPayment.js';

export const DIAGNOSTIC_PROMOTION = Object.freeze({
  targetType: 'diagnostic',
  targetKey: 'diagnostic-ia-express',
  orderContextType: 'diagnostic_ia_order',
  stripeCheckoutDurationSeconds: 31 * 60,
  minimumReservationBufferSeconds: 3 * 60,
  genericInvalidMessage: "Ce code n'est pas valide ou n'est plus disponible.",
});

const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,63}$/;

export function normalizeDiagnosticPromotionCode(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return PROMO_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function hasDiagnosticPromotionInput(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function buildDiagnosticStripeLineItem({
  catalogPriceId,
  catalogProductId,
  finalAmountCents,
  promotionApplied,
}) {
  if (
    !Number.isInteger(finalAmountCents)
    || finalAmountCents < 0
    || finalAmountCents > DIAGNOSTIC_IA_PAYMENT.amountTotal
  ) {
    throw new Error('Montant Diagnostic IA réservé invalide.');
  }
  if (!promotionApplied) {
    if (finalAmountCents !== DIAGNOSTIC_IA_PAYMENT.amountTotal) {
      throw new Error('Le prix catalogue Diagnostic IA est incohérent.');
    }
    return { price: catalogPriceId, quantity: 1 };
  }
  if (typeof catalogProductId !== 'string' || !catalogProductId.startsWith('prod_')) {
    throw new Error('Produit Stripe Diagnostic IA invalide.');
  }
  return {
    price_data: {
      currency: DIAGNOSTIC_IA_PAYMENT.currency,
      product: catalogProductId,
      unit_amount: finalAmountCents,
    },
    quantity: 1,
  };
}

export function isAmbiguousStripeCreationError(error) {
  return new Set([
    'StripeConnectionError',
    'StripeAPIError',
  ]).has(error?.type);
}

export function diagnosticPromotionCheckoutExpiresAt({
  promotionApplied,
  reservationExpiresAt,
  nowMs = Date.now(),
}) {
  if (!promotionApplied) return null;
  const stripeExpiresAt = Math.floor(nowMs / 1000) + DIAGNOSTIC_PROMOTION.stripeCheckoutDurationSeconds;
  const reservationExpirySeconds = Math.floor(new Date(reservationExpiresAt).getTime() / 1000);
  if (
    !Number.isInteger(reservationExpirySeconds)
    || reservationExpirySeconds - stripeExpiresAt < DIAGNOSTIC_PROMOTION.minimumReservationBufferSeconds
  ) {
    throw new Error('La réservation promotionnelle expire trop tôt pour Checkout.');
  }
  return stripeExpiresAt;
}
