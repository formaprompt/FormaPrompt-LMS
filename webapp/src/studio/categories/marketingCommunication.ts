import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const marketingCommunicationSchema = z.object({
  campaignContext: z.string().trim().min(20, 'Décrivez la situation en au moins 20 caractères.').max(900, 'Limitez le contexte à 900 caractères.'),
  offerDescription: z.string().trim().min(15, 'Décrivez l’offre, le service ou le sujet en au moins 15 caractères.').max(800, 'Limitez la description à 800 caractères.'),
  targetAudience: z.string().trim().min(12, 'Précisez le public en au moins 12 caractères.').max(600, 'Limitez le public à 600 caractères.'),
  audienceAwareness: z.string().trim().min(1, 'Choisissez un niveau de connaissance du public.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(340, 'Limitez le rôle à 340 caractères.'),
  communicationGoal: z.string().trim().min(1, 'Choisissez un objectif de communication.'),
  keyMessage: z.string().trim().min(15, 'Précisez le message central en au moins 15 caractères.').max(700, 'Limitez le message central à 700 caractères.'),
  desiredAction: z.string().trim().max(500, 'Limitez l’action attendue à 500 caractères.'),
  contentType: z.string().trim().min(1, 'Choisissez un type de contenu.'),
  primaryChannel: z.string().trim().min(1, 'Choisissez un canal principal.'),
  tone: z.string().trim().min(1, 'Choisissez un ton.'),
  outputFormat: z.string().trim().min(1, 'Choisissez un format de réponse.'),
  valueProposition: z.string().trim().max(700, 'Limitez la proposition de valeur à 700 caractères.'),
  proofPoints: z.string().trim().max(800, 'Limitez les preuves disponibles à 800 caractères.'),
  brandGuidelines: z.string().trim().max(600, 'Limitez les règles de marque à 600 caractères.'),
  legalEthicalConstraints: z.string().trim().max(700, 'Limitez les contraintes éthiques et réglementaires à 700 caractères.'),
  successIndicators: z.string().trim().max(500, 'Limitez les indicateurs à 500 caractères.'),
  constraints: z.string().trim().max(700, 'Limitez les contraintes à 700 caractères.'),
}).strict();

export type MarketingCommunicationValues = z.infer<typeof marketingCommunicationSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: MarketingCommunicationValues): ScoreRuleResult {
  let earnedPoints = 2;
  const present = [`Le niveau de connaissance « ${values.audienceAwareness} » est pris en compte.`];
  const missing: string[] = [];

  const contextLength = textLength(values.campaignContext);
  if (contextLength >= 90) {
    earnedPoints += 10;
    present.push('La situation de communication et ses enjeux sont détaillés.');
  } else if (contextLength >= 45) {
    earnedPoints += 7;
    present.push('La situation générale est compréhensible.');
    missing.push('L’occasion, les enjeux ou les contenus existants à prendre en compte.');
  } else {
    earnedPoints += 4;
    present.push('Une première situation est indiquée.');
    missing.push('Une description plus précise de la situation et des enjeux de communication.');
  }

  const offerLength = textLength(values.offerDescription);
  if (offerLength >= 70) {
    earnedPoints += 7;
    present.push('L’offre, le service ou le sujet est décrit de manière concrète.');
  } else if (offerLength >= 35) {
    earnedPoints += 5;
    present.push('Le sujet de la communication est compréhensible.');
    missing.push('Les caractéristiques utiles, le périmètre ou les limites de l’offre.');
  } else {
    earnedPoints += 3;
    present.push('Une offre ou un sujet est mentionné.');
    missing.push('Une description factuelle plus précise de ce qui est présenté.');
  }

  const audienceLength = textLength(values.targetAudience);
  if (audienceLength >= 50) {
    earnedPoints += 6;
    present.push('Le public, ses besoins et son contexte sont détaillés.');
  } else if (audienceLength >= 25) {
    earnedPoints += 4;
    present.push('Le public principal est identifiable.');
    missing.push('Les besoins, les freins ou le contexte de décision du public.');
  } else {
    earnedPoints += 2;
    present.push('Un public général est indiqué.');
    missing.push('Un public plus précis avec ses besoins et ses attentes.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez la situation, l’offre réelle, le public et son niveau de connaissance avant de définir l’argumentation.',
  };
}

function evaluateRole(values: MarketingCommunicationValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 60) {
    return {
      earnedPoints: 15,
      present: ['Le rôle associe stratégie, rédaction, connaissance du public et exigence de fiabilité.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond au secteur, au public et au support retenu.',
    };
  }
  if (length >= 30) {
    return {
      earnedPoints: 12,
      present: ['Un rôle de communication adapté est défini.'],
      missing: ['La spécialité, la posture ou la responsabilité concernant la fiabilité des arguments.'],
      recommendation: 'Ajoutez le domaine, le public, la posture et l’obligation de distinguer les faits des formulations éditoriales.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise marketing et une posture responsables adaptées au public.'],
    recommendation: 'Précisez le rôle : stratégie, rédaction, secteur, public et contrôle des affirmations.',
  };
}

function evaluateObjective(values: MarketingCommunicationValues): ScoreRuleResult {
  let earnedPoints = 5;
  const present = [`L’objectif « ${values.communicationGoal} » est défini.`];
  const missing: string[] = [];

  const messageLength = textLength(values.keyMessage);
  if (messageLength >= 70) {
    earnedPoints += 13;
    present.push('Le message central est précis, crédible et orienté vers le public.');
  } else if (messageLength >= 35) {
    earnedPoints += 10;
    present.push('Le message principal est compréhensible.');
    missing.push('Un message plus précis reliant le besoin du public à une valeur concrète.');
  } else {
    earnedPoints += 7;
    present.push('Une intention générale est indiquée.');
    missing.push('L’idée unique que le public doit comprendre et retenir.');
  }

  const actionLength = textLength(values.desiredAction);
  if (actionLength >= 40) {
    earnedPoints += 7;
    present.push('L’action attendue est claire, réaliste et observable.');
  } else if (actionLength >= 15) {
    earnedPoints += 4;
    present.push('Une première action est proposée.');
    missing.push('Une action plus explicite, proportionnée et facile à réaliser.');
  } else {
    missing.push('L’action, la décision ou la compréhension attendue auprès du public.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Définissez un message central vérifiable et une action attendue claire, sans pression artificielle.',
  };
}

function evaluatePrecisions(values: MarketingCommunicationValues): ScoreRuleResult {
  let earnedPoints = 12;
  const present = [
    `Le contenu « ${values.contentType} » est défini.`,
    `Le canal « ${values.primaryChannel} » est pris en compte.`,
    `Le ton « ${values.tone} » est précisé.`,
    `Le format de réponse « ${values.outputFormat} » est demandé.`,
  ];
  const missing: string[] = [];

  const valueLength = textLength(values.valueProposition);
  if (valueLength >= 50) {
    earnedPoints += 6;
    present.push('La proposition de valeur est détaillée du point de vue du public.');
  } else if (valueLength >= 20) {
    earnedPoints += 4;
    present.push('Un bénéfice principal est indiqué.');
    missing.push('La différence concrète et les limites de la proposition de valeur.');
  } else {
    missing.push('La proposition de valeur ou le bénéfice concret pour le public.');
  }

  const proofLength = textLength(values.proofPoints);
  if (proofLength >= 40) {
    earnedPoints += 5;
    present.push('Les preuves et informations vérifiables sont clairement délimitées.');
  } else if (proofLength >= 15) {
    earnedPoints += 3;
    present.push('Une première preuve disponible est indiquée.');
    missing.push('Les sources, résultats, caractéristiques ou témoignages réellement autorisés.');
  } else {
    missing.push('Les preuves disponibles et les affirmations qui restent à vérifier.');
  }

  const brandLength = textLength(values.brandGuidelines);
  if (brandLength >= 35) {
    earnedPoints += 4;
    present.push('La voix, le vocabulaire et les règles de marque sont détaillés.');
  } else if (brandLength >= 12) {
    earnedPoints += 2;
    present.push('Une première règle de marque est indiquée.');
    missing.push('Le vocabulaire, la voix, les mentions ou les règles graphiques à respecter.');
  } else {
    missing.push('Les règles de marque et de cohérence éditoriale.');
  }

  const ethicalLength = textLength(values.legalEthicalConstraints);
  if (ethicalLength >= 35) {
    earnedPoints += 4;
    present.push('Les contraintes éthiques, réglementaires et de protection du public sont détaillées.');
  } else if (ethicalLength >= 12) {
    earnedPoints += 2;
    present.push('Une première limite éthique ou réglementaire est indiquée.');
    missing.push('Les mentions obligatoires, consentements, secteurs réglementés ou pratiques à exclure.');
  } else {
    missing.push('Les contraintes éthiques, réglementaires et les pratiques manipulatrices à exclure.');
  }

  const indicatorsLength = textLength(values.successIndicators);
  if (indicatorsLength >= 25) {
    earnedPoints += 2;
    present.push('Des indicateurs proportionnés permettent d’évaluer le contenu.');
  } else if (indicatorsLength >= 10) {
    earnedPoints += 1;
    present.push('Un premier indicateur est prévu.');
    missing.push('Un indicateur plus précis lié à l’objectif sans garantir un résultat.');
  } else {
    missing.push('Les indicateurs de réussite à observer après diffusion.');
  }

  const constraintsLength = textLength(values.constraints);
  if (constraintsLength >= 25) {
    earnedPoints += 2;
    present.push('Les contraintes de longueur, de structure et les éléments à éviter sont définis.');
  } else if (constraintsLength >= 10) {
    earnedPoints += 1;
    present.push('Une première contrainte éditoriale est indiquée.');
    missing.push('Les limites de longueur, de structure ou de vocabulaire complètes.');
  } else {
    missing.push('Les contraintes éditoriales et les éléments à éviter.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Ajoutez la proposition de valeur, les preuves, les règles de marque, les limites éthiques et les indicateurs réellement observables.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildMarketingCommunicationPrompt(values: MarketingCommunicationValues) {
  return [
    '## Contexte',
    `- Situation de communication : ${values.campaignContext}`,
    `- Offre, service ou sujet : ${values.offerDescription}`,
    `- Public visé : ${values.targetAudience}`,
    `- Niveau de connaissance du public : ${values.audienceAwareness}`,
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif',
    `- Objectif principal : ${values.communicationGoal}`,
    `- Message central : ${values.keyMessage}`,
    optionalLine('Action ou résultat attendu', values.desiredAction),
    '',
    '## Précisions',
    `- Type de contenu : ${values.contentType}`,
    `- Canal principal : ${values.primaryChannel}`,
    `- Ton : ${values.tone}`,
    `- Format de réponse : ${values.outputFormat}`,
    optionalLine('Proposition de valeur', values.valueProposition),
    optionalLine('Preuves et informations vérifiables', values.proofPoints),
    optionalLine('Règles de marque et de vocabulaire', values.brandGuidelines),
    optionalLine('Contraintes éthiques, réglementaires et mentions', values.legalEthicalConstraints),
    optionalLine('Indicateurs de réussite', values.successIndicators),
    optionalLine('Contraintes éditoriales et éléments à éviter', values.constraints),
    '',
    '## Consigne finale',
    'Produis le contenu demandé en l’adaptant au public, à son niveau de connaissance et au canal choisi. Hiérarchise le message, présente une valeur concrète et termine par l’action attendue lorsqu’elle est pertinente. Distingue les faits vérifiés des formulations éditoriales. N’invente aucun chiffre, résultat, certification, témoignage, avis, partenariat, disponibilité, prix ou urgence. Signale clairement toute preuve, source ou mention manquante. Écarte les fausses promesses, la pression artificielle, les interfaces trompeuses et toute formulation manipulatrice. Termine par une liste de vérifications humaines avant diffusion.',
  ].join('\n');
}

export const marketingCommunicationCategory: StudioCategoryConfig<MarketingCommunicationValues> = {
  id: 'marketing-communication',
  label: 'Marketing et communication',
  shortDescription: 'Cadrer un contenu, une campagne ou un argumentaire crédible, vérifiable et adapté à son public.',
  schema: marketingCommunicationSchema,
  defaultValues: {
    campaignContext: '',
    offerDescription: '',
    targetAudience: '',
    audienceAwareness: 'public connaissant le besoin mais pas encore la solution proposée',
    role: 'un responsable marketing et communication, clair, responsable, attentif au public et à la vérification de chaque affirmation',
    communicationGoal: 'faire connaître une offre, une ressource ou une initiative',
    keyMessage: '',
    desiredAction: '',
    contentType: 'page de présentation d’une offre ou d’un service',
    primaryChannel: 'site internet ou page de destination',
    tone: 'professionnel, clair et accessible',
    outputFormat: 'contenu final structuré avec titres, paragraphes courts et appel à l’action',
    valueProposition: '',
    proofPoints: '',
    brandGuidelines: '',
    legalEthicalConstraints: '',
    successIndicators: '',
    constraints: '',
  },
  fields: [
    {
      name: 'campaignContext',
      label: 'Situation et contexte de communication',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez l’occasion, les enjeux et les contenus existants sans fournir de données personnelles ou confidentielles.',
      placeholder: 'Exemple : présenter une nouvelle ressource professionnelle fictive sur le site et dans une newsletter mensuelle.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'offerDescription',
      label: 'Offre, service, ressource ou sujet à présenter',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez factuellement ce qui est proposé, ses caractéristiques et ses limites.',
      placeholder: 'Exemple : guide pratique gratuit proposant une méthode en quatre étapes et des exemples professionnels fictifs.',
      required: true,
      maxLength: 800,
      rows: 4,
    },
    {
      name: 'targetAudience',
      label: 'Public visé, besoins et freins',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez un groupe ou une fonction sans profil personnel identifiable ni ciblage fondé sur une donnée sensible.',
      placeholder: 'Exemple : responsables pédagogiques recherchant une méthode simple, mais disposant de peu de temps pour comparer les solutions.',
      required: true,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'audienceAwareness',
      label: 'Niveau de connaissance du public',
      type: 'select',
      cropSection: 'context',
      help: 'Le message ne sera pas construit de la même manière pour un public qui découvre le besoin ou compare déjà des solutions.',
      required: true,
      options: [
        { value: 'public découvrant le sujet ou le besoin', label: 'Découvre le sujet' },
        { value: 'public connaissant le besoin mais pas encore la solution proposée', label: 'Connaît le besoin' },
        { value: 'public comparant plusieurs solutions', label: 'Compare des solutions' },
        { value: 'public connaissant déjà l’offre ou la marque', label: 'Connaît déjà l’offre' },
        { value: 'public déjà utilisateur à informer, fidéliser ou accompagner', label: 'Déjà utilisateur' },
      ],
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez le domaine, la posture, la connaissance du public et l’exigence de fiabilité.',
      required: true,
      maxLength: 340,
      autoComplete: 'off',
    },
    {
      name: 'communicationGoal',
      label: 'Objectif principal de communication',
      type: 'select',
      cropSection: 'objective',
      help: 'Choisissez l’effet principal recherché, sans garantir un résultat commercial.',
      required: true,
      options: [
        { value: 'faire connaître une offre, une ressource ou une initiative', label: 'Faire connaître' },
        { value: 'expliquer une offre et faciliter sa compréhension', label: 'Expliquer' },
        { value: 'faire considérer une solution parmi plusieurs options', label: 'Faire considérer' },
        { value: 'obtenir une demande d’information, un contact ou une inscription', label: 'Obtenir un contact ou une inscription' },
        { value: 'préparer une décision d’achat sans pression artificielle', label: 'Préparer une décision' },
        { value: 'informer et accompagner des clients ou utilisateurs existants', label: 'Informer ou fidéliser' },
        { value: 'construire un plan de communication multicanal', label: 'Planifier une communication' },
      ],
    },
    {
      name: 'keyMessage',
      label: 'Message central à retenir',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Formulez une idée centrale crédible, reliée au besoin du public et aux éléments réellement disponibles.',
      placeholder: 'Exemple : cette ressource fournit une méthode simple pour structurer une demande et vérifier le résultat obtenu.',
      required: true,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'desiredAction',
      label: 'Action ou résultat attendu auprès du public',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Précisez une action simple, réaliste et sans mécanisme de pression.',
      placeholder: 'Exemple : consulter la page détaillée, télécharger le guide puis décider librement s’il répond au besoin.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'contentType',
      label: 'Type de contenu marketing ou de communication',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez le livrable principal à préparer.',
      required: true,
      options: [
        { value: 'page de présentation d’une offre ou d’un service', label: 'Page de présentation' },
        { value: 'page de destination structurée autour d’une action principale', label: 'Page de destination' },
        { value: 'newsletter ou courriel de communication à une liste autorisée', label: 'Newsletter' },
        { value: 'brochure, dépliant ou fiche de présentation', label: 'Brochure ou dépliant' },
        { value: 'argumentaire commercial factuel et vérifiable', label: 'Argumentaire commercial' },
        { value: 'campagne publicitaire avec plusieurs variantes de message', label: 'Campagne publicitaire' },
        { value: 'communiqué ou annonce institutionnelle', label: 'Communiqué ou annonce' },
        { value: 'plan de communication avec messages, canaux et calendrier', label: 'Plan de communication' },
        { value: 'foire aux questions destinée à lever les objections', label: 'FAQ marketing' },
      ],
    },
    {
      name: 'primaryChannel',
      label: 'Canal principal',
      type: 'select',
      cropSection: 'precisions',
      help: 'Le canal influence la longueur, la structure, les mentions et l’appel à l’action.',
      required: true,
      options: [
        { value: 'site internet ou page de destination', label: 'Site ou page de destination' },
        { value: 'courriel ou newsletter envoyée à une liste autorisée', label: 'Courriel ou newsletter' },
        { value: 'document imprimé ou PDF', label: 'Document imprimé ou PDF' },
        { value: 'présentation ou rendez-vous commercial', label: 'Présentation ou rendez-vous' },
        { value: 'publicité numérique payante', label: 'Publicité numérique' },
        { value: 'communication interne', label: 'Communication interne' },
        { value: 'plusieurs canaux avec adaptation distincte', label: 'Communication multicanale' },
      ],
    },
    {
      name: 'tone',
      label: 'Ton et posture',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez un ton cohérent avec le public et la crédibilité recherchée.',
      required: true,
      options: [
        { value: 'professionnel, clair et accessible', label: 'Professionnel et accessible' },
        { value: 'pédagogique, rassurant et concret', label: 'Pédagogique et rassurant' },
        { value: 'sobre, factuel et institutionnel', label: 'Sobre et institutionnel' },
        { value: 'direct, dynamique et respectueux', label: 'Direct et dynamique' },
        { value: 'expert, précis et sans jargon inutile', label: 'Expert et précis' },
      ],
    },
    {
      name: 'outputFormat',
      label: 'Format de réponse attendu',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez entre un contenu final, une structure ou plusieurs variantes à comparer.',
      required: true,
      options: [
        { value: 'contenu final structuré avec titres, paragraphes courts et appel à l’action', label: 'Contenu final structuré' },
        { value: 'plan détaillé avec fonction et message de chaque section', label: 'Plan détaillé' },
        { value: 'trois variantes complètes avec des angles clairement différenciés', label: 'Trois variantes' },
        { value: 'tableau de plan de communication avec public, message, canal, moment et contrôle', label: 'Tableau de plan de communication' },
        { value: 'audit éditorial suivi d’une proposition réécrite', label: 'Audit et réécriture' },
      ],
    },
    {
      name: 'valueProposition',
      label: 'Proposition de valeur et bénéfice concret',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Expliquez ce que le public peut réellement obtenir et ce qui différencie la proposition, sans promesse absolue.',
      placeholder: 'Exemple : une méthode courte, documentée et réutilisable qui aide à repérer les informations manquantes avant utilisation.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'proofPoints',
      label: 'Preuves et informations vérifiables disponibles',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez uniquement les caractéristiques, chiffres, sources, labels ou témoignages réellement utilisables.',
      placeholder: 'Exemple : contenu du guide validé, accès gratuit confirmé et exemples fictifs relus ; aucun témoignage disponible.',
      required: false,
      maxLength: 800,
      rows: 3,
    },
    {
      name: 'brandGuidelines',
      label: 'Règles de marque, vocabulaire et identité',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez la voix, les mots autorisés ou interdits, les mentions et les repères de charte utiles.',
      placeholder: 'Exemple : ton pédagogique, vouvoiement, phrases courtes, vocabulaire concret et aucune promesse excessive.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'legalEthicalConstraints',
      label: 'Contraintes éthiques, réglementaires et mentions obligatoires',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Signalez les consentements, secteurs réglementés, mentions obligatoires et pratiques à exclure. Une validation compétente peut rester nécessaire.',
      placeholder: 'Exemple : aucune fausse urgence, consentement requis pour les courriels, prix et conditions à vérifier avant diffusion.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'successIndicators',
      label: 'Indicateurs de réussite',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Choisissez des indicateurs liés à l’objectif sans transformer une estimation en garantie.',
      placeholder: 'Exemple : compréhension du message lors d’une relecture test et nombre de consultations qualifiées de la page.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'constraints',
      label: 'Contraintes éditoriales et éléments à éviter',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez la longueur, la structure, les mots à éviter et les vérifications finales.',
      placeholder: 'Exemple : 600 mots maximum, aucune comparaison non sourcée, aucun superlatif et liens à ajouter manuellement.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
  ],
  requiredInformation: [
    'La situation, l’offre ou le sujet à présenter',
    'Le public et son niveau de connaissance',
    'L’objectif et le message central',
    'Le type de contenu, le canal, le ton et le format',
    'Les preuves disponibles et les limites à respecter',
  ],
  buildPrompt: buildMarketingCommunicationPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision de la situation, de l’offre, du public et de son niveau de connaissance.',
      checkpoints: [
        'Situation : 4, 7 ou 10 points.',
        'Offre ou sujet : 3, 5 ou 7 points.',
        'Public : 2, 4 ou 6 points.',
        'Niveau de connaissance défini : 2 points.',
      ],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Précision de la stratégie, de la compétence éditoriale et de la responsabilité attendues.',
      checkpoints: ['Rôle court : 8 points.', 'Rôle précisé : 12 points.', 'Rôle complet : 15 points.'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté de la finalité, du message central et de l’action attendue.',
      checkpoints: [
        'Objectif sélectionné : 5 points.',
        'Message central : 7, 10 ou 13 points.',
        'Action attendue : 0, 4 ou 7 points.',
      ],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Définition du support, de la valeur, des preuves, de la marque, des limites et des indicateurs.',
      checkpoints: [
        'Contenu, canal, ton et format : 12 points.',
        'Proposition de valeur : 0, 4 ou 6 points.',
        'Preuves : 0, 3 ou 5 points.',
        'Règles de marque : 0, 2 ou 4 points.',
        'Éthique et réglementation : 0, 2 ou 4 points.',
        'Indicateurs : 0, 1 ou 2 points.',
        'Contraintes éditoriales : 0, 1 ou 2 points.',
      ],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Décrivez l’offre et le public avant de choisir le message, le support, les preuves et l’action attendue.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. N’utilisez aucune liste de contacts, donnée de ciblage individuelle ou information client réelle.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Marketing et communication et sur une grille CROP déterministe documentée.',
  },
  beforeAfter: {
    vagueRequest: '« Écris une page marketing très convaincante pour mon service. »',
    missingDescription: 'Le public, les faits vérifiables, la proposition de valeur, l’action attendue et les limites ne sont pas définis.',
    structuredPrompt: '« Contexte : présenter une ressource professionnelle gratuite. Public : responsables pédagogiques connaissant leur besoin. Rôle : responsable communication rigoureux. Objectif : expliquer la valeur et inviter à consulter la ressource. Précisions : page structurée, ton accessible, caractéristiques validées uniquement, aucune urgence artificielle, mentions à vérifier et indicateurs de compréhension. »',
    benefit: 'Le contenu peut rester crédible, adapté au public et contrôlable avant sa diffusion.',
  },
  examples: [
    {
      title: 'Page de présentation',
      description: 'Présenter une offre avec une valeur concrète, des preuves délimitées et une action claire.',
      prompt: 'Prépare une page structurée pour une ressource professionnelle. Distingue les caractéristiques validées, les bénéfices raisonnables, les informations à compléter et l’action proposée.',
    },
    {
      title: 'Newsletter responsable',
      description: 'Informer une liste autorisée sans pression artificielle.',
      prompt: 'Rédige une newsletter courte avec objet, introduction, bénéfice concret et lien à ajouter. N’invente aucun résultat et rappelle les mentions ou contrôles nécessaires avant envoi.',
    },
    {
      title: 'Plan de communication',
      description: 'Organiser des messages cohérents sur plusieurs canaux.',
      prompt: 'Construis un tableau avec public, objectif, message, canal, moment, responsable et indicateur. Prévois une adaptation par canal et un contrôle des preuves avant diffusion.',
    },
  ],
  recommendations: [
    'Reliez chaque affirmation importante à une preuve réellement disponible ou indiquez qu’elle reste à compléter.',
    'Utilisez un appel à l’action clair et proportionné, sans urgence ni rareté artificielle.',
    'Faites relire les prix, conditions, consentements et mentions réglementaires avant diffusion.',
  ],
};
