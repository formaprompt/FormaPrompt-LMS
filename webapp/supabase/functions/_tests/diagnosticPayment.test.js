import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIAGNOSTIC_IA_PAYMENT,
  getDiagnosticCgv,
  validateCompletedDiagnosticSession,
  validateDiagnosticCheckoutRequest,
  validateDiagnosticEventIdentity,
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
