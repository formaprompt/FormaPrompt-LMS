import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const socialMediaSchema = z.object({
  contentContext: z.string().trim().min(20, 'Décrivez le sujet et le contexte en au moins 20 caractères.').max(700, 'Limitez le contexte à 700 caractères.'),
  audience: z.string().trim().min(5, 'Décrivez le public visé.').max(240, 'Limitez le public visé à 240 caractères.'),
  platform: z.string().trim().min(1, 'Choisissez une plateforme.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(280, 'Limitez le rôle à 280 caractères.'),
  communicationObjective: z.string().trim().min(15, 'Décrivez l’objectif en au moins 15 caractères.').max(600, 'Limitez l’objectif à 600 caractères.'),
  successCriteria: z.string().trim().max(400, 'Limitez les critères de réussite à 400 caractères.'),
  tone: z.string().trim().min(1, 'Choisissez un ton.'),
  contentFormat: z.string().trim().min(1, 'Choisissez un format.'),
  keyMessage: z.string().trim().min(15, 'Précisez le message essentiel en au moins 15 caractères.').max(500, 'Limitez le message essentiel à 500 caractères.'),
  callToAction: z.string().trim().max(300, 'Limitez l’action attendue à 300 caractères.'),
  requiredElements: z.string().trim().max(500, 'Limitez les éléments obligatoires à 500 caractères.'),
  constraints: z.string().trim().max(600, 'Limitez les contraintes à 600 caractères.'),
}).strict();

export type SocialMediaValues = z.infer<typeof socialMediaSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: SocialMediaValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const contextLength = textLength(values.contentContext);

  if (contextLength >= 80) {
    earnedPoints += 12;
    present.push('Le sujet et son contexte sont décrits avec des repères exploitables.');
  } else if (contextLength >= 40) {
    earnedPoints += 9;
    present.push('Le sujet général de la publication est compréhensible.');
    missing.push('Les faits, l’occasion ou le contexte qui rendent la publication utile.');
  } else {
    earnedPoints += 6;
    present.push('Un premier sujet de publication est indiqué.');
    missing.push('Le contexte, les faits autorisés et l’intérêt du sujet pour le public.');
  }

  const audienceLength = textLength(values.audience);
  if (audienceLength >= 30) {
    earnedPoints += 7;
    present.push('Le public est décrit avec suffisamment de précision.');
  } else if (audienceLength >= 12) {
    earnedPoints += 5;
    present.push('Le public principal est indiqué.');
    missing.push('Les besoins, le niveau d’information ou le contexte du public.');
  } else {
    earnedPoints += 3;
    present.push('Un public est mentionné.');
    missing.push('Une description plus précise des personnes auxquelles la publication s’adresse.');
  }

  if (values.platform) {
    earnedPoints += 6;
    present.push(`La plateforme « ${values.platform} » est définie.`);
  } else {
    missing.push('La plateforme de publication.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez le contexte, le public et la plateforme afin d’adapter le contenu aux usages réels du canal.',
  };
}

function evaluateRole(values: SocialMediaValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 55) {
    return {
      earnedPoints: 15,
      present: ['La compétence éditoriale et la posture attendue sont clairement définies.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond à votre activité, à votre public et à la plateforme retenue.',
    };
  }
  if (length >= 28) {
    return {
      earnedPoints: 12,
      present: ['Un rôle de communication est attribué à l’assistant.'],
      missing: ['La spécialité, la posture ou la responsabilité éditoriale attendue.'],
      recommendation: 'Ajoutez la spécialité et la posture attendues, par exemple communication pédagogique, institutionnelle ou professionnelle.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une compétence éditoriale et une posture adaptées au public.'],
    recommendation: 'Précisez le rôle : domaine, public, ton général et responsabilité concernant la fiabilité des informations.',
  };
}

function evaluateObjective(values: SocialMediaValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const objectiveLength = textLength(values.communicationObjective);

  if (objectiveLength >= 70) {
    earnedPoints += 17;
    present.push('L’objectif décrit un effet attendu et une action ou compréhension recherchée.');
  } else if (objectiveLength >= 35) {
    earnedPoints += 13;
    present.push('L’objectif principal de communication est compréhensible.');
    missing.push('L’effet concret recherché auprès du public.');
  } else {
    earnedPoints += 8;
    present.push('Une intention de communication est indiquée.');
    missing.push('Ce que le public doit comprendre, retenir ou faire après la publication.');
  }

  const criteriaLength = textLength(values.successCriteria);
  if (criteriaLength >= 40) {
    earnedPoints += 8;
    present.push('Des critères observables permettent de relire la publication.');
  } else if (criteriaLength >= 15) {
    earnedPoints += 5;
    present.push('Un premier critère de réussite est fourni.');
    missing.push('Des critères éditoriaux plus précis et contrôlables.');
  } else {
    missing.push('Les critères permettant de vérifier la clarté, l’exactitude ou l’action attendue.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Indiquez ce que le public doit comprendre ou faire et comment vous relirez le contenu avant publication.',
  };
}

function evaluatePrecisions(values: SocialMediaValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];

  if (values.tone) {
    earnedPoints += 7;
    present.push(`Le ton « ${values.tone} » est défini.`);
  } else {
    missing.push('Le ton de la publication.');
  }

  if (values.contentFormat) {
    earnedPoints += 7;
    present.push(`Le format « ${values.contentFormat} » est demandé.`);
  } else {
    missing.push('Le format éditorial attendu.');
  }

  const messageLength = textLength(values.keyMessage);
  if (messageLength >= 45) {
    earnedPoints += 7;
    present.push('Le message essentiel est clairement formulé.');
  } else {
    earnedPoints += 4;
    present.push('Un message principal est indiqué.');
    missing.push('Une formulation plus précise de l’idée que le public doit retenir.');
  }

  const actionLength = textLength(values.callToAction);
  if (actionLength >= 30) {
    earnedPoints += 6;
    present.push('L’action proposée au public est détaillée.');
  } else if (actionLength >= 10) {
    earnedPoints += 4;
    present.push('Une action est proposée au public.');
    missing.push('Une action plus explicite et réaliste.');
  } else {
    missing.push('Une action attendue, si elle est utile pour cette publication.');
  }

  const requiredLength = textLength(values.requiredElements);
  if (requiredLength >= 20) {
    earnedPoints += 4;
    present.push('Les éléments obligatoires sont détaillés.');
  } else {
    missing.push('Les informations, mentions ou mots-clés qui doivent apparaître.');
  }

  const constraintsLength = textLength(values.constraints);
  if (constraintsLength >= 30) {
    earnedPoints += 4;
    present.push('Les limites éditoriales sont clairement définies.');
  } else {
    missing.push('Les limites de longueur, les éléments à éviter ou les règles de vérification.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez le ton, le format, le message essentiel, l’action attendue et les limites avant publication.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildSocialMediaPrompt(values: SocialMediaValues) {
  return [
    '## Contexte',
    `- Sujet et contexte : ${values.contentContext}`,
    `- Public visé : ${values.audience}`,
    `- Plateforme : ${values.platform}`,
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif',
    values.communicationObjective,
    optionalLine('Critères de réussite', values.successCriteria),
    '',
    '## Précisions',
    `- Ton : ${values.tone}`,
    `- Format : ${values.contentFormat}`,
    `- Message essentiel : ${values.keyMessage}`,
    optionalLine('Action proposée au public', values.callToAction),
    optionalLine('Éléments obligatoires', values.requiredElements),
    optionalLine('Contraintes et éléments à éviter', values.constraints),
    '',
    '## Consigne finale',
    'Rédige une proposition adaptée à la plateforme et au public. Commence par une accroche utile, développe une seule idée directrice et termine par l’action indiquée si elle est pertinente. N’invente aucun chiffre, témoignage, résultat ou information absente. Signale les éléments factuels à vérifier avant publication.',
  ].join('\n');
}

export const socialMediaCategory: StudioCategoryConfig<SocialMediaValues> = {
  id: 'social-media',
  label: 'Réseaux sociaux',
  shortDescription: 'Préparer une publication adaptée à une plateforme, un public et un objectif de communication.',
  schema: socialMediaSchema,
  defaultValues: {
    contentContext: '',
    audience: '',
    platform: 'LinkedIn',
    role: 'un rédacteur spécialisé en communication professionnelle claire, crédible et adaptée aux réseaux sociaux',
    communicationObjective: '',
    successCriteria: '',
    tone: 'professionnel et accessible',
    contentFormat: 'publication structurée avec une accroche et des paragraphes courts',
    keyMessage: '',
    callToAction: '',
    requiredElements: '',
    constraints: '',
  },
  fields: [
    {
      name: 'contentContext',
      label: 'Décrivez le sujet et son contexte',
      type: 'textarea',
      cropSection: 'context',
      help: 'Expliquez l’occasion, les faits autorisés et l’intérêt du sujet sans citer de personne ou de dossier réel.',
      placeholder: 'Exemple : présenter une nouvelle ressource gratuite consacrée à la rédaction de consignes professionnelles claires.',
      required: true,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'audience',
      label: 'À quel public s’adresse la publication ?',
      type: 'text',
      cropSection: 'context',
      help: 'Décrivez un groupe, une fonction ou un besoin sans utiliser de profil personnel identifiable.',
      placeholder: 'Exemple : responsables pédagogiques et formateurs indépendants débutant avec les outils numériques',
      required: true,
      maxLength: 240,
      autoComplete: 'off',
    },
    {
      name: 'platform',
      label: 'Plateforme principale',
      type: 'select',
      cropSection: 'context',
      help: 'Le canal influence la longueur, le rythme et les conventions éditoriales.',
      required: true,
      options: [
        { value: 'LinkedIn', label: 'LinkedIn' },
        { value: 'Facebook', label: 'Facebook' },
        { value: 'Instagram', label: 'Instagram' },
        { value: 'X', label: 'X' },
        { value: 'plusieurs plateformes avec une adaptation distincte pour chacune', label: 'Plusieurs plateformes' },
      ],
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez la compétence éditoriale, le domaine et la posture attendue.',
      required: true,
      maxLength: 280,
      autoComplete: 'off',
    },
    {
      name: 'communicationObjective',
      label: 'Objectif de la publication',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez ce que le public doit comprendre, retenir ou faire après la lecture.',
      placeholder: 'Exemple : faire connaître la ressource et inviter les lecteurs à la consulter pour préparer leur prochaine activité.',
      required: true,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'successCriteria',
      label: 'Critères de réussite éditoriaux',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Décrivez des critères contrôlables avant publication, sans promettre un niveau d’engagement.',
      placeholder: 'Exemple : le sujet est compris dès les deux premières phrases, le bénéfice est concret et le lien est introduit clairement.',
      required: false,
      maxLength: 400,
      rows: 3,
    },
    {
      name: 'tone',
      label: 'Ton de la publication',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez un ton cohérent avec votre activité, le sujet et le public.',
      required: true,
      options: [
        { value: 'professionnel et accessible', label: 'Professionnel et accessible' },
        { value: 'pédagogique et encourageant', label: 'Pédagogique et encourageant' },
        { value: 'direct et factuel', label: 'Direct et factuel' },
        { value: 'chaleureux et mobilisateur', label: 'Chaleureux et mobilisateur' },
        { value: 'sobre et institutionnel', label: 'Sobre et institutionnel' },
      ],
    },
    {
      name: 'contentFormat',
      label: 'Format éditorial attendu',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez une structure compatible avec la plateforme et votre intention.',
      required: true,
      options: [
        { value: 'publication structurée avec une accroche et des paragraphes courts', label: 'Publication structurée' },
        { value: 'publication courte en moins de 600 caractères', label: 'Publication courte' },
        { value: 'plan de carrousel avec un titre et une idée par écran', label: 'Plan de carrousel' },
        { value: 'série de publications courtes reliées par une progression', label: 'Série ou fil de publications' },
        { value: 'publication avec une liste de conseils pratiques', label: 'Liste de conseils' },
      ],
    },
    {
      name: 'keyMessage',
      label: 'Message essentiel à retenir',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Formulez l’idée principale en une ou deux phrases, avec des faits vérifiables.',
      placeholder: 'Exemple : une consigne bien structurée aide à réduire les ambiguïtés et facilite la vérification du résultat.',
      required: true,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'callToAction',
      label: 'Action proposée au public',
      type: 'text',
      cropSection: 'precisions',
      help: 'Proposez une action simple et réaliste si elle est utile : consulter, télécharger, commenter ou contacter.',
      placeholder: 'Exemple : consulter le guide puis tester la méthode sur une demande professionnelle.',
      required: false,
      maxLength: 300,
      autoComplete: 'off',
    },
    {
      name: 'requiredElements',
      label: 'Éléments obligatoires',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez les mentions, liens, mots-clés ou informations qui doivent apparaître.',
      placeholder: 'Exemple : nom de la ressource, gratuité, lien à ajouter manuellement et mention de la méthode CROP.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'constraints',
      label: 'Contraintes et éléments à éviter',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez la longueur, les mots à éviter, l’usage des émojis, des mots-dièse et les vérifications nécessaires.',
      placeholder: 'Exemple : moins de 1 200 caractères, deux émojis maximum, aucun résultat chiffré inventé et trois mots-dièse pertinents au maximum.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
  ],
  requiredInformation: [
    'Le sujet et son contexte',
    'Le public et la plateforme',
    'Le rôle éditorial attendu',
    'L’objectif de communication',
    'Le ton, le format et le message essentiel',
  ],
  buildPrompt: buildSocialMediaPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision du sujet, du public et de la plateforme de publication.',
      checkpoints: [
        'Sujet et contexte : 6, 9 ou 12 points.',
        'Public : 3, 5 ou 7 points.',
        'Plateforme sélectionnée : 6 points.',
      ],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Précision de la compétence éditoriale et de la posture attendues.',
      checkpoints: ['Rôle court : 8 points.', 'Rôle précisé : 12 points.', 'Posture et compétence détaillées : 15 points.'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté de l’effet recherché et présence de critères éditoriaux contrôlables.',
      checkpoints: [
        'Objectif : 8, 13 ou 17 points selon son niveau de détail.',
        'Critères de réussite : 0, 5 ou 8 points.',
      ],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Définition du ton, du format, du message, de l’action et des limites éditoriales.',
      checkpoints: [
        'Ton : 7 points.',
        'Format : 7 points.',
        'Message essentiel : 4 ou 7 points.',
        'Action proposée : 0, 4 ou 6 points.',
        'Éléments obligatoires : 0 ou 4 points.',
        'Contraintes : 0 ou 4 points.',
      ],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Commencez par le sujet, le public et la plateforme. Les précisions éditoriales permettent ensuite de construire une publication plus facile à relire.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. N’utilisez ni témoignage, ni photo, ni identité sans base légale et autorisation adaptées.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Réseaux sociaux et sur une grille CROP déterministe documentée.',
  },
  beforeAfter: {
    vagueRequest: '« Fais-moi un post LinkedIn pour parler de ma formation. »',
    missingDescription: 'Le public, le bénéfice concret, le message principal, l’action attendue et les limites éditoriales ne sont pas définis.',
    structuredPrompt: '« Contexte : présenter une ressource gratuite sur la rédaction de consignes. Public : responsables pédagogiques débutants. Plateforme : LinkedIn. Rôle : rédacteur en communication pédagogique. Objectif : expliquer l’utilité de la méthode et inviter à consulter la ressource. Précisions : ton professionnel, accroche claire, moins de 1 200 caractères, aucun chiffre inventé et trois mots-dièse maximum. »',
    benefit: 'La publication peut être vérifiée avant diffusion et adaptée au canal choisi.',
  },
  examples: [
    {
      title: 'Publication LinkedIn pédagogique',
      description: 'Présenter une ressource professionnelle avec un bénéfice concret et une action simple.',
      prompt: `## Contexte
Présenter un guide gratuit consacré à la méthode CROP à des responsables pédagogiques et formateurs indépendants sur LinkedIn.

## Rôle
Agis comme un rédacteur spécialisé en communication pédagogique claire et crédible.

## Objectif
Expliquer en quoi une demande structurée facilite la préparation et la vérification d’un résultat, puis inviter à consulter le guide.

## Précisions
Adopte un ton professionnel et accessible. Rédige moins de 1 200 caractères avec une accroche, trois courts paragraphes et une invitation finale. N’invente aucun chiffre et utilise trois mots-dièse maximum.`,
    },
    {
      title: 'Carrousel de conseils',
      description: 'Préparer un plan de carrousel progressif sans produire d’image.',
      prompt: `## Contexte
Préparer un carrousel Instagram destiné à des adultes qui découvrent les bonnes pratiques de confidentialité numérique.

## Rôle
Agis comme un concepteur éditorial pédagogique attentif à la clarté et à l’accessibilité.

## Objectif
Faire retenir cinq réflexes simples avant de saisir des informations dans un service en ligne.

## Précisions
Propose un titre et une idée par écran pour sept écrans : introduction, cinq conseils et synthèse. Utilise des phrases courtes, aucun exemple personnel et aucune promesse de sécurité absolue.`,
    },
    {
      title: 'Annonce d’un atelier',
      description: 'Structurer une annonce factuelle à compléter avec des informations vérifiées.',
      prompt: `## Contexte
Annoncer sur Facebook un atelier fictif d’initiation aux outils bureautiques destiné à des adultes débutants.

## Rôle
Agis comme un chargé de communication de proximité, précis et accueillant.

## Objectif
Présenter le contenu de l’atelier et inviter les personnes intéressées à consulter les modalités d’inscription.

## Précisions
Adopte un ton chaleureux et factuel. Prévois des emplacements clairement signalés pour la date, le lieu et le lien. N’invente aucune disponibilité, aucun tarif et aucune modalité d’inscription.`,
    },
  ],
  recommendations: [
    'Adapter réellement la longueur et la structure à la plateforme choisie.',
    'Séparer les faits vérifiés des formulations éditoriales et bannir les résultats inventés.',
    'Relire les mentions, liens, droits d’image et données personnelles avant toute publication.',
  ],
};
