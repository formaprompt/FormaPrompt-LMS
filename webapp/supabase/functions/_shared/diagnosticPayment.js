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
    version: 'CGV-B2C-2026-08-26',
    path: '/cgv-particuliers',
  }),
  [DIAGNOSTIC_SALES_CONTEXTS.PROFESSIONAL]: Object.freeze({
    documentType: 'cgv_b2b',
    version: 'CGV-B2B-2026-08-26',
    path: '/cgv-professionnels',
  }),
});

export const DIAGNOSTIC_LEGAL_STATEMENTS = Object.freeze({
  cgvAcceptance: Object.freeze({
    documentType: 'diagnostic_cgv_acceptance_statement',
    version: 'DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26',
  }),
  earlyServiceStart: Object.freeze({
    documentType: 'diagnostic_early_service_start_statement',
    version: 'DIAGNOSTIC-EARLY-START-2026-08-26',
  }),
  fullPerformanceWithdrawalAcknowledgement: Object.freeze({
    documentType: 'diagnostic_full_performance_withdrawal_acknowledgement',
    version: 'DIAGNOSTIC-FULL-PERFORMANCE-ACK-2026-08-26',
  }),
  withdrawalForm: Object.freeze({
    documentType: 'withdrawal_form',
    version: 'WITHDRAWAL-FORM-2026-08-26',
  }),
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PARIS_TIME_ZONE = 'Europe/Paris';

function parisDateParts(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type) => Number(parts.find((item) => item.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

function easterSundayUtc(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = ((19 * a) + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + (2 * e) + (2 * i) - h - k) % 7;
  const m = Math.floor((a + (11 * h) + (22 * l)) / 451);
  const month = Math.floor((h + l - (7 * m) + 114) / 31);
  const day = ((h + l - (7 * m) + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function isMetropolitanFrenchNonWorkingDay(abstractDate) {
  const weekday = abstractDate.getUTCDay();
  if (weekday === 0 || weekday === 6) return true;
  const monthDay = `${abstractDate.getUTCMonth() + 1}-${abstractDate.getUTCDate()}`;
  if (new Set(['1-1', '5-1', '5-8', '7-14', '8-15', '11-1', '11-11', '12-25']).has(monthDay)) return true;
  const easter = easterSundayUtc(abstractDate.getUTCFullYear()).getTime();
  const day = 24 * 60 * 60 * 1000;
  return [easter + day, easter + (39 * day), easter + (50 * day)].includes(abstractDate.getTime());
}

function parisLocalMidnightToUtc(year, month, day) {
  const localAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  let candidate = localAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: PARIS_TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(candidate));
    const part = (type) => Number(parts.find((item) => item.type === type)?.value);
    const representedAsUtc = Date.UTC(
      part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'),
    );
    candidate -= representedAsUtc - localAsUtc;
  }
  return candidate;
}

export function calculateFrenchWithdrawalDeadline(paidAt) {
  const paid = new Date(paidAt);
  if (Number.isNaN(paid.getTime())) throw new Error('Date de commande invalide.');
  const localPaidDate = parisDateParts(paid);
  const deadlineDate = new Date(Date.UTC(localPaidDate.year, localPaidDate.month - 1, localPaidDate.day + 14));
  while (isMetropolitanFrenchNonWorkingDay(deadlineDate)) {
    deadlineDate.setUTCDate(deadlineDate.getUTCDate() + 1);
  }
  const nextDayMidnightUtc = parisLocalMidnightToUtc(
    deadlineDate.getUTCFullYear(),
    deadlineDate.getUTCMonth() + 1,
    deadlineDate.getUTCDate() + 1,
  );
  return new Date(nextDayMidnightUtc - 1).toISOString();
}

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

export function getDiagnosticStripeMode(secretKey) {
  if (secretKey?.startsWith('sk_test_') || secretKey?.startsWith('rk_test_')) return 'test';
  if (secretKey?.startsWith('sk_live_') || secretKey?.startsWith('rk_live_')) return 'live';
  throw new Error('STRIPE_SECRET_KEY n’est pas une clé Stripe valide.');
}

export function requiresDiagnosticEarlyExecutionConsent({ paidAt, appointmentStartsAt }) {
  const appointment = new Date(appointmentStartsAt);
  if (Number.isNaN(appointment.getTime())) {
    throw new Error('Dates de commande ou de rendez-vous invalides.');
  }
  const withdrawalDeadline = new Date(calculateFrenchWithdrawalDeadline(paidAt));
  return {
    required: appointment < withdrawalDeadline,
    withdrawalDeadline: withdrawalDeadline.toISOString(),
  };
}

export function validateDiagnosticEarlyExecutionConsents(body) {
  if (body?.early_service_start_requested !== true) {
    return 'La demande expresse de commencement anticipé est requise pour ce créneau.';
  }
  if (body?.full_performance_withdrawal_acknowledged !== true) {
    return 'La reconnaissance des conséquences de l’exécution complète est requise pour ce créneau.';
  }
  if (
    body?.early_service_start_statement_version !== DIAGNOSTIC_LEGAL_STATEMENTS.earlyServiceStart.version
    || body?.full_performance_acknowledgement_version
      !== DIAGNOSTIC_LEGAL_STATEMENTS.fullPerformanceWithdrawalAcknowledgement.version
  ) {
    return 'La version des consentements d’exécution anticipée est invalide.';
  }
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

export function validateCompletedDiagnosticSession(
  session,
  expectedPriceId,
  expectedAmountCents = DIAGNOSTIC_IA_PAYMENT.amountTotal,
) {
  const identityError = validateDiagnosticEventIdentity(session, expectedPriceId);
  if (identityError) return identityError;
  const expectedPaymentStatus = expectedAmountCents === 0 ? 'no_payment_required' : 'paid';
  if (
    !Number.isInteger(expectedAmountCents)
    || expectedAmountCents < 0
    || expectedAmountCents > DIAGNOSTIC_IA_PAYMENT.amountTotal
    || session.mode !== 'payment'
    || session.status !== 'complete'
    || session.payment_status !== expectedPaymentStatus
  ) {
    return 'Le paiement du Diagnostic IA n’est pas confirmé.';
  }
  if (
    session.amount_total !== expectedAmountCents
    || session.currency !== DIAGNOSTIC_IA_PAYMENT.currency
  ) {
    return 'Le montant ou la devise du Diagnostic IA est invalide.';
  }
  return null;
}
