import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const audioSchema = z.object({
  audioContext: z.string().trim().min(20, 'Décrivez le sujet et l’usage en au moins 20 caractères.').max(900, 'Limitez le contexte à 900 caractères.'),
  audioType: z.string().trim().min(1, 'Choisissez un type de contenu audio.'),
  audience: z.string().trim().min(5, 'Précisez le public.').max(350, 'Limitez le public à 350 caractères.'),
  sourceMaterials: z.string().trim().max(700, 'Limitez les ressources disponibles à 700 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(400, 'Limitez le rôle à 400 caractères.'),
  communicationGoal: z.string().trim().min(15, 'Décrivez l’objectif en au moins 15 caractères.').max(750, 'Limitez l’objectif à 750 caractères.'),
  keyMessage: z.string().trim().min(15, 'Précisez le message essentiel en au moins 15 caractères.').max(500, 'Limitez le message essentiel à 500 caractères.'),
  productionMode: z.string().trim().min(1, 'Choisissez un mode de préparation.'),
  targetTool: z.string().trim().min(1, 'Choisissez une famille d’outil.'),
  targetToolDetails: z.string().trim().max(300, 'Limitez le nom et les contraintes de l’outil à 300 caractères.'),
  duration: z.string().trim().min(1, 'Choisissez une durée cible.'),
  outputFormat: z.string().trim().min(1, 'Choisissez un format de restitution.'),
  structure: z.string().trim().max(750, 'Limitez la structure à 750 caractères.'),
  voiceAndSpeakers: z.string().trim().max(650, 'Limitez les indications de voix à 650 caractères.'),
  tonePacing: z.string().trim().max(500, 'Limitez le ton et le rythme à 500 caractères.'),
  pronunciation: z.string().trim().max(450, 'Limitez les indications de prononciation à 450 caractères.'),
  soundMusic: z.string().trim().max(550, 'Limitez les indications sonores à 550 caractères.'),
  accessibilityTranscript: z.string().trim().max(550, 'Limitez les exigences d’accessibilité à 550 caractères.'),
  rightsConsent: z.string().trim().min(12, 'Précisez les droits et consentements.').max(750, 'Limitez les droits et consentements à 750 caractères.'),
  technicalQuality: z.string().trim().max(500, 'Limitez les exigences techniques à 500 caractères.'),
  verificationMethod: z.string().trim().min(12, 'Précisez le contrôle humain final.').max(650, 'Limitez les contrôles à 650 caractères.'),
}).strict();

export type AudioValues = z.infer<typeof audioSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: AudioValues): ScoreRuleResult {
  let earnedPoints = 4;
  const present = [`Le type « ${values.audioType} » est défini.`];
  const missing: string[] = [];

  const contextLength = textLength(values.audioContext);
  if (contextLength >= 90) {
    earnedPoints += 10;
    present.push('Le sujet, la situation d’écoute et l’usage prévu sont détaillés.');
  } else if (contextLength >= 45) {
    earnedPoints += 7;
    present.push('Le sujet et l’usage sont compréhensibles.');
    missing.push('La situation d’écoute, le support de diffusion ou les enjeux du contenu.');
  } else {
    earnedPoints += 4;
    present.push('Un premier sujet est indiqué.');
    missing.push('Une description plus précise du sujet, de l’usage et du contexte d’écoute.');
  }

  const audienceLength = textLength(values.audience);
  if (audienceLength >= 40) {
    earnedPoints += 6;
    present.push('Le public, son niveau et sa situation d’écoute sont précisés.');
  } else if (audienceLength >= 20) {
    earnedPoints += 4;
    present.push('Le public est indiqué.');
    missing.push('Le niveau de connaissance, les besoins ou les conditions d’écoute du public.');
  } else {
    earnedPoints += 2;
    present.push('Un public est mentionné.');
    missing.push('Une description plus précise des auditeurs et de leurs besoins.');
  }

  const materialsLength = textLength(values.sourceMaterials);
  if (materialsLength >= 40) {
    earnedPoints += 5;
    present.push('Les sources, scripts, médias et ressources disponibles sont détaillés.');
  } else if (materialsLength >= 15) {
    earnedPoints += 3;
    present.push('Une première ressource est indiquée.');
    missing.push('Les sources validées, textes, enregistrements ou éléments sonores disponibles et leurs droits.');
  } else {
    missing.push('Les sources, contenus et médias disponibles pour préparer l’audio.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Décrivez le sujet, le public, le contexte d’écoute et les ressources disponibles avec des exemples fictifs ou génériques.',
  };
}

function evaluateRole(values: AudioValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 70) {
    return {
      earnedPoints: 15,
      present: ['Le rôle associe conception éditoriale, qualité sonore, accessibilité, droits et vérification.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond au type d’audio, au public et au mode de production.',
    };
  }
  if (length >= 35) {
    return {
      earnedPoints: 12,
      present: ['Un rôle de conception audio est défini.'],
      missing: ['La spécialité éditoriale, la vigilance sur les droits, l’accessibilité ou la qualité sonore.'],
      recommendation: 'Ajoutez l’expertise attendue, la posture, l’attention au public et les obligations de contrôle.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise et une posture adaptées à la conception d’un contenu audio.'],
    recommendation: 'Précisez le rôle : conception sonore, narration, pédagogie, accessibilité, droits et vérification.',
  };
}

function evaluateObjective(values: AudioValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const goalLength = textLength(values.communicationGoal);

  if (goalLength >= 80) {
    earnedPoints += 17;
    present.push('L’effet attendu auprès du public et le périmètre du contenu sont détaillés.');
  } else if (goalLength >= 40) {
    earnedPoints += 13;
    present.push('L’objectif de communication est compréhensible.');
    missing.push('L’effet observable attendu ou le périmètre exact du contenu audio.');
  } else {
    earnedPoints += 8;
    present.push('Un premier objectif est formulé.');
    missing.push('Un objectif plus précis, centré sur ce que le public doit comprendre, ressentir ou faire.');
  }

  const messageLength = textLength(values.keyMessage);
  if (messageLength >= 40) {
    earnedPoints += 8;
    present.push('Le message essentiel à retenir est explicite.');
  } else if (messageLength >= 25) {
    earnedPoints += 5;
    present.push('Un premier message essentiel est indiqué.');
    missing.push('Une formulation plus précise et mémorisable du message principal.');
  } else {
    earnedPoints += 3;
    present.push('Une idée principale est mentionnée.');
    missing.push('Le message exact que le public doit retenir après l’écoute.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Distinguez l’effet recherché auprès du public du message précis qu’il doit retenir.',
  };
}

function evaluatePrecisions(values: AudioValues): ScoreRuleResult {
  let earnedPoints = 10;
  const present = [
    `Le mode « ${values.productionMode} » est défini.`,
    `La famille d’outil « ${values.targetTool} » est indiquée.`,
    `La durée « ${values.duration} » est définie.`,
    `Le format « ${values.outputFormat} » est demandé.`,
  ];
  const missing: string[] = [];

  const scoreText = (
    value: string,
    medium: number,
    high: number,
    maximum: number,
    presentMessage: string,
    partialMessage: string,
    missingMessage: string,
  ) => {
    const length = textLength(value);
    if (length >= high) {
      earnedPoints += maximum;
      present.push(presentMessage);
    } else if (length >= medium) {
      earnedPoints += Math.max(1, maximum - 2);
      present.push(partialMessage);
      missing.push(missingMessage);
    } else {
      missing.push(missingMessage);
    }
  };

  scoreText(values.structure, 15, 45, 4, 'La progression, les séquences et les transitions sont détaillées.', 'Une première structure est indiquée.', 'La progression, les séquences, les transitions et la conclusion.');
  scoreText(values.voiceAndSpeakers, 15, 45, 4, 'Les voix, intervenants, tours de parole et responsabilités sont détaillés.', 'Une première indication de voix est fournie.', 'Les voix, le nombre d’intervenants, les tours de parole et la responsabilité éditoriale.');
  scoreText(values.tonePacing, 12, 35, 3, 'Le ton, le rythme, les pauses et le niveau de langage sont précisés.', 'Un ton ou un rythme est indiqué.', 'Le ton, le débit, les pauses et le niveau de langage adaptés au public.');
  scoreText(values.pronunciation, 10, 30, 2, 'Les prononciations, sigles, nombres et noms difficiles sont balisés.', 'Une indication de prononciation est fournie.', 'Les mots, noms, sigles, nombres ou termes étrangers à faire vérifier.');
  scoreText(values.soundMusic, 10, 30, 2, 'La musique, les ambiances, les bruitages et les silences sont cadrés.', 'Un élément sonore est indiqué.', 'La place de la musique, des ambiances, des bruitages et des silences.');
  scoreText(values.accessibilityTranscript, 12, 35, 3, 'La transcription, l’identification des voix et l’équivalent accessible sont prévus.', 'Une première exigence d’accessibilité est indiquée.', 'La transcription relue, l’identification des intervenants et les alternatives aux informations uniquement sonores.');
  scoreText(values.rightsConsent, 15, 45, 3, 'Les droits sur les voix, musiques, œuvres et consentements sont détaillés.', 'Une première règle de droits est indiquée.', 'Les droits, licences et consentements documentés pour chaque voix, musique, œuvre ou extrait.');
  scoreText(values.technicalQuality, 10, 30, 2, 'Les exigences de qualité, niveau sonore et compatibilité sont précisées.', 'Une exigence technique est indiquée.', 'Le format de fichier, le niveau sonore, le bruit de fond et la compatibilité du support.');
  scoreText(values.verificationMethod, 15, 45, 2, 'La relecture, l’écoute de contrôle et la validation avant diffusion sont détaillées.', 'Un contrôle humain est indiqué.', 'La relecture du script, l’écoute sur plusieurs appareils et la validation des faits et des droits.');

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez la structure, les voix, le rythme, la prononciation, l’habillage sonore, l’accessibilité, les droits et les contrôles avant diffusion.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildAudioPrompt(values: AudioValues) {
  return [
    '## Contexte',
    `- Sujet, situation et usage prévu : ${values.audioContext}`,
    `- Type de contenu audio : ${values.audioType}`,
    `- Public et conditions d’écoute : ${values.audience}`,
    optionalLine('Sources, textes et médias disponibles', values.sourceMaterials),
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif',
    `- Effet attendu auprès du public : ${values.communicationGoal}`,
    `- Message essentiel : ${values.keyMessage}`,
    '',
    '## Précisions',
    `- Mode de préparation : ${values.productionMode}`,
    `- Famille d’outil visée : ${values.targetTool}`,
    optionalLine('Outil précis et contraintes connues', values.targetToolDetails),
    `- Durée cible : ${values.duration}`,
    `- Format de restitution : ${values.outputFormat}`,
    optionalLine('Structure, séquences et transitions', values.structure),
    optionalLine('Voix, intervenants et tours de parole', values.voiceAndSpeakers),
    optionalLine('Ton, rythme, débit et pauses', values.tonePacing),
    optionalLine('Prononciations, sigles, nombres et termes difficiles', values.pronunciation),
    optionalLine('Musique, ambiances, bruitages et silences', values.soundMusic),
    optionalLine('Transcription et accessibilité', values.accessibilityTranscript),
    `- Droits, licences et consentements : ${values.rightsConsent}`,
    optionalLine('Exigences de qualité technique', values.technicalQuality),
    `- Contrôles humains avant diffusion : ${values.verificationMethod}`,
    '',
    '## Règles de préparation',
    '- Distingue clairement les paroles à prononcer des indications de réalisation avec des balises comme [VOIX], [PAUSE], [MUSIQUE] ou [AMBIANCE].',
    '- N’invente aucun fait, chiffre, citation, prononciation, droit, licence, consentement, enregistrement ou résultat de contrôle.',
    '- Ne reproduis, n’imite et ne clones jamais la voix d’une personne réelle sans son consentement explicite, documenté et adapté à l’usage prévu.',
    '- Ne demande et n’intègre aucune donnée personnelle, confidentielle, médicale, financière ou sensible dans le script, les métadonnées ou les exemples.',
    '- Signale les mots, noms, sigles, citations et informations qui nécessitent une vérification humaine.',
    '- Prévois une transcription relue et un équivalent textuel pour toute information portée uniquement par le son.',
    '- N’affirme jamais avoir enregistré, synthétisé, monté, mixé, exporté, publié ou testé un fichier audio.',
    '',
    '## Format de réponse',
    '1. Résume les choix éditoriaux et sonores.',
    '2. Propose la structure minutée.',
    '3. Rédige le script en séparant paroles et indications de réalisation.',
    '4. Liste les prononciations et informations à vérifier.',
    '5. Termine par la transcription attendue et une liste de contrôle des faits, droits, consentements, niveaux sonores et conditions de diffusion.',
  ].join('\n');
}

export const audioCategory: StudioCategoryConfig<AudioValues> = {
  id: 'audio',
  label: 'Audio',
  shortDescription: 'Structurer un podcast, une voix off, une interview ou un contenu sonore accessible et vérifiable.',
  schema: audioSchema,
  defaultValues: {
    audioContext: '',
    audioType: 'podcast ou chronique',
    audience: '',
    sourceMaterials: '',
    role: 'un concepteur éditorial et sonore, attentif à la narration, à l’intelligibilité, à l’accessibilité, aux droits, aux consentements et à la vérification des informations',
    communicationGoal: '',
    keyMessage: '',
    productionMode: 'préparer un script et un conducteur à enregistrer ensuite',
    targetTool: 'application d’enregistrement et de montage audio',
    targetToolDetails: '',
    duration: 'entre 3 et 10 minutes',
    outputFormat: 'script balisé avec conducteur minuté et liste de contrôle',
    structure: '',
    voiceAndSpeakers: '',
    tonePacing: '',
    pronunciation: '',
    soundMusic: '',
    accessibilityTranscript: 'Prévoir une transcription intégrale relue, identifier chaque intervenant et décrire les informations importantes portées uniquement par le son.',
    rightsConsent: 'Utiliser uniquement des voix, musiques, œuvres et extraits disposant des droits, licences et consentements documentés pour cet usage.',
    technicalQuality: '',
    verificationMethod: 'Faire relire le script, vérifier les faits, prononciations, droits et consentements, puis écouter le résultat sur téléphone et ordinateur avant toute diffusion.',
  },
  fields: [
    {
      name: 'audioContext',
      label: 'Sujet, situation et usage prévu du contenu audio',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez le sujet, le contexte d’écoute, le support et l’usage attendu sans donnée réelle sensible.',
      placeholder: 'Ex. Capsule intégrée à une formation pour expliquer une méthode avant un exercice…',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'audioType',
      label: 'Type de contenu audio',
      type: 'select',
      cropSection: 'context',
      help: 'Choisissez la forme principale ; les détails seront précisés dans les autres champs.',
      required: true,
      options: [
        { value: 'podcast ou chronique', label: 'Podcast ou chronique' },
        { value: 'voix off pour une vidéo ou une présentation', label: 'Voix off' },
        { value: 'capsule pédagogique ou exercice audio', label: 'Capsule pédagogique' },
        { value: 'interview ou table ronde', label: 'Interview ou table ronde' },
        { value: 'message d’accueil ou serveur vocal', label: 'Message d’accueil ou serveur vocal' },
        { value: 'publicité ou bande-annonce sonore', label: 'Publicité ou bande-annonce' },
        { value: 'méditation, récit ou lecture guidée', label: 'Méditation, récit ou lecture guidée' },
        { value: 'autre contenu sonore', label: 'Autre' },
      ],
    },
    {
      name: 'audience',
      label: 'Public et conditions d’écoute',
      type: 'textarea',
      cropSection: 'context',
      help: 'Précisez le niveau, les besoins, l’appareil et l’environnement d’écoute probable.',
      placeholder: 'Ex. Adultes débutants, écoute sur téléphone avec des écouteurs dans leur espace apprenant…',
      required: true,
      maxLength: 350,
      rows: 3,
    },
    {
      name: 'sourceMaterials',
      label: 'Sources, textes, enregistrements et médias disponibles',
      type: 'textarea',
      cropSection: 'context',
      help: 'Listez uniquement les ressources autorisées et indiquez celles qui nécessitent encore une vérification.',
      placeholder: 'Ex. Plan validé, procédure officielle, enregistrement témoin autorisé et musique sous licence…',
      required: false,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'role',
      label: 'Rôle de conception éditoriale et sonore',
      type: 'textarea',
      cropSection: 'role',
      help: 'Précisez l’expertise, la posture, l’attention au public, à l’accessibilité et aux droits.',
      required: true,
      maxLength: 400,
      rows: 3,
    },
    {
      name: 'communicationGoal',
      label: 'Objectif auprès du public',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez ce que le public doit comprendre, ressentir ou être capable de faire après l’écoute.',
      placeholder: 'Ex. Permettre au public d’appliquer trois vérifications avant de citer une source…',
      required: true,
      maxLength: 750,
      rows: 4,
    },
    {
      name: 'keyMessage',
      label: 'Message essentiel à retenir',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Formulez une idée principale claire et mémorisable.',
      placeholder: 'Ex. Une information doit être identifiée, datée et recoupée avant d’être partagée…',
      required: true,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'productionMode',
      label: 'Mode de préparation',
      type: 'select',
      cropSection: 'precisions',
      help: 'Précisez si le prompt doit préparer un script, un conducteur ou une consigne pour un outil audio.',
      required: true,
      options: [
        { value: 'préparer un script et un conducteur à enregistrer ensuite', label: 'Script et conducteur à enregistrer' },
        { value: 'préparer une voix off synchronisée à un support existant', label: 'Voix off pour un support existant' },
        { value: 'préparer une consigne destinée à un outil de synthèse vocale', label: 'Consigne pour synthèse vocale' },
        { value: 'préparer un brief de montage, mixage et finalisation', label: 'Brief de montage et mixage' },
        { value: 'préparer uniquement la transcription et l’adaptation accessible', label: 'Transcription et adaptation accessible' },
      ],
    },
    {
      name: 'targetTool',
      label: 'Famille d’outil visée',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez une famille puis indiquez le nom précis si nécessaire, sans saisir de compte ni de clé.',
      required: true,
      options: [
        { value: 'application d’enregistrement et de montage audio', label: 'Enregistrement et montage audio' },
        { value: 'service de synthèse vocale', label: 'Synthèse vocale' },
        { value: 'plateforme de podcast ou de diffusion', label: 'Plateforme de podcast ou diffusion' },
        { value: 'assistant conversationnel pour préparer le script', label: 'Assistant pour préparer le script' },
        { value: 'studio radio, podcast ou voix off', label: 'Studio radio, podcast ou voix off' },
        { value: 'autre outil audio', label: 'Autre outil' },
      ],
    },
    {
      name: 'targetToolDetails',
      label: 'Outil précis et contraintes connues',
      type: 'text',
      cropSection: 'precisions',
      help: 'Indiquez éventuellement l’application, la plateforme ou les limites du matériel disponible.',
      placeholder: 'Ex. Application disponible dans l’organisme, export MP3 et WAV…',
      required: false,
      maxLength: 300,
    },
    {
      name: 'duration',
      label: 'Durée cible',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez une durée réaliste pour le support et la situation d’écoute.',
      required: true,
      options: [
        { value: 'moins de 30 secondes', label: 'Moins de 30 secondes' },
        { value: 'entre 30 et 90 secondes', label: '30 à 90 secondes' },
        { value: 'entre 1 et 3 minutes', label: '1 à 3 minutes' },
        { value: 'entre 3 et 10 minutes', label: '3 à 10 minutes' },
        { value: 'entre 10 et 30 minutes', label: '10 à 30 minutes' },
        { value: 'plus de 30 minutes, avec chapitrage', label: 'Plus de 30 minutes' },
      ],
    },
    {
      name: 'outputFormat',
      label: 'Format de restitution demandé',
      type: 'select',
      cropSection: 'precisions',
      help: 'Le format concerne le texte produit par le prompt, pas un fichier audio réellement exporté.',
      required: true,
      options: [
        { value: 'script balisé avec conducteur minuté et liste de contrôle', label: 'Script balisé et conducteur minuté' },
        { value: 'tableau scène par scène avec voix, son et durée', label: 'Tableau scène par scène' },
        { value: 'texte de voix off avec repères de synchronisation', label: 'Voix off avec synchronisation' },
        { value: 'guide d’interview avec relances et minutage', label: 'Guide d’interview' },
        { value: 'brief de production et de montage audio', label: 'Brief de production et montage' },
      ],
    },
    {
      name: 'structure',
      label: 'Structure, séquences et transitions',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Décrivez l’accroche, les parties, les transitions, les respirations et la conclusion.',
      placeholder: 'Ex. Question d’ouverture, exemple, méthode en trois étapes, récapitulatif puis invitation à agir…',
      required: false,
      maxLength: 750,
      rows: 4,
    },
    {
      name: 'voiceAndSpeakers',
      label: 'Voix, intervenants et tours de parole',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Décrivez des caractéristiques de voix et non l’imitation d’une personne réelle.',
      placeholder: 'Ex. Une voix adulte claire pour la narration, deux intervenants identifiés et des tours de parole courts…',
      required: false,
      maxLength: 650,
      rows: 4,
    },
    {
      name: 'tonePacing',
      label: 'Ton, rythme, débit et pauses',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Adaptez le niveau de langage et le rythme aux conditions d’écoute.',
      placeholder: 'Ex. Ton rassurant, débit modéré, phrases courtes et pause après chaque étape…',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'pronunciation',
      label: 'Prononciations, sigles, nombres et termes difficiles',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez les éléments à prononcer ou à faire vérifier par une personne compétente.',
      placeholder: 'Ex. Épeler le sigle lors de la première occurrence et lire les nombres en toutes lettres…',
      required: false,
      maxLength: 450,
      rows: 3,
    },
    {
      name: 'soundMusic',
      label: 'Musique, ambiances, bruitages et silences',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez leur fonction, leur durée et les droits nécessaires ; le silence peut aussi structurer l’écoute.',
      placeholder: 'Ex. Générique court sous licence, aucune musique sous la voix et silence bref entre les parties…',
      required: false,
      maxLength: 550,
      rows: 3,
    },
    {
      name: 'accessibilityTranscript',
      label: 'Transcription et accessibilité',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Prévoyez une transcription relue, l’identification des voix et un équivalent textuel des sons informatifs.',
      required: false,
      maxLength: 550,
      rows: 4,
    },
    {
      name: 'rightsConsent',
      label: 'Droits, licences et consentements',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Vérifiez séparément les voix, musiques, œuvres, extraits, marques et autorisations de diffusion.',
      required: true,
      maxLength: 750,
      rows: 4,
    },
    {
      name: 'technicalQuality',
      label: 'Qualité technique et compatibilité',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez le format final envisagé, le niveau sonore, le bruit de fond et les appareils de contrôle.',
      placeholder: 'Ex. Voix intelligible, niveau homogène, absence de saturation, contrôle au casque et sur téléphone…',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'verificationMethod',
      label: 'Contrôles humains avant diffusion',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez la relecture, l’écoute, la vérification des faits, des droits et de la transcription.',
      required: true,
      maxLength: 650,
      rows: 4,
    },
  ],
  requiredInformation: [
    'Le sujet, le type de contenu, le public et la situation d’écoute',
    'Le rôle de conception éditoriale et sonore',
    'L’objectif et le message essentiel',
    'Le mode de préparation, l’outil, la durée et le format',
    'La structure, les voix, le rythme et les indications sonores',
    'La transcription, les droits, les consentements et les contrôles humains',
  ],
  buildPrompt: buildAudioPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Le sujet, le public, la situation d’écoute et les ressources sont-ils définis ?',
      checkpoints: ['Type d’audio', 'Sujet et usage', 'Public et écoute', 'Ressources disponibles'],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Le rôle associe-t-il conception, intelligibilité, accessibilité, droits et contrôle ?',
      checkpoints: ['Expertise éditoriale', 'Conception sonore', 'Accessibilité et droits'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'L’effet attendu et le message essentiel sont-ils explicites ?',
      checkpoints: ['Effet auprès du public', 'Message essentiel'],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'La structure, les voix, le son, l’accessibilité, les droits et les contrôles sont-ils définis ?',
      checkpoints: ['Mode, outil, durée et format', 'Structure et voix', 'Rythme et prononciation', 'Son et qualité', 'Accessibilité et droits', 'Contrôle final'],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Décrivez le public, le message et l’usage, puis cadrez le script, les voix, le son, l’accessibilité et les droits. Le Studio construit un prompt à copier dans l’outil de votre choix.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. N’utilisez pas la voix, l’enregistrement, le nom ou l’identité d’une personne réelle sans son consentement explicite et les droits adaptés.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Audio et sur une grille CROP déterministe documentée. Le Studio n’enregistre, ne synthétise, ne monte et ne publie aucun fichier audio.',
  },
  beforeAfter: {
    vagueRequest: '« Fais-moi un podcast dynamique sur le sujet. »',
    missingDescription: 'Le public, le message, la durée, la structure, les voix, le rythme, les sources, la transcription, les droits et les contrôles ne sont pas définis.',
    structuredPrompt: '« Prépare le conducteur et le script d’une capsule pédagogique de trois minutes pour des adultes débutants. Utilise une voix claire, un débit modéré, trois étapes séparées par une pause et une conclusion récapitulative. Signale les faits et prononciations à vérifier. Prévois une transcription relue et n’utilise que des voix et sons disposant des droits et consentements nécessaires. »',
    benefit: 'Le script peut être relu, chronométré, rendu accessible et transmis à une personne ou à un outil de production sans ambiguïté majeure.',
  },
  examples: [
    {
      title: 'Capsule pédagogique accessible',
      description: 'Préparer un script court avec transcription, pauses et contrôles avant diffusion.',
      prompt: `## Contexte
Capsule de trois minutes intégrée à une formation destinée à des adultes débutants.

## Rôle
Agis comme un concepteur éditorial et sonore attentif à la pédagogie, à l’intelligibilité et à l’accessibilité.

## Objectif
Permettre au public d’appliquer une méthode simple en trois étapes après l’écoute.

## Précisions
Prépare un conducteur minuté et un script balisé. Utilise une voix claire, un débit modéré et des pauses entre les étapes. Signale les faits et prononciations à contrôler. Prévois une transcription relue et une validation humaine des droits avant diffusion.`,
    },
    {
      title: 'Interview professionnelle',
      description: 'Structurer les questions, relances, transitions et autorisations d’une interview.',
      prompt: `## Contexte
Interview de quinze minutes destinée à présenter un retour d’expérience professionnel à un public adulte.

## Rôle
Agis comme un préparateur d’interview rigoureux, respectueux des personnes, des faits et du temps de parole.

## Objectif
Faire ressortir trois enseignements concrets sans transformer une expérience individuelle en vérité générale.

## Précisions
Propose une introduction, six questions ouvertes, des relances neutres et une conclusion. Identifie les passages nécessitant une vérification factuelle ou un consentement avant diffusion. Prévois la transcription, l’identification des voix et une écoute de contrôle.`,
    },
  ],
  recommendations: [
    'Lire le script à voix haute et le chronométrer : un texte naturel à l’écrit peut être difficile à comprendre à l’écoute.',
    'Décrire des caractéristiques de voix plutôt que demander l’imitation d’une personne réelle.',
    'Prévoir dès le départ une transcription relue et un équivalent textuel des informations uniquement sonores.',
    'Vérifier séparément les faits, les prononciations, les droits musicaux, les consentements et les conditions de diffusion.',
  ],
};
