import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const productivitySchema = z.object({
  workContext: z.string().trim().min(20, 'Décrivez la situation de travail en au moins 20 caractères.').max(900, 'Limitez la situation à 900 caractères.'),
  taskType: z.string().trim().min(1, 'Choisissez un type de besoin.'),
  peopleAffected: z.string().trim().min(5, 'Décrivez les personnes concernées.').max(300, 'Limitez les personnes concernées à 300 caractères.'),
  currentMethod: z.string().trim().max(700, 'Limitez la méthode actuelle à 700 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(340, 'Limitez le rôle à 340 caractères.'),
  mainGoal: z.string().trim().min(15, 'Décrivez l’objectif principal en au moins 15 caractères.').max(700, 'Limitez l’objectif à 700 caractères.'),
  successOutcome: z.string().trim().max(500, 'Limitez le résultat attendu à 500 caractères.'),
  frequencyVolume: z.string().trim().max(350, 'Limitez la fréquence et le volume à 350 caractères.'),
  inputsResources: z.string().trim().max(700, 'Limitez les entrées et ressources à 700 caractères.'),
  toolsEnvironment: z.string().trim().max(500, 'Limitez les outils disponibles à 500 caractères.'),
  deadlinePriority: z.string().trim().max(350, 'Limitez les échéances et priorités à 350 caractères.'),
  workflowRequirements: z.string().trim().max(700, 'Limitez les étapes à préserver à 700 caractères.'),
  automationLevel: z.string().trim().min(1, 'Choisissez un niveau d’automatisation.'),
  outputFormat: z.string().trim().min(1, 'Choisissez un format de restitution.'),
  successCriteria: z.string().trim().max(600, 'Limitez les critères de réussite à 600 caractères.'),
  humanChecks: z.string().trim().max(600, 'Limitez les contrôles humains à 600 caractères.'),
  risksConstraints: z.string().trim().max(700, 'Limitez les risques et contraintes à 700 caractères.'),
}).strict();

export type ProductivityValues = z.infer<typeof productivitySchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: ProductivityValues): ScoreRuleResult {
  let earnedPoints = 4;
  const present = [`Le besoin « ${values.taskType} » est défini.`];
  const missing: string[] = [];

  const contextLength = textLength(values.workContext);
  if (contextLength >= 90) {
    earnedPoints += 10;
    present.push('La situation, les difficultés et les enjeux d’organisation sont détaillés.');
  } else if (contextLength >= 45) {
    earnedPoints += 7;
    present.push('La situation de travail est compréhensible.');
    missing.push('Les difficultés actuelles, leurs causes observables ou leurs conséquences.');
  } else {
    earnedPoints += 4;
    present.push('Une première situation de travail est indiquée.');
    missing.push('Une description plus précise de la tâche et du problème rencontré.');
  }

  const peopleLength = textLength(values.peopleAffected);
  if (peopleLength >= 35) {
    earnedPoints += 5;
    present.push('Les personnes concernées, leurs rôles et leur niveau d’autonomie sont précisés.');
  } else if (peopleLength >= 15) {
    earnedPoints += 3;
    present.push('Les personnes concernées sont indiquées.');
    missing.push('Le rôle, le niveau d’autonomie ou les besoins des personnes concernées.');
  } else {
    earnedPoints += 2;
    present.push('Un public est mentionné.');
    missing.push('Une description plus précise des personnes qui utiliseront la méthode.');
  }

  const methodLength = textLength(values.currentMethod);
  if (methodLength >= 50) {
    earnedPoints += 6;
    present.push('La méthode actuelle, ses points utiles et ses irritants sont détaillés.');
  } else if (methodLength >= 20) {
    earnedPoints += 4;
    present.push('Une première description de la méthode actuelle est fournie.');
    missing.push('Les étapes à conserver, les doublons, les attentes ou les pertes de temps observées.');
  } else {
    missing.push('La méthode actuelle et les difficultés concrètes à améliorer.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Décrivez la tâche, les personnes concernées et la méthode actuelle avec des termes génériques, sans nom ni information sensible.',
  };
}

function evaluateRole(values: ProductivityValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 65) {
    return {
      earnedPoints: 15,
      present: ['L’expertise en organisation, la posture pragmatique et l’attention aux contrôles humains sont définies.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond au contexte, aux outils et au niveau d’autonomie attendu.',
    };
  }
  if (length >= 32) {
    return {
      earnedPoints: 12,
      present: ['Un rôle d’organisation professionnelle est défini.'],
      missing: ['La spécialité, la posture d’accompagnement ou l’exigence de faisabilité.'],
      recommendation: 'Ajoutez le domaine, la recherche de simplicité et l’obligation de prévoir des validations humaines.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise et une posture adaptées à l’amélioration d’un processus de travail.'],
    recommendation: 'Précisez le rôle : organisation, amélioration de processus, pragmatisme et maîtrise des risques.',
  };
}

function evaluateObjective(values: ProductivityValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const goalLength = textLength(values.mainGoal);

  if (goalLength >= 75) {
    earnedPoints += 17;
    present.push('L’objectif décrit clairement l’amélioration recherchée et son périmètre.');
  } else if (goalLength >= 38) {
    earnedPoints += 13;
    present.push('L’objectif principal est compréhensible.');
    missing.push('Le périmètre exact, le problème à réduire ou le changement attendu.');
  } else {
    earnedPoints += 8;
    present.push('Un premier objectif est formulé.');
    missing.push('Un objectif plus précis, orienté vers un changement observable.');
  }

  const outcomeLength = textLength(values.successOutcome);
  if (outcomeLength >= 40) {
    earnedPoints += 8;
    present.push('Le résultat concret et observable attendu est explicite.');
  } else if (outcomeLength >= 15) {
    earnedPoints += 5;
    present.push('Un premier résultat attendu est indiqué.');
    missing.push('La forme finale, l’utilisateur ou l’effet observable du résultat.');
  } else {
    missing.push('Le résultat concret qui permettra de considérer la tâche comme terminée.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Décrivez le changement recherché et le résultat observable qui permettra de vérifier que le processus est utile.',
  };
}

function evaluatePrecisions(values: ProductivityValues): ScoreRuleResult {
  let earnedPoints = 6;
  const present = [
    `Le niveau d’automatisation « ${values.automationLevel} » est défini.`,
    `Le format « ${values.outputFormat} » est demandé.`,
  ];
  const missing: string[] = [];

  const scoredText = (
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

  scoredText(values.frequencyVolume, 12, 35, 4, 'La fréquence, le volume et les variations de charge sont détaillés.', 'Une fréquence ou un volume est indiqué.', 'La fréquence, le volume et les variations prévisibles de la tâche.');
  scoredText(values.inputsResources, 15, 45, 4, 'Les informations d’entrée, ressources et dépendances sont détaillées.', 'Une première ressource est indiquée.', 'Les informations, documents ou ressources nécessaires avant de commencer.');
  scoredText(values.toolsEnvironment, 12, 35, 3, 'Les outils autorisés et leurs limites sont précisés.', 'Un outil ou un environnement est indiqué.', 'Les outils disponibles, interdits ou imposés et leurs limites.');
  scoredText(values.deadlinePriority, 12, 35, 3, 'Les échéances, priorités et arbitrages sont définis.', 'Une échéance ou une priorité est indiquée.', 'Les délais, le niveau de priorité et les règles d’arbitrage.');
  scoredText(values.workflowRequirements, 15, 45, 5, 'Les étapes obligatoires, dépendances et responsabilités sont détaillées.', 'Une première étape à préserver est indiquée.', 'Les étapes obligatoires, les dépendances et les responsabilités à conserver.');
  scoredText(values.successCriteria, 12, 35, 4, 'Les critères de réussite sont mesurables ou directement vérifiables.', 'Un premier critère de réussite est indiqué.', 'Les critères permettant de mesurer le gain de temps, la qualité ou la fiabilité.');
  scoredText(values.humanChecks, 12, 35, 3, 'Les validations humaines et les points d’arrêt sont précisés.', 'Un contrôle humain est indiqué.', 'Les étapes nécessitant une relecture, une décision ou une autorisation humaine.');
  scoredText(values.risksConstraints, 12, 35, 3, 'Les risques, contraintes et actions interdites sont définis.', 'Une première limite est indiquée.', 'Les risques d’erreur, les contraintes et les actions à ne jamais automatiser.');

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez la charge, les entrées, les outils, les étapes, les critères de réussite, les contrôles humains et les risques.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildProductivityPrompt(values: ProductivityValues) {
  return [
    '## Contexte',
    `- Situation de travail : ${values.workContext}`,
    `- Type de besoin : ${values.taskType}`,
    `- Personnes concernées : ${values.peopleAffected}`,
    optionalLine('Méthode actuelle et difficultés', values.currentMethod),
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif',
    `- Amélioration recherchée : ${values.mainGoal}`,
    optionalLine('Résultat observable attendu', values.successOutcome),
    '',
    '## Précisions',
    optionalLine('Fréquence, volume et variations', values.frequencyVolume),
    optionalLine('Informations d’entrée et ressources', values.inputsResources),
    optionalLine('Outils et environnement disponibles', values.toolsEnvironment),
    optionalLine('Échéances et priorités', values.deadlinePriority),
    optionalLine('Étapes, dépendances et responsabilités à préserver', values.workflowRequirements),
    `- Niveau d’automatisation : ${values.automationLevel}`,
    `- Format de restitution : ${values.outputFormat}`,
    optionalLine('Critères de réussite', values.successCriteria),
    optionalLine('Validations et contrôles humains', values.humanChecks),
    optionalLine('Risques, contraintes et actions interdites', values.risksConstraints),
    '',
    '## Méthode de travail attendue',
    '1. Reformule l’objectif, les utilisateurs et le résultat final avant de proposer une organisation.',
    '2. Distingue les étapes indispensables, les attentes, les doublons, les dépendances et les décisions humaines.',
    '3. Propose un processus simple, ordonné et réaliste, avec pour chaque étape son entrée, son action, son responsable et son résultat.',
    '4. Respecte strictement le niveau d’automatisation demandé et prévois une solution manuelle ou un retour arrière lorsque c’est nécessaire.',
    '5. Place les validations humaines avant toute communication externe, suppression, dépense, engagement, décision sensible ou modification difficilement réversible.',
    '6. Définis les critères de réussite, les contrôles qualité et les signaux indiquant que le processus doit être interrompu ou corrigé.',
    '7. N’affirme jamais avoir exécuté une action, envoyé un message, modifié un fichier ou utilisé un outil. Produis uniquement la méthode ou le livrable demandé.',
  ].join('\n');
}

export const productivityCategory: StudioCategoryConfig<ProductivityValues> = {
  id: 'productivity',
  label: 'Productivité',
  shortDescription: 'Organiser une tâche, simplifier un processus et définir des contrôles humains vérifiables.',
  schema: productivitySchema,
  defaultValues: {
    workContext: '',
    taskType: 'organisation et priorisation d’une charge de travail',
    peopleAffected: '',
    currentMethod: '',
    role: 'un conseiller en organisation professionnelle, pragmatique, attentif à la simplicité, à la charge réelle et aux validations humaines',
    mainGoal: '',
    successOutcome: '',
    frequencyVolume: '',
    inputsResources: '',
    toolsEnvironment: '',
    deadlinePriority: '',
    workflowRequirements: '',
    automationLevel: 'proposer une méthode principalement manuelle avec assistance ponctuelle',
    outputFormat: 'plan d’action priorisé avec étapes, responsables, délais et points de contrôle',
    successCriteria: '',
    humanChecks: '',
    risksConstraints: '',
  },
  fields: [
    {
      name: 'workContext',
      label: 'Situation de travail et difficulté rencontrée',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez la tâche, le fonctionnement actuel et la difficulté concrète, avec un exemple fictif ou générique.',
      placeholder: 'Exemple : une petite équipe prépare chaque semaine plusieurs livrables, mais les priorités changent et les validations arrivent trop tard.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'taskType',
      label: 'Type de besoin de productivité',
      type: 'select',
      cropSection: 'context',
      help: 'Choisissez le besoin principal afin d’adapter la méthode et le livrable.',
      required: true,
      options: [
        { value: 'organisation et priorisation d’une charge de travail', label: 'Organisation et priorisation' },
        { value: 'création d’une checklist ou d’une procédure simple', label: 'Checklist ou procédure' },
        { value: 'amélioration d’un processus ou d’un flux de travail', label: 'Amélioration d’un processus' },
        { value: 'préparation et suivi d’une réunion', label: 'Préparation et suivi de réunion' },
        { value: 'planification d’un projet ou d’une échéance', label: 'Planification de projet' },
        { value: 'délégation et répartition des responsabilités', label: 'Délégation et responsabilités' },
        { value: 'organisation d’une tâche récurrente', label: 'Tâche récurrente' },
        { value: 'classement et réutilisation d’informations professionnelles', label: 'Organisation des informations' },
      ],
    },
    {
      name: 'peopleAffected',
      label: 'Personnes concernées et niveau d’autonomie',
      type: 'text',
      cropSection: 'context',
      help: 'Décrivez des fonctions ou des rôles, sans saisir de nom ni de donnée personnelle.',
      placeholder: 'Exemple : trois personnes polyvalentes, dont une valide les priorités et deux réalisent les tâches',
      required: true,
      maxLength: 300,
      autoComplete: 'off',
    },
    {
      name: 'currentMethod',
      label: 'Méthode actuelle, points utiles et irritants',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez les étapes existantes, ce qui fonctionne et les attentes, doublons ou pertes de temps observés.',
      placeholder: 'Exemple : demandes reçues par plusieurs canaux, liste tenue manuellement, priorités confirmées tardivement et aucune revue intermédiaire.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez l’expertise en organisation, la recherche de simplicité et l’attention aux validations humaines.',
      required: true,
      maxLength: 340,
      autoComplete: 'off',
    },
    {
      name: 'mainGoal',
      label: 'Amélioration principale recherchée',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Décrivez le changement recherché : réduire les attentes, clarifier les priorités, fiabiliser le suivi ou mieux répartir le travail.',
      placeholder: 'Exemple : construire une méthode hebdomadaire simple qui clarifie les priorités avant le début du travail et rend les blocages visibles.',
      required: true,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'successOutcome',
      label: 'Résultat observable attendu',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez le livrable ou l’effet qui permettra de considérer la tâche comme terminée.',
      placeholder: 'Exemple : chaque personne connaît ses trois priorités, leur échéance et le point de validation prévu.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'frequencyVolume',
      label: 'Fréquence, volume et variations de charge',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez la fréquence, le nombre approximatif d’éléments et les périodes plus chargées.',
      placeholder: 'Exemple : revue chaque lundi, environ quinze tâches actives et deux urgences imprévues par semaine.',
      required: false,
      maxLength: 350,
      rows: 2,
    },
    {
      name: 'inputsResources',
      label: 'Informations d’entrée et ressources nécessaires',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez les informations, documents, validations ou ressources nécessaires avant de commencer.',
      placeholder: 'Exemple : liste des demandes, échéances confirmées, charge disponible, critères d’urgence et modèle de suivi.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'toolsEnvironment',
      label: 'Outils et environnement disponibles',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez uniquement les outils génériques ou autorisés et leurs limites.',
      placeholder: 'Exemple : agenda partagé, tableau de tâches existant et messagerie ; aucun nouvel outil payant.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'deadlinePriority',
      label: 'Échéances, priorités et règles d’arbitrage',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez les délais, ce qui est réellement prioritaire et qui peut trancher en cas de conflit.',
      placeholder: 'Exemple : sécurité et engagements datés avant les améliorations internes ; arbitrage par le responsable de l’activité.',
      required: false,
      maxLength: 350,
      rows: 2,
    },
    {
      name: 'workflowRequirements',
      label: 'Étapes, dépendances et responsabilités à préserver',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez les étapes obligatoires, leur ordre, les dépendances et les responsabilités non négociables.',
      placeholder: 'Exemple : vérifier les informations, prioriser, affecter un responsable, réaliser, relire puis valider avant diffusion.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'automationLevel',
      label: 'Niveau d’automatisation souhaité',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez le degré d’assistance souhaité sans autoriser d’action externe automatique.',
      required: true,
      options: [
        { value: 'proposer une méthode entièrement manuelle et directement applicable', label: 'Méthode entièrement manuelle' },
        { value: 'proposer une méthode principalement manuelle avec assistance ponctuelle', label: 'Méthode manuelle assistée' },
        { value: 'identifier les étapes répétitives automatisables avec validation humaine obligatoire', label: 'Automatisation avec validation humaine' },
        { value: 'comparer une version manuelle, une version assistée et une version partiellement automatisée', label: 'Comparer plusieurs niveaux' },
      ],
    },
    {
      name: 'outputFormat',
      label: 'Format de restitution',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez le livrable le plus simple à utiliser dans la situation décrite.',
      required: true,
      options: [
        { value: 'plan d’action priorisé avec étapes, responsables, délais et points de contrôle', label: 'Plan d’action priorisé' },
        { value: 'checklist opérationnelle dans l’ordre d’exécution', label: 'Checklist opérationnelle' },
        { value: 'procédure simple avec entrées, actions, sorties et validations', label: 'Procédure simple' },
        { value: 'planning réaliste avec jalons, dépendances et marges', label: 'Planning avec jalons' },
        { value: 'tableau de responsabilités avec qui fait quoi et qui valide', label: 'Tableau des responsabilités' },
        { value: 'comparaison du processus actuel et du processus proposé', label: 'Comparaison avant-après' },
      ],
    },
    {
      name: 'successCriteria',
      label: 'Critères de réussite et indicateurs utiles',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Choisissez quelques critères vérifiables : délai, qualité, nombre d’erreurs, attentes ou charge.',
      placeholder: 'Exemple : priorités validées avant mardi, aucune tâche sans responsable et blocages signalés sous vingt-quatre heures.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'humanChecks',
      label: 'Validations et contrôles humains obligatoires',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez les décisions, relectures et autorisations qui doivent toujours rester humaines.',
      placeholder: 'Exemple : le responsable valide les priorités et toute communication externe est relue avant envoi.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'risksConstraints',
      label: 'Risques, contraintes et actions interdites',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez les risques d’erreur, les contraintes de temps ou d’outil et les actions qui ne doivent jamais être automatisées.',
      placeholder: 'Exemple : aucune suppression, dépense, affectation définitive ou communication externe sans confirmation humaine.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
  ],
  requiredInformation: [
    'La situation, le type de besoin et les personnes concernées',
    'La méthode actuelle et ses difficultés',
    'Le rôle et la posture d’organisation',
    'L’amélioration recherchée et le résultat observable',
    'Les étapes, les outils, les contrôles humains et les critères de réussite',
  ],
  buildPrompt: buildProductivityPrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision de la situation, du besoin, des personnes et de la méthode actuelle.',
      checkpoints: ['Situation', 'Type de besoin', 'Personnes concernées', 'Méthode actuelle'],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Adéquation de l’expertise en organisation, de la simplicité et de la prudence attendues.',
      checkpoints: ['Organisation', 'Pragmatisme', 'Faisabilité', 'Contrôles humains'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté de l’amélioration recherchée et du résultat observable attendu.',
      checkpoints: ['Changement recherché', 'Périmètre', 'Livrable', 'Résultat observable'],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Qualité des étapes, ressources, priorités, contrôles, critères de réussite et limites.',
      checkpoints: ['Charge', 'Entrées', 'Outils', 'Étapes', 'Automatisation', 'Contrôles', 'Risques'],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Décrivez une situation de travail fictive ou générique. Le Studio prépare une méthode ou un livrable ; il n’exécute aucune tâche et ne se connecte à aucun outil.',
    privacy: 'Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible. N’ajoutez ni nom, ni adresse, ni document interne, ni identifiant d’accès.',
    resultHelp: 'Le score évalue le cadrage du formulaire Productivité. Il ne mesure pas un gain de temps réel et ne garantit pas que le processus sera adapté sans essai ni validation humaine.',
  },
  beforeAfter: {
    vagueRequest: '« Aide-moi à être plus productif et à mieux m’organiser. »',
    missingDescription: 'La tâche, les personnes, les priorités, les outils, le résultat attendu et les contrôles ne sont pas définis.',
    structuredPrompt: '« Contexte : une équipe fictive prépare quinze tâches par semaine avec des priorités changeantes. Rôle : conseiller en organisation pragmatique. Objectif : définir trois priorités par personne avant mardi et rendre les blocages visibles. Précisions : agenda partagé et tableau existant, plan d’action hebdomadaire, responsable pour chaque tâche, validation humaine avant communication et aucune suppression automatique. »',
    benefit: 'La demande devient un processus testable, limité et contrôlable plutôt qu’un conseil général sur la productivité.',
  },
  examples: [
    {
      title: 'Priorités hebdomadaires',
      description: 'Organiser une revue courte et rendre les responsabilités visibles.',
      prompt: `Construis une méthode hebdomadaire pour prioriser quinze tâches fictives entre trois rôles.
Produis un plan d’action avec responsable, échéance, dépendance et point de validation.
Prévois une revue des blocages et ne modifie aucun outil ni aucune affectation réelle.`,
    },
    {
      title: 'Réunion utile',
      description: 'Préparer une réunion, les décisions attendues et son suivi.',
      prompt: `Prépare une checklist pour une réunion de trente minutes destinée à prendre deux décisions clairement formulées.
Sépare préparation, ordre du jour, décision, actions et suivi.
Chaque action doit avoir un rôle responsable, une échéance et une validation humaine.`,
    },
    {
      title: 'Tâche récurrente',
      description: 'Fiabiliser une tâche répétitive sans automatisation incontrôlée.',
      prompt: `Transforme une tâche mensuelle fictive en procédure simple avec entrées, étapes, contrôles et résultat final.
Identifie les étapes répétitives qui pourraient être assistées, mais conserve une validation humaine avant toute diffusion.
Ajoute les erreurs fréquentes, les signaux d’arrêt et une solution manuelle de secours.`,
    },
  ],
  recommendations: [
    'Commencez par une seule tâche et testez la méthode sur une courte période avant de l’étendre.',
    'Mesurez quelques indicateurs simples : délai, erreurs, attentes et charge ressentie.',
    'Conservez une validation humaine pour toute décision, dépense, suppression ou communication externe.',
  ],
};
