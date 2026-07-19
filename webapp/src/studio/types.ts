import type { FieldValues, Path } from 'react-hook-form';
import type { ZodType } from 'zod';

export type CropSection = 'context' | 'role' | 'objective' | 'precisions';

export type StudioCategoryId =
  | 'professional-email'
  | 'training'
  | 'social-media'
  | 'image-creation'
  | 'research'
  | 'code'
  | 'productivity'
  | 'video'
  | 'ai-agent';

export interface StudioFieldOption {
  value: string;
  label: string;
}

export interface StudioFieldConfig<TValues extends FieldValues> {
  name: Path<TValues>;
  label: string;
  type: 'text' | 'textarea' | 'select';
  cropSection: CropSection;
  help: string;
  placeholder?: string;
  required: boolean;
  maxLength?: number;
  rows?: number;
  autoComplete?: string;
  options?: StudioFieldOption[];
}

export interface ScoreRuleResult {
  earnedPoints: number;
  present: string[];
  missing: string[];
  recommendation: string;
}

export interface StudioScoreRule<TValues extends FieldValues> {
  id: CropSection;
  label: string;
  maxPoints: number;
  description: string;
  checkpoints: string[];
  evaluate: (values: TValues) => ScoreRuleResult;
}

export interface StudioScoreCriterion extends ScoreRuleResult {
  id: CropSection;
  label: string;
  maxPoints: number;
  description: string;
  checkpoints: string[];
}

export interface StudioDiagnostic {
  total: number;
  maxTotal: number;
  criteria: StudioScoreCriterion[];
  summary: string;
}

export interface StudioExample {
  title: string;
  description: string;
  prompt: string;
}

export interface StudioBeforeAfter {
  vagueRequest: string;
  missingDescription: string;
  structuredPrompt: string;
  benefit: string;
}

export interface StudioCategoryConfig<TValues extends FieldValues> {
  id: StudioCategoryId;
  label: string;
  shortDescription: string;
  schema: ZodType<TValues, TValues>;
  defaultValues: TValues;
  fields: StudioFieldConfig<TValues>[];
  requiredInformation: string[];
  buildPrompt: (values: TValues) => string;
  scoreRules: StudioScoreRule<TValues>[];
  messages: {
    introduction: string;
    privacy: string;
    resultHelp: string;
  };
  beforeAfter: StudioBeforeAfter;
  examples: StudioExample[];
  recommendations: string[];
}

export interface StudioCategorySummary {
  id: StudioCategoryId;
  label: string;
  description: string;
  available: boolean;
}

export interface StudioResult<TValues extends FieldValues> {
  values: TValues;
  prompt: string;
  diagnostic: StudioDiagnostic;
}

export const CROP_SECTION_LABELS: Record<CropSection, string> = {
  context: 'C — Contexte',
  role: 'R — Rôle',
  objective: 'O — Objectif',
  precisions: 'P — Précisions',
};
