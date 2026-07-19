import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const trainingSchema = z.object({
  trainingContext: z.string().trim().min(20, 'Décrivez le besoin de formation en au moins 20 caractères.').max(700, 'Limitez le besoin à 700 caractères.'),
  audience: z.string().trim().min(5, 'Décrivez le public visé.').max(240, 'Limitez le public visé à 240 caractères.'),
  learnerLevel: z.string().trim().min(1, 'Choisissez un niveau de départ.'),
  priorKnowledge: z.string().trim().max(500, 'Limitez les acquis et prérequis à 500 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(280, 'Limitez le rôle à 280 caractères.'),
  learningObjective: z.string().trim().min(15, 'Décrivez l’objectif pédagogique en au moins 15 caractères.').max(700, 'Limitez l’objectif à 700 caractères.'),
  successCriteria: z.string().trim().max(500, 'Limitez les critères de réussite à 500 caractères.'),
  deliverableType: z.string().trim().min(1, 'Choisissez un livrable pédagogique.'),
  duration: z.string().trim().min(2, 'Indiquez une durée.').max(120, 'Limitez la durée à 120 caractères.'),
  modality: z.string().trim().min(1, 'Choisissez une modalité.'),
  requiredElements: z.string().trim().max(600, 'Limitez les éléments obligatoires à 600 caractères.'),
  constraints: z.string().trim().max(600, 'Limitez les contraintes à 600 caractères.'),
}).strict();

export type TrainingValues = z.infer<typeof trainingSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: TrainingValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];

  const contextLength = textLength(values.trainingContext);
  if (contextLength >= 80) {
    earnedPoints += 12;
    present.push('Le besoin de formation est décrit avec une situation exploitable.');
  } else if (contextLength >= 40) {
    earnedPoints += 9;
    present.push('Le besoin général de formation est compréhensible.');
    missing.push('Le contexte professionnel ou pédagogique à l’origine du besoin.');
  } else {
    earnedPoints += 6;
    present.push('Un premier besoin de formation est indiqué.');
    missing.push('La situation, les enjeux et l’usage attendu sont encore peu détaillés.');
  }

  const audienceLength = textLength(values.audience);
  if (audienceLength >= 30) {
    earnedPoints += 6;
    present.push('Le public est décrit avec suffisamment de précision.');
  } else if (audienceLength >= 12) {
    earnedPoints += 4;
    present.push('Le public principal est indiqué.');
    missing.push('Le métier, le contexte ou les caractéristiques utiles du public.');
  } else {
    earnedPoints += 2;
    present.push('Un public est mentionné.');
    missing.push('Une description plus précise du public concerné.');
  }

  if (values.learnerLevel) {
    earnedPoints += 4;
    present.push(`Le niveau de départ « ${values.learnerLevel} » est défini.`);
  } else {
    missing.push('Le niveau de départ du public.');
  }

  const priorKnowledgeLength = textLength(values.priorKnowledge);
  if (priorKnowledgeLength >= 30) {
    earnedPoints += 3;
    present.push('Les acquis ou prérequis sont détaillés.');
  } else if (priorKnowledgeLength >= 10) {
    earnedPoints += 2;
    present.push('Un premier repère sur les acquis est fourni.');
    missing.push('Les prérequis ou difficultés déjà identifiés.');
  } else {
    missing.push('Les acquis, prérequis ou difficultés de départ.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Décrivez la situation de formation, le public, son niveau et ses acquis sans utiliser de données personnelles.',
  };
}

function evaluateRole(values: TrainingValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 55) {
    return {
      earnedPoints: 15,
      present: ['La posture pédagogique et la compétence attendue sont clairement définies.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond au public, au sujet et à la modalité retenue.',
    };
  }
  if (length >= 28) {
    return {
      earnedPoints: 12,
      present: ['Un rôle pédagogique est attribué à l’assistant.'],
      missing: ['La spécialité, la posture ou l’approche pédagogique attendue.'],
      recommendation: 'Ajoutez la spécialité et la posture attendues, par exemple pédagogie pour adultes, progression pas à pas ou mise en pratique.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une compétence pédagogique et une posture adaptées au public.'],
    recommendation: 'Précisez le rôle : domaine d’expertise, public accompagné et principes pédagogiques à respecter.',
  };
}

function evaluateObjective(values: TrainingValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const objectiveLength = textLength(values.learningObjective);

  if (objectiveLength >= 80) {
    earnedPoints += 17;
    present.push('L’objectif pédagogique décrit une compétence et une situation d’utilisation.');
  } else if (objectiveLength >= 40) {
    earnedPoints += 13;
    present.push('L’objectif pédagogique principal est compréhensible.');
    missing.push('Une action observable ou une situation d’utilisation de la compétence.');
  } else {
    earnedPoints += 8;
    present.push('Une intention pédagogique est indiquée.');
    missing.push('La compétence observable que le public devra mobiliser à l’issue de la formation.');
  }

  const criteriaLength = textLength(values.successCriteria);
  if (criteriaLength >= 40) {
    earnedPoints += 8;
    present.push('Des critères observables permettent de vérifier les acquis.');
  } else if (criteriaLength >= 15) {
    earnedPoints += 5;
    present.push('Un premier critère de réussite est fourni.');
    missing.push('Des critères plus précis pour observer ou évaluer la réussite.');
  } else {
    missing.push('Les critères permettant de vérifier que l’objectif pédagogique est atteint.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Formulez ce que le public saura faire et ajoutez des critères concrets permettant d’observer la réussite.',
  };
}

function evaluatePrecisions(values: TrainingValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];

  if (values.deliverableType) {
    earnedPoints += 8;
    present.push(`Le livrable « ${values.deliverableType} » est défini.`);
  } else {
    missing.push('Le type de ressource ou d’activité à produire.');
  }

  const durationLength = textLength(values.duration);
  if (durationLength >= 12) {
    earnedPoints += 6;
    present.push('La durée ou le découpage temporel est précisé.');
  } else {
    earnedPoints += 4;
    present.push('Une durée est indiquée.');
    missing.push('Un découpage ou un rythme plus exploitable.');
  }

  if (values.modality) {
    earnedPoints += 6;
    present.push(`La modalité « ${values.modality} » est prise en compte.`);
  } else {
    missing.push('La modalité de formation.');
  }

  const requiredLength = textLength(values.requiredElements);
  if (requiredLength >= 30) {
    earnedPoints += 7;
    present.push('Les éléments pédagogiques obligatoires sont détaillés.');
  } else if (requiredLength >= 10) {
    earnedPoints += 4;
    present.push('Un élément pédagogique obligatoire est indiqué.');
    missing.push('La liste complète des étapes ou composants attendus.');
  } else {
    missing.push('Les étapes, activités ou composants qui doivent apparaître.');
  }

  const constraintsLength = textLength(values.constraints);
  if (constraintsLength >= 40) {
    earnedPoints += 8;
    present.push('Les contraintes pédagogiques et limites sont clairement définies.');
  } else if (constraintsLength >= 15) {
    earnedPoints += 5;
    present.push('Une première contrainte est indiquée.');
    missing.push('Les limites de matériel, d’accessibilité, de vocabulaire ou de ressources.');
  } else {
    missing.push('Les contraintes, adaptations nécessaires ou éléments à éviter.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez le livrable, la durée, la modalité, les étapes obligatoires et les contraintes de mise en œuvre.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildTrainingPrompt(values: TrainingValues) {
  return [
    '## Contexte',
    `- Besoin de formation : ${values.trainingContext}`,
    `- Public visé : ${values.audience}`,
    `- Niveau de départ : ${values.learnerLevel}`,
    optionalLine('Acquis et prérequis', values.priorKnowledge),
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif pédagogique',
    values.learningObjective,
    optionalLine('Critères de réussite', values.successCriteria),
    '',
    '## Précisions',
    `- Livrable attendu : ${values.deliverableType}`,
    `- Durée ou découpage : ${values.duration}`,
    `- Modalité : ${values.modality}`,
    optionalLine('Éléments obligatoires', values.requiredElements),
    optionalLine('Contraintes et adaptations', values.constraints),
    '',
    '## Consigne finale',
    'Conçois le livrable pédagogique demandé avec une progression adaptée au public. Relie chaque activité à l’objectif, prévois des consignes claires et une vérification des acquis. N’invente aucune donnée absente. Si une information indispensable manque, signale-la avant de proposer le livrable.',
  ].join('\n');
}

export const trainingCategory: StudioCategoryConfig<TrainingValues> = {
  id: 'training',
  label: 'Formation',
  shortDescription: 'Cadrer une activité, une séquence ou une ressource pédagogique adaptée à un public.',
  schema: trainingSchema,
  defaultValues: {
    trainingContext: '',
    audience: '',
    learnerLevel: 'débutant ou hétérogène',
    priorKnowledge: '',
    role: 'un ingénieur pédagogique spécialisé dans la formation des adultes et la mise en pratique progressive',
    learningObjective: '',
    successCriteria: '',
    deliverableType: 'séquence pédagogique structurée avec activités et évaluation',
    duration: 'une séquence de 60 minutes',
    modality: 'formation en présentiel',
    requiredElements: '',
    constraints: '',
  },
  fields: [
    {
      name: 'trainingContext',
      label: 'Décrivez le besoin de formation',
      type: 'textarea',
      cropSection: 'context',
      help: 'Expliquez la situation, le sujet et le besoin professionnel sans citer de personne ou de dossier réel.',
      placeholder: 'Exemple : aider une équipe administrative à organiser et fiabiliser le suivi d’un tableau partagé.',
      required: true,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'audience',
      label: 'Quel est le public visé ?',
      type: 'text',
      cropSection: 'context',
      help: 'Décrivez un groupe, une fonction ou un contexte professionnel, sans identité réelle.',
      placeholder: 'Exemple : adultes en reconversion peu à l’aise avec les outils numériques',
      required: true,
      maxLength: 240,
      autoComplete: 'off',
    },
    {
      name: 'learnerLevel',
      label: 'Niveau de départ',
      type: 'select',
      cropSection: 'context',
      help: 'Choisissez le niveau qui décrit le mieux le groupe au début de la formation.',
      required: true,
      options: [
        { value: 'débutant', label: 'Débutant' },
        { value: 'débutant ou hétérogène', label: 'Débutant ou hétérogène' },
        { value: 'intermédiaire', label: 'Intermédiaire' },
        { value: 'avancé', label: 'Avancé' },
      ],
    },
    {
      name: 'priorKnowledge',
      label: 'Acquis, prérequis ou difficultés de départ',
      type: 'textarea',
      cropSection: 'context',
      help: 'Indiquez les compétences déjà maîtrisées et les difficultés à prendre en compte.',
      placeholder: 'Exemple : sait saisir des données, mais utilise peu les formules et ne connaît pas les tableaux structurés.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez la spécialité, le public accompagné et la posture pédagogique attendue.',
      required: true,
      maxLength: 280,
      autoComplete: 'off',
    },
    {
      name: 'learningObjective',
      label: 'Objectif pédagogique',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Décrivez ce que le public devra être capable de réaliser dans une situation concrète.',
      placeholder: 'Exemple : à l’issue de la séquence, les participants seront capables de construire un tableau de suivi lisible et d’en contrôler les données essentielles.',
      required: true,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'successCriteria',
      label: 'Critères de réussite ou modalités d’évaluation',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Ajoutez des éléments observables permettant de vérifier les acquis.',
      placeholder: 'Exemple : le tableau respecte le modèle, les calculs sont exacts et le participant explique deux contrôles réalisés.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'deliverableType',
      label: 'Livrable pédagogique attendu',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez le type de production que le prompt devra demander.',
      required: true,
      options: [
        { value: 'séquence pédagogique structurée avec activités et évaluation', label: 'Séquence pédagogique complète' },
        { value: 'activité pratique avec consignes, durée et critères de réussite', label: 'Activité pratique' },
        { value: 'plan de formation détaillé avec progression et modalités d’évaluation', label: 'Plan de formation' },
        { value: 'fiche pédagogique directement utilisable par un formateur', label: 'Fiche pédagogique' },
        { value: 'quiz avec réponses expliquées et critères de réussite', label: 'Quiz avec corrigé' },
        { value: 'support synthétique destiné aux participants', label: 'Support pour les participants' },
      ],
    },
    {
      name: 'duration',
      label: 'Durée ou découpage prévu',
      type: 'text',
      cropSection: 'precisions',
      help: 'Indiquez une durée globale ou un découpage en étapes.',
      placeholder: 'Exemple : 90 minutes en trois étapes de 30 minutes',
      required: true,
      maxLength: 120,
      autoComplete: 'off',
    },
    {
      name: 'modality',
      label: 'Modalité de formation',
      type: 'select',
      cropSection: 'precisions',
      help: 'La modalité influence les activités, les consignes et les ressources mobilisables.',
      required: true,
      options: [
        { value: 'formation en présentiel', label: 'Présentiel' },
        { value: 'classe virtuelle à distance', label: 'Classe virtuelle' },
        { value: 'formation asynchrone à distance', label: 'Formation asynchrone' },
        { value: 'parcours mixte présentiel et distance', label: 'Parcours mixte' },
        { value: 'accompagnement individuel', label: 'Accompagnement individuel' },
      ],
    },
    {
      name: 'requiredElements',
      label: 'Étapes et éléments obligatoires',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez les activités, ressources, consignes ou évaluations qui doivent figurer dans le livrable.',
      placeholder: 'Exemple : objectif, démonstration, exercice guidé, mise en pratique autonome, correction et synthèse.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'constraints',
      label: 'Contraintes et adaptations nécessaires',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez les limites de matériel, de temps, d’accessibilité ou de vocabulaire.',
      placeholder: 'Exemple : consignes courtes, documents lisibles au clavier, aucun outil payant et exemples sans données personnelles.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
  ],
  requiredInformation: [
    'Le besoin et le sujet de formation',
    'Le public et son niveau de départ',
    'Le rôle pédagogique attendu',
    'L’objectif pédagogique',
    'Le livrable, la durée et la modalité',
  ],
  buildPrompt: buildTrainingPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision du besoin, du public, de son niveau et de ses acquis de départ.',
      checkpoints: [
        'Besoin : 6, 9 ou 12 points selon le niveau de détail.',
        'Public : 2, 4 ou 6 points selon sa précision.',
        'Niveau sélectionné : 4 points.',
        'Acquis et prérequis : 0, 2 ou 3 points.',
      ],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Précision de la spécialité, de la posture et de la compétence pédagogique attendues.',
      checkpoints: [
        'Rôle court : 8 points.',
        'Rôle précisé : 12 points.',
        'Posture et compétence détaillées : 15 points.',
      ],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté de la compétence visée et présence de critères observables de réussite.',
      checkpoints: [
        'Objectif pédagogique : 8, 13 ou 17 points selon son niveau de détail.',
        'Critères de réussite : 0, 5 ou 8 points selon leur caractère observable.',
      ],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Définition du livrable, de la durée, de la modalité, des étapes et des contraintes.',
      checkpoints: [
        'Livrable défini : 8 points.',
        'Durée : 4 ou 6 points selon sa précision.',
        'Modalité définie : 6 points.',
        'Éléments obligatoires : 0, 4 ou 7 points.',
        'Contraintes : 0, 5 ou 8 points.',
      ],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Décrivez le besoin pédagogique avant de préciser le livrable. Les champs facultatifs renforcent le diagnostic et la vérifiabilité du prompt.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible concernant des participants. Utilisez un public générique, fictif ou anonymisé.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Formation et sur une grille CROP déterministe documentée.',
  },
  beforeAfter: {
    vagueRequest: '« Fais-moi une formation sur Excel. »',
    missingDescription: 'Le public, la compétence visée, la durée, la modalité et le livrable ne sont pas définis.',
    structuredPrompt: '« Contexte : adultes débutants devant fiabiliser un tableau de suivi. Rôle : formateur en bureautique spécialisé dans la pédagogie pour adultes. Objectif : structurer les données, utiliser une formule simple et contrôler le résultat. Précisions : activité de 60 minutes en présentiel, démonstration, exercice guidé et critères de réussite. »',
    benefit: 'La demande relie le public, l’objectif, les activités et l’évaluation attendue.',
  },
  examples: [
    {
      title: 'Activité pratique sur un tableur',
      description: 'Préparer une activité progressive avec consignes et critères de réussite.',
      prompt: `## Contexte
Conçois une activité pour des adultes débutants qui doivent apprendre à fiabiliser un tableau de suivi simple.

## Rôle
Agis comme un formateur en bureautique spécialisé dans la pédagogie pour adultes.

## Objectif pédagogique
À l’issue de l’activité, les participants seront capables de structurer les données, d’utiliser une formule simple et de contrôler le résultat.

## Précisions
Prévois 60 minutes en présentiel, une démonstration courte, un exercice guidé, une mise en pratique autonome et trois critères de réussite. Utilise uniquement des données fictives.`,
    },
    {
      title: 'Quiz sur les usages responsables',
      description: 'Produire un quiz explicatif adapté à une sensibilisation professionnelle.',
      prompt: `## Contexte
Prépare un quiz destiné à des professionnels découvrant les précautions essentielles liées aux outils numériques.

## Rôle
Agis comme un formateur attentif à la compréhension et à l’esprit critique.

## Objectif pédagogique
Permettre aux participants d’identifier les bons réflexes concernant les données sensibles, la vérification et la responsabilité humaine.

## Précisions
Rédige huit questions variées avec réponses expliquées. Prévois un niveau débutant, un vocabulaire accessible et aucun exemple contenant des données personnelles.`,
    },
    {
      title: 'Séquence en classe virtuelle',
      description: 'Structurer une séquence courte et interactive à distance.',
      prompt: `## Contexte
Conçois une séquence à distance pour des adultes en reconversion qui doivent apprendre à rédiger une consigne professionnelle claire.

## Rôle
Agis comme un ingénieur pédagogique spécialisé dans l’animation de classes virtuelles.

## Objectif pédagogique
À l’issue de la séquence, les participants seront capables de structurer une demande avec le Contexte, le Rôle, l’Objectif et les Précisions.

## Précisions
Prévois 45 minutes, une activité toutes les dix minutes, un exemple guidé, un exercice individuel et une correction collective accessible au clavier.`,
    },
  ],
  recommendations: [
    'Formuler l’objectif avec une action observable plutôt qu’avec un verbe vague comme comprendre ou connaître.',
    'Relier les activités, les consignes et l’évaluation au même objectif pédagogique.',
    'Préciser les adaptations nécessaires sans décrire la situation personnelle d’un participant.',
  ],
};
