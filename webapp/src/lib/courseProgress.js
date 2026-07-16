function normalizeExerciseId(value) {
  return value === null || value === undefined ? '' : String(value);
}

export function calculateCourseProgress(exercises = [], responses = [], reviews = []) {
  const exerciseIds = new Set(
    exercises
      .map((exercise) => normalizeExerciseId(exercise?.id))
      .filter(Boolean),
  );
  const startedExerciseIds = new Set();
  const completedExerciseIds = new Set();
  const validatedExerciseIds = new Set();

  responses.forEach((response) => {
    const exerciseId = normalizeExerciseId(response?.exercise_id);
    if (!exerciseIds.has(exerciseId)) return;

    startedExerciseIds.add(exerciseId);
    if (response.status === 'submitted') completedExerciseIds.add(exerciseId);
  });

  reviews.forEach((review) => {
    const exerciseId = normalizeExerciseId(review?.exercise_id);
    if (exerciseIds.has(exerciseId) && review.review_status === 'validated') {
      validatedExerciseIds.add(exerciseId);
    }
  });

  const total = exerciseIds.size;
  const completed = completedExerciseIds.size;

  return {
    total,
    started: startedExerciseIds.size,
    completed,
    validated: validatedExerciseIds.size,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
