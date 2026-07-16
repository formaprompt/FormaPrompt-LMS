export const FINAL_PROJECT_LEVEL_IDS = [
  'not_acquired',
  'developing',
  'acquired',
  'mastered',
];

export const FINAL_PROJECT_REVIEW_FIELDS = [
  { rubricId: 'need_and_audience', column: 'need_and_audience_level' },
  { rubricId: 'prompt_and_success_criteria', column: 'prompt_and_success_criteria_level' },
  { rubricId: 'checks_and_risks', column: 'checks_and_risks_level' },
  { rubricId: 'choices_and_limits', column: 'choices_and_limits_level' },
];

const VALIDATED_LEVEL_IDS = new Set(['acquired', 'mastered']);

export function calculateFinalProjectReviewStatus(levels, expectedCount = 4) {
  if (!Array.isArray(levels) || levels.length !== expectedCount) return null;
  if (levels.some((level) => !FINAL_PROJECT_LEVEL_IDS.includes(level))) return null;

  return levels.every((level) => VALIDATED_LEVEL_IDS.has(level))
    ? 'validated'
    : 'needs_revision';
}
