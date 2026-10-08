import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accessSourceForEnrollment,
  canLinkExistingCreativityAccess,
  buildAdministrativeDocument,
  documentRowsForValidatedEnrollment,
  shouldCreateEnrollmentCourseAccess,
  isCreativityCourse,
  validateAmendment,
  validateAdministrativeEnrollment,
  validateEnrollmentException,
  validateFundingUpdate,
} from '../_shared/trainingAdministration.js';

const validInput = {
  targetUserId: '00000000-0000-4000-8000-000000000001',
  learnerEmail: 'apprenant@example.test',
  learnerFirstName: 'Camille',
  learnerLastName: 'Martin',
  courseId: 'formation-ia-act',
  enrollmentSource: 'opco',
  fundingMode: 'opco',
  funderName: 'OPCO Exemple',
  fundingReference: 'DOSSIER-2026-001',
  deliveryMode: 'remote',
  remoteAccessDetails: 'Lien transmis dans la convocation.',
  startsAt: '2026-09-01T08:00:00.000Z',
  endsAt: '2026-09-01T12:00:00.000Z',
  durationMinutes: 240,
  priceAmountCents: 18700,
};

const enrollment = {
  id: '10000000-0000-4000-8000-000000000001',
  user_id: validInput.targetUserId,
  course_id: validInput.courseId,
  status: 'validated',
  enrollment_source: validInput.enrollmentSource,
  enrolled_at: '2026-08-09T12:00:00.000Z',
  organization_name: 'Entreprise Exemple',
  learner_first_name: validInput.learnerFirstName,
  learner_last_name: validInput.learnerLastName,
  learner_job_title: 'Responsable formation',
  learner_phone: null,
  learner_address_line1: null,
  learner_postal_code: null,
  learner_city: null,
  funding_mode: validInput.fundingMode,
  funder_name: validInput.funderName,
  funding_reference: validInput.fundingReference,
  delivery_mode: validInput.deliveryMode,
  training_location: null,
  remote_access_details: validInput.remoteAccessDetails,
  starts_at: validInput.startsAt,
  ends_at: validInput.endsAt,
  duration_minutes: validInput.durationMinutes,
  price_amount_cents: validInput.priceAmountCents,
  completed_at: null,
};

test('une inscription OPCO utilise le droit existant avec la source opco', () => {
  assert.equal(accessSourceForEnrollment('opco'), 'opco');
  assert.equal(accessSourceForEnrollment('manual'), 'manual');
  assert.equal(accessSourceForEnrollment('company'), 'manual');
  assert.equal(accessSourceForEnrollment('free'), 'manual');
});

test('un dossier OF ou OPCO ne réactive pas un droit existant', () => {
  assert.equal(shouldCreateEnrollmentCourseAccess(null), true);
  assert.equal(shouldCreateEnrollmentCourseAccess({ status: 'active' }), false);
  assert.equal(shouldCreateEnrollmentCourseAccess({ status: 'suspended' }), false);
  assert.equal(shouldCreateEnrollmentCourseAccess({ status: 'revoked' }), false);
});

test('les données administratives utiles sont normalisées sans ajouter de données sensibles', () => {
  const normalized = validateAdministrativeEnrollment(validInput);
  assert.equal(normalized.learnerEmail, 'apprenant@example.test');
  assert.equal(normalized.durationMinutes, 240);
  assert.equal(normalized.funderName, 'OPCO Exemple');
  assert.equal(normalized.learnerPhone, null);
});

test('les trois formules créativité ont leurs tarifs et durées catalogue', () => {
  const expected = [
    ['ia-creativite-groupe', 69000],
    ['ia-creativite-individuel', 90000],
    ['ia-creativite-ecole-association', 160000],
  ];
  for (const [courseId, priceAmountCents] of expected) {
    const form = validateAdministrativeEnrollment({
      ...validInput, courseId, durationMinutes: undefined, priceAmountCents: undefined,
    });
    assert.equal(form.durationMinutes, 840);
    assert.equal(form.priceAmountCents, priceAmountCents);
    assert.equal(isCreativityCourse(courseId), true);
  }
  assert.equal(isCreativityCourse('ia-creativite-unknown'), false);
  assert.throws(() => validateAdministrativeEnrollment({ ...validInput, courseId: 'ia-creativite-groupe', durationMinutes: 600 }), /catalogue/i);
  assert.throws(() => validateAdministrativeEnrollment({ ...validInput, courseId: 'ia-creativite-groupe', priceAmountCents: 60000 }), /catalogue/i);
});

test('les documents créativité reprennent le bon nom, les 14 heures et les objectifs partagés', () => {
  for (const courseId of ['ia-creativite-groupe', 'ia-creativite-individuel', 'ia-creativite-ecole-association']) {
    const normalized = validateAdministrativeEnrollment({ ...validInput, courseId, durationMinutes: undefined, priceAmountCents: undefined });
    const snap = buildAdministrativeDocument('training_agreement', {
      ...enrollment, course_id: courseId, duration_minutes: 840,
      price_amount_cents: normalized.priceAmountCents,
    }, validInput.learnerEmail);
    assert.match(snap.course.title, /Explorer l’IA au service de la créativité/);
    assert.equal(snap.course.durationMinutes, 840);
    assert.match(snap.course.objectives[1], /CROP/);
    assert.match(snap.clauses[1], /planification de la séance/);
    assert.doesNotMatch(snap.clauses[1], /espace apprenant/i);
  }
});

test('les droits créativité existants doivent être actifs et prouvables', () => {
  const gift = { status: 'active', access_source: 'gift', purchase_id: null };
  assert.equal(canLinkExistingCreativityAccess(gift), true);
  assert.equal(canLinkExistingCreativityAccess({ ...gift, status: 'suspended' }), false);
  assert.equal(canLinkExistingCreativityAccess({ ...gift, expires_at: '2000-01-01T00:00:00Z' }), false);
  assert.equal(canLinkExistingCreativityAccess({ ...gift, purchase_id: 'purchase-id' }), false);
  const paid = {
    status: 'active', access_source: 'stripe', purchase_id: 'purchase-id',
    user_id: 'user-id', course_id: 'ia-creativite-groupe',
  };
  assert.equal(canLinkExistingCreativityAccess(paid, {
    id: 'purchase-id', user_id: 'user-id', course_id: 'ia-creativite-groupe', payment_status: 'paid',
  }), true);
  assert.equal(canLinkExistingCreativityAccess(paid, {
    id: 'purchase-id', user_id: 'user-id', course_id: 'ia-creativite-groupe', payment_status: 'refunded',
  }), false);
});

test('une période incohérente est refusée', () => {
  assert.throws(
    () => validateAdministrativeEnrollment({ ...validInput, endsAt: validInput.startsAt }),
    /date de fin doit suivre/i,
  );
});

test('la convention et la convocation sont préremplies avec le même dossier', () => {
  const agreement = buildAdministrativeDocument('training_agreement', enrollment, validInput.learnerEmail);
  const convocation = buildAdministrativeDocument('convocation', enrollment, validInput.learnerEmail);
  assert.equal(agreement.learner.fullName, 'Camille Martin');
  assert.equal(agreement.course.title, 'IA : acculturation et préparation à la conformité AI Act');
  assert.equal(agreement.client.fundingReference, 'DOSSIER-2026-001');
  assert.equal(agreement.provider.taxStatement, 'TVA non applicable - article 293 B du CGI');
  assert.equal(convocation.course.startsAt, validInput.startsAt);
  assert.match(convocation.instructions, /Connectez-vous/);
});

test('un dossier validé prépare cinq documents sans rendre les pièces manquantes visibles', () => {
  const documents = documentRowsForValidatedEnrollment(
    enrollment,
    validInput.learnerEmail,
    '20000000-0000-4000-8000-000000000001',
    '2026-08-09T13:00:00.000Z',
  );
  assert.equal(documents.length, 5);
  assert.deepEqual(
    documents.filter((document) => document.status === 'ready').map((document) => document.document_type),
    ['training_agreement', 'convocation'],
  );
  assert.ok(documents.filter((document) => document.status === 'missing').every((document) => !document.visible_to_learner));
});

test('la fin de formation produit une attestation structurée', () => {
  const certificate = buildAdministrativeDocument(
    'completion_certificate',
    { ...enrollment, status: 'completed', completed_at: '2026-09-01T12:00:00.000Z' },
    validInput.learnerEmail,
  );
  assert.equal(certificate.documentType, 'completion_certificate');
  assert.match(certificate.completion.statement, /Camille|formation/i);
  assert.equal(certificate.completion.completedAt, '2026-09-01T12:00:00.000Z');
});

test('un financement partiel calcule des montants cohérents sans attribuer de droit', () => {
  const funding = validateFundingUpdate({
    status: 'partially_granted', requestedCents: 49700, grantedCents: 30000,
    funderName: 'OPCO Exemple', fundingReference: 'OPCO-42', reason: 'Décision reçue du financeur.',
  });
  assert.equal(funding.grantedCents, 30000);
  assert.throws(() => validateFundingUpdate({ ...funding, grantedCents: 60000 }), /dépasser/);
});

test('les exceptions exigent un motif et conservent une période cohérente', () => {
  assert.throws(() => validateEnrollmentException('cancel_enrollment', { actorLabel: 'Client' }), /Motif requis/);
  const postponed = validateEnrollmentException('postpone_enrollment', {
    reason: 'Indisponibilité confirmée par le bénéficiaire.',
    startsAt: '2026-10-01T08:00:00Z', endsAt: '2026-10-01T12:00:00Z',
  });
  assert.equal(postponed.startsAt, '2026-10-01T08:00:00.000Z');
});

test('un avenant fige les valeurs avant et après', () => {
  const amendment = validateAmendment({
    effectiveDate: '2026-09-10', reason: 'Report accepté par les parties.',
    changeSummary: 'La session est déplacée au 1er octobre.',
    previousValues: { startsAt: '2026-09-01' }, newValues: { startsAt: '2026-10-01' },
  });
  assert.deepEqual(amendment.previousValues, { startsAt: '2026-09-01' });
  assert.deepEqual(amendment.newValues, { startsAt: '2026-10-01' });
});
