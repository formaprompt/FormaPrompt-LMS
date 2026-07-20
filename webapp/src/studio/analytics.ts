import type { StudioCategoryFamilyId, StudioCategoryId } from './types';

export type StudioAnalyticsEvent =
  | 'studio_opened'
  | 'category_selected'
  | 'example_applied'
  | 'crop_help_opened'
  | 'preview_opened'
  | 'prompt_generated'
  | 'prompt_copied'
  | 'external_menu_opened'
  | 'external_service_selected'
  | 'draft_restored'
  | 'draft_deleted';

export interface StudioAnalyticsPayload {
  categoryId?: StudioCategoryId;
  family?: StudioCategoryFamilyId;
  scoreRange?: '0-25' | '26-50' | '51-75' | '76-100';
  actionType?: string;
}

// Aucun fournisseur statistique n'est installé. Cette interface reste volontairement
// sans effet réseau et n'accepte jamais de texte libre ni de contenu de prompt.
export function trackStudioEvent(event: StudioAnalyticsEvent, payload: StudioAnalyticsPayload = {}) {
  void event;
  void payload;
}
