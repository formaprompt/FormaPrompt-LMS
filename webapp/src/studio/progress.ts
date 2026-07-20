import type { FieldValues } from 'react-hook-form';
import { calculateCategoryScore } from './engine/scoreCategory';
import type { CropSection, StudioCategoryConfig } from './types';

export interface StudioProgressState {
  activeStep: number;
  completedSections: CropSection[];
}

const SECTION_ORDER: CropSection[] = ['context', 'role', 'objective', 'precisions'];

function hasValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function calculateStudioProgress(
  category: StudioCategoryConfig<FieldValues>,
  values: FieldValues,
  hasResult: boolean,
): StudioProgressState {
  const diagnostic = calculateCategoryScore(category, values);
  const completedSections = SECTION_ORDER.filter((section) => {
    const requiredFields = category.fields.filter((field) => field.cropSection === section && field.required);
    const criterion = diagnostic.criteria.find((candidate) => candidate.id === section);
    const requiredFieldsAreValid = requiredFields.length > 0 && requiredFields.every((field) => hasValue(values[field.name]));
    const structureIsSufficient = Boolean(criterion && criterion.earnedPoints >= Math.ceil(criterion.maxPoints * 0.65));
    return requiredFieldsAreValid && structureIsSufficient;
  });

  if (hasResult) return { activeStep: 6, completedSections };

  const firstIncompleteSection = SECTION_ORDER.findIndex((section) => !completedSections.includes(section));
  return {
    activeStep: firstIncompleteSection === -1 ? 5 : firstIncompleteSection + 2,
    completedSections,
  };
}
