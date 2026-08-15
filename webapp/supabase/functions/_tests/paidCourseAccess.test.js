import test from 'node:test';
import assert from 'node:assert/strict';
import {
  courseVideoObjectPath,
  hasUsableCourseAccess,
  paidResourceObjectPath,
  trainerGuideObjectPath,
  validatePaidCourseId,
} from '../_shared/paidCourseAccess.js';

test('seul un course_access active autorise le contenu', () => {
  assert.equal(hasUsableCourseAccess({ status: 'active', expires_at: null }), true);
  for (const status of ['suspended', 'revoked', 'refunded', 'expired']) {
    assert.equal(hasUsableCourseAccess({ status, expires_at: null }), false, status);
  }
});

test('expires_at NULL signifie seulement absence d échéance prédéfinie', () => {
  const now = new Date('2026-08-15T10:00:00.000Z');
  assert.equal(hasUsableCourseAccess({ status: 'active', expires_at: null }, now), true);
  assert.equal(hasUsableCourseAccess({ status: 'active', expires_at: '2026-08-15T09:59:59.000Z' }, now), false);
  assert.equal(hasUsableCourseAccess({ status: 'active', expires_at: '2026-08-15T10:00:01.000Z' }, now), true);
});

test('une fin de suspension ne réactive jamais le droit', () => {
  assert.equal(hasUsableCourseAccess({
    status: 'suspended',
    expires_at: null,
    suspension_ends_at: '2026-08-01T00:00:00.000Z',
  }, new Date('2026-08-15T10:00:00.000Z')), false);
});

test('les identifiants de formation sont limités au catalogue payant', () => {
  assert.equal(validatePaidCourseId('formation-ia'), 'formation-ia');
  assert.throws(() => validatePaidCourseId('../public'), /invalide/i);
});

test('les chemins Storage sont construits sans traversée', () => {
  assert.equal(
    paidResourceObjectPath('formation-ia', '/assets/guide-pratique-ia-generative-formaprompt.pdf'),
    'formation-ia/resources/guide-pratique-ia-generative-formaprompt.pdf',
  );
  assert.throws(() => paidResourceObjectPath('formation-ia', '/assets/../secret.pdf'), /invalide/i);
  assert.match(trainerGuideObjectPath('formation-ia-act'), /^formation-ia-act\/trainer\//);
});

test('la vidéo payante possède uniquement un chemin Storage interne', () => {
  assert.equal(courseVideoObjectPath('formation-ia'), null);
  assert.match(courseVideoObjectPath('formation-prompt-level-1'), /^formation-prompt-level-1\/videos\//);
});
