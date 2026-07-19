import { analysisSynthesisCategory } from './analysisSynthesis';
import { imageCreationCategory } from './imageCreation';
import { marketingCommunicationCategory } from './marketingCommunication';
import { officeDataCategory } from './officeData';
import { presentationCategory } from './presentation';
import { professionalEmailCategory } from './professionalEmail';
import { professionalDocumentsCategory } from './professionalDocuments';
import { socialMediaCategory } from './socialMedia';
import { trainingCategory } from './training';
import type { FieldValues } from 'react-hook-form';
import type {
  StudioCategoryConfig,
  StudioCategoryFamilySummary,
  StudioCategoryId,
  StudioCategorySummary,
} from '../types';

export const studioCategoryFamilies: StudioCategoryFamilySummary[] = [
  { id: 'write', label: 'Écrire' },
  { id: 'transmit', label: 'Transmettre' },
  { id: 'analyze', label: 'Analyser' },
  { id: 'create', label: 'Créer' },
  { id: 'build', label: 'Construire' },
];

export const studioCategoryCatalog: StudioCategorySummary[] = [
  {
    id: 'professional-email',
    family: 'write',
    label: 'Courriel professionnel',
    description: 'Structurer un prompt pour préparer un courriel professionnel.',
    available: true,
  },
  { id: 'professional-documents', family: 'write', label: 'Documents professionnels', description: 'Préparer un rapport, un compte rendu, une procédure ou un autre document structuré.', available: true },
  { id: 'social-media', family: 'write', label: 'Réseaux sociaux', description: 'Préparer une publication adaptée à une plateforme, un public et un objectif.', available: true },
  { id: 'marketing-communication', family: 'write', label: 'Marketing et communication', description: 'Cadrer un contenu, une campagne ou un argumentaire crédible et adapté à son public.', available: true },
  { id: 'training', family: 'transmit', label: 'Formation', description: 'Concevoir une activité, une séquence ou une ressource pédagogique.', available: true },
  { id: 'presentation', family: 'transmit', label: 'Présentation', description: 'Structurer un diaporama, son message, sa progression visuelle et sa prise de parole.', available: true },
  { id: 'research', family: 'analyze', label: 'Recherche', description: 'Cadrer une recherche et les sources à vérifier.', available: false },
  { id: 'analysis-synthesis', family: 'analyze', label: 'Analyse et synthèse', description: 'Examiner des informations et produire une synthèse vérifiable.', available: true },
  { id: 'office-data', family: 'analyze', label: 'Bureautique et données', description: 'Préparer un traitement de données, un tableau ou une automatisation bureautique.', available: true },
  { id: 'image-creation', family: 'create', label: 'Création d’image', description: 'Structurer une consigne visuelle adaptée à un support et un public.', available: true },
  { id: 'video', family: 'create', label: 'Vidéo', description: 'Préparer un scénario, un public et un format.', available: false },
  { id: 'audio', family: 'create', label: 'Audio', description: 'Préparer un contenu sonore, sa voix et son format.', available: false },
  { id: 'code', family: 'build', label: 'Code', description: 'Décrire un besoin technique et ses critères de validation.', available: false },
  { id: 'productivity', family: 'build', label: 'Productivité', description: 'Structurer une tâche et un livrable professionnel.', available: false },
  { id: 'ai-agent', family: 'build', label: 'Agent IA', description: 'Définir un rôle, des limites et des contrôles humains.', available: false },
];

export const availableStudioCategories = {
  'professional-email': professionalEmailCategory,
  'professional-documents': professionalDocumentsCategory,
  training: trainingCategory,
  'social-media': socialMediaCategory,
  'image-creation': imageCreationCategory,
  'analysis-synthesis': analysisSynthesisCategory,
  'office-data': officeDataCategory,
  presentation: presentationCategory,
  'marketing-communication': marketingCommunicationCategory,
} as const;

export function getAvailableStudioCategory(categoryId: StudioCategoryId) {
  const category = availableStudioCategories[categoryId as keyof typeof availableStudioCategories];
  return category
    ? category as unknown as StudioCategoryConfig<FieldValues>
    : null;
}
