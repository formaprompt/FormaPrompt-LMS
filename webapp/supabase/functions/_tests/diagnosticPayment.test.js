import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIAGNOSTIC_IA_PAYMENT,
  DIAGNOSTIC_LEGAL_STATEMENTS,
  calculateFrenchWithdrawalDeadline,
  getDiagnosticStripeMode,
  getDiagnosticCgv,
  validateCompletedDiagnosticSession,
  validateDiagnosticCheckoutRequest,
  validateDiagnosticEventIdentity,
  requiresDiagnosticEarlyExecutionConsent,
  validateDiagnosticEarlyExecutionConsents,
  validateDiagnosticStripePrice,
} from '../_shared/diagnosticPayment.js';

const orderId = '86000000-0000-4000-8000-000000000001';
const userId = '86000000-0000-4000-8000-000000000002';
const priceId = 'price_test_diagnostic';

function validSession() {
  return {
    id: 'cs_test_diagnostic',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 14_900,
    currency: 'eur',
    client_reference_id: userId,
    metadata: {
      purchase_type: DIAGNOSTIC_IA_PAYMENT.purchaseType,
      diagnostic_order_id: orderId,
      user_id: userId,
      price_id: priceId,
    },
  };
}

test('impose le prix serveur ponctuel de 149 EUR en mode test', () => {
  assert.equal(validateDiagnosticStripePrice({
    livemode: false,
    active: true,
    currency: 'eur',
    unit_amount: 14_900,
    recurring: null,
  }), null);
  assert.match(validateDiagnosticStripePrice({
    livemode: false,
    active: true,
    currency: 'eur',
    unit_amount: 1,
    recurring: null,
  }), /149 EUR/);
});

test('autorise uniquement les couples cohérents clé et Price Stripe TEST ou LIVE', () => {
  const testPrice = { livemode: false, active: true, currency: 'eur', unit_amount: 14_900, recurring: null };
  const livePrice = { ...testPrice, livemode: true };

  assert.equal(validateDiagnosticStripePrice(testPrice, getDiagnosticStripeMode('sk_test_example')), null);
  assert.equal(validateDiagnosticStripePrice(livePrice, getDiagnosticStripeMode('rk_live_example')), null);
  assert.match(validateDiagnosticStripePrice(livePrice, getDiagnosticStripeMode('sk_test_example')), /149 EUR/);
  assert.match(validateDiagnosticStripePrice(testPrice, getDiagnosticStripeMode('sk_live_example')), /149 EUR/);
  assert.throws(() => getDiagnosticStripeMode('invalid_key'), /clé Stripe valide/);
});

test('refuse un montant ou un Price ID manipulé dans une session', () => {
  const wrongAmount = validSession();
  wrongAmount.amount_total = 1;
  assert.match(validateCompletedDiagnosticSession(wrongAmount, priceId), /montant ou la devise/);

  const wrongPrice = validSession();
  wrongPrice.metadata.price_id = 'price_falsified';
  assert.match(validateCompletedDiagnosticSession(wrongPrice, priceId), /tarif Diagnostic/);
});

test('valide une session payée sans créer de notion de formation', () => {
  assert.equal(validateCompletedDiagnosticSession(validSession(), priceId), null);
  assert.equal(validateDiagnosticEventIdentity(validSession(), priceId), null);
  assert.equal('course_id' in validSession().metadata, false);
});

test('impose le contexte et la version CGV applicables', () => {
  const personalCgv = getDiagnosticCgv('personal');
  assert.equal(validateDiagnosticCheckoutRequest({
    sales_context: 'personal',
    cgv_accepted: true,
    cgv_version: personalCgv.version,
    amount: 1,
  }), null);
  assert.match(validateDiagnosticCheckoutRequest({
    sales_context: 'professional',
    cgv_accepted: true,
    cgv_version: personalCgv.version,
  }), /version des CGV/);
  assert.match(validateDiagnosticCheckoutRequest({
    sales_context: 'personal',
    cgv_accepted: false,
    cgv_version: personalCgv.version,
  }), /accepter les CGV/);
});

test('ne demande les consentements anticipés que pour un rendez-vous dans les quatorze jours', () => {
  const paidAt = '2026-08-26T10:00:00.000Z';
  assert.equal(requiresDiagnosticEarlyExecutionConsent({
    paidAt,
    appointmentStartsAt: '2026-09-05T10:00:00.000Z',
  }).required, true);
  assert.equal(requiresDiagnosticEarlyExecutionConsent({
    paidAt,
    appointmentStartsAt: '2026-09-15T10:00:00.000Z',
  }).required, false);
});

test('prolonge le délai au premier jour ouvrable lorsque le quatorzième jour tombe un week-end', () => {
  const deadline = calculateFrenchWithdrawalDeadline('2026-08-15T10:00:00.000Z');
  assert.equal(deadline, '2026-08-31T21:59:59.999Z');
  assert.equal(requiresDiagnosticEarlyExecutionConsent({
    paidAt: '2026-08-15T10:00:00.000Z',
    appointmentStartsAt: '2026-08-31T14:00:00.000Z',
  }).required, true);
});

test('exige deux consentements distincts et versionnés pour une exécution anticipée', () => {
  assert.match(validateDiagnosticEarlyExecutionConsents({
    early_service_start_requested: true,
  }), /reconnaissance/);
  assert.equal(validateDiagnosticEarlyExecutionConsents({
    early_service_start_requested: true,
    full_performance_withdrawal_acknowledged: true,
    early_service_start_statement_version: DIAGNOSTIC_LEGAL_STATEMENTS.earlyServiceStart.version,
    full_performance_acknowledgement_version:
      DIAGNOSTIC_LEGAL_STATEMENTS.fullPerformanceWithdrawalAcknowledgement.version,
  }), null);
});
