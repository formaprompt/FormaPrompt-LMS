import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allowedPrivacyResolutions,
  privacyExecutionPhrase,
} from './privacyAdministration.js';

test('limite strictement les résolutions selon la catégorie RGPD', () => {
  assert.deepEqual(allowedPrivacyResolutions('purchases'), ['retain']);
  assert.deepEqual(allowedPrivacyResolutions('commercial_consents'), ['retain']);
  assert.deepEqual(allowedPrivacyResolutions('withdrawal_requests'), ['retain']);
  assert.deepEqual(allowedPrivacyResolutions('course_access'), ['disable_access', 'retain']);
  assert.deepEqual(allowedPrivacyResolutions('lesson_progress'), ['delete', 'retain']);
  assert.deepEqual(allowedPrivacyResolutions('contact_requests'), ['delete', 'anonymize', 'retain']);
  assert.deepEqual(allowedPrivacyResolutions('auth_identity'), ['external_action']);
});

test('construit une confirmation liée à la référence pseudonyme du dossier', () => {
  assert.equal(
    privacyExecutionPhrase('9ab1eb0c-8258-4f62-9403-76f382079f62'),
    'EFFACER 9ab1eb0c-8258-4f62-9403-76f382079f62',
  );
  assert.equal(privacyExecutionPhrase(null), '');
});
