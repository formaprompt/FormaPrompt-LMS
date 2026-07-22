import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const analysisSynthesisSchema = z.object({
  analysisContext: z.string().trim().min(20, 'Décrivez le sujet et le contexte en au moins 20 caractères.').max(900, 'Limitez le contexte à 900 caractères.'),
  sourceType: z.string().trim().min(1, 'Choisissez un type de sources.'),
  sourceScope: z.string().trim().max(700, 'Limitez le périmètre des sources à 700 caractères.'),
  audience: z.string().trim().min(5, 'Décrivez le destinataire de la synthèse.').max(300, 'Limitez le destinataire à 300 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(340, 'Limitez le rôle à 340 caractères.'),
  mainQuestion: z.string().trim().min(15, 'Formulez la question principale en au moins 15 caractères.').max(700, 'Limitez la question à 700 caractères.'),
  decisionUse: z.string().trim().max(500, 'Limitez l’usage attendu à 500 caractères.'),
  analysisMode: z.string().trim().min(1, 'Choisissez un type d’analyse.'),
  analysisCriteria: z.string().trim().max(700, 'Limitez les axes d’analyse à 700 caractères.'),
  outputFormat: z.string().trim().min(1, 'Choisissez un format de restitution.'),
  detailLevel: z.string().trim().min(1, 'Choisissez un niveau de détail.'),
  traceability: z.string().trim().min(1, 'Choisissez une règle de traçabilité.'),
  uncertainties: z.string().trim().max(600, 'Limitez les incertitudes à 600 caractères.'),
  constraints: z.string().trim().max(700, 'Limitez les contraintes à 700 caractères.'),
}).strict();

export type AnalysisSynthesisValues = z.infer<typeof analysisSynthesisSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: AnalysisSynthesisValues): ScoreRuleResult {
  let earnedPoints = 4;
  const present = [`Le type de sources « ${values.sourceType} » est défini.`];
  const missing: string[] = [];

  const contextLength = textLength(values.analysisContext);
  if (contextLength >= 90) {
    earnedPoints += 10;
    present.push('Le sujet, la situation et les enjeux de l’analyse sont détaillés.');
  } else if (contextLength >= 45) {
    earnedPoints += 7;
    present.push('Le sujet et son contexte général sont compréhensibles.');
    missing.push('Les enjeux, circonstances ou limites générales de l’analyse.');
  } else {
    earnedPoints += 4;
    present.push('Un premier sujet d’analyse est indiqué.');
    missing.push('Une description plus précise du sujet et de la situation.');
  }

  const scopeLength = textLength(values.sourceScope);
  if (scopeLength >= 40) {
    earnedPoints += 6;
    present.push('Le périmètre, la période ou la composition des sources sont précisés.');
  } else if (scopeLength >= 15) {
    earnedPoints += 4;
    present.push('Un premier périmètre de sources est indiqué.');
    missing.push('La période, les exclusions ou la couverture exacte des sources.');
  } else {
    missing.push('Le périmètre, la période et les limites des sources à examiner.');
  }

  const audienceLength = textLength(values.audience);
  if (audienceLength >= 25) {
    earnedPoints += 5;
    present.push('Le destinataire et son besoin de compréhension sont précisés.');
  } else if (audienceLength >= 12) {
    earnedPoints += 3;
    present.push('Le destinataire principal est indiqué.');
    missing.push('La fonction, le niveau de connaissance ou les attentes du destinataire.');
  } else {
    earnedPoints += 2;
    present.push('Un destinataire est mentionné.');
    missing.push('Une description plus précise du lecteur de la synthèse.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Décrivez le sujet, le type de sources, leur périmètre et le destinataire sans coller de contenu sensible.',
  };
}

function evaluateRole(values: AnalysisSynthesisValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 60) {
    return {
      earnedPoints: 15,
      present: ['La compétence d’analyse, la posture critique et l’exigence de traçabilité sont clairement définies.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond au domaine, aux sources et au destinataire.',
    };
  }
  if (length >= 30) {
    return {
      earnedPoints: 12,
      present: ['Un rôle d’analyse professionnelle est défini.'],
      missing: ['La spécialité, la posture critique ou la règle de prudence attendue.'],
      recommendation: 'Ajoutez le domaine, le niveau de recul critique et l’obligation de distinguer faits et interprétations.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise et une posture adaptées au travail d’analyse.'],
    recommendation: 'Précisez le rôle : domaine, méthode d’analyse, neutralité et exigence de traçabilité.',
  };
}

function evaluateObjective(values: AnalysisSynthesisValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const questionLength = textLength(values.mainQuestion);

  if (questionLength >= 70) {
    earnedPoints += 17;
    present.push('La question d’analyse est précise et oriente clairement le travail attendu.');
  } else if (questionLength >= 35) {
    earnedPoints += 13;
    present.push('La question principale est compréhensible.');
    missing.push('L’angle exact, la comparaison ou la conclusion recherchée.');
  } else {
    earnedPoints += 8;
    present.push('Une première question est formulée.');
    missing.push('Une question plus précise permettant de cadrer l’analyse.');
  }

  const useLength = textLength(values.decisionUse);
  if (useLength >= 40) {
    earnedPoints += 8;
    present.push('L’usage de la synthèse et la décision qu’elle doit éclairer sont explicites.');
  } else if (useLength >= 15) {
    earnedPoints += 5;
    present.push('Un premier usage de la synthèse est indiqué.');
    missing.push('La décision, la compréhension ou l’action que la synthèse doit faciliter.');
  } else {
    missing.push('L’usage concret de la synthèse après sa lecture.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Formulez une question précise et indiquez la décision ou la compréhension que la synthèse doit éclairer.',
  };
}

function evaluatePrecisions(values: AnalysisSynthesisValues): ScoreRuleResult {
  let earnedPoints = 14;
  const present = [
    `Le type d’analyse « ${values.analysisMode} » est défini.`,
    `Le format « ${values.outputFormat} » est demandé.`,
    `Le niveau de détail « ${values.detailLevel} » est précisé.`,
  ];
  const missing: string[] = [];

  const criteriaLength = textLength(values.analysisCriteria);
  if (criteriaLength >= 40) {
    earnedPoints += 7;
    present.push('Les critères ou axes d’analyse sont détaillés.');
  } else if (criteriaLength >= 15) {
    earnedPoints += 4;
    present.push('Un premier axe d’analyse est indiqué.');
    missing.push('La liste complète des critères de comparaison ou de lecture.');
  } else {
    missing.push('Les critères, thèmes ou axes qui doivent guider l’analyse.');
  }

  if (values.traceability) {
    earnedPoints += 5;
    present.push(`La traçabilité demandée est « ${values.traceability} ».`);
  } else {
    missing.push('La manière de rattacher les constats aux sources.');
  }

  const uncertaintiesLength = textLength(values.uncertainties);
  if (uncertaintiesLength >= 30) {
    earnedPoints += 5;
    present.push('Les incertitudes et contradictions à signaler sont précisées.');
  } else if (uncertaintiesLength >= 10) {
    earnedPoints += 3;
    present.push('Une première incertitude est signalée.');
    missing.push('Les données absentes, contradictoires ou insuffisantes à isoler.');
  } else {
    missing.push('Les incertitudes, contradictions et limites à faire apparaître.');
  }

  const constraintsLength = textLength(values.constraints);
  if (constraintsLength >= 30) {
    earnedPoints += 4;
    present.push('Les contraintes de restitution et les éléments à éviter sont définis.');
  } else if (constraintsLength >= 10) {
    earnedPoints += 2;
    present.push('Une première contrainte est indiquée.');
    missing.push('Les limites de vocabulaire, de longueur, de recommandation ou d’interprétation.');
  } else {
    missing.push('Les contraintes de restitution et les éléments à éviter.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez les axes, le format, la traçabilité, les incertitudes et les limites de la restitution.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildAnalysisSynthesisPrompt(values: AnalysisSynthesisValues) {
  return [
    '## Contexte',
    `- Sujet et situation : ${values.analysisContext}`,
    `- Type de sources : ${values.sourceType}`,
    optionalLine('Périmètre et période', values.sourceScope),
    `- Destinataire : ${values.audience}`,
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif d’analyse',
    `- Question principale : ${values.mainQuestion}`,
    optionalLine('Usage attendu de la synthèse', values.decisionUse),
    '',
    '## Précisions',
    `- Type d’analyse : ${values.analysisMode}`,
    optionalLine('Critères et axes d’analyse', values.analysisCriteria),
    `- Format de restitution : ${values.outputFormat}`,
    `- Niveau de détail : ${values.detailLevel}`,
    `- Traçabilité : ${values.traceability}`,
    optionalLine('Incertitudes et contradictions', values.uncertainties),
    optionalLine('Contraintes et éléments à éviter', values.constraints),
    '',
    '## Méthode de travail attendue',
    '1. Vérifie que les sources annoncées et leur périmètre permettent de répondre à la question.',
    '2. Distingue explicitement les faits présents dans les sources, les interprétations et les informations manquantes.',
    '3. Regroupe les constats selon les axes demandés et rattache-les aux sources conformément à la règle de traçabilité.',
    '4. Signale les contradictions, les limites et le niveau d’incertitude sans chercher à les masquer.',
    '5. Produis la restitution demandée sans inventer de chiffre, citation, cause, source ou conclusion.',
  ].join('\n');
}

export const analysisSynthesisCategory: StudioCategoryConfig<AnalysisSynthesisValues> = {
  id: 'analysis-synthesis',
  label: 'Analyse et synthèse',
  shortDescription: 'Cadrer l’examen de sources et obtenir une synthèse structurée, prudente et traçable.',
  schema: analysisSynthesisSchema,
  defaultValues: {
    analysisContext: '',
    sourceType: 'plusieurs documents ou notes textuelles',
    sourceScope: '',
    audience: '',
    role: 'un analyste professionnel rigoureux, neutre et attentif à la traçabilité des constats et aux limites des sources',
    mainQuestion: '',
    decisionUse: '',
    analysisMode: 'analyse thématique structurée',
    analysisCriteria: '',
    outputFormat: 'synthèse structurée avec constats, points de vigilance et conclusion',
    detailLevel: 'niveau intermédiaire avec explications courtes',
    traceability: 'rattacher chaque constat important à la source ou à la section correspondante',
    uncertainties: '',
    constraints: '',
  },
  fields: [
    {
      name: 'analysisContext',
      label: 'Sujet et contexte de l’analyse',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez la situation, le sujet et les enjeux sans citer de personne, d’entreprise ou de dossier réel.',
      placeholder: 'Exemple : comparer plusieurs retours sans donnée permettant d’identifier une personne afin de repérer les difficultés récurrentes.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'sourceType',
      label: 'Type de sources à examiner',
      type: 'select',
      cropSection: 'context',
      help: 'Choisissez la nature principale des informations qui seront analysées ultérieurement.',
      required: true,
      options: [
        { value: 'un document textuel unique', label: 'Un document textuel' },
        { value: 'plusieurs documents ou notes textuelles', label: 'Plusieurs documents ou notes' },
        { value: 'un tableau ou des données structurées', label: 'Tableau ou données structurées' },
        { value: 'des réponses à un questionnaire sans donnée personnelle', label: 'Questionnaire sans donnée personnelle' },
        { value: 'des comptes rendus ou observations sans donnée personnelle', label: 'Comptes rendus ou observations' },
        { value: 'des sources de formats différents', label: 'Sources de formats différents' },
      ],
    },
    {
      name: 'sourceScope',
      label: 'Périmètre, période et limites des sources',
      type: 'textarea',
      cropSection: 'context',
      help: 'Précisez ce qui est couvert, la période et les exclusions, sans coller le contenu source réel.',
      placeholder: 'Exemple : cinq retours recueillis sur un mois, limités à la phase de validation et sans donnée permettant d’identifier une personne.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'audience',
      label: 'Destinataire de la synthèse',
      type: 'text',
      cropSection: 'context',
      help: 'Décrivez une fonction ou un groupe et son niveau de connaissance, sans saisir d’identité réelle.',
      placeholder: 'Exemple : responsables pédagogiques connaissant le processus mais pas les retours détaillés',
      required: true,
      maxLength: 300,
      autoComplete: 'off',
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez le domaine, la méthode, la neutralité et l’exigence de traçabilité attendues.',
      required: true,
      maxLength: 340,
      autoComplete: 'off',
    },
    {
      name: 'mainQuestion',
      label: 'Question principale à traiter',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Formulez la question, la comparaison ou le problème auquel la synthèse doit répondre.',
      placeholder: 'Exemple : quelles difficultés reviennent le plus souvent, à quelles étapes apparaissent-elles et quels points nécessitent une clarification ?',
      required: true,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'decisionUse',
      label: 'Usage attendu de la synthèse',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez la décision, la compréhension ou l’action que cette synthèse doit faciliter.',
      placeholder: 'Exemple : prioriser les explications à revoir avant la prochaine diffusion de la procédure.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'analysisMode',
      label: 'Type d’analyse',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez la méthode générale la plus adaptée à la question.',
      required: true,
      options: [
        { value: 'analyse thématique structurée', label: 'Analyse thématique' },
        { value: 'analyse comparative avec similitudes et différences', label: 'Analyse comparative' },
        { value: 'analyse critique des arguments, preuves et limites', label: 'Analyse critique' },
        { value: 'analyse des risques, causes possibles et conséquences', label: 'Analyse des risques' },
        { value: 'analyse des tendances, évolutions et signaux faibles', label: 'Analyse des tendances' },
        { value: 'extraction factuelle sans interprétation supplémentaire', label: 'Extraction factuelle' },
      ],
    },
    {
      name: 'analysisCriteria',
      label: 'Critères ou axes d’analyse',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez les thèmes, critères de comparaison ou dimensions à examiner systématiquement.',
      placeholder: 'Exemple : fréquence, étape concernée, impact sur le délai, clarté de la consigne et solution déjà proposée.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'outputFormat',
      label: 'Format de restitution',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez l’organisation qui rendra la synthèse la plus utile au destinataire.',
      required: true,
      options: [
        { value: 'synthèse structurée avec constats, points de vigilance et conclusion', label: 'Synthèse structurée' },
        { value: 'résumé exécutif avec messages essentiels et décision à éclairer', label: 'Résumé exécutif' },
        { value: 'tableau comparatif avec critères, constats et sources', label: 'Tableau comparatif' },
        { value: 'liste hiérarchisée des constats avec recommandations prudentes', label: 'Constats hiérarchisés' },
        { value: 'note de synthèse avec introduction, développement et conclusion', label: 'Note de synthèse' },
      ],
    },
    {
      name: 'detailLevel',
      label: 'Niveau de détail',
      type: 'select',
      cropSection: 'precisions',
      help: 'Adaptez la profondeur de la restitution au temps de lecture et au besoin du destinataire.',
      required: true,
      options: [
        { value: 'très concis avec cinq constats maximum', label: 'Très concis' },
        { value: 'niveau intermédiaire avec explications courtes', label: 'Intermédiaire' },
        { value: 'détaillé avec justification de chaque constat', label: 'Détaillé' },
      ],
    },
    {
      name: 'traceability',
      label: 'Traçabilité des constats',
      type: 'select',
      cropSection: 'precisions',
      help: 'Indiquez comment retrouver l’origine de chaque constat important.',
      required: true,
      options: [
        { value: 'rattacher chaque constat important à la source ou à la section correspondante', label: 'Source ou section pour chaque constat' },
        { value: 'indiquer les sources à la fin de chaque partie', label: 'Sources à la fin de chaque partie' },
        { value: 'utiliser un tableau séparant constat, preuve et source', label: 'Tableau constat, preuve et source' },
        { value: 'reprendre uniquement les repères déjà présents dans les sources', label: 'Repères présents dans les sources' },
      ],
    },
    {
      name: 'uncertainties',
      label: 'Incertitudes et contradictions à signaler',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez les informations insuffisantes, contradictoires ou difficiles à comparer.',
      placeholder: 'Exemple : signaler les thèmes présents dans une seule source, les périodes non comparables et les causes non démontrées.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'constraints',
      label: 'Contraintes et éléments à éviter',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez les limites de longueur, de vocabulaire, d’interprétation ou de recommandation.',
      placeholder: 'Exemple : moins de 800 mots, aucun jargon, aucune cause supposée et aucune recommandation sans appui dans les sources.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
  ],
  requiredInformation: [
    'Le sujet, le type de sources et leur périmètre',
    'Le destinataire de la synthèse',
    'Le rôle et la posture d’analyse',
    'La question principale',
    'Le type d’analyse, le format et la traçabilité',
  ],
  buildPrompt: buildAnalysisSynthesisPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision du sujet, du type de sources, de leur périmètre et du destinataire.',
      checkpoints: [
        'Sujet et contexte : 4, 7 ou 10 points.',
        'Type de sources défini : 4 points.',
        'Périmètre et période : 0, 4 ou 6 points.',
        'Destinataire : 2, 3 ou 5 points.',
      ],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Précision de l’expertise, de la posture critique et de l’exigence de traçabilité.',
      checkpoints: ['Rôle court : 8 points.', 'Rôle précisé : 12 points.', 'Posture complète : 15 points.'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté de la question d’analyse et de l’usage attendu de la synthèse.',
      checkpoints: ['Question principale : 8, 13 ou 17 points.', 'Usage attendu : 0, 5 ou 8 points.'],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Définition des axes, du format, de la traçabilité, des incertitudes et des limites.',
      checkpoints: [
        'Type d’analyse, format et niveau de détail : 14 points.',
        'Axes d’analyse : 0, 4 ou 7 points.',
        'Traçabilité : 5 points.',
        'Incertitudes : 0, 3 ou 5 points.',
        'Contraintes : 0, 2 ou 4 points.',
      ],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Décrivez les sources sans les coller, formulez une question précise et imposez une restitution qui distingue les faits, les interprétations et les limites.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. Décrivez les sources avec des termes génériques, sans coller de rapport, d’entretien, de questionnaire ni de jeu de données.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Analyse et synthèse et sur une grille CROP déterministe documentée.',
  },
  beforeAfter: {
    vagueRequest: '« Analyse ces documents et fais-moi un résumé. »',
    missingDescription: 'La question, le périmètre, les axes, le destinataire, la traçabilité et le traitement des contradictions ne sont pas définis.',
    structuredPrompt: '« Contexte : cinq retours sans donnée personnelle sur une procédure d’exemple. Rôle : analyste neutre et rigoureux. Objectif : identifier les difficultés récurrentes pour prioriser les explications à revoir. Précisions : analyse thématique, axes fréquence et impact, synthèse structurée, source associée à chaque constat et contradictions signalées. »',
    benefit: 'La synthèse attendue repose sur une question, des axes et des règles de traçabilité contrôlables.',
  },
  examples: [
    {
      title: 'Synthèse de plusieurs documents',
      description: 'Faire ressortir les convergences, les divergences et les informations manquantes.',
      prompt: 'Compare plusieurs documents fictifs selon des axes définis. Sépare les convergences, les divergences et les informations absentes. Rattache chaque constat à sa source.',
    },
    {
      title: 'Analyse de retours sans donnée personnelle',
      description: 'Regrouper des difficultés par thème sans généraliser au-delà des données.',
      prompt: 'Analyse les retours fournis par thème, fréquence et impact. Signale les cas isolés et ne déduis aucune cause qui ne figure pas dans les sources.',
    },
    {
      title: 'Résumé exécutif',
      description: 'Préparer une lecture courte orientée vers une décision clairement définie.',
      prompt: 'Produis un résumé exécutif distinguant faits, points de vigilance et décision à éclairer. Limite-toi aux informations fournies et indique les incertitudes.',
    },
  ],
  recommendations: [
    'Décrivez les sources dans le Studio, puis ajoutez leur contenu uniquement dans un environnement autorisé et sécurisé.',
    'Demandez toujours de distinguer les faits, les interprétations et les informations manquantes.',
    'Vérifiez les sources et les conclusions avant toute décision, diffusion ou recommandation.',
  ],
};
