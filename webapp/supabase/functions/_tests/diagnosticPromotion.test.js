import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIAGNOSTIC_PROMOTION,
  buildDiagnosticStripeLineItem,
  diagnosticPromotionCheckoutExpiresAt,
  hasDiagnosticPromotionInput,
  isAmbiguousStripeCreationError,
  normalizeDiagnosticPromotionCode,
} from '../_shared/diagnosticPromotion.js';

test('utilise la cible metier stable du Diagnostic', () => {
  assert.equal(DIAGNOSTIC_PROMOTION.targetType, 'diagnostic');
  assert.equal(DIAGNOSTIC_PROMOTION.targetKey, 'diagnostic-ia-express');
  assert.equal(DIAGNOSTIC_PROMOTION.orderContextType, 'diagnostic_ia_order');
});

test('normalise uniquement un code promotionnel borne', () => {
  assert.equal(normalizeDiagnosticPromotionCode(' diag-10 '), 'DIAG-10');
  assert.equal(normalizeDiagnosticPromotionCode(''), null);
  assert.equal(normalizeDiagnosticPromotionCode('code interdit!'), null);
  assert.equal(hasDiagnosticPromotionInput('  '), false);
  assert.equal(hasDiagnosticPromotionInput('DIAG10'), true);
});

test('conserve le Price catalogue sans promotion', () => {
  assert.deepEqual(buildDiagnosticStripeLineItem({
    catalogPriceId: 'price_test_diagnostic',
    catalogProductId: 'prod_diagnostic',
    finalAmountCents: 14_900,
    promotionApplied: false,
  }), { price: 'price_test_diagnostic', quantity: 1 });
});

test('utilise un price_data serveur sans modifier le Price catalogue', () => {
  assert.deepEqual(buildDiagnosticStripeLineItem({
    catalogPriceId: 'price_test_diagnostic',
    catalogProductId: 'prod_diagnostic',
    finalAmountCents: 13_410,
    promotionApplied: true,
  }), {
    price_data: {
      currency: 'eur',
      product: 'prod_diagnostic',
      unit_amount: 13_410,
    },
    quantity: 1,
  });
});

test('refuse tout montant dynamique hors des bornes serveur', () => {
  assert.throws(() => buildDiagnosticStripeLineItem({
    catalogPriceId: 'price_test_diagnostic',
    catalogProductId: 'prod_diagnostic',
    finalAmountCents: 14_901,
    promotionApplied: true,
  }), /réservé invalide/);
  assert.throws(() => buildDiagnosticStripeLineItem({
    catalogPriceId: 'price_test_diagnostic',
    catalogProductId: 'prod_diagnostic',
    finalAmountCents: 1,
    promotionApplied: false,
  }), /catalogue/);
});

test('ne libere pas une reservation sur une erreur Stripe ambigue', () => {
  assert.equal(isAmbiguousStripeCreationError({ type: 'StripeConnectionError' }), true);
  assert.equal(isAmbiguousStripeCreationError({ type: 'StripeInvalidRequestError' }), false);
});

test('expire Checkout avant la reservation avec un tampon serveur', () => {
  const nowMs = Date.parse('2026-08-31T10:00:00Z');
  const expiresAt = diagnosticPromotionCheckoutExpiresAt({
    promotionApplied: true,
    reservationExpiresAt: '2026-08-31T10:35:00Z',
    nowMs,
  });
  assert.equal(expiresAt, Math.floor(nowMs / 1000) + (31 * 60));
  assert.equal(
    Math.floor(Date.parse('2026-08-31T10:35:00Z') / 1000) - expiresAt,
    4 * 60,
  );
});

test('refuse une reservation sans tampon suffisant et preserve le checkout catalogue', () => {
  const nowMs = Date.parse('2026-08-31T10:00:00Z');
  assert.throws(() => diagnosticPromotionCheckoutExpiresAt({
    promotionApplied: true,
    reservationExpiresAt: '2026-08-31T10:32:00Z',
    nowMs,
  }), /expire trop tôt/);
  assert.equal(diagnosticPromotionCheckoutExpiresAt({
    promotionApplied: false,
    reservationExpiresAt: null,
    nowMs,
  }), null);
});
