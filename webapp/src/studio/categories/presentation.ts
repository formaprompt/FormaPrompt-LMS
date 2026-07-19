import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const presentationSchema = z.object({
  presentationContext: z.string().trim().min(20, 'Décrivez la situation en au moins 20 caractères.').max(900, 'Limitez le contexte à 900 caractères.'),
  audience: z.string().trim().min(12, 'Précisez le public en au moins 12 caractères.').max(600, 'Limitez le public à 600 caractères.'),
  deliveryContext: z.string().trim().min(1, 'Choisissez un contexte de présentation.'),
  sourceMaterials: z.string().trim().max(700, 'Limitez la description des sources à 700 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(340, 'Limitez le rôle à 340 caractères.'),
  presentationGoal: z.string().trim().min(1, 'Choisissez l’objectif principal.'),
  keyMessage: z.string().trim().min(15, 'Décrivez le message central en au moins 15 caractères.').max(700, 'Limitez le message central à 700 caractères.'),
  desiredOutcome: z.string().trim().max(600, 'Limitez le résultat attendu à 600 caractères.'),
  productionMode: z.string().trim().min(1, 'Choisissez un mode de production.'),
  targetTool: z.string().trim().min(1, 'Choisissez un outil visé.'),
  targetToolDetails: z.string().trim().max(240, 'Limitez la précision sur l’outil à 240 caractères.'),
  slideCount: z.string().trim().min(1, 'Choisissez un nombre de diapositives.'),
  speakingDuration: z.string().trim().min(1, 'Choisissez une durée.'),
  narrativeStructure: z.string().trim().min(1, 'Choisissez une progression narrative.'),
  visualStyle: z.string().trim().min(1, 'Choisissez un style visuel.'),
  speakerNotes: z.string().trim().min(1, 'Choisissez un niveau de notes orales.'),
  contentRequirements: z.string().trim().max(800, 'Limitez les contenus attendus à 800 caractères.'),
  sourceBoundaries: z.string().trim().max(700, 'Limitez les règles relatives aux sources à 700 caractères.'),
  accessibilityRules: z.string().trim().max(600, 'Limitez les règles d’accessibilité à 600 caractères.'),
  constraints: z.string().trim().max(700, 'Limitez les contraintes à 700 caractères.'),
  verificationMethod: z.string().trim().max(600, 'Limitez les contrôles à 600 caractères.'),
}).strict();

export type PresentationValues = z.infer<typeof presentationSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: PresentationValues): ScoreRuleResult {
  let earnedPoints = 4;
  const present = [`Le contexte de diffusion « ${values.deliveryContext} » est défini.`];
  const missing: string[] = [];

  const contextLength = textLength(values.presentationContext);
  if (contextLength >= 90) {
    earnedPoints += 10;
    present.push('La situation, le sujet et les enjeux de la présentation sont détaillés.');
  } else if (contextLength >= 45) {
    earnedPoints += 7;
    present.push('La situation générale de la présentation est compréhensible.');
    missing.push('Les enjeux, le moment de diffusion ou les informations déjà connues.');
  } else {
    earnedPoints += 4;
    present.push('Une première situation est indiquée.');
    missing.push('Une description plus précise du sujet, de la situation et des enjeux.');
  }

  const audienceLength = textLength(values.audience);
  if (audienceLength >= 50) {
    earnedPoints += 8;
    present.push('Le public, son niveau et ses attentes sont détaillés.');
  } else if (audienceLength >= 25) {
    earnedPoints += 6;
    present.push('Le public principal est identifiable.');
    missing.push('Le niveau de connaissance, les attentes ou les éventuelles réserves du public.');
  } else {
    earnedPoints += 3;
    present.push('Un public général est indiqué.');
    missing.push('Un public plus précis avec son niveau et ses attentes.');
  }

  const sourcesLength = textLength(values.sourceMaterials);
  if (sourcesLength >= 40) {
    earnedPoints += 3;
    present.push('Les documents et informations disponibles sont clairement délimités.');
  } else if (sourcesLength >= 15) {
    earnedPoints += 2;
    present.push('Une première indication sur les sources disponibles est fournie.');
    missing.push('Les documents, chiffres ou contenus utilisables et leurs limites.');
  } else {
    missing.push('Les sources, documents ou informations disponibles pour préparer le contenu.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez la situation, le public, le contexte de diffusion et les sources réellement disponibles.',
  };
}

function evaluateRole(values: PresentationValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 60) {
    return {
      earnedPoints: 15,
      present: ['Le rôle réunit expertise du sujet, structuration narrative et communication visuelle.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond au sujet, au public et au contexte de diffusion.',
    };
  }
  if (length >= 30) {
    return {
      earnedPoints: 12,
      present: ['Un rôle adapté à la préparation d’une présentation est défini.'],
      missing: ['La spécialité du sujet, la posture orale ou l’exigence de lisibilité visuelle.'],
      recommendation: 'Ajoutez l’expertise attendue, la posture face au public et l’attention portée à la lisibilité.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise, une posture et une compétence de structuration adaptées à la présentation.'],
    recommendation: 'Précisez le rôle : expertise du sujet, narration, pédagogie et communication visuelle.',
  };
}

function evaluateObjective(values: PresentationValues): ScoreRuleResult {
  let earnedPoints = 4;
  const present = [`L’objectif « ${values.presentationGoal} » est défini.`];
  const missing: string[] = [];

  const messageLength = textLength(values.keyMessage);
  if (messageLength >= 70) {
    earnedPoints += 15;
    present.push('Le message central est précis, mémorisable et relié au sujet.');
  } else if (messageLength >= 35) {
    earnedPoints += 11;
    present.push('Le message principal est compréhensible.');
    missing.push('Une idée centrale plus précise ou plus directement mémorisable.');
  } else {
    earnedPoints += 7;
    present.push('Une intention générale est indiquée.');
    missing.push('Le message unique que le public doit retenir après la présentation.');
  }

  const outcomeLength = textLength(values.desiredOutcome);
  if (outcomeLength >= 40) {
    earnedPoints += 6;
    present.push('Le résultat attendu auprès du public est observable.');
  } else if (outcomeLength >= 15) {
    earnedPoints += 4;
    present.push('Un premier effet attendu est indiqué.');
    missing.push('Une action, une décision ou une compréhension vérifiable à l’issue de la présentation.');
  } else {
    missing.push('Le résultat concret attendu auprès du public.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Formulez un message central unique et le résultat concret attendu auprès du public.',
  };
}

function evaluatePrecisions(values: PresentationValues): ScoreRuleResult {
  let earnedPoints = 15;
  const present = [
    `Le mode de production « ${values.productionMode} » est défini.`,
    `L’outil visé « ${values.targetTool} » est précisé.`,
    `Le volume « ${values.slideCount} » est défini.`,
    `La durée « ${values.speakingDuration} » est prise en compte.`,
    `La progression « ${values.narrativeStructure} » est choisie.`,
    `Le style « ${values.visualStyle} » est précisé.`,
    `Les notes orales sont prévues au niveau « ${values.speakerNotes} ».`,
  ];
  const missing: string[] = [];

  const contentLength = textLength(values.contentRequirements);
  if (contentLength >= 40) {
    earnedPoints += 5;
    present.push('Les contenus et éléments obligatoires sont détaillés.');
  } else if (contentLength >= 15) {
    earnedPoints += 3;
    present.push('Un premier contenu obligatoire est indiqué.');
    missing.push('Les idées, exemples, preuves ou appels à l’action attendus dans le diaporama.');
  } else {
    missing.push('Les contenus ou éléments qui doivent impérativement apparaître.');
  }

  const boundariesLength = textLength(values.sourceBoundaries);
  if (boundariesLength >= 40) {
    earnedPoints += 5;
    present.push('Les règles de citation et les limites relatives aux sources sont détaillées.');
  } else if (boundariesLength >= 15) {
    earnedPoints += 3;
    present.push('Une première règle relative aux sources est indiquée.');
    missing.push('Les citations, chiffres, sources autorisées et informations à ne pas inventer.');
  } else {
    missing.push('Les règles de citation et les limites relatives aux sources, chiffres et exemples.');
  }

  const accessibilityLength = textLength(values.accessibilityRules);
  if (accessibilityLength >= 35) {
    earnedPoints += 4;
    present.push('Les règles de lisibilité et d’accessibilité sont clairement définies.');
  } else if (accessibilityLength >= 12) {
    earnedPoints += 2;
    present.push('Une première règle de lisibilité est indiquée.');
    missing.push('Les contrastes, la taille du texte, les alternatives aux visuels ou la densité maximale.');
  } else {
    missing.push('Les règles de lisibilité et d’accessibilité du diaporama.');
  }

  const constraintsLength = textLength(values.constraints);
  if (constraintsLength >= 30) {
    earnedPoints += 3;
    present.push('Les contraintes et les éléments à éviter sont précisés.');
  } else if (constraintsLength >= 10) {
    earnedPoints += 2;
    present.push('Une première contrainte est indiquée.');
    missing.push('Les limites de ton, de marque, de jargon, de mise en page ou de contenu.');
  } else {
    missing.push('Les contraintes et les éléments à éviter.');
  }

  const verificationLength = textLength(values.verificationMethod);
  if (verificationLength >= 35) {
    earnedPoints += 3;
    present.push('Une méthode de relecture et de répétition est prévue.');
  } else if (verificationLength >= 12) {
    earnedPoints += 2;
    present.push('Un premier contrôle est prévu.');
    missing.push('La vérification du minutage, de la compréhension et de la traçabilité des sources.');
  } else {
    missing.push('La méthode de vérification du contenu, du minutage et de la lisibilité.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Ajoutez les contenus obligatoires, les sources, l’accessibilité, les contraintes et les contrôles avant diffusion.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildProductionInstruction(values: PresentationValues) {
  if (values.productionMode === 'créer directement une présentation ou un fichier éditable si cette capacité est disponible') {
    return 'Si tes capacités et l’environnement disponible permettent de créer réellement un fichier éditable, produis-le dans un format compatible avec l’outil visé. Sinon, indique clairement cette limite et fournis immédiatement un storyboard complet, prêt à intégrer, sans prétendre qu’un fichier a été créé.';
  }

  if (values.productionMode === 'rédiger une consigne optimisée à transmettre à une application de présentation') {
    return 'Rédige une consigne finale autonome, prête à être transmise à l’application visée. Elle doit contenir la structure, les contenus, la direction visuelle, les notes orales, les règles de sources et les contrôles attendus.';
  }

  return 'Fournis le contenu complet à intégrer manuellement : storyboard, titres, textes courts, visuels suggérés, notes orales et contrôles, sans prétendre avoir créé un fichier.';
}

function buildToolInstruction(values: PresentationValues) {
  const toolDetails = values.targetToolDetails.trim();
  const detailSuffix = toolDetails ? ` Prends aussi en compte cette précision : ${toolDetails}.` : '';

  const instructions: Record<string, string> = {
    'Microsoft PowerPoint': 'Adapte le résultat à PowerPoint : propose pour chaque diapositive une disposition simple, un contenu modifiable, un visuel utile et les notes du présentateur. Évite les animations décoratives et les fonctions difficiles à reprendre.',
    'Google Slides': 'Adapte le résultat à Google Slides : privilégie des mises en page simples, collaboratives et faciles à modifier, avec notes du présentateur et contenus accessibles.',
    Gamma: 'Adapte le résultat à Gamma : structure le contenu en cartes ou sections courtes, avec une hiérarchie claire, des blocs concis et des indications visuelles directement exploitables.',
    Prezi: 'Adapte le résultat à Prezi : décris la vue d’ensemble, les zones du canevas, les relations entre les idées et le parcours de zoom. Limite les déplacements pour préserver le confort de lecture.',
    'Canva Présentations': 'Adapte le résultat à Canva Présentations : précise la hiérarchie visuelle, les types de pages, les emplacements d’images et les règles de cohérence avec la charte.',
    'Apple Keynote': 'Adapte le résultat à Keynote : privilégie des compositions visuelles épurées, des transitions sobres et des éléments entièrement modifiables.',
    'LibreOffice Impress': 'Adapte le résultat à LibreOffice Impress : utilise des dispositions et fonctionnalités courantes, compatibles et faciles à modifier.',
    'autre outil à préciser': 'Adapte le résultat à l’outil précisé lorsque ses contraintes sont connues. Si elles ne le sont pas, produis une structure universelle et demande les informations manquantes.',
    'aucun outil précis, avec une structure universelle': 'Produis une structure universelle, transférable dans la plupart des applications de présentation, sans dépendre d’une fonctionnalité propriétaire.',
  };

  return `${instructions[values.targetTool] ?? instructions['aucun outil précis, avec une structure universelle']}${detailSuffix}`;
}

function buildPresentationPrompt(values: PresentationValues) {
  return [
    '## Contexte',
    `- Situation et sujet : ${values.presentationContext}`,
    `- Public : ${values.audience}`,
    `- Contexte de diffusion : ${values.deliveryContext}`,
    optionalLine('Documents et informations disponibles', values.sourceMaterials),
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif',
    `- Finalité principale : ${values.presentationGoal}`,
    `- Message central à retenir : ${values.keyMessage}`,
    optionalLine('Résultat attendu auprès du public', values.desiredOutcome),
    '',
    '## Précisions',
    `- Mode de production : ${values.productionMode}`,
    `- Outil visé : ${values.targetTool}`,
    optionalLine('Version, format ou autre précision sur l’outil', values.targetToolDetails),
    `- Nombre de diapositives : ${values.slideCount}`,
    `- Durée de prise de parole : ${values.speakingDuration}`,
    `- Progression narrative : ${values.narrativeStructure}`,
    `- Style visuel : ${values.visualStyle}`,
    `- Notes orales : ${values.speakerNotes}`,
    optionalLine('Contenus obligatoires', values.contentRequirements),
    optionalLine('Sources, citations et limites', values.sourceBoundaries),
    optionalLine('Lisibilité et accessibilité', values.accessibilityRules),
    optionalLine('Contraintes et éléments à éviter', values.constraints),
    optionalLine('Méthode de vérification', values.verificationMethod),
    '',
    '## Adaptation au mode de production et à l’outil',
    buildProductionInstruction(values),
    buildToolInstruction(values),
    '',
    '## Consigne finale',
    'Construis le plan détaillé du diaporama, diapositive par diapositive. Pour chaque diapositive, indique un titre informatif, le message essentiel, les éléments visuels utiles et les notes orales correspondantes. Maintiens une idée principale par diapositive et adapte le niveau de détail au temps disponible. N’invente aucun chiffre, fait, citation, témoignage ou source : signale explicitement toute information manquante et utilise un emplacement à compléter. Termine par une liste de contrôles portant sur le message, le minutage, la lisibilité, l’accessibilité et les sources.',
  ].join('\n');
}

export const presentationCategory: StudioCategoryConfig<PresentationValues> = {
  id: 'presentation',
  label: 'Présentation',
  shortDescription: 'Structurer un diaporama clair, son message, sa progression visuelle et sa prise de parole.',
  schema: presentationSchema,
  defaultValues: {
    presentationContext: '',
    audience: '',
    deliveryContext: 'présentation en réunion professionnelle en présentiel',
    sourceMaterials: '',
    role: 'un concepteur de présentations professionnelles, pédagogue, synthétique et attentif à la narration comme à la lisibilité visuelle',
    presentationGoal: 'informer et faire comprendre un sujet',
    keyMessage: '',
    desiredOutcome: '',
    productionMode: 'préparer le contenu complet à intégrer manuellement dans une application',
    targetTool: 'Microsoft PowerPoint',
    targetToolDetails: '',
    slideCount: '8 à 10 diapositives, hors annexes',
    speakingDuration: '10 minutes de présentation puis questions',
    narrativeStructure: 'situation, enjeu, explication, solution et prochaine étape',
    visualStyle: 'professionnel, sobre, lisible et peu chargé',
    speakerNotes: 'notes courtes avec messages clés et transitions',
    contentRequirements: '',
    sourceBoundaries: '',
    accessibilityRules: '',
    constraints: '',
    verificationMethod: '',
  },
  fields: [
    {
      name: 'presentationContext',
      label: 'Sujet, situation et enjeux de la présentation',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez le sujet, le moment de diffusion et ce qui motive la présentation, sans données sensibles.',
      placeholder: 'Exemple : présenter à une équipe les résultats anonymisés d’un projet fictif et les prochaines étapes à valider.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'audience',
      label: 'Public, niveau et attentes',
      type: 'textarea',
      cropSection: 'context',
      help: 'Précisez qui écoutera, ce que ce public connaît déjà et ce qu’il attend.',
      placeholder: 'Exemple : responsables de service connaissant le projet, disposant de peu de temps et attendant une décision claire.',
      required: true,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'deliveryContext',
      label: 'Contexte de diffusion',
      type: 'select',
      cropSection: 'context',
      help: 'Le cadre influence le rythme, le niveau de détail et les interactions.',
      required: true,
      options: [
        { value: 'présentation en réunion professionnelle en présentiel', label: 'Réunion professionnelle' },
        { value: 'présentation à distance en visioconférence', label: 'Visioconférence' },
        { value: 'séquence de formation avec interactions', label: 'Formation' },
        { value: 'conférence ou intervention devant un public large', label: 'Conférence' },
        { value: 'présentation commerciale ou proposition à un prospect', label: 'Présentation commerciale' },
        { value: 'soutenance, bilan ou restitution de projet', label: 'Soutenance ou bilan' },
        { value: 'diaporama autonome destiné à être lu sans présentation orale', label: 'Diaporama autonome' },
      ],
    },
    {
      name: 'sourceMaterials',
      label: 'Documents et informations disponibles',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez uniquement les sources utilisables, sous forme anonymisée ou fictive, sans transmettre de document réel.',
      placeholder: 'Exemple : synthèse anonymisée, trois indicateurs validés et charte graphique interne fictive.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez l’expertise du sujet, la narration, la pédagogie et la communication visuelle.',
      required: true,
      maxLength: 340,
      autoComplete: 'off',
    },
    {
      name: 'presentationGoal',
      label: 'Objectif principal de la présentation',
      type: 'select',
      cropSection: 'objective',
      help: 'Choisissez ce que la présentation doit principalement permettre.',
      required: true,
      options: [
        { value: 'informer et faire comprendre un sujet', label: 'Informer et expliquer' },
        { value: 'obtenir une décision ou un arbitrage', label: 'Obtenir une décision' },
        { value: 'convaincre avec des arguments vérifiables', label: 'Convaincre' },
        { value: 'former et permettre une mise en pratique', label: 'Former' },
        { value: 'restituer des résultats et leurs limites', label: 'Restituer des résultats' },
        { value: 'proposer un plan d’action et obtenir un engagement', label: 'Faire agir' },
      ],
    },
    {
      name: 'keyMessage',
      label: 'Message central à retenir',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Formulez l’idée unique que le public doit pouvoir retenir et reformuler.',
      placeholder: 'Exemple : la solution proposée réduit les étapes inutiles tout en conservant les contrôles essentiels.',
      required: true,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'desiredOutcome',
      label: 'Résultat attendu auprès du public',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez la compréhension, la décision ou l’action attendue après la présentation.',
      placeholder: 'Exemple : valider les deux prochaines étapes et désigner les personnes responsables du suivi.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'productionMode',
      label: 'Qui doit réaliser la présentation ?',
      type: 'select',
      cropSection: 'precisions',
      help: 'Indiquez si le modèle doit créer un fichier, préparer le contenu ou rédiger une consigne pour une autre application.',
      required: true,
      options: [
        { value: 'créer directement une présentation ou un fichier éditable si cette capacité est disponible', label: 'Le modèle doit créer la présentation' },
        { value: 'préparer le contenu complet à intégrer manuellement dans une application', label: 'Préparer le contenu à intégrer' },
        { value: 'rédiger une consigne optimisée à transmettre à une application de présentation', label: 'Préparer une consigne pour une application' },
      ],
    },
    {
      name: 'targetTool',
      label: 'Application ou outil visé',
      type: 'select',
      cropSection: 'precisions',
      help: 'Le Studio adaptera la structure aux possibilités et aux usages courants de cette destination.',
      required: true,
      options: [
        { value: 'Microsoft PowerPoint', label: 'Microsoft PowerPoint' },
        { value: 'Google Slides', label: 'Google Slides' },
        { value: 'Gamma', label: 'Gamma' },
        { value: 'Prezi', label: 'Prezi' },
        { value: 'Canva Présentations', label: 'Canva Présentations' },
        { value: 'Apple Keynote', label: 'Apple Keynote' },
        { value: 'LibreOffice Impress', label: 'LibreOffice Impress' },
        { value: 'autre outil à préciser', label: 'Autre outil' },
        { value: 'aucun outil précis, avec une structure universelle', label: 'Aucun outil précis' },
      ],
    },
    {
      name: 'targetToolDetails',
      label: 'Version, format ou autre précision sur l’outil',
      type: 'text',
      cropSection: 'precisions',
      help: 'Facultatif : indiquez une version, un format de fichier ou le nom d’un autre outil.',
      placeholder: 'Exemple : PowerPoint Microsoft 365, format 16:9, ou nom d’un autre service.',
      required: false,
      maxLength: 240,
      autoComplete: 'off',
    },
    {
      name: 'slideCount',
      label: 'Nombre de diapositives',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez un volume cohérent avec le temps disponible.',
      required: true,
      options: [
        { value: '5 à 7 diapositives, hors annexes', label: '5 à 7 diapositives' },
        { value: '8 à 10 diapositives, hors annexes', label: '8 à 10 diapositives' },
        { value: '11 à 15 diapositives, hors annexes', label: '11 à 15 diapositives' },
        { value: '16 à 25 diapositives, hors annexes', label: '16 à 25 diapositives' },
        { value: 'nombre à déterminer selon le contenu et la durée', label: 'À déterminer' },
      ],
    },
    {
      name: 'speakingDuration',
      label: 'Durée de prise de parole',
      type: 'select',
      cropSection: 'precisions',
      help: 'Le plan doit être réellement présentable dans cette durée.',
      required: true,
      options: [
        { value: '5 minutes de présentation', label: '5 minutes' },
        { value: '10 minutes de présentation puis questions', label: '10 minutes' },
        { value: '20 minutes de présentation puis questions', label: '20 minutes' },
        { value: '30 à 45 minutes avec temps d’échange', label: '30 à 45 minutes' },
        { value: 'durée à déterminer', label: 'À déterminer' },
      ],
    },
    {
      name: 'narrativeStructure',
      label: 'Progression narrative',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez l’enchaînement qui guidera le public du point de départ à la conclusion.',
      required: true,
      options: [
        { value: 'situation, enjeu, explication, solution et prochaine étape', label: 'Situation → solution → action' },
        { value: 'problème, causes vérifiées, options, recommandation et décision attendue', label: 'Problème → recommandation' },
        { value: 'objectif, méthode, résultats, limites et conclusion', label: 'Méthode → résultats' },
        { value: 'accroche, trois messages clés, synthèse et appel à l’action', label: 'Trois messages clés' },
        { value: 'étapes progressives avec démonstration, pratique et récapitulatif', label: 'Progression pédagogique' },
      ],
    },
    {
      name: 'visualStyle',
      label: 'Style visuel',
      type: 'select',
      cropSection: 'precisions',
      help: 'Le style guide la densité, les couleurs et le choix des visuels, sans remplacer une charte existante.',
      required: true,
      options: [
        { value: 'professionnel, sobre, lisible et peu chargé', label: 'Professionnel et sobre' },
        { value: 'pédagogique, illustré et progressif', label: 'Pédagogique et illustré' },
        { value: 'institutionnel, structuré et factuel', label: 'Institutionnel' },
        { value: 'dynamique avec grands visuels et très peu de texte', label: 'Dynamique et visuel' },
        { value: 'minimaliste avec une idée et un visuel par diapositive', label: 'Minimaliste' },
      ],
    },
    {
      name: 'speakerNotes',
      label: 'Niveau de notes orales',
      type: 'select',
      cropSection: 'precisions',
      help: 'Les notes aident à présenter sans surcharger les diapositives.',
      required: true,
      options: [
        { value: 'notes courtes avec messages clés et transitions', label: 'Notes courtes' },
        { value: 'notes détaillées avec explications, exemples et transitions', label: 'Notes détaillées' },
        { value: 'trame orale très concise pour une personne expérimentée', label: 'Trame concise' },
        { value: 'aucune note orale car le diaporama sera lu de manière autonome', label: 'Aucune note — lecture autonome' },
      ],
    },
    {
      name: 'contentRequirements',
      label: 'Contenus et éléments obligatoires',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez les idées, exemples, preuves, étapes ou appels à l’action qui doivent apparaître.',
      placeholder: 'Exemple : contexte en une diapositive, trois résultats validés, limites, recommandation et prochaine étape.',
      required: false,
      maxLength: 800,
      rows: 3,
    },
    {
      name: 'sourceBoundaries',
      label: 'Sources, citations et informations à ne pas inventer',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez ce qui peut être cité et ce qui doit rester signalé comme information manquante.',
      placeholder: 'Exemple : utiliser seulement les trois indicateurs validés ; placer « source à ajouter » pour toute donnée non fournie.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'accessibilityRules',
      label: 'Lisibilité et accessibilité',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Pensez aux contrastes, à la taille des textes, à la densité et aux alternatives aux informations visuelles.',
      placeholder: 'Exemple : contraste renforcé, texte court et lisible, graphiques décrits dans les notes et aucune information portée uniquement par la couleur.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'constraints',
      label: 'Contraintes et éléments à éviter',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez la charte, le ton, les limites de contenu, le jargon ou les mises en page à éviter.',
      placeholder: 'Exemple : conserver la charte existante, éviter les animations décoratives et expliquer chaque sigle.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'verificationMethod',
      label: 'Contrôles avant présentation',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Prévoyez une relecture, une répétition chronométrée et une vérification des sources et de la lisibilité.',
      placeholder: 'Exemple : contrôler chaque chiffre, tester la projection, faire une répétition de 9 minutes et demander une reformulation du message central.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
  ],
  requiredInformation: [
    'Le sujet, le contexte et le public',
    'Le message central et l’objectif principal',
    'Le contexte de diffusion',
    'Le mode de production et l’outil visé',
    'La durée et le nombre de diapositives',
    'La progression narrative, le style visuel et les notes orales',
  ],
  buildPrompt: buildPresentationPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision de la situation, du public, du contexte de diffusion et des sources disponibles.',
      checkpoints: [
        'Situation et enjeux : 4, 7 ou 10 points.',
        'Public : 3, 6 ou 8 points.',
        'Contexte de diffusion défini : 4 points.',
        'Sources disponibles : 0, 2 ou 3 points.',
      ],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Précision de l’expertise, de la narration, de la pédagogie et de la communication visuelle.',
      checkpoints: ['Rôle court : 8 points.', 'Rôle précisé : 12 points.', 'Rôle complet : 15 points.'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté de la finalité, du message central et du résultat attendu auprès du public.',
      checkpoints: [
        'Objectif principal défini : 4 points.',
        'Message central : 7, 11 ou 15 points.',
        'Résultat attendu : 0, 4 ou 6 points.',
      ],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Définition du format, de la progression, des contenus, des sources, de l’accessibilité et des contrôles.',
      checkpoints: [
        'Mode de production, outil, volume, durée, progression, style et notes : 15 points.',
        'Contenus obligatoires : 0, 3 ou 5 points.',
        'Sources et limites : 0, 3 ou 5 points.',
        'Accessibilité : 0, 2 ou 4 points.',
        'Contraintes : 0, 2 ou 3 points.',
        'Vérification : 0, 2 ou 3 points.',
      ],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Commencez par le public et le message à retenir, puis cadrez le temps, la progression, les visuels et la prise de parole.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. Décrivez uniquement des situations, chiffres et sources fictifs, publics ou anonymisés.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Présentation et sur une grille CROP déterministe documentée.',
  },
  beforeAfter: {
    vagueRequest: '« Fais-moi une présentation professionnelle sur notre projet. »',
    missingDescription: 'Le public, le message central, la durée, les sources et la progression ne sont pas définis.',
    structuredPrompt: '« Contexte : réunion de dix minutes avec des responsables de service. Rôle : concepteur de présentations synthétiques. Objectif : faire comprendre les résultats validés et obtenir une décision. Précisions : huit diapositives, une idée par page, sources indiquées, notes orales, contrastes renforcés et répétition chronométrée. »',
    benefit: 'Le diaporama peut être dimensionné pour le public et le temps disponible, sans surcharger les diapositives ni inventer d’informations.',
  },
  examples: [
    {
      title: 'Restitution de projet',
      description: 'Présenter des résultats, leurs limites et la décision attendue.',
      prompt: 'Structure une restitution de dix minutes en huit diapositives : contexte, méthode, trois résultats validés, limites, recommandation et décision attendue.',
    },
    {
      title: 'Présentation pédagogique',
      description: 'Faire comprendre une notion puis guider une mise en pratique.',
      prompt: 'Prépare une progression pédagogique avec une accroche, trois notions, un exemple fictif, une activité courte et un récapitulatif accessible.',
    },
    {
      title: 'Diaporama autonome',
      description: 'Créer une présentation compréhensible sans commentaire oral.',
      prompt: 'Conçois un diaporama autonome avec titres informatifs, sources visibles, définitions courtes et conclusion actionnable, sans dépendre de notes orales.',
    },
  ],
  recommendations: [
    'Formulez un seul message central avant de découper le contenu en diapositives.',
    'Réservez les détails, preuves complémentaires et tableaux denses aux annexes.',
    'Effectuez une répétition chronométrée et vérifiez chaque chiffre, citation et source avant diffusion.',
  ],
};
