import type { FieldValues } from 'react-hook-form';
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
  const completedSections = SECTION_ORDER.filter((section) => {
    const requiredFields = category.fields.filter((field) => field.cropSection === section && field.required);
    return requiredFields.length > 0 && requiredFields.every((field) => hasValue(values[field.name]));
  });

  if (hasResult) return { activeStep: 6, completedSections };

  const firstIncompleteSection = SECTION_ORDER.findIndex((section) => !completedSections.includes(section));
  return {
    activeStep: firstIncompleteSection === -1 ? 5 : firstIncompleteSection + 2,
    completedSections,
  };
}
