import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COURSE_ACCESS_STATUS_LABELS,
  isCourseAccessOpen,
  learnerAccessMessage,
} from './courseAccessLifecycle.js';

test('un accès actif sans échéance reste contrôlé et ouvert', () => {
  assert.equal(isCourseAccessOpen({ status: 'active', expires_at: null }), true);
});

test('un accès suspendu sans échéance reste fermé', () => {
  assert.equal(isCourseAccessOpen({ status: 'suspended', expires_at: null }), false);
});

test('completed ne fait pas partie des statuts de droit', () => {
  assert.equal(COURSE_ACCESS_STATUS_LABELS.completed, undefined);
});

test('les messages apprenant restent neutres', () => {
  assert.match(learnerAccessMessage('suspended'), /temporairement suspendu/i);
  assert.doesNotMatch(learnerAccessMessage('suspended'), /incident|sanction|disciplin/i);
});
