import { analysisSynthesisCategory } from './analysisSynthesis';
import { codeCategory } from './code';
import { editorialContentCategory } from './editorialContent';
import { imageCreationCategory } from './imageCreation';
import { marketingCommunicationCategory } from './marketingCommunication';
import { officeDataCategory } from './officeData';
import { presentationCategory } from './presentation';
import { professionalEmailCategory } from './professionalEmail';
import { professionalDocumentsCategory } from './professionalDocuments';
import { productivityCategory } from './productivity';
import { researchCategory } from './research';
import { socialMediaCategory } from './socialMedia';
import { trainingCategory } from './training';
import { videoCategory } from './video';
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
  { id: 'editorial-content', family: 'write', label: 'Articles et contenus éditoriaux', description: 'Préparer un article de blog, technique, d’actualité ou de fond avec un angle et des sources explicites.', available: true },
  { id: 'social-media', family: 'write', label: 'Réseaux sociaux', description: 'Préparer une publication adaptée à une plateforme, un public et un objectif.', available: true },
  { id: 'marketing-communication', family: 'write', label: 'Marketing et communication', description: 'Cadrer un contenu, une campagne ou un argumentaire crédible et adapté à son public.', available: true },
  { id: 'training', family: 'transmit', label: 'Formation', description: 'Concevoir une activité, une séquence ou une ressource pédagogique.', available: true },
  { id: 'presentation', family: 'transmit', label: 'Présentation', description: 'Structurer un diaporama, son message, sa progression visuelle et sa prise de parole.', available: true },
  { id: 'research', family: 'analyze', label: 'Recherche', description: 'Cadrer une recherche documentaire, vérifier les sources et produire une restitution traçable.', available: true },
  { id: 'analysis-synthesis', family: 'analyze', label: 'Analyse et synthèse', description: 'Examiner des informations et produire une synthèse vérifiable.', available: true },
  { id: 'office-data', family: 'analyze', label: 'Bureautique et données', description: 'Préparer un traitement de données, un tableau ou une automatisation bureautique.', available: true },
  { id: 'image-creation', family: 'create', label: 'Création d’image', description: 'Structurer une consigne visuelle adaptée à un support et un public.', available: true },
  { id: 'video', family: 'create', label: 'Vidéo', description: 'Structurer un scénario, un storyboard ou un brief vidéo adapté au public, au format et à l’outil.', available: true },
  { id: 'audio', family: 'create', label: 'Audio', description: 'Préparer un contenu sonore, sa voix et son format.', available: false },
  { id: 'code', family: 'build', label: 'Code', description: 'Cadrer une création, une correction ou une revue de code avec des tests explicites.', available: true },
  { id: 'productivity', family: 'build', label: 'Productivité', description: 'Organiser une tâche, simplifier un processus et définir des contrôles humains.', available: true },
  { id: 'ai-agent', family: 'build', label: 'Agent IA', description: 'Définir un rôle, des limites et des contrôles humains.', available: false },
];

export const availableStudioCategories = {
  'professional-email': professionalEmailCategory,
  'professional-documents': professionalDocumentsCategory,
  'editorial-content': editorialContentCategory,
  training: trainingCategory,
  'social-media': socialMediaCategory,
  'image-creation': imageCreationCategory,
  'analysis-synthesis': analysisSynthesisCategory,
  'office-data': officeDataCategory,
  presentation: presentationCategory,
  'marketing-communication': marketingCommunicationCategory,
  research: researchCategory,
  productivity: productivityCategory,
  code: codeCategory,
  video: videoCategory,
} as const;

export function getAvailableStudioCategory(categoryId: StudioCategoryId) {
  const category = availableStudioCategories[categoryId as keyof typeof availableStudioCategories];
  return category
    ? category as unknown as StudioCategoryConfig<FieldValues>
    : null;
}
