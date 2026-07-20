import type { CropSection } from './types';

export interface CropContextualHelpContent {
  question: string;
  definition: string;
  frequentError: string;
  insufficientExample: string;
  improvedExample: string;
}

export const CROP_CONTEXTUAL_HELP: Record<CropSection, CropContextualHelpContent> = {
  context: {
    question: 'Pourquoi préciser le contexte ?',
    definition: 'Le contexte décrit la situation, le public et les informations dont l’IA a besoin pour comprendre votre demande.',
    frequentError: 'Présenter un sujet sans expliquer à qui le résultat est destiné ni dans quelle situation il sera utilisé.',
    insufficientExample: 'Rédige un message sur la formation.',
    improvedExample: 'Rédige un message destiné à des adultes débutants inscrits à une formation à distance, afin de rappeler les modalités pratiques.',
  },
  role: {
    question: 'Pourquoi définir un rôle ?',
    definition: 'Le rôle indique l’expertise ou le point de vue que l’IA doit adopter.',
    frequentError: 'Utiliser un rôle trop vague comme : « Agis comme un expert. »',
    insufficientExample: 'Agis comme un formateur.',
    improvedExample: 'Agis comme un formateur spécialisé en bureautique, habitué à accompagner des adultes débutants.',
  },
  objective: {
    question: 'Comment formuler un bon objectif ?',
    definition: 'L’objectif décrit le livrable attendu et ce que ce résultat doit permettre de comprendre, décider ou réaliser.',
    frequentError: 'Nommer seulement le type de contenu sans préciser son effet attendu.',
    insufficientExample: 'Crée une présentation.',
    improvedExample: 'Crée le plan d’une présentation de dix minutes permettant à une équipe de comprendre les trois étapes du projet et de valider la prochaine action.',
  },
  precisions: {
    question: 'Quelles précisions ajouter ?',
    definition: 'Les précisions encadrent le ton, le format, la longueur, les éléments obligatoires, les contrôles et ce qu’il faut éviter.',
    frequentError: 'Demander un résultat « professionnel » sans définir de format ni de limite vérifiable.',
    insufficientExample: 'Fais quelque chose de clair et professionnel.',
    improvedExample: 'Utilise un ton professionnel et accessible, trois parties titrées, moins de 500 mots, sans chiffre inventé, puis signale les informations à vérifier.',
  },
};
