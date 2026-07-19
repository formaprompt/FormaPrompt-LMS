import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const imageCreationSchema = z.object({
  visualNeed: z.string().trim().min(10, 'Décrivez le sujet principal en au moins 10 caractères.').max(400, 'Limitez le sujet principal à 400 caractères.'),
  actionPosture: z.string().trim().min(10, 'Décrivez l’action ou la posture en au moins 10 caractères.').max(400, 'Limitez l’action ou la posture à 400 caractères.'),
  decor: z.string().trim().min(10, 'Décrivez le décor en au moins 10 caractères.').max(400, 'Limitez le décor à 400 caractères.'),
  audience: z.string().trim().min(5, 'Décrivez le public auquel l’image est destinée.').max(240, 'Limitez le public à 240 caractères.'),
  intendedUse: z.string().trim().min(1, 'Choisissez un usage.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(280, 'Limitez le rôle à 280 caractères.'),
  visualObjective: z.string().trim().min(15, 'Décrivez l’objectif visuel en au moins 15 caractères.').max(600, 'Limitez l’objectif à 600 caractères.'),
  successCriteria: z.string().trim().max(500, 'Limitez les critères de réussite à 500 caractères.'),
  style: z.string().trim().min(1, 'Choisissez un style.'),
  composition: z.string().trim().min(1, 'Choisissez une composition.'),
  viewAngle: z.string().trim().min(1, 'Choisissez un angle de vue.'),
  lighting: z.string().trim().min(5, 'Décrivez la lumière en au moins 5 caractères.').max(300, 'Limitez la lumière à 300 caractères.'),
  mood: z.string().trim().min(5, 'Décrivez l’ambiance en au moins 5 caractères.').max(300, 'Limitez l’ambiance à 300 caractères.'),
  colors: z.string().trim().min(5, 'Décrivez les couleurs en au moins 5 caractères.').max(300, 'Limitez les couleurs à 300 caractères.'),
  aspectRatio: z.string().trim().min(1, 'Choisissez un format.'),
  realismLevel: z.string().trim().min(1, 'Choisissez un niveau de réalisme.'),
  textInImage: z.string().trim().min(1, 'Indiquez si l’image doit contenir du texte.'),
  targetTool: z.string().trim().min(1, 'Choisissez l’outil visé.'),
  requiredElements: z.string().trim().max(600, 'Limitez les éléments obligatoires à 600 caractères.'),
  constraints: z.string().trim().min(5, 'Indiquez au moins un élément à éviter.').max(700, 'Limitez les contraintes à 700 caractères.'),
}).strict();

export type ImageCreationValues = z.infer<typeof imageCreationSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: ImageCreationValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const subjectLength = textLength(values.visualNeed);
  if (subjectLength >= 40) {
    earnedPoints += 7;
    present.push('Le sujet principal est décrit avec précision.');
  } else {
    earnedPoints += 4;
    present.push('Un sujet principal est indiqué.');
    missing.push('Les caractéristiques visuelles distinctives du sujet principal.');
  }

  const actionLength = textLength(values.actionPosture);
  if (actionLength >= 30) {
    earnedPoints += 5;
    present.push('L’action ou la posture est clairement décrite.');
  } else {
    earnedPoints += 3;
    present.push('Une action ou une posture est indiquée.');
    missing.push('Le geste, la position ou la relation entre les sujets.');
  }

  const decorLength = textLength(values.decor);
  if (decorLength >= 30) {
    earnedPoints += 5;
    present.push('Le décor et l’environnement sont clairement définis.');
  } else {
    earnedPoints += 3;
    present.push('Un décor est indiqué.');
    missing.push('Les éléments de l’arrière-plan et leur niveau de détail.');
  }

  const audienceLength = textLength(values.audience);
  if (audienceLength >= 30) {
    earnedPoints += 4;
    present.push('Le public destinataire est décrit avec suffisamment de précision.');
  } else {
    earnedPoints += 2;
    present.push('Un public est mentionné.');
    missing.push('Le contexte ou les attentes utiles du public destinataire.');
  }

  if (values.intendedUse) {
    earnedPoints += 4;
    present.push(`L’usage « ${values.intendedUse} » est défini.`);
  } else {
    missing.push('L’usage prévu pour l’image.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Décrivez séparément le sujet, son action ou sa posture, le décor, le public et l’usage final.',
  };
}

function evaluateRole(values: ImageCreationValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 55) {
    return {
      earnedPoints: 15,
      present: ['La compétence visuelle et la responsabilité de conception sont clairement définies.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond au support, au public et à l’identité visuelle recherchée.',
    };
  }
  if (length >= 28) {
    return {
      earnedPoints: 12,
      present: ['Un rôle de conception visuelle est attribué à l’assistant.'],
      missing: ['La spécialité, la sensibilité graphique ou la responsabilité attendue.'],
      recommendation: 'Ajoutez une spécialité, par exemple illustration pédagogique, direction artistique ou communication visuelle accessible.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une compétence visuelle et une posture adaptées au support.'],
    recommendation: 'Précisez le rôle : spécialité graphique, public, usage et attention portée à la lisibilité.',
  };
}

function evaluateObjective(values: ImageCreationValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const objectiveLength = textLength(values.visualObjective);

  if (objectiveLength >= 70) {
    earnedPoints += 17;
    present.push('L’objectif décrit clairement l’idée, l’émotion ou l’information à transmettre.');
  } else if (objectiveLength >= 35) {
    earnedPoints += 13;
    present.push('L’intention visuelle principale est compréhensible.');
    missing.push('L’effet concret recherché auprès du public.');
  } else {
    earnedPoints += 8;
    present.push('Une intention visuelle est indiquée.');
    missing.push('Ce que le public doit comprendre, ressentir ou repérer dans l’image.');
  }

  const criteriaLength = textLength(values.successCriteria);
  if (criteriaLength >= 40) {
    earnedPoints += 8;
    present.push('Des critères visuels observables permettent de contrôler le résultat.');
  } else if (criteriaLength >= 15) {
    earnedPoints += 5;
    present.push('Un premier critère de réussite est fourni.');
    missing.push('Des critères plus précis concernant la lisibilité, la hiérarchie ou la cohérence.');
  } else {
    missing.push('Les critères permettant de reconnaître une image conforme au besoin.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Indiquez ce que l’image doit transmettre et les signes visuels permettant de vérifier qu’elle remplit son objectif.',
  };
}

function evaluatePrecisions(values: ImageCreationValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];

  if (values.style) {
    earnedPoints += 3;
    present.push(`Le style « ${values.style} » est défini.`);
  } else {
    missing.push('Le style visuel.');
  }

  if (values.composition) {
    earnedPoints += 3;
    present.push(`La composition « ${values.composition} » est demandée.`);
  } else {
    missing.push('Le cadrage et la composition.');
  }

  if (values.viewAngle) {
    earnedPoints += 3;
    present.push(`L’angle de vue « ${values.viewAngle} » est défini.`);
  } else {
    missing.push('L’angle de vue.');
  }

  if (values.lighting) {
    earnedPoints += 3;
    present.push('La lumière est décrite.');
  } else {
    missing.push('La direction et la qualité de la lumière.');
  }

  if (values.mood) {
    earnedPoints += 3;
    present.push('L’ambiance recherchée est décrite.');
  } else {
    missing.push('L’ambiance ou l’émotion générale.');
  }

  if (values.colors) {
    earnedPoints += 3;
    present.push('La palette de couleurs est précisée.');
  } else {
    missing.push('Les couleurs dominantes et les contrastes.');
  }

  if (values.aspectRatio) {
    earnedPoints += 4;
    present.push(`Le format « ${values.aspectRatio} » est défini.`);
  } else {
    missing.push('Le format ou les proportions de l’image.');
  }

  if (values.realismLevel) {
    earnedPoints += 3;
    present.push(`Le niveau de réalisme « ${values.realismLevel} » est défini.`);
  } else {
    missing.push('Le niveau de réalisme.');
  }

  if (values.textInImage) {
    earnedPoints += 3;
    present.push(`La présence de texte est cadrée : « ${values.textInImage} ».`);
  } else {
    missing.push('La présence éventuelle de texte dans l’image.');
  }

  if (values.targetTool) {
    earnedPoints += 3;
    present.push(`L’outil visé « ${values.targetTool} » est défini.`);
  } else {
    missing.push('L’outil visuel visé.');
  }

  if (textLength(values.constraints) >= 20) {
    earnedPoints += 4;
    present.push('Les éléments à éviter sont clairement définis.');
  } else {
    earnedPoints += 2;
    present.push('Un premier élément à éviter est indiqué.');
    missing.push('Une liste plus complète des exclusions, limites ou droits à respecter.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez le style, le cadrage, l’angle, la lumière, l’ambiance, les couleurs, le ratio, le réalisme, le texte, l’outil et les exclusions.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildImageCreationPrompt(values: ImageCreationValues) {
  return [
    '## Contexte',
    `- Sujet principal : ${values.visualNeed}`,
    `- Action ou posture : ${values.actionPosture}`,
    `- Décor : ${values.decor}`,
    `- Public destinataire : ${values.audience}`,
    `- Usage prévu : ${values.intendedUse}`,
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif visuel',
    values.visualObjective,
    optionalLine('Critères de réussite', values.successCriteria),
    '',
    '## Précisions',
    `- Style : ${values.style}`,
    `- Cadrage et composition : ${values.composition}`,
    `- Angle de vue : ${values.viewAngle}`,
    `- Lumière : ${values.lighting}`,
    `- Ambiance : ${values.mood}`,
    `- Couleurs : ${values.colors}`,
    `- Format et ratio : ${values.aspectRatio}`,
    `- Niveau de réalisme : ${values.realismLevel}`,
    `- Texte dans l’image : ${values.textInImage}`,
    `- Outil visé : ${values.targetTool}`,
    optionalLine('Éléments obligatoires', values.requiredElements),
    `- Éléments à éviter : ${values.constraints}`,
    '',
    '## Consigne finale',
    'Crée une image cohérente avec le public, l’usage et l’objectif indiqués. Respecte la hiérarchie visuelle, la lisibilité et les contraintes. N’ajoute aucun logo, marque, texte, personne réelle ou élément protégé qui n’a pas été explicitement fourni et autorisé. Signale toute instruction contradictoire ou information indispensable manquante.',
  ].join('\n');
}

export const imageCreationCategory: StudioCategoryConfig<ImageCreationValues> = {
  id: 'image-creation',
  label: 'Création d’image',
  shortDescription: 'Structurer une consigne visuelle précise pour un support, un public et un objectif.',
  schema: imageCreationSchema,
  defaultValues: {
    visualNeed: '',
    actionPosture: '',
    decor: '',
    audience: '',
    intendedUse: 'illustration pour un support de formation',
    role: 'un directeur artistique spécialisé dans la communication pédagogique claire, accessible et professionnelle',
    visualObjective: '',
    successCriteria: '',
    style: 'illustration éditoriale moderne et professionnelle',
    composition: 'composition claire avec un sujet principal immédiatement identifiable',
    viewAngle: 'vue à hauteur des yeux',
    lighting: '',
    mood: '',
    colors: '',
    aspectRatio: 'format horizontal 16:9',
    realismLevel: 'semi-réaliste avec des détails maîtrisés',
    textInImage: 'aucun texte intégré dans l’image',
    targetTool: 'ChatGPT Images',
    requiredElements: '',
    constraints: '',
  },
  fields: [
    {
      name: 'visualNeed',
      label: 'Sujet principal',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez précisément la personne, l’objet, l’animal ou l’élément central sans identifier de personne réelle.',
      placeholder: 'Exemple : un adulte apprenant à utiliser un ordinateur portable.',
      required: true,
      maxLength: 400,
      rows: 3,
    },
    {
      name: 'actionPosture',
      label: 'Action ou posture',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez ce que fait le sujet, sa position, son expression générale et ses interactions.',
      placeholder: 'Exemple : assis face à l’écran, il construit un tableau pendant qu’un formateur lui montre une étape.',
      required: true,
      maxLength: 400,
      rows: 3,
    },
    {
      name: 'decor',
      label: 'Décor et environnement',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez le lieu, l’arrière-plan, les objets secondaires et leur niveau de détail.',
      placeholder: 'Exemple : salle de formation lumineuse, mobilier sobre, arrière-plan ordonné et peu chargé.',
      required: true,
      maxLength: 400,
      rows: 3,
    },
    {
      name: 'audience',
      label: 'À quel public l’image est-elle destinée ?',
      type: 'text',
      cropSection: 'context',
      help: 'Décrivez le groupe et son contexte sans donnée personnelle ni caractéristique sensible.',
      placeholder: 'Exemple : adultes en reconversion découvrant les outils bureautiques',
      required: true,
      maxLength: 240,
      autoComplete: 'off',
    },
    {
      name: 'intendedUse',
      label: 'Usage prévu pour l’image',
      type: 'select',
      cropSection: 'context',
      help: 'Le support détermine le niveau de détail, le cadrage et l’espace disponible.',
      required: true,
      options: [
        { value: 'illustration pour un support de formation', label: 'Support de formation' },
        { value: 'visuel pour une publication sur un réseau social', label: 'Réseau social' },
        { value: 'bannière pour une page web', label: 'Page web' },
        { value: 'illustration pour une présentation', label: 'Présentation' },
        { value: 'document professionnel destiné à l’impression', label: 'Document imprimé' },
      ],
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez la spécialité graphique, le public et l’attention attendue concernant la lisibilité.',
      required: true,
      maxLength: 280,
      autoComplete: 'off',
    },
    {
      name: 'visualObjective',
      label: 'Objectif visuel',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez ce que le public doit comprendre, ressentir ou repérer au premier regard.',
      placeholder: 'Exemple : montrer que l’apprentissage est progressif, concret et accessible à des personnes débutantes.',
      required: true,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'successCriteria',
      label: 'Critères de réussite visuels',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Décrivez les éléments observables permettant de contrôler la lisibilité et la cohérence.',
      placeholder: 'Exemple : le sujet principal est compris immédiatement, le décor reste discret et les contrastes sont suffisants.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'style',
      label: 'Style visuel',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez une direction générale cohérente avec le support et le public.',
      required: true,
      options: [
        { value: 'illustration éditoriale moderne et professionnelle', label: 'Illustration éditoriale' },
        { value: 'photographie réaliste et naturelle', label: 'Photographie réaliste' },
        { value: 'illustration pédagogique simple et accessible', label: 'Illustration pédagogique' },
        { value: 'infographie épurée avec formes géométriques', label: 'Infographie épurée' },
        { value: 'rendu en trois dimensions sobre et professionnel', label: 'Rendu 3D sobre' },
        { value: 'dessin au trait minimaliste', label: 'Dessin minimaliste' },
      ],
    },
    {
      name: 'composition',
      label: 'Cadrage et composition',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez la manière d’organiser le sujet et l’espace disponible.',
      required: true,
      options: [
        { value: 'composition claire avec un sujet principal immédiatement identifiable', label: 'Sujet principal clairement centré' },
        { value: 'composition asymétrique avec un espace libre destiné à un titre ajouté ensuite', label: 'Espace libre pour un titre' },
        { value: 'vue d’ensemble montrant la situation et son environnement', label: 'Vue d’ensemble' },
        { value: 'gros plan sur une action ou un détail essentiel', label: 'Gros plan' },
        { value: 'composition en étapes avec une progression de gauche à droite', label: 'Progression en étapes' },
      ],
    },
    {
      name: 'viewAngle',
      label: 'Angle de vue',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez la position de l’observateur par rapport au sujet.',
      required: true,
      options: [
        { value: 'vue à hauteur des yeux', label: 'À hauteur des yeux' },
        { value: 'vue légèrement en plongée', label: 'Légère plongée' },
        { value: 'vue en plongée depuis le dessus', label: 'Vue du dessus' },
        { value: 'vue légèrement en contre-plongée', label: 'Légère contre-plongée' },
        { value: 'vue de trois quarts', label: 'Vue de trois quarts' },
        { value: 'vue de profil', label: 'Vue de profil' },
      ],
    },
    {
      name: 'lighting',
      label: 'Lumière',
      type: 'text',
      cropSection: 'precisions',
      help: 'Décrivez la source, la direction, l’intensité et la douceur de la lumière.',
      placeholder: 'Exemple : lumière naturelle douce venant de la gauche, sans ombres dures.',
      required: true,
      maxLength: 300,
      autoComplete: 'off',
    },
    {
      name: 'mood',
      label: 'Ambiance',
      type: 'text',
      cropSection: 'precisions',
      help: 'Décrivez l’atmosphère ou l’émotion générale que l’image doit transmettre.',
      placeholder: 'Exemple : ambiance rassurante, studieuse, positive et accessible.',
      required: true,
      maxLength: 300,
      autoComplete: 'off',
    },
    {
      name: 'colors',
      label: 'Couleurs et contrastes',
      type: 'text',
      cropSection: 'precisions',
      help: 'Précisez les couleurs dominantes, les accents et le niveau de contraste.',
      placeholder: 'Exemple : verts et bleus sobres, fond clair et contraste élevé sur le sujet.',
      required: true,
      maxLength: 300,
      autoComplete: 'off',
    },
    {
      name: 'aspectRatio',
      label: 'Format et ratio',
      type: 'select',
      cropSection: 'precisions',
      help: 'Sélectionnez un format adapté à l’emplacement final.',
      required: true,
      options: [
        { value: 'format horizontal 16:9', label: 'Horizontal 16:9' },
        { value: 'format horizontal 3:2', label: 'Horizontal 3:2' },
        { value: 'format carré 1:1', label: 'Carré 1:1' },
        { value: 'format vertical 4:5', label: 'Vertical 4:5' },
        { value: 'format vertical 9:16', label: 'Vertical 9:16' },
      ],
    },
    {
      name: 'realismLevel',
      label: 'Niveau de réalisme',
      type: 'select',
      cropSection: 'precisions',
      help: 'Indiquez jusqu’où l’image doit se rapprocher d’une photographie ou rester stylisée.',
      required: true,
      options: [
        { value: 'photographique et très réaliste', label: 'Très réaliste' },
        { value: 'réaliste avec une légère stylisation', label: 'Réaliste' },
        { value: 'semi-réaliste avec des détails maîtrisés', label: 'Semi-réaliste' },
        { value: 'illustré et clairement stylisé', label: 'Illustré' },
        { value: 'abstrait et conceptuel', label: 'Abstrait' },
      ],
    },
    {
      name: 'textInImage',
      label: 'Présence éventuelle de texte dans l’image',
      type: 'select',
      cropSection: 'precisions',
      help: 'Pour un texte fiable, privilégiez un espace libre et ajoutez le texte ensuite dans un outil de mise en page.',
      required: true,
      options: [
        { value: 'aucun texte intégré dans l’image', label: 'Aucun texte intégré' },
        { value: 'un espace libre pour ajouter du texte après création', label: 'Espace libre pour ajouter le texte ensuite' },
        { value: 'un texte court intégré, à reprendre exactement depuis les éléments obligatoires', label: 'Texte court intégré' },
      ],
    },
    {
      name: 'targetTool',
      label: 'Outil visé',
      type: 'select',
      cropSection: 'precisions',
      help: 'Le prompt final mentionne l’outil afin de faciliter son adaptation syntaxique.',
      required: true,
      options: [
        { value: 'ChatGPT Images', label: 'ChatGPT Images' },
        { value: 'Midjourney', label: 'Midjourney' },
        { value: 'Flux', label: 'Flux' },
        { value: 'Stable Diffusion', label: 'Stable Diffusion' },
        { value: 'Adobe Firefly', label: 'Adobe Firefly' },
        { value: 'Ideogram', label: 'Ideogram' },
        { value: 'Leonardo', label: 'Leonardo' },
        { value: 'un autre outil visuel à adapter manuellement', label: 'Autre outil' },
      ],
    },
    {
      name: 'requiredElements',
      label: 'Éléments obligatoires dans l’image',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez les objets, gestes, zones ou détails qui doivent impérativement être visibles.',
      placeholder: 'Exemple : ordinateur portable, tableau lisible, interaction bienveillante et espace libre dans le tiers supérieur.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'constraints',
      label: 'Éléments à éviter et contraintes',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez ce qui ne doit pas apparaître et les limites relatives aux droits, au texte ou à la lisibilité.',
      placeholder: 'Exemple : aucun logo, aucune marque, aucun texte intégré, aucune personne identifiable et aucune interface reproduite à l’identique.',
      required: true,
      maxLength: 700,
      rows: 3,
    },
  ],
  requiredInformation: [
    'Le sujet principal, l’action ou la posture et le décor',
    'Le public et l’usage prévu',
    'Le rôle de conception visuelle',
    'L’objectif visuel',
    'Le style, le cadrage, l’angle de vue, la lumière, l’ambiance et les couleurs',
    'Le format, le ratio, le réalisme, le texte éventuel, l’outil visé et les éléments à éviter',
  ],
  buildPrompt: buildImageCreationPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision du sujet, de l’action ou de la posture, du décor, du public et du support.',
      checkpoints: [
        'Sujet principal : 4 ou 7 points.',
        'Action ou posture : 3 ou 5 points.',
        'Décor : 3 ou 5 points.',
        'Public : 2 ou 4 points.',
        'Usage sélectionné : 4 points.',
      ],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Précision de la compétence graphique et de la responsabilité de conception attendues.',
      checkpoints: ['Rôle court : 8 points.', 'Rôle précisé : 12 points.', 'Spécialité et responsabilité détaillées : 15 points.'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté de l’intention visuelle et présence de critères observables.',
      checkpoints: ['Objectif visuel : 8, 13 ou 17 points.', 'Critères de réussite : 0, 5 ou 8 points.'],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Définition complète de la direction visuelle, du format, de l’outil et des exclusions.',
      checkpoints: [
        'Style, cadrage, angle, lumière, ambiance et couleurs : 3 points chacun.',
        'Format et ratio : 4 points.',
        'Niveau de réalisme : 3 points.',
        'Présence éventuelle de texte : 3 points.',
        'Outil visé : 3 points.',
        'Éléments à éviter : 2 ou 4 points.',
      ],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Décrivez le sujet, son action ou sa posture et le décor, puis précisez chaque choix visuel. Le Studio construit une consigne à copier dans l’outil sélectionné.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. N’utilisez pas l’identité, le visage, la voix, la marque ou l’œuvre d’un tiers sans droits et autorisations adaptés.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Création d’image et sur une grille CROP déterministe documentée. Le Studio ne crée aucune image.',
  },
  beforeAfter: {
    vagueRequest: '« Fais une image moderne pour ma formation. »',
    missingDescription: 'Le sujet, l’action, le décor, le public, l’objectif, l’angle, la lumière, le ratio, le réalisme, le texte, l’outil et les exclusions ne sont pas définis.',
    structuredPrompt: '« Sujet : adulte apprenant sur ordinateur. Action : il construit un tableau avec un formateur. Décor : salle lumineuse. Objectif : transmettre une progression accessible. Précisions : illustration éditoriale semi-réaliste, vue de trois quarts, lumière naturelle, format 16:9 pour ChatGPT Images, aucun texte, logo ou visage réel. »',
    benefit: 'La consigne visuelle peut être relue à partir du support, de l’intention et de critères observables.',
  },
  examples: [
    {
      title: 'Illustration pédagogique',
      description: 'Montrer une situation d’apprentissage progressive et accessible.',
      prompt: `## Contexte
Illustration pour un support de formation destiné à des adultes débutants : une personne apprend à structurer un tableau sur un ordinateur, accompagnée par un formateur dans une salle lumineuse.

## Rôle
Agis comme un directeur artistique spécialisé dans l’illustration pédagogique professionnelle.

## Objectif visuel
Transmettre une impression de progression, de clarté et d’accompagnement bienveillant.

## Précisions
Illustration éditoriale moderne, format horizontal 16:9, verts et bleus sobres, lumière naturelle et contraste élevé. Aucun logo, texte intégré, visage identifiable ou interface reproduite à l’identique.`,
    },
    {
      title: 'Bannière pour une page web',
      description: 'Prévoir une composition lisible avec un espace réservé au contenu éditorial.',
      prompt: `## Contexte
Bannière web destinée à présenter un outil de structuration de prompts à des professionnels et responsables pédagogiques.

## Rôle
Agis comme un directeur artistique spécialisé dans les interfaces éducatives sobres et accessibles.

## Objectif visuel
Évoquer la transformation d’une idée imprécise en structure claire sans représenter une interface réelle.

## Précisions
Format horizontal 16:9, composition asymétrique, formes géométriques organisées de gauche à droite et espace libre à gauche pour un titre ajouté ensuite. Aucun texte, logo, robot humanoïde ou marque.`,
    },
    {
      title: 'Visuel carré pour un réseau social',
      description: 'Créer une consigne simple pour illustrer un conseil professionnel.',
      prompt: `## Contexte
Visuel carré destiné à accompagner une publication sur les bonnes pratiques de confidentialité numérique pour des adultes en activité.

## Rôle
Agis comme un illustrateur éditorial attentif à la lisibilité et à la représentation responsable des usages numériques.

## Objectif visuel
Faire comprendre qu’une information sensible doit être protégée avant toute saisie dans un service en ligne.

## Précisions
Format 1:1, illustration minimaliste, sujet central immédiatement identifiable, couleurs sobres et contraste élevé. Aucun visage réel, donnée lisible, symbole anxiogène, logo ou texte intégré.`,
    },
  ],
  recommendations: [
    'Décrire ce qui doit être visible plutôt que d’accumuler des adjectifs de style.',
    'Choisir le format en fonction de l’emplacement final et prévoir l’espace nécessaire au texte ajouté ensuite.',
    'Vérifier les droits relatifs aux personnes, marques, œuvres, logos et références visuelles avant utilisation.',
  ],
};
