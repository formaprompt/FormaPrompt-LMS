import type { FieldValues } from 'react-hook-form';
import type { CropSection, StudioCategoryConfig } from '../types';

const SECTION_MARKERS: Record<CropSection, string> = {
  context: 'Contexte à préciser',
  role: 'Rôle à définir',
  objective: 'Objectif à compléter',
  precisions: 'Contraintes et format à préciser',
};

export const PROMPT_PREVIEW_MARKER = '⟦';

function isMissing(value: unknown) {
  return typeof value !== 'string' || value.trim().length === 0;
}

export interface StudioPromptPreview {
  prompt: string;
  missingSections: CropSection[];
  missingFields: string[];
}

export function buildFinalPrompt<TValues extends FieldValues>(
  category: StudioCategoryConfig<TValues>,
  values: TValues,
) {
  return category.buildPrompt(values);
}

export function buildPromptPreview<TValues extends FieldValues>(
  category: StudioCategoryConfig<TValues>,
  values: Partial<TValues>,
): StudioPromptPreview {
  const previewValues = {
    ...category.defaultValues,
    ...values,
  } as Record<string, unknown>;
  const missingSections = new Set<CropSection>();
  const missingFields: string[] = [];

  category.fields.forEach((field) => {
    const fieldName = field.name as string;
    if (!isMissing(previewValues[fieldName])) return;
    missingSections.add(field.cropSection);
    missingFields.push(fieldName);
    previewValues[fieldName] = `${PROMPT_PREVIEW_MARKER}${SECTION_MARKERS[field.cropSection]} — ${field.label}⟧`;
  });

  return {
    prompt: category.buildPrompt(previewValues as TValues),
    missingSections: [...missingSections],
    missingFields,
  };
}
