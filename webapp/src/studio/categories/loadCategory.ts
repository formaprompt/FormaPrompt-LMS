import type { FieldValues } from 'react-hook-form';
import type { StudioCategoryConfig, StudioCategoryId } from '../types';

type CategoryLoader = () => Promise<StudioCategoryConfig<FieldValues>>;

function widenCategory<TValues extends FieldValues>(category: StudioCategoryConfig<TValues>) {
  return category as unknown as StudioCategoryConfig<FieldValues>;
}

const categoryLoaders: Record<StudioCategoryId, CategoryLoader> = {
  'professional-email': () => import('./professionalEmail').then(({ professionalEmailCategory }) => widenCategory(professionalEmailCategory)),
  'professional-documents': () => import('./professionalDocuments').then(({ professionalDocumentsCategory }) => widenCategory(professionalDocumentsCategory)),
  'editorial-content': () => import('./editorialContent').then(({ editorialContentCategory }) => widenCategory(editorialContentCategory)),
  training: () => import('./training').then(({ trainingCategory }) => widenCategory(trainingCategory)),
  'social-media': () => import('./socialMedia').then(({ socialMediaCategory }) => widenCategory(socialMediaCategory)),
  'image-creation': () => import('./imageCreation').then(({ imageCreationCategory }) => widenCategory(imageCreationCategory)),
  'analysis-synthesis': () => import('./analysisSynthesis').then(({ analysisSynthesisCategory }) => widenCategory(analysisSynthesisCategory)),
  'office-data': () => import('./officeData').then(({ officeDataCategory }) => widenCategory(officeDataCategory)),
  presentation: () => import('./presentation').then(({ presentationCategory }) => widenCategory(presentationCategory)),
  'marketing-communication': () => import('./marketingCommunication').then(({ marketingCommunicationCategory }) => widenCategory(marketingCommunicationCategory)),
  research: () => import('./research').then(({ researchCategory }) => widenCategory(researchCategory)),
  productivity: () => import('./productivity').then(({ productivityCategory }) => widenCategory(productivityCategory)),
  code: () => import('./code').then(({ codeCategory }) => widenCategory(codeCategory)),
  video: () => import('./video').then(({ videoCategory }) => widenCategory(videoCategory)),
  audio: () => import('./audio').then(({ audioCategory }) => widenCategory(audioCategory)),
  'ai-agent': () => import('./aiAgent').then(({ aiAgentCategory }) => widenCategory(aiAgentCategory)),
};

export function loadStudioCategory(categoryId: StudioCategoryId) {
  return categoryLoaders[categoryId]();
}
