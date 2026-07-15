import promptEngineeringIntroVideoUrl from '../../vidéo/FP_-_Capsule_001_-_Rédiger_un_bon_prompt_finale_with_captions.mp4';

const generativeAiExercises = [
  {
    id: 1,
    title: 'Formulation structurée (méthode RTFC)',
    objective: 'Rôle, tâche, format, contraintes',
    instructions: "Rédigez un e-mail de relance client. Le prompt configure l'IA pour adopter un rôle précis et respecter des contraintes. Copiez-le puis testez-le dans l'outil de votre choix.",
    prompt: `Agis en tant que formateur et assistant administratif. Rédige un e-mail de relance poli et professionnel pour un client dont la facture de formation de 1 500 € est en retard de 15 jours. Le ton doit être ferme mais courtois, orienté solution. Propose un appel téléphonique si des facilités de paiement sont nécessaires. Limite le texte à 150 mots.`,
  },
  {
    id: 2,
    title: 'Simplification et adaptation de concepts',
    objective: 'Vulgarisation pédagogique',
    instructions: "Utilisez ce prompt pour demander à l'IA d'expliquer un concept complexe à deux publics différents.",
    prompt: `Explique le concept de « RAG » (génération augmentée par récupération) à deux publics :
1. Un enfant de 10 ans, avec une analogie simple.
2. Un responsable informatique, avec des termes techniques précis.
Structure la réponse avec des titres clairs.`,
  },
  {
    id: 3,
    title: 'Analyse de document et synthèse',
    objective: 'Extraction et structuration',
    instructions: "Cet exercice vous entraîne à transformer des notes brutes en un livrable structuré et vérifiable.",
    prompt: `Voici le compte rendu de notre réunion : [coller le texte ici].
Synthétise-le sous forme de tableau contenant trois colonnes :
1. Tâche ou action identifiée
2. Personne responsable
3. Date d'échéance estimée
Ajoute ensuite trois conseils pour vérifier la fidélité de la synthèse au document source.`,
  },
];

const generativeAiGlossary = [
  {
    term: 'Prompt',
    definition: "Instruction ou consigne fournie à un modèle d'IA pour guider sa réponse.",
  },
  {
    term: 'LLM (grand modèle de langage)',
    definition: "Modèle entraîné sur de grands volumes de textes afin d'analyser et de générer du langage naturel.",
  },
  {
    term: 'Token',
    definition: "Unité utilisée par un modèle pour découper et traiter un texte.",
  },
  {
    term: 'Hallucination',
    definition: "Réponse fausse, inventée ou imprécise produite par une IA, parfois formulée de manière convaincante.",
  },
  {
    term: 'RAG',
    definition: "Méthode qui fournit des documents de référence à un modèle afin d'ancrer sa réponse dans des sources déterminées.",
  },
  {
    term: 'Donnée sensible',
    definition: "Information qui nécessite une protection renforcée. Elle ne doit pas être transmise à un service d'IA sans cadre approprié.",
  },
];

const generativeAiQuiz = [
  {
    id: 'usage',
    question: "À quelle fréquence utilisez-vous déjà un outil d'IA générative ?",
    answers: [
      { label: 'Jamais ou presque', score: 0 },
      { label: 'Quelques fois par mois', score: 1 },
      { label: 'Chaque semaine', score: 2 },
      { label: 'Presque tous les jours', score: 3 },
    ],
  },
  {
    id: 'prompt',
    question: 'Savez-vous préciser le contexte, le résultat attendu et les contraintes dans une consigne ?',
    answers: [
      { label: 'Pas encore', score: 0 },
      { label: 'Partiellement', score: 1 },
      { label: 'Oui, avec une méthode', score: 2 },
    ],
  },
  {
    id: 'verification',
    question: "Comment vérifiez-vous une réponse produite par l'IA ?",
    answers: [
      { label: 'Je la réutilise généralement telle quelle', score: 0 },
      { label: 'Je relis surtout la forme', score: 1 },
      { label: 'Je contrôle les faits, les sources et le contexte', score: 2 },
    ],
  },
  {
    id: 'confidentiality',
    question: "Avez-vous des règles pour éviter de transmettre des données confidentielles à un outil d'IA ?",
    answers: [
      { label: 'Non', score: 0 },
      { label: 'J’y pense, mais sans règle formalisée', score: 1 },
      { label: 'Oui, des règles sont définies et appliquées', score: 2 },
    ],
  },
  {
    id: 'objective',
    question: 'Quel est votre objectif principal ?',
    answers: [
      { label: "Découvrir ce que l'IA peut faire", score: 0 },
      { label: 'Gagner du temps sur des tâches précises', score: 1 },
      { label: 'Structurer des usages fiables et responsables', score: 2 },
    ],
  },
];

const aiActExercises = [
  {
    id: 1,
    title: "Cartographier les usages de l'IA",
    objective: 'Usages, acteurs et données',
    instructions: "Recensez les outils et usages existants dans votre structure. N'insérez aucune donnée personnelle ou confidentielle dans un service public d'IA.",
    prompt: `Aide-moi à construire une grille de cartographie des usages de l'IA dans une organisation.
La grille doit comporter : l'outil, la finalité, les utilisateurs, les personnes concernées, les données traitées, le fournisseur, la validation humaine et les risques identifiés.
Fournis uniquement une trame vierge et des consignes de remplissage.`,
  },
  {
    id: 2,
    title: 'Effectuer un premier tri des risques',
    objective: 'Repérage, pas qualification juridique',
    instructions: "Analysez un cas fictif pour identifier les questions à transmettre au référent compétent. Cet exercice ne remplace pas une analyse juridique.",
    prompt: `À partir de ce cas fictif : [décrire un usage sans donnée réelle], prépare une liste de questions permettant d'identifier :
- le rôle de l'organisation ;
- les personnes affectées ;
- le niveau d'automatisation de la décision ;
- les obligations de transparence possibles ;
- les risques pour les droits fondamentaux ;
- les validations humaines nécessaires.
Ne conclus pas juridiquement : indique les points à faire valider par un professionnel compétent.`,
  },
  {
    id: 3,
    title: "Construire un plan d'acculturation",
    objective: 'Article 4 et usages réels',
    instructions: "Préparez un plan adapté aux fonctions, aux outils utilisés et au contexte de votre structure.",
    prompt: `Propose une trame de plan d'acculturation à l'IA pour une organisation de [taille] dans le secteur [secteur].
Distingue trois publics : utilisateurs occasionnels, utilisateurs réguliers et responsables de déploiement.
Pour chacun, précise les compétences attendues, les risques à connaître, les activités pédagogiques et les preuves de réalisation à conserver.`,
  },
];

const aiActGlossary = [
  {
    term: "Maîtrise de l'IA",
    definition: "Compétences, connaissances et compréhension permettant un usage éclairé des systèmes d'IA et une prise de conscience de leurs possibilités et risques.",
  },
  {
    term: 'Fournisseur',
    definition: "Acteur qui développe, ou fait développer, un système ou un modèle d'IA et le met sur le marché ou en service sous son nom.",
  },
  {
    term: 'Déployeur',
    definition: "Personne physique ou morale qui utilise un système d'IA sous son autorité, sauf usage personnel non professionnel.",
  },
  {
    term: "Système d'IA à haut risque",
    definition: "Système relevant de catégories définies par le règlement et soumis à des exigences renforcées. La qualification doit être étudiée au cas par cas.",
  },
  {
    term: 'Transparence',
    definition: "Ensemble d'informations permettant notamment de comprendre qu'une IA est utilisée et, selon le cas, ses capacités, limites et conditions d'emploi.",
  },
  {
    term: 'Supervision humaine',
    definition: "Mesures permettant à une personne compétente de surveiller un système, d'interpréter ses résultats et d'intervenir lorsque cela est nécessaire.",
  },
];

const aiActQuiz = [
  {
    id: 'inventory',
    question: "Votre structure dispose-t-elle d'un inventaire des outils et usages de l'IA ?",
    answers: [
      { label: 'Non', score: 0 },
      { label: 'Inventaire partiel ou informel', score: 1 },
      { label: 'Oui, il est documenté et actualisé', score: 2 },
    ],
  },
  {
    id: 'rules',
    question: "Des règles internes encadrent-elles l'utilisation de l'IA ?",
    answers: [
      { label: 'Aucune règle identifiée', score: 0 },
      { label: 'Des recommandations existent', score: 1 },
      { label: 'Une charte ou une procédure est diffusée', score: 2 },
    ],
  },
  {
    id: 'literacy',
    question: "Les personnes qui utilisent l'IA ont-elles été sensibilisées à ses limites et à ses risques ?",
    answers: [
      { label: 'Pas encore', score: 0 },
      { label: 'Pour une partie des utilisateurs', score: 1 },
      { label: 'Oui, selon leurs fonctions et leurs usages', score: 2 },
    ],
  },
  {
    id: 'data',
    question: "Les données personnelles et confidentielles sont-elles prises en compte avant l'emploi d'un outil d'IA ?",
    answers: [
      { label: 'Pas systématiquement', score: 0 },
      { label: 'Une vigilance existe, sans processus formel', score: 1 },
      { label: 'Oui, avec un processus et des responsables identifiés', score: 2 },
    ],
  },
  {
    id: 'responsibility',
    question: "Une personne ou une fonction pilote-t-elle les sujets liés à l'IA ?",
    answers: [
      { label: 'Non', score: 0 },
      { label: 'Le rôle est en cours de définition', score: 1 },
      { label: 'Oui, les responsabilités sont connues', score: 2 },
    ],
  },
];

const promptLevelOneExercises = [
  {
    id: 1,
    title: 'Passer d’une demande vague à une consigne exploitable',
    objective: 'Objectif, contexte et résultat attendu',
    instructions: 'Comparez la demande initiale avec sa version structurée, puis adaptez-la à votre propre activité.',
    prompt: `Je souhaite rédiger un e-mail professionnel.

Objectif : [indiquer le résultat recherché].
Contexte : [préciser la situation utile].
Destinataire : [fonction, niveau de connaissance et attentes].
Contraintes : [ton, longueur, informations obligatoires et éléments à éviter].
Format attendu : [objet, formule d’appel, paragraphes, appel à l’action et signature].

Avant de rédiger, pose-moi jusqu’à trois questions si une information essentielle manque.`,
  },
  {
    id: 2,
    title: 'Créer une synthèse fidèle et vérifiable',
    objective: 'Données sources, structure et contrôle',
    instructions: 'Utilisez uniquement un document fictif ou non confidentiel pendant l’exercice.',
    prompt: `À partir du texte placé entre <source> et </source>, produis une synthèse destinée à [public].

<source>
[coller ici un contenu non confidentiel]
</source>

Contraintes :
- ne rien inventer ;
- distinguer les faits, les décisions et les points à confirmer ;
- signaler explicitement toute information absente ;
- terminer par une liste de vérifications à effectuer dans le document source.`,
  },
  {
    id: 3,
    title: 'Adapter un contenu à deux publics',
    objective: 'Audience, niveau et exemples',
    instructions: 'Observez comment le public cible modifie le vocabulaire, la profondeur et les exemples.',
    prompt: `Explique [sujet] à deux publics :
1. une personne débutante qui découvre le sujet ;
2. un professionnel qui doit l’utiliser dans son activité.

Pour chaque public, fournis : une explication courte, un exemple concret, une erreur fréquente et une question de vérification.`,
  },
  {
    id: 4,
    title: 'Construire une ressource pédagogique',
    objective: 'Scénario, activité et évaluation',
    instructions: 'Adaptez le niveau et la durée au profil réel de vos apprenants.',
    prompt: `Conçois une activité pédagogique de [durée] sur [compétence] pour [public].

Le résultat doit contenir :
- un objectif observable ;
- les consignes données à l’apprenant ;
- un exemple ;
- une activité pratique ;
- quatre critères d’évaluation ;
- une variante d’accessibilité.

N’invente aucune obligation réglementaire et indique les éléments qui doivent être validés par le formateur.`,
  },
  {
    id: 5,
    title: 'Préparer une page HTML',
    objective: 'Spécification structurée avant production',
    instructions: 'L’objectif est de préparer un cahier des charges clair, pas de déléguer la validation finale à l’IA.',
    prompt: `Prépare le cahier des charges d’une page HTML consacrée à [sujet].

Public : [public].
Action principale attendue : [action].
Sections obligatoires : [liste].
Contraintes : responsive, navigation au clavier, contrastes lisibles, titres hiérarchisés et langage clair.

Commence par proposer l’arborescence de la page. Attends ma validation avant de produire le code HTML et CSS.`,
  },
  {
    id: 6,
    title: 'Créer un workflow de production contrôlé',
    objective: 'Décomposition, critères et validation humaine',
    instructions: 'Transformez une tâche complexe en étapes contrôlables et réutilisables.',
    prompt: `Aide-moi à construire un workflow pour produire [livrable].

Décompose le travail en étapes successives. Pour chaque étape, précise :
- les informations d’entrée ;
- le résultat attendu ;
- les critères de qualité ;
- les vérifications humaines ;
- les données à ne pas transmettre.

Propose ensuite un prompt réutilisable pour chaque étape, avec des variables entre crochets.`,
  },
];

const promptLevelOneGlossary = [
  { term: 'Prompt', definition: 'Instruction, question ou ensemble de consignes fourni à une IA pour guider son résultat.' },
  { term: 'Contexte', definition: 'Informations utiles qui permettent au modèle de comprendre la situation, le public et l’objectif.' },
  { term: 'Contrainte', definition: 'Règle à respecter concernant le contenu, la longueur, le ton, les sources ou le format.' },
  { term: 'Exemple', definition: 'Démonstration d’une entrée et du résultat attendu qui aide le modèle à reproduire une structure.' },
  { term: 'Critère de réussite', definition: 'Condition observable utilisée pour déterminer si le résultat répond réellement au besoin.' },
  { term: 'Itération', definition: 'Amélioration progressive d’un prompt ou d’un résultat après analyse des écarts constatés.' },
  { term: 'Hallucination', definition: 'Information fausse ou inventée produite par une IA, parfois avec une formulation convaincante.' },
  { term: 'Variable', definition: 'Élément à remplacer dans un modèle de prompt, par exemple [public], [objectif] ou [format].' },
  { term: 'Workflow', definition: 'Enchaînement organisé de plusieurs étapes, prompts et contrôles pour produire un livrable.' },
  { term: 'Validation humaine', definition: 'Contrôle réalisé par une personne compétente avant l’utilisation ou la diffusion du résultat.' },
];

const promptLevelOneQuiz = [
  {
    id: 'definition',
    question: 'Quel énoncé décrit le mieux un prompt professionnel ?',
    answers: [
      { label: 'Une question très courte suffit toujours', score: 0 },
      { label: 'Une consigne qui précise le besoin et le résultat attendu', score: 1 },
      { label: 'Une consigne contextualisée avec contraintes, format et critères de réussite', score: 2 },
    ],
  },
  {
    id: 'context',
    question: 'Pourquoi préciser le contexte dans une demande adressée à une IA ?',
    answers: [
      { label: 'Ce n’est généralement pas nécessaire', score: 0 },
      { label: 'Pour obtenir une réponse plus longue', score: 1 },
      { label: 'Pour adapter la réponse à la situation, au public et à l’objectif', score: 2 },
    ],
  },
  {
    id: 'format',
    question: 'Comment demander un résultat directement exploitable ?',
    answers: [
      { label: 'En laissant l’IA choisir entièrement la présentation', score: 0 },
      { label: 'En donnant seulement un nombre de mots', score: 1 },
      { label: 'En décrivant la structure, le ton, la longueur et les éléments attendus', score: 2 },
    ],
  },
  {
    id: 'confidentiality',
    question: 'Que faire avec une information personnelle ou confidentielle ?',
    answers: [
      { label: 'La copier dans n’importe quel outil si le prompt est bien écrit', score: 0 },
      { label: 'Retirer seulement le nom de la personne', score: 1 },
      { label: 'Vérifier le cadre autorisé, minimiser ou anonymiser les données et s’abstenir en cas de doute', score: 2 },
    ],
  },
  {
    id: 'clarification',
    question: 'Une demande contient des informations importantes manquantes. Quelle pratique est la plus adaptée ?',
    answers: [
      { label: 'Laisser l’IA inventer les éléments manquants', score: 0 },
      { label: 'Relancer après avoir lu une première réponse', score: 1 },
      { label: 'Demander à l’IA de poser des questions ciblées avant de produire le livrable', score: 2 },
    ],
  },
  {
    id: 'examples',
    question: 'Quand un exemple de résultat est-il utile dans un prompt ?',
    answers: [
      { label: 'Jamais, car il limite toujours la créativité', score: 0 },
      { label: 'Uniquement pour produire du code', score: 1 },
      { label: 'Lorsque la structure, le ton ou les catégories attendues doivent être reproduits avec précision', score: 2 },
    ],
  },
  {
    id: 'verification',
    question: 'Comment vérifier une réponse contenant des faits importants ?',
    answers: [
      { label: 'Se fier au ton assuré de la réponse', score: 0 },
      { label: 'Relire uniquement l’orthographe', score: 1 },
      { label: 'Comparer avec des sources fiables, le document d’origine et les critères définis', score: 2 },
    ],
  },
  {
    id: 'iteration',
    question: 'Un premier résultat ne respecte pas deux contraintes. Que faire ?',
    answers: [
      { label: 'Tout recommencer avec une demande différente sans analyser le résultat', score: 0 },
      { label: 'Demander simplement une meilleure réponse', score: 1 },
      { label: 'Identifier les écarts, préciser les contraintes concernées puis retester', score: 2 },
    ],
  },
  {
    id: 'variables',
    question: 'À quoi servent les variables comme [public] ou [objectif] dans un modèle de prompt ?',
    answers: [
      { label: 'À rendre le prompt plus technique sans autre intérêt', score: 0 },
      { label: 'À raccourcir systématiquement toutes les réponses', score: 1 },
      { label: 'À réutiliser une structure fiable dans plusieurs situations', score: 2 },
    ],
  },
  {
    id: 'workflow',
    question: 'Pourquoi décomposer une tâche complexe en plusieurs prompts ?',
    answers: [
      { label: 'Pour éviter toute vérification entre les étapes', score: 0 },
      { label: 'Pour obtenir davantage de texte', score: 1 },
      { label: 'Pour contrôler les entrées, les résultats intermédiaires et les validations', score: 2 },
    ],
  },
  {
    id: 'success-criteria',
    question: 'Quel est le rôle des critères de réussite ?',
    answers: [
      { label: 'Ils servent uniquement à noter la longueur de la réponse', score: 0 },
      { label: 'Ils permettent de choisir l’outil le plus populaire', score: 1 },
      { label: 'Ils permettent d’évaluer objectivement si le résultat répond au besoin', score: 2 },
    ],
  },
  {
    id: 'transfer',
    question: 'Comment rendre une méthode de prompting utilisable avec plusieurs assistants IA ?',
    answers: [
      { label: 'Mémoriser uniquement les commandes propres à un seul modèle', score: 0 },
      { label: 'Utiliser exactement le même prompt sans jamais comparer les résultats', score: 1 },
      { label: 'Conserver une structure fondée sur le besoin et adapter les détails après test selon l’outil', score: 2 },
    ],
  },
];

const promptLibraryNotionUrl = import.meta.env.VITE_PROMPT_LIBRARY_NOTION_URL?.trim() || null;

export const courseCatalog = {
  'formation-ia': {
    title: 'Formation IA Générative',
    landingPath: '/formation-ia-generative',
    moduleTitle: "Module 1 : Fondations de l'IA et prompt engineering",
    videoUrl: null,
    quiz: generativeAiQuiz,
    exercises: generativeAiExercises,
    glossary: generativeAiGlossary,
    resources: [
      {
        title: 'Guide du Prompt Engineering',
        description: 'Une méthode pour structurer des consignes destinées aux principaux assistants IA.',
        href: '/assets/creation-prompt-efficace-chatgpt.pdf',
        action: 'Télécharger le PDF',
        download: 'creation-prompt-efficace-chatgpt.pdf',
      },
      {
        title: 'Fiche synthétique – aide-mémoire IA',
        description: "Un résumé des bonnes pratiques, structures de prompts et points de vérification.",
        href: '/assets/Fiche_synthetique_aide_memoire_IA_FormaPrompt.pdf',
        action: "Télécharger l'aide-mémoire",
        download: 'Fiche_synthetique_aide_memoire_IA_FormaPrompt.pdf',
      },
    ],
  },
  'formation-ia-act': {
    title: 'IA : acculturation et préparation à la conformité AI Act',
    landingPath: '/formation-ia-act-conformite',
    moduleTitle: "Capsule 1 : rédiger un bon prompt dans un cadre professionnel",
    videoUrl: promptEngineeringIntroVideoUrl,
    quiz: aiActQuiz,
    exercises: aiActExercises,
    glossary: aiActGlossary,
    resources: [
      {
        title: "Règlement européen sur l'intelligence artificielle",
        description: 'Texte officiel du règlement (UE) 2024/1689 publié sur EUR-Lex.',
        href: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=fr',
        action: 'Consulter le texte officiel',
        external: true,
      },
      {
        title: "Questions-réponses sur la maîtrise de l'IA",
        description: "Précisions de la Commission européenne sur l'application de l'article 4.",
        href: 'https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers',
        action: 'Consulter la ressource officielle',
        external: true,
      },
    ],
  },
  'formation-prompt-level-1': {
    title: 'Formation Prompt Engineering – Niveau 1',
    landingPath: '/formation-prompt-engineering',
    moduleTitle: 'Parcours guidé : construire, tester et améliorer ses prompts',
    videoUrl: promptEngineeringIntroVideoUrl,
    quiz: promptLevelOneQuiz,
    positioningLevels: [
      { maximumRatio: 0.34, label: 'Niveau découverte' },
      { maximumRatio: 0.7, label: 'Niveau intermédiaire' },
      { maximumRatio: 1, label: 'Niveau autonome ou avancé' },
    ],
    exercises: promptLevelOneExercises,
    glossary: promptLevelOneGlossary,
    resources: [
      {
        title: 'Bibliothèque de prompts FormaPrompt – Niveau 1',
        description: 'Modèles vus pendant la formation, exemples, variables à personnaliser et points de vérification.',
        href: promptLibraryNotionUrl,
        action: promptLibraryNotionUrl ? 'Ouvrir dans Notion' : 'Lien Notion en préparation',
        external: Boolean(promptLibraryNotionUrl),
        pending: !promptLibraryNotionUrl,
      },
      {
        title: 'Guide du Prompt Engineering',
        description: 'Méthode synthétique pour structurer une demande professionnelle et contrôler le résultat.',
        href: '/assets/creation-prompt-efficace-chatgpt.pdf',
        action: 'Télécharger le PDF',
        download: 'creation-prompt-efficace-chatgpt.pdf',
      },
    ],
  },
};
