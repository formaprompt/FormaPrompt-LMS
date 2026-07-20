import type { FieldValues } from 'react-hook-form';
import { calculateCategoryScore } from './scoreCategory';
import type { StudioCategoryConfig, StudioImprovementSuggestion } from '../types';

function textLength(value: unknown) {
  return typeof value === 'string' ? value.trim().length : 0;
}

export function getPrioritySuggestions<TValues extends FieldValues>(
  category: StudioCategoryConfig<TValues>,
  values: TValues,
  limit = 3,
): StudioImprovementSuggestion[] {
  const diagnostic = calculateCategoryScore(category, values);

  return diagnostic.criteria
    .map((criterion) => {
      const missingPoints = criterion.maxPoints - criterion.earnedPoints;
      const fields = category.fields.filter((field) => field.cropSection === criterion.id);
      const targetField = [...fields].sort((first, second) => {
        if (first.required !== second.required) return first.required ? -1 : 1;
        return textLength(values[first.name]) - textLength(values[second.name]);
      })[0];

      if (!targetField || missingPoints < Math.max(3, Math.ceil(criterion.maxPoints * 0.15))) return null;
      return {
        id: `${criterion.id}-${String(targetField.name)}`,
        section: criterion.id,
        fieldName: String(targetField.name),
        message: criterion.recommendation,
        missingPoints,
      } satisfies StudioImprovementSuggestion;
    })
    .filter((suggestion): suggestion is StudioImprovementSuggestion => Boolean(suggestion))
    .sort((first, second) => second.missingPoints - first.missingPoints)
    .slice(0, limit);
}
