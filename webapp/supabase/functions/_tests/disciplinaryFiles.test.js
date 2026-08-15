import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bytesToSha256Hex,
  DISCIPLINARY_MAX_FILE_SIZE,
  disciplinaryObjectPath,
  signedUrlLifetime,
  validateDisciplinaryFile,
  validateDisciplinaryReason,
  validateDisciplinaryUuid,
} from '../_shared/disciplinaryFiles.js';

const INCIDENT_ID = '2cb81599-d845-45e2-95b6-89b5c32f8bba';
const FILE_ID = '9ab1eb0c-8258-4f62-9403-76f382079f62';

test('valide uniquement les identifiants et motifs administratifs attendus', () => {
  assert.equal(validateDisciplinaryUuid(INCIDENT_ID, 'Incident'), INCIDENT_ID);
  assert.equal(validateDisciplinaryReason('Consultation nécessaire pour instruire le dossier.'), 'Consultation nécessaire pour instruire le dossier.');
  assert.throws(() => validateDisciplinaryUuid('../incident', 'Incident'), /invalide/);
  assert.throws(() => validateDisciplinaryReason('Court'), /au moins 10/);
  assert.throws(() => validateDisciplinaryReason('Motif valide\navec retour'), /invalide/);
});

test('accepte seulement les formats documentaires autorisés', () => {
  const pdf = new File([new Uint8Array([37, 80, 68, 70])], 'constat.pdf', { type: 'application/pdf' });
  assert.deepEqual(validateDisciplinaryFile(pdf), {
    extension: 'pdf', mimeType: 'application/pdf', originalName: 'constat.pdf', sizeBytes: 4,
  });
  assert.throws(
    () => validateDisciplinaryFile(new File(['<svg/>'], 'preuve.svg', { type: 'image/svg+xml' })),
    /format.*interdit/i,
  );
  assert.throws(
    () => validateDisciplinaryFile(new File(['x'], '../preuve.pdf', { type: 'application/pdf' })),
    /nom.*invalide/i,
  );
});

test('refuse les fichiers vides ou dépassant dix mégaoctets', () => {
  assert.throws(() => validateDisciplinaryFile(new File([], 'vide.pdf', { type: 'application/pdf' })), /entre 1 octet/);
  const oversized = new File([new Uint8Array(DISCIPLINARY_MAX_FILE_SIZE + 1)], 'trop-grand.pdf', { type: 'application/pdf' });
  assert.throws(() => validateDisciplinaryFile(oversized), /10 Mo/);
});

test('génère un chemin opaque lié à l incident et borne les URLs signées', () => {
  assert.equal(disciplinaryObjectPath(INCIDENT_ID, FILE_ID, 'pdf'), `${INCIDENT_ID}/${FILE_ID}.pdf`);
  assert.equal(signedUrlLifetime(undefined), 60);
  assert.equal(signedUrlLifetime(10), 60);
  assert.equal(signedUrlLifetime(120), 120);
  assert.equal(signedUrlLifetime(3600), 300);
});

test('convertit une empreinte binaire en hexadécimal minuscule', () => {
  assert.equal(bytesToSha256Hex(Uint8Array.from([0, 15, 16, 255]).buffer), '000f10ff');
});
