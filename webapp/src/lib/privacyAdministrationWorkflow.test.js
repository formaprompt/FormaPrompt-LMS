import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRIVACY_CATEGORY_LABELS,
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

test('affiche les catégories IAG et exige une décision de conservation motivée dans le flux actuel', () => {
  const categories = [
    'iag_positioning_drafts', 'iag_submission_details', 'iag_review_details',
    'iag_assessment_events', 'iag_certificate_identities', 'iag_stripe_attempts',
  ];
  for (const category of categories) {
    assert.match(PRIVACY_CATEGORY_LABELS[category], /^IAG — /);
    assert.deepEqual(allowedPrivacyResolutions(category), ['retain']);
  }
});

test('construit une confirmation liée à la référence pseudonyme du dossier', () => {
  assert.equal(
    privacyExecutionPhrase('9ab1eb0c-8258-4f62-9403-76f382079f62'),
    'EFFACER 9ab1eb0c-8258-4f62-9403-76f382079f62',
  );
  assert.equal(privacyExecutionPhrase(null), '');
});
