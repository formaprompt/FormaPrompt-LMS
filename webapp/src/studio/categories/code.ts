import { z } from 'zod';
import type { ScoreRuleResult, StudioCategoryConfig } from '../types';

const codeSchema = z.object({
  developmentContext: z.string().trim().min(20, 'Décrivez le contexte technique en au moins 20 caractères.').max(900, 'Limitez le contexte à 900 caractères.'),
  taskType: z.string().trim().min(1, 'Choisissez un type de besoin technique.'),
  targetUsers: z.string().trim().min(5, 'Décrivez les utilisateurs concernés.').max(300, 'Limitez les utilisateurs à 300 caractères.'),
  existingSystem: z.string().trim().max(700, 'Limitez la description de l’existant à 700 caractères.'),
  role: z.string().trim().min(10, 'Précisez le rôle en au moins 10 caractères.').max(340, 'Limitez le rôle à 340 caractères.'),
  technicalGoal: z.string().trim().min(15, 'Décrivez l’objectif technique en au moins 15 caractères.').max(700, 'Limitez l’objectif à 700 caractères.'),
  successOutcome: z.string().trim().max(500, 'Limitez le résultat attendu à 500 caractères.'),
  technologyStack: z.string().trim().min(2, 'Précisez le langage ou l’environnement technique.').max(350, 'Limitez les technologies à 350 caractères.'),
  runtimeEnvironment: z.string().trim().max(350, 'Limitez l’environnement d’exécution à 350 caractères.'),
  inputsOutputs: z.string().trim().max(700, 'Limitez les entrées et sorties à 700 caractères.'),
  functionalRequirements: z.string().trim().max(800, 'Limitez les règles fonctionnelles à 800 caractères.'),
  qualityRequirements: z.string().trim().max(600, 'Limitez les exigences de qualité à 600 caractères.'),
  constraintsDependencies: z.string().trim().max(700, 'Limitez les contraintes et dépendances à 700 caractères.'),
  changeScope: z.string().trim().min(1, 'Choisissez un périmètre de modification.'),
  expectedDeliverable: z.string().trim().min(1, 'Choisissez un livrable technique.'),
  codingStandards: z.string().trim().min(1, 'Choisissez une règle de code.'),
  testRequirements: z.string().trim().max(700, 'Limitez les tests attendus à 700 caractères.'),
  securityPrivacy: z.string().trim().max(700, 'Limitez les règles de sécurité à 700 caractères.'),
  errorHandling: z.string().trim().max(600, 'Limitez la gestion des erreurs à 600 caractères.'),
}).strict();

export type CodeValues = z.infer<typeof codeSchema>;

function textLength(value: string) {
  return value.trim().length;
}

function evaluateContext(values: CodeValues): ScoreRuleResult {
  let earnedPoints = 4;
  const present = [`Le besoin technique « ${values.taskType} » est défini.`];
  const missing: string[] = [];

  const contextLength = textLength(values.developmentContext);
  if (contextLength >= 90) {
    earnedPoints += 10;
    present.push('Le problème, son contexte et ses conséquences sont détaillés.');
  } else if (contextLength >= 45) {
    earnedPoints += 7;
    present.push('Le contexte technique général est compréhensible.');
    missing.push('Le comportement observé, les circonstances ou l’impact du problème.');
  } else {
    earnedPoints += 4;
    present.push('Un premier contexte technique est indiqué.');
    missing.push('Une description plus précise du besoin ou du comportement à corriger.');
  }

  const usersLength = textLength(values.targetUsers);
  if (usersLength >= 35) {
    earnedPoints += 5;
    present.push('Les utilisateurs, leur situation et leur besoin sont précisés.');
  } else if (usersLength >= 15) {
    earnedPoints += 3;
    present.push('Les utilisateurs principaux sont indiqués.');
    missing.push('Leur niveau, leur environnement ou leur besoin concret.');
  } else {
    earnedPoints += 2;
    present.push('Un utilisateur est mentionné.');
    missing.push('Une description plus précise des personnes concernées par le code.');
  }

  const existingLength = textLength(values.existingSystem);
  if (existingLength >= 50) {
    earnedPoints += 6;
    present.push('L’existant, les comportements à préserver et les limites connues sont détaillés.');
  } else if (existingLength >= 20) {
    earnedPoints += 4;
    present.push('Une première description de l’existant est fournie.');
    missing.push('Les fichiers, interfaces, dépendances ou comportements à préserver.');
  } else {
    missing.push('L’état actuel du projet ou la confirmation qu’il s’agit d’un nouveau code isolé.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Décrivez le problème, les utilisateurs et l’existant sans coller de secret, de donnée réelle ou de code confidentiel.',
  };
}

function evaluateRole(values: CodeValues): ScoreRuleResult {
  const length = textLength(values.role);
  if (length >= 70) {
    return {
      earnedPoints: 15,
      present: ['L’expertise technique, la maintenabilité, la sécurité et la prudence sont clairement définies.'],
      missing: [],
      recommendation: 'Conservez ce rôle s’il correspond à la pile technique et au niveau de risque de la modification.',
    };
  }
  if (length >= 35) {
    return {
      earnedPoints: 12,
      present: ['Un rôle de développement professionnel est défini.'],
      missing: ['La spécialité, l’exigence de maintenabilité ou la posture de sécurité.'],
      recommendation: 'Ajoutez la technologie, la qualité attendue et l’obligation de préserver les comportements existants.',
    };
  }
  return {
    earnedPoints: 8,
    present: ['Un rôle de base est indiqué.'],
    missing: ['Une expertise et une posture adaptées au besoin technique.'],
    recommendation: 'Précisez le rôle : technologie, architecture, tests, sécurité et modification ciblée.',
  };
}

function evaluateObjective(values: CodeValues): ScoreRuleResult {
  let earnedPoints = 0;
  const present: string[] = [];
  const missing: string[] = [];
  const goalLength = textLength(values.technicalGoal);

  if (goalLength >= 80) {
    earnedPoints += 17;
    present.push('L’objectif technique décrit le comportement attendu et son périmètre.');
  } else if (goalLength >= 40) {
    earnedPoints += 13;
    present.push('L’objectif technique principal est compréhensible.');
    missing.push('Le comportement exact, le périmètre ou la condition de réussite.');
  } else {
    earnedPoints += 8;
    present.push('Un premier objectif technique est formulé.');
    missing.push('Un objectif plus précis et observable du point de vue de l’utilisateur ou du système.');
  }

  const outcomeLength = textLength(values.successOutcome);
  if (outcomeLength >= 40) {
    earnedPoints += 8;
    present.push('Le résultat observable et la condition de réussite sont explicites.');
  } else if (outcomeLength >= 15) {
    earnedPoints += 5;
    present.push('Un premier résultat attendu est indiqué.');
    missing.push('Le scénario vérifiable qui démontrera que le besoin est satisfait.');
  } else {
    missing.push('Le résultat concret permettant de vérifier que le code fonctionne comme attendu.');
  }

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Décrivez le comportement attendu et un scénario concret permettant de valider la réussite.',
  };
}

function evaluatePrecisions(values: CodeValues): ScoreRuleResult {
  let earnedPoints = 7;
  const present = [
    `Le périmètre « ${values.changeScope} » est défini.`,
    `Le livrable « ${values.expectedDeliverable} » est demandé.`,
    `La règle de code « ${values.codingStandards} » est précisée.`,
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

  scoreText(values.technologyStack, 2, 15, 2, 4, 'Le langage, le framework et les versions utiles sont précisés.', 'Une technologie principale est indiquée.', 'La pile technique, le langage et les versions nécessaires.');
  scoreText(values.runtimeEnvironment, 12, 30, 1, 2, 'L’environnement d’exécution et les plateformes visées sont détaillés.', 'Un environnement général est indiqué.', 'Le système, le navigateur, le serveur ou l’environnement d’exécution.');
  scoreText(values.inputsOutputs, 15, 35, 1, 3, 'Les entrées, sorties et formats de données sont détaillés.', 'Une entrée ou une sortie est indiquée.', 'Les entrées, sorties, formats et exemples de données non sensibles.');
  scoreText(values.functionalRequirements, 18, 45, 2, 4, 'Les règles fonctionnelles et les cas limites sont détaillés.', 'Une première règle fonctionnelle est indiquée.', 'Les règles fonctionnelles, les cas limites et les comportements interdits.');
  scoreText(values.qualityRequirements, 12, 35, 1, 3, 'Les exigences de qualité, performance, accessibilité ou maintenabilité sont définies.', 'Une première exigence de qualité est indiquée.', 'Les attentes de lisibilité, performance, accessibilité ou maintenabilité.');
  scoreText(values.constraintsDependencies, 12, 30, 1, 2, 'Les dépendances autorisées et les contraintes du projet sont précisées.', 'Une première contrainte est indiquée.', 'Les dépendances autorisées, interdites ou déjà présentes et les contraintes à respecter.');
  scoreText(values.testRequirements, 15, 35, 2, 4, 'Les tests, scénarios et commandes de validation sont détaillés.', 'Un premier test attendu est indiqué.', 'Les tests unitaires, d’intégration ou de parcours et leurs cas principaux.');
  scoreText(values.securityPrivacy, 12, 35, 1, 3, 'Les exigences de sécurité, de confidentialité et de validation des entrées sont définies.', 'Une première règle de sécurité est indiquée.', 'La validation des entrées, les droits, les secrets et les données à protéger.');
  scoreText(values.errorHandling, 12, 35, 1, 3, 'La gestion des erreurs, des états vides et des retours utilisateur est détaillée.', 'Une première erreur à traiter est indiquée.', 'Les erreurs attendues, les messages utiles, les états vides et les solutions de repli.');

  return {
    earnedPoints,
    present,
    missing,
    recommendation: 'Précisez la pile, l’environnement, les entrées et sorties, les règles, les tests, la sécurité et la gestion des erreurs.',
  };
}

function optionalLine(label: string, value: string) {
  return value.trim() ? `- ${label} : ${value.trim()}` : `- ${label} : à préciser`;
}

function buildCodePrompt(values: CodeValues) {
  return [
    '## Contexte',
    `- Situation technique : ${values.developmentContext}`,
    `- Type de besoin : ${values.taskType}`,
    `- Utilisateurs concernés : ${values.targetUsers}`,
    optionalLine('Projet existant et comportements à préserver', values.existingSystem),
    '',
    '## Rôle',
    `Agis comme ${values.role}.`,
    '',
    '## Objectif technique',
    `- Comportement attendu : ${values.technicalGoal}`,
    optionalLine('Résultat observable et condition de réussite', values.successOutcome),
    '',
    '## Précisions',
    `- Langage, framework et versions : ${values.technologyStack}`,
    optionalLine('Environnement d’exécution', values.runtimeEnvironment),
    optionalLine('Entrées, sorties et formats', values.inputsOutputs),
    optionalLine('Règles fonctionnelles et cas limites', values.functionalRequirements),
    optionalLine('Qualité, performance, accessibilité et maintenabilité', values.qualityRequirements),
    optionalLine('Contraintes et dépendances', values.constraintsDependencies),
    `- Périmètre de modification : ${values.changeScope}`,
    `- Livrable attendu : ${values.expectedDeliverable}`,
    `- Conventions de code : ${values.codingStandards}`,
    optionalLine('Tests et validations', values.testRequirements),
    optionalLine('Sécurité et protection des données', values.securityPrivacy),
    optionalLine('Erreurs, états vides et solutions de repli', values.errorHandling),
    '',
    '## Méthode de travail attendue',
    '1. Reformule le besoin, les hypothèses et les informations manquantes avant de proposer du code.',
    '2. Respecte la pile, les versions, les conventions et le périmètre indiqués. N’invente pas d’API, de fichier, de dépendance ou de comportement existant.',
    '3. Privilégie la modification la plus petite et la plus lisible qui satisfait le besoin sans réécrire les parties non concernées.',
    '4. Valide les entrées, traite les erreurs et les états vides, et ne place jamais de clé, mot de passe, jeton ou donnée sensible dans le code.',
    '5. Préserve les comportements existants, les données et les configurations qui ne sont pas explicitement inclus dans le périmètre.',
    '6. Fournis les tests demandés, les cas limites et les commandes de validation séparément du code.',
    '7. Signale clairement toute commande destructive, modification de base de données, migration, dépense, envoi externe ou action de production ; ne l’exécute pas sans autorisation explicite.',
    '8. N’affirme jamais avoir modifié un fichier, exécuté une commande, réussi un test ou déployé le code. Produis uniquement le livrable demandé.',
  ].join('\n');
}

export const codeCategory: StudioCategoryConfig<CodeValues> = {
  id: 'code',
  label: 'Code',
  shortDescription: 'Cadrer une création, une correction ou une revue de code avec des tests et des limites explicites.',
  schema: codeSchema,
  defaultValues: {
    developmentContext: '',
    taskType: 'création d’une fonctionnalité ciblée',
    targetUsers: '',
    existingSystem: '',
    role: 'un développeur senior pragmatique, attentif au code lisible, au typage, aux tests, à la sécurité et à la préservation de l’existant',
    technicalGoal: '',
    successOutcome: '',
    technologyStack: 'à préciser selon le projet existant',
    runtimeEnvironment: '',
    inputsOutputs: '',
    functionalRequirements: '',
    qualityRequirements: '',
    constraintsDependencies: '',
    changeScope: 'proposer une modification minimale et ciblée dans le projet existant',
    expectedDeliverable: 'code prêt à intégrer avec les fichiers concernés et les commandes de validation',
    codingStandards: 'respecter les conventions du projet, le typage disponible et éviter les dépendances inutiles',
    testRequirements: '',
    securityPrivacy: '',
    errorHandling: '',
  },
  fields: [
    {
      name: 'developmentContext',
      label: 'Contexte technique et problème rencontré',
      type: 'textarea',
      cropSection: 'context',
      help: 'Décrivez le comportement actuel ou le nouveau besoin sans coller de code confidentiel, de secret ou de donnée réelle.',
      placeholder: 'Exemple : dans une application fictive, un formulaire perd les modifications lorsque la validation échoue et aucun message n’explique le problème.',
      required: true,
      maxLength: 900,
      rows: 4,
    },
    {
      name: 'taskType',
      label: 'Type de besoin technique',
      type: 'select',
      cropSection: 'context',
      help: 'Choisissez la nature principale du travail demandé.',
      required: true,
      options: [
        { value: 'création d’une fonctionnalité ciblée', label: 'Créer une fonctionnalité' },
        { value: 'diagnostic et correction d’un défaut', label: 'Diagnostiquer et corriger' },
        { value: 'refactorisation sans changement fonctionnel', label: 'Refactoriser' },
        { value: 'explication ou documentation d’un code', label: 'Expliquer ou documenter' },
        { value: 'création ou amélioration de tests', label: 'Créer des tests' },
        { value: 'script d’automatisation local et contrôlé', label: 'Script d’automatisation' },
        { value: 'intégration d’une API ou d’un service', label: 'Intégrer une API' },
        { value: 'revue de code, sécurité, accessibilité ou performance', label: 'Auditer ou relire' },
      ],
    },
    {
      name: 'targetUsers',
      label: 'Utilisateurs concernés et situation d’usage',
      type: 'text',
      cropSection: 'context',
      help: 'Décrivez des profils ou rôles génériques, sans nom ni donnée personnelle.',
      placeholder: 'Exemple : adultes débutants utilisant le formulaire sur téléphone et ordinateur',
      required: true,
      maxLength: 300,
      autoComplete: 'off',
    },
    {
      name: 'existingSystem',
      label: 'Projet existant et comportements à préserver',
      type: 'textarea',
      cropSection: 'context',
      help: 'Indiquez l’architecture, les composants concernés et ce qui ne doit pas être réécrit ou modifié.',
      placeholder: 'Exemple : application React/Vite existante, formulaire React Hook Form, validations Zod et styles partagés à réutiliser.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'role',
      label: 'Rôle donné à l’assistant',
      type: 'text',
      cropSection: 'role',
      help: 'Précisez la technologie, le niveau d’expertise et les exigences de qualité et de sécurité.',
      required: true,
      maxLength: 340,
      autoComplete: 'off',
    },
    {
      name: 'technicalGoal',
      label: 'Comportement technique attendu',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Décrivez ce que le système doit permettre ou corriger du point de vue de l’utilisateur.',
      placeholder: 'Exemple : conserver les valeurs saisies, afficher l’erreur sous le champ concerné et placer le focus sur la première erreur.',
      required: true,
      maxLength: 700,
      rows: 4,
    },
    {
      name: 'successOutcome',
      label: 'Résultat observable et condition de réussite',
      type: 'textarea',
      cropSection: 'objective',
      help: 'Indiquez le scénario permettant de vérifier que le besoin est satisfait.',
      placeholder: 'Exemple : après une validation invalide, les valeurs restent visibles, le message est annoncé et aucun envoi n’est déclenché.',
      required: false,
      maxLength: 500,
      rows: 3,
    },
    {
      name: 'technologyStack',
      label: 'Langage, framework et versions',
      type: 'text',
      cropSection: 'precisions',
      help: 'Indiquez les technologies réellement utilisées ou demandez une solution indépendante d’un framework.',
      placeholder: 'Exemple : TypeScript strict, React 19, Vite 5, React Hook Form et Zod',
      required: true,
      maxLength: 350,
      autoComplete: 'off',
    },
    {
      name: 'runtimeEnvironment',
      label: 'Environnement d’exécution et plateformes visées',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez navigateur, système, serveur, terminal ou contraintes d’hébergement utiles.',
      placeholder: 'Exemple : navigateurs récents sur téléphone et ordinateur Windows, construction sous PowerShell.',
      required: false,
      maxLength: 350,
      rows: 2,
    },
    {
      name: 'inputsOutputs',
      label: 'Entrées, sorties et formats de données',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Décrivez des données fictives, leurs formats et le résultat produit.',
      placeholder: 'Exemple : objet avec sujet et destinataire ; sortie contenant statut, messages d’erreur et valeurs normalisées.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'functionalRequirements',
      label: 'Règles fonctionnelles et cas limites',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Listez les comportements obligatoires, les exceptions et ce qui ne doit jamais se produire.',
      placeholder: 'Exemple : conserver les champs valides, refuser une chaîne vide, gérer les espaces et ne jamais envoyer si une erreur subsiste.',
      required: false,
      maxLength: 800,
      rows: 3,
    },
    {
      name: 'qualityRequirements',
      label: 'Qualité, performance, accessibilité et maintenabilité',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez uniquement les qualités réellement importantes pour ce besoin.',
      placeholder: 'Exemple : TypeScript strict, navigation clavier, messages annoncés, fonctions pures et aucun rechargement inutile.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
    {
      name: 'constraintsDependencies',
      label: 'Contraintes et dépendances autorisées',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez les bibliothèques existantes à réutiliser, les ajouts interdits et les contraintes de compatibilité.',
      placeholder: 'Exemple : réutiliser Zod et React Hook Form, aucune nouvelle dépendance et aucune modification du service de données.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'changeScope',
      label: 'Périmètre de modification',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez l’étendue du livrable afin d’éviter une réécriture inutile.',
      required: true,
      options: [
        { value: 'proposer une modification minimale et ciblée dans le projet existant', label: 'Modification minimale du projet' },
        { value: 'créer un module isolé avec une interface claire', label: 'Module isolé' },
        { value: 'fournir un exemple complet autonome sans modifier un projet existant', label: 'Exemple autonome' },
        { value: 'diagnostiquer et expliquer sans proposer de modification', label: 'Diagnostic uniquement' },
        { value: 'comparer plusieurs approches avant de recommander une solution', label: 'Comparer plusieurs approches' },
      ],
    },
    {
      name: 'expectedDeliverable',
      label: 'Livrable technique attendu',
      type: 'select',
      cropSection: 'precisions',
      help: 'Choisissez la forme de réponse la plus facile à vérifier et à intégrer.',
      required: true,
      options: [
        { value: 'code prêt à intégrer avec les fichiers concernés et les commandes de validation', label: 'Code prêt à intégrer' },
        { value: 'correctif au format diff avec une explication courte', label: 'Correctif au format diff' },
        { value: 'solution pas à pas avec extraits de code limités', label: 'Solution pas à pas' },
        { value: 'spécification technique et pseudocode avant développement', label: 'Spécification et pseudocode' },
        { value: 'rapport de revue priorisé avec preuves et recommandations', label: 'Rapport de revue' },
        { value: 'tests uniquement avec scénarios et résultats attendus', label: 'Tests uniquement' },
      ],
    },
    {
      name: 'codingStandards',
      label: 'Conventions de code et niveau d’explication',
      type: 'select',
      cropSection: 'precisions',
      help: 'Précisez comment rester cohérent avec le projet et son public.',
      required: true,
      options: [
        { value: 'respecter les conventions du projet, le typage disponible et éviter les dépendances inutiles', label: 'Conventions du projet' },
        { value: 'produire un code minimal, lisible et sans dépendance externe', label: 'Code minimal sans dépendance' },
        { value: 'produire un code pédagogique avec commentaires courts sur les choix importants', label: 'Code pédagogique' },
        { value: 'appliquer un typage strict, des fonctions courtes et des interfaces explicites', label: 'Typage strict et interfaces' },
      ],
    },
    {
      name: 'testRequirements',
      label: 'Tests et commandes de validation',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Indiquez les scénarios normaux, erreurs, cas limites et contrôles attendus.',
      placeholder: 'Exemple : test unitaire de la validation, test du focus sur erreur et parcours clavier sur téléphone et ordinateur.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'securityPrivacy',
      label: 'Sécurité et protection des données',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Précisez validation des entrées, droits, secrets, données personnelles et opérations sensibles.',
      placeholder: 'Exemple : aucune clé dans le navigateur, données fictives dans les tests, validation côté serveur et droits minimaux.',
      required: false,
      maxLength: 700,
      rows: 3,
    },
    {
      name: 'errorHandling',
      label: 'Erreurs, états vides et solutions de repli',
      type: 'textarea',
      cropSection: 'precisions',
      help: 'Décrivez les erreurs prévisibles, les messages utiles et le comportement de secours.',
      placeholder: 'Exemple : message sous le champ invalide, conservation de la saisie, journal technique sans donnée personnelle et possibilité de réessayer.',
      required: false,
      maxLength: 600,
      rows: 3,
    },
  ],
  requiredInformation: [
    'Le contexte, le type de besoin et les utilisateurs',
    'Le projet existant et les comportements à préserver',
    'Le rôle et l’expertise technique',
    'Le comportement attendu et sa condition de réussite',
    'La pile, le périmètre, les règles, les tests, la sécurité et les erreurs',
  ],
  buildPrompt: buildCodePrompt,
  scoreRules: [
    {
      id: 'context',
      label: 'Contexte',
      maxPoints: 25,
      description: 'Précision du problème, du type de travail, des utilisateurs et du projet existant.',
      checkpoints: ['Problème', 'Type de besoin', 'Utilisateurs', 'Existant'],
      evaluate: evaluateContext,
    },
    {
      id: 'role',
      label: 'Rôle',
      maxPoints: 15,
      description: 'Adéquation de l’expertise technique, de la maintenabilité et de la sécurité attendues.',
      checkpoints: ['Technologie', 'Architecture', 'Qualité', 'Sécurité'],
      evaluate: evaluateRole,
    },
    {
      id: 'objective',
      label: 'Objectif',
      maxPoints: 25,
      description: 'Clarté du comportement attendu et du scénario permettant de valider la réussite.',
      checkpoints: ['Comportement', 'Périmètre', 'Utilisateur', 'Condition de réussite'],
      evaluate: evaluateObjective,
    },
    {
      id: 'precisions',
      label: 'Précisions',
      maxPoints: 35,
      description: 'Qualité de la pile, des règles, du livrable, des tests, de la sécurité et des erreurs.',
      checkpoints: ['Pile technique', 'Entrées et sorties', 'Règles', 'Livrable', 'Tests', 'Sécurité', 'Erreurs'],
      evaluate: evaluatePrecisions,
    },
  ],
  messages: {
    introduction: 'Décrivez un besoin technique générique ou fictif. Le Studio prépare une consigne de développement ; il ne lit aucun dépôt, ne modifie aucun fichier et n’exécute aucune commande.',
    privacy: 'Ne saisissez aucun code confidentiel, clé, mot de passe, jeton, donnée personnelle ou information interne. Utilisez des noms, chemins, URL et données fictifs.',
    resultHelp: 'Le score évalue le cadrage du formulaire Code. Il ne vérifie ni la compilation, ni la sécurité, ni le résultat d’un test et ne remplace pas une revue humaine.',
  },
  beforeAfter: {
    vagueRequest: '« Corrige mon formulaire et rends le code plus propre. »',
    missingDescription: 'Le défaut, la pile, le comportement attendu, le périmètre, les cas limites et les tests ne sont pas définis.',
    structuredPrompt: '« Contexte : formulaire React fictif perdant sa saisie après une erreur. Rôle : développeur TypeScript attentif à l’accessibilité. Objectif : conserver les valeurs, afficher et annoncer la première erreur. Précisions : React Hook Form et Zod existants, correctif minimal, aucune dépendance, tests de validation et parcours clavier, aucun secret et aucune modification du service de données. »',
    benefit: 'La demande devient une modification ciblée, testable et compatible avec l’architecture existante.',
  },
  examples: [
    {
      title: 'Corriger un formulaire',
      description: 'Décrire un défaut reproductible et les comportements à préserver.',
      prompt: `Diagnostique un formulaire TypeScript fictif qui perd sa saisie après une validation invalide.
Propose un correctif minimal réutilisant la validation existante, conserve les valeurs et place le focus sur la première erreur.
Ajoute les tests unitaires et clavier sans nouvelle dépendance.`,
    },
    {
      title: 'Créer une fonctionnalité',
      description: 'Cadrer une petite fonctionnalité avec son interface et ses tests.',
      prompt: `Crée un module isolé qui transforme une liste fictive de tâches en groupes par priorité.
Définis les types d’entrée et de sortie, gère la liste vide et les priorités inconnues.
Fournis le code, trois tests et les commandes de validation sans modifier d’autre fichier.`,
    },
    {
      title: 'Relire un code',
      description: 'Obtenir une revue structurée sans appliquer automatiquement de correction.',
      prompt: `Relis cet extrait fictif en recherchant les défauts de sécurité, d’accessibilité et de maintenabilité.
Classe les constats par gravité, rattache chacun à une ligne et propose une correction courte.
N’applique aucune modification et distingue les défauts confirmés des améliorations facultatives.`,
    },
  ],
  recommendations: [
    'Indiquez les versions réellement utilisées et les comportements existants à préserver.',
    'Demandez une modification ciblée, des cas limites et des tests proportionnés au risque.',
    'Relisez le code, exécutez réellement les tests et contrôlez la sécurité avant toute mise en production.',
  ],
};
