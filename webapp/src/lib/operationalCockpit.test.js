import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperationalCockpit } from './operationalCockpit.js';

const NOW = new Date('2026-09-26T08:00:00Z');

function section(result, id) {
  return result.sections.find((item) => item.id === id);
}

test('le cockpit sépare les séances des disponibilités et alerte après quinze jours', () => {
  const result = buildOperationalCockpit({
    availabilitySlots: [{
      id: 'slot-1', starts_at: '2026-10-05T08:00:00Z', ends_at: '2026-10-05T09:00:00Z',
      is_active: true, is_reserved: false,
    }],
    bookings: [{
      id: 'booking-1', user_id: 'user-1', course_id: 'formation-ia-act', schedule_format: 'two_2h',
      status: 'confirmed', course_session_bookings: [{
        id: 'session-1', starts_at: '2026-10-03T08:00:00Z', ends_at: '2026-10-03T10:00:00Z',
        duration_minutes: 120, status: 'confirmed',
      }],
    }],
    enrollments: [{
      user_id: 'user-1', learner_first_name: 'Marie', learner_last_name: 'Dupont',
      organization_name: 'Entreprise Alpha', updated_at: '2026-09-20T10:00:00Z',
    }],
  }, { now: NOW });

  const sessions = section(result, 'upcoming-sessions');
  const availability = section(result, 'availability');
  assert.equal(sessions.count, 1);
  assert.equal(sessions.items[0].title, 'Entreprise Alpha — Marie DUPONT');
  assert.equal(availability.count, 0);
  assert.equal(availability.tone, 'warning');
  assert.match(availability.summary, /Aucun créneau libre après/);
});

test('les formations pas prêtes signalent les pièces, le financement et les informations manquantes', () => {
  const result = buildOperationalCockpit({
    enrollments: [{
      id: 'enrollment-1', user_id: 'user-1', course_id: 'formation-ia-act', status: 'pending',
      organization_name: 'Entreprise Alpha', learner_first_name: 'Marie', learner_last_name: 'Dupont',
      funding_mode: 'opco', funding_status: 'under_review', delivery_mode: 'remote',
      remote_access_details: '', starts_at: '2026-10-05T08:00:00Z', ends_at: '2026-10-05T12:00:00Z',
      updated_at: '2026-09-25T10:00:00Z',
      training_documents: [{ document_type: 'training_agreement', status: 'ready' }],
    }],
  }, { now: NOW });

  const readiness = section(result, 'training-readiness');
  assert.equal(readiness.count, 1);
  assert.equal(readiness.items[0].title, 'Entreprise Alpha — Marie DUPONT');
  assert.match(readiness.items[0].detail, /dossier à valider/);
  assert.match(readiness.items[0].detail, /convocation manquante/);
  assert.match(readiness.items[0].detail, /et 1 autre/);
  assert.equal(readiness.items[0].href, '/admin/apprenants/user-1');
});

test('les dossiers entreprise similaires sont regroupés sans afficher les noms des apprenants', () => {
  const shared = {
    course_id: 'formation-ia', status: 'validated', organization_name: 'Entreprise Bêta',
    funding_mode: 'company', funding_status: 'not_requested', delivery_mode: 'remote',
    remote_access_details: 'Lien transmis', starts_at: '2026-10-10T08:00:00Z', ends_at: '2026-10-10T18:00:00Z',
    training_documents: [{ document_type: 'training_agreement', status: 'ready' }],
  };
  const result = buildOperationalCockpit({
    enrollments: [
      { ...shared, id: 'enrollment-a', user_id: 'user-a', learner_first_name: 'Alice', learner_last_name: 'Durand' },
      { ...shared, id: 'enrollment-b', user_id: 'user-b', learner_first_name: 'Bob', learner_last_name: 'Petit' },
    ],
  }, { now: NOW });

  const readiness = section(result, 'training-readiness');
  assert.equal(readiness.count, 1);
  assert.equal(readiness.items[0].title, 'Entreprise Bêta — 2 participants concernés');
  assert.doesNotMatch(readiness.items[0].title, /Alice|Bob|Durand|Petit/);
  assert.match(readiness.items[0].href, /admin\/dossiers\?recherche=Entreprise%20B%C3%AAta/);
  assert.equal(result.searchIndex[0].title, 'Entreprise Bêta — 2 participants concernés');
  assert.match(result.searchIndex[0].searchText, /Alice DURAND/);
  assert.match(result.searchIndex[0].searchText, /IA générative/);
});

test('les formations terminées restent à clôturer tant que les preuves attendues manquent', () => {
  const result = buildOperationalCockpit({
    bookings: [{
      id: 'booking-closed', user_id: 'user-1', course_id: 'formation-ia-act', status: 'completed',
      course_session_bookings: [{
        id: 'session-closed', starts_at: '2026-09-20T08:00:00Z', ends_at: '2026-09-20T12:00:00Z',
        duration_minutes: 240, status: 'completed',
      }],
    }],
    enrollments: [{
      id: 'enrollment-closed', user_id: 'user-1', course_id: 'formation-ia-act', status: 'completed',
      learner_first_name: 'Nora', learner_last_name: 'Bernard', organization_name: '',
      starts_at: '2026-09-20T08:00:00Z', ends_at: '2026-09-20T12:00:00Z',
      booking_request_id: 'booking-closed', training_documents: [],
    }],
    attendance: [],
    surveys: [],
  }, { now: NOW });

  const closing = section(result, 'training-closing');
  assert.equal(closing.count, 1);
  assert.equal(closing.items[0].title, 'Nora BERNARD');
  assert.match(closing.items[0].detail, /émargement à finaliser/);
  assert.match(closing.items[0].detail, /questionnaire à récupérer/);
  assert.match(closing.items[0].detail, /attestation à générer/);
});

test('une formation terminée et documentée ne reste pas dans la file de clôture', () => {
  const result = buildOperationalCockpit({
    bookings: [{
      id: 'booking-ok', user_id: 'user-1', course_id: 'formation-ia-act', status: 'completed',
      course_session_bookings: [{
        id: 'session-ok', starts_at: '2026-09-20T08:00:00Z', ends_at: '2026-09-20T12:00:00Z',
        duration_minutes: 240, status: 'completed',
      }],
    }],
    enrollments: [{
      id: 'enrollment-ok', user_id: 'user-1', course_id: 'formation-ia-act', status: 'completed',
      learner_first_name: 'Nora', learner_last_name: 'Bernard', organization_name: '',
      starts_at: '2026-09-20T08:00:00Z', ends_at: '2026-09-20T12:00:00Z',
      booking_request_id: 'booking-ok',
      training_documents: [{ document_type: 'completion_certificate', status: 'ready' }],
    }],
    attendance: [{
      booking_request_id: 'booking-ok', session_starts_at: '2026-09-20T08:00:00Z',
      session_ends_at: '2026-09-20T12:00:00Z', learner_confirmed_at: '2026-09-20T12:05:00Z',
      trainer_status: 'present',
    }],
    surveys: [{ booking_request_id: 'booking-ok', user_id: 'user-1', created_at: '2026-09-20T14:00:00Z' }],
  }, { now: NOW });

  const closing = section(result, 'training-closing');
  assert.equal(closing.count, 0);
  assert.equal(closing.tone, 'success');
});

test('les heures non planifiées détectent aussi une planification totalement absente', () => {
  const result = buildOperationalCockpit({
    bookings: [{
      id: 'booking-empty', user_id: 'user-1', course_id: 'formation-ia-act',
      schedule_format: 'two_2h', status: 'confirmed', course_session_bookings: [],
    }],
    enrollments: [{
      user_id: 'user-1', learner_first_name: 'Lina', learner_last_name: 'Martin',
      organization_name: '', updated_at: '2026-09-20T10:00:00Z',
    }],
  }, { now: NOW });

  const unscheduled = section(result, 'unscheduled-hours');
  assert.equal(unscheduled.count, 1);
  assert.equal(unscheduled.items[0].title, 'Lina MARTIN');
  assert.match(unscheduled.items[0].detail, /0 min planifiées sur 4 h/);
  assert.equal(unscheduled.items[0].actionLabel, 'Planifier');
});

test('un groupe affiche le nombre de participants sans noms individuels', () => {
  const result = buildOperationalCockpit({
    cohorts: [{
      id: 'cohort-1', course_id: 'excel-initiation-inter', status: 'draft', enrolled_count: 6, sessions: [],
    }],
    exerciseSubmissions: [
      { id: 10, user_id: 'user-a', course_id: 'excel-initiation-inter', exercise_id: '1', saved_at: '2026-09-25T10:00:00Z' },
      { id: 11, user_id: 'user-b', course_id: 'excel-initiation-inter', exercise_id: '1', saved_at: '2026-09-25T11:00:00Z' },
    ],
    enrollments: [
      { user_id: 'user-a', learner_first_name: 'Alice', learner_last_name: 'Durand', updated_at: '2026-09-20T10:00:00Z' },
      { user_id: 'user-b', learner_first_name: 'Bob', learner_last_name: 'Petit', updated_at: '2026-09-20T10:00:00Z' },
    ],
  }, { now: NOW });

  const unscheduled = section(result, 'unscheduled-hours');
  const evaluations = section(result, 'evaluations');
  assert.equal(unscheduled.items[0].title, '6 participants concernés');
  assert.equal(evaluations.items[0].title, '2 participants concernés');
  assert.doesNotMatch(evaluations.items[0].title, /Alice|Bob|Durand|Petit/);
  assert.match(evaluations.items[0].href, /onglet=corrections/);
});

test('les questionnaires et évaluations mènent vers un contrôle directement exploitable', () => {
  const result = buildOperationalCockpit({
    bookings: [{
      id: 'booking-done', user_id: 'user-1', course_id: 'formation-ia-act', schedule_format: 'one_4h',
      status: 'completed', course_session_bookings: [{
        id: 'session-done', starts_at: '2026-09-20T08:00:00Z', ends_at: '2026-09-20T12:00:00Z',
        duration_minutes: 240, status: 'completed',
      }],
    }],
    enrollments: [{
      user_id: 'user-1', learner_first_name: 'Nora', learner_last_name: 'Bernard',
      organization_name: '', updated_at: '2026-09-20T10:00:00Z',
    }],
    finalSubmissions: [{
      id: 42, user_id: 'user-1', course_id: 'formation-ia-act', saved_at: '2026-09-25T10:00:00Z',
    }],
  }, { now: NOW });

  const questionnaires = section(result, 'questionnaires');
  const evaluations = section(result, 'evaluations');
  assert.equal(questionnaires.items[0].title, 'Nora BERNARD');
  assert.equal(questionnaires.items[0].href, '/admin/apprenants/user-1');
  assert.match(evaluations.items[0].href, /submissionId=42/);
  assert.doesNotMatch(questionnaires.items[0].title, /booking-done|42/);
});
