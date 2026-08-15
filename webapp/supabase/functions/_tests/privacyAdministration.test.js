import assert from 'node:assert/strict';
import test from 'node:test';
import {
  privacyExecutionErrorCode,
  validatePrivacyExecutionInput,
} from '../_shared/privacyAdministration.js';

const validInput = {
  requestId: '2cb81599-d845-45e2-95b6-89b5c32f8bba',
  confirmation: 'EFFACER 9ab1eb0c-8258-4f62-9403-76f382079f62',
  reason: 'Demande vérifiée et plan approuvé catégorie par catégorie.',
};

test('valide une exécution RGPD explicitement confirmée', () => {
  assert.deepEqual(validatePrivacyExecutionInput(validInput), validInput);
});

test('refuse un identifiant, une confirmation ou un motif incomplet', () => {
  assert.throws(() => validatePrivacyExecutionInput({ ...validInput, requestId: 'demande-1' }), /RGPD est invalide/);
  assert.throws(() => validatePrivacyExecutionInput({ ...validInput, confirmation: 'OUI' }), /confirmation irréversible/);
  assert.throws(() => validatePrivacyExecutionInput({ ...validInput, reason: 'Court' }), /au moins 10/);
});

test('refuse les retours à la ligne dans les données de contrôle', () => {
  assert.throws(() => validatePrivacyExecutionInput({ ...validInput, confirmation: `${validInput.confirmation}\nAUTRE` }), /confirmation/);
  assert.throws(() => validatePrivacyExecutionInput({ ...validInput, reason: `${validInput.reason}\nseconde ligne` }), /motif/);
});

test('ne classe comme erreur client que les validations attendues', () => {
  assert.equal(privacyExecutionErrorCode(new Error('La confirmation est invalide.')), 'invalid_request');
  assert.equal(privacyExecutionErrorCode(new Error('Échec Supabase interne')), 'processing_failed');
});
