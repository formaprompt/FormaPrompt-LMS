import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_ACT_PURCHASE,
  COURSE_PURCHASES,
  GENERATIVE_AI_PURCHASE,
  IN_PERSON_TRAVEL_FEE,
  PROMPT_LEVEL_ONE_PURCHASE,
  validateCompletedCourseSession,
  validateCompletedAiActSession,
  validateCompletedTravelFeeSession,
} from '../_shared/purchaseConfig.js';

const priceId = 'price_test_ai_act';
const userId = 'b86f9479-e782-4c03-8fe0-e55f4ab67a56';

function validSession() {
  return {
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: AI_ACT_PURCHASE.amountTotal,
    currency: AI_ACT_PURCHASE.currency,
    client_reference_id: userId,
    metadata: {
      user_id: userId,
      course_id: AI_ACT_PURCHASE.courseId,
      price_id: priceId,
    },
  };
}

test('accepte une session AI Act test complète et cohérente', () => {
  assert.equal(validateCompletedAiActSession(validSession(), priceId), null);
});

test('refuse un paiement non confirmé', () => {
  const session = validSession();
  session.payment_status = 'unpaid';
  assert.match(validateCompletedAiActSession(session, priceId), /n’est pas confirmé/);
});

test('refuse un montant différent de 187 EUR', () => {
  const session = validSession();
  session.amount_total = 18_699;
  assert.match(validateCompletedAiActSession(session, priceId), /montant ou la devise/);
});

test('refuse une incohérence entre le compte et les métadonnées', () => {
  const session = validSession();
  session.client_reference_id = '5c9172e4-541b-4ad9-89b5-30e243384d15';
  assert.match(validateCompletedAiActSession(session, priceId), /utilisateur/);
});

test('refuse un autre cours ou un autre tarif', () => {
  const session = validSession();
  session.metadata.course_id = 'formation-ia';
  assert.match(validateCompletedAiActSession(session, priceId), /formation ou le tarif/);
});

test('accepte le paiement ponctuel de 343 EUR pour Prompt Engineering Niveau 1', () => {
  const promptPriceId = 'price_test_prompt_level_one';
  const session = {
    ...validSession(),
    amount_total: PROMPT_LEVEL_ONE_PURCHASE.amountTotal,
    currency: PROMPT_LEVEL_ONE_PURCHASE.currency,
    metadata: {
      user_id: userId,
      course_id: PROMPT_LEVEL_ONE_PURCHASE.courseId,
      price_id: promptPriceId,
    },
  };
  assert.equal(validateCompletedCourseSession(session, PROMPT_LEVEL_ONE_PURCHASE, promptPriceId), null);
});

test('accepte le paiement ponctuel de 497 EUR pour la formation IA générative', () => {
  const generativeAiPriceId = 'price_test_generative_ai';
  const session = {
    ...validSession(),
    amount_total: GENERATIVE_AI_PURCHASE.amountTotal,
    currency: GENERATIVE_AI_PURCHASE.currency,
    metadata: {
      user_id: userId,
      course_id: GENERATIVE_AI_PURCHASE.courseId,
      price_id: generativeAiPriceId,
    },
  };

  assert.equal(
    validateCompletedCourseSession(session, GENERATIVE_AI_PURCHASE, generativeAiPriceId),
    null,
  );
  assert.equal(COURSE_PURCHASES['formation-ia'], GENERATIVE_AI_PURCHASE);
});

function validTravelFeeSession() {
  return {
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: IN_PERSON_TRAVEL_FEE.amountTotal,
    currency: IN_PERSON_TRAVEL_FEE.currency,
    client_reference_id: userId,
    metadata: {
      payment_type: IN_PERSON_TRAVEL_FEE.paymentType,
      booking_request_id: 'b19e9d7f-d0dc-4e8b-b4b2-45f064786a6f',
      user_id: userId,
    },
  };
}

test('accepte une participation déplacement de 30 EUR cohérente', () => {
  assert.equal(validateCompletedTravelFeeSession(validTravelFeeSession()), null);
});

test('refuse une participation déplacement au mauvais montant', () => {
  const session = validTravelFeeSession();
  session.amount_total = 2_999;
  assert.match(validateCompletedTravelFeeSession(session), /montant ou la devise/);
});

test('refuse une participation sans identifiant de réservation valide', () => {
  const session = validTravelFeeSession();
  session.metadata.booking_request_id = 'invalide';
  assert.match(validateCompletedTravelFeeSession(session), /réservation Stripe/);
});
