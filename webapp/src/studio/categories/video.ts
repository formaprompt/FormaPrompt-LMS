import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const videoSchema = z.object({
  videoContext: z.string().trim().min(20, 'Décrivez la situation en au moins 20 caractères.').max(900, 'Limitez le contexte à 900 caractères.'),
  videoType: z.string().trim().min(1, 'Choisissez un type de vidéo.'),
  audience: z.string().trim().min(12, 'Précisez le public en au moins 12 caractères.').max(500, 'Limitez le public à 500 caractères.'),
  sourceMaterials: z.string().trim().max(700, 'Limitez la description des sources à 700 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(340, 'Limitez le rôle à 340 caractères.'),
  communicationGoal: z.string().trim().min(15, 'Décrivez l’objectif en au moins 15 caractères.').max(700, 'Limitez l’objectif à 700 caractères.'),
  keyMessage: z.string().trim().min(15, 'Décrivez le message essentiel en au moins 15 caractères.').max(600, 'Limitez le message à 600 caractères.'),
  productionMode: z.string().trim().min(1, 'Choisissez un mode de production.'),
  targetTool: z.string().trim().min(1, 'Choisissez une famille d’outil.'),
  targetToolDetails: z.string().trim().max(240, 'Limitez la précision sur l’outil à 240 caractères.'),
  duration: z.string().trim().min(1, 'Choisissez une durée.'),
  formatRatio: z.string().trim().min(1, 'Choisissez un format et un ratio.'),
  narrativeStructure: z.string().trim().min(15, 'Décrivez la progression en au moins 15 caractères.').max(800, 'Limitez la progression à 800 caractères.'),
  scenesAndShots: z.string().trim().max(900, 'Limitez la description des scènes à 900 caractères.'),
  narrationDialogue: z.string().trim().max(800, 'Limitez la narration à 800 caractères.'),
  visualDirection: z.string().trim().max(700, 'Limitez la direction visuelle à 700 caractères.'),
  soundMusic: z.string().trim().max(500, 'Limitez les indications sonores à 500 caractères.'),
  captionsAccessibility: z.string().trim().max(600, 'Limitez les règles d’accessibilité à 600 caractères.'),
  rightsAndConsent: z.string().trim().max(700, 'Limitez les règles de droits à 700 caractères.'),
  verificationMethod: z.string().trim().max(600, 'Limitez les contrôles à 600 caractères.'),
}).strict();

export type VideoValues = z.infer<typeof videoSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: VideoValues): ScoreRuleResult {
  let earnedPoints = 4;
  const present = [`Le type « ${values.videoType} » est défini.`];
  const missing: string[] = [];

  const contextLength = textLength(values.videoContext);
  if (contextLength >= 90) {
    earnedPoints += 10;
    present.push('La situation, le sujet, le support et les enjeux sont détaillés.');
  } else if (contextLength >= 45) {
    earnedPoints += 7;
    present.push('Le contexte général de la vidéo est compréhensible.');
    missing.push('Le support de diffusion, la situation ou les enjeux précis.');
  } else {
    earnedPoints += 4;
    present.push('Un premier contexte est indiqué.');
    missing.push('Une description plus précise du sujet, de la situation et de l’usage prévu.');
  }

  const audienceLength = textLength(values.audience);
  if (audienceLength >= 40) {
    earnedPoints += 6;
    present.push('Le public, son niveau et ses attentes sont détaillés.');
  } else if (audienceLength >= 20) {
    earnedPoints += 4;
    present.push('Le public principal est identifiable.');
    missing.push('Le niveau de connaissance, les attentes ou le contexte de visionnage du public.');
  } else {
    earnedPoints += 2;
    present.push('Un public général est indiqué.');
    missing.push('Un public plus précis avec son niveau et ses attentes.');
  }

  const sourcesLength = textLength(values.sourceMaterials);
  if (sourcesLength >= 40) {
    earnedPoints += 5;
    present.push('Les informations, médias et ressources disponibles sont délimités.');
  } else if (sourcesLength >= 15) {
    earnedPoints += 3;
    present.push('Une première indication sur les ressources disponibles est fournie.');
    missing.push('Les faits, images, séquences, documents ou éléments de marque utilisables.');
  } else {
    missing.push('Les informations et médias autorisés pour préparer la vidéo.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez la situation, le public, le support final et les ressources réellement disponibles.',
  };
}

function evaluateRole(values: VideoValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 70) {
    return {
      earnedPoints: 15,
      present: ['Le rôle réunit narration audiovisuelle, adaptation au public, accessibilité et responsabilité éditoriale.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond au sujet, au format et aux conditions de production.',
    };
  }
  if (length >= 35) {
    return {
      earnedPoints: 12,
      present: ['Un rôle adapté à la conception vidéo est défini.'],
      missing: ['La spécialité éditoriale, la compétence audiovisuelle ou l’attention portée aux droits et à l’accessibilité.'],
      recommendation: 'Ajoutez la narration, la mise en scène, l’accessibilité et la vérification des droits au rôle attendu.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise audiovisuelle et une posture responsable adaptées au besoin.'],
    recommendation: 'Précisez le rôle : scénario, réalisation, montage, pédagogie, accessibilité et droits.',
  };
}

function evaluateObjective(values: VideoValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];

  const goalLength = textLength(values.communicationGoal);
  if (goalLength >= 80) {
    earnedPoints += 17;
    present.push('L’objectif décrit précisément l’effet attendu et la situation de diffusion.');
  } else if (goalLength >= 40) {
    earnedPoints += 13;
    present.push('L’objectif principal est compréhensible.');
    missing.push('L’effet observable attendu auprès du public ou le contexte d’utilisation.');
  } else {
    earnedPoints += 8;
    present.push('Une première intention est formulée.');
    missing.push('Un objectif plus précis, observable et adapté au public.');
  }

  const messageLength = textLength(values.keyMessage);
  if (messageLength >= 40) {
    earnedPoints += 8;
    present.push('Le message essentiel à retenir est précis et mémorisable.');
  } else if (messageLength >= 25) {
    earnedPoints += 5;
    present.push('Un message principal est indiqué.');
    missing.push('Une formulation plus concrète du message unique à retenir.');
  } else {
    earnedPoints += 3;
    present.push('Une première idée centrale est indiquée.');
    missing.push('Le message essentiel que le public doit pouvoir reformuler après la vidéo.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Formulez l’effet attendu et un message central unique, concret et vérifiable.',
  };
}

function evaluatePrecisions(values: VideoValues): ScoreRuleResult {
  let earnedPoints = 11;
  const present = [
    `Le mode de production « ${values.productionMode} » est défini.`,
    `La famille d’outil « ${values.targetTool} » est précisée.`,
    `La durée « ${values.duration} » est définie.`,
    `Le format « ${values.formatRatio} » est choisi.`,
  ];
  const missing: string[] = [];

  const scoreText = (
    value: string,
    medium: number,
    high: number,
    partialPoints: number,
    maximum: number,
    completeMessage: string,
    partialMessage: string,
    missingMessage: string,
  ) => {
    const length = textLength(value);
    if (length >= high) {
      earnedPoints += maximum;
      present.push(completeMessage);
    } else if (length >= medium) {
      earnedPoints += partialPoints;
      present.push(partialMessage);
      missing.push(missingMessage);
    } else {
      missing.push(missingMessage);
    }
  };

  scoreText(values.narrativeStructure, 15, 45, 2, 4, 'La progression narrative et les temps forts sont détaillés.', 'Une première progression narrative est indiquée.', 'Les étapes, le rythme et la conclusion de la vidéo.');
  scoreText(values.scenesAndShots, 15, 45, 2, 4, 'Les scènes, plans, actions et transitions sont détaillés.', 'Une première scène ou un premier plan est indiqué.', 'Les scènes, les actions visibles, les cadrages et les transitions.');
  scoreText(values.narrationDialogue, 15, 40, 2, 3, 'La voix, les dialogues et les textes à l’écran sont cadrés.', 'Une première indication de narration est fournie.', 'La narration, les dialogues, les textes à l’écran et leur ton.');
  scoreText(values.visualDirection, 15, 40, 2, 3, 'La direction visuelle, le mouvement et la cohérence graphique sont définis.', 'Un premier choix visuel est indiqué.', 'Le style, les couleurs, les décors, les mouvements et les éléments à éviter.');
  scoreText(values.soundMusic, 12, 30, 1, 2, 'Le son, la musique, les silences et le mixage sont précisés.', 'Une première intention sonore est indiquée.', 'La voix, les bruitages, la musique, les silences et les niveaux sonores.');
  scoreText(values.captionsAccessibility, 12, 35, 2, 3, 'Les sous-titres, la lisibilité et les alternatives utiles sont prévus.', 'Une première règle d’accessibilité est indiquée.', 'Les sous-titres, la transcription, la lisibilité et l’absence d’information portée uniquement par le son.');
  scoreText(values.rightsAndConsent, 12, 35, 2, 3, 'Les droits, consentements, identités et contenus synthétiques sont encadrés.', 'Une première règle relative aux droits est indiquée.', 'Les autorisations concernant personnes, voix, musique, images, marques et contenus synthétiques.');
  scoreText(values.verificationMethod, 12, 35, 1, 2, 'Le contenu, le minutage, les droits et l’accessibilité seront contrôlés avant diffusion.', 'Un premier contrôle humain est prévu.', 'La relecture factuelle, le minutage, les droits et le contrôle final avant diffusion.');

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Détaillez la progression, les scènes, la narration, l’image, le son, l’accessibilité, les droits et les contrôles.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildProductionInstruction(values: VideoValues) {
  const instructions: Record<string, string> = {
    'préparer un scénario et un storyboard à réaliser ensuite': 'Produis un scénario et un storyboard détaillés, sans prétendre avoir tourné, monté ou exporté une vidéo.',
    'rédiger une consigne à transmettre à un outil vidéo': 'Produis une consigne finale autonome, découpée en séquences et adaptée à l’outil visé. N’affirme pas avoir créé ou exporté la vidéo.',
    'préparer un brief de tournage et de montage': 'Produis un brief exploitable par une équipe humaine : plans, actions, son, ressources, ordre de tournage, montage et contrôles.',
    'préparer une vidéo avec une personne ou un avatar à l’écran': 'Distingue clairement les paroles, les indications de jeu ou d’avatar, les éléments visuels et les sous-titres. N’imite aucune personne réelle sans accord explicite.',
    'créer directement une vidéo si cette capacité est réellement disponible': 'Si l’environnement permet réellement de produire un fichier vidéo, respecte strictement le storyboard et indique le format obtenu. Sinon, annonce cette limite et fournis immédiatement le scénario, le storyboard et la consigne prêts à utiliser.',
  };

  return instructions[values.productionMode] ?? instructions['préparer un scénario et un storyboard à réaliser ensuite'];
}

function buildToolInstruction(values: VideoValues) {
  const details = values.targetToolDetails.trim();
  const detailSuffix = details ? ` Outil ou version précisés : ${details}.` : '';
  const instructions: Record<string, string> = {
    'assistant conversationnel pour le scénario et le storyboard': 'Structure la réponse comme un document de préparation universel : synopsis, séquences, script, plans et contrôles.',
    'application de montage vidéo': 'Prépare une feuille de montage avec ordre des plans, durées, raccords, titres, voix, sons et éléments à importer.',
    'outil de création vidéo à partir de texte ou d’images': 'Découpe la consigne en plans courts et cohérents. Répète pour chaque plan les éléments visuels indispensables afin de limiter les variations involontaires.',
    'plateforme de présentation avec avatar': 'Sépare le script oral, les indications d’avatar, les visuels d’accompagnement, les incrustations et les sous-titres.',
    'suite de création graphique et vidéo': 'Prépare des scènes simples, des ressources faciles à remplacer, des textes courts et une chronologie directement transposable.',
    'autre outil à préciser': 'Adapte le vocabulaire et le niveau de détail aux capacités réellement connues de l’outil. Si une capacité est incertaine, signale-la au lieu de l’inventer.',
    'aucun outil précis, avec une structure universelle': 'Produis une structure universelle et transférable, sans dépendre d’une fonction propriétaire.',
  };

  return `${instructions[values.targetTool] ?? instructions['aucun outil précis, avec une structure universelle']}${detailSuffix}`;
}

function buildVideoPrompt(values: VideoValues) {
  return [
    '## Contexte',
    `- Situation et sujet : ${values.videoContext}`,
    `- Type de vidéo : ${values.videoType}`,
    `- Public : ${values.audience}`,
    optionalLine('Informations et médias disponibles', values.sourceMaterials),
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif',
    `- Effet attendu : ${values.communicationGoal}`,
    `- Message essentiel : ${values.keyMessage}`,
    '',
    '## Précisions',
    `- Mode de production : ${values.productionMode}`,
    `- Famille d’outil visée : ${values.targetTool}`,
    optionalLine('Outil, version ou contrainte particulière', values.targetToolDetails),
    `- Durée : ${values.duration}`,
    `- Format et ratio : ${values.formatRatio}`,
    `- Progression narrative : ${values.narrativeStructure}`,
    optionalLine('Scènes, plans, actions et transitions', values.scenesAndShots),
    optionalLine('Narration, dialogues et textes à l’écran', values.narrationDialogue),
    optionalLine('Direction visuelle, cadrages et mouvements', values.visualDirection),
    optionalLine('Voix, musique, bruitages et silences', values.soundMusic),
    optionalLine('Sous-titres et accessibilité', values.captionsAccessibility),
    optionalLine('Droits, consentements et éléments interdits', values.rightsAndConsent),
    optionalLine('Contrôle avant diffusion', values.verificationMethod),
    '',
    '## Adaptation à la production et à l’outil',
    buildProductionInstruction(values),
    buildToolInstruction(values),
    '',
    '## Livrable attendu',
    '1. Résume l’intention en un synopsis court et reformule les hypothèses ou informations manquantes.',
    '2. Propose une chronologie séquence par séquence. Pour chacune, indique la durée, l’action visible, le cadrage ou mouvement, la narration ou le texte à l’écran, le son et la transition.',
    '3. Fournis séparément le script oral complet et la liste des textes affichés afin de faciliter leur relecture.',
    '4. Termine par une liste des ressources à préparer et des contrôles portant sur les faits, le minutage, les droits, les consentements, les sous-titres et la lisibilité mobile.',
    '5. N’invente aucun fait, chiffre, citation, témoignage, droit obtenu ni capacité de l’outil. Utilise un emplacement à compléter lorsqu’une information manque.',
    '6. Ne reproduis ni l’identité, le visage, la voix, le style distinctif ou la marque d’un tiers sans droits et autorisations adaptés. Signale clairement tout contenu synthétique lorsque le contexte ou la réglementation l’exige.',
    '7. N’affirme jamais avoir tourné, monté, créé, exporté, publié ou testé une vidéo. Produis uniquement le livrable demandé.',
  ].join('\n');
}

export const videoCategory: StudioCategoryConfig<VideoValues> = {
  id: 'video',
  label: 'Vidéo',
  shortDescription: 'Structurer un scénario, un storyboard ou un brief vidéo adapté au public, au format et à l’outil.',
  schema: videoSchema,
  defaultValues: {
    videoContext: '',
    videoType: 'vidéo pédagogique ou explicative',
    audience: '',
    sourceMaterials: '',
    role: 'un concepteur-réalisateur pédagogique, attentif à la narration, au rythme, à l’accessibilité, aux droits et à la vérification des informations',
    communicationGoal: '',
    keyMessage: '',
    productionMode: 'préparer un scénario et un storyboard à réaliser ensuite',
    targetTool: 'aucun outil précis, avec une structure universelle',
    targetToolDetails: '',
    duration: 'entre 1 et 3 minutes',
    formatRatio: 'horizontal 16:9 pour écran et plateforme vidéo',
    narrativeStructure: '',
    scenesAndShots: '',
    narrationDialogue: '',
    visualDirection: '',
    soundMusic: '',
    captionsAccessibility: 'prévoir des sous-titres relus, un texte lisible et aucune information portée uniquement par le son',
    rightsAndConsent: 'utiliser uniquement des personnes, voix, musiques, images, marques et ressources disposant des droits et autorisations nécessaires',
    verificationMethod: '',
  },
  fields: [
    {
      name: 'videoContext',
      label: 'Sujet, situation et usage prévu de la vidéo',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez le sujet, le contexte de diffusion et le besoin sans saisir de donnée personnelle ou confidentielle.',
      placeholder: 'Exemple : courte vidéo intégrée à une formation en ligne pour expliquer comment vérifier une source avant de la citer.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'videoType',
      label: 'Type de vidéo',
      type: 'select',
      cropSection: 'context',
      help: 'Choisissez le format éditorial principal.',
      required: true,
      options: [
        { value: 'vidéo pédagogique ou explicative', label: 'Vidéo pédagogique ou explicative' },
        { value: 'tutoriel ou démonstration pas à pas', label: 'Tutoriel ou démonstration' },
        { value: 'vidéo courte pour un réseau social', label: 'Vidéo courte pour un réseau social' },
        { value: 'présentation professionnelle ou institutionnelle', label: 'Présentation professionnelle' },
        { value: 'témoignage ou entretien préparé avec consentement', label: 'Témoignage ou entretien' },
        { value: 'message porté par une personne ou un avatar', label: 'Présentation avec personne ou avatar' },
        { value: 'bande-annonce ou contenu promotionnel sobre', label: 'Bande-annonce ou promotion' },
        { value: 'autre format vidéo à préciser', label: 'Autre format' },
      ],
    },
    {
      name: 'audience',
      label: 'Public, niveau et contexte de visionnage',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez un profil générique, son niveau et le support sur lequel la vidéo sera regardée.',
      placeholder: 'Exemple : adultes débutants regardant la vidéo sur téléphone dans leur espace apprenant.',
      required: true,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'sourceMaterials',
      label: 'Informations, documents et médias disponibles',
      type: 'textarea',
      cropSection: 'context',
      help: 'Listez uniquement les ressources utilisables et vérifiées, ainsi que les éléments manquants.',
      placeholder: 'Exemple : procédure validée, captures fictives, charte graphique et logo autorisé ; aucune musique sélectionnée.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez les compétences attendues en scénario, réalisation, pédagogie, accessibilité et droits.',
      required: true,
      maxLength: 340,
      autoComplete: 'off',
    },
    {
      name: 'communicationGoal',
      label: 'Objectif de la vidéo et effet attendu',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez ce que le public doit comprendre, ressentir ou pouvoir faire après le visionnage.',
      placeholder: 'Exemple : permettre au public d’appliquer une vérification simple en trois étapes avant de partager une information.',
      required: true,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'keyMessage',
      label: 'Message essentiel à retenir',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Formulez une idée centrale unique, simple à reformuler après la vidéo.',
      placeholder: 'Exemple : une source doit être identifiée, datée et recoupée avant d’être présentée comme fiable.',
      required: true,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'productionMode',
      label: 'Livrable et mode de production souhaités',
      type: 'select',
      cropSection: 'precisions',
      help: 'Précisez si vous attendez une préparation éditoriale, un brief humain ou une consigne pour un outil.',
      required: true,
      options: [
        { value: 'préparer un scénario et un storyboard à réaliser ensuite', label: 'Scénario et storyboard' },
        { value: 'rédiger une consigne à transmettre à un outil vidéo', label: 'Consigne pour un outil vidéo' },
        { value: 'préparer un brief de tournage et de montage', label: 'Brief de tournage et de montage' },
        { value: 'préparer une vidéo avec une personne ou un avatar à l’écran', label: 'Script pour personne ou avatar' },
        { value: 'créer directement une vidéo si cette capacité est réellement disponible', label: 'Création directe si disponible' },
      ],
    },
    {
      name: 'targetTool',
      label: 'Famille d’outil visée',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez la famille correspondant à votre usage ; précisez ensuite le nom de l’application si nécessaire.',
      required: true,
      options: [
        { value: 'aucun outil précis, avec une structure universelle', label: 'Aucun outil précis' },
        { value: 'assistant conversationnel pour le scénario et le storyboard', label: 'Assistant pour scénario et storyboard' },
        { value: 'application de montage vidéo', label: 'Application de montage' },
        { value: 'outil de création vidéo à partir de texte ou d’images', label: 'Outil vidéo à partir de texte ou d’images' },
        { value: 'plateforme de présentation avec avatar', label: 'Plateforme avec avatar' },
        { value: 'suite de création graphique et vidéo', label: 'Suite graphique et vidéo' },
        { value: 'autre outil à préciser', label: 'Autre outil' },
      ],
    },
    {
      name: 'targetToolDetails',
      label: 'Application, version ou contrainte particulière',
      type: 'text',
      cropSection: 'precisions',
      help: 'Vous pouvez indiquer par exemple CapCut, Canva, HeyGen, Synthesia, Runway, Sora ou une autre application, sans fournir d’identifiant ni de clé.',
      placeholder: 'Exemple : application de montage disponible dans l’organisme, export MP4 requis',
      required: false,
      maxLength: 240,
      autoComplete: 'off',
    },
    {
      name: 'duration',
      label: 'Durée cible',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez une durée réaliste pour le message et le canal.',
      required: true,
      options: [
        { value: 'moins de 30 secondes', label: 'Moins de 30 secondes' },
        { value: 'entre 30 et 60 secondes', label: '30 à 60 secondes' },
        { value: 'entre 1 et 3 minutes', label: '1 à 3 minutes' },
        { value: 'entre 3 et 5 minutes', label: '3 à 5 minutes' },
        { value: 'entre 5 et 10 minutes', label: '5 à 10 minutes' },
        { value: 'plus de 10 minutes, découpées en chapitres', label: 'Plus de 10 minutes, avec chapitres' },
      ],
    },
    {
      name: 'formatRatio',
      label: 'Format et ratio',
      type: 'select',
      cropSection: 'precisions',
      help: 'Adaptez le ratio au support final et vérifiez les zones de sécurité de la plateforme.',
      required: true,
      options: [
        { value: 'horizontal 16:9 pour écran et plateforme vidéo', label: 'Horizontal 16:9' },
        { value: 'vertical 9:16 pour téléphone et vidéo courte', label: 'Vertical 9:16' },
        { value: 'carré 1:1 pour fil de réseau social', label: 'Carré 1:1' },
        { value: 'portrait 4:5 pour fil mobile', label: 'Portrait 4:5' },
        { value: 'format à préciser selon le canal final', label: 'À préciser selon le canal' },
      ],
    },
    {
      name: 'narrativeStructure',
      label: 'Progression narrative et rythme',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Décrivez l’accroche, les étapes, les temps forts, les respirations et la conclusion.',
      placeholder: 'Exemple : question concrète, erreur fréquente, méthode en trois étapes, exemple bref puis rappel final.',
      required: true,
      maxLength: 800,
      rows: 4,
    },
    {
      name: 'scenesAndShots',
      label: 'Scènes, plans, actions et transitions',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez ce qui doit être visible, les cadrages, les mouvements et les transitions utiles.',
      placeholder: 'Exemple : plan d’ensemble du bureau, gros plan sur trois indices fictifs, retour au formateur puis écran final récapitulatif.',
      required: false,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'narrationDialogue',
      label: 'Narration, dialogues et textes à l’écran',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez la voix, le ton, les dialogues, les titres et les textes courts qui doivent apparaître.',
      placeholder: 'Exemple : voix chaleureuse et posée, phrases courtes, trois mots-clés affichés successivement et aucun jargon.',
      required: false,
      maxLength: 800,
      rows: 4,
    },
    {
      name: 'visualDirection',
      label: 'Direction visuelle, cadrages et mouvements',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Décrivez le style, les couleurs, la lumière, les décors, les mouvements et les éléments à éviter.',
      placeholder: 'Exemple : style pédagogique sobre, lumière naturelle, plans stables, charte verte et bleue, aucun effet décoratif rapide.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'soundMusic',
      label: 'Voix, musique, bruitages et silences',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez les intentions sonores et veillez à la compréhension de la parole et aux droits musicaux.',
      placeholder: 'Exemple : voix claire au premier plan, musique discrète libre de droits, aucun son soudain et silences entre les étapes.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'captionsAccessibility',
      label: 'Sous-titres, transcription et accessibilité',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Prévoyez des sous-titres relus, des textes lisibles et des informations compréhensibles sans le son.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'rightsAndConsent',
      label: 'Droits, consentements et éléments interdits',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Cadrez l’utilisation des personnes, voix, musiques, images, marques, œuvres et contenus synthétiques.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'verificationMethod',
      label: 'Contrôles humains avant diffusion',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez qui vérifiera les faits, le minutage, les droits, les sous-titres et le rendu sur le support final.',
      placeholder: 'Exemple : validation du script par le formateur, test sans le son sur téléphone et contrôle des droits avant publication.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
  ],
  requiredInformation: [
    'Le sujet, le type de vidéo, le public et l’usage prévu',
    'Le rôle de conception audiovisuelle',
    'L’objectif et le message essentiel',
    'Le mode de production, l’outil, la durée et le ratio',
    'La progression, les scènes, la narration, l’image et le son',
    'Les sous-titres, les droits, les consentements et les contrôles avant diffusion',
  ],
  buildPrompt: buildVideoPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision du sujet, du type de vidéo, du public et des ressources disponibles.',
      checkpoints: ['Type de vidéo : 4 points.', 'Situation : 4, 7 ou 10 points.', 'Public : 2, 4 ou 6 points.', 'Ressources : 0, 3 ou 5 points.'],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Adéquation de l’expertise audiovisuelle, éditoriale et responsable attendue.',
      checkpoints: ['Rôle court : 8 points.', 'Rôle précisé : 12 points.', 'Compétences et responsabilités détaillées : 15 points.'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté de l’effet attendu et du message essentiel à retenir.',
      checkpoints: ['Objectif : 8, 13 ou 17 points.', 'Message essentiel : 3, 5 ou 8 points.'],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Définition de la production, du format, des séquences, du son, de l’accessibilité et des droits.',
      checkpoints: [
        'Mode de production, outil, durée et ratio : 11 points.',
        'Progression et scènes : 4 points chacun.',
        'Narration, direction visuelle, accessibilité et droits : 3 points chacun.',
        'Son et contrôles avant diffusion : 2 points chacun.',
      ],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Décrivez l’usage, le public et le message, puis cadrez le scénario, le format, le son, les droits et les contrôles. Le Studio construit un prompt à copier dans l’outil de votre choix.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. N’utilisez pas l’identité, le visage, la voix, l’image, la marque, la musique ou l’œuvre d’un tiers sans droits et autorisations adaptés.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Vidéo et sur une grille CROP déterministe documentée. Le Studio ne tourne, ne monte et ne publie aucune vidéo.',
  },
  beforeAfter: {
    vagueRequest: '« Fais une petite vidéo moderne pour expliquer mon sujet. »',
    missingDescription: 'Le public, le message, la durée, le ratio, les scènes, la narration, le son, les droits et le contrôle final ne sont pas définis.',
    structuredPrompt: '« Prépare le storyboard d’une vidéo pédagogique de 90 secondes en 16:9 pour des adultes débutants. Message : vérifier l’auteur, la date et le recoupement avant de citer une source. Prévois une accroche, trois scènes démonstratives, une voix posée, des sous-titres relus et un contrôle des faits et des droits avant diffusion. »',
    benefit: 'Le livrable peut être relu, minuté et transmis à une personne ou à un outil de production sans ambiguïté majeure.',
  },
  examples: [
    {
      title: 'Tutoriel pédagogique',
      description: 'Préparer un storyboard court pour expliquer une méthode étape par étape.',
      prompt: `## Contexte
Vidéo de deux minutes intégrée à une formation destinée à des adultes débutants.

## Rôle
Agis comme un concepteur-réalisateur pédagogique attentif au rythme et à l’accessibilité.

## Objectif
Faire appliquer une méthode simple en trois étapes immédiatement après le visionnage.

## Précisions
Format horizontal 16:9, accroche courte, trois démonstrations avec données fictives, voix posée, sous-titres relus et écran final récapitulatif. Aucun logo tiers, donnée réelle ou musique sans droits.`,
    },
    {
      title: 'Vidéo verticale courte',
      description: 'Structurer un message professionnel concis destiné au téléphone.',
      prompt: `## Contexte
Vidéo verticale de 45 secondes destinée à présenter un conseil de productivité à des professionnels.

## Rôle
Agis comme un scénariste de formats courts, sobre et précis.

## Objectif
Faire retenir une action concrète sans promesse exagérée.

## Précisions
Format 9:16, accroche en cinq secondes, un exemple, une action finale, textes courts dans les zones de sécurité et sous-titres complets. Plans stables, voix claire et aucun témoignage inventé.`,
    },
    {
      title: 'Présentation avec avatar',
      description: 'Séparer le script, les indications visuelles et les règles de consentement.',
      prompt: `## Contexte
Message d’accueil générique pour une ressource de formation, présenté par un avatar non associé à une personne réelle.

## Rôle
Agis comme un auteur audiovisuel attentif à la transparence, à l’inclusion et au confort d’écoute.

## Objectif
Présenter le déroulement de la ressource et les possibilités d’aide en moins de deux minutes.

## Précisions
Sépare le texte oral, les incrustations et les visuels. Prévois une voix naturelle non imitée, des sous-titres relus, un débit modéré et une mention claire du caractère synthétique de l’avatar.`,
    },
  ],
  recommendations: [
    'Découper la vidéo en plans courts avec une fonction claire : montrer, expliquer, illustrer ou conclure.',
    'Prévoir les sous-titres, les zones de sécurité et la lisibilité sur téléphone dès le storyboard.',
    'Vérifier séparément les faits, les consentements et les droits portant sur les personnes, voix, musiques, images, marques et œuvres.',
  ],
};
