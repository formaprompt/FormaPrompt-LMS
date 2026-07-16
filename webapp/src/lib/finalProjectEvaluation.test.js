import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFinalProjectReviewStatus } from './finalProjectEvaluation.js';

test('valide le cas final lorsque les quatre critères sont acquis ou maîtrisés', () => {
  assert.equal(
    calculateFinalProjectReviewStatus(['acquired', 'mastered', 'acquired', 'mastered']),
    'validated',
  );
});

test('demande une reprise dès qu’un critère reste insuffisant', () => {
  assert.equal(
    calculateFinalProjectReviewStatus(['acquired', 'developing', 'mastered', 'acquired']),
    'needs_revision',
  );
});

test('refuse de calculer une décision avec une grille incomplète ou inconnue', () => {
  assert.equal(calculateFinalProjectReviewStatus(['acquired', 'mastered']), null);
  assert.equal(
    calculateFinalProjectReviewStatus(['acquired', 'mastered', 'excellent', 'acquired']),
    null,
  );
});
