import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const aiAgentSchema = z.object({
  agentContext: z.string().trim().min(20, 'Décrivez la situation en au moins 20 caractères.').max(900, 'Limitez la situation à 900 caractères.'),
  agentType: z.string().trim().min(1, 'Choisissez un type d’agent.'),
  targetUsers: z.string().trim().min(5, 'Précisez les personnes concernées.').max(350, 'Limitez les personnes concernées à 350 caractères.'),
  existingProcess: z.string().trim().max(700, 'Limitez le processus actuel à 700 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(400, 'Limitez le rôle à 400 caractères.'),
  mission: z.string().trim().min(15, 'Décrivez la mission en au moins 15 caractères.').max(800, 'Limitez la mission à 800 caractères.'),
  successOutcome: z.string().trim().max(500, 'Limitez le résultat attendu à 500 caractères.'),
  autonomyLevel: z.string().trim().min(1, 'Choisissez un niveau d’autonomie.'),
  memoryPolicy: z.string().trim().min(1, 'Choisissez une politique de mémoire.'),
  deliverableFormat: z.string().trim().min(1, 'Choisissez un livrable.'),
  operatingConditions: z.string().trim().max(700, 'Limitez les conditions de fonctionnement à 700 caractères.'),
  dataAndInputs: z.string().trim().max(700, 'Limitez les données et entrées à 700 caractères.'),
  actionBoundaries: z.string().trim().min(12, 'Précisez les actions autorisées et interdites.').max(900, 'Limitez les limites d’action à 900 caractères.'),
  humanControlEscalation: z.string().trim().min(12, 'Précisez les validations humaines.').max(900, 'Limitez les validations humaines à 900 caractères.'),
  traceability: z.string().trim().max(600, 'Limitez la traçabilité à 600 caractères.'),
  resourcesLimits: z.string().trim().max(500, 'Limitez les quotas et ressources à 500 caractères.'),
  safetyRecovery: z.string().trim().min(12, 'Précisez la procédure d’arrêt.').max(800, 'Limitez la sécurité et la reprise à 800 caractères.'),
  evaluationMonitoring: z.string().trim().max(500, 'Limitez les critères de suivi à 500 caractères.'),
}).strict();

export type AiAgentValues = z.infer<typeof aiAgentSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: AiAgentValues): ScoreRuleResult {
  let earnedPoints = 4;
  const present = [`Le type « ${values.agentType} » est défini.`];
  const missing: string[] = [];

  const contextLength = textLength(values.agentContext);
  if (contextLength >= 90) {
    earnedPoints += 10;
    present.push('La situation, le besoin et les enjeux sont détaillés.');
  } else if (contextLength >= 45) {
    earnedPoints += 7;
    present.push('La situation est compréhensible.');
    missing.push('Les difficultés actuelles, leurs causes ou leurs conséquences observables.');
  } else {
    earnedPoints += 4;
    present.push('Une première situation est indiquée.');
    missing.push('Une description plus précise du besoin et du processus concerné.');
  }

  const usersLength = textLength(values.targetUsers);
  if (usersLength >= 35) {
    earnedPoints += 5;
    present.push('Les utilisateurs, leurs responsabilités et leurs besoins sont précisés.');
  } else if (usersLength >= 15) {
    earnedPoints += 3;
    present.push('Les utilisateurs sont indiqués.');
    missing.push('Le rôle, les besoins ou le niveau d’expertise des utilisateurs.');
  } else {
    earnedPoints += 2;
    present.push('Un public est mentionné.');
    missing.push('Une description plus précise des personnes qui utiliseront ou superviseront l’agent.');
  }

  const processLength = textLength(values.existingProcess);
  if (processLength >= 50) {
    earnedPoints += 6;
    present.push('Le processus actuel, ses étapes et ses limites sont détaillés.');
  } else if (processLength >= 20) {
    earnedPoints += 4;
    present.push('Une première description du processus actuel est fournie.');
    missing.push('Les étapes, outils, responsabilités ou difficultés du processus actuel.');
  } else {
    missing.push('Le processus actuel et les points qui justifient la conception d’un agent.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Décrivez le besoin, les utilisateurs et le processus actuel à partir d’une situation fictive ou générique.',
  };
}

function evaluateRole(values: AiAgentValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 70) {
    return {
      earnedPoints: 15,
      present: ['Le rôle, l’expertise, la posture prudente et les limites de responsabilité sont définis.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il distingue clairement assistance, décision humaine et exécution autorisée.',
    };
  }
  if (length >= 35) {
    return {
      earnedPoints: 12,
      present: ['Un rôle spécialisé est défini.'],
      missing: ['La posture de prudence, les limites de responsabilité ou le devoir d’escalade.'],
      recommendation: 'Ajoutez l’expertise attendue et l’obligation de signaler les limites, risques et incertitudes.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise, une posture et des limites adaptées à la mission.'],
    recommendation: 'Précisez le domaine, la posture de service, la prudence et la responsabilité humaine finale.',
  };
}

function evaluateObjective(values: AiAgentValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const missionLength = textLength(values.mission);

  if (missionLength >= 80) {
    earnedPoints += 17;
    present.push('La mission, son périmètre et la valeur attendue sont détaillés.');
  } else if (missionLength >= 40) {
    earnedPoints += 13;
    present.push('La mission principale est compréhensible.');
    missing.push('Le périmètre exact, les exclusions ou la valeur observable attendue.');
  } else {
    earnedPoints += 8;
    present.push('Une première mission est formulée.');
    missing.push('Une mission plus précise, limitée et orientée vers un résultat vérifiable.');
  }

  const outcomeLength = textLength(values.successOutcome);
  if (outcomeLength >= 40) {
    earnedPoints += 8;
    present.push('Le résultat observable attendu est explicite.');
  } else if (outcomeLength >= 15) {
    earnedPoints += 5;
    present.push('Un premier résultat attendu est indiqué.');
    missing.push('La forme finale, l’utilisateur ou le critère observable du résultat.');
  } else {
    missing.push('Le résultat concret qui permettra de vérifier l’utilité de l’agent.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Formulez une mission limitée et un résultat observable sans confondre proposition, décision, exécution et vérification.',
  };
}

function evaluatePrecisions(values: AiAgentValues): ScoreRuleResult {
  let earnedPoints = 10;
  const present = [
    `Le niveau d’autonomie « ${values.autonomyLevel} » est défini.`,
    `La politique de mémoire « ${values.memoryPolicy} » est définie.`,
    `Le livrable « ${values.deliverableFormat} » est demandé.`,
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

  scoreText(values.operatingConditions, 15, 45, 3, 'Les déclencheurs, la fréquence et les outils autorisés sont détaillés.', 'Une condition de fonctionnement est indiquée.', 'Les déclencheurs, la fréquence, l’environnement et les outils réellement autorisés.');
  scoreText(values.dataAndInputs, 15, 45, 4, 'Les sources, entrées autorisées et données exclues sont détaillées.', 'Une première entrée ou source est indiquée.', 'Les sources autorisées, les formats d’entrée et les données exclues.');
  scoreText(values.actionBoundaries, 20, 55, 5, 'Les actions autorisées, interdites et soumises à approbation sont détaillées.', 'Une première limite d’action est indiquée.', 'Les actions autorisées, interdites et celles qui exigent une approbation humaine.');
  scoreText(values.humanControlEscalation, 20, 55, 5, 'Les validations humaines, points d’arrêt et règles d’escalade sont détaillés.', 'Un contrôle humain est indiqué.', 'Les décisions réservées à une personne, les points d’arrêt et la personne à alerter.');
  scoreText(values.traceability, 12, 35, 2, 'Les actions, sources, décisions et validations à journaliser sont précisées.', 'Une règle de traçabilité est indiquée.', 'Les éléments à journaliser sans exposer de données sensibles.');
  scoreText(values.resourcesLimits, 12, 35, 2, 'Les limites de coût, temps, volume ou fréquence sont définies.', 'Une limite de ressources est indiquée.', 'Les quotas de coût, durée, volume, fréquence ou nombre d’actions.');
  scoreText(values.safetyRecovery, 15, 45, 2, 'La procédure d’arrêt, de reprise et de signalement est détaillée.', 'Une règle d’arrêt est indiquée.', 'La conduite à tenir en cas d’erreur, d’incertitude, de coût inattendu ou de risque de sécurité.');
  scoreText(values.evaluationMonitoring, 12, 35, 2, 'Les indicateurs, tests et revues périodiques sont définis.', 'Un premier critère de suivi est indiqué.', 'Les scénarios de test, indicateurs et revues permettant de contrôler la qualité dans le temps.');

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez les outils et données autorisés, les limites d’action, les validations humaines, les quotas, la traçabilité et la procédure d’arrêt.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildAiAgentPrompt(values: AiAgentValues) {
  return [
    'Tu conçois uniquement une spécification d’agent. Tu n’exécutes aucune action, tu ne contactes aucun service et tu ne prétends pas avoir testé ou déployé l’agent.',
    '',
    '## Contexte',
    `- Situation et besoin : ${values.agentContext}`,
    `- Type d’agent : ${values.agentType}`,
    `- Utilisateurs et responsables : ${values.targetUsers}`,
    optionalLine('Processus actuel', values.existingProcess),
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif',
    `- Mission limitée : ${values.mission}`,
    optionalLine('Résultat observable attendu', values.successOutcome),
    '',
    '## Précisions',
    `- Niveau d’autonomie maximal : ${values.autonomyLevel}`,
    `- Politique de mémoire : ${values.memoryPolicy}`,
    `- Livrable attendu : ${values.deliverableFormat}`,
    optionalLine('Déclencheurs, fréquence, environnement et outils autorisés', values.operatingConditions),
    optionalLine('Sources, entrées autorisées et données exclues', values.dataAndInputs),
    `- Actions autorisées, interdites ou soumises à approbation : ${values.actionBoundaries}`,
    `- Validations humaines, points d’arrêt et escalade : ${values.humanControlEscalation}`,
    optionalLine('Traçabilité et journalisation', values.traceability),
    optionalLine('Quotas et limites de ressources', values.resourcesLimits),
    `- Sécurité, arrêt et reprise : ${values.safetyRecovery}`,
    optionalLine('Tests, indicateurs et suivi', values.evaluationMonitoring),
    '',
    '## Garde-fous obligatoires',
    '- Considère comme interdit tout outil, donnée, compte, permission ou action qui n’est pas explicitement autorisé.',
    '- N’invente jamais un accès, une autorisation, une source, un résultat d’action ou une validation humaine.',
    '- Exige une approbation humaine explicite avant toute communication externe, suppression ou modification, dépense, engagement, changement de compte ou de droits, action en production, ou décision médicale, juridique, financière ou liée aux ressources humaines.',
    '- Ne demande, ne révèle et ne consigne aucun secret ni aucune donnée personnelle, confidentielle, médicale, financière ou sensible.',
    '- Distingue toujours quatre états : proposition, approbation, exécution autorisée et vérification du résultat.',
    '- Arrête-toi et demande une décision humaine en cas d’instruction contradictoire, d’autorisation manquante, d’incertitude importante, de coût inattendu, d’erreur répétée ou de risque de sécurité.',
    '',
    '## Méthode de réponse',
    '1. Reformule la mission et les exclusions.',
    '2. Liste les hypothèses à faire valider au lieu de les inventer.',
    '3. Propose les étapes, les outils et les données nécessaires.',
    '4. Pour chaque étape, indique l’entrée, la sortie, l’autorisation requise, le contrôle humain et la trace à conserver.',
    '5. Décris les scénarios normaux, les erreurs, l’arrêt d’urgence et la reprise.',
    '6. Termine par une liste de tests en environnement isolé et par les décisions humaines encore nécessaires.',
  ].join('\n');
}

export const aiAgentCategory: StudioCategoryConfig<AiAgentValues> = {
  id: 'ai-agent',
  label: 'Agent IA',
  shortDescription: 'Cadrer la mission, l’autonomie, les outils, les données et les contrôles humains d’un futur agent.',
  schema: aiAgentSchema,
  defaultValues: {
    agentContext: '',
    agentType: 'assistant de préparation de contenus',
    targetUsers: '',
    existingProcess: '',
    role: 'un concepteur d’agents professionnels prudent, attentif aux permissions, aux contrôles humains, à la traçabilité et à la sécurité',
    mission: '',
    successOutcome: '',
    autonomyLevel: 'proposer uniquement, sans exécuter d’action externe',
    memoryPolicy: 'aucune mémoire persistante',
    deliverableFormat: 'fiche de conception complète avec règles et scénarios de test',
    operatingConditions: '',
    dataAndInputs: '',
    actionBoundaries: 'Autoriser uniquement la préparation de propositions. Interdire toute action externe, suppression, dépense ou modification sans approbation humaine explicite.',
    humanControlEscalation: 'Une personne valide chaque action externe et toute décision ayant un effet sur un tiers. En cas de doute, l’agent s’arrête et demande une décision.',
    traceability: '',
    resourcesLimits: '',
    safetyRecovery: 'Arrêter le processus en cas d’autorisation manquante, de résultat incohérent, de coût inattendu ou de risque de sécurité, puis alerter la personne responsable.',
    evaluationMonitoring: '',
  },
  fields: [
    {
      name: 'agentContext',
      label: 'Situation, besoin et problème à résoudre',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez le travail concerné, la difficulté actuelle et pourquoi un agent est envisagé, sans donnée réelle sensible.',
      placeholder: 'Ex. Une équipe prépare chaque semaine des réponses à partir d’une base documentaire validée…',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'agentType',
      label: 'Type d’agent envisagé',
      type: 'select',
      cropSection: 'context',
      help: 'Ce choix décrit une famille d’usage et ne crée aucun agent réel.',
      required: true,
      options: [
        { value: 'assistant d’information interne', label: 'Assistant d’information interne' },
        { value: 'assistant de préparation de contenus', label: 'Assistant de préparation de contenus' },
        { value: 'agent de recherche et de veille', label: 'Agent de recherche et de veille' },
        { value: 'agent de support et d’orientation', label: 'Agent de support et d’orientation' },
        { value: 'agent de coordination de processus', label: 'Agent de coordination de processus' },
        { value: 'agent d’aide au code', label: 'Agent d’aide au code' },
        { value: 'agent de suivi et de contrôle', label: 'Agent de suivi et de contrôle' },
        { value: 'autre type d’agent', label: 'Autre' },
      ],
    },
    {
      name: 'targetUsers',
      label: 'Utilisateurs et personnes responsables',
      type: 'textarea',
      cropSection: 'context',
      help: 'Indiquez qui utilise, supervise et valide le travail, avec des profils génériques.',
      placeholder: 'Ex. Équipe support débutante, sous la responsabilité d’un responsable de service…',
      required: true,
      maxLength: 350,
      rows: 3,
    },
    {
      name: 'existingProcess',
      label: 'Processus actuel et difficultés',
      type: 'textarea',
      cropSection: 'context',
      help: 'Résumez les étapes, outils et contrôles existants afin de ne pas automatiser un processus mal compris.',
      placeholder: 'Ex. Réception, recherche manuelle, préparation d’un brouillon, relecture puis envoi…',
      required: false,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'role',
      label: 'Rôle et posture attendus',
      type: 'textarea',
      cropSection: 'role',
      help: 'Précisez l’expertise, la prudence, les responsabilités et les limites de décision.',
      required: true,
      maxLength: 400,
      rows: 3,
    },
    {
      name: 'mission',
      label: 'Mission précise et limitée',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Décrivez ce que le futur agent doit aider à accomplir et ce qui reste hors périmètre.',
      placeholder: 'Ex. Préparer un brouillon sourcé à faire valider, sans l’envoyer ni modifier la base documentaire…',
      required: true,
      maxLength: 800,
      rows: 4,
    },
    {
      name: 'successOutcome',
      label: 'Résultat observable attendu',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Définissez un livrable ou un changement mesurable qui permet de vérifier l’utilité.',
      placeholder: 'Ex. Un brouillon relié à ses sources, relu en moins de dix minutes par une personne…',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'autonomyLevel',
      label: 'Niveau d’autonomie maximal',
      type: 'select',
      cropSection: 'precisions',
      help: 'Commencez avec le niveau le plus faible et augmentez-le uniquement après des tests et une validation formelle.',
      required: true,
      options: [
        { value: 'proposer uniquement, sans exécuter d’action externe', label: 'Proposer uniquement' },
        { value: 'préparer des brouillons ou actions, puis attendre une approbation explicite', label: 'Préparer puis demander validation' },
        { value: 'exécuter une action réversible après approbation explicite pour chaque action', label: 'Exécuter après validation par action' },
        { value: 'exécuter uniquement des actions réversibles préautorisées, limitées et journalisées', label: 'Exécuter des actions préautorisées limitées' },
      ],
    },
    {
      name: 'memoryPolicy',
      label: 'Politique de mémoire',
      type: 'select',
      cropSection: 'precisions',
      help: 'Minimisez la conservation et définissez avant tout stockage sa finalité, sa durée et ses accès.',
      required: true,
      options: [
        { value: 'aucune mémoire persistante', label: 'Aucune mémoire persistante' },
        { value: 'mémoire limitée à la session puis effacement', label: 'Mémoire de session uniquement' },
        { value: 'historique minimal, autorisé, contrôlé et supprimé selon une durée définie', label: 'Historique minimal contrôlé' },
      ],
    },
    {
      name: 'deliverableFormat',
      label: 'Livrable à demander',
      type: 'select',
      cropSection: 'precisions',
      help: 'Le Studio produit un prompt pour concevoir ce livrable, pas un agent opérationnel.',
      required: true,
      options: [
        { value: 'fiche de conception complète avec règles et scénarios de test', label: 'Fiche de conception complète' },
        { value: 'instructions système et procédures de contrôle', label: 'Instructions système et procédures' },
        { value: 'scénario de workflow avec validations humaines', label: 'Scénario de workflow' },
        { value: 'plan de prototype et de tests en environnement isolé', label: 'Plan de prototype et de tests' },
      ],
    },
    {
      name: 'operatingConditions',
      label: 'Déclencheurs, fréquence, environnement et outils autorisés',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Nommez uniquement les outils réellement disponibles et précisez quand l’agent doit intervenir.',
      placeholder: 'Ex. Déclenchement manuel, deux fois par semaine, lecture seule de la base documentaire validée…',
      required: false,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'dataAndInputs',
      label: 'Sources, entrées autorisées et données exclues',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Définissez une liste minimale et excluez les secrets et données personnelles ou sensibles.',
      placeholder: 'Ex. Fiches publiques validées au format PDF ; aucune donnée client, aucun mot de passe…',
      required: false,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'actionBoundaries',
      label: 'Actions autorisées, interdites ou soumises à approbation',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Appliquez le principe : ce qui n’est pas explicitement autorisé reste interdit.',
      required: true,
      maxLength: 900,
      rows: 5,
    },
    {
      name: 'humanControlEscalation',
      label: 'Validations humaines, points d’arrêt et escalade',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez qui valide quoi, à quel moment, et qui doit être alerté en cas de doute ou d’incident.',
      required: true,
      maxLength: 900,
      rows: 5,
    },
    {
      name: 'traceability',
      label: 'Traçabilité et journalisation',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez les sources, propositions, validations et actions à conserver, sans données sensibles inutiles.',
      placeholder: 'Ex. Date, type d’action, sources utilisées, validation obtenue et résultat vérifié…',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'resourcesLimits',
      label: 'Quotas, coûts, délais et limites de ressources',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Fixez des plafonds mesurables et un arrêt avant dépassement.',
      placeholder: 'Ex. Dix propositions par jour, durée maximale de cinq minutes, aucun achat…',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'safetyRecovery',
      label: 'Sécurité, arrêt d’urgence et reprise',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Définissez les erreurs ou risques qui imposent l’arrêt et la procédure de reprise contrôlée.',
      required: true,
      maxLength: 800,
      rows: 4,
    },
    {
      name: 'evaluationMonitoring',
      label: 'Scénarios de test, indicateurs et suivi',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Prévoyez des cas normaux, limites et hostiles, puis une revue périodique par une personne.',
      placeholder: 'Ex. Taux de propositions validées, erreurs par type, faux positifs, incidents et revue mensuelle…',
      required: false,
      maxLength: 500,
      rows: 3,
    },
  ],
  requiredInformation: [
    'Le besoin, le type d’agent, les utilisateurs et le processus actuel',
    'Le rôle, la mission limitée et le résultat observable',
    'Le niveau d’autonomie et la politique de mémoire',
    'Les outils, sources et données explicitement autorisés',
    'Les actions autorisées, interdites et soumises à approbation',
    'Les validations humaines, quotas, traces et procédures d’arrêt',
  ],
  buildPrompt: buildAiAgentPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Le besoin, les utilisateurs et le processus actuel sont-ils suffisamment compris ?',
      checkpoints: ['Type d’agent', 'Situation et enjeux', 'Utilisateurs et responsables', 'Processus actuel'],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Le rôle distingue-t-il expertise, prudence et responsabilité humaine ?',
      checkpoints: ['Expertise', 'Posture', 'Limites de responsabilité'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'La mission est-elle limitée et associée à un résultat observable ?',
      checkpoints: ['Mission', 'Périmètre', 'Résultat observable'],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Les permissions, données, contrôles, quotas, traces et règles d’arrêt sont-ils définis ?',
      checkpoints: ['Autonomie et mémoire', 'Outils et données', 'Limites d’action', 'Contrôles humains', 'Traçabilité et quotas', 'Sécurité et suivi'],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Cadrez un futur agent à partir de sa mission, de ses permissions et de ses contrôles. Le Studio construit une spécification à copier ; il ne crée, ne connecte et n’exécute aucun agent.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. N’indiquez aucun secret, mot de passe, clé, jeton, adresse réelle, document interne ou donnée permettant d’identifier une personne.',
    resultHelp: 'Le diagnostic du prompt repose uniquement sur les informations du formulaire Agent IA et sur une grille CROP déterministe documentée. Le Studio ne vérifie aucun accès, ne connecte aucun outil et n’exécute aucune action.',
  },
  beforeAfter: {
    vagueRequest: '« Crée-moi un agent qui gère tout tout seul. »',
    missingDescription: 'La mission, les utilisateurs, les outils, les données, les actions interdites, les validations humaines, les quotas, les traces et la procédure d’arrêt ne sont pas définis.',
    structuredPrompt: '« Conçois la fiche d’un assistant qui prépare des brouillons à partir d’une base documentaire validée, sans envoi ni modification. Chaque proposition cite ses sources et attend la validation du responsable. Aucun secret ni donnée personnelle. Arrêt immédiat si une source manque, si le coût dépasse le plafond ou si une instruction est contradictoire. »',
    benefit: 'La conception peut être relue, testée en environnement isolé et validée avant toute connexion à un outil ou à des données réelles.',
  },
  examples: [
    {
      title: 'Assistant documentaire interne',
      description: 'Préparer des réponses sourcées sans envoyer de message ni modifier la documentation.',
      prompt: `## Contexte
Une équipe doit retrouver des informations dans une base documentaire interne validée.

## Rôle
Agis comme un concepteur d’assistant documentaire prudent et traçable.

## Objectif
Conçois une fiche d’assistant qui prépare un brouillon relié à ses sources, sans envoi automatique.

## Précisions
Accès en lecture seule aux documents autorisés. Aucune donnée personnelle ni secret. Chaque brouillon attend une validation humaine. Journaliser les sources et la décision, arrêter si une source manque ou se contredit, puis proposer des tests en environnement isolé.`,
    },
    {
      title: 'Agent de veille avec validation',
      description: 'Cadrer une veille périodique dont les résultats restent vérifiés par une personne.',
      prompt: `## Contexte
Une équipe souhaite préparer une revue hebdomadaire de sources publiques autorisées.

## Rôle
Agis comme un concepteur de veille attentif aux dates, aux sources, aux coûts et aux incertitudes.

## Objectif
Définis un workflow qui collecte des références, prépare une synthèse et signale les contradictions sans publier le résultat.

## Précisions
Déclenchement manuel, quota hebdomadaire, liste blanche de sources, aucune mémoire persistante. Une personne vérifie chaque citation et décide de la diffusion. Décrire l’arrêt, la reprise, les traces et les scénarios de test.`,
    },
  ],
  recommendations: [
    'Commencer par une mission étroite, un environnement isolé et le niveau d’autonomie le plus faible.',
    'Appliquer une liste blanche : seuls les outils, données et actions explicitement autorisés peuvent être envisagés.',
    'Conserver une validation humaine pour les communications externes, suppressions, dépenses, engagements, droits d’accès et décisions à fort impact.',
    'Tester les cas normaux, les erreurs, les instructions contradictoires et l’arrêt d’urgence avant toute connexion réelle.',
  ],
};
