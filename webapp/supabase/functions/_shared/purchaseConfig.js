export const AI_ACT_PURCHASE = Object.freeze({
  courseId: 'formation-ia-act',
  amountTotal: 18_700,
  currency: 'eur',
  priceEnvName: 'STRIPE_AI_ACT_PRICE_ID',
  landingPath: '/formation-ia-act-conformite#inscription',
  label: 'formation AI Act',
});

export const PROMPT_LEVEL_ONE_PURCHASE = Object.freeze({
  courseId: 'formation-prompt-level-1',
  amountTotal: 34_300,
  currency: 'eur',
  priceEnvName: 'STRIPE_PROMPT_LEVEL1_PRICE_ID',
  landingPath: '/formation-prompt-engineering#inscription',
  label: 'formation Prompt Engineering – Niveau 1',
});

export const COURSE_PURCHASES = Object.freeze({
  [AI_ACT_PURCHASE.courseId]: AI_ACT_PURCHASE,
  [PROMPT_LEVEL_ONE_PURCHASE.courseId]: PROMPT_LEVEL_ONE_PURCHASE,
});

export function getPurchaseConfig(courseId) {
  return COURSE_PURCHASES[courseId] || null;
}

export const IN_PERSON_TRAVEL_FEE = Object.freeze({
  amountTotal: 3_000,
  currency: 'eur',
  paymentType: 'in_person_travel_fee',
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function validateCompletedCourseSession(session, purchase, expectedPriceId) {
  if (session?.mode !== 'payment' || session?.status !== 'complete') {
    return 'La session Stripe n’est pas un paiement terminé.';
  }

  if (session.payment_status !== 'paid') {
    return 'Le paiement Stripe n’est pas confirmé.';
  }

  if (session.amount_total !== purchase.amountTotal || session.currency !== purchase.currency) {
    return `Le montant ou la devise ne correspond pas à la ${purchase.label}.`;
  }

  const userId = session.metadata?.user_id;
  if (!isUuid(userId) || userId !== session.client_reference_id) {
    return 'L’identifiant utilisateur Stripe est absent ou incohérent.';
  }

  if (
    session.metadata?.course_id !== purchase.courseId
    || session.metadata?.price_id !== expectedPriceId
  ) {
    return 'La formation ou le tarif Stripe ne correspond pas à la configuration attendue.';
  }

  return null;
}

export function validateCompletedAiActSession(session, expectedPriceId) {
  return validateCompletedCourseSession(session, AI_ACT_PURCHASE, expectedPriceId);
}

export function validateCompletedTravelFeeSession(session) {
  if (session?.mode !== 'payment' || session?.status !== 'complete') {
    return 'La session Stripe n’est pas un paiement terminé.';
  }

  if (session.payment_status !== 'paid') {
    return 'La participation au déplacement n’est pas confirmée.';
  }

  if (
    session.amount_total !== IN_PERSON_TRAVEL_FEE.amountTotal
    || session.currency !== IN_PERSON_TRAVEL_FEE.currency
  ) {
    return 'Le montant ou la devise ne correspond pas à la participation au déplacement.';
  }

  if (
    session.metadata?.payment_type !== IN_PERSON_TRAVEL_FEE.paymentType
    || !isUuid(session.metadata?.booking_request_id)
    || !isUuid(session.metadata?.user_id)
    || session.metadata.user_id !== session.client_reference_id
  ) {
    return 'Les informations de réservation Stripe sont absentes ou incohérentes.';
  }

  return null;
}
