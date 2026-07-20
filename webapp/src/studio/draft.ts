import { z } from 'zod';
import type { CropSection, StudioCategoryFamilyId, StudioCategoryId } from './types';

export const STUDIO_DRAFT_KEY = 'formaprompt-studio-draft-v1';
export const STUDIO_DRAFT_VERSION = 1;
const DRAFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const categoryIds = [
  'professional-email',
  'professional-documents',
  'editorial-content',
  'training',
  'social-media',
  'image-creation',
  'analysis-synthesis',
  'office-data',
  'presentation',
  'marketing-communication',
  'research',
  'code',
  'productivity',
  'video',
  'audio',
  'ai-agent',
] as const satisfies readonly StudioCategoryId[];

const familyIds = ['write', 'transmit', 'analyze', 'create', 'build'] as const satisfies readonly StudioCategoryFamilyId[];
const cropSections = ['context', 'role', 'objective', 'precisions'] as const satisfies readonly CropSection[];

const draftSchema = z.object({
  version: z.literal(STUDIO_DRAFT_VERSION),
  updatedAt: z.string().datetime(),
  categoryId: z.enum(categoryIds),
  activeFamily: z.enum(familyIds).nullable(),
  values: z.record(z.string(), z.string()),
  progress: z.object({
    activeStep: z.number().int().min(1).max(6),
    completedSections: z.array(z.enum(cropSections)),
  }),
});

export type StudioDraft = z.infer<typeof draftSchema>;

export function loadStudioDraft(): StudioDraft | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawDraft = window.localStorage.getItem(STUDIO_DRAFT_KEY);
    if (!rawDraft) return null;

    const parsedDraft = draftSchema.safeParse(JSON.parse(rawDraft));
    if (!parsedDraft.success) {
      window.localStorage.removeItem(STUDIO_DRAFT_KEY);
      return null;
    }

    const updatedAt = Date.parse(parsedDraft.data.updatedAt);
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > DRAFT_MAX_AGE) {
      window.localStorage.removeItem(STUDIO_DRAFT_KEY);
      return null;
    }

    return parsedDraft.data;
  } catch {
    try {
      window.localStorage.removeItem(STUDIO_DRAFT_KEY);
    } catch {
      // Le stockage peut être indisponible dans certains modes privés.
    }
    return null;
  }
}

export function saveStudioDraft(draft: StudioDraft) {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearStudioDraft() {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.removeItem(STUDIO_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}
