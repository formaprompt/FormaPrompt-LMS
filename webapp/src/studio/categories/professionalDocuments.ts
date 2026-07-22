import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const professionalDocumentsSchema = z.object({
  documentType: z.string().trim().min(1, 'Choisissez un type de document.'),
  documentContext: z.string().trim().min(20, 'Décrivez le sujet et le contexte en au moins 20 caractères.').max(900, 'Limitez le contexte à 900 caractères.'),
  audience: z.string().trim().min(5, 'Décrivez le destinataire du document.').max(300, 'Limitez le destinataire à 300 caractères.'),
  sourceInformation: z.string().trim().max(900, 'Limitez les informations sources à 900 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(320, 'Limitez le rôle à 320 caractères.'),
  documentObjective: z.string().trim().min(15, 'Décrivez l’objectif du document en au moins 15 caractères.').max(700, 'Limitez l’objectif à 700 caractères.'),
  expectedAction: z.string().trim().max(500, 'Limitez le résultat attendu à 500 caractères.'),
  tone: z.string().trim().min(1, 'Choisissez un ton.'),
  structure: z.string().trim().min(1, 'Choisissez une structure.'),
  length: z.string().trim().min(1, 'Choisissez une longueur.'),
  requiredElements: z.string().trim().max(700, 'Limitez les éléments obligatoires à 700 caractères.'),
  constraints: z.string().trim().max(700, 'Limitez les contraintes à 700 caractères.'),
  verificationCriteria: z.string().trim().max(600, 'Limitez les critères de vérification à 600 caractères.'),
}).strict();

export type ProfessionalDocumentsValues = z.infer<typeof professionalDocumentsSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: ProfessionalDocumentsValues): ScoreRuleResult {
  let earnedPoints = 5;
  const present = [`Le type de document « ${values.documentType} » est défini.`];
  const missing: string[] = [];

  const contextLength = textLength(values.documentContext);
  if (contextLength >= 100) {
    earnedPoints += 10;
    present.push('Le sujet et la situation professionnelle sont décrits avec précision.');
  } else if (contextLength >= 50) {
    earnedPoints += 7;
    present.push('Le sujet et le contexte général sont compréhensibles.');
    missing.push('Les circonstances, enjeux ou informations utiles à la rédaction.');
  } else {
    earnedPoints += 4;
    present.push('Un premier sujet est indiqué.');
    missing.push('Une description plus précise de la situation et de ses enjeux.');
  }

  const audienceLength = textLength(values.audience);
  if (audienceLength >= 30) {
    earnedPoints += 6;
    present.push('Le lecteur ou destinataire est décrit avec suffisamment de précision.');
  } else if (audienceLength >= 12) {
    earnedPoints += 4;
    present.push('Le destinataire principal est indiqué.');
    missing.push('La fonction, le niveau de connaissance ou les attentes du lecteur.');
  } else {
    earnedPoints += 2;
    present.push('Un destinataire est mentionné.');
    missing.push('Une description plus précise du lecteur visé.');
  }

  const sourcesLength = textLength(values.sourceInformation);
  if (sourcesLength >= 50) {
    earnedPoints += 4;
    present.push('Les faits et informations sources sont suffisamment détaillés.');
  } else if (sourcesLength >= 15) {
    earnedPoints += 2;
    present.push('Quelques informations sources sont fournies.');
    missing.push('Les faits, repères ou éléments fiables à reprendre dans le document.');
  } else {
    missing.push('Les informations sources autorisées sur lesquelles appuyer le document.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez le type de document, la situation, le lecteur et les faits autorisés à reprendre, sans copier de donnée sensible.',
  };
}

function evaluateRole(values: ProfessionalDocumentsValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 60) {
    return {
      earnedPoints: 15,
      present: ['La compétence rédactionnelle, la posture et le niveau d’exigence sont clairement définis.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond au document, au lecteur et au contexte professionnel.',
    };
  }
  if (length >= 30) {
    return {
      earnedPoints: 12,
      present: ['Un rôle rédactionnel professionnel est défini.'],
      missing: ['La spécialité, la posture ou le niveau de rigueur attendu.'],
      recommendation: 'Ajoutez le domaine, le type de lecteur et les qualités rédactionnelles attendues.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise et une posture adaptées au type de document.'],
    recommendation: 'Précisez le rôle : expertise métier, capacité de structuration et posture attendue.',
  };
}

function evaluateObjective(values: ProfessionalDocumentsValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const objectiveLength = textLength(values.documentObjective);

  if (objectiveLength >= 80) {
    earnedPoints += 17;
    present.push('L’objectif relie clairement le document à son usage professionnel.');
  } else if (objectiveLength >= 40) {
    earnedPoints += 13;
    present.push('L’objectif principal du document est compréhensible.');
    missing.push('L’usage concret ou la décision que le document doit faciliter.');
  } else {
    earnedPoints += 8;
    present.push('Une intention générale est indiquée.');
    missing.push('Le résultat précis attendu après lecture du document.');
  }

  const expectedActionLength = textLength(values.expectedAction);
  if (expectedActionLength >= 40) {
    earnedPoints += 8;
    present.push('Le résultat, la décision ou l’action attendue après lecture est explicite.');
  } else if (expectedActionLength >= 15) {
    earnedPoints += 5;
    present.push('Une première conséquence attendue est indiquée.');
    missing.push('Une formulation plus observable de la décision ou de l’action attendue.');
  } else {
    missing.push('La décision, la compréhension ou l’action attendue après lecture.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Indiquez à quoi servira le document et ce que le lecteur devra comprendre, décider ou réaliser.',
  };
}

function evaluatePrecisions(values: ProfessionalDocumentsValues): ScoreRuleResult {
  let earnedPoints = 15;
  const present = [
    `Le ton « ${values.tone} » est défini.`,
    `La structure « ${values.structure} » est demandée.`,
    `La longueur « ${values.length} » est précisée.`,
  ];
  const missing: string[] = [];

  const requiredLength = textLength(values.requiredElements);
  if (requiredLength >= 40) {
    earnedPoints += 6;
    present.push('Les sections et informations obligatoires sont détaillées.');
  } else if (requiredLength >= 15) {
    earnedPoints += 4;
    present.push('Un premier élément obligatoire est indiqué.');
    missing.push('La liste complète des sections ou informations indispensables.');
  } else {
    missing.push('Les sections, mentions ou informations qui doivent impérativement apparaître.');
  }

  const constraintsLength = textLength(values.constraints);
  if (constraintsLength >= 40) {
    earnedPoints += 6;
    present.push('Les contraintes et éléments à éviter sont clairement définis.');
  } else if (constraintsLength >= 15) {
    earnedPoints += 4;
    present.push('Une première contrainte est indiquée.');
    missing.push('Les limites de vocabulaire, de confidentialité, de mise en forme ou de contenu.');
  } else {
    missing.push('Les contraintes, limites et éléments à éviter.');
  }

  const criteriaLength = textLength(values.verificationCriteria);
  if (criteriaLength >= 40) {
    earnedPoints += 8;
    present.push('Des critères permettent de relire et vérifier le document.');
  } else if (criteriaLength >= 15) {
    earnedPoints += 5;
    present.push('Un premier critère de vérification est fourni.');
    missing.push('Des critères plus précis de clarté, d’exactitude et d’exhaustivité.');
  } else {
    missing.push('Les critères permettant de contrôler le document avant utilisation.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Définissez le ton, la structure, la longueur, les éléments obligatoires, les contraintes et les critères de relecture.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildProfessionalDocumentPrompt(values: ProfessionalDocumentsValues) {
  return [
    '## Contexte',
    `- Type de document : ${values.documentType}`,
    `- Sujet et situation : ${values.documentContext}`,
    `- Lecteur ou destinataire : ${values.audience}`,
    optionalLine('Informations sources autorisées', values.sourceInformation),
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif',
    values.documentObjective,
    optionalLine('Résultat ou action attendue après lecture', values.expectedAction),
    '',
    '## Précisions',
    `- Ton : ${values.tone}`,
    `- Structure : ${values.structure}`,
    `- Longueur : ${values.length}`,
    optionalLine('Éléments obligatoires', values.requiredElements),
    optionalLine('Contraintes et éléments à éviter', values.constraints),
    optionalLine('Critères de vérification', values.verificationCriteria),
    '',
    '## Consigne finale',
    `Rédige un ${values.documentType} directement exploitable comme base de travail. Hiérarchise clairement l’information, adapte le vocabulaire au lecteur et distingue les faits fournis des éléments restant à confirmer. N’invente aucun chiffre, nom, date, engagement ou source. Signale explicitement toute information indispensable manquante avant de proposer le document.`,
  ].join('\n');
}

export const professionalDocumentsCategory: StudioCategoryConfig<ProfessionalDocumentsValues> = {
  id: 'professional-documents',
  label: 'Documents professionnels',
  shortDescription: 'Cadrer un document professionnel lisible, structuré et vérifiable.',
  schema: professionalDocumentsSchema,
  defaultValues: {
    documentType: 'rapport professionnel',
    documentContext: '',
    audience: '',
    sourceInformation: '',
    role: 'un rédacteur professionnel rigoureux, spécialiste de la structuration de documents clairs et vérifiables',
    documentObjective: '',
    expectedAction: '',
    tone: 'professionnel, clair et factuel',
    structure: 'document structuré avec titres, sous-titres et synthèse finale',
    length: 'longueur intermédiaire, adaptée au sujet',
    requiredElements: '',
    constraints: '',
    verificationCriteria: '',
  },
  fields: [
    {
      name: 'documentType',
      label: 'Type de document',
      type: 'select',
      cropSection: 'context',
      help: 'Choisissez le livrable professionnel à préparer.',
      required: true,
      options: [
        { value: 'rapport professionnel', label: 'Rapport' },
        { value: 'compte rendu structuré', label: 'Compte rendu' },
        { value: 'procédure opérationnelle', label: 'Procédure' },
        { value: 'note de synthèse', label: 'Note de synthèse' },
        { value: 'lettre professionnelle', label: 'Lettre' },
        { value: 'proposition commerciale sobre et argumentée', label: 'Proposition commerciale' },
        { value: 'cahier des charges structuré', label: 'Cahier des charges' },
      ],
    },
    {
      name: 'documentContext',
      label: 'Sujet et contexte du document',
      type: 'textarea',
      cropSection: 'context',
      help: 'Expliquez la situation, le sujet et les enjeux sans identifier une personne ou un dossier réel.',
      placeholder: 'Exemple : formaliser le fonctionnement d’un nouveau processus de validation interne utilisé par plusieurs services.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'audience',
      label: 'Lecteur ou destinataire du document',
      type: 'text',
      cropSection: 'context',
      help: 'Décrivez une fonction, un groupe ou un niveau de connaissance, sans saisir de nom réel.',
      placeholder: 'Exemple : responsables de service découvrant le nouveau processus',
      required: true,
      maxLength: 300,
      autoComplete: 'off',
    },
    {
      name: 'sourceInformation',
      label: 'Informations sources autorisées',
      type: 'textarea',
      cropSection: 'context',
      help: 'Listez uniquement les faits utiles avec des termes génériques. Ne collez aucun document confidentiel.',
      placeholder: 'Exemple : trois étapes de validation, réponse attendue sous deux jours ouvrés et suivi dans un tableau partagé fictif.',
      required: false,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez l’expertise rédactionnelle, le domaine et le niveau de rigueur attendus.',
      required: true,
      maxLength: 320,
      autoComplete: 'off',
    },
    {
      name: 'documentObjective',
      label: 'Objectif du document',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez ce que le document doit permettre de comprendre, décider ou réaliser.',
      placeholder: 'Exemple : expliquer chaque étape du processus afin que les responsables puissent l’appliquer sans ambiguïté.',
      required: true,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'expectedAction',
      label: 'Résultat ou action attendue après lecture',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Décrivez une conséquence observable : validation, décision, mise en œuvre ou compréhension.',
      placeholder: 'Exemple : chaque responsable identifie son étape, le délai à respecter et le canal de suivi.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'tone',
      label: 'Ton du document',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez un ton adapté au lecteur et à l’usage du document.',
      required: true,
      options: [
        { value: 'professionnel, clair et factuel', label: 'Professionnel et factuel' },
        { value: 'formel et institutionnel', label: 'Formel et institutionnel' },
        { value: 'pédagogique et accessible', label: 'Pédagogique et accessible' },
        { value: 'direct et opérationnel', label: 'Direct et opérationnel' },
        { value: 'convaincant, sobre et crédible', label: 'Convaincant et sobre' },
      ],
    },
    {
      name: 'structure',
      label: 'Structure attendue',
      type: 'select',
      cropSection: 'precisions',
      help: 'Indiquez comment organiser la lecture et la hiérarchie de l’information.',
      required: true,
      options: [
        { value: 'document structuré avec titres, sous-titres et synthèse finale', label: 'Titres, sous-titres et synthèse' },
        { value: 'document organisé en contexte, constats, analyse et recommandations', label: 'Constats, analyse et recommandations' },
        { value: 'document organisé en étapes numérotées avec points de contrôle', label: 'Étapes numérotées' },
        { value: 'document court avec objet, message principal et action attendue', label: 'Structure courte et directe' },
        { value: 'document organisé en besoins, exigences, livrables et critères de réception', label: 'Exigences et critères de réception' },
      ],
    },
    {
      name: 'length',
      label: 'Longueur attendue',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez un niveau de détail cohérent avec le document et son usage.',
      required: true,
      options: [
        { value: 'format court, une page maximum', label: 'Court — une page maximum' },
        { value: 'longueur intermédiaire, adaptée au sujet', label: 'Intermédiaire' },
        { value: 'format détaillé avec développement complet', label: 'Détaillé' },
        { value: 'synthèse de 300 mots maximum', label: 'Synthèse — 300 mots maximum' },
      ],
    },
    {
      name: 'requiredElements',
      label: 'Sections et informations obligatoires',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez les parties, mentions ou faits qui doivent impérativement apparaître.',
      placeholder: 'Exemple : objectif, périmètre, responsabilités, étapes, délais, points de contrôle et prochaine révision.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'constraints',
      label: 'Contraintes et éléments à éviter',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez les limites de vocabulaire, de contenu, de confidentialité ou de mise en forme.',
      placeholder: 'Exemple : phrases courtes, aucun jargon non expliqué, aucun engagement juridique et aucune donnée inventée.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'verificationCriteria',
      label: 'Critères de vérification avant utilisation',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Définissez les contrôles à réaliser sur la clarté, l’exactitude et l’exhaustivité.',
      placeholder: 'Exemple : toutes les étapes sont présentes, les responsabilités sont explicites et chaque chiffre correspond aux informations fournies.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
  ],
  requiredInformation: [
    'Le type, le sujet et le contexte du document',
    'Le lecteur ou destinataire',
    'Le rôle rédactionnel attendu',
    'L’objectif du document',
    'Le ton, la structure et la longueur',
  ],
  buildPrompt: buildProfessionalDocumentPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision du type de document, de la situation, du lecteur et des informations sources.',
      checkpoints: [
        'Type de document défini : 5 points.',
        'Sujet et contexte : 4, 7 ou 10 points selon le niveau de détail.',
        'Lecteur : 2, 4 ou 6 points selon sa précision.',
        'Informations sources : 0, 2 ou 4 points.',
      ],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Précision de l’expertise rédactionnelle, de la posture et du niveau de rigueur attendu.',
      checkpoints: [
        'Rôle court : 8 points.',
        'Rôle précisé : 12 points.',
        'Expertise et posture détaillées : 15 points.',
      ],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté de l’usage du document et du résultat attendu après lecture.',
      checkpoints: [
        'Objectif : 8, 13 ou 17 points selon son niveau de détail.',
        'Résultat ou action attendue : 0, 5 ou 8 points.',
      ],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Définition du ton, de la structure, de la longueur, des contenus obligatoires et des contrôles.',
      checkpoints: [
        'Ton, structure et longueur : 15 points.',
        'Éléments obligatoires : 0, 4 ou 6 points.',
        'Contraintes : 0, 4 ou 6 points.',
        'Critères de vérification : 0, 5 ou 8 points.',
      ],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Choisissez le document, décrivez son lecteur et son usage, puis ajoutez les faits autorisés et les règles de rédaction.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. Décrivez les informations utiles avec des termes génériques, sans coller de contrat, de dossier client ni de document interne.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Documents professionnels et sur une grille CROP déterministe documentée.',
  },
  beforeAfter: {
    vagueRequest: '« Fais-moi un rapport sur notre nouvelle procédure. »',
    missingDescription: 'Le lecteur, l’objectif, les faits sources, la structure et les contrôles ne sont pas définis.',
    structuredPrompt: '« Contexte : rapport destiné à des responsables de service sur un processus fictif en trois étapes. Rôle : rédacteur professionnel rigoureux. Objectif : expliquer les responsabilités et faciliter la mise en œuvre. Précisions : ton factuel, titres courts, synthèse finale, aucun chiffre inventé et vérification des délais. »',
    benefit: 'Le document attendu est cadré par son usage, son lecteur, ses sources et des critères de relecture.',
  },
  examples: [
    {
      title: 'Compte rendu opérationnel',
      description: 'Transformer des notes sans donnée personnelle en décisions, actions, responsables par fonction et échéances.',
      prompt: 'Prépare un compte rendu structuré pour une équipe projet. Distingue les décisions, les actions, les responsables par fonction et les échéances fictives. Signale toute information absente.',
    },
    {
      title: 'Procédure interne',
      description: 'Formaliser des étapes, responsabilités, contrôles et cas particuliers.',
      prompt: 'Rédige une procédure opérationnelle en étapes numérotées. Pour chaque étape, précise le rôle responsable, le résultat attendu et le point de contrôle. N’invente aucune règle.',
    },
    {
      title: 'Cahier des charges',
      description: 'Organiser un besoin, des exigences, des livrables et des critères de réception.',
      prompt: 'Structure un cahier des charges avec contexte, périmètre, besoins, exigences, livrables et critères de réception. Fais apparaître les informations restant à confirmer.',
    },
  ],
  recommendations: [
    'Remplacez les noms, coordonnées et informations sensibles par des formulations génériques avant la saisie.',
    'Séparez clairement les faits fournis, les hypothèses et les informations à confirmer.',
    'Faites relire le document par une personne compétente avant toute décision, signature ou diffusion.',
  ],
};
