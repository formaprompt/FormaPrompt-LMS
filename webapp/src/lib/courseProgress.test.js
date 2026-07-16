import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCourseProgress } from './courseProgress.js';

const exercises = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

test('calcule la progression à partir des exercices terminés', () => {
  const progress = calculateCourseProgress(
    exercises,
    [
      { exercise_id: '1', status: 'submitted' },
      { exercise_id: '2', status: 'draft' },
    ],
    [
      { exercise_id: '1', review_status: 'validated' },
      { exercise_id: '2', review_status: 'changes_requested' },
    ],
  );

  assert.deepEqual(progress, {
    total: 5,
    started: 2,
    completed: 1,
    validated: 1,
    percentage: 20,
  });
});

test('ignore les réponses étrangères au catalogue et ne compte pas les doublons', () => {
  const progress = calculateCourseProgress(
    exercises,
    [
      { exercise_id: 1, status: 'submitted' },
      { exercise_id: '1', status: 'submitted' },
      { exercise_id: 99, status: 'submitted' },
    ],
    [
      { exercise_id: 1, review_status: 'validated' },
      { exercise_id: '1', review_status: 'validated' },
      { exercise_id: 99, review_status: 'validated' },
    ],
  );

  assert.equal(progress.completed, 1);
  assert.equal(progress.validated, 1);
  assert.equal(progress.percentage, 20);
});

test('renvoie une progression vide lorsqu’aucun exercice n’est défini', () => {
  assert.deepEqual(calculateCourseProgress([], [{ exercise_id: 1, status: 'submitted' }]), {
    total: 0,
    started: 0,
    completed: 0,
    validated: 0,
    percentage: 0,
  });
});
