export function getLearningPathProgress(lessons = [], rows = []) {
  const knownLessonIds = new Set(lessons.map((lesson) => lesson.id));
  const completed = rows.filter(
    (row) => knownLessonIds.has(row.lesson_id) && row.status === 'completed',
  ).length;
  const total = lessons.length;

  return {
    completed,
    total,
    percentage: total ? Math.round((completed / total) * 100) : 0,
  };
}
export function getResumeLessonId(lessons = [], rows = []) {
  const knownLessonIds = new Set(lessons.map((lesson) => lesson.id));
  const latest = [...rows]
    .filter((row) => knownLessonIds.has(row.lesson_id))
    .sort((first, second) => (
      new Date(second.last_viewed_at).getTime() - new Date(first.last_viewed_at).getTime()
    ))[0];

  return latest?.lesson_id || lessons[0]?.id || null;
}
