import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAttestationReference,
  formatAttestationPeriod,
  resolveAttestationIssuedAt,
} from './attestationDocument.js';

test('crée une référence de réalisation stable à partir de la réservation', () => {
  assert.equal(
    createAttestationReference({
      documentType: 'realisation',
      bookingId: '11111111-2222-3333-4444-abcdef123456',
      issuedAt: '2026-07-20T10:00:00Z',
    }),
    'FP-REA-2026-EF123456',
  );
});

test('crée une référence de compétences stable à partir de l’évaluation', () => {
  assert.equal(
    createAttestationReference({
      documentType: 'competences',
      reviewId: 42,
      issuedAt: '2026-07-20T10:00:00Z',
    }),
    'FP-COMP-2026-00000042',
  );
});

test('retient la dernière validation de présence pour la date de délivrance', () => {
  const issuedAt = resolveAttestationIssuedAt('realisation', {
    sessionProofs: [
      { trainerValidatedAt: '2026-07-18T15:00:00Z' },
      { trainerValidatedAt: '2026-07-20T11:00:00Z' },
    ],
  });
  assert.equal(issuedAt, '2026-07-20T11:00:00Z');
});

test('retient la date de l’évaluation pour les compétences', () => {
  assert.equal(
    resolveAttestationIssuedAt('competences', null, { created_at: '2026-07-21T08:00:00Z' }),
    '2026-07-21T08:00:00Z',
  );
});

test('présente correctement une période sur plusieurs jours', () => {
  assert.equal(
    formatAttestationPeriod([
      { startsAt: '2026-07-18T07:00:00Z', endsAt: '2026-07-18T12:00:00Z' },
      { startsAt: '2026-07-20T07:00:00Z', endsAt: '2026-07-20T12:00:00Z' },
    ]),
    'Du 18 juillet 2026 au 20 juillet 2026',
  );
});
