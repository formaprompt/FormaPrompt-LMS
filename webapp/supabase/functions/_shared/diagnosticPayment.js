export const DIAGNOSTIC_IA_PAYMENT = Object.freeze({
  purchaseType: 'diagnostic_ia_express',
  amountTotal: 14_900,
  currency: 'eur',
  priceEnvName: 'STRIPE_DIAGNOSTIC_IA_PRICE_ID',
  productName: 'Diagnostic IA Express',
  source: 'diagnostic_ia_page',
});

export const DIAGNOSTIC_SALES_CONTEXTS = Object.freeze({
  PERSONAL: 'personal',
  PROFESSIONAL: 'professional',
});

export const DIAGNOSTIC_CGV = Object.freeze({
  [DIAGNOSTIC_SALES_CONTEXTS.PERSONAL]: Object.freeze({
    documentType: 'cgv_b2c',
    version: 'CGV-B2C-2026-08-12',
    path: '/cgv-particuliers',
  }),
  [DIAGNOSTIC_SALES_CONTEXTS.PROFESSIONAL]: Object.freeze({
    documentType: 'cgv_b2b',
    version: 'CGV-B2B-2026-08-12',
    path: '/cgv-professionnels',
  }),
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getDiagnosticCgv(salesContext) {
  return DIAGNOSTIC_CGV[salesContext] || null;
}

export function validateDiagnosticCheckoutRequest(body) {
  const cgv = getDiagnosticCgv(body?.sales_context);
  if (!cgv) return 'Le contexte client est absent ou invalide.';
  if (body?.cgv_accepted !== true) return 'Vous devez accepter les CGV applicables avant le paiement.';
  if (body?.cgv_version !== cgv.version) return 'La version des CGV applicable est invalide.';
  return null;
}

export function validateDiagnosticStripePrice(price, stripeMode = 'test') {
  if (
    !price
    || price.livemode !== (stripeMode === 'live')
    || !price.active
    || price.currency !== DIAGNOSTIC_IA_PAYMENT.currency
    || price.unit_amount !== DIAGNOSTIC_IA_PAYMENT.amountTotal
    || price.recurring !== null
  ) {
    return 'Le tarif Stripe du Diagnostic IA doit être actif, ponctuel et égal à 149 EUR.';
  }
  return null;
}

export function isDiagnosticPaymentObject(object) {
  return object?.metadata?.purchase_type === DIAGNOSTIC_IA_PAYMENT.purchaseType;
}

export function validateDiagnosticEventIdentity(object, expectedPriceId) {
  if (!isDiagnosticPaymentObject(object)) return 'Le type de paiement Diagnostic IA est invalide.';
  if (!UUID_PATTERN.test(object?.metadata?.diagnostic_order_id || '')) return 'La commande Diagnostic IA est invalide.';
  if (!UUID_PATTERN.test(object?.metadata?.user_id || '')) return 'L’utilisateur Diagnostic IA est invalide.';
  if (object.metadata.price_id !== expectedPriceId) return 'Le tarif Diagnostic IA est invalide.';
  if (object.client_reference_id && object.client_reference_id !== object.metadata.user_id) {
    return 'Le compte Diagnostic IA ne correspond pas à la session Stripe.';
  }
  return null;
}

export function validateCompletedDiagnosticSession(session, expectedPriceId) {
  const identityError = validateDiagnosticEventIdentity(session, expectedPriceId);
  if (identityError) return identityError;
  if (session.mode !== 'payment' || session.status !== 'complete' || session.payment_status !== 'paid') {
    return 'Le paiement du Diagnostic IA n’est pas confirmé.';
  }
  if (
    session.amount_total !== DIAGNOSTIC_IA_PAYMENT.amountTotal
    || session.currency !== DIAGNOSTIC_IA_PAYMENT.currency
  ) {
    return 'Le montant ou la devise du Diagnostic IA est invalide.';
  }
  return null;
}
