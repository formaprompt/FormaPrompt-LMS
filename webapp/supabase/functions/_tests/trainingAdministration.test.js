import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accessSourceForEnrollment,
  buildAdministrativeDocument,
  documentRowsForValidatedEnrollment,
  shouldCreateEnrollmentCourseAccess,
  validateAdministrativeEnrollment,
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
