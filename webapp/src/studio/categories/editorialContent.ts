import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const editorialContentSchema = z.object({
  editorialContext: z.string().trim().min(20, 'Décrivez le sujet et le contexte en au moins 20 caractères.').max(900, 'Limitez le contexte à 900 caractères.'),
  articleType: z.string().trim().min(1, 'Choisissez un type d’article.'),
  audience: z.string().trim().min(12, 'Précisez le lectorat en au moins 12 caractères.').max(500, 'Limitez le lectorat à 500 caractères.'),
  publicationDestination: z.string().trim().min(1, 'Choisissez une destination éditoriale.'),
  publicationDetails: z.string().trim().max(400, 'Limitez la description du média à 400 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(340, 'Limitez le rôle à 340 caractères.'),
  editorialGoal: z.string().trim().min(15, 'Décrivez l’objectif en au moins 15 caractères.').max(700, 'Limitez l’objectif à 700 caractères.'),
  editorialAngle: z.string().trim().min(15, 'Décrivez l’angle en au moins 15 caractères.').max(600, 'Limitez l’angle à 600 caractères.'),
  articleLength: z.string().trim().min(1, 'Choisissez une longueur cible.'),
  technicalLevel: z.string().trim().min(1, 'Choisissez un niveau de technicité.'),
  editorialTone: z.string().trim().min(1, 'Choisissez un ton éditorial.'),
  outputFormat: z.string().trim().min(1, 'Choisissez un format de restitution.'),
  articleStructure: z.string().trim().min(15, 'Décrivez la structure en au moins 15 caractères.').max(900, 'Limitez la structure à 900 caractères.'),
  sourceMaterials: z.string().trim().max(800, 'Limitez les sources disponibles à 800 caractères.'),
  sourceRules: z.string().trim().max(700, 'Limitez les règles de sources à 700 caractères.'),
  temporalScope: z.string().trim().max(500, 'Limitez le périmètre temporel à 500 caractères.'),
  seoRequirements: z.string().trim().max(600, 'Limitez les contraintes SEO à 600 caractères.'),
  linkRequirements: z.string().trim().max(500, 'Limitez les liens attendus à 500 caractères.'),
  mediaRequirements: z.string().trim().max(500, 'Limitez les médias attendus à 500 caractères.'),
  callToAction: z.string().trim().max(400, 'Limitez l’appel à l’action à 400 caractères.'),
  editorialRules: z.string().trim().max(700, 'Limitez les règles éditoriales à 700 caractères.'),
  verificationMethod: z.string().trim().max(600, 'Limitez les contrôles à 600 caractères.'),
}).strict();

export type EditorialContentValues = z.infer<typeof editorialContentSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: EditorialContentValues): ScoreRuleResult {
  let earnedPoints = 4;
  const present = [`Le type « ${values.articleType} » est défini.`];
  const missing: string[] = [];

  const contextLength = textLength(values.editorialContext);
  if (contextLength >= 90) {
    earnedPoints += 10;
    present.push('Le sujet, son contexte, ses enjeux et le besoin éditorial sont détaillés.');
  } else if (contextLength >= 45) {
    earnedPoints += 7;
    present.push('Le sujet et son contexte général sont compréhensibles.');
    missing.push('Les enjeux, le point de départ ou les limites exactes du sujet.');
  } else {
    earnedPoints += 4;
    present.push('Un premier sujet est indiqué.');
    missing.push('Une description plus précise du sujet, de son contexte et de son intérêt pour le lecteur.');
  }

  const audienceLength = textLength(values.audience);
  if (audienceLength >= 40) {
    earnedPoints += 6;
    present.push('Le lectorat, son niveau et ses attentes sont détaillés.');
  } else if (audienceLength >= 20) {
    earnedPoints += 4;
    present.push('Le lectorat principal est identifiable.');
    missing.push('Le niveau de connaissance, les préoccupations ou les attentes du lectorat.');
  } else {
    earnedPoints += 2;
    present.push('Un lectorat général est indiqué.');
    missing.push('Un lectorat plus précis avec son niveau et ses besoins.');
  }

  const destinationLength = textLength(values.publicationDetails);
  if (destinationLength >= 40) {
    earnedPoints += 5;
    present.push(`La destination « ${values.publicationDestination} » et ses contraintes sont détaillées.`);
  } else if (destinationLength >= 15) {
    earnedPoints += 3;
    present.push(`La destination « ${values.publicationDestination} » est précisée.`);
    missing.push('La ligne éditoriale, le contexte de publication ou les contraintes du média.');
  } else {
    missing.push(`Les particularités du support « ${values.publicationDestination} » et de sa ligne éditoriale.`);
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez le sujet, le lectorat, le média de destination et les enjeux éditoriaux.',
  };
}

function evaluateRole(values: EditorialContentValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 70) {
    return {
      earnedPoints: 15,
      present: ['Le rôle combine expertise éditoriale, adaptation au lectorat, vérification des faits et clarté rédactionnelle.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond au sujet, au média et au niveau technique attendu.',
    };
  }
  if (length >= 35) {
    return {
      earnedPoints: 12,
      present: ['Un rôle rédactionnel adapté est défini.'],
      missing: ['La spécialité du sujet, la vérification des sources ou l’adaptation à la ligne éditoriale.'],
      recommendation: 'Ajoutez l’expertise du domaine, la vérification des faits et la ligne éditoriale à respecter.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise éditoriale et une posture de vérification adaptées au contenu.'],
    recommendation: 'Précisez le rôle : domaine, rédaction web, pédagogie, sources et responsabilité éditoriale.',
  };
}

function evaluateObjective(values: EditorialContentValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];

  const goalLength = textLength(values.editorialGoal);
  if (goalLength >= 80) {
    earnedPoints += 17;
    present.push('L’objectif décrit précisément la valeur apportée et l’effet attendu sur le lecteur.');
  } else if (goalLength >= 40) {
    earnedPoints += 13;
    present.push('L’objectif éditorial principal est compréhensible.');
    missing.push('La valeur concrète ou l’action attendue après la lecture.');
  } else {
    earnedPoints += 8;
    present.push('Une première intention éditoriale est indiquée.');
    missing.push('Un objectif plus précis, utile et observable pour le lecteur.');
  }

  const angleLength = textLength(values.editorialAngle);
  if (angleLength >= 40) {
    earnedPoints += 8;
    present.push('L’angle éditorial délimite clairement le traitement du sujet.');
  } else if (angleLength >= 25) {
    earnedPoints += 5;
    present.push('Un premier angle éditorial est défini.');
    missing.push('Une approche plus distinctive ou une limite plus claire du sujet.');
  } else {
    earnedPoints += 3;
    present.push('Une première orientation est indiquée.');
    missing.push('L’angle précis qui guidera la sélection et l’organisation des informations.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Définissez la valeur apportée au lecteur et un angle unique qui délimite clairement le sujet.',
  };
}

function evaluatePrecisions(values: EditorialContentValues): ScoreRuleResult {
  let earnedPoints = 11;
  const present = [
    `La longueur « ${values.articleLength} » est définie.`,
    `Le niveau « ${values.technicalLevel} » est choisi.`,
    `Le ton « ${values.editorialTone} » est précisé.`,
    `Le format « ${values.outputFormat} » est demandé.`,
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

  scoreText(values.articleStructure, 15, 45, 2, 4, 'La structure, la progression et les éléments obligatoires sont détaillés.', 'Une première structure est définie.', 'Le plan, la progression, les exemples et la conclusion attendus.');
  scoreText(values.sourceRules, 15, 45, 2, 4, 'Les exigences relatives aux sources, citations et incertitudes sont détaillées.', 'Une première règle de sources est indiquée.', 'Les sources autorisées, leur citation, leur date et le traitement des incertitudes.');
  scoreText(values.temporalScope, 12, 35, 2, 3, 'La période couverte, les dates et les besoins de mise à jour sont définis.', 'Un premier repère temporel est indiqué.', 'La période couverte, la date des événements et la date de vérification des informations.');
  scoreText(values.seoRequirements, 12, 35, 2, 3, 'Les intentions de recherche et contraintes SEO sont précisées sans surcharger le texte.', 'Une première attente SEO est indiquée.', 'L’intention de recherche, les mots-clés utiles, le titre et la description attendus.');
  scoreText(values.linkRequirements, 10, 30, 1, 2, 'Les liens internes et externes attendus sont définis.', 'Un premier besoin de liens est indiqué.', 'Les liens internes utiles, les sources externes et les ancres descriptives.');
  scoreText(values.mediaRequirements, 10, 30, 1, 2, 'Les illustrations, légendes et alternatives textuelles sont cadrées.', 'Un premier besoin de média est indiqué.', 'Les illustrations utiles, leurs droits, leurs légendes et leurs textes alternatifs.');
  scoreText(values.callToAction, 10, 30, 1, 2, 'La suite proposée au lecteur est claire et adaptée au contenu.', 'Un premier appel à l’action est indiqué.', 'La prochaine étape utile au lecteur ou la confirmation qu’aucun appel à l’action n’est nécessaire.');
  scoreText(values.editorialRules, 10, 30, 1, 2, 'Les règles éditoriales, exclusions et obligations sont détaillées.', 'Une première règle éditoriale est indiquée.', 'Les termes, affirmations, formulations, conflits d’intérêts ou contenus à éviter.');
  scoreText(values.verificationMethod, 12, 35, 1, 2, 'La relecture factuelle, technique, éditoriale et juridique est prévue.', 'Un premier contrôle est prévu.', 'Les responsables et contrôles à réaliser avant publication.');

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Détaillez le plan, les sources, les dates, le SEO, les liens, les médias, les règles et les contrôles avant publication.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildArticleTypeInstruction(values: EditorialContentValues) {
  const instructions: Record<string, string> = {
    'article de blog informatif': 'Privilégie l’utilité concrète, une progression fluide, des exemples vérifiables et une conclusion qui répond clairement au besoin initial.',
    'article technique ou documentation spécialisée': 'Précise les prérequis, versions, environnements et limites. Sépare les faits établis, les choix techniques et les recommandations. Ne présente aucun code, commande ou résultat comme testé sans preuve fournie.',
    'article d’actualité ou de veille': 'Distingue la date de publication de la date réelle des événements. Sépare les faits confirmés, les déclarations attribuées, les incertitudes et les informations susceptibles d’évoluer. Priorise les sources primaires récentes et indique la date de consultation.',
    'tutoriel ou guide pratique': 'Présente les prérequis, les étapes numérotées, le résultat attendu, les erreurs fréquentes et une méthode de vérification finale.',
    'dossier ou article de fond': 'Présente le contexte, les différentes dimensions du sujet, les points de vue étayés, les limites et une synthèse nuancée.',
    'comparatif ou aide au choix': 'Définis des critères comparables et explicites. Distingue les faits, les appréciations et les éventuels liens commerciaux. Évite tout classement sans méthode justifiée.',
    'interview ou compte rendu d’entretien': 'Utilise uniquement les propos réellement fournis et validés. N’invente, ne complète et ne reformule jamais une citation comme si elle avait été prononcée.',
    'tribune, chronique ou analyse argumentée': 'Distingue clairement les faits, les interprétations et les opinions. Présente les limites du raisonnement et les objections sérieuses.',
    'mise à jour ou réécriture d’un article existant': 'Conserve les éléments exacts et utiles, identifie ce qui doit être actualisé, signale les affirmations devenues incertaines et propose un journal synthétique des modifications.',
    'autre contenu éditorial à préciser': 'Adapte la structure au média et précise les conventions utilisées avant de rédiger.',
  };

  return instructions[values.articleType] ?? instructions['autre contenu éditorial à préciser'];
}

function buildEditorialPrompt(values: EditorialContentValues) {
  return [
    '## Contexte',
    `- Sujet et situation : ${values.editorialContext}`,
    `- Type de contenu : ${values.articleType}`,
    `- Lectorat : ${values.audience}`,
    `- Destination : ${values.publicationDestination}`,
    optionalLine('Média, rubrique ou ligne éditoriale', values.publicationDetails),
    optionalLine('Informations et sources déjà disponibles', values.sourceMaterials),
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif',
    `- Valeur apportée au lecteur : ${values.editorialGoal}`,
    `- Angle éditorial : ${values.editorialAngle}`,
    '',
    '## Précisions',
    `- Longueur cible : ${values.articleLength}`,
    `- Niveau de technicité : ${values.technicalLevel}`,
    `- Ton : ${values.editorialTone}`,
    `- Format de restitution : ${values.outputFormat}`,
    `- Structure attendue : ${values.articleStructure}`,
    optionalLine('Règles relatives aux sources et citations', values.sourceRules),
    optionalLine('Période, dates et actualisation', values.temporalScope),
    optionalLine('Intentions de recherche et SEO', values.seoRequirements),
    optionalLine('Liens internes et externes', values.linkRequirements),
    optionalLine('Illustrations, légendes et textes alternatifs', values.mediaRequirements),
    optionalLine('Suite proposée au lecteur', values.callToAction),
    optionalLine('Règles éditoriales et éléments à éviter', values.editorialRules),
    optionalLine('Contrôles avant publication', values.verificationMethod),
    '',
    '## Adaptation au type d’article',
    buildArticleTypeInstruction(values),
    '',
    '## Méthode et livrable attendu',
    '1. Reformule le sujet, l’angle, le lectorat et les hypothèses. Liste les informations indispensables qui manquent avant de rédiger.',
    '2. Propose d’abord un titre de travail et un plan hiérarchisé. Vérifie que chaque partie sert l’objectif et apporte une information distincte.',
    '3. Rédige ensuite le contenu dans le format demandé, avec des titres informatifs, des paragraphes lisibles, des transitions naturelles et des exemples adaptés au niveau du lectorat.',
    '4. N’invente aucun fait, chiffre, date, citation, source, témoignage, résultat, version technique ou lien. Si une information n’est pas fournie ou vérifiable avec les capacités disponibles, utilise un emplacement à compléter et indique le contrôle nécessaire.',
    '5. Pour toute information susceptible d’évoluer, précise la date concernée. Distingue clairement la date de l’événement, la date de publication de la source et la date de consultation.',
    '6. Place l’utilité pour le lecteur avant les mots-clés. Évite la répétition artificielle, les titres trompeurs, les promesses exagérées et les formulations destinées uniquement aux moteurs de recherche.',
    '7. Termine par une liste de vérification séparée : faits, dates, citations, sources, liens, niveau technique, droits des médias, accessibilité, orthographe et conformité à la ligne éditoriale.',
    '8. N’affirme jamais avoir recherché, vérifié, publié, mis à jour ou testé un contenu si ces actions n’ont pas réellement été réalisées dans l’environnement disponible. Produis uniquement le livrable demandé.',
  ].join('\n');
}

export const editorialContentCategory: StudioCategoryConfig<EditorialContentValues> = {
  id: 'editorial-content',
  label: 'Articles et contenus éditoriaux',
  shortDescription: 'Préparer un article de blog, technique, d’actualité ou de fond avec un angle, des sources et des contrôles explicites.',
  schema: editorialContentSchema,
  defaultValues: {
    editorialContext: '',
    articleType: 'article de blog informatif',
    audience: '',
    publicationDestination: 'site web ou blog de l’organisation',
    publicationDetails: '',
    role: 'un rédacteur web spécialisé dans le sujet, pédagogue, attentif aux sources, aux dates, à la clarté, à l’accessibilité et à la ligne éditoriale',
    editorialGoal: '',
    editorialAngle: '',
    articleLength: 'article moyen de 800 à 1 500 mots',
    technicalLevel: 'niveau intermédiaire avec les termes spécialisés expliqués',
    editorialTone: 'professionnel, clair et pédagogique',
    outputFormat: 'article complet avec titre, introduction, intertitres et conclusion',
    articleStructure: '',
    sourceMaterials: '',
    sourceRules: 'ne citer que des sources identifiables et vérifiables ; ne jamais inventer de lien, chiffre, date ou citation',
    temporalScope: '',
    seoRequirements: '',
    linkRequirements: '',
    mediaRequirements: '',
    callToAction: '',
    editorialRules: '',
    verificationMethod: '',
  },
  fields: [
    {
      name: 'editorialContext',
      label: 'Sujet, contexte et besoin éditorial',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez le sujet, son contexte et ce qui justifie la publication, sans saisir de donnée personnelle ou confidentielle.',
      placeholder: 'Exemple : expliquer aux petites structures comment reconnaître une information technique devenue obsolète avant de la reprendre sur leur site.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'articleType',
      label: 'Type d’article ou de contenu',
      type: 'select',
      cropSection: 'context',
      help: 'Choisissez la forme éditoriale principale.',
      required: true,
      options: [
        { value: 'article de blog informatif', label: 'Article de blog informatif' },
        { value: 'article technique ou documentation spécialisée', label: 'Article technique' },
        { value: 'article d’actualité ou de veille', label: 'Actualité ou veille' },
        { value: 'tutoriel ou guide pratique', label: 'Tutoriel ou guide pratique' },
        { value: 'dossier ou article de fond', label: 'Dossier ou article de fond' },
        { value: 'comparatif ou aide au choix', label: 'Comparatif ou aide au choix' },
        { value: 'interview ou compte rendu d’entretien', label: 'Interview ou entretien' },
        { value: 'tribune, chronique ou analyse argumentée', label: 'Tribune ou analyse' },
        { value: 'mise à jour ou réécriture d’un article existant', label: 'Mise à jour d’un article' },
        { value: 'autre contenu éditorial à préciser', label: 'Autre contenu éditorial' },
      ],
    },
    {
      name: 'audience',
      label: 'Lectorat, niveau et attentes',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez le lectorat de manière générique : connaissances, préoccupations et contexte de lecture.',
      placeholder: 'Exemple : responsables de petites structures, non spécialistes, recherchant une méthode rapide et fiable.',
      required: true,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'publicationDestination',
      label: 'Destination éditoriale',
      type: 'select',
      cropSection: 'context',
      help: 'Choisissez le type de site, de média ou de documentation concerné.',
      required: true,
      options: [
        { value: 'site web ou blog de l’organisation', label: 'Site ou blog de l’organisation' },
        { value: 'site institutionnel ou organisme de formation', label: 'Site institutionnel ou de formation' },
        { value: 'média spécialisé ou site technique', label: 'Média spécialisé ou technique' },
        { value: 'site d’actualité ou lettre de veille', label: 'Actualité ou lettre de veille' },
        { value: 'base de connaissances ou documentation', label: 'Base de connaissances' },
        { value: 'publication invitée ou média partenaire', label: 'Publication externe ou partenaire' },
        { value: 'autre destination à préciser', label: 'Autre destination' },
      ],
    },
    {
      name: 'publicationDetails',
      label: 'Média, rubrique et ligne éditoriale',
      type: 'textarea',
      cropSection: 'context',
      help: 'Indiquez les particularités du support, sa ligne éditoriale et le contexte de publication.',
      placeholder: 'Exemple : rubrique Conseils pratiques, ton pédagogique, articles consultés principalement sur téléphone.',
      required: false,
      maxLength: 400,
      rows: 3,
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez l’expertise du sujet, la responsabilité éditoriale et l’exigence de vérification.',
      required: true,
      maxLength: 340,
      autoComplete: 'off',
    },
    {
      name: 'editorialGoal',
      label: 'Objectif éditorial et valeur apportée au lecteur',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez ce que le lecteur doit comprendre, décider ou pouvoir faire après la lecture.',
      placeholder: 'Exemple : permettre au lecteur de contrôler la date, la version et la source d’une information avant de la publier.',
      required: true,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'editorialAngle',
      label: 'Angle éditorial et idée directrice',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Délimitez l’approche retenue : point de vue, question centrale, promesse de lecture et sujets exclus.',
      placeholder: 'Exemple : une méthode en quatre vérifications réalisables sans expertise technique, illustrée par un cas fictif.',
      required: true,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'articleLength',
      label: 'Longueur cible',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez un volume adapté au sujet et au contexte de lecture.',
      required: true,
      options: [
        { value: 'article court de 400 à 800 mots', label: 'Article court — 400 à 800 mots' },
        { value: 'article moyen de 800 à 1 500 mots', label: 'Article moyen — 800 à 1 500 mots' },
        { value: 'article long de 1 500 à 2 500 mots', label: 'Article long — 1 500 à 2 500 mots' },
        { value: 'dossier approfondi de plus de 2 500 mots', label: 'Dossier — plus de 2 500 mots' },
        { value: 'longueur à déterminer selon le sujet, sans remplissage', label: 'À déterminer selon le sujet' },
      ],
    },
    {
      name: 'technicalLevel',
      label: 'Niveau de technicité',
      type: 'select',
      cropSection: 'precisions',
      help: 'Adaptez le vocabulaire, les explications et les prérequis au lectorat.',
      required: true,
      options: [
        { value: 'niveau débutant, sans prérequis et sans jargon non expliqué', label: 'Débutant' },
        { value: 'niveau intermédiaire avec les termes spécialisés expliqués', label: 'Intermédiaire' },
        { value: 'niveau avancé pour des professionnels du domaine', label: 'Avancé' },
        { value: 'niveau expert avec hypothèses, limites et références techniques', label: 'Expert' },
        { value: 'plusieurs niveaux avec repères de lecture distincts', label: 'Plusieurs niveaux' },
      ],
    },
    {
      name: 'editorialTone',
      label: 'Ton éditorial',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez une tonalité compatible avec le média et le lectorat.',
      required: true,
      options: [
        { value: 'professionnel, clair et pédagogique', label: 'Professionnel et pédagogique' },
        { value: 'informatif, factuel et neutre', label: 'Informatif et neutre' },
        { value: 'technique, précis et documenté', label: 'Technique et documenté' },
        { value: 'accessible, conversationnel et sobre', label: 'Accessible et conversationnel' },
        { value: 'analytique, nuancé et argumenté', label: 'Analytique et nuancé' },
        { value: 'institutionnel, direct et sans emphase commerciale', label: 'Institutionnel et direct' },
      ],
    },
    {
      name: 'outputFormat',
      label: 'Format de restitution',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez le livrable à obtenir.',
      required: true,
      options: [
        { value: 'article complet avec titre, introduction, intertitres et conclusion', label: 'Article complet' },
        { value: 'plan détaillé à valider avant rédaction', label: 'Plan détaillé uniquement' },
        { value: 'premier jet avec emplacements à vérifier et à compléter', label: 'Premier jet à compléter' },
        { value: 'article complet avec métadonnées SEO et suggestions de liens', label: 'Article avec éléments SEO' },
        { value: 'réécriture avec journal synthétique des modifications', label: 'Réécriture avec suivi des changements' },
      ],
    },
    {
      name: 'articleStructure',
      label: 'Plan, progression et éléments obligatoires',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Décrivez les parties attendues, les exemples, encadrés, étapes ou objections à traiter.',
      placeholder: 'Exemple : introduction par un problème concret, quatre vérifications, exemple fictif, erreurs fréquentes puis liste de contrôle finale.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'sourceMaterials',
      label: 'Sources et informations déjà disponibles',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez les ressources réellement disponibles sans coller de contenu confidentiel ni de donnée personnelle.',
      placeholder: 'Exemple : documentation officielle datée, note interne sans donnée personnelle et deux statistiques dont la source reste à vérifier.',
      required: false,
      maxLength: 800,
      rows: 3,
    },
    {
      name: 'sourceRules',
      label: 'Sources, citations et informations incertaines',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez les sources prioritaires, leur citation et le traitement des faits non confirmés.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'temporalScope',
      label: 'Période couverte, dates et actualisation',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Pour l’actualité et la technique, distinguez la date des événements, des sources et de la vérification.',
      placeholder: 'Exemple : situation vérifiée au 20 juillet 2026 ; préciser la date de chaque annonce et signaler les éléments susceptibles d’évoluer.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'seoRequirements',
      label: 'Intentions de recherche et contraintes SEO',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez l’intention de recherche, les mots-clés utiles et les métadonnées sans imposer de répétitions artificielles.',
      placeholder: 'Exemple : répondre à « comment vérifier une source » ; proposer un titre, une description et un mot-clé principal naturel.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'linkRequirements',
      label: 'Liens internes, externes et ancres',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez les pages internes à relier et les sources externes autorisées. N’inventez aucun lien.',
      placeholder: 'Exemple : lien interne vers la formation concernée et liens externes uniquement vers les sources primaires citées.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'mediaRequirements',
      label: 'Illustrations, légendes et textes alternatifs',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Décrivez les médias utiles, leurs droits, leurs légendes et l’alternative textuelle attendue.',
      placeholder: 'Exemple : une capture fictive annotée et une illustration originale avec légende et texte alternatif descriptif.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'callToAction',
      label: 'Suite proposée au lecteur',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez une prochaine étape sobre et cohérente, ou précisez qu’aucun appel à l’action n’est souhaité.',
      placeholder: 'Exemple : télécharger une liste de contrôle ou consulter une ressource complémentaire, sans promesse commerciale.',
      required: false,
      maxLength: 400,
      rows: 2,
    },
    {
      name: 'editorialRules',
      label: 'Règles éditoriales et éléments à éviter',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez les formulations interdites, obligations, conflits d’intérêts, mentions et sujets hors périmètre.',
      placeholder: 'Exemple : aucun titre trompeur, témoignage inventé, promesse de résultat ou jargon non expliqué.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'verificationMethod',
      label: 'Relecture et validation avant publication',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez qui vérifiera les faits, les dates, la technique, les droits, les liens et la conformité éditoriale.',
      placeholder: 'Exemple : validation technique par le référent, contrôle des sources et dates, puis relecture éditoriale sur mobile.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
  ],
  requiredInformation: [
    'Le sujet, le type d’article, le lectorat et le média de destination',
    'Le rôle et l’expertise rédactionnelle attendus',
    'L’objectif et l’angle éditorial',
    'La longueur, le niveau technique, le ton, le format et le plan',
    'Les sources, les dates, les liens, les médias et les éventuelles contraintes SEO',
    'Les règles éditoriales et les contrôles avant publication',
  ],
  buildPrompt: buildEditorialPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision du sujet, du type d’article, du lectorat et de la destination éditoriale.',
      checkpoints: ['Type d’article : 4 points.', 'Sujet : 4, 7 ou 10 points.', 'Lectorat : 2, 4 ou 6 points.', 'Destination : 0, 3 ou 5 points.'],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Adéquation de l’expertise rédactionnelle, thématique et de la responsabilité éditoriale.',
      checkpoints: ['Rôle court : 8 points.', 'Rôle précisé : 12 points.', 'Expertise et vérification détaillées : 15 points.'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté de la valeur apportée au lecteur et de l’angle éditorial.',
      checkpoints: ['Objectif : 8, 13 ou 17 points.', 'Angle : 3, 5 ou 8 points.'],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Définition du format, du plan, des sources, des dates, du SEO et des contrôles.',
      checkpoints: [
        'Longueur, technicité, ton et format : 11 points.',
        'Plan et sources : 4 points chacun.',
        'Dates et SEO : 3 points chacun.',
        'Liens, médias, appel à l’action, règles et contrôles : 2 points chacun.',
      ],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Décrivez le sujet, le lectorat, l’objectif et l’angle, puis cadrez le plan, les sources, les dates et les contrôles. Le Studio construit un prompt éditorial à copier dans l’outil de votre choix.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. N’insérez pas de contenu protégé, d’entretien, de citation, d’image ou de document interne sans droits et autorisations adaptés.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Articles et contenus éditoriaux et sur une grille CROP déterministe documentée. Le Studio ne recherche, ne vérifie et ne publie aucun article.',
  },
  beforeAfter: {
    vagueRequest: '« Écris un article intéressant sur les nouvelles technologies. »',
    missingDescription: 'Le sujet, le lectorat, l’angle, le média, les sources, la période, le niveau technique, la structure et la validation ne sont pas définis.',
    structuredPrompt: '« Prépare un article technique de 1 200 mots destiné aux responsables de petites structures. Angle : quatre vérifications pour repérer une information logicielle obsolète. Utilise uniquement les sources officielles fournies, date chaque information susceptible d’évoluer, explique les termes spécialisés et termine par une liste de contrôle relue par le référent technique. »',
    benefit: 'Le contenu possède une ligne éditoriale, un niveau, des sources et des critères de validation clairement identifiables.',
  },
  examples: [
    {
      title: 'Article technique accessible',
      description: 'Expliquer un sujet spécialisé sans perdre un lectorat non expert.',
      prompt: `## Contexte
Article destiné au site d’un organisme de formation pour expliquer une évolution technique à des responsables non spécialistes.

## Rôle
Agis comme un rédacteur technique pédagogue, attentif aux versions, aux sources et aux limites.

## Objectif
Permettre au lecteur de comprendre les conséquences pratiques et les vérifications à effectuer.

## Précisions
Article de 1 200 mots, termes spécialisés expliqués, sources officielles datées, exemple fictif, aucun résultat inventé et validation technique avant publication.`,
    },
    {
      title: 'Article d’actualité',
      description: 'Distinguer les événements, leur date et les informations encore incertaines.',
      prompt: `## Contexte
Article de veille consacré à une annonce récente susceptible d’évoluer.

## Rôle
Agis comme un rédacteur d’actualité factuel et prudent.

## Objectif
Présenter ce qui est confirmé, ce qui reste incertain et les conséquences possibles sans dramatisation.

## Précisions
Indique la date réelle de l’annonce, la date de chaque source et la date de consultation. Priorise les sources primaires, attribue chaque déclaration et n’invente aucun contexte manquant.`,
    },
    {
      title: 'Tutoriel pour un blog',
      description: 'Transformer une méthode en étapes vérifiables et faciles à suivre.',
      prompt: `## Contexte
Tutoriel de blog destiné à des adultes débutants qui réalisent une tâche pour la première fois.

## Rôle
Agis comme un rédacteur pédagogique attentif à l’accessibilité et aux erreurs fréquentes.

## Objectif
Permettre au lecteur d’obtenir un résultat observable en suivant une méthode sûre.

## Précisions
Présente les prérequis, les étapes numérotées, un exemple fictif, les erreurs fréquentes et une vérification finale. Propose des illustrations avec légendes et textes alternatifs, sans inventer d’interface ni de commande testée.`,
    },
  ],
  recommendations: [
    'Définir l’angle avant le plan afin d’éviter un article trop large ou une simple accumulation d’informations.',
    'Dater chaque information susceptible d’évoluer et distinguer clairement les faits, les déclarations, les analyses et les opinions.',
    'Prévoir une relecture séparée des sources, de la technique, des droits, de l’accessibilité et de la ligne éditoriale avant publication.',
  ],
};
