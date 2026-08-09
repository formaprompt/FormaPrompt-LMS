import assert from 'node:assert/strict';
import test from 'node:test';
import { getLearningPathProgress, getResumeLessonId } from './learningProgress.js';

const lessons = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];

test('calcule la progression uniquement sur les leçons du parcours', () => {
  const progress = getLearningPathProgress(lessons, [
    { lesson_id: 'one', status: 'completed' },
    { lesson_id: 'two', status: 'in_progress' },
    { lesson_id: 'other-course', status: 'completed' },
  ]);

  assert.deepEqual(progress, { completed: 1, total: 3, percentage: 33 });
});
test('reprend la leçon consultée le plus récemment', () => {
  const lessonId = getResumeLessonId(lessons, [
    { lesson_id: 'one', last_viewed_at: '2026-08-09T08:00:00Z' },
    { lesson_id: 'two', last_viewed_at: '2026-08-09T09:00:00Z' },
  ]);

  assert.equal(lessonId, 'two');
});
