import { professionalEmailCategory } from './professionalEmail';
import type { FieldValues } from 'react-hook-form';
import type { StudioCategoryConfig, StudioCategoryId, StudioCategorySummary } from '../types';

export const studioCategoryCatalog: StudioCategorySummary[] = [
  {
    id: 'professional-email',
    label: 'Courriel professionnel',
    description: 'Structurer un prompt pour préparer un courriel professionnel.',
    available: true,
  },
  { id: 'training', label: 'Formation', description: 'Concevoir une activité ou une ressource pédagogique.', available: false },
  { id: 'social-media', label: 'Réseaux sociaux', description: 'Préparer une publication adaptée à un canal et un public.', available: false },
  { id: 'image-creation', label: 'Création d’image', description: 'Décrire une intention visuelle et ses contraintes.', available: false },
  { id: 'research', label: 'Recherche', description: 'Cadrer une recherche et les sources à vérifier.', available: false },
  { id: 'code', label: 'Code', description: 'Décrire un besoin technique et ses critères de validation.', available: false },
  { id: 'productivity', label: 'Productivité', description: 'Structurer une tâche et un livrable professionnel.', available: false },
  { id: 'video', label: 'Vidéo', description: 'Préparer un scénario, un public et un format.', available: false },
  { id: 'ai-agent', label: 'Agent IA', description: 'Définir un rôle, des limites et des contrôles humains.', available: false },
];

export const availableStudioCategories = {
  'professional-email': professionalEmailCategory,
} as const;

export function getAvailableStudioCategory(categoryId: StudioCategoryId) {
  const category = availableStudioCategories[categoryId as keyof typeof availableStudioCategories];
  return category
    ? category as unknown as StudioCategoryConfig<FieldValues>
    : null;
}
