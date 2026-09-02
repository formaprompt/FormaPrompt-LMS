import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COURSE_PROMOTION,
  buildCourseStripeLineItem,
  coursePromotionCheckoutExpiresAt,
  hasCoursePromotionInput,
  isAmbiguousCourseStripeCreationError,
  normalizeCheckoutRequestId,
  normalizeCoursePromotionCode,
  validateCompletedCoursePromotionSession,
  validateCoursePromotionEventIdentity,
} from '../_shared/coursePromotion.js';
import {
  AI_ACT_PURCHASE,
  GENERATIVE_AI_PURCHASE,
  PROMPT_LEVEL_ONE_PURCHASE,
} from '../_shared/purchaseConfig.js';

const intent = {
  id: '10000000-0000-4000-8000-000000000001',
  user_id: '20000000-0000-4000-8000-000000000001',
  course_id: AI_ACT_PURCHASE.courseId,
  original_amount_cents: AI_ACT_PURCHASE.amountTotal,
  discount_amount_cents: 1_870,
  final_amount_cents: 16_830,
  promo_redemption_id: '30000000-0000-4000-8000-000000000001',
  catalog_price_id: 'price_ai_act',
  stripe_product_id: 'prod_ai_act',
};

function paidSession(overrides = {}) {
  return {
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: intent.final_amount_cents,
    currency: 'eur',
    client_reference_id: intent.user_id,
    metadata: {
      checkout_intent_id: intent.id,
      user_id: intent.user_id,
      course_id: intent.course_id,
      price_id: 'price_ai_act',
      stripe_product_id: intent.stripe_product_id,
      expected_amount_cents: String(intent.final_amount_cents),
      promo_redemption_id: intent.promo_redemption_id,
    },
    ...overrides,
  };
}

test('les trois clés course stables correspondent au catalogue serveur', () => {
  assert.deepEqual(
    [GENERATIVE_AI_PURCHASE.courseId, AI_ACT_PURCHASE.courseId, PROMPT_LEVEL_ONE_PURCHASE.courseId],
    ['formation-ia', 'formation-ia-act', 'formation-prompt-level-1'],
  );
  assert.deepEqual(
    [GENERATIVE_AI_PURCHASE.amountTotal, AI_ACT_PURCHASE.amountTotal, PROMPT_LEVEL_ONE_PURCHASE.amountTotal],
    [49_700, 18_700, 34_300],
  );
});
test('normalise les codes et refuse les identifiants de tentative invalides', () => {
  assert.equal(normalizeCoursePromotionCode(' course20 '), 'COURSE20');
  assert.equal(normalizeCoursePromotionCode('code interdit'), null);
  assert.equal(hasCoursePromotionInput('  '), false);
  assert.equal(normalizeCheckoutRequestId(intent.id.toUpperCase()), intent.id);
  assert.equal(normalizeCheckoutRequestId('invented'), null);
});

test('conserve le Price catalogue sans promotion et produit un price_data serveur avec promotion', () => {
  assert.deepEqual(buildCourseStripeLineItem({
    purchase: AI_ACT_PURCHASE,
    catalogPriceId: 'price_ai_act',
    catalogProductId: 'prod_ai_act',
    finalAmountCents: AI_ACT_PURCHASE.amountTotal,
    promotionApplied: false,
  }), { price: 'price_ai_act', quantity: 1 });
  assert.deepEqual(buildCourseStripeLineItem({
    purchase: AI_ACT_PURCHASE,
    catalogPriceId: 'price_ai_act',
    catalogProductId: 'prod_ai_act',
    finalAmountCents: 16_830,
    promotionApplied: true,
  }), {
    price_data: { currency: 'eur', product: 'prod_ai_act', unit_amount: 16_830 },
    quantity: 1,
  });
});

test('refuse tout montant dynamique falsifié, nul, négatif ou supérieur au catalogue', () => {
  for (const finalAmountCents of [0, -1, AI_ACT_PURCHASE.amountTotal + 1, 1.5]) {
    assert.throws(() => buildCourseStripeLineItem({
      purchase: AI_ACT_PURCHASE,
      catalogPriceId: 'price_ai_act',
      catalogProductId: 'prod_ai_act',
      finalAmountCents,
      promotionApplied: true,
    }), /Montant/);
  }
});

test('impose 31 minutes Checkout et au moins trois minutes de tampon sur la réservation', () => {
  const nowMs = Date.parse('2026-08-31T12:00:00Z');
  assert.equal(coursePromotionCheckoutExpiresAt({
    promotionApplied: true,
    reservationExpiresAt: '2026-08-31T12:35:00Z',
    nowMs,
  }), Math.floor(nowMs / 1000) + (31 * 60));
  assert.throws(() => coursePromotionCheckoutExpiresAt({
    promotionApplied: true,
    reservationExpiresAt: '2026-08-31T12:33:59Z',
    nowMs,
  }), /expire trop tôt/);
  assert.equal(COURSE_PROMOTION.orderContextType, 'commercial_checkout_intent');
});

test('valide le montant, la devise, la formation, le produit et la redemption figés', () => {
  assert.equal(validateCompletedCoursePromotionSession(
    paidSession(), AI_ACT_PURCHASE, 'price_ai_act', intent,
  ), null);
  assert.match(validateCompletedCoursePromotionSession(
    paidSession({ amount_total: 18_700 }), AI_ACT_PURCHASE, 'price_ai_act', intent,
  ), /montant ou la devise/i);
  assert.match(validateCompletedCoursePromotionSession(
    paidSession({ currency: 'usd' }), AI_ACT_PURCHASE, 'price_ai_act', intent,
  ), /montant ou la devise/i);
  assert.match(validateCompletedCoursePromotionSession(
    paidSession({ metadata: { ...paidSession().metadata, course_id: 'formation-ia' } }),
    AI_ACT_PURCHASE,
    'price_ai_act',
    intent,
  ), /configuration Stripe/i);
});

test('valide aussi l identité des événements terminaux sans faire confiance au navigateur', () => {
  assert.equal(validateCoursePromotionEventIdentity(
    paidSession(), AI_ACT_PURCHASE, 'price_ai_act', intent,
  ), null);
  assert.match(validateCoursePromotionEventIdentity(
    paidSession({ metadata: { ...paidSession().metadata, stripe_product_id: 'prod_other' } }),
    AI_ACT_PURCHASE,
    'price_ai_act',
    intent,
  ), /formation attendue/i);
  assert.equal(validateCoursePromotionEventIdentity({
    ...paidSession(),
    object: 'payment_intent',
    amount_total: undefined,
    amount_received: 0,
    amount: intent.final_amount_cents,
  }, AI_ACT_PURCHASE, 'price_ai_act', intent), null);
});

test('distingue les erreurs Stripe ambiguës des erreurs définitives', () => {
  assert.equal(isAmbiguousCourseStripeCreationError({ type: 'StripeConnectionError' }), true);
  assert.equal(isAmbiguousCourseStripeCreationError({ type: 'StripeAPIError' }), true);
  assert.equal(isAmbiguousCourseStripeCreationError({ type: 'StripeInvalidRequestError' }), false);
});
