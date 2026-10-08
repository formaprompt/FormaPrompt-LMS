import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATIVITY_PURCHASES, getCommercialRoute, validateCommercialCheckoutRequest, validateCreativityStripeCatalog, validateCompletedCourseSessionBase } from '../_shared/purchaseConfig.js';

const individual = CREATIVITY_PURCHASES['ia-creativite-individuel'];
const collective = CREATIVITY_PURCHASES['ia-creativite-ecole-association'];
const context = { sales_context: 'personal', access_start_choice: 'immediate' };
const payload = purchase => {
  const route = getCommercialRoute(purchase, purchase.organizationRequired ? { sales_context: 'professional_self' } : context);
  return { cgv_version: route.cgvVersion, ...Object.fromEntries(route.requiredConsentTypes.map(type => [type, true])) };
};

test('trois montants fixes distincts et payables pour un service seul', () => {
  assert.deepEqual(Object.values(CREATIVITY_PURCHASES).map(offer => offer.amountTotal), [69000, 90000, 160000]);
  for (const offer of Object.values(CREATIVITY_PURCHASES)) {
    assert.equal(offer.components.service, true);
    assert.equal(offer.components.digitalContent, false);
    assert.equal(offer.requiresLmsAccess, false);
    assert.equal(offer.promotionEnabled, true);
    assert.equal(offer.durationHours, 14);
    assert.equal(getCommercialRoute(offer, { sales_context: 'of_opco' }), null);
  }
  const group = CREATIVITY_PURCHASES['ia-creativite-groupe'];
  assert.equal(group.checkoutEnabled, true);
  assert.equal(group.minimumParticipants, 4);
  assert.equal(group.maximumParticipants, 6);
  assert.equal(group.paymentTiming, 'at_enrollment');
  assert.equal(group.nonOpeningRefund, 'full');
  const route = getCommercialRoute(group, context);
  assert.equal(route.directCheckoutEnabled, true);
  assert.deepEqual(route.requiredConsentTypes, ['cgv_acceptance', 'early_service_start']);
  assert.equal(validateCommercialCheckoutRequest(group, context, payload(group)), null);
});

test('individuel conserve CGV et commencement du service, sans consentement numérique', () => {
  assert.deepEqual(getCommercialRoute(individual, context).requiredConsentTypes, ['cgv_acceptance', 'early_service_start']);
  assert.equal(validateCommercialCheckoutRequest(individual, context, payload(individual)), null);
  assert.deepEqual(getCommercialRoute(individual, { ...context, access_start_choice: 'deferred' }).requiredConsentTypes, ['cgv_acceptance']);
  assert.notEqual(validateCommercialCheckoutRequest(individual, context, { ...payload(individual), digital_content_start: true }), null);
});

test('forfait collectif limité au contexte professionnel avec organisation, sans bénéficiaire requis', () => {
  const professional = { sales_context: 'professional_self', buyer_organization_name: 'École de création' };
  assert.equal(validateCommercialCheckoutRequest(collective, professional, payload(collective)), null);
  for (const name of [null, '', 'a', 'x'.repeat(201)]) {
    assert.match(validateCommercialCheckoutRequest(collective, { ...professional, buyer_organization_name: name }, payload(collective)), /organisation/);
  }
  assert.equal(getCommercialRoute(collective, context), null);
  assert.equal(getCommercialRoute(collective, { sales_context: 'beneficiary' }), null);
});

test('catalogue Stripe refuse les erreurs de montant, mode, offre et métadonnées', () => {
  const price = { active: true, livemode: false, unit_amount: 90000, currency: 'eur', recurring: null, metadata: { course_id: individual.courseId, modality: 'individuel' } };
  const product = { active: true, livemode: false, metadata: { course_id: individual.courseId, duration_hours: '14', delivery_kind: 'instructor_led_service' } };
  assert.equal(validateCreativityStripeCatalog(individual, price, product, false), null);
  for (const patch of [{ unit_amount: 69000 }, { livemode: true }, { active: false }, { recurring: {} }, { metadata: { course_id: 'autre', modality: 'individuel' } }]) {
    assert.notEqual(validateCreativityStripeCatalog(individual, { ...price, ...patch }, product, false), null);
  }
  assert.notEqual(validateCreativityStripeCatalog(individual, price, { ...product, metadata: {} }, false), null);
});

test('le paiement groupe requiert exactement 690 euros et une preuve payée', () => {
  const group = CREATIVITY_PURCHASES['ia-creativite-groupe'];
  const userId = 'b86f9479-e782-4c03-8fe0-e55f4ab67a56';
  const session = { mode: 'payment', status: 'complete', payment_status: 'paid', amount_total: 69000, currency: 'eur', client_reference_id: userId, metadata: { user_id: userId, course_id: group.courseId, price_id: 'price_creativity_group' } };
  assert.equal(validateCompletedCourseSessionBase(session, group, 'price_creativity_group'), null);
  assert.notEqual(validateCompletedCourseSessionBase({ ...session, amount_total: 90000 }, group, 'price_creativity_group'), null);
  assert.notEqual(validateCompletedCourseSessionBase({ ...session, payment_status: 'unpaid' }, group, 'price_creativity_group'), null);
});

test('la preuve de paiement exacte est requise, pas une URL de succès', () => {
  const userId = 'b86f9479-e782-4c03-8fe0-e55f4ab67a56';
  const session = { mode: 'payment', status: 'complete', payment_status: 'paid', amount_total: 90000, currency: 'eur', client_reference_id: userId, metadata: { user_id: userId, course_id: individual.courseId, price_id: 'price_creativity' } };
  assert.equal(validateCompletedCourseSessionBase(session, individual, 'price_creativity'), null);
  assert.notEqual(validateCompletedCourseSessionBase({ ...session, payment_status: 'unpaid' }, individual, 'price_creativity'), null);
  assert.notEqual(validateCompletedCourseSessionBase({ ...session, amount_total: 69000 }, individual, 'price_creativity'), null);
});
