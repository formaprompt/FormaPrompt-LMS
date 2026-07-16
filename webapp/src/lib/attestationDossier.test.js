import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAttestationDossier, formatAttestationDuration } from './attestationDossier.js';

const booking = { id: 'booking-1', status: 'completed' };
const sessions = [
  { starts_at: '2026-07-01T07:00:00Z', ends_at: '2026-07-01T12:00:00Z' },
  { starts_at: '2026-07-02T07:00:00Z', ends_at: '2026-07-02T12:00:00Z' },
];

function attendanceFor(session, overrides = {}) {
  return {
    id: `attendance-${session.starts_at}`,
    booking_request_id: booking.id,
    session_starts_at: session.starts_at,
    session_ends_at: session.ends_at,
    learner_confirmed_at: session.starts_at,
    learner_signature_sha256: 'learner-hash',
    trainer_status: 'present',
    trainer_validated_at: session.ends_at,
    trainer_signature_sha256: 'trainer-hash',
    locked_at: session.ends_at,
    ...overrides,
  };
}

test('prépare les deux attestations quand les présences et l’évaluation sont validées', () => {
  const dossier = buildAttestationDossier({
    learnerName: 'Camille Exemple',
    learnerEmail: 'camille@example.com',
    booking,
    sessions,
    attendanceRecords: sessions.map((session) => attendanceFor(session)),
    finalReview: { review_status: 'validated' },
  });

  assert.equal(dossier.realizationReady, true);
  assert.equal(dossier.competencyReady, true);
  assert.equal(dossier.attendedMinutes, 600);
  assert.equal(dossier.completedSessionCount, 2);
  assert.deepEqual(dossier.missingRequirements, []);
});

test('conserve la durée réelle en cas de départ anticipé validé', () => {
  const dossier = buildAttestationDossier({
    learnerName: 'Camille Exemple',
    learnerEmail: 'camille@example.com',
    booking,
    sessions,
    attendanceRecords: [
      attendanceFor(sessions[0]),
      attendanceFor(sessions[1], {
        trainer_status: 'partial',
        actual_ends_at: '2026-07-02T11:00:00Z',
      }),
    ],
    finalReview: { review_status: 'validated' },
  });

  assert.equal(dossier.realizationReady, true);
  assert.equal(dossier.attendedMinutes, 540);
  assert.equal(formatAttestationDuration(dossier.attendedMinutes), '9 h');
});

test('bloque l’attestation si une preuve formateur manque', () => {
  const dossier = buildAttestationDossier({
    learnerName: 'Camille Exemple',
    learnerEmail: 'camille@example.com',
    booking,
    sessions,
    attendanceRecords: [
      attendanceFor(sessions[0]),
      attendanceFor(sessions[1], { trainer_signature_sha256: null }),
    ],
    finalReview: { review_status: 'validated' },
  });

  assert.equal(dossier.realizationReady, false);
  assert.equal(dossier.competencyReady, false);
  assert.match(dossier.missingRequirements.join(' '), /émargements/);
});

test('distingue réalisation et compétences lorsque le cas final est à reprendre', () => {
  const dossier = buildAttestationDossier({
    learnerName: 'Camille Exemple',
    learnerEmail: 'camille@example.com',
    booking,
    sessions,
    attendanceRecords: sessions.map((session) => attendanceFor(session)),
    finalReview: { review_status: 'needs_revision' },
  });

  assert.equal(dossier.realizationReady, true);
  assert.equal(dossier.competencyReady, false);
  assert.deepEqual(dossier.realizationMissingRequirements, []);
  assert.match(dossier.missingRequirements.join(' '), /évaluation finale validée/);
});

test('demande un nom complet distinct de l’adresse électronique', () => {
  const dossier = buildAttestationDossier({
    learnerName: 'camille@example.com',
    learnerEmail: 'camille@example.com',
    booking,
    sessions,
    attendanceRecords: sessions.map((session) => attendanceFor(session)),
    finalReview: { review_status: 'validated' },
  });

  assert.equal(dossier.identityComplete, false);
  assert.equal(dossier.competencyReady, false);
  assert.match(dossier.missingRequirements.join(' '), /nom complet/);
});
