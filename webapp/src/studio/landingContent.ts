import type { StudioCategoryFamilyId } from './types';

export const STUDIO_LAST_UPDATED = '20 juillet 2026';

export interface StudioPublicExample {
  family: StudioCategoryFamilyId;
  familyLabel: string;
  title: string;
  description: string;
  prompt: string;
}

export const studioPublicExamples: StudioPublicExample[] = [
  {
    family: 'write',
    familyLabel: 'Écrire',
    title: 'Compte rendu professionnel',
    description: 'Transformer des notes génériques en décisions, actions et échéances vérifiables.',
    prompt: `## Contexte
Préparer le compte rendu d’une réunion fictive consacrée au lancement d’un projet interne. Le document s’adresse aux membres de l’équipe.

## Rôle
Agis comme un rédacteur professionnel attentif à la traçabilité des décisions.

## Objectif
Restituer les décisions, les actions, les responsables fictifs et les échéances à confirmer.

## Précisions
Utilise des titres courts et un tableau d’actions. N’invente aucune information et signale clairement les éléments absents des notes.`,
  },
  {
    family: 'transmit',
    familyLabel: 'Transmettre',
    title: 'Activité pédagogique pour adultes débutants',
    description: 'Concevoir une activité reliée à un objectif observable et à une vérification des acquis.',
    prompt: `## Contexte
Concevoir une activité de 30 minutes destinée à des adultes débutants qui découvrent les formules simples dans Excel.

## Rôle
Agis comme un formateur en bureautique habitué à accompagner des adultes peu à l’aise avec le numérique.

## Objectif
Permettre à chaque participant de créer puis vérifier une formule SOMME dans un tableau fictif.

## Précisions
Prévois une démonstration courte, une consigne pas à pas, un exercice individuel et trois critères de réussite observables.`,
  },
  {
    family: 'analyze',
    familyLabel: 'Analyser',
    title: 'Synthèse structurée d’un document',
    description: 'Extraire les idées essentielles tout en distinguant faits, limites et éléments à vérifier.',
    prompt: `## Contexte
Analyser un document public fourni par l’utilisateur afin d’en préparer une synthèse destinée à un responsable de projet.

## Rôle
Agis comme un analyste méthodique qui distingue les faits, les interprétations et les incertitudes.

## Objectif
Présenter les cinq constats essentiels, les risques, les opportunités et les questions encore ouvertes.

## Précisions
Produis une synthèse de 500 mots maximum. Relie chaque constat au passage fourni et n’ajoute aucune source absente.`,
  },
  {
    family: 'create',
    familyLabel: 'Créer',
    title: 'Illustration pédagogique professionnelle',
    description: 'Décrire précisément un visuel, sa composition et les éléments à exclure.',
    prompt: `## Contexte
Créer une illustration destinée à la couverture d’une ressource pédagogique sur la méthode CROP pour adultes débutants.

## Rôle
Agis comme un directeur artistique spécialisé dans les supports de formation accessibles.

## Objectif
Représenter la construction progressive d’un prompt avec quatre étapes clairement identifiables.

## Précisions
Style éditorial sobre, palette verte et bleu nuit, composition lisible sur téléphone, format 16:9. Évite les visages identifiables, les marques et le texte illisible.`,
  },
  {
    family: 'build',
    familyLabel: 'Construire',
    title: 'Correction ciblée d’un composant React',
    description: 'Cadrer une correction technique minimale avec tests et accessibilité.',
    prompt: `## Contexte
Un composant React fictif affiche un bouton qui n’est pas utilisable au clavier. Le projet utilise TypeScript et les composants existants doivent être conservés.

## Rôle
Agis comme un développeur React spécialisé en accessibilité et en corrections ciblées.

## Objectif
Identifier la cause, proposer le correctif minimal et expliquer comment vérifier le comportement au clavier.

## Précisions
N’ajoute aucune dépendance. Fournis le changement ciblé, un test automatisé et les étapes de contrôle manuel, sans modifier les autres composants.`,
  },
];

export const studioLandingContent = {
  scoreRules: [
    { id: 'context', label: 'Contexte', maxPoints: 25, description: 'Présence d’une situation exploitable, d’un destinataire défini et des faits autorisés utiles.' },
    { id: 'role', label: 'Rôle', maxPoints: 15, description: 'Précision de la posture et de la compétence confiées à l’assistant.' },
    { id: 'objective', label: 'Objectif', maxPoints: 25, description: 'Clarté du résultat attendu et présence de critères permettant de le vérifier.' },
    { id: 'precisions', label: 'Précisions', maxPoints: 35, description: 'Définition du ton, du format, des éléments obligatoires et des limites.' },
  ],
  beforeAfter: {
    vagueRequest: '« Rédige un mail pour rappeler une réunion. »',
    missingDescription: 'Le destinataire, le résultat attendu, le ton et les informations pratiques ne sont pas définis.',
    structuredPrompt: '« Contexte : rappel destiné à des participants adultes. Rôle : assistant de communication pédagogique. Objectif : rappeler les modalités et obtenir une confirmation. Précisions : ton cordial, moins de 180 mots, objet clair, date fictive et action attendue explicite. »',
    benefit: 'Le résultat peut être relu à partir d’éléments observables.',
  },
  examples: [
    {
      title: 'Rappel de réunion',
      description: 'Préparer un rappel clair avec les informations pratiques et l’action attendue.',
      prompt: `## Contexte
Prépare un rappel destiné à des participants adultes inscrits à une réunion à distance. La réunion fictive est prévue mardi à 10 h et le lien figure dans leur convocation.

## Rôle
Agis comme un assistant de communication professionnelle clair et attentif.

## Objectif
Rappelle les modalités pratiques et demande une confirmation de présence avant lundi midi.

## Précisions
Adopte un ton professionnel et cordial. Rédige moins de 160 mots, avec un objet explicite, des paragraphes courts et aucune information inventée.`,
    },
    {
      title: 'Réponse à une demande',
      description: 'Structurer une réponse professionnelle, factuelle et adaptée au destinataire.',
      prompt: `## Contexte
Réponds à la demande générique d’un responsable d’équipe qui souhaite connaître les modalités d’un accompagnement collectif.

## Rôle
Agis comme un conseiller en formation précis, accessible et prudent.

## Objectif
Présente les étapes disponibles et invite le destinataire à préciser son effectif, ses objectifs et la période souhaitée.

## Précisions
Utilise un ton professionnel et pédagogique. Structure la réponse en trois courts paragraphes. N’invente ni tarif, ni disponibilité, ni engagement contractuel.`,
    },
    {
      title: 'Suivi après formation',
      description: 'Rédiger un message de suivi avec les ressources et les prochaines étapes.',
      prompt: `## Contexte
Prépare un message de suivi destiné à un groupe d’adultes ayant terminé une formation fictive sur les usages responsables des outils numériques.

## Rôle
Agis comme un formateur encourageant et attentif à l’autonomie des participants.

## Objectif
Rappelle où retrouver les ressources, propose une prochaine action simple et invite à compléter l’évaluation prévue.

## Précisions
Adopte un ton pédagogique et cordial. Rédige un objet et moins de 180 mots. Distingue clairement les ressources, l’action proposée et l’évaluation, sans donnée personnelle.`,
    },
  ],
} as const;
