import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const researchSchema = z.object({
  researchContext: z.string().trim().min(20, 'Décrivez le contexte de la recherche en au moins 20 caractères.').max(900, 'Limitez le contexte à 900 caractères.'),
  researchType: z.string().trim().min(1, 'Choisissez un type de recherche.'),
  audience: z.string().trim().min(5, 'Décrivez le destinataire de la recherche.').max(300, 'Limitez le destinataire à 300 caractères.'),
  knownInformation: z.string().trim().max(700, 'Limitez les informations déjà connues à 700 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(340, 'Limitez le rôle à 340 caractères.'),
  researchQuestion: z.string().trim().min(15, 'Formulez la question de recherche en au moins 15 caractères.').max(700, 'Limitez la question à 700 caractères.'),
  intendedUse: z.string().trim().max(500, 'Limitez l’usage attendu à 500 caractères.'),
  geographicScope: z.string().trim().max(250, 'Limitez le périmètre géographique à 250 caractères.'),
  timeScope: z.string().trim().max(250, 'Limitez le périmètre temporel à 250 caractères.'),
  sourcePriority: z.string().trim().min(1, 'Choisissez une priorité de sources.'),
  sourceRequirements: z.string().trim().max(700, 'Limitez les exigences relatives aux sources à 700 caractères.'),
  searchStrategy: z.string().trim().max(700, 'Limitez la stratégie de recherche à 700 caractères.'),
  outputFormat: z.string().trim().min(1, 'Choisissez un format de restitution.'),
  detailLevel: z.string().trim().min(1, 'Choisissez un niveau de détail.'),
  citationMethod: z.string().trim().min(1, 'Choisissez une méthode de citation.'),
  contradictions: z.string().trim().max(600, 'Limitez les consignes sur les contradictions à 600 caractères.'),
  constraints: z.string().trim().max(700, 'Limitez les contraintes à 700 caractères.'),
}).strict();

export type ResearchValues = z.infer<typeof researchSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: ResearchValues): ScoreRuleResult {
  let earnedPoints = 4;
  const present = [`Le type de recherche « ${values.researchType} » est défini.`];
  const missing: string[] = [];

  const contextLength = textLength(values.researchContext);
  if (contextLength >= 90) {
    earnedPoints += 10;
    present.push('La situation, le sujet et les enjeux de la recherche sont détaillés.');
  } else if (contextLength >= 45) {
    earnedPoints += 7;
    present.push('Le sujet et son contexte général sont compréhensibles.');
    missing.push('Les enjeux, circonstances ou limites générales de la recherche.');
  } else {
    earnedPoints += 4;
    present.push('Un premier sujet de recherche est indiqué.');
    missing.push('Une description plus précise de la situation et du besoin d’information.');
  }

  const audienceLength = textLength(values.audience);
  if (audienceLength >= 40) {
    earnedPoints += 6;
    present.push('Le destinataire, son niveau de connaissance et son besoin sont précisés.');
  } else if (audienceLength >= 20) {
    earnedPoints += 4;
    present.push('Le destinataire principal est compréhensible.');
    missing.push('Le niveau de connaissance ou l’usage attendu par le destinataire.');
  } else {
    earnedPoints += 2;
    present.push('Un destinataire est mentionné.');
    missing.push('Une description plus précise du lecteur de la recherche.');
  }

  const knownLength = textLength(values.knownInformation);
  if (knownLength >= 40) {
    earnedPoints += 5;
    present.push('Les informations déjà connues et les points restant à vérifier sont délimités.');
  } else if (knownLength >= 15) {
    earnedPoints += 3;
    present.push('Un premier état des connaissances est indiqué.');
    missing.push('La distinction entre faits déjà établis, hypothèses et informations à rechercher.');
  } else {
    missing.push('Les informations déjà connues, supposées ou restant à vérifier.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Décrivez le besoin, le type de recherche, le destinataire et ce qui est déjà connu sans saisir de données sensibles.',
  };
}

function evaluateRole(values: ResearchValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 70) {
    return {
      earnedPoints: 15,
      present: ['L’expertise documentaire, la posture critique et l’exigence de traçabilité sont clairement définies.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond au domaine, au type de sources et à la décision à éclairer.',
    };
  }
  if (length >= 35) {
    return {
      earnedPoints: 12,
      present: ['Un rôle de recherche professionnelle est défini.'],
      missing: ['La spécialité, la méthode critique ou l’exigence de vérification attendue.'],
      recommendation: 'Ajoutez le domaine, la méthode de recherche et l’obligation de distinguer les faits des déductions.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise et une posture adaptées à la recherche documentaire.'],
    recommendation: 'Précisez le rôle : domaine, recherche documentaire, évaluation des sources et traçabilité.',
  };
}

function evaluateObjective(values: ResearchValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const questionLength = textLength(values.researchQuestion);

  if (questionLength >= 80) {
    earnedPoints += 17;
    present.push('La question de recherche est précise, délimitée et orientée vers un résultat vérifiable.');
  } else if (questionLength >= 40) {
    earnedPoints += 13;
    present.push('La question principale est compréhensible.');
    missing.push('Les sous-questions, comparaisons ou critères permettant de délimiter la réponse.');
  } else {
    earnedPoints += 8;
    present.push('Une première question de recherche est formulée.');
    missing.push('Une question plus précise indiquant ce qui doit être établi, comparé ou vérifié.');
  }

  const useLength = textLength(values.intendedUse);
  if (useLength >= 40) {
    earnedPoints += 8;
    present.push('L’usage de la recherche et la décision qu’elle doit éclairer sont explicites.');
  } else if (useLength >= 15) {
    earnedPoints += 5;
    present.push('Un premier usage de la recherche est indiqué.');
    missing.push('La décision, la compréhension ou l’action que la recherche doit faciliter.');
  } else {
    missing.push('L’usage concret de la recherche après sa restitution.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Formulez une question délimitée et indiquez la décision ou la compréhension que les résultats doivent éclairer.',
  };
}

function evaluatePrecisions(values: ResearchValues): ScoreRuleResult {
  let earnedPoints = 12;
  const present = [
    `La priorité de sources « ${values.sourcePriority} » est définie.`,
    `Le format « ${values.outputFormat} » est demandé.`,
    `Le niveau de détail « ${values.detailLevel} » est précisé.`,
    `La méthode de citation « ${values.citationMethod} » est définie.`,
  ];
  const missing: string[] = [];

  if (textLength(values.geographicScope) >= 12) {
    earnedPoints += 2;
    present.push('Le périmètre géographique est délimité.');
  } else {
    missing.push('Le territoire, le marché ou la zone géographique couverte.');
  }

  if (textLength(values.timeScope) >= 12) {
    earnedPoints += 2;
    present.push('La période et le niveau d’actualité attendu sont précisés.');
  } else {
    missing.push('La période étudiée, la date limite ou le niveau d’actualité attendu.');
  }

  const requirementsLength = textLength(values.sourceRequirements);
  if (requirementsLength >= 45) {
    earnedPoints += 6;
    present.push('Les critères d’acceptation, d’exclusion et de fraîcheur des sources sont détaillés.');
  } else if (requirementsLength >= 18) {
    earnedPoints += 4;
    present.push('Une première exigence sur les sources est indiquée.');
    missing.push('Les critères de fiabilité, de fraîcheur ou d’exclusion des sources.');
  } else {
    missing.push('Les critères permettant d’accepter, de comparer ou d’écarter une source.');
  }

  const strategyLength = textLength(values.searchStrategy);
  if (strategyLength >= 40) {
    earnedPoints += 5;
    present.push('La stratégie, les sous-questions ou les mots-clés de recherche sont détaillés.');
  } else if (strategyLength >= 15) {
    earnedPoints += 3;
    present.push('Une première piste de recherche est indiquée.');
    missing.push('Des sous-questions, synonymes ou requêtes complémentaires.');
  } else {
    missing.push('La stratégie de recherche, les sous-questions ou les mots-clés utiles.');
  }

  const contradictionsLength = textLength(values.contradictions);
  if (contradictionsLength >= 35) {
    earnedPoints += 4;
    present.push('Le traitement des contradictions, lacunes et incertitudes est défini.');
  } else if (contradictionsLength >= 12) {
    earnedPoints += 2;
    present.push('Une première consigne de prudence est indiquée.');
    missing.push('La manière de comparer les sources divergentes et de signaler les lacunes.');
  } else {
    missing.push('La conduite à tenir lorsque les sources sont absentes, anciennes ou contradictoires.');
  }

  const constraintsLength = textLength(values.constraints);
  if (constraintsLength >= 35) {
    earnedPoints += 4;
    present.push('Les contraintes de restitution et les éléments à éviter sont définis.');
  } else if (constraintsLength >= 12) {
    earnedPoints += 2;
    present.push('Une première contrainte est indiquée.');
    missing.push('Les limites de longueur, de langue, d’interprétation ou de recommandation.');
  } else {
    missing.push('Les contraintes de restitution et les éléments à éviter.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez les périmètres, la hiérarchie et les critères des sources, la stratégie, les citations et le traitement des contradictions.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildResearchPrompt(values: ResearchValues) {
  return [
    '## Contexte',
    `- Situation et besoin d’information : ${values.researchContext}`,
    `- Type de recherche : ${values.researchType}`,
    `- Destinataire : ${values.audience}`,
    optionalLine('Informations déjà connues ou à vérifier', values.knownInformation),
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif de recherche',
    `- Question principale : ${values.researchQuestion}`,
    optionalLine('Usage attendu des résultats', values.intendedUse),
    '',
    '## Précisions',
    optionalLine('Périmètre géographique', values.geographicScope),
    optionalLine('Période et actualité attendue', values.timeScope),
    `- Priorité de sources : ${values.sourcePriority}`,
    optionalLine('Exigences et exclusions relatives aux sources', values.sourceRequirements),
    optionalLine('Stratégie, sous-questions et mots-clés', values.searchStrategy),
    `- Format de restitution : ${values.outputFormat}`,
    `- Niveau de détail : ${values.detailLevel}`,
    `- Citation et traçabilité : ${values.citationMethod}`,
    optionalLine('Contradictions et incertitudes', values.contradictions),
    optionalLine('Contraintes et éléments à éviter', values.constraints),
    '',
    '## Méthode de travail attendue',
    '1. Indique d’abord si tu peux réellement consulter les sources nécessaires et précise clairement toute limite d’accès ou d’actualité.',
    '2. Reformule la question et décompose-la en sous-questions vérifiables avant de rechercher les réponses.',
    '3. Priorise les sources selon la hiérarchie demandée, contrôle leur auteur, leur date, leur périmètre et leur caractère primaire ou secondaire.',
    '4. Recoupe les affirmations importantes avec plusieurs sources indépendantes lorsque le sujet le permet.',
    '5. Distingue les faits établis, les déductions, les estimations et les informations manquantes.',
    '6. Signale les contradictions et explique leur origine possible sans les résoudre arbitrairement.',
    '7. Cite chaque affirmation importante selon la méthode demandée et fournis les liens ou références réellement consultés.',
    '8. N’invente aucune source, URL, date, citation, statistique ou conclusion. Si une information ne peut pas être vérifiée, indique-le explicitement.',
  ].join('\n');
}

export const researchCategory: StudioCategoryConfig<ResearchValues> = {
  id: 'research',
  label: 'Recherche',
  shortDescription: 'Cadrer une recherche documentaire, vérifier les sources et produire une restitution traçable.',
  schema: researchSchema,
  defaultValues: {
    researchContext: '',
    researchType: 'recherche documentaire générale',
    audience: '',
    knownInformation: '',
    role: 'un documentaliste professionnel rigoureux, spécialisé dans l’évaluation des sources, le recoupement et la traçabilité des informations',
    researchQuestion: '',
    intendedUse: '',
    geographicScope: '',
    timeScope: '',
    sourcePriority: 'privilégier les sources primaires, officielles et récentes',
    sourceRequirements: '',
    searchStrategy: '',
    outputFormat: 'note de recherche structurée avec réponse courte, constats détaillés et sources',
    detailLevel: 'niveau intermédiaire avec explications courtes',
    citationMethod: 'placer un lien ou une référence après chaque affirmation importante',
    contradictions: '',
    constraints: '',
  },
  fields: [
    {
      name: 'researchContext',
      label: 'Sujet et contexte de la recherche',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez la situation, le besoin d’information et les enjeux sans saisir de dossier réel ou de donnée sensible.',
      placeholder: 'Exemple : préparer une note générale sur l’évolution récente d’une pratique professionnelle afin d’actualiser un support pédagogique fictif.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'researchType',
      label: 'Type de recherche',
      type: 'select',
      cropSection: 'context',
      help: 'Choisissez la démarche principale afin d’adapter les sources et la restitution.',
      required: true,
      options: [
        { value: 'recherche documentaire générale', label: 'Recherche documentaire générale' },
        { value: 'état de l’art ou revue de littérature', label: 'État de l’art ou revue de littérature' },
        { value: 'veille thématique ou professionnelle', label: 'Veille thématique' },
        { value: 'comparaison de solutions, pratiques ou acteurs', label: 'Comparaison ou benchmark' },
        { value: 'recherche réglementaire ou institutionnelle', label: 'Recherche réglementaire' },
        { value: 'vérification factuelle d’une affirmation', label: 'Vérification factuelle' },
        { value: 'recherche de marché ou de tendances', label: 'Marché ou tendances' },
      ],
    },
    {
      name: 'audience',
      label: 'Destinataire de la recherche',
      type: 'text',
      cropSection: 'context',
      help: 'Décrivez une fonction ou un public et son niveau de connaissance, sans identité réelle.',
      placeholder: 'Exemple : formateurs généralistes connaissant le sujet mais pas ses évolutions récentes',
      required: true,
      maxLength: 300,
      autoComplete: 'off',
    },
    {
      name: 'knownInformation',
      label: 'Informations déjà connues ou restant à vérifier',
      type: 'textarea',
      cropSection: 'context',
      help: 'Séparez les faits déjà établis, les hypothèses et les points à confirmer, sans coller de contenu confidentiel.',
      placeholder: 'Exemple : une recommandation générale est connue, mais sa date d’entrée en vigueur et son périmètre doivent être confirmés.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez le domaine, la méthode documentaire, l’esprit critique et la traçabilité attendus.',
      required: true,
      maxLength: 340,
      autoComplete: 'off',
    },
    {
      name: 'researchQuestion',
      label: 'Question principale de recherche',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Formulez ce qui doit être établi, comparé, expliqué ou vérifié.',
      placeholder: 'Exemple : quelles évolutions vérifiées depuis 2024 modifient cette pratique, quels acteurs sont concernés et quelles limites restent incertaines ?',
      required: true,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'intendedUse',
      label: 'Usage attendu des résultats',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez la décision, la compréhension ou la production que la recherche doit faciliter.',
      placeholder: 'Exemple : décider quels passages d’un support pédagogique fictif doivent être actualisés et lesquels nécessitent un avis spécialisé.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'geographicScope',
      label: 'Périmètre géographique',
      type: 'text',
      cropSection: 'precisions',
      help: 'Précisez le pays, le territoire, le marché ou indiquez que la recherche est internationale.',
      placeholder: 'Exemple : France et Union européenne, avec comparaison internationale si pertinente',
      required: false,
      maxLength: 250,
      autoComplete: 'off',
    },
    {
      name: 'timeScope',
      label: 'Période et actualité attendue',
      type: 'text',
      cropSection: 'precisions',
      help: 'Indiquez la période étudiée, une date limite ou la fraîcheur maximale acceptable des sources.',
      placeholder: 'Exemple : publications de janvier 2024 à aujourd’hui, avec date de consultation indiquée',
      required: false,
      maxLength: 250,
      autoComplete: 'off',
    },
    {
      name: 'sourcePriority',
      label: 'Sources à privilégier',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez la hiérarchie de sources la plus adaptée au sujet.',
      required: true,
      options: [
        { value: 'privilégier les sources primaires, officielles et récentes', label: 'Sources primaires et officielles' },
        { value: 'privilégier les publications scientifiques évaluées et les travaux de référence', label: 'Publications scientifiques' },
        { value: 'privilégier les sources institutionnelles et professionnelles reconnues', label: 'Sources institutionnelles et professionnelles' },
        { value: 'croiser sources primaires, publications de référence et retours professionnels', label: 'Hiérarchie mixte' },
        { value: 'croiser plusieurs médias récents et remonter aux documents d’origine', label: 'Actualité recoupée' },
      ],
    },
    {
      name: 'sourceRequirements',
      label: 'Exigences et exclusions relatives aux sources',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez les critères de fiabilité, de fraîcheur, d’indépendance et les sources à exclure.',
      placeholder: 'Exemple : auteur et date identifiables, document primaire recherché, contenu sponsorisé signalé et aucune source anonyme utilisée seule.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'searchStrategy',
      label: 'Stratégie, sous-questions et mots-clés',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Ajoutez les angles à explorer, synonymes, exclusions ou langues utiles à la recherche.',
      placeholder: 'Exemple : rechercher la définition officielle, la chronologie, les acteurs concernés, les exceptions et les évaluations indépendantes.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'outputFormat',
      label: 'Format de restitution',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez l’organisation la plus utile pour lire et vérifier les résultats.',
      required: true,
      options: [
        { value: 'note de recherche structurée avec réponse courte, constats détaillés et sources', label: 'Note de recherche structurée' },
        { value: 'tableau comparatif avec critères, résultats, limites et sources', label: 'Tableau comparatif' },
        { value: 'chronologie commentée avec dates, événements et références', label: 'Chronologie commentée' },
        { value: 'revue de sources organisée par thème et niveau de preuve', label: 'Revue de sources thématique' },
        { value: 'fiche de vérification factuelle avec verdict nuancé et preuves', label: 'Fiche de vérification factuelle' },
        { value: 'synthèse décisionnelle avec options, risques et points à confirmer', label: 'Synthèse décisionnelle' },
      ],
    },
    {
      name: 'detailLevel',
      label: 'Niveau de détail',
      type: 'select',
      cropSection: 'precisions',
      help: 'Adaptez la profondeur de la réponse au temps de lecture et à l’enjeu.',
      required: true,
      options: [
        { value: 'très concis avec cinq constats essentiels maximum', label: 'Très concis' },
        { value: 'niveau intermédiaire avec explications courtes', label: 'Intermédiaire' },
        { value: 'détaillé avec méthode, preuves et limites pour chaque constat', label: 'Détaillé' },
      ],
    },
    {
      name: 'citationMethod',
      label: 'Citation et traçabilité',
      type: 'select',
      cropSection: 'precisions',
      help: 'Indiquez comment rattacher chaque affirmation importante à sa source.',
      required: true,
      options: [
        { value: 'placer un lien ou une référence après chaque affirmation importante', label: 'Référence après chaque affirmation' },
        { value: 'utiliser des notes numérotées et une liste complète des sources', label: 'Notes numérotées' },
        { value: 'utiliser un tableau séparant affirmation, preuve, source et date', label: 'Tableau affirmation et source' },
        { value: 'présenter les sources à la fin de chaque partie avec leur date', label: 'Sources par partie' },
      ],
    },
    {
      name: 'contradictions',
      label: 'Contradictions, lacunes et incertitudes',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez comment présenter les désaccords, les données manquantes et le niveau de confiance.',
      placeholder: 'Exemple : comparer les dates et périmètres des sources divergentes, puis isoler les points impossibles à trancher.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'constraints',
      label: 'Contraintes et éléments à éviter',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez les limites de longueur, de langue, d’interprétation, de recommandation ou de type de source.',
      placeholder: 'Exemple : moins de 1 200 mots, français clair, aucune recommandation juridique et aucune affirmation sans référence vérifiable.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
  ],
  requiredInformation: [
    'Le sujet, le contexte et le type de recherche',
    'Le destinataire et les informations déjà connues',
    'Le rôle et la posture documentaire',
    'La question principale et l’usage des résultats',
    'Les périmètres, les sources, les citations et les limites',
  ],
  buildPrompt: buildResearchPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision de la situation, du type de recherche, du destinataire et des connaissances de départ.',
      checkpoints: ['Sujet et enjeux', 'Type de recherche', 'Destinataire', 'Informations connues'],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Adéquation de l’expertise documentaire, de l’esprit critique et de la traçabilité attendus.',
      checkpoints: ['Domaine', 'Méthode documentaire', 'Vérification', 'Traçabilité'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté de la question de recherche et de l’usage concret des résultats.',
      checkpoints: ['Question principale', 'Sous-questions', 'Résultat attendu', 'Décision à éclairer'],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Qualité des périmètres, des sources, de la stratégie, des citations et des règles de prudence.',
      checkpoints: ['Temps et territoire', 'Hiérarchie des sources', 'Stratégie', 'Citations', 'Contradictions', 'Contraintes'],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Décrivez la recherche à préparer sans coller de document confidentiel. Le Studio construit une méthode de recherche ; il ne consulte aucune source et ne vérifie aucun fait.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. Utilisez un sujet public ou décrivez votre situation avec des termes génériques.',
    resultHelp: 'Le score évalue le cadrage du formulaire Recherche. Il ne prouve ni la fiabilité des futures sources, ni l’exactitude des résultats et ne remplace pas leur vérification humaine.',
  },
  beforeAfter: {
    vagueRequest: '« Cherche les dernières informations fiables sur ce sujet. »',
    missingDescription: 'La question, le territoire, la période, les sources attendues, le format et la règle de citation ne sont pas définis.',
    structuredPrompt: '« Contexte : actualiser un support pédagogique fictif pour des formateurs généralistes. Rôle : documentaliste critique. Objectif : identifier les évolutions vérifiées depuis 2024 et les points encore incertains. Précisions : France et Union européenne, sources primaires récentes, recoupement, liens après chaque affirmation, contradictions isolées et aucune référence inventée. »',
    benefit: 'La recherche devient délimitée, reproductible et plus facile à contrôler avant toute réutilisation.',
  },
  examples: [
    {
      title: 'Actualiser un support',
      description: 'Repérer les évolutions récentes d’un sujet public avant de réviser un contenu pédagogique.',
      prompt: `Prépare une recherche documentaire sur les évolutions publiques d’une pratique professionnelle depuis 2024.
Privilégie les sources officielles et primaires, indique leur date et place une référence après chaque affirmation importante.
Distingue les faits établis, les interprétations et les points qui restent à confirmer.`,
    },
    {
      title: 'Comparer des solutions',
      description: 'Construire un benchmark fondé sur des critères identiques et des informations vérifiables.',
      prompt: `Compare trois catégories de solutions génériques selon le coût publié, les fonctionnalités documentées, l’accessibilité et les limites d’usage.
Utilise un tableau, rattache chaque donnée à une source datée et signale les informations non comparables.
N’invente aucun prix ni fonctionnalité.`,
    },
    {
      title: 'Vérifier une affirmation',
      description: 'Contrôler une affirmation publique en remontant aux documents d’origine.',
      prompt: `Vérifie une affirmation publique à partir de sources primaires et de publications indépendantes récentes.
Présente la formulation exacte, les preuves favorables et contraires, les limites du périmètre et un verdict nuancé.
Fournis uniquement les références réellement consultées.`,
    },
  ],
  recommendations: [
    'Indiquez toujours la période, le territoire et la date de consultation attendue.',
    'Privilégiez les sources primaires et demandez un recoupement pour les affirmations importantes.',
    'Ouvrez les références, contrôlez leur auteur, leur date et leur périmètre avant toute décision ou diffusion.',
  ],
};
