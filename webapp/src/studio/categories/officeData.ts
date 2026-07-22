import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const officeDataSchema = z.object({
  officeContext: z.string().trim().min(20, 'Décrivez la situation en au moins 20 caractères.').max(900, 'Limitez le contexte à 900 caractères.'),
  tool: z.string().trim().min(1, 'Choisissez un outil.'),
  sourceDescription: z.string().trim().min(15, 'Décrivez le document ou les données de départ.').max(900, 'Limitez la description à 900 caractères.'),
  userLevel: z.string().trim().min(1, 'Choisissez un niveau utilisateur.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(340, 'Limitez le rôle à 340 caractères.'),
  taskObjective: z.string().trim().min(15, 'Décrivez le résultat attendu en au moins 15 caractères.').max(700, 'Limitez l’objectif à 700 caractères.'),
  successCriteria: z.string().trim().max(600, 'Limitez les critères de réussite à 600 caractères.'),
  taskType: z.string().trim().min(1, 'Choisissez un type de tâche.'),
  outputFormat: z.string().trim().min(1, 'Choisissez un format de réponse.'),
  guidanceLevel: z.string().trim().min(1, 'Choisissez un niveau d’accompagnement.'),
  structureRules: z.string().trim().max(700, 'Limitez les règles de structure à 700 caractères.'),
  localeSettings: z.string().trim().min(1, 'Choisissez les paramètres régionaux.'),
  constraints: z.string().trim().max(700, 'Limitez les contraintes à 700 caractères.'),
  verificationMethod: z.string().trim().max(600, 'Limitez les contrôles à 600 caractères.'),
}).strict();

export type OfficeDataValues = z.infer<typeof officeDataSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: OfficeDataValues): ScoreRuleResult {
  let earnedPoints = 8;
  const present = [
    `L’outil « ${values.tool} » est défini.`,
    `Le niveau « ${values.userLevel} » est pris en compte.`,
  ];
  const missing: string[] = [];

  const contextLength = textLength(values.officeContext);
  if (contextLength >= 90) {
    earnedPoints += 10;
    present.push('La situation professionnelle et ses enjeux sont détaillés.');
  } else if (contextLength >= 45) {
    earnedPoints += 7;
    present.push('La situation générale est compréhensible.');
    missing.push('L’usage professionnel, la difficulté ou les enjeux de la tâche.');
  } else {
    earnedPoints += 4;
    present.push('Une première situation est indiquée.');
    missing.push('Une description plus précise du besoin et de son contexte.');
  }

  const sourceLength = textLength(values.sourceDescription);
  if (sourceLength >= 70) {
    earnedPoints += 7;
    present.push('La structure du document ou des données de départ est détaillée.');
  } else if (sourceLength >= 35) {
    earnedPoints += 5;
    present.push('Le document ou les données de départ sont compréhensibles.');
    missing.push('Les colonnes, feuilles, sections, formats ou exemples fictifs utiles.');
  } else {
    earnedPoints += 3;
    present.push('Une source de départ est décrite.');
    missing.push('Une description plus précise de la structure des données ou du document.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez la situation, l’outil, le niveau utilisateur et la structure du document ou des données, sans coller de fichier réel.',
  };
}

function evaluateRole(values: OfficeDataValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 60) {
    return {
      earnedPoints: 15,
      present: ['L’expertise bureautique, la posture pédagogique et l’attention portée à la fiabilité sont définies.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond à l’outil, au niveau et à la tâche.',
    };
  }
  if (length >= 30) {
    return {
      earnedPoints: 12,
      present: ['Un rôle bureautique adapté est défini.'],
      missing: ['La spécialité, le niveau d’accompagnement ou l’exigence de fiabilité.'],
      recommendation: 'Ajoutez la spécialité de l’outil, le niveau du public et la nécessité de vérifier chaque résultat.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise et une posture adaptées à l’outil et au niveau utilisateur.'],
    recommendation: 'Précisez le rôle : outil maîtrisé, type de tâche, pédagogie et contrôles attendus.',
  };
}

function evaluateObjective(values: OfficeDataValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const objectiveLength = textLength(values.taskObjective);

  if (objectiveLength >= 70) {
    earnedPoints += 17;
    present.push('Le résultat attendu est précis et relié à un usage concret.');
  } else if (objectiveLength >= 35) {
    earnedPoints += 13;
    present.push('Le résultat principal est compréhensible.');
    missing.push('Le livrable exact ou l’usage concret du résultat.');
  } else {
    earnedPoints += 8;
    present.push('Une intention générale est indiquée.');
    missing.push('Un résultat observable et directement vérifiable.');
  }

  const criteriaLength = textLength(values.successCriteria);
  if (criteriaLength >= 40) {
    earnedPoints += 8;
    present.push('Des critères permettent de vérifier que la tâche est réussie.');
  } else if (criteriaLength >= 15) {
    earnedPoints += 5;
    present.push('Un premier critère de réussite est indiqué.');
    missing.push('Des contrôles plus précis sur l’exactitude, la lisibilité ou la reproductibilité.');
  } else {
    missing.push('Les critères permettant de confirmer que le résultat est correct.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Décrivez le résultat observable et les contrôles qui permettront de confirmer son exactitude.',
  };
}

function evaluatePrecisions(values: OfficeDataValues): ScoreRuleResult {
  let earnedPoints = 18;
  const present = [
    `Le type de tâche « ${values.taskType} » est défini.`,
    `Le format de réponse « ${values.outputFormat} » est demandé.`,
    `Le niveau d’accompagnement « ${values.guidanceLevel} » est précisé.`,
    `Les paramètres « ${values.localeSettings} » sont pris en compte.`,
  ];
  const missing: string[] = [];

  const rulesLength = textLength(values.structureRules);
  if (rulesLength >= 40) {
    earnedPoints += 6;
    present.push('Les règles de structure, de calcul ou de mise en forme sont détaillées.');
  } else if (rulesLength >= 15) {
    earnedPoints += 4;
    present.push('Une première règle de structure est indiquée.');
    missing.push('Les colonnes, plages, sections, formules ou règles de présentation complètes.');
  } else {
    missing.push('Les règles de structure, de calcul ou de mise en forme à respecter.');
  }

  const constraintsLength = textLength(values.constraints);
  if (constraintsLength >= 35) {
    earnedPoints += 5;
    present.push('Les contraintes techniques et les éléments à éviter sont clairement définis.');
  } else if (constraintsLength >= 12) {
    earnedPoints += 3;
    present.push('Une première contrainte est indiquée.');
    missing.push('Les limites de version, de fonctions, de sécurité ou de modification des données.');
  } else {
    missing.push('Les contraintes techniques et les éléments à éviter.');
  }

  const verificationLength = textLength(values.verificationMethod);
  if (verificationLength >= 40) {
    earnedPoints += 6;
    present.push('La méthode de vérification et les cas de contrôle sont détaillés.');
  } else if (verificationLength >= 15) {
    earnedPoints += 4;
    present.push('Un premier contrôle est prévu.');
    missing.push('Les tests, valeurs attendues ou cas limites permettant de valider le résultat.');
  } else {
    missing.push('La méthode de vérification et les cas de test à appliquer.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez les règles, les contraintes, les paramètres régionaux et les contrôles à effectuer avant utilisation.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildOfficeDataPrompt(values: OfficeDataValues) {
  return [
    '## Contexte',
    `- Situation : ${values.officeContext}`,
    `- Outil et environnement : ${values.tool}`,
    `- Document ou données de départ : ${values.sourceDescription}`,
    `- Niveau utilisateur : ${values.userLevel}`,
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif',
    `- Résultat attendu : ${values.taskObjective}`,
    optionalLine('Critères de réussite', values.successCriteria),
    '',
    '## Précisions',
    `- Type de tâche : ${values.taskType}`,
    `- Format de réponse : ${values.outputFormat}`,
    `- Niveau d’accompagnement : ${values.guidanceLevel}`,
    `- Paramètres régionaux : ${values.localeSettings}`,
    optionalLine('Règles de structure, de calcul ou de mise en forme', values.structureRules),
    optionalLine('Contraintes et éléments à éviter', values.constraints),
    optionalLine('Méthode de vérification', values.verificationMethod),
    '',
    '## Consigne finale',
    'Propose une solution progressive et compatible avec l’outil indiqué. N’invente aucun nom de colonne, valeur, feuille, plage, fonction ou résultat absent de la description. Si une information manque, pose les questions nécessaires avant de proposer la solution. Travaille sur une copie, explique les opérations risquées et prévois des contrôles permettant de vérifier chaque résultat.',
  ].join('\n');
}

export const officeDataCategory: StudioCategoryConfig<OfficeDataValues> = {
  id: 'office-data',
  label: 'Bureautique et données',
  shortDescription: 'Cadrer une tâche bureautique, un traitement de données ou une automatisation vérifiable.',
  schema: officeDataSchema,
  defaultValues: {
    officeContext: '',
    tool: 'Microsoft Excel pour Microsoft 365',
    sourceDescription: '',
    userLevel: 'débutant ou occasionnel',
    role: 'un formateur expert en bureautique, pédagogue, rigoureux et attentif à la fiabilité des données et des résultats',
    taskObjective: '',
    successCriteria: '',
    taskType: 'nettoyage et préparation de données',
    outputFormat: 'procédure pas à pas avec exemples fictifs',
    guidanceLevel: 'explications détaillées pour une personne débutante',
    structureRules: '',
    localeSettings: 'paramètres français avec dates jour/mois/année et séparateur de fonctions point-virgule',
    constraints: '',
    verificationMethod: '',
  },
  fields: [
    {
      name: 'officeContext',
      label: 'Situation et besoin bureautique',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez la tâche et son usage professionnel sans identifier une personne, une entreprise ou un dossier réel.',
      placeholder: 'Exemple : fiabiliser un tableau de suivi fictif afin de réduire les erreurs de saisie et faciliter le contrôle mensuel.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'tool',
      label: 'Outil et version visés',
      type: 'select',
      cropSection: 'context',
      help: 'La version influence les menus, les fonctions et les possibilités d’automatisation.',
      required: true,
      options: [
        { value: 'Microsoft Excel pour Microsoft 365', label: 'Excel Microsoft 365' },
        { value: 'Microsoft Excel 2021 ou 2019', label: 'Excel 2021 ou 2019' },
        { value: 'Google Sheets dans un navigateur', label: 'Google Sheets' },
        { value: 'Microsoft Word pour Microsoft 365', label: 'Word Microsoft 365' },
        { value: 'Microsoft PowerPoint pour Microsoft 365', label: 'PowerPoint Microsoft 365' },
        { value: 'LibreOffice Calc, Writer ou Impress', label: 'LibreOffice' },
        { value: 'autre outil bureautique à préciser', label: 'Autre outil' },
      ],
    },
    {
      name: 'sourceDescription',
      label: 'Structure du document ou des données de départ',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez les feuilles, colonnes, sections ou formats avec des exemples fictifs, sans coller de données réelles.',
      placeholder: 'Exemple : une feuille Suivi avec les colonnes Date, Catégorie, Statut et Montant fictif ; une ligne par opération.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'userLevel',
      label: 'Niveau de la personne utilisatrice',
      type: 'select',
      cropSection: 'context',
      help: 'Le niveau détermine le vocabulaire, le détail des étapes et les raccourcis proposés.',
      required: true,
      options: [
        { value: 'débutant ou occasionnel', label: 'Débutant ou occasionnel' },
        { value: 'intermédiaire et autonome sur les fonctions courantes', label: 'Intermédiaire' },
        { value: 'avancé et à l’aise avec les fonctions complexes', label: 'Avancé' },
      ],
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez l’outil maîtrisé, la posture pédagogique et l’exigence de fiabilité.',
      required: true,
      maxLength: 340,
      autoComplete: 'off',
    },
    {
      name: 'taskObjective',
      label: 'Résultat attendu',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Décrivez ce qui doit être obtenu et l’usage concret qui en sera fait.',
      placeholder: 'Exemple : créer une liste contrôlée pour le statut, signaler les doublons et produire un total mensuel vérifiable.',
      required: true,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'successCriteria',
      label: 'Critères de réussite',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Ajoutez des contrôles observables sur l’exactitude, la lisibilité et la reproductibilité.',
      placeholder: 'Exemple : aucune valeur hors liste, doublons clairement signalés et total identique à un calcul manuel sur un échantillon fictif.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'taskType',
      label: 'Type de tâche',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez la nature principale de la solution recherchée.',
      required: true,
      options: [
        { value: 'nettoyage et préparation de données', label: 'Nettoyage et préparation des données' },
        { value: 'création ou correction de formules', label: 'Formules et calculs' },
        { value: 'analyse de données et indicateurs', label: 'Analyse et indicateurs' },
        { value: 'tableau croisé dynamique ou synthèse équivalente', label: 'Tableau croisé ou synthèse' },
        { value: 'graphique ou visualisation de données', label: 'Graphique ou visualisation' },
        { value: 'mise en forme et structuration d’un document', label: 'Mise en forme d’un document' },
        { value: 'automatisation par macro, script ou fonctionnalité intégrée', label: 'Automatisation' },
        { value: 'diagnostic et correction d’un dysfonctionnement', label: 'Diagnostic et correction' },
      ],
    },
    {
      name: 'outputFormat',
      label: 'Format de réponse attendu',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez la forme la plus directement utilisable pour réaliser la tâche.',
      required: true,
      options: [
        { value: 'procédure pas à pas avec exemples fictifs', label: 'Procédure pas à pas' },
        { value: 'formule ou expression exacte avec explication de chaque partie', label: 'Formule expliquée' },
        { value: 'plan de tableau ou de document avec structure détaillée', label: 'Structure détaillée' },
        { value: 'diagnostic avec causes possibles et vérifications successives', label: 'Diagnostic guidé' },
        { value: 'macro ou script commenté avec précautions et méthode de test', label: 'Macro ou script commenté' },
        { value: 'réponse concise avec solution et contrôle final', label: 'Solution concise' },
      ],
    },
    {
      name: 'guidanceLevel',
      label: 'Niveau d’accompagnement',
      type: 'select',
      cropSection: 'precisions',
      help: 'Indiquez le niveau d’explication et de guidage nécessaire.',
      required: true,
      options: [
        { value: 'explications détaillées pour une personne débutante', label: 'Détaillé pour débutant' },
        { value: 'étapes principales avec explications intermédiaires', label: 'Guidage intermédiaire' },
        { value: 'solution concise destinée à une personne autonome', label: 'Concis pour utilisateur autonome' },
      ],
    },
    {
      name: 'structureRules',
      label: 'Règles de structure, de calcul ou de mise en forme',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez les colonnes, feuilles, sections, formats, formules ou conventions à respecter.',
      placeholder: 'Exemple : conserver les colonnes existantes, ajouter les contrôles à droite et ne jamais fusionner les cellules de données.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'localeSettings',
      label: 'Paramètres régionaux',
      type: 'select',
      cropSection: 'precisions',
      help: 'Les noms de fonctions, séparateurs, dates et nombres peuvent dépendre de la langue et de la région.',
      required: true,
      options: [
        { value: 'paramètres français avec dates jour/mois/année et séparateur de fonctions point-virgule', label: 'France — français' },
        { value: 'paramètres internationaux avec fonctions anglaises et séparateur virgule', label: 'International — anglais' },
        { value: 'paramètres régionaux inconnus à confirmer avant de proposer une formule', label: 'Paramètres à confirmer' },
      ],
    },
    {
      name: 'constraints',
      label: 'Contraintes et éléments à éviter',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez les limites de version, de sécurité, de fonctions autorisées ou de modification des données.',
      placeholder: 'Exemple : aucune macro, conserver le fichier source intact, fonctions compatibles Excel 2019 et aucune donnée externe.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'verificationMethod',
      label: 'Méthode de vérification et cas de test',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Décrivez les valeurs fictives, cas limites ou comparaisons permettant de contrôler le résultat.',
      placeholder: 'Exemple : tester une ligne valide, un doublon, une valeur vide et comparer le total à un calcul manuel sur cinq lignes fictives.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
  ],
  requiredInformation: [
    'La situation, l’outil et sa version',
    'La structure du document ou des données de départ',
    'Le niveau de la personne utilisatrice',
    'Le résultat attendu',
    'Le type de tâche, le format de réponse et les paramètres régionaux',
  ],
  buildPrompt: buildOfficeDataPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision de la situation, de l’outil, de la source de départ et du niveau utilisateur.',
      checkpoints: [
        'Situation : 4, 7 ou 10 points.',
        'Outil défini : 4 points.',
        'Source de départ : 3, 5 ou 7 points.',
        'Niveau utilisateur défini : 4 points.',
      ],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Précision de l’expertise bureautique, de la pédagogie et de l’exigence de fiabilité.',
      checkpoints: ['Rôle court : 8 points.', 'Rôle précisé : 12 points.', 'Expertise complète : 15 points.'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté du résultat attendu et présence de critères de réussite vérifiables.',
      checkpoints: ['Résultat attendu : 8, 13 ou 17 points.', 'Critères de réussite : 0, 5 ou 8 points.'],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Définition de la tâche, du format, des règles, des contraintes et des contrôles.',
      checkpoints: [
        'Tâche, format, accompagnement et paramètres régionaux : 18 points.',
        'Règles de structure : 0, 4 ou 6 points.',
        'Contraintes : 0, 3 ou 5 points.',
        'Vérification : 0, 4 ou 6 points.',
      ],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Décrivez la structure du fichier sans le transmettre, puis précisez le résultat, l’outil, les règles et les contrôles attendus.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. Décrivez uniquement la structure utile, sans coller de fichier, de tableau, de liste de clients ni de document.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Bureautique et données et sur une grille CROP déterministe documentée.',
  },
  beforeAfter: {
    vagueRequest: '« Donne-moi une formule Excel pour nettoyer mon tableau. »',
    missingDescription: 'La version, les colonnes, le résultat, les paramètres régionaux et les contrôles ne sont pas définis.',
    structuredPrompt: '« Contexte : tableau fictif Excel 365 avec colonnes Date, Statut et Montant. Rôle : formateur Excel rigoureux. Objectif : contrôler les statuts et signaler les doublons. Précisions : paramètres français, procédure pour débutant, aucune macro, fichier source conservé et quatre cas de test. »',
    benefit: 'La solution peut être adaptée à l’outil, expliquée au bon niveau et vérifiée sur des cas fictifs.',
  },
  examples: [
    {
      title: 'Formule Excel expliquée',
      description: 'Obtenir une formule compatible avec la version et les paramètres régionaux utilisés.',
      prompt: 'Propose une formule Excel 365 en français à partir de colonnes fictives. Explique chaque partie et fournis trois cas de test sans inventer de données.',
    },
    {
      title: 'Nettoyage d’un tableau',
      description: 'Préparer une procédure réversible pour repérer les valeurs vides, doublons et formats incohérents.',
      prompt: 'Décris une procédure de nettoyage sur une copie du tableau. Contrôle les valeurs vides, doublons et formats, puis indique comment vérifier chaque étape.',
    },
    {
      title: 'Automatisation prudente',
      description: 'Cadrer une macro ou un script avec sauvegarde, limites et méthode de test.',
      prompt: 'Prépare une automatisation commentée pour un fichier fictif. Commence par la sauvegarde, limite les modifications au périmètre défini et propose un test sur une copie.',
    },
  ],
  recommendations: [
    'Travaillez toujours sur une copie et conservez le fichier source intact.',
    'Vérifiez la version, la langue et les paramètres régionaux avant d’utiliser une formule ou une macro.',
    'Testez la solution sur des données fictives et sur plusieurs cas limites avant de l’appliquer.',
  ],
};
