import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStripePostPaymentPayload,
  isStripePostPaymentEvent,
  stripeReconciliationWindow,
} from '../_shared/stripePostPayment.js';

const baseEvent = {
  id: 'evt_test_1',
  type: 'checkout.session.completed',
  livemode: false,
  api_version: '2026-07-29.dahlia',
  created: 1_787_300_000,
  data: {
    object: {
      id: 'cs_test_1',
      object: 'checkout.session',
      amount_total: 18_700,
      currency: 'eur',
      payment_status: 'paid',
      payment_intent: 'pi_test_1',
      metadata: {
        checkout_intent_id: '74000000-0000-4000-8000-000000000001',
        user_id: '74000000-0000-4000-8000-000000000002',
        course_id: 'formation-ia-act',
        access_activation_policy: 'immediate_after_payment',
      },
    },
  },
};

test('normalise un paiement Checkout sans perdre les identifiants de preuve', () => {
  const payload = buildStripePostPaymentPayload(baseEvent, 'a'.repeat(64), { validation_status: 'validated' });
  assert.equal(payload.event_id, 'evt_test_1');
  assert.equal(payload.stripe_checkout_session_id, 'cs_test_1');
  assert.equal(payload.stripe_payment_intent_id, 'pi_test_1');
  assert.equal(payload.amount_total, 18_700);
  assert.equal(payload.validation_status, 'validated');
});

test('conserve la référence Diagnostic IA sans donnée sensible', () => {
  const diagnosticEvent = structuredClone(baseEvent);
  diagnosticEvent.data.object.customer = 'cus_test_diagnostic';
  diagnosticEvent.data.object.metadata = {
    purchase_type: 'diagnostic_ia_express',
    diagnostic_order_id: '86000000-0000-4000-8000-000000000001',
    user_id: '86000000-0000-4000-8000-000000000002',
    price_id: 'price_test_diagnostic',
  };
  const payload = buildStripePostPaymentPayload(diagnosticEvent, 'd'.repeat(64));
  assert.equal(payload.payment_type, 'diagnostic_ia_express');
  assert.equal(payload.diagnostic_order_id, '86000000-0000-4000-8000-000000000001');
  assert.equal(payload.stripe_customer_id, 'cus_test_diagnostic');
  assert.equal('customer_email' in payload, false);
});

test('normalise remboursement et litige avec leur transaction parente', () => {
  const refund = buildStripePostPaymentPayload({
    ...baseEvent,
    id: 'evt_refund_1',
    type: 'refund.updated',
    data: { object: { id: 're_test_1', amount: 9_350, currency: 'eur', status: 'succeeded', payment_intent: 'pi_test_1', charge: 'ch_test_1' } },
  }, 'b'.repeat(64));
  assert.equal(refund.amount, 9_350);
  assert.equal(refund.stripe_payment_intent_id, 'pi_test_1');

  const dispute = buildStripePostPaymentPayload({
    ...baseEvent,
    id: 'evt_dispute_1',
    type: 'charge.dispute.closed',
    data: { object: { id: 'dp_test_1', amount: 18_700, currency: 'eur', status: 'won', payment_intent: 'pi_test_1', evidence_details: { due_by: 1_787_400_000 } } },
  }, 'c'.repeat(64));
  assert.equal(dispute.status, 'won');
  assert.match(dispute.evidence_due_at, /^2026-/);
});

test('limite le rapprochement distant a trente et un jours', () => {
  const now = new Date('2026-08-22T12:00:00.000Z');
  assert.equal(stripeReconciliationWindow('2020-01-01', now).toISOString(), '2026-07-22T12:00:00.000Z');
  assert.equal(stripeReconciliationWindow(null, now).toISOString(), '2026-07-23T12:00:00.000Z');
});

test('ignore les événements Stripe sans rapport avec le Sprint 5', () => {
  assert.equal(isStripePostPaymentEvent('customer.created'), false);
  assert.equal(isStripePostPaymentEvent('refund.failed'), true);
});
