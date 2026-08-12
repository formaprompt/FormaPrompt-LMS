import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_ACTIVATION_POLICIES,
  ACCESS_START_CHOICES,
  AI_ACT_PURCHASE,
  CONSENT_TYPES,
  COURSE_PURCHASES,
  GENERATIVE_AI_PURCHASE,
  getCommercialRoute,
  IN_PERSON_TRAVEL_FEE,
  OFFER_CLASSIFICATIONS,
  PROMPT_LEVEL_ONE_PURCHASE,
  requiresLegacyPaymentReview,
  SALES_CONTEXTS,
  shouldActivateCourseAccess,
  validateCommercialCheckoutRequest,
  validateCommercialConsentEvidence,
  validateCompletedAiActSession,
  validateCompletedCourseSession,
  validateCompletedCourseSessionBase,
  validateCompletedTravelFeeSession,
} from '../_shared/purchaseConfig.js';

const priceId = 'price_test_ai_act';
const userId = 'b86f9479-e782-4c03-8fe0-e55f4ab67a56';
const checkoutIntentId = '1f4789b5-19f2-4ad1-9d84-ef18a5fd94af';

function validSession(purchase = AI_ACT_PURCHASE, selectedPriceId = priceId) {
  return {
    id: 'cs_test_123',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: purchase.amountTotal,
    currency: purchase.currency,
    client_reference_id: userId,
    metadata: {
      user_id: userId,
      course_id: purchase.courseId,
      price_id: selectedPriceId,
      checkout_intent_id: checkoutIntentId,
    },
  };
}

function personalContext(accessStartChoice = ACCESS_START_CHOICES.IMMEDIATE) {
  return { sales_context: SALES_CONTEXTS.PERSONAL, access_start_choice: accessStartChoice };
}

function validConsentPayload(purchase, route) {
  return Object.fromEntries([
    ['cgv_version', route.cgvVersion],
    ...route.requiredConsentTypes.map((type) => [type, true]),
  ]);
}

test('les trois offres publiques conservent le paiement direct et une configuration mixte explicite', () => {
  assert.deepEqual(Object.keys(COURSE_PURCHASES).sort(), [
    'formation-ia',
    'formation-ia-act',
    'formation-prompt-level-1',
  ]);
  for (const purchase of Object.values(COURSE_PURCHASES)) {
    assert.equal(purchase.checkoutEnabled, true);
    assert.equal(purchase.components.service, true);
    assert.equal(purchase.components.digitalContent, true);
    const route = getCommercialRoute(purchase, personalContext());
    assert.equal(route.directCheckoutEnabled, true);
    assert.equal(validateCommercialCheckoutRequest(purchase, personalContext(), validConsentPayload(purchase, route)), null);
  }
});

test('un particulier choisit un accès immédiat avec consentements séparés', () => {
  const context = personalContext();
  const route = getCommercialRoute(AI_ACT_PURCHASE, context);
  assert.equal(route.offerClassification, OFFER_CLASSIFICATIONS.B2C_STANDARD);
  assert.equal(route.cgvDocumentType, 'cgv_b2c');
  assert.equal(route.accessActivationPolicy, ACCESS_ACTIVATION_POLICIES.IMMEDIATE_AFTER_PAYMENT);
  assert.deepEqual(route.requiredConsentTypes, [
    CONSENT_TYPES.CGV_ACCEPTANCE,
    CONSENT_TYPES.EARLY_SERVICE_START,
    CONSENT_TYPES.DIGITAL_CONTENT_START,
    CONSENT_TYPES.DIGITAL_CONTENT_WITHDRAWAL_ACKNOWLEDGEMENT,
  ]);
  const consents = validConsentPayload(AI_ACT_PURCHASE, route);
  assert.equal(validateCommercialCheckoutRequest(AI_ACT_PURCHASE, context, consents), null);
  assert.match(validateCommercialCheckoutRequest(AI_ACT_PURCHASE, context, {
    ...consents,
    digital_content_start: false,
  }), /digital_content_start/);
});

test('un particulier peut payer immédiatement tout en différant course_access', () => {
  const context = personalContext(ACCESS_START_CHOICES.DEFERRED);
  const route = getCommercialRoute(AI_ACT_PURCHASE, context);
  assert.equal(route.directCheckoutEnabled, true);
  assert.equal(route.accessActivationPolicy, ACCESS_ACTIVATION_POLICIES.DEFERRED_AFTER_WITHDRAWAL_PERIOD);
  assert.deepEqual(route.requiredConsentTypes, [CONSENT_TYPES.CGV_ACCEPTANCE]);
  assert.equal(validateCommercialCheckoutRequest(
    AI_ACT_PURCHASE,
    context,
    validConsentPayload(AI_ACT_PURCHASE, route),
  ), null);
  assert.equal(shouldActivateCourseAccess({ access_activation_policy: route.accessActivationPolicy }), false);
});

test('un professionnel utilise les CGV B2B sans consentements consommateurs inutiles', () => {
  const context = { sales_context: SALES_CONTEXTS.PROFESSIONAL_SELF };
  const route = getCommercialRoute(AI_ACT_PURCHASE, context);
  assert.equal(route.offerClassification, OFFER_CLASSIFICATIONS.B2B);
  assert.equal(route.cgvDocumentType, 'cgv_b2b');
  assert.deepEqual(route.requiredConsentTypes, [CONSENT_TYPES.CGV_ACCEPTANCE]);
  assert.equal(validateCommercialCheckoutRequest(
    AI_ACT_PURCHASE,
    context,
    validConsentPayload(AI_ACT_PURCHASE, route),
  ), null);
});

test('un achat bénéficiaire reste payable mais exige organisation et bénéficiaire', () => {
  const incomplete = { sales_context: SALES_CONTEXTS.BENEFICIARY };
  const route = getCommercialRoute(AI_ACT_PURCHASE, incomplete);
  const consents = validConsentPayload(AI_ACT_PURCHASE, route);
  assert.match(validateCommercialCheckoutRequest(AI_ACT_PURCHASE, incomplete, consents), /bénéficiaire/);

  const complete = {
    sales_context: SALES_CONTEXTS.BENEFICIARY,
    beneficiary_email: 'beneficiaire@example.com',
    buyer_organization_name: 'Entreprise Test',
  };
  assert.equal(validateCommercialCheckoutRequest(AI_ACT_PURCHASE, complete, consents), null);
  assert.equal(route.accessActivationPolicy, ACCESS_ACTIVATION_POLICIES.DEFERRED_BENEFICIARY_ASSIGNMENT);
});

test('le parcours OPCO reste distinct du paiement Stripe direct', () => {
  const context = { sales_context: SALES_CONTEXTS.OF_OPCO };
  const route = getCommercialRoute(AI_ACT_PURCHASE, context);
  assert.equal(route.offerClassification, OFFER_CLASSIFICATIONS.OF_OPCO);
  assert.equal(route.directCheckoutEnabled, false);
  assert.match(validateCommercialCheckoutRequest(AI_ACT_PURCHASE, context, {}), /financement ou un devis/);
});

test('le serveur refuse contexte manipulé, ancienne version et consentement inutile', () => {
  assert.match(validateCommercialCheckoutRequest(AI_ACT_PURCHASE, { sales_context: 'invented' }, {}), /contexte commercial/);
  const context = { sales_context: SALES_CONTEXTS.PROFESSIONAL_SELF };
  const route = getCommercialRoute(AI_ACT_PURCHASE, context);
  assert.match(validateCommercialCheckoutRequest(AI_ACT_PURCHASE, context, {
    cgv_version: 'CGV-B2B-ANCIENNE',
    cgv_acceptance: true,
  }), /version des CGV/);
  assert.match(validateCommercialCheckoutRequest(AI_ACT_PURCHASE, context, {
    ...validConsentPayload(AI_ACT_PURCHASE, route),
    early_service_start: true,
  }), /ne s’applique pas/);
});

test('le webhook relie Stripe à une intention et aux preuves versionnées uniques', () => {
  const context = personalContext();
  const route = getCommercialRoute(AI_ACT_PURCHASE, context);
  const session = validSession();
  session.metadata.sales_context = route.salesContext;
  session.metadata.access_activation_policy = route.accessActivationPolicy;
  const intent = {
    id: checkoutIntentId,
    user_id: userId,
    course_id: AI_ACT_PURCHASE.courseId,
    offer_classification: route.offerClassification,
    sales_context: route.salesContext,
    access_start_choice: context.access_start_choice,
    access_activation_policy: route.accessActivationPolicy,
    stripe_checkout_session_id: session.id,
    status: 'stripe_session_created',
  };
  const versions = {
    [CONSENT_TYPES.CGV_ACCEPTANCE]: route.cgvVersion,
    [CONSENT_TYPES.EARLY_SERVICE_START]: AI_ACT_PURCHASE.legalVersions.earlyService,
    [CONSENT_TYPES.DIGITAL_CONTENT_START]: AI_ACT_PURCHASE.legalVersions.digitalStart,
    [CONSENT_TYPES.DIGITAL_CONTENT_WITHDRAWAL_ACKNOWLEDGEMENT]: AI_ACT_PURCHASE.legalVersions.digitalWithdrawalAcknowledgement,
  };
  const rows = route.requiredConsentTypes.map((consentType) => ({
    checkout_intent_id: intent.id,
    user_id: userId,
    course_id: AI_ACT_PURCHASE.courseId,
    consent_type: consentType,
    granted: true,
    legal_document_versions: { version: versions[consentType] },
  }));
  assert.equal(validateCommercialConsentEvidence(session, AI_ACT_PURCHASE, intent, rows), null);
  assert.equal(shouldActivateCourseAccess(intent), true);
  assert.match(validateCommercialConsentEvidence(session, AI_ACT_PURCHASE, intent, [...rows, rows[0]]), /ambiguë/);
});

test('accepte une session AI Act complète et cohérente', () => {
  assert.equal(validateCompletedAiActSession(validSession(), priceId), null);
});

test('refuse un paiement non confirmé ou au mauvais montant', () => {
  const unpaid = validSession();
  unpaid.payment_status = 'unpaid';
  assert.match(validateCompletedAiActSession(unpaid, priceId), /n’est pas confirmé/);
  const wrongAmount = validSession();
  wrongAmount.amount_total = 18_699;
  assert.match(validateCompletedAiActSession(wrongAmount, priceId), /montant ou la devise/);
});

test('refuse une incohérence de compte, formation ou tarif', () => {
  const wrongUser = validSession();
  wrongUser.client_reference_id = '5c9172e4-541b-4ad9-89b5-30e243384d15';
  assert.match(validateCompletedAiActSession(wrongUser, priceId), /utilisateur/);
  const wrongCourse = validSession();
  wrongCourse.metadata.course_id = 'formation-ia';
  assert.match(validateCompletedAiActSession(wrongCourse, priceId), /formation, le tarif/);
});

test('place une ancienne session sans intention commerciale en revue', () => {
  const session = validSession();
  delete session.metadata.checkout_intent_id;
  assert.match(validateCompletedAiActSession(session, priceId), /preuve commerciale/);
  assert.equal(validateCompletedCourseSessionBase(session, AI_ACT_PURCHASE, priceId), null);
  assert.equal(requiresLegacyPaymentReview(session), true);
});

test('accepte les paiements ponctuels des trois formations', () => {
  for (const [purchase, selectedPriceId] of [
    [AI_ACT_PURCHASE, 'price_test_ai_act'],
    [PROMPT_LEVEL_ONE_PURCHASE, 'price_test_prompt'],
    [GENERATIVE_AI_PURCHASE, 'price_test_ia'],
  ]) {
    assert.equal(validateCompletedCourseSession(validSession(purchase, selectedPriceId), purchase, selectedPriceId), null);
  }
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

test('valide la participation déplacement sans régression', () => {
  assert.equal(validateCompletedTravelFeeSession(validTravelFeeSession()), null);
  const wrongAmount = validTravelFeeSession();
  wrongAmount.amount_total = 2_999;
  assert.match(validateCompletedTravelFeeSession(wrongAmount), /montant ou la devise/);
  const wrongBooking = validTravelFeeSession();
  wrongBooking.metadata.booking_request_id = 'invalide';
  assert.match(validateCompletedTravelFeeSession(wrongBooking), /réservation Stripe/);
});
