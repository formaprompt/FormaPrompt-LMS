import assert from 'node:assert/strict';
import test from 'node:test';
import { filterAdministrativeEnrollments, sortedLifecycleItems } from './enrollmentLifecycle.js';

const enrollments = [
  { id: 'a', status: 'validated', funding_status: 'partially_granted', learner_first_name: 'Camille', learner_last_name: 'Martin', profiles: { email: 'camille@example.test' }, funder_name: 'OPCO Atlas' },
  { id: 'b', status: 'cancelled', funding_status: 'refused', learner_first_name: 'Alex', learner_last_name: 'Durand', profiles: { email: 'alex@example.test' }, organization_name: 'Entreprise Démo' },
];

test('filtre les dossiers par texte, statut et financement', () => {
  assert.deepEqual(filterAdministrativeEnrollments(enrollments, { search: 'atlas' }).map(({ id }) => id), ['a']);
  assert.deepEqual(filterAdministrativeEnrollments(enrollments, { status: 'cancelled' }).map(({ id }) => id), ['b']);
  assert.deepEqual(filterAdministrativeEnrollments(enrollments, { fundingStatus: 'partially_granted' }).map(({ id }) => id), ['a']);
});

test('fusionne événements et avenants dans un historique décroissant', () => {
  const items = sortedLifecycleItems({
    training_enrollment_events: [{ id: 'event', created_at: '2026-08-20T10:00:00Z' }],
    training_amendments: [{ id: 'amendment', created_at: '2026-08-21T10:00:00Z' }],
  });
  assert.deepEqual(items.map(({ id }) => id), ['amendment', 'event']);
});
