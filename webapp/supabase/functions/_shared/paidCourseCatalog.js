// La vidéo reste sur IONOS et n'entre jamais dans le catalogue public ni dans
// Supabase Storage. L'Edge Function injecte une URL HMAC courte vers la
// passerelle IONOS uniquement après contrôle de course_access.
const serverControlledPromptEngineeringVideoUrl = null;

const generativeAiVerificationGrid = {
  title: "Grille de vérification d'un contenu produit avec l'IA",
  description: 'Support à compléter pour contrôler les faits, les sources, les données, les droits et conserver la décision humaine.',
  href: '/assets/grille-verification-ia-formaprompt.pdf',
  action: 'Télécharger la grille de vérification',
  download: 'grille-verification-ia-formaprompt.pdf',
};

const generativeAiModules = [
  {
    id: 'comprendre',
    number: 1,
    duration: '2 h',
    title: "Comprendre l'IA générative et ses usages",
    summary: "Acquérir des repères simples pour choisir les situations dans lesquelles l'IA peut réellement aider.",
    goals: [
      "Expliquer la différence entre moteur de recherche, chatbot et assistant d'IA",
      'Identifier des usages pertinents dans son activité',
      'Reconnaître les principales limites avant de commencer une tâche',
    ],
    keyPoints: [
      'Fonctionnement général fondé sur la prédiction et génération de contenus',
      'Usages textuels, visuels, documentaires et conversationnels',
      "Importance du contexte, de la qualité des informations d'entrée et du contrôle humain",
    ],
    activity: "Cartographier trois tâches de son activité : une adaptée à l'IA, une nécessitant un contrôle renforcé et une à ne pas déléguer.",
    exerciseId: 1,
    lesson: {
      introduction: [
        "Une IA générative produit un contenu probable à partir de votre demande. Elle peut rédiger, résumer, organiser des idées ou créer une image, mais elle ne comprend pas une situation comme une personne et peut produire une réponse fausse avec beaucoup d'assurance.",
        "Le bon réflexe n'est donc pas de se demander seulement « Que peut faire l'IA ? », mais « Pour quelle partie de ma tâche peut-elle préparer une proposition, avec quelles données et quel contrôle humain ? ».",
      ],
      concepts: [
        {
          title: 'Moteur de recherche',
          description: 'Il aide à retrouver des pages ou des sources. Il faut encore vérifier leur auteur, leur date et leur fiabilité.',
        },
        {
          title: 'Chatbot',
          description: "C'est une interface de conversation. Selon l'outil, il peut répondre avec un modèle d'IA, rechercher sur le web ou utiliser des documents autorisés.",
        },
        {
          title: "Assistant d'IA",
          description: 'Il aide à préparer ou transformer un contenu. Son résultat reste une proposition à relire, vérifier et adapter avant utilisation.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Décrire la tâche',
          description: 'Précisez le résultat attendu et la personne qui utilisera ou recevra ce résultat.',
        },
        {
          title: '2. Repérer les données',
          description: "Identifiez les informations personnelles, confidentielles ou internes qui ne doivent pas être transmises à un outil non autorisé.",
        },
        {
          title: '3. Mesurer les conséquences',
          description: "Plus une erreur peut avoir d'impact sur une personne, une décision ou une obligation, plus le contrôle doit être renforcé.",
        },
        {
          title: "4. Définir le rôle de l'IA",
          description: "Décidez si l'IA peut préparer une première version, aider à comparer ou seulement suggérer des pistes, sans décider à votre place.",
        },
        {
          title: '5. Prévoir la validation humaine',
          description: 'Nommez la personne compétente et les sources à utiliser pour vérifier le résultat avant diffusion.',
        },
      ],
      demonstration: {
        title: 'Démonstration : classer trois tâches professionnelles',
        introduction: "Une assistante administrative souhaite gagner du temps. Avant d'ouvrir un outil d'IA, elle classe chaque tâche selon son niveau de vigilance.",
        columns: ['Tâche', "Place possible de l'IA", 'Décision et contrôle humain'],
        rows: [
          [
            "Préparer un modèle générique d'invitation à une réunion",
            'Usage adapté : proposer une première rédaction sans nom, adresse ou information confidentielle.',
            "Relire les dates, le ton et les informations pratiques avant l'envoi.",
          ],
          [
            'Résumer une note interne contenant des noms et des données de salariés',
            "Usage à encadrer : utiliser uniquement un outil autorisé et un document anonymisé si les règles internes le permettent.",
            'Vérifier que les idées importantes sont conservées et qu’aucune donnée interdite n’a été transmise.',
          ],
          [
            "Décider quel salarié doit recevoir une sanction ou une promotion",
            "Usage à ne pas déléguer : l'IA ne doit pas prendre cette décision sensible.",
            'La décision appartient aux personnes responsables, selon les règles applicables et des informations vérifiées.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : demander une première version sans transmettre de données sensibles',
        unsafeRequest: '« Voici le dossier complet de Mme Dupont. Dis-moi si je dois accepter sa demande. »',
        saferRequest: '« À partir de critères génériques et non confidentiels, aide-moi à préparer une liste de points à vérifier avant de traiter ce type de demande. Ne prends aucune décision et signale les éléments qui nécessitent une validation humaine. »',
        analysis: [
          'La seconde demande ne transmet ni identité ni dossier personnel.',
          "Elle limite l'IA à un rôle de préparation et non de décision.",
          'Elle exige une validation humaine avant toute utilisation.',
        ],
      },
      commonMistakes: [
        'Confondre une réponse bien rédigée avec une information exacte.',
        "Copier un document professionnel sans vérifier si l'outil est autorisé.",
        "Demander à l'IA de décider à la place d'une personne compétente.",
        'Réutiliser la première réponse sans la relire ni la comparer aux sources disponibles.',
      ],
      takeaways: [
        "L'IA prépare une proposition ; elle ne garantit pas la vérité.",
        'Une tâche simple et réversible est généralement plus facile à expérimenter.',
        'Les données transmises doivent être minimisées et autorisées.',
        'La responsabilité de vérifier, décider et diffuser reste humaine.',
      ],
    },
  },
  {
    id: 'dialoguer',
    number: 2,
    duration: '2 h',
    title: 'Dialoguer avec une IA et structurer ses demandes',
    summary: 'Passer d’une demande vague à une consigne claire, testable et améliorable.',
    goals: [
      'Définir un objectif et un résultat attendu',
      'Fournir le contexte utile sans transmettre de donnée inappropriée',
      'Itérer à partir des écarts observés dans une première réponse',
    ],
    keyPoints: [
      'Objectif, contexte, public, contraintes et format attendu',
      'Questions de clarification et exemples de résultat',
      'Critères de réussite et amélioration progressive',
    ],
    activity: 'Améliorer une demande imprécise, tester deux versions puis comparer les différences obtenues.',
    exerciseId: 2,
    lesson: {
      introduction: [
        "Une demande adressée à une IA est souvent appelée un prompt. Il ne s'agit pas d'une formule magique : c'est une consigne de travail. Plus votre objectif et vos critères sont compréhensibles, plus la première proposition a des chances d'être utile.",
        "Vous n'avez pas besoin de tout prévoir dès le premier essai. Le dialogue sert à préciser la demande, observer les écarts, puis améliorer la consigne sans transmettre d'information personnelle ou confidentielle inutile.",
      ],
      concepts: [
        {
          title: 'Objectif',
          description: 'Il décrit le résultat concret recherché : préparer un courriel, résumer une source, construire un plan ou proposer des idées.',
        },
        {
          title: 'Contexte utile',
          description: 'Il donne seulement les informations nécessaires pour comprendre la situation, le public et le niveau attendu, sans ajouter de données sensibles.',
        },
        {
          title: 'Critères de réussite',
          description: 'Ils permettent de juger le résultat : exactitude, ton, longueur, structure, éléments obligatoires et points à éviter.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Nommer le livrable',
          description: 'Commencez par un verbe d’action et un résultat observable : rédiger un courriel, créer un tableau comparatif ou préparer un plan en cinq parties.',
        },
        {
          title: '2. Préciser le public et le contexte',
          description: 'Indiquez à qui le contenu est destiné et ce que cette personne doit comprendre ou faire, en limitant les informations au strict nécessaire.',
        },
        {
          title: '3. Donner les informations autorisées',
          description: 'Fournissez les faits ou la source à utiliser et signalez clairement ce que l’IA ne doit ni inventer ni modifier.',
        },
        {
          title: '4. Définir le format et les critères',
          description: 'Précisez la longueur, le ton, la structure et trois critères simples qui permettront de contrôler le résultat.',
        },
        {
          title: '5. Tester puis améliorer',
          description: 'Comparez la réponse avec vos critères, nommez un écart précis et demandez une correction ciblée plutôt que de tout recommencer.',
        },
      ],
      demonstration: {
        title: 'Démonstration : transformer une demande vague en consigne exploitable',
        introduction: "Une responsable de formation veut préparer un courriel de rappel avant une classe virtuelle. Elle enrichit sa demande étape par étape, sans transmettre la liste nominative des participants.",
        columns: ['Étape', 'Information ajoutée', 'Effet attendu'],
        rows: [
          [
            'Objectif',
            'Rédiger un courriel de rappel avant une classe virtuelle.',
            "L'IA sait quel livrable préparer et à quel moment il sera utilisé.",
          ],
          [
            'Public et action attendue',
            'Adultes inscrits ; ils doivent tester leur connexion et rejoindre la séance dix minutes avant.',
            'Le message peut être adapté au destinataire et conduire à une action précise.',
          ],
          [
            'Informations autorisées',
            'Date, horaire, durée, lien générique et consignes techniques validées.',
            "Le contenu repose sur des faits fournis sans exposer les données personnelles des participants.",
          ],
          [
            'Contraintes et format',
            'Ton professionnel et rassurant, 180 mots maximum, objet puis liste à puces.',
            'La forme obtenue correspond au canal et reste facile à lire.',
          ],
          [
            'Contrôle',
            'Ne rien inventer ; signaler toute information manquante avant de rédiger.',
            'Les incertitudes deviennent visibles et peuvent être corrigées avant l’envoi.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : cadrer une demande avant de produire le résultat',
        unsafeRequest: '« Fais-moi un bon mail pour rappeler la formation aux participants. »',
        saferRequest: '« Rédige un courriel de rappel destiné à des adultes inscrits à une classe virtuelle. Ils doivent tester leur connexion et rejoindre la séance dix minutes avant. Utilise uniquement les informations pratiques que je fournirai. Adopte un ton professionnel et rassurant, limite le texte à 180 mots et présente les actions dans une liste à puces. N’invente aucune date ni aucun lien ; pose-moi une question si une information essentielle manque. »',
        analysis: [
          'Le livrable, le public et les actions attendues sont clairement définis.',
          'La demande fixe un format et des critères qui facilitent la relecture.',
          "L'IA reçoit l'instruction de ne rien inventer et de demander les informations manquantes.",
          'Aucun nom, courriel ou autre renseignement personnel de participant n’est nécessaire.',
        ],
      },
      commonMistakes: [
        'Utiliser des mots vagues comme « bon », « professionnel » ou « complet » sans expliquer ce qu’ils signifient dans la situation.',
        'Copier trop de contexte, notamment des données personnelles ou confidentielles qui ne sont pas utiles au résultat.',
        'Demander plusieurs livrables différents dans une seule consigne puis ne plus savoir lequel évaluer.',
        'Dire seulement « recommence » au lieu de nommer précisément ce qui manque ou doit être corrigé.',
      ],
      takeaways: [
        'Une bonne demande décrit un résultat observable, un public et un contexte utile.',
        'Le format et les critères de réussite servent autant à guider l’IA qu’à contrôler sa réponse.',
        'Une première réponse est un brouillon à comparer aux critères, pas un résultat automatiquement validé.',
        'Le dialogue permet d’améliorer progressivement le résultat tout en conservant la décision humaine.',
      ],
    },
  },
  {
    id: 'produire',
    number: 3,
    duration: '2 h',
    title: 'Produire des contenus professionnels',
    summary: "Utiliser l'IA comme assistant de préparation tout en conservant la maîtrise du contenu final.",
    goals: [
      'Rédiger et reformuler pour un destinataire défini',
      'Synthétiser une source sans ajouter d’information absente',
      'Comparer plusieurs propositions avant de finaliser un livrable',
    ],
    keyPoints: [
      'Courriels, plans, comptes rendus, supports et tableaux de synthèse',
      'Adaptation du niveau de langage, du ton et de la structure',
      'Traçabilité de la source et distinction entre faits, hypothèses et suggestions',
    ],
    activity: 'Produire deux versions d’un même contenu, les évaluer avec une grille puis construire une version finale.',
    exerciseId: 3,
    lesson: {
      introduction: [
        "L'IA peut accélérer la préparation d'un courriel, d'un plan, d'une synthèse ou d'un support. Le texte obtenu n'est toutefois qu'une version de travail : sa qualité dépend des informations fournies et de la relecture effectuée avant diffusion.",
        "Pour garder la maîtrise du contenu, séparez toujours les faits issus d'une source autorisée, les propositions de formulation produites par l'IA et les choix que vous validez dans le livrable final.",
      ],
      concepts: [
        {
          title: 'Source de référence',
          description: 'C’est le document ou la liste de faits autorisés qui sert de base. Une information absente de cette source ne doit pas devenir un fait dans le résultat.',
        },
        {
          title: 'Version de travail',
          description: "C'est une proposition à comparer et à corriger. Elle peut aider à explorer plusieurs tons ou structures sans remplacer la validation humaine.",
        },
        {
          title: 'Livrable final',
          description: 'C’est la version relue, vérifiée et adaptée au destinataire, dont une personne assume la diffusion et les conséquences.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Préparer les informations de référence',
          description: 'Rassemblez les faits autorisés, retirez les données inutiles et indiquez les éléments qui restent à confirmer.',
        },
        {
          title: '2. Définir le destinataire et l’usage',
          description: 'Précisez qui lira le contenu, ce que cette personne doit comprendre et l’action éventuellement attendue.',
        },
        {
          title: '3. Produire deux versions différentes',
          description: 'Demandez par exemple une version directe et synthétique, puis une version plus pédagogique avec un exemple.',
        },
        {
          title: '4. Comparer avec une grille',
          description: 'Évaluez chaque proposition selon les mêmes critères : fidélité aux faits, clarté, adaptation au public et risque d’interprétation.',
        },
        {
          title: '5. Construire et vérifier la version finale',
          description: 'Conservez les meilleurs éléments, contrôlez chaque fait dans la source et effectuez une dernière relecture humaine avant diffusion.',
        },
      ],
      demonstration: {
        title: 'Démonstration : comparer deux messages avant de finaliser',
        introduction: "Les informations validées sont les suivantes : l'atelier est reporté au mardi à 9 h, il se déroule en salle 3 et chaque participant doit apporter son ordinateur. Deux versions sont produites pour un public peu à l'aise avec le numérique.",
        columns: ['Critère', 'Version A : directe', 'Version B : pédagogique', 'Décision pour la version finale'],
        rows: [
          [
            'Fidélité aux faits',
            'Reprend la date, l’heure, la salle et le matériel attendu.',
            'Reprend les mêmes faits sans ajouter d’information.',
            'Les deux versions sont conformes à la source.',
          ],
          [
            'Clarté',
            'Annonce le changement en une phrase puis liste les informations pratiques.',
            'Explique le changement avec davantage de transitions.',
            'Conserver l’annonce courte de la version A.',
          ],
          [
            'Adaptation au public',
            'Le rappel « apporter votre ordinateur » est présent mais peu développé.',
            'Présente les trois actions dans l’ordre et avec des formulations simples.',
            'Conserver la liste guidée de la version B.',
          ],
          [
            'Risque d’interprétation',
            'Le motif du report n’est pas inventé.',
            'Le motif du report n’est pas inventé non plus.',
            'Ne pas ajouter d’explication tant qu’elle n’est pas fournie et validée.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : produire un compte rendu fidèle à une source',
        unsafeRequest: '« Rédige un compte rendu complet de cette réunion et ajoute ce qui manque pour qu’il soit crédible. »',
        saferRequest: '« À partir uniquement des notes fournies, prépare un projet de compte rendu avec les rubriques : décisions, actions, responsables et échéances. N’ajoute aucun fait absent. Place la mention [à confirmer] lorsqu’une information manque et sépare les décisions prises des simples propositions. »',
        analysis: [
          'La source autorisée et la structure du livrable sont clairement définies.',
          "L'IA ne reçoit pas l'autorisation de combler les manques par des inventions.",
          'Les informations incertaines restent visibles grâce à la mention [à confirmer].',
          'La distinction entre décision et proposition réduit le risque de déformer la réunion.',
        ],
      },
      commonMistakes: [
        'Demander à l’IA de compléter les informations manquantes pour rendre le contenu plus crédible.',
        'Confondre une reformulation fluide avec une vérification des faits.',
        'Comparer uniquement le style de deux versions sans contrôler leur fidélité à la source.',
        'Copier la proposition finale dans un document professionnel sans relecture humaine.',
      ],
      takeaways: [
        'La source de référence fixe les faits que le contenu peut reprendre.',
        'Produire deux versions aide à faire des choix, à condition de les comparer avec les mêmes critères.',
        'Les éléments manquants ou incertains doivent rester signalés, jamais inventés.',
        'Le livrable devient final uniquement après vérification, adaptation et validation humaines.',
      ],
    },
  },
  {
    id: 'verifier',
    number: 4,
    duration: '2 h',
    title: "Vérifier, sécuriser et utiliser l'IA de façon responsable",
    summary: 'Mettre en place des contrôles adaptés aux risques du contenu et au contexte professionnel.',
    goals: [
      'Repérer une affirmation incertaine ou non sourcée',
      'Protéger les données personnelles, sensibles et confidentielles',
      'Définir les validations humaines nécessaires avant diffusion',
    ],
    keyPoints: [
      'Hallucinations, biais, actualité des informations et fausses références',
      'Minimisation, anonymisation et règles internes de confidentialité',
      'Droits d’utilisation, propriété intellectuelle et responsabilité du diffuseur',
    ],
    activity: "Auditer une réponse fictive avec la grille de vérification, signaler les éléments à contrôler et décider si elle peut être utilisée, corrigée ou rejetée.",
    exerciseId: 4,
    resource: generativeAiVerificationGrid,
    lesson: {
      introduction: [
        "Une réponse d'IA peut être claire, détaillée et pourtant contenir une erreur, une source inexistante ou une recommandation inadaptée. La qualité de la rédaction ne prouve donc ni l'exactitude ni le droit d'utiliser le contenu.",
        "Avant toute diffusion professionnelle, adoptez une procédure courte et visible : identifier ce qui est affirmé, contrôler les sources, examiner les données et les droits, puis décider humainement d'utiliser, de corriger ou de rejeter le résultat.",
      ],
      concepts: [
        {
          title: 'Affirmation vérifiable',
          description: 'C’est une date, un chiffre, un nom, une règle ou un fait que vous devez pouvoir retrouver dans une source identifiable et adaptée au sujet.',
        },
        {
          title: 'Source fiable',
          description: 'Elle possède un auteur ou un organisme identifiable, une date pertinente et un contenu que vous pouvez réellement consulter et comparer.',
        },
        {
          title: 'Validation humaine',
          description: 'Une personne compétente vérifie les points sensibles, assume la décision et autorise la diffusion selon les règles de l’organisation.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Suspendre la diffusion',
          description: 'Considérez toute première réponse comme un brouillon, surtout lorsqu’elle contient des chiffres, des conseils ou des conséquences pour une personne.',
        },
        {
          title: '2. Repérer les éléments à contrôler',
          description: 'Surlignez les faits, dates, chiffres, citations, liens, règles, recommandations et formulations très affirmatives.',
        },
        {
          title: '3. Vérifier dans les bonnes sources',
          description: 'Ouvrez réellement les sources officielles ou professionnelles adaptées, vérifiez leur date et comparez précisément ce qu’elles disent.',
        },
        {
          title: '4. Examiner les données, les droits et les biais',
          description: 'Contrôlez la présence de données personnelles ou confidentielles, les droits d’utilisation du contenu et les effets possibles sur certaines personnes.',
        },
        {
          title: '5. Décider et garder une trace',
          description: 'Classez le résultat : utilisable après contrôle, à corriger ou à rejeter. Notez les sources consultées et la personne ayant validé les points sensibles.',
        },
      ],
      demonstration: {
        title: 'Démonstration : auditer une recommandation apparemment convaincante',
        introduction: "Une réponse fictive propose d'améliorer une formation interne. Chaque extrait est examiné séparément avant qu'une décision soit prise.",
        columns: ['Extrait de la réponse fictive', 'Risque repéré', 'Contrôle à effectuer', 'Décision provisoire'],
        rows: [
          [
            '« Une étude 2025 de l’Institut du numérique prouve une hausse de 82 % des résultats. »',
            'Chiffre très précis et organisme peut-être inexistant.',
            'Rechercher l’étude, son auteur, sa méthode, sa date et le texte exact.',
            'Rejeter l’affirmation si la source n’est pas retrouvée et vérifiée.',
          ],
          [
            '« Importez la liste des salariés et leurs scores dans un assistant public. »',
            'Transmission de données personnelles et professionnelles à un outil potentiellement non autorisé.',
            'Consulter les règles internes, minimiser les données et utiliser uniquement un service validé.',
            'Ne pas appliquer cette recommandation en l’état.',
          ],
          [
            '« Inscrivez automatiquement les personnes ayant les scores les plus faibles. »',
            'Décision concernant des salariés prise automatiquement à partir d’un indicateur isolé.',
            'Faire examiner le besoin, la qualité des données et les règles applicables par les responsables compétents.',
            'Rejeter l’automatisation de la décision ; conserver une décision humaine justifiée.',
          ],
          [
            '« Reprenez les illustrations trouvées sur internet pour gagner du temps. »',
            'Droits d’utilisation et attribution non vérifiés.',
            'Identifier la source, la licence et les conditions d’utilisation de chaque visuel.',
            'Utiliser seulement des visuels autorisés et conserver la preuve de leur licence.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : demander un audit sans déléguer la vérification',
        unsafeRequest: '« Dis-moi si cette réponse est vraie et réécris-la pour que je puisse la publier immédiatement. »',
        saferRequest: '« Analyse cette réponse fictive sans la considérer comme exacte. Distingue les faits à vérifier, les formulations ambiguës, les risques liés aux données ou aux droits et les éléments qui pourraient être conservés après contrôle. N’invente aucune source et prépare une liste de vérifications humaines avant toute publication. »',
        analysis: [
          "La seconde demande ne présente pas l'IA comme arbitre de la vérité.",
          'Elle sépare les différentes familles de risques au lieu de donner un verdict global.',
          'Elle interdit les sources inventées et demande des contrôles réalisables par une personne.',
          'La décision de publier reste explicitement suspendue à une validation humaine.',
        ],
      },
      commonMistakes: [
        'Faire confiance à une référence uniquement parce que son titre, son auteur ou son lien paraît crédible.',
        'Demander au même outil de confirmer sa propre réponse sans consulter de source extérieure adaptée.',
        'Croire qu’un prénom supprimé suffit toujours à anonymiser un document contenant d’autres détails identifiants.',
        'Vérifier les faits, mais oublier les droits d’utilisation, la confidentialité ou les effets possibles sur les personnes.',
      ],
      takeaways: [
        'Une formulation convaincante ne remplace jamais une preuve consultable.',
        'Les faits importants doivent être comparés à des sources réellement ouvertes, datées et adaptées.',
        'La sécurité concerne les données transmises, mais aussi les droits et les conséquences du résultat.',
        'La décision finale consiste à utiliser après contrôle, corriger ou rejeter, avec une validation humaine proportionnée au risque.',
      ],
    },
  },
  {
    id: 'mettre-en-pratique',
    number: 5,
    duration: '2 h',
    title: "Mettre en pratique et préparer son plan d'utilisation",
    summary: 'Mobiliser la méthode complète sur un cas professionnel et préparer la suite après la formation.',
    goals: [
      'Décomposer un besoin professionnel en étapes contrôlables',
      'Justifier le choix des informations, consignes et contrôles',
      "Formaliser un plan d'action réaliste et responsable",
    ],
    keyPoints: [
      'Choix du cas, résultat attendu et critères de réussite',
      'Essais, comparaison, correction et restitution',
      'Actions à court terme, points à faire valider et règles à partager',
    ],
    activity: 'Réaliser le cas pratique final puis présenter le résultat, les contrôles effectués et les limites rencontrées.',
    exerciseId: 5,
    lesson: {
      introduction: [
        "Le cas pratique final ne cherche pas à montrer que l'IA sait tout faire. Il sert à démontrer que vous pouvez choisir un usage utile, le cadrer, produire un résultat, le vérifier et expliquer clairement ce qui reste sous responsabilité humaine.",
        "Pour une première expérimentation, choisissez une tâche limitée, réversible et sans donnée sensible. Un petit cas bien maîtrisé apporte davantage de preuves qu'un projet trop ambitieux impossible à contrôler pendant la formation.",
      ],
      concepts: [
        {
          title: 'Cas maîtrisable',
          description: 'C’est une situation assez précise pour être testée pendant la formation, avec un résultat observable et des conséquences limitées en cas d’erreur.',
        },
        {
          title: 'Preuve du travail',
          description: 'Elle montre le chemin suivi : consignes testées, résultats comparés, sources contrôlées, corrections et décisions humaines.',
        },
        {
          title: 'Plan d’action',
          description: 'Il transforme l’essai en prochaine étape réaliste avec un responsable, une échéance, des règles et un critère permettant de mesurer le résultat.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Choisir un cas limité et utile',
          description: 'Sélectionnez une tâche fréquente, peu risquée et réversible, pour laquelle un gain ou une amélioration peut être observé.',
        },
        {
          title: '2. Définir le résultat et les limites',
          description: 'Précisez le public, le livrable, trois critères de réussite, les informations autorisées et ce qui ne doit pas être délégué à l’IA.',
        },
        {
          title: '3. Tester et conserver les étapes',
          description: 'Gardez la première consigne, au moins deux résultats, les écarts constatés et les modifications qui ont amélioré le travail.',
        },
        {
          title: '4. Vérifier puis présenter les choix',
          description: 'Contrôlez les faits, les données et les droits, puis expliquez ce qui a été conservé, corrigé ou rejeté et pourquoi.',
        },
        {
          title: '5. Préparer une action sous 30 jours',
          description: 'Définissez une expérimentation courte, la personne responsable, les validations nécessaires et un indicateur simple pour décider de la suite.',
        },
      ],
      demonstration: {
        title: 'Démonstration : construire un petit cas professionnel de bout en bout',
        introduction: "Une formatrice souhaite préparer une foire aux questions générique pour aider les participants à rejoindre une classe virtuelle. Elle utilise uniquement des consignes techniques validées et aucune donnée d'apprenant.",
        columns: ['Étape du cas', 'Choix effectué', 'Preuve à conserver', 'Point de contrôle humain'],
        rows: [
          [
            'Besoin et résultat',
            'Créer une FAQ de six questions destinée à des adultes peu à l’aise avec le numérique.',
            'Description du public et critères de réussite.',
            'Vérifier que le cas est utile, limité et adapté aux besoins réels.',
          ],
          [
            'Informations de référence',
            'Utiliser uniquement la procédure de connexion validée et les coordonnées génériques du support.',
            'Copie ou référence des informations autorisées utilisées.',
            'Retirer les noms, courriels et données de connexion personnelles.',
          ],
          [
            'Essais',
            'Comparer une version très courte et une version guidée étape par étape.',
            'Consigne initiale, deux résultats et tableau de comparaison.',
            'Choisir les formulations les plus claires sans ajouter de fait absent.',
          ],
          [
            'Livrable final',
            'Assembler une FAQ simple avec les avertissements et contacts validés.',
            'Version finale et grille de vérification complétée.',
            'Faire relire les consignes techniques avant diffusion.',
          ],
          [
            'Suite sous 30 jours',
            'Tester la FAQ avec un petit groupe et relever les questions encore posées.',
            'Date du test, retours recueillis et décision de poursuivre ou corriger.',
            'Ne généraliser le support qu’après analyse des retours et validation.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : passer d’une ambition vague à une expérimentation réaliste',
        unsafeRequest: '« Fais-moi un plan pour déployer l’IA dans toute mon entreprise dès le mois prochain. »',
        saferRequest: '« Aide-moi à préparer une expérimentation de 30 jours pour créer des modèles génériques de courriels internes, sans donnée personnelle ni décision sensible. Le plan doit préciser le résultat attendu, les étapes confiées à l’IA, les contrôles humains, la personne responsable, les validations nécessaires et deux indicateurs simples. Signale les points qui restent à faire approuver. »',
        analysis: [
          'La seconde demande limite le périmètre à un usage testable et réversible.',
          'Les données et décisions sensibles sont exclues dès le départ.',
          'Les responsabilités, validations et indicateurs permettent de suivre réellement l’essai.',
          'Le déploiement général n’est envisagé qu’après l’expérimentation et l’analyse de ses résultats.',
        ],
      },
      commonMistakes: [
        'Choisir un projet trop large pour pouvoir le tester, le vérifier et l’expliquer pendant la formation.',
        'Commencer par une situation sensible alors qu’un cas plus simple permettrait d’apprendre sans exposer de personne.',
        'Présenter uniquement le résultat final sans conserver les consignes, comparaisons et corrections qui prouvent la démarche.',
        'Écrire un plan d’action sans responsable, échéance, validation ni critère permettant de décider de la suite.',
      ],
      takeaways: [
        'Un cas final réussi est limité, utile, observable et proportionné au niveau de risque.',
        'La démarche et les contrôles comptent autant que le livrable produit.',
        'Les quatre livrables attendus sont la consigne finale, le résultat, la grille de vérification et le plan d’action.',
        'L’exercice 5 prépare le plan d’action demandé dans le cas pratique final présenté après les modules.',
      ],
    },
  },
];

const generativeAiExercises = [
  {
    id: 1,
    title: 'Cartographier les usages utiles',
    objective: 'Module 1 · Choix des usages',
    instructions: "Décrivez uniquement des tâches génériques, sans nom de personne ni information confidentielle. Le résultat sert de support de réflexion et doit être validé selon votre contexte.",
    howTo: [
      'Notez cinq tâches courantes de votre activité avec des termes génériques, sans nom de personne ni information confidentielle.',
      'Remplacez [métier ou secteur] dans le modèle, puis copiez la demande dans un assistant autorisé.',
      'Lisez chaque ligne du tableau et corrigez les tâches mal comprises ou les informations ajoutées à tort.',
      'Choisissez ensuite trois tâches : une adaptée à l’IA, une nécessitant un contrôle renforcé et une à ne pas déléguer.',
    ],
    successCriteria: [
      'Les cinq tâches sont décrites de manière assez précise pour comprendre le résultat attendu.',
      'Le rôle possible de l’IA et ce qui reste sous contrôle humain sont distingués pour chaque tâche.',
      'Les données à ne pas transmettre et le niveau de vigilance sont indiqués et justifiés.',
      'Une première tâche simple, réversible et sans donnée sensible est identifiée pour un futur essai.',
    ],
    prompt: `Aide-moi à analyser cinq tâches courantes dans mon activité de [métier ou secteur].

Pour chaque tâche, indique dans un tableau :
- l'objectif de la tâche ;
- ce que l'IA pourrait préparer ;
- ce qui doit rester sous contrôle humain ;
- les données à ne pas transmettre ;
- le niveau de vigilance : courant, renforcé ou usage à éviter.

Ne prends aucune décision à ma place et pose-moi jusqu'à trois questions si le contexte est insuffisant.`,
  },
  {
    id: 2,
    title: 'Passer d’une demande vague à une consigne structurée',
    objective: 'Module 2 · Formulation',
    instructions: "Personnalisez les éléments entre crochets puis comparez le résultat avec celui d'une demande formulée en une seule phrase.",
    howTo: [
      'Choisissez un livrable simple et non confidentiel, par exemple un courriel générique, un plan ou une liste de questions.',
      'Écrivez d’abord une demande courte et vague, puis conservez la première réponse obtenue comme point de comparaison.',
      'Complétez chaque rubrique du modèle : objectif, contexte, public, informations, contraintes, format et critères.',
      'Testez la version structurée, comparez les deux réponses et notez au moins deux améliorations et un point restant à corriger.',
    ],
    successCriteria: [
      'Le livrable, le public et le contexte utile sont clairement identifiables.',
      'La demande ne contient aucune donnée personnelle ou confidentielle inutile.',
      'Le format attendu et au moins trois critères de réussite observables sont précisés.',
      'Les différences entre la demande vague et la demande structurée sont expliquées avec des exemples.',
    ],
    prompt: `Objectif : préparer [livrable attendu].
Contexte utile : [situation, sans donnée personnelle ou confidentielle].
Public destinataire : [fonction et niveau de connaissance].
Informations à utiliser : [faits ou source autorisée].
Contraintes : [ton, longueur, éléments obligatoires et éléments à éviter].
Format attendu : [structure précise].
Critères de réussite : [trois critères observables].

Avant de produire le résultat, pose-moi jusqu'à trois questions si une information essentielle manque.`,
  },
  {
    id: 3,
    title: 'Comparer et améliorer deux propositions',
    objective: 'Module 3 · Production',
    instructions: "Utilisez un sujet fictif ou non confidentiel. Vérifiez vous-même les faits avant de réutiliser le contenu produit.",
    howTo: [
      'Choisissez un sujet fictif ou une courte source autorisée et définissez le type de contenu, le public et la longueur attendue.',
      'Personnalisez le modèle puis demandez les deux versions sans modifier les informations de référence entre les essais.',
      'Comparez les versions avec les quatre critères demandés : clarté, précision, adaptation au public et risque d’interprétation.',
      'Construisez une version finale avec les meilleurs éléments, puis vérifiez chaque fait dans la source avant de la conserver.',
    ],
    successCriteria: [
      'Les deux propositions utilisent les mêmes faits et répondent au même besoin.',
      'Les différences de ton, structure ou niveau d’explication sont réellement visibles.',
      'La comparaison s’appuie sur les quatre critères et ne repose pas seulement sur une préférence personnelle.',
      'La version finale est fidèle à la source et les informations restant à confirmer sont signalées.',
    ],
    prompt: `Prépare deux versions de [type de contenu] sur [sujet] pour [public].

Version A : directe et synthétique.
Version B : pédagogique, avec un exemple concret.

Pour chaque version :
- limite le texte à [longueur] ;
- n'invente aucun fait ni aucune source ;
- signale les informations à confirmer.

Termine par un tableau comparant clarté, précision, adaptation au public et risques d'interprétation.`,
  },
  {
    id: 4,
    title: 'Auditer une réponse avant utilisation',
    objective: 'Module 4 · Vérification',
    instructions: "Collez uniquement une réponse fictive ou un contenu autorisé. L'IA peut aider à repérer des points de vigilance, mais la vérification finale reste humaine.",
    resource: generativeAiVerificationGrid,
    howTo: [
      'Téléchargez la grille de vérification et choisissez une réponse fictive ou un contenu que vous êtes autorisé à utiliser.',
      'Copiez la réponse entre les balises du modèle, puis demandez son classement dans les quatre catégories.',
      'Reportez les points importants dans la grille et ouvrez réellement les sources nécessaires pour contrôler les faits.',
      'Complétez les corrections, choisissez « utilisable après contrôle », « à corriger » ou « à rejeter », puis justifiez la décision.',
    ],
    successCriteria: [
      'Les faits, chiffres, dates, références et formulations trop affirmatives ont été repérés.',
      'Aucune source inventée n’est utilisée comme preuve et les sources importantes ont été réellement consultées.',
      'Les risques concernant les données, les droits, les biais et la confidentialité sont examinés.',
      'La décision finale et les vérifications humaines encore nécessaires sont clairement justifiées dans la grille.',
    ],
    prompt: `Analyse la réponse placée entre <reponse> et </reponse>.

<reponse>
[coller ici une réponse fictive ou non confidentielle]
</reponse>

Classe les éléments dans quatre catégories :
1. faits à vérifier dans une source fiable ;
2. formulations ambiguës ou trop affirmatives ;
3. risques concernant les données, les droits ou la confidentialité ;
4. éléments utilisables après contrôle.

N'invente aucune source. Propose ensuite une liste de vérifications humaines avant diffusion.`,
  },
  {
    id: 5,
    title: "Préparer un plan d'utilisation responsable",
    objective: 'Module 5 · Plan d’action',
    instructions: "Construisez un plan limité à un usage réaliste. Les règles internes et décisions sensibles doivent être validées par les personnes compétentes de votre structure.",
    howTo: [
      'Choisissez une seule tâche utile, limitée, réversible et sans décision sensible, qui pourrait être testée dans les 30 jours.',
      'Remplacez [tâche] dans le modèle et ajoutez les contraintes déjà connues dans votre organisation.',
      'Relisez le plan produit et corrigez les rôles, informations autorisées, contrôles et personnes à consulter.',
      'Transformez la proposition en fiche action d’une page avec un responsable, une échéance et deux indicateurs simples.',
    ],
    successCriteria: [
      'Le périmètre est assez limité pour être réellement testé et arrêté sans conséquence importante.',
      'Le bénéfice attendu, le rôle de l’IA et les contrôles humains sont distincts et compréhensibles.',
      'Les informations interdites, les validations et les personnes responsables sont nommées.',
      'Une action datée sous 30 jours et au moins deux indicateurs permettent de décider de poursuivre, corriger ou arrêter.',
    ],
    prompt: `Aide-moi à préparer un plan d'utilisation responsable de l'IA pour la tâche suivante : [tâche].

Le plan doit préciser :
- le bénéfice attendu ;
- les étapes confiées à l'IA ;
- les informations autorisées et interdites ;
- les vérifications humaines ;
- les critères permettant d'évaluer le résultat ;
- les personnes ou fonctions à consulter ;
- une première expérimentation réalisable dans les 30 jours.

Présente le résultat comme une fiche action d'une page et indique clairement les points restant à valider.`,
  },
];

  const generativeAiFinalProject = {
    title: "Construire et présenter un usage professionnel maîtrisé de l'IA",
    description: "Le participant applique la méthode à une situation réelle ou réaliste de son activité, sans utiliser de donnée personnelle ou confidentielle.",
    learnerGuidance: "Vous ne devez pas produire un résultat parfait du premier coup. Montrez surtout votre méthode : ce que vous avez demandé, ce que vous avez corrigé, ce que vous avez vérifié et ce qui reste sous responsabilité humaine.",
  steps: [
    'Définir le besoin, le public, le résultat attendu et les limites du cas choisi',
    'Préparer une première consigne et des critères de réussite',
    'Tester, comparer et améliorer au moins deux résultats',
    'Vérifier les faits, les données, les droits et les validations nécessaires',
    "Présenter le livrable final et un plan d'action à court terme",
  ],
    deliverables: [
      'La consigne finale et ses principales étapes d’amélioration',
      'Le livrable produit ou sa maquette',
      'La grille de vérification complétée',
      "Le plan d'action individuel",
    ],
    submissionFields: [
      {
        id: 'prompt_and_iterations',
        label: '1. Consigne finale et étapes d’amélioration',
        help: 'Indiquez votre consigne finale, le nom du document qui la contient ou un lien sécurisé, puis résumez les principales corrections effectuées.',
        placeholder: 'Exemple : document « Consigne finale – synthèse client », lien interne autorisé, puis résumé des deux améliorations principales…',
      },
      {
        id: 'final_output',
        label: '2. Livrable final ou maquette',
        help: 'Décrivez le résultat produit et précisez où le formateur peut le consulter. Vous pouvez aussi coller un lien dont l’accès est volontairement partagé.',
        placeholder: 'Exemple : maquette de compte rendu au format PDF, déposée dans l’espace interne…',
      },
      {
        id: 'verification_grid_reference',
        label: '3. Grille de vérification complétée',
        help: 'Indiquez le nom, l’emplacement ou le lien sécurisé de la grille utilisée pour conserver vos contrôles et votre décision finale.',
        placeholder: 'Exemple : « Grille de vérification – cas final.pdf », dossier partagé autorisé…',
      },
      {
        id: 'action_plan',
        label: "4. Plan d’action individuel",
        help: 'Décrivez la première expérimentation prévue, son échéance, les personnes concernées et les contrôles à conserver.',
        placeholder: 'Exemple : tester la méthode sous 30 jours sur une invitation générique, avec validation avant envoi…',
      },
    ],
    criteria: [
      'Adéquation du résultat au besoin et au public',
      'Clarté de la consigne et des critères de réussite',
      'Qualité des contrôles et prise en compte des risques',
      'Capacité à expliquer les choix et les limites',
    ],
    rubricLevels: [
      {
        id: 'not_acquired',
        label: 'Non acquis',
        help: 'Les éléments indispensables sont absents ou présentent un risque important.',
      },
      {
        id: 'developing',
        label: "En cours d'acquisition",
        help: 'La méthode est engagée mais plusieurs éléments doivent encore être précisés ou corrigés.',
      },
      {
        id: 'acquired',
        label: 'Acquis',
        help: 'Le travail répond aux attentes et peut être utilisé après les validations prévues.',
      },
      {
        id: 'mastered',
        label: 'Maîtrisé',
        help: 'La méthode est appliquée avec autonomie, recul critique et capacité de transfert.',
      },
    ],
    rubric: [
      {
        id: 'need_and_audience',
        criterion: 'Adéquation au besoin et au public',
        descriptors: {
          not_acquired: "Le besoin, le public ou le résultat attendu ne sont pas identifiés. Le livrable ne répond pas à la situation choisie.",
          developing: "Le besoin principal est identifié, mais le livrable reste partiellement adapté au public, à l'objectif ou aux contraintes.",
          acquired: "Le livrable répond au besoin, au public et au résultat attendu. Les contraintes utiles sont respectées.",
          mastered: "Le livrable anticipe les usages réels, justifie ses choix et peut être adapté de façon autonome à une situation proche.",
        },
      },
      {
        id: 'prompt_and_success_criteria',
        criterion: 'Consigne et critères de réussite',
        descriptors: {
          not_acquired: "La demande reste vague et ne précise ni le résultat attendu ni les conditions de réussite.",
          developing: "La demande contient un objectif et quelques précisions, mais le contexte, le format ou les critères de réussite restent incomplets.",
          acquired: "La consigne précise l'objectif, le contexte utile, le public, les contraintes, le format et des critères de réussite vérifiables.",
          mastered: "La consigne est réutilisable, les améliorations sont justifiées et les essais montrent une démarche d'itération autonome.",
        },
      },
      {
        id: 'checks_and_risks',
        criterion: 'Contrôles et maîtrise des risques',
        descriptors: {
          not_acquired: "Le résultat est utilisé sans contrôle suffisant, ou des données non autorisées sont transmises.",
          developing: "Des vérifications sont mentionnées, mais les sources, les données, les droits, les biais ou la validation humaine ne sont pas tous traités.",
          acquired: "Les faits, les sources, les données, les droits, les biais et la validation humaine sont contrôlés et consignés dans la grille.",
          mastered: "Les contrôles sont hiérarchisés selon les risques, traçables et proportionnés. Les limites résiduelles sont clairement expliquées.",
        },
      },
      {
        id: 'choices_and_limits',
        criterion: 'Explication des choix et des limites',
        descriptors: {
          not_acquired: "Les étapes suivies, la part de l'IA et les décisions humaines ne peuvent pas être expliquées.",
          developing: "Les principales étapes sont décrites, mais les corrections, les limites ou les décisions humaines restent peu justifiées.",
          acquired: "Les essais, les corrections, les choix, les limites de l'outil et les décisions humaines sont expliqués de manière claire.",
          mastered: "L'analyse montre du recul critique, tire des enseignements transférables et propose un plan d'action réaliste et responsable.",
        },
      },
    ],
    validationRule: "L'évaluation finale est validée lorsque les quatre critères atteignent au minimum le niveau « Acquis ». Le niveau « Maîtrisé » reconnaît une autonomie supplémentaire mais n'est pas obligatoire. Si un critère reste « Non acquis » ou « En cours d'acquisition », le formateur indique les améliorations attendues avant une nouvelle remise.",
    resource: generativeAiVerificationGrid,
  };

const generativeAiGlossary = [
  {
    term: 'Anonymisation',
    definition: "Transformation irréversible qui rend impossible, en pratique, l'identification d'une personne. Retirer seulement son nom ne suffit pas toujours.",
    example: "Remplacer un nom par « Participant 12 » reste une pseudonymisation si une autre liste permet de retrouver la personne.",
  },
  {
    term: "Assistant d'IA",
    definition: "Outil qui permet de dialoguer avec un ou plusieurs modèles afin de générer, analyser ou transformer un contenu.",
    example: "Demander une première structure de courriel, puis la relire et la corriger avant envoi.",
  },
  {
    term: 'Biais',
    definition: "Tendance d'un modèle ou de ses résultats à reproduire des déséquilibres, stéréotypes ou choix présents dans les données et les consignes.",
    example: "Une proposition de recrutement qui associe systématiquement certains métiers à un genre doit être rejetée et analysée.",
  },
  {
    term: 'Chatbot',
    definition: "Interface de conversation automatisée. Selon l'outil, ses réponses peuvent être produites par une IA, une base de règles, une recherche ou plusieurs de ces méthodes.",
    example: "La fenêtre de discussion d'un service client peut être un chatbot sans être un assistant d'IA générative complet.",
  },
  {
    term: 'Confidentialité',
    definition: "Protection d'une information qui ne doit être accessible qu'aux personnes autorisées.",
    example: "Une note interne non publique ne doit pas être copiée dans un assistant qui n'est pas autorisé par l'organisation.",
  },
  {
    term: 'Consigne',
    definition: "Instruction de travail qui précise ce qui doit être produit, pour qui, à partir de quelles informations et selon quelles règles.",
    example: "Rédiger un courriel de 150 mots pour des adultes débutants, à partir des trois faits fournis.",
  },
  {
    term: 'Contexte',
    definition: 'Informations utiles qui permettent d’adapter une réponse à la situation, au public et au résultat attendu.',
    example: "Préciser que le document s'adresse à des participants peu à l'aise avec le numérique aide à choisir des mots plus simples.",
  },
  {
    term: 'Critère de réussite',
    definition: "Condition observable utilisée pour déterminer si un résultat répond réellement au besoin.",
    example: "Le courriel reprend les trois dates fournies, reste inférieur à 180 mots et présente les actions dans l'ordre.",
  },
  {
    term: 'Décision sensible',
    definition: "Décision pouvant avoir un effet important sur une personne, ses droits, sa santé, son emploi, son accès à un service ou une obligation.",
    example: "L'IA peut aider à préparer une liste de points de vigilance, mais elle ne doit pas décider seule d'une sanction ou d'un recrutement.",
  },
  {
    term: 'Donnée personnelle',
    definition: "Information se rapportant à une personne physique identifiée ou identifiable, directement ou par recoupement.",
    example: "Un nom, une adresse électronique, une photographie, une voix ou un identifiant de connexion peuvent être des données personnelles.",
  },
  {
    term: 'Donnée sensible',
    definition: "Catégorie de donnée personnelle bénéficiant d'une protection renforcée, notamment lorsqu'elle concerne la santé, les opinions ou les caractéristiques biométriques.",
    example: "Un dossier médical ou une information révélant une opinion politique ne doit jamais servir d'exemple dans un exercice avec un outil non autorisé.",
  },
  {
    term: "Droit d'auteur",
    definition: "Protection accordée à l'auteur d'une œuvre originale. Un contenu accessible sur internet n'est pas automatiquement libre de réutilisation.",
    example: "Avant d'intégrer une image trouvée en ligne dans un support, vérifier son origine, sa licence et les conditions de réutilisation.",
  },
  {
    term: 'Hallucination',
    definition: "Information fausse, inventée ou imprécise produite par une IA, parfois formulée de manière convaincante.",
    example: "L'assistant cite une étude avec un titre crédible, mais cette étude n'existe pas : la référence doit être rejetée.",
  },
  {
    term: 'Intelligence artificielle (IA)',
    definition: "Ensemble de techniques permettant à un système informatique de réaliser certaines tâches associées à l'analyse, la prédiction, la recommandation ou la génération de contenus.",
    example: "Un outil peut classer des messages, détecter des objets dans une image ou proposer un texte sans comprendre la situation comme une personne.",
  },
  {
    term: 'IA générative',
    definition: "Type d'IA qui produit un nouveau contenu probable, par exemple du texte, une image, du son, une vidéo ou du code, à partir d'une demande.",
    example: "Produire une première version de FAQ à partir de consignes techniques validées.",
  },
  {
    term: 'IA multimodale',
    definition: 'Système capable de traiter ou de générer plusieurs types de contenus, par exemple du texte, des images, du son ou de la vidéo.',
    example: "Analyser une photographie accompagnée d'une question écrite, puis proposer une description textuelle.",
  },
  {
    term: 'Itération',
    definition: "Amélioration progressive d'une demande ou d'un résultat après analyse des écarts constatés.",
    example: "Demander une seconde version plus courte après avoir constaté que la limite de 150 mots n'était pas respectée.",
  },
  {
    term: "Licence d'utilisation",
    definition: "Règles définissant les droits accordés pour utiliser, modifier, partager ou intégrer un contenu ou un logiciel.",
    example: "Une licence peut autoriser la réutilisation d'une image à condition de citer son auteur et de ne pas la modifier.",
  },
  {
    term: 'Livrable',
    definition: "Résultat concret attendu à la fin d'une tâche : document, maquette, tableau, présentation, message ou autre production vérifiable.",
    example: "Le livrable du cas final peut être la maquette d'un compte rendu accompagnée de sa grille de contrôle.",
  },
  {
    term: 'LLM (grand modèle de langage)',
    definition: "Modèle entraîné sur de grands volumes de textes afin d'analyser et de générer du langage naturel.",
    example: "Le modèle peut proposer une phrase plausible sans disposer d'une preuve que cette phrase est vraie.",
  },
  {
    term: 'Minimisation des données',
    definition: "Principe consistant à utiliser uniquement les données adéquates, pertinentes et nécessaires pour atteindre un objectif défini.",
    example: "Pour préparer un modèle générique de courriel, les noms et adresses des participants ne sont pas nécessaires.",
  },
  {
    term: "Modèle d'IA",
    definition: "Système entraîné à repérer des régularités dans des données afin de produire une prédiction, un classement ou un contenu.",
    example: "Un assistant de conversation est l'interface visible ; le modèle est l'un des systèmes qui produit la réponse.",
  },
  {
    term: 'Moteur de recherche',
    definition: "Service qui aide à retrouver des pages, documents ou ressources. Les résultats doivent encore être évalués selon leur auteur, leur date et leur fiabilité.",
    example: "Rechercher une règle sur le site officiel compétent, puis ouvrir la page source avant de la citer.",
  },
  {
    term: 'Outil autorisé',
    definition: "Service dont l'utilisation a été approuvée pour un besoin et un type de données déterminés par l'organisation.",
    example: "Un outil peut être autorisé pour des textes génériques mais interdit pour des dossiers de clients ou de salariés.",
  },
  {
    term: 'Prompt',
    definition: "Instruction, question ou ensemble de consignes fourni à une IA pour guider son résultat.",
    example: "Objectif, contexte, public, informations autorisées, contraintes, format et critères peuvent former un prompt structuré.",
  },
  {
    term: 'Propriété intellectuelle',
    definition: "Ensemble de droits protégeant notamment les œuvres, créations, marques et inventions. Les conditions varient selon le contenu et son usage.",
    example: "Avant de diffuser un support créé avec une IA, contrôler les éléments repris, leur origine et les droits de réutilisation.",
  },
  {
    term: 'Pseudonymisation',
    definition: "Remplacement des informations directement identifiantes par un code ou un alias. Cette opération reste réversible et les données restent personnelles.",
    example: "Remplacer un nom par un numéro tout en conservant séparément la table de correspondance est une pseudonymisation.",
  },
  {
    term: 'RAG',
    definition: "Méthode qui fournit des documents de référence à un modèle afin d'ancrer sa réponse dans des sources déterminées.",
    example: "Un assistant répond à partir d'un manuel interne autorisé et doit indiquer les passages utilisés.",
  },
  {
    term: 'Réversibilité',
    definition: "Possibilité d'arrêter une expérimentation, de revenir au fonctionnement précédent ou de corriger le résultat sans conséquence disproportionnée.",
    example: "Tester un modèle de courriel en brouillon est plus réversible que déclencher automatiquement son envoi à tous les clients.",
  },
  {
    term: 'RGPD',
    definition: "Règlement européen encadrant le traitement des données personnelles et renforçant les droits des personnes concernées.",
    example: "Avant d'utiliser des données de participants, définir l'objectif, limiter les informations nécessaires et respecter les règles de l'organisation.",
  },
  {
    term: 'Source de référence',
    definition: "Document, page ou ensemble de faits autorisés servant de base au travail et au contrôle d'une information.",
    example: "Pour préparer une FAQ, utiliser la procédure technique validée plutôt qu'une réponse précédente non vérifiée de l'assistant.",
  },
  {
    term: 'Token',
    definition: "Unité utilisée par un modèle pour découper et traiter un contenu. La taille d'un texte ne correspond donc pas directement à son nombre de tokens.",
    example: "Une phrase est découpée en plusieurs unités avant d'être analysée par le modèle.",
  },
  {
    term: 'Traçabilité',
    definition: "Conservation des éléments permettant de comprendre ce qui a été demandé, produit, vérifié, corrigé et validé.",
    example: "Garder la consigne finale, les deux essais, les sources consultées, la grille de vérification et la date de validation.",
  },
  {
    term: 'Validation humaine',
    definition: "Contrôle réalisé par une personne compétente avant l'utilisation, la prise de décision ou la diffusion d'un résultat produit avec l'IA.",
    example: "Le responsable vérifie les dates, les sources et les consignes avant d'autoriser l'envoi du message.",
  },
  {
    term: 'Variable',
    definition: "Élément à remplacer dans un modèle de consigne pour l'adapter à une nouvelle situation.",
    example: "Dans « Rédige pour [public] », le texte entre crochets doit être remplacé par le public réel.",
  },
  {
    term: 'Version de travail',
    definition: "Résultat provisoire destiné à être comparé, corrigé et vérifié avant de devenir un livrable final.",
    example: "La première synthèse produite par l'assistant reste un brouillon tant que les faits n'ont pas été contrôlés.",
  },
  {
    term: 'Workflow',
    definition: "Enchaînement organisé d'étapes, d'informations d'entrée, de résultats intermédiaires et de validations.",
    example: "Préparer la source, produire deux versions, comparer, vérifier, corriger puis valider avant diffusion.",
  },
];

const generativeAiQuiz = [
  {
    id: 'usage',
    domain: 'usages',
    question: "À quelle fréquence utilisez-vous déjà un outil d'IA générative ?",
    answers: [
      { label: 'Jamais ou presque', score: 0 },
      { label: 'Quelques fois par mois', score: 1 },
      { label: 'Chaque semaine', score: 2 },
      { label: 'Presque tous les jours', score: 3 },
    ],
  },
  {
    id: 'use_cases',
    domain: 'usages',
    question: "Savez-vous identifier les tâches pour lesquelles l'IA est utile, risquée ou inadaptée ?",
    answers: [
      { label: 'Pas encore', score: 0 },
      { label: 'Pour quelques tâches seulement', score: 1 },
      { label: 'Oui, avec des critères précis', score: 2 },
    ],
  },
  {
    id: 'search_difference',
    domain: 'usages',
    question: "Quelle différence faites-vous entre une réponse d'IA et un résultat de moteur de recherche ?",
    answers: [
      { label: 'Je les considère comme équivalents', score: 0 },
      { label: "Je sais qu'une réponse d'IA peut contenir des erreurs", score: 1 },
      { label: "Je distingue génération de contenu, recherche de sources et vérification", score: 2 },
    ],
  },
  {
    id: 'prompt',
    domain: 'formulation',
    question: 'Savez-vous préciser le contexte, le résultat attendu et les contraintes dans une consigne ?',
    answers: [
      { label: 'Pas encore', score: 0 },
      { label: 'Partiellement', score: 1 },
      { label: 'Oui, avec une méthode', score: 2 },
    ],
  },
  {
    id: 'clarification',
    domain: 'formulation',
    question: "Que faites-vous lorsqu'il manque des informations importantes dans votre demande ?",
    answers: [
      { label: "Je laisse généralement l'IA compléter", score: 0 },
      { label: 'Je corrige après la première réponse', score: 1 },
      { label: "Je demande des questions de clarification avant la production", score: 2 },
    ],
  },
  {
    id: 'production',
    domain: 'formulation',
    question: "Comment utilisez-vous l'IA pour préparer un contenu professionnel ?",
    answers: [
      { label: 'Je reprends souvent la première proposition', score: 0 },
      { label: 'Je reformule et adapte le contenu', score: 1 },
      { label: 'Je compare, contrôle et finalise selon des critères définis', score: 2 },
    ],
  },
  {
    id: 'verification',
    domain: 'verification',
    question: "Comment vérifiez-vous une réponse produite par l'IA ?",
    answers: [
      { label: 'Je me fie surtout à la qualité de la formulation', score: 0 },
      { label: 'Je vérifie les éléments qui me semblent incertains', score: 1 },
      { label: 'Je contrôle les faits, les sources, le contexte et les critères attendus', score: 2 },
    ],
  },
  {
    id: 'confidentiality',
    domain: 'verification',
    question: "Avez-vous des règles pour éviter de transmettre des données personnelles ou confidentielles ?",
    answers: [
      { label: 'Non', score: 0 },
      { label: 'Je suis vigilant, mais sans règle formalisée', score: 1 },
      { label: 'Oui, des règles sont définies et appliquées', score: 2 },
    ],
  },
  {
    id: 'bias',
    domain: 'verification',
    question: "Prenez-vous en compte les biais ou les formulations pouvant défavoriser certains publics ?",
    answers: [
      { label: 'Pas encore', score: 0 },
      { label: 'Je relis le contenu lorsque le sujet est sensible', score: 1 },
      { label: "J'utilise des critères de contrôle adaptés au public et au contexte", score: 2 },
    ],
  },
  {
    id: 'governance',
    domain: 'usages',
    question: "Votre usage de l'IA s'inscrit-il dans des règles ou un plan d'action professionnel ?",
    answers: [
      { label: 'Non, mon usage reste informel', score: 0 },
      { label: 'Quelques bonnes pratiques sont identifiées', score: 1 },
      { label: 'Les usages, contrôles et responsabilités sont documentés', score: 2 },
    ],
  },
];

const aiActModules = [
  {
    id: 'comprendre-cadre-europeen',
    number: 1,
    duration: '1 h',
    title: "Comprendre l’IA et son cadre européen",
    summary: "Identifier les acteurs, les usages et les premiers repères de l’AI Act sans transformer l’acculturation en diagnostic juridique.",
    goals: [
      "Expliquer simplement ce qu’est un système d’IA dans un contexte professionnel",
      "Distinguer le fournisseur, le déployeur, les utilisateurs et les personnes concernées",
      "Relier un usage concret aux premiers points de vigilance et à l’obligation de maîtrise de l’IA",
    ],
    keyPoints: [
      "L’AI Act raisonne à partir du système, de l’usage, du rôle de l’organisation et des effets possibles",
      "Les définitions, les pratiques interdites et l’obligation de maîtrise de l’IA s’appliquent depuis le 2 février 2025",
      "Une cartographie factuelle prépare l’analyse, mais ne constitue pas à elle seule une qualification juridique",
    ],
    activity: "Cartographier un à trois usages réels ou réalistes, distinguer les acteurs et noter les informations qui restent à vérifier.",
    exerciseId: 1,
    lesson: {
      introduction: [
        "L’AI Act est le règlement européen qui encadre la mise sur le marché et l’utilisation de systèmes d’intelligence artificielle. Il ne classe pas une organisation entière comme « conforme » ou « non conforme » à partir du seul nom d’un outil. Il faut d’abord comprendre quel système est utilisé, dans quel but, par qui et avec quelles conséquences possibles.",
        "Pour débuter, l’objectif n’est pas de produire une analyse juridique. Il consiste à décrire les usages avec des faits vérifiables, à distinguer les acteurs et à repérer les questions à transmettre aux personnes compétentes. Cette première cartographie servira de base aux modules suivants sur les niveaux de vigilance et le plan d’acculturation.",
      ],
      concepts: [
        {
          title: "Système d’IA",
          description: "Un système automatisé qui produit notamment des prédictions, contenus, recommandations ou décisions pouvant influencer un environnement. Le nom commercial de l’outil ne suffit pas pour comprendre son fonctionnement ou son usage.",
        },
        {
          title: "Fournisseur et déployeur",
          description: "Le fournisseur développe ou fait développer le système et le met sur le marché sous son nom. Le déployeur l’utilise sous son autorité dans un cadre professionnel. Une organisation doit examiner son rôle pour chaque usage.",
        },
        {
          title: "Maîtrise de l’IA",
          description: "Les connaissances et compétences permettant aux personnes concernées d’utiliser l’IA de manière éclairée, en comprenant ses possibilités, ses limites et ses risques selon leur fonction et le contexte d’usage.",
        },
      ],
      guidedSteps: [
        {
          title: "1. Décrire l’usage réel",
          description: "Notez la tâche, le résultat produit et l’action réalisée après ce résultat. Évitez les formulations vagues comme « nous utilisons l’IA au bureau ».",
        },
        {
          title: "2. Identifier les acteurs",
          description: "Relevez le fournisseur du service, l’organisation qui l’utilise, les fonctions utilisatrices et les personnes éventuellement concernées par le résultat.",
        },
        {
          title: "3. Repérer les données et les effets",
          description: "Décrivez uniquement les catégories de données, sans copier de donnée réelle, puis indiquez ce que le résultat peut changer pour une personne ou une activité.",
        },
        {
          title: "4. Situer le contrôle humain",
          description: "Précisez qui vérifie le résultat, qui prend la décision finale et dans quelle situation l’usage doit être interrompu ou transmis à un responsable.",
        },
        {
          title: "5. Conserver les questions ouvertes",
          description: "Notez les informations inconnues, la source officielle ou interne à consulter, sa date de consultation et la personne compétente qui devra confirmer l’analyse.",
        },
      ],
      demonstration: {
        title: "Démonstration : assistant de rédaction pour le service client",
        introduction: "Une PME envisage un assistant génératif pour préparer des brouillons de réponses. Le tableau sépare les faits connus des conclusions qui demandent encore une vérification.",
        columns: ["Élément observé", "Premier repère", "Point à vérifier"],
        rows: [
          [
            "L’assistant prépare un brouillon à partir d’une demande fictive ou anonymisée.",
            "Le résultat est un contenu proposé, pas une réponse envoyée automatiquement.",
            "Confirmer les données réellement transmises et les conditions du fournisseur.",
          ],
          [
            "Un salarié relit et corrige le brouillon avant tout envoi.",
            "Une supervision humaine est prévue dans le processus.",
            "Définir des critères de contrôle et les situations imposant un arrêt.",
          ],
          [
            "La PME utilise un service proposé sous le nom d’un éditeur externe.",
            "Elle examine d’abord sa position possible de déployeur pour cet usage.",
            "Vérifier le contrat, le paramétrage et les responsabilités exactes.",
          ],
          [
            "Les utilisateurs doivent reconnaître les limites et protéger les informations.",
            "Le contenu de l’acculturation doit être adapté à leur fonction et à cet usage.",
            "Conserver les objectifs, activités et preuves de réalisation de cette acculturation.",
          ],
        ],
      },
      professionalExample: {
        title: "Exemple commenté : passer d’une conclusion immédiate à un inventaire vérifiable",
        unsafeRequest: "« Nous utilisons un assistant d’IA pour écrire des messages. Dis-moi si notre entreprise est conforme à l’AI Act. »",
        saferRequest: "« Aide-moi à préparer l’inventaire factuel d’un assistant d’IA utilisé pour produire des brouillons de messages. Distingue la finalité, le fournisseur, le rôle possible de l’organisation, les utilisateurs, les personnes concernées, les catégories de données, la validation humaine et les informations manquantes. Ne conclus pas juridiquement et indique les points à vérifier dans une source officielle ou avec la personne compétente. »",
        analysis: [
          "La seconde demande décrit un usage précis au lieu de juger toute l’organisation.",
          "Les rôles, les données, la supervision et les personnes concernées deviennent observables.",
          "Les informations absentes restent visibles et aucune qualification juridique automatique n’est demandée.",
        ],
      },
      commonMistakes: [
        "Confondre un outil d’IA générative avec l’ensemble des systèmes d’IA visés par le règlement.",
        "Classer un usage uniquement à partir du nom de l’outil, sans examiner sa finalité et ses effets.",
        "Déclarer l’organisation conforme sans inventorier les usages, les rôles, les données et les contrôles.",
        "Copier des données personnelles ou confidentielles dans un service public pour réaliser la cartographie.",
      ],
      takeaways: [
        "L’analyse commence par un usage précis, pas par le nom commercial d’un outil.",
        "Le fournisseur, le déployeur, les utilisateurs et les personnes concernées ont des positions différentes.",
        "La maîtrise de l’IA doit être adaptée aux fonctions, aux connaissances et au contexte d’utilisation.",
        "La cartographie conserve les faits, les sources et les questions à faire confirmer ; elle ne remplace pas un avis juridique.",
      ],
    },
  },
  {
    id: 'identifier-niveaux-vigilance',
    number: 2,
    duration: '1 h',
    title: 'Identifier les usages et les niveaux de vigilance',
    summary: 'Repérer les situations qui imposent un arrêt, une analyse spécialisée, une information des personnes ou des contrôles renforcés.',
    goals: [
      'Reconnaître les principaux signaux associés aux pratiques interdites, au haut risque et à la transparence',
      'Examiner les personnes concernées, les données, les effets et la place de la décision humaine',
      'Orienter un cas vers la bonne suite sans produire de qualification juridique automatique',
    ],
    keyPoints: [
      'Le niveau de vigilance dépend de la finalité prévue et du contexte réel, pas seulement de la technologie utilisée',
      'Une pratique interdite ou un possible système à haut risque nécessite une vérification spécialisée avant de poursuivre',
      'L’AI Act complète les autres règles applicables, notamment la protection des données, la confidentialité et le droit du travail',
    ],
    activity: 'Analyser un cas fictif, repérer ses signaux de vigilance et préparer les questions à transmettre au référent compétent.',
    exerciseId: 2,
    lesson: {
      introduction: [
        'L’AI Act adopte une approche fondée sur les risques. Certains usages sont interdits, d’autres sont soumis à des exigences renforcées ou à des obligations de transparence, tandis que de nombreux usages courants restent possibles avec des contrôles proportionnés. La catégorie ne se déduit toutefois pas du nom de l’outil : elle dépend de sa finalité prévue, de son fonctionnement et du contexte dans lequel il est utilisé.',
        'À ce stade, l’apprenant réalise un premier tri. Il recherche des signaux d’alerte, distingue les faits des suppositions et choisit la prochaine action prudente. La décision finale peut nécessiter le fournisseur, le responsable interne, le délégué à la protection des données ou un professionnel du droit.',
      ],
      concepts: [
        {
          title: 'Pratique interdite',
          description: 'Usage que le règlement interdit lorsqu’il réunit des conditions précises. Un signal possible impose d’arrêter l’analyse simplifiée et de faire vérifier le cas avant tout déploiement.',
        },
        {
          title: 'Système à haut risque',
          description: 'Système relevant de situations définies par le règlement, notamment selon sa finalité et son domaine d’emploi. Une activité importante ou sensible n’est pas automatiquement une qualification juridique de haut risque.',
        },
        {
          title: 'Obligation de transparence',
          description: 'Information à fournir dans certaines situations, par exemple lorsqu’une personne interagit avec une IA ou rencontre certains contenus générés. Les conditions exactes doivent être vérifiées pour chaque usage.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Fixer les faits du cas',
          description: 'Décrivez la finalité, les utilisateurs, les personnes concernées, le résultat produit et l’action ou la décision qu’il prépare. Marquez les informations absentes comme inconnues.',
        },
        {
          title: '2. Mesurer les effets possibles',
          description: 'Demandez si le résultat influence un accès à un emploi, une formation, un service, un droit ou une décision pouvant affecter significativement une personne.',
        },
        {
          title: '3. Rechercher les signaux réglementaires',
          description: 'Repérez une possible pratique interdite, un domaine potentiellement à haut risque ou une situation dans laquelle la personne devrait être informée de l’usage de l’IA.',
        },
        {
          title: '4. Examiner les protections existantes',
          description: 'Vérifiez les catégories de données, la confidentialité, les contrôles humains, la possibilité de corriger le résultat et les conditions permettant d’interrompre l’usage.',
        },
        {
          title: '5. Décider de la prochaine vérification',
          description: 'Classez la suite à donner : suspendre, demander une analyse spécialisée, préciser la transparence et les contrôles, ou poursuivre une expérimentation limitée sous validation humaine.',
        },
      ],
      demonstration: {
        title: 'Démonstration : comparer quatre usages professionnels',
        introduction: 'Le formateur montre que des outils proches peuvent appeler des niveaux de vigilance différents selon leur finalité et leurs effets.',
        columns: ['Cas fictif', 'Signal à repérer', 'Suite prudente'],
        rows: [
          [
            'Corriger l’orthographe d’une note interne fictive, sans donnée personnelle.',
            'Usage courant, mais confidentialité et exactitude restent à contrôler.',
            'Expérimentation limitée avec source autorisée et relecture humaine.',
          ],
          [
            'Répondre aux visiteurs avec un agent conversationnel présenté comme assistant automatisé.',
            'Interaction directe avec une IA et information de la personne à examiner.',
            'Vérifier les obligations de transparence, les limites annoncées et le relais humain.',
          ],
          [
            'Classer automatiquement des candidatures avant un recrutement.',
            'Effet possible sur l’accès à l’emploi et signal de haut risque.',
            'Suspendre toute conclusion simplifiée et demander une analyse spécialisée du système et du processus.',
          ],
          [
            'Déduire la motivation de salariés à partir de leurs expressions faciales.',
            'Signal très fort de pratique interdite dans le contexte professionnel.',
            'Ne pas déployer et faire vérifier immédiatement le cas, ses conditions exactes et les éventuelles exceptions prévues par le texte.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : remplacer une réponse binaire par un premier tri documenté',
        unsafeRequest: '« Notre outil classe automatiquement les candidatures. Est-ce autorisé par l’AI Act ? Réponds simplement oui ou non. »',
        saferRequest: '« À partir de ce cas fictif de classement de candidatures, sépare les faits connus, les informations manquantes et les signaux de vigilance. Examine la finalité, les personnes concernées, les données, l’effet sur la décision, la supervision humaine et le rôle possible de l’organisation. Ne conclus pas juridiquement. Indique les questions à transmettre au responsable compétent et les sources officielles à consulter sans inventer de référence. »',
        analysis: [
          'La seconde demande refuse une conclusion binaire fondée sur une description incomplète.',
          'L’effet sur les personnes, les données et la décision humaine devient visible.',
          'Le résultat attendu est une liste de vérifications et non une autorisation produite par l’IA.',
        ],
      },
      commonMistakes: [
        'Considérer que tout usage professionnel est automatiquement à haut risque.',
        'Considérer au contraire qu’un outil courant ne peut jamais relever d’une situation réglementée.',
        'Confondre un premier signal de vigilance avec une qualification juridique définitive.',
        'Examiner uniquement l’AI Act sans vérifier les données personnelles, la confidentialité, les droits et les règles métier applicables.',
      ],
      takeaways: [
        'La finalité et les effets du système comptent davantage que son nom ou sa popularité.',
        'Un signal de pratique interdite entraîne un arrêt et une vérification compétente.',
        'Un possible haut risque ou une obligation de transparence doit être documenté et confirmé.',
        'Le premier tri prépare la décision ; il ne remplace ni les sources officielles ni l’analyse spécialisée.',
      ],
    },
  },
  {
    id: 'organiser-acculturation-equipes',
    number: 3,
    duration: '1 h',
    title: "Organiser l’acculturation des équipes",
    summary: "Construire des actions de maîtrise de l’IA adaptées aux fonctions, aux usages et aux risques, puis conserver des preuves proportionnées.",
    goals: [
      "Identifier les personnes qui utilisent ou encadrent des systèmes d’IA pour le compte de l’organisation",
      "Définir des compétences et activités adaptées aux connaissances, aux responsabilités et aux usages",
      "Prévoir des traces simples, une actualisation et des règles de minimisation des données",
    ],
    keyPoints: [
      "L’article 4 ne prévoit pas un programme identique pour tous : les mesures dépendent des personnes, des systèmes et du contexte",
      "Une formation peut être complétée par des consignes, exercices, ressources, échanges et rappels adaptés aux usages",
      "Aucun certificat ni aucune structure de gouvernance particulière n’est imposé pour l’article 4 ; un registre interne proportionné peut conserver les actions réalisées",
    ],
    activity: "Préparer un plan d’acculturation pour trois groupes de fonctions, avec objectifs, activités, preuves et conditions d’actualisation.",
    exerciseId: 3,
    lesson: {
      introduction: [
        "La maîtrise de l’IA ne consiste pas à faire suivre le même cours à toute l’organisation. Une personne qui utilise occasionnellement un assistant de rédaction, un salarié qui exploite régulièrement des recommandations et un responsable qui choisit ou déploie un système n’ont ni les mêmes besoins, ni les mêmes responsabilités.",
        "Le point de départ est l’inventaire des usages. Pour chaque groupe, l’organisation précise ce qu’il faut comprendre, savoir faire et savoir arrêter. Elle choisit ensuite des actions réalistes et conserve des traces utiles. Le cadre européen évoluant, les sources officielles et les supports internes doivent être datés et revus lorsque l’outil, l’usage, le risque ou la règle change.",
      ],
      concepts: [
        {
          title: "Public concerné",
          description: "Personnel ou autre personne qui utilise ou fait fonctionner un système d’IA pour le compte de l’organisation. Le périmètre peut inclure des prestataires ou partenaires selon la situation.",
        },
        {
          title: "Niveau suffisant",
          description: "Compétences, connaissances et compréhension adaptées à la fonction, à l’expérience, au système utilisé, à ses risques et aux personnes sur lesquelles il peut produire des effets.",
        },
        {
          title: "Preuve proportionnée",
          description: "Trace interne utile pour retrouver le public, l’objectif, l’action, le support, la date et la suite prévue, sans conserver de donnée personnelle ou d’évaluation individuelle inutile.",
        },
      ],
      guidedSteps: [
        {
          title: "1. Relier les publics aux usages",
          description: "Partez de la cartographie et regroupez les personnes par fonctions proches : utilisateurs occasionnels, utilisateurs réguliers, responsables, superviseurs ou personnes chargées du support.",
        },
        {
          title: "2. Identifier les besoins de chaque groupe",
          description: "Estimez les connaissances déjà présentes sans imposer de test nominatif : échange, questionnaire non noté, observation d’une tâche fictive ou retour sur les difficultés rencontrées.",
        },
        {
          title: "3. Définir des objectifs observables",
          description: "Précisez ce que chaque groupe devra savoir expliquer, appliquer, vérifier et interrompre dans les usages qui le concernent.",
        },
        {
          title: "4. Combiner les actions utiles",
          description: "Choisissez une combinaison proportionnée : sensibilisation, atelier pratique, guide interne, règles d’usage, démonstration, questions-réponses et rappel lors d’une évolution importante.",
        },
        {
          title: "5. Tracer et actualiser",
          description: "Conservez la version du support, la date, le public par fonction, la réalisation et les suites prévues. Définissez les événements déclenchant une mise à jour du plan.",
        },
      ],
      demonstration: {
        title: "Démonstration : adapter le parcours à trois fonctions",
        introduction: "Une PME utilise un assistant génératif pour préparer des contenus. Le formateur montre comment différencier les objectifs sans créer trois formations entièrement séparées.",
        columns: ["Groupe", "Compétences prioritaires", "Action et preuve utile"],
        rows: [
          [
            "Utilisateurs occasionnels",
            "Reconnaître les limites, protéger les informations et faire relire le résultat.",
            "Sensibilisation courte, exercice fictif et trace de réalisation par groupe.",
          ],
          [
            "Utilisateurs réguliers",
            "Cadrer une tâche, vérifier les faits, appliquer les règles internes et signaler un incident.",
            "Atelier sur les usages autorisés, grille de contrôle et retour collectif anonymisé.",
          ],
          [
            "Responsables de déploiement ou de supervision",
            "Identifier les rôles, apprécier les risques, organiser la supervision et décider d’une suspension.",
            "Étude de cas, procédure d’escalade et compte rendu des décisions de mise à jour.",
          ],
        ],
      },
      professionalExample: {
        title: "Exemple commenté : passer d’un webinaire unique à un plan adapté",
        unsafeRequest: "« Prépare un webinaire identique pour tous les salariés et un certificat prouvant automatiquement notre conformité à l’article 4. »",
        saferRequest: "« Aide-moi à construire un plan de maîtrise de l’IA à partir de trois groupes de fonctions et des usages réellement recensés. Pour chaque groupe, précise les compétences attendues, les risques à connaître, les activités, les règles d’arrêt, la preuve minimale à conserver et le déclencheur de mise à jour. Ne promets pas la conformité et n’invente aucune obligation de certificat ou de test individuel. »",
        analysis: [
          "La seconde demande adapte les actions aux responsabilités et aux usages réels.",
          "Les apprentissages attendus et les situations d’arrêt deviennent observables.",
          "La trace documente la démarche sans présenter une simple attestation comme une preuve automatique de conformité.",
        ],
      },
      commonMistakes: [
        "Proposer exactement le même contenu à tous les publics sans examiner leurs usages et responsabilités.",
        "Confondre maîtrise de l’IA et réussite obligatoire à un test individuel nominatif.",
        "Considérer qu’un certificat de présence suffit à démontrer l’adaptation et l’efficacité des actions.",
        "Réaliser une action unique sans prévoir d’actualisation lorsque les outils, les usages ou le cadre évoluent.",
      ],
      takeaways: [
        "Le plan part des usages, des publics et des risques réellement identifiés.",
        "Les objectifs diffèrent selon que la personne utilise, supervise, choisit ou déploie le système.",
        "Formation, consignes, pratique et accompagnement peuvent être combinés de manière proportionnée.",
        "Les preuves restent minimales, datées et actualisées ; elles ne garantissent pas seules la conformité juridique.",
      ],
    },
  },
  {
    id: 'preparer-plan-action-realiste',
    number: 4,
    duration: '1 h',
    title: "Préparer un plan d’action réaliste",
    summary: "Transformer l’inventaire des usages, les vigilances et le plan d’acculturation en actions prioritaires, attribuées et vérifiables.",
    goals: [
      "Prioriser les actions selon l’urgence, les effets possibles et les informations encore inconnues",
      "Attribuer chaque action à une fonction pilote et identifier les validations nécessaires",
      "Définir un livrable, une échéance, une preuve minimale et un déclencheur de révision",
    ],
    keyPoints: [
      "La feuille de route organise le travail mais ne constitue ni une déclaration, ni une garantie de conformité",
      "Les situations potentiellement interdites ou sensibles sont suspendues et transmises avant les améliorations de confort",
      "Le calendrier européen évolue : chaque échéance doit être reliée à une source officielle consultée et datée",
    ],
    activity: "Construire une feuille de route à 30, 60 et 90 jours à partir d’un cas fictif, puis justifier les priorités et les validations spécialisées.",
    exerciseId: 4,
    lesson: {
      introduction: [
        "Une organisation peut avoir recensé ses usages, repéré des vigilances et prévu l’acculturation de ses équipes sans savoir par quoi commencer. Le plan d’action sert à transformer ces constats en décisions réalisables : arrêter ce qui présente un signal fort, sécuriser les usages courants, obtenir les informations manquantes et préparer les mesures plus structurantes.",
        "Une bonne feuille de route reste courte et pilotable. Chaque ligne décrit une action observable, une fonction responsable, les personnes qui doivent valider, un résultat attendu, une échéance et une trace utile. Les dates réglementaires ne sont jamais recopiées sans leur source et leur date de consultation, car le calendrier et les textes d’accompagnement peuvent évoluer.",
      ],
      concepts: [
        {
          title: "Action prioritaire",
          description: "Mesure choisie à partir de faits connus, d’un risque ou d’une échéance. Elle commence par un verbe d’action et produit un résultat vérifiable, par exemple suspendre un usage, obtenir une documentation ou formaliser une règle.",
        },
        {
          title: "Fonction pilote et validation",
          description: "La fonction pilote coordonne l’action et son suivi. Elle ne remplace pas les validations juridiques, techniques, métiers, sociales ou relatives aux données lorsque celles-ci sont nécessaires.",
        },
        {
          title: "Trace et révision",
          description: "Le plan conserve uniquement les informations utiles : décision, version du livrable, fonction responsable, échéance, source datée et statut. Il prévoit aussi les événements qui imposent une nouvelle analyse.",
        },
      ],
      guidedSteps: [
        {
          title: "1. Rassembler les constats",
          description: "Reprenez la cartographie, le premier tri des vigilances et le plan d’acculturation. Séparez les faits vérifiés, les inconnues et les décisions déjà prises.",
        },
        {
          title: "2. Ordonner les priorités",
          description: "Traitez d’abord les signaux d’interdiction, les effets importants sur les personnes, les données sensibles et les échéances proches, puis les règles d’usage et les améliorations progressives.",
        },
        {
          title: "3. Attribuer les rôles",
          description: "Désignez une fonction pilote par action et précisez les fonctions qui doivent apporter une information, réaliser un contrôle ou valider la décision finale.",
        },
        {
          title: "4. Définir le résultat attendu",
          description: "Associez à chaque action un livrable concret, une échéance réaliste, un critère de réalisation et une preuve minimale qui n’ajoute pas de donnée personnelle inutile.",
        },
        {
          title: "5. Planifier la revue",
          description: "Programmez un point de suivi et les déclencheurs de révision : nouvel outil, changement de finalité, incident, nouvelle population concernée, documentation fournisseur ou évolution officielle.",
        },
      ],
      demonstration: {
        title: "Démonstration : organiser les 90 premiers jours d’une PME",
        introduction: "La PME des modules précédents utilise un assistant de rédaction et étudie un outil de classement de candidatures. Le plan distingue les actions internes immédiates de celles qui exigent une validation spécialisée.",
        columns: ["Horizon", "Action et résultat attendu", "Pilotage, validation et trace"],
        rows: [
          [
            "Sous 30 jours",
            "Suspendre l’étude du classement de candidatures et réunir la finalité, la documentation et le processus de décision.",
            "Pilotage RH ; validations juridique, données et métier ; décision et sources datées conservées.",
          ],
          [
            "Sous 30 jours",
            "Formaliser les usages autorisés et interdits de l’assistant de rédaction, avec validation humaine avant diffusion.",
            "Pilotage métier avec sécurité et données ; règle interne versionnée et diffusée par fonction.",
          ],
          [
            "Sous 60 jours",
            "Réaliser l’acculturation adaptée des utilisateurs et tester une situation fictive de contrôle et d’arrêt.",
            "Pilotage formation ; objectifs, support, date et réalisation conservés sans score nominatif inutile.",
          ],
          [
            "Sous 90 jours",
            "Revoir l’inventaire, les incidents, les questions ouvertes et les changements de sources officielles.",
            "Pilotage désigné ; compte rendu court, décisions actualisées et nouvelle date de revue.",
          ],
        ],
      },
      professionalExample: {
        title: "Exemple commenté : remplacer une promesse de conformité par un plan pilotable",
        unsafeRequest: "« Produis notre plan de conformité AI Act complet, certifie que toutes nos obligations sont couvertes et attribue automatiquement les responsabilités. »",
        saferRequest: "« À partir de constats vérifiés et d’informations génériques, aide-moi à préparer une feuille de route à 30, 60 et 90 jours. Pour chaque action, indique la priorité, la justification, la fonction pilote, les validations nécessaires, le livrable, l’échéance, le critère de réalisation, la preuve minimale et le déclencheur de révision. Distingue les décisions internes des points à faire confirmer et ne conclus pas à la conformité. »",
        analysis: [
          "La seconde demande utilise les faits disponibles et conserve les inconnues au lieu de les combler.",
          "Chaque priorité produit un livrable, un responsable par fonction et une trace contrôlable.",
          "Les sujets sensibles sont transmis aux compétences appropriées au lieu d’être tranchés automatiquement par l’IA.",
        ],
      },
      commonMistakes: [
        "Créer une liste très longue sans priorité, responsable, échéance ni résultat attendu.",
        "Commencer par rédiger une charte générale alors qu’un usage potentiellement interdit ou sensible doit d’abord être suspendu et vérifié.",
        "Présenter une feuille de route produite par l’IA comme une preuve suffisante de conformité juridique.",
        "Utiliser une échéance réglementaire non datée sans vérifier la source officielle et les éventuelles modifications du calendrier.",
      ],
      takeaways: [
        "Le plan transforme les constats des trois premiers modules en actions limitées, attribuées et vérifiables.",
        "L’ordre des priorités dépend des effets, de l’urgence, des inconnues et des échéances applicables à chaque usage.",
        "Une fonction pilote coordonne ; les validations compétentes restent nécessaires lorsque le sujet dépasse son rôle.",
        "Les traces et les revues rendent la démarche pilotable sans promettre une conformité automatique.",
      ],
    },
  },
];

const aiActExercises = [
  {
    id: 1,
    title: "Cartographier les usages de l'IA",
    objective: 'Module 1 · Usages, acteurs et premiers repères',
    instructions: "Travaillez sur un à trois usages réels décrits avec des termes génériques, ou sur des situations réalistes. N’insérez aucune donnée personnelle, sensible ou confidentielle dans un service public d’IA. Cette cartographie prépare l’analyse et ne constitue pas une qualification juridique.",
    howTo: [
      "Choisissez un à trois usages précis : tâche réalisée, résultat produit et action effectuée après ce résultat.",
      "Remplacez les éléments entre crochets avec des informations génériques et indiquez « inconnu » lorsqu’un fait n’est pas vérifié.",
      "Contrôlez la grille proposée : corrigez les acteurs, retirez les suppositions et complétez la supervision humaine réellement prévue.",
      "Conservez la grille, les questions ouvertes, les sources consultées avec leur date et les fonctions qui devront confirmer les points sensibles.",
    ],
    successCriteria: [
      "Chaque usage est décrit par une finalité, un résultat et une action suffisamment précis.",
      "Le fournisseur, le rôle possible de l’organisation, les utilisateurs et les personnes concernées sont distingués sans conclusion hâtive.",
      "Les catégories de données, les effets possibles et la validation humaine sont indiqués sans donnée réelle ni information confidentielle.",
      "Les informations inconnues, les sources à consulter et les points à faire confirmer sont clairement conservés.",
    ],
    prompt: `Je prépare une cartographie factuelle des usages de l’IA dans une organisation. Cette cartographie ne constitue pas une analyse juridique.

Contexte général :
- secteur ou activité : [secteur] ;
- taille ou type de structure : [information générique] ;
- usage à étudier : [tâche, résultat produit et action réalisée ensuite] ;
- outil ou service : [nom si vérifié, sinon « inconnu »].

Construis un tableau avec les colonnes suivantes :
1. usage et finalité ;
2. système ou service utilisé ;
3. fournisseur identifié ou à confirmer ;
4. rôle possible de l’organisation, à confirmer ;
5. fonctions utilisatrices ;
6. personnes concernées par le résultat ;
7. catégories de données, sans aucune donnée réelle ;
8. résultat produit et action qu’il prépare ;
9. décision ou validation humaine ;
10. premier point de vigilance ;
11. information, source ou responsable à consulter.

Règles :
- n’invente ni fait, ni contrat, ni source ;
- écris « inconnu » lorsqu’une information manque ;
- ne conclus pas que l’usage est conforme ou qu’il relève d’une catégorie juridique ;
- signale les points à faire valider par une personne compétente.

Termine par cinq questions de clarification et une courte liste des vérifications à conserver avec leur date.`,
  },
  {
    id: 2,
    title: 'Effectuer un premier tri des risques',
    objective: 'Module 2 · Premier tri et orientation',
    instructions: "Analysez un cas fictif ou entièrement anonymisé pour repérer les signaux de vigilance et choisir la prochaine vérification. N’utilisez aucune donnée réelle. L’exercice ne produit ni qualification juridique, ni décision de conformité.",
    howTo: [
      'Choisissez un cas fictif et décrivez sa finalité, son résultat, les personnes concernées et la décision ou l’action qu’il prépare.',
      'Complétez les éléments entre crochets et écrivez « inconnu » pour chaque information non vérifiée.',
      'Contrôlez le tableau obtenu : séparez les faits, les signaux possibles et les conclusions qui exigent une expertise.',
      'Conservez la suite choisie, les questions à transmettre, les sources officielles consultées avec leur date et la fonction chargée de valider.',
    ],
    successCriteria: [
      'Le cas décrit clairement la finalité, les personnes concernées, le résultat produit et son influence sur une action ou une décision.',
      'Les signaux possibles de pratique interdite, de haut risque ou de transparence sont repérés sans être présentés comme une qualification définitive.',
      'Les données, les droits, la supervision humaine, les possibilités de correction et les conditions d’arrêt sont examinés.',
      'La prochaine action, les questions à transmettre et les sources à vérifier sont justifiées et traçables.',
    ],
    prompt: `Je réalise un premier tri pédagogique d’un usage fictif de l’IA. Je ne cherche ni avis juridique, ni décision de conformité.

Cas à étudier :
- finalité prévue : [objectif précis] ;
- secteur ou activité : [contexte] ;
- utilisateurs : [fonctions] ;
- personnes concernées : [public générique] ;
- catégories de données : [sans donnée réelle] ;
- résultat produit : [contenu, recommandation, score ou décision] ;
- action ou décision préparée : [conséquence possible] ;
- supervision humaine : [contrôle, responsable et possibilité de corriger] ;
- informations inconnues : [liste].

Construis un tableau avec :
1. fait connu ;
2. information manquante ;
3. effet possible sur une personne ou une activité ;
4. signal éventuel de pratique interdite, de haut risque, de transparence ou d’autre vigilance ;
5. contrôle humain et protection des données à examiner ;
6. question à transmettre ;
7. fonction ou expertise à consulter.

Règles :
- ne déduis aucune information absente ;
- ne classe pas juridiquement le système et ne déclare pas l’usage conforme ;
- explique pourquoi chaque signal doit être vérifié dans le contexte exact ;
- n’invente ni article, ni source, ni lien ;
- distingue l’AI Act des autres règles pouvant s’appliquer.

Termine par une orientation argumentée parmi ces quatre suites :
A. suspendre le projet en attendant une vérification compétente ;
B. demander une analyse spécialisée avant de poursuivre ;
C. préciser la transparence, les données et les contrôles humains ;
D. poursuivre uniquement une expérimentation limitée, réversible et sous validation humaine.

Ajoute la liste des questions, des sources officielles et des dates de consultation à conserver comme trace.`,
  },
  {
    id: 3,
    title: "Construire un plan d'acculturation",
    objective: 'Module 3 · Publics, actions et preuves',
    instructions: "Préparez un plan adapté aux fonctions et aux usages recensés. Utilisez uniquement des catégories de fonctions et des situations génériques : aucun nom, score individuel, donnée personnelle ou information confidentielle ne doit être transmis.",
    howTo: [
      "Choisissez trois groupes de fonctions liés à des usages réels ou réalistes : occasionnels, réguliers et responsables ou superviseurs.",
      "Complétez le contexte avec des informations génériques, puis reliez chaque groupe à un ou plusieurs usages précis.",
      "Vérifiez que les compétences, activités, règles d’arrêt et preuves proposées sont différentes lorsque les responsabilités ou les risques le justifient.",
      "Conservez le plan daté, les sources officielles consultées, la version des supports et les événements qui déclencheront une actualisation.",
    ],
    successCriteria: [
      "Chaque groupe de fonctions est relié à des usages, responsabilités et risques clairement identifiés.",
      "Les objectifs décrivent ce que les personnes devront comprendre, appliquer, vérifier et savoir interrompre.",
      "Les activités, formats et accompagnements sont proportionnés au niveau initial et au contexte, sans programme uniforme imposé.",
      "Les preuves minimales, les responsables, les échéances et les conditions d’actualisation sont définis sans collecte de données inutile.",
    ],
    prompt: `Je prépare un plan interne de maîtrise de l’IA adapté aux usages de mon organisation. Ce plan ne constitue pas une preuve automatique de conformité.

Contexte générique :
- type et taille de structure : [information générique] ;
- secteur ou activité : [secteur] ;
- rôle possible de l’organisation : [fournisseur, déployeur ou à confirmer] ;
- systèmes et usages recensés : [liste sans donnée confidentielle] ;
- principaux risques et personnes concernées : [description générique] ;
- règles et ressources déjà disponibles : [éléments vérifiés] ;
- fonction chargée de coordonner le plan : [fonction, sans nom].

Distingue au minimum :
1. utilisateurs occasionnels ;
2. utilisateurs réguliers ;
3. responsables de déploiement, superviseurs ou fonctions support.

Pour chaque groupe, construis un tableau indiquant :
- les usages concernés ;
- les connaissances ou expériences déjà supposées, à confirmer ;
- les compétences à acquérir ;
- les possibilités, limites et risques à comprendre ;
- les règles d’utilisation, de vérification et d’arrêt ;
- l’activité proposée et son format ;
- l’accompagnement ou la ressource disponible ;
- la preuve minimale à conserver ;
- le responsable par fonction ;
- l’échéance et le déclencheur d’actualisation.

Règles :
- n’invente ni obligation, ni article, ni exigence de certificat ;
- ne demande aucun nom, score individuel ou donnée personnelle inutile ;
- adapte le plan aux usages et aux risques au lieu de proposer le même programme à tous ;
- distingue les faits vérifiés des décisions restant à confirmer ;
- indique que les sources officielles doivent être consultées et datées.

Termine par :
1. une action prioritaire réalisable sous 30 jours ;
2. cinq traces internes proportionnées à conserver ;
3. trois événements imposant une mise à jour du plan ;
4. les questions à transmettre aux fonctions compétentes.`,
  },
  {
    id: 4,
    title: "Construire une feuille de route 30-60-90 jours",
    objective: "Module 4 · Priorités, responsabilités et suivi",
    instructions: "Travaillez à partir d’un cas fictif ou d’informations entièrement génériques. N’insérez aucun nom, contrat, incident détaillé, donnée personnelle, information confidentielle ou documentation non autorisée dans un service public d’IA.",
    howTo: [
      "Rassemblez les constats des exercices précédents et séparez les faits vérifiés, les inconnues, les signaux de vigilance et les décisions déjà prises.",
      "Complétez le modèle, puis répartissez les actions entre les horizons de 30, 60 et 90 jours en justifiant leur ordre.",
      "Contrôlez chaque ligne : une fonction pilote, les validations nécessaires, un livrable, un critère de réalisation, une échéance et une preuve minimale doivent apparaître.",
      "Vérifiez les dates dans les sources officielles, ajoutez leur date de consultation et faites valider les sujets juridiques, techniques, sociaux, métiers ou relatifs aux données par les fonctions compétentes.",
    ],
    successCriteria: [
      "Les priorités découlent clairement des effets possibles, de l’urgence, des informations manquantes et des échéances applicables.",
      "Les actions potentiellement interdites ou sensibles sont suspendues ou transmises avant les améliorations secondaires.",
      "Chaque action possède un pilote par fonction, des validations identifiées, un livrable observable et une échéance réaliste.",
      "Les preuves, sources datées, points de revue et déclencheurs d’actualisation permettent un suivi sans collecte de données inutile ni promesse de conformité.",
    ],
    prompt: `Je prépare une feuille de route pédagogique à 30, 60 et 90 jours pour encadrer des usages de l’IA. Cette feuille de route ne constitue ni un avis juridique, ni une déclaration de conformité.

Contexte générique :
- type de structure et secteur : [informations génériques] ;
- usages recensés : [finalités et résultats produits] ;
- rôle possible de l’organisation : [fournisseur, déployeur ou à confirmer] ;
- personnes concernées et effets possibles : [description générique] ;
- catégories de données : [sans donnée réelle] ;
- contrôles humains existants : [faits vérifiés] ;
- signaux de vigilance : [pratique interdite, haut risque, transparence, données, sécurité ou autre] ;
- actions d’acculturation prévues : [groupes et objectifs] ;
- décisions prises et informations inconnues : [liste distincte] ;
- fonctions disponibles pour piloter ou valider : [fonctions, sans nom].

Commence par séparer dans un tableau :
1. les faits vérifiés ;
2. les informations inconnues ;
3. les risques ou échéances à confirmer ;
4. la fonction ou la source officielle à consulter.

Construis ensuite une feuille de route avec les colonnes suivantes :
- horizon : sous 30 jours, sous 60 jours, sous 90 jours ou suivi continu ;
- priorité et justification ;
- action commençant par un verbe ;
- usage concerné ;
- fonction pilote ;
- fonctions à consulter ou validation nécessaire ;
- livrable attendu ;
- critère de réalisation ;
- échéance ;
- preuve minimale à conserver ;
- source officielle et date de consultation ;
- déclencheur de révision ;
- statut proposé.

Règles :
- traite d’abord les signaux d’interdiction, les effets importants, les données sensibles et les échéances proches ;
- ne déduis aucun fait absent et écris « à confirmer » lorsque nécessaire ;
- n’invente ni article, ni obligation, ni date, ni responsabilité ;
- ne déclare pas l’organisation ou un usage conforme ;
- distingue une action interne d’un avis juridique, technique, social, métier ou relatif aux données ;
- ne demande aucune donnée personnelle ou confidentielle inutile ;
- limite la feuille de route à huit actions réellement pilotables.

Termine par :
1. les trois actions à lancer en premier et leur justification ;
2. les décisions qui exigent une validation spécialisée ;
3. un ordre du jour de revue de 30 minutes ;
4. cinq questions permettant de vérifier que le plan reste à jour.`,
  },
];

const aiActFinalProject = {
  title: "Analyser un usage d’IA et présenter une feuille de route proportionnée",
  description: "En 45 minutes, le participant consolide les travaux des quatre modules à partir d’un usage fictif, réaliste ou décrit uniquement avec des informations génériques.",
  learnerGuidance: "Le formateur n’attend pas une analyse juridique ni une déclaration de conformité. Il évalue votre capacité à décrire les faits, repérer les vigilances, organiser l’acculturation, proposer des actions réalistes et identifier les validations nécessaires.",
  steps: [
    "Décrire l’usage, sa finalité, les acteurs, les personnes concernées, les données et la supervision humaine",
    "Réaliser un premier tri des vigilances et séparer les faits, les inconnues et les points à faire confirmer",
    "Proposer des objectifs et des actions d’acculturation adaptés aux fonctions concernées",
    "Construire une feuille de route à 30, 60 et 90 jours avec priorités, responsables et preuves minimales",
    "Présenter les limites du travail, les sources officielles datées et les validations spécialisées encore nécessaires",
  ],
  deliverables: [
    "La cartographie factuelle de l’usage et des acteurs",
    "Le premier tri des vigilances et les questions à faire confirmer",
    "Le plan d’acculturation adapté aux fonctions",
    "La feuille de route à 30, 60 et 90 jours",
  ],
  submissionFields: [
    {
      id: 'prompt_and_iterations',
      label: "1. Cartographie de l’usage et des acteurs",
      help: "Décrivez l’usage, sa finalité, le résultat produit, le rôle possible de l’organisation, les fonctions utilisatrices, les personnes concernées, les catégories de données et la validation humaine.",
      placeholder: "Exemple : assistant préparant des brouillons de réponses ; organisation potentiellement déployeur ; données fictives ; relecture obligatoire avant tout envoi…",
    },
    {
      id: 'final_output',
      label: "2. Premier tri et points à confirmer",
      help: "Présentez les signaux de vigilance, les informations inconnues, la suite prudente choisie et les fonctions ou expertises qui devront confirmer l’analyse.",
      placeholder: "Exemple : transparence à vérifier ; conditions du fournisseur inconnues ; contrôle des données par la fonction compétente ; aucune qualification juridique automatique…",
    },
    {
      id: 'verification_grid_reference',
      label: "3. Plan d’acculturation adapté",
      help: "Indiquez les groupes de fonctions, les compétences attendues, les activités proposées, les règles d’arrêt, les preuves minimales et les déclencheurs d’actualisation.",
      placeholder: "Exemple : sensibilisation courte pour les utilisateurs occasionnels ; atelier de contrôle pour les utilisateurs réguliers ; support versionné et revue lors d’un changement d’outil…",
    },
    {
      id: 'action_plan',
      label: "4. Feuille de route 30-60-90 jours",
      help: "Présentez les actions prioritaires, leur justification, la fonction pilote, les validations, les livrables, les échéances, les sources datées et les points de revue.",
      placeholder: "Exemple : sous 30 jours, formaliser les usages autorisés ; pilotage métier, validations données et sécurité ; règle versionnée et revue sous 60 jours…",
    },
  ],
  criteria: [
    "Précision de la cartographie de l’usage, des acteurs, des données et des effets possibles",
    "Pertinence du premier tri, des questions ouvertes et de l’orientation proposée",
    "Adaptation de l’acculturation, des contrôles et de la supervision humaine",
    "Caractère réaliste, traçable et actualisable de la feuille de route",
  ],
  rubricLevels: [
    {
      id: 'not_acquired',
      label: 'Non acquis',
      help: "Les éléments indispensables sont absents ou une situation sensible est traitée sans contrôle suffisant.",
    },
    {
      id: 'developing',
      label: "En cours d'acquisition",
      help: "La démarche est engagée, mais des faits, protections, responsabilités ou validations restent à préciser.",
    },
    {
      id: 'acquired',
      label: 'Acquis',
      help: "La méthode attendue est appliquée et les limites ainsi que les validations nécessaires sont clairement indiquées.",
    },
    {
      id: 'mastered',
      label: 'Maîtrisé',
      help: "La démarche est hiérarchisée, argumentée, proportionnée et peut être adaptée avec autonomie à une situation proche.",
    },
  ],
  rubric: [
    {
      id: 'need_and_audience',
      criterion: "Cartographie de l’usage et des acteurs",
      descriptors: {
        not_acquired: "La finalité, les acteurs, les personnes concernées, les données ou la supervision humaine ne sont pas identifiés.",
        developing: "L’usage est compréhensible, mais plusieurs acteurs, effets, catégories de données ou contrôles restent imprécis.",
        acquired: "La finalité, le résultat, les acteurs, les personnes concernées, les données et la supervision humaine sont décrits avec des faits vérifiables.",
        mastered: "La cartographie distingue clairement les faits et les inconnues, justifie le périmètre choisi et prépare une analyse adaptée à une situation proche.",
      },
    },
    {
      id: 'prompt_and_success_criteria',
      criterion: "Premier tri et orientation",
      descriptors: {
        not_acquired: "Les vigilances sont ignorées ou une conclusion juridique est affirmée sans information ni validation suffisante.",
        developing: "Quelques vigilances sont repérées, mais les faits, les inconnues, les effets ou la suite à donner restent partiellement distingués.",
        acquired: "Les signaux de vigilance, les informations manquantes et les effets possibles sont distingués ; une suite prudente et les validations nécessaires sont justifiées.",
        mastered: "Les priorités sont hiérarchisées avec recul, les autres règles applicables sont repérées et l’orientation est argumentée sans dépasser les faits disponibles.",
      },
    },
    {
      id: 'checks_and_risks',
      criterion: "Acculturation, contrôles et protection",
      descriptors: {
        not_acquired: "Les actions sont identiques pour tous, les données ne sont pas protégées ou aucun contrôle humain et aucune règle d’arrêt ne sont prévus.",
        developing: "Des actions et contrôles existent, mais ils restent peu adaptés aux fonctions, aux usages, aux risques ou aux besoins d’actualisation.",
        acquired: "Les compétences, activités, contrôles, règles d’arrêt, protections et preuves sont adaptés aux fonctions et aux usages sans collecte inutile.",
        mastered: "Les mesures sont proportionnées, articulées avec l’accompagnement et conçues pour évoluer selon les incidents, les outils, les usages et les sources officielles.",
      },
    },
    {
      id: 'choices_and_limits',
      criterion: "Feuille de route, responsabilités et limites",
      descriptors: {
        not_acquired: "Le plan ne permet pas d’identifier les priorités, les responsables, les livrables ou les validations nécessaires.",
        developing: "Le plan contient des actions, mais leur ordre, leur justification, leurs échéances, leurs preuves ou leurs responsables restent incomplets.",
        acquired: "Les actions à 30, 60 et 90 jours sont limitées, justifiées, attribuées et reliées à des livrables, échéances, preuves, sources datées et revues.",
        mastered: "La feuille de route anticipe les conditions d’arrêt et de révision, explique ses limites et permet un pilotage autonome sans promettre une conformité automatique.",
      },
    },
  ],
  validationRule: "Le cas pratique final est validé lorsque les quatre critères atteignent au minimum le niveau « Acquis ». Le niveau « Maîtrisé » valorise une autonomie supplémentaire sans être obligatoire. Si un critère reste « Non acquis » ou « En cours d’acquisition », le formateur précise les éléments à reprendre avant une nouvelle remise.",
};

const aiActGlossary = [
  {
    term: 'Action corrective',
    definition: "Mesure prise pour supprimer une non-conformité, réduire un risque ou empêcher qu’un problème identifié se reproduise.",
    example: "Suspendre un outil, corriger son paramétrage et former les utilisateurs après la découverte d’un usage non autorisé.",
  },
  {
    term: 'AI Act',
    definition: "Nom courant du règlement européen sur l’intelligence artificielle, qui encadre certains acteurs, systèmes et usages selon leurs risques.",
    example: "Une organisation consulte le texte et les lignes directrices applicables à son usage au lieu de se fier uniquement au nom de l’outil.",
  },
  {
    term: 'Analyse d’impact relative à la protection des données',
    definition: "Démarche prévue par le RGPD pour étudier un traitement susceptible d’engendrer un risque élevé pour les droits et libertés des personnes.",
    example: "Avant un traitement de données sensibles à grande échelle, le délégué à la protection des données vérifie si une analyse d’impact est nécessaire.",
  },
  {
    term: 'Anonymisation',
    definition: "Transformation qui empêche durablement d’identifier une personne, directement ou par recoupement raisonnable. Retirer seulement le nom ne suffit pas toujours.",
    example: "Un cas d’exercice est entièrement reconstruit avec des informations fictives plutôt que simplement privé du nom du client.",
  },
  {
    term: 'Autorité nationale compétente',
    definition: "Autorité désignée pour participer à l’application, au contrôle ou à la surveillance du règlement selon les missions prévues.",
    example: "La fonction juridique vérifie quelle autorité et quelle procédure concernent réellement un incident au lieu d’inventer un destinataire.",
  },
  {
    term: "Base de données de l’Union européenne",
    definition: "Registre européen dans lequel certaines informations sur des systèmes d’IA à haut risque doivent être enregistrées dans les situations prévues.",
    example: "Une autorité publique vérifie l’enregistrement requis avant d’utiliser un système qualifié à haut risque.",
  },
  {
    term: 'Biais',
    definition: "Tendance d’un système ou de ses résultats à produire des écarts, déséquilibres ou traitements défavorables liés notamment aux données, aux choix de conception ou au contexte.",
    example: "Une équipe compare les résultats pour plusieurs profils fictifs afin de repérer un écart injustifié avant toute utilisation.",
  },
  {
    term: 'Contenu généré ou manipulé par une IA',
    definition: "Texte, image, son ou vidéo produit ou modifié par un système d’IA et pouvant relever d’exigences de transparence selon son usage.",
    example: "Avant de publier une image artificielle, le service communication vérifie si elle doit être identifiée comme générée par une IA.",
  },
  {
    term: 'Cybersécurité',
    definition: "Mesures destinées à protéger un système, ses données et ses accès contre les attaques, altérations, fuites ou utilisations non autorisées.",
    example: "L’accès à l’outil est limité aux comptes autorisés et les incidents de sécurité suivent la procédure interne.",
  },
  {
    term: 'Déployeur',
    definition: "Personne ou organisation qui utilise un système d’IA sous sa propre autorité dans un cadre professionnel ou institutionnel.",
    example: "Une entreprise qui met un assistant d’IA à disposition de ses salariés examine son rôle possible de déployeur pour cet usage.",
  },
  {
    term: 'Donnée à caractère personnel',
    definition: "Information se rapportant à une personne identifiée ou identifiable, directement ou indirectement.",
    example: "Une adresse électronique professionnelle nominative reste une donnée personnelle et ne doit pas être transmise sans base et outil appropriés.",
  },
  {
    term: 'Évaluation de conformité',
    definition: "Procédure permettant de vérifier si les exigences applicables à un système sont respectées avant sa mise sur le marché ou sa mise en service, selon le cas.",
    example: "Le fournisseur d’un système à haut risque détermine la procédure applicable ; le client ne remplace pas cette analyse par un simple questionnaire commercial.",
  },
  {
    term: 'Évaluation d’impact sur les droits fondamentaux',
    definition: "Analyse exigée pour certains déployeurs et certains systèmes à haut risque afin d’étudier les personnes concernées, les risques, la supervision et les mesures prévues.",
    example: "Une entité concernée décrit le processus, les publics affectés et les recours avant le premier déploiement, avec les expertises appropriées.",
  },
  {
    term: 'Exactitude',
    definition: "Capacité d’un système à produire le niveau de résultats corrects attendu pour sa finalité et son contexte d’utilisation.",
    example: "Le taux d’erreur est mesuré sur des cas représentatifs et les résultats importants restent contrôlés par une personne compétente.",
  },
  {
    term: 'Finalité prévue',
    definition: "Usage auquel le fournisseur destine le système, avec son contexte et ses conditions, tels qu’ils sont décrits dans les informations et la documentation disponibles.",
    example: "Utiliser un outil prévu pour classer des documents afin d’évaluer des candidats constitue un changement d’usage à examiner avant tout test.",
  },
  {
    term: 'Fournisseur',
    definition: "Acteur qui développe ou fait développer un système ou un modèle d’IA et le commercialise ou le met en service sous son nom ou sa marque.",
    example: "L’éditeur qui propose le système sous sa marque fournit la documentation utile et examine les obligations liées à son rôle.",
  },
  {
    term: 'Gouvernance des données',
    definition: "Organisation des règles, responsabilités et contrôles concernant la collecte, la qualité, l’accès, l’utilisation et la conservation des données.",
    example: "La structure définit quelles catégories de données peuvent être utilisées, par qui, dans quel outil et pendant combien de temps.",
  },
  {
    term: 'Incident grave',
    definition: "Événement ou dysfonctionnement produisant ou susceptible de produire certaines conséquences graves définies par le règlement.",
    example: "Un dommage important ou une atteinte grave aux droits déclenche l’escalade interne et la vérification des obligations de signalement applicables.",
  },
  {
    term: "Instructions d’utilisation",
    definition: "Informations fournies pour expliquer notamment la finalité prévue, le bon usage, les capacités, les limites et les mesures de supervision du système.",
    example: "Le responsable lit les instructions avant le déploiement et transforme les limites utiles en consignes compréhensibles pour les utilisateurs.",
  },
  {
    term: 'Journalisation',
    definition: "Enregistrement automatique ou organisé d’événements utiles pour suivre le fonctionnement d’un système et retrouver certaines actions ou anomalies.",
    example: "Les journaux disponibles permettent de retrouver la date d’un résultat et l’intervention humaine, dans le respect des règles de conservation.",
  },
  {
    term: "Maîtrise de l'IA",
    definition: "Compétences, connaissances et compréhension permettant un usage éclairé des systèmes d’IA et une conscience adaptée de leurs possibilités et risques.",
    example: "Un utilisateur sait ce que l’outil peut faire, quelles données il ne doit pas saisir, quels contrôles réaliser et quand arrêter l’usage.",
  },
  {
    term: "Modèle d’IA à usage général",
    definition: "Modèle capable d’accomplir de nombreuses tâches et pouvant être intégré dans différents systèmes ou applications.",
    example: "Un même modèle peut servir à produire du texte, résumer ou analyser, tandis que chaque application ajoute son interface et son contexte d’usage.",
  },
  {
    term: 'Opérateur',
    definition: "Terme regroupant plusieurs acteurs de la chaîne, notamment fournisseur, déployeur, importateur, distributeur, représentant autorisé ou fabricant concerné.",
    example: "Avant d’attribuer une obligation, l’organisation identifie le rôle exact qu’elle exerce pour le système étudié.",
  },
  {
    term: 'Personne concernée',
    definition: "Personne physique sur laquelle l’utilisation d’un système ou de son résultat peut produire un effet, même si elle n’utilise pas elle-même l’outil.",
    example: "Le candidat évalué par un processus assisté par IA est concerné même si seul le service des ressources humaines manipule le système.",
  },
  {
    term: 'Pratique interdite',
    definition: "Usage de l’IA interdit lorsque les conditions précises prévues par le règlement sont réunies.",
    example: "Un signal d’analyse des émotions au travail impose de suspendre le projet et de faire vérifier le cas avant toute utilisation.",
  },
  {
    term: 'Preuve proportionnée',
    definition: "Trace limitée à ce qui est utile pour montrer une action, une décision, une source ou une validation, sans collecter d’information excessive.",
    example: "Le registre conserve la fonction formée, l’objectif, la date et la version du support, sans score nominatif inutile.",
  },
  {
    term: 'Risque',
    definition: "Combinaison entre la probabilité qu’un préjudice survienne et la gravité de ce préjudice.",
    example: "Une erreur sans conséquence et une erreur pouvant priver une personne d’un droit ne demandent pas le même niveau de contrôle.",
  },
  {
    term: 'Robustesse',
    definition: "Capacité d’un système à maintenir un fonctionnement approprié face aux erreurs, variations, perturbations ou situations raisonnablement prévisibles.",
    example: "L’équipe teste des entrées incomplètes et vérifie que le système signale l’incertitude plutôt que de produire une conclusion trompeuse.",
  },
  {
    term: 'Supervision humaine',
    definition: "Mesures permettant à une personne compétente de comprendre suffisamment le système, surveiller ses résultats et intervenir ou arrêter l’usage lorsque nécessaire.",
    example: "Une personne autorisée relit le résultat, peut l’ignorer ou le corriger et connaît la procédure d’escalade en cas de doute.",
  },
  {
    term: "Système d'IA",
    definition: "Système automatisé qui déduit, à partir des données reçues et d’objectifs explicites ou implicites, comment produire des prédictions, contenus, recommandations ou décisions.",
    example: "Un outil qui recommande des candidatures et influence le tri ne s’analyse pas comme un simple fichier de calcul statique.",
  },
  {
    term: "Système d'IA à haut risque",
    definition: "Système relevant des catégories et conditions prévues par le règlement et soumis à des exigences renforcées. La qualification dépend de la finalité et du contexte.",
    example: "Un outil utilisé pour influencer l’accès à l’emploi demande une analyse précise du système et du processus ; le mot « recrutement » ne suffit pas seul à conclure.",
  },
  {
    term: 'Traçabilité',
    definition: "Possibilité de retrouver les informations utiles sur un usage, une source, une version, un contrôle et une décision au fil du temps.",
    example: "La fiche indique la version de l’outil, la date de contrôle, la source consultée et la fonction ayant validé la suite.",
  },
  {
    term: 'Transparence',
    definition: "Informations permettant de comprendre qu’une IA est utilisée et, selon le cas, d’identifier ses capacités, limites, conditions d’emploi ou contenus générés.",
    example: "Un visiteur est clairement informé qu’il échange avec un assistant automatisé et sait comment contacter une personne.",
  },
  {
    term: 'Usage abusif raisonnablement prévisible',
    definition: "Utilisation différente de la finalité prévue mais pouvant résulter d’un comportement humain ou d’une interaction que l’on peut raisonnablement anticiper.",
    example: "Un outil de rédaction interne risque d’être utilisé pour envoyer directement des réponses ; la règle et l’interface doivent prévenir cet usage prévisible.",
  },
];

const aiActQuiz = [
  {
    id: 'inventory',
    domain: 'uses_and_roles',
    question: "Votre structure dispose-t-elle d'un inventaire des outils et usages de l'IA ?",
    answers: [
      { label: 'Non', score: 0 },
      { label: 'Inventaire partiel ou informel', score: 1 },
      { label: 'Oui, il est documenté et actualisé', score: 2 },
    ],
  },
  {
    id: 'actors',
    domain: 'uses_and_roles',
    question: "Pour chaque usage, les rôles du fournisseur, de votre structure et des utilisateurs sont-ils identifiés ?",
    answers: [
      { label: 'Non, ces rôles ne sont pas distingués', score: 0 },
      { label: 'Pour certains outils seulement', score: 1 },
      { label: 'Oui, les rôles sont décrits et les inconnues sont signalées', score: 2 },
    ],
  },
  {
    id: 'effects',
    domain: 'uses_and_roles',
    question: "Les résultats produits par l’IA et leurs effets possibles sur les personnes ou les décisions sont-ils décrits ?",
    answers: [
      { label: 'Pas encore', score: 0 },
      { label: 'Pour les usages considérés comme sensibles', score: 1 },
      { label: 'Oui, avec la décision humaine et les personnes concernées', score: 2 },
    ],
  },
  {
    id: 'rules',
    domain: 'vigilance_and_controls',
    question: "Des règles internes encadrent-elles l'utilisation de l'IA ?",
    answers: [
      { label: 'Aucune règle identifiée', score: 0 },
      { label: 'Des recommandations existent', score: 1 },
      { label: 'Une charte ou une procédure est diffusée', score: 2 },
    ],
  },
  {
    id: 'risk_triage',
    domain: 'vigilance_and_controls',
    question: "Savez-vous repérer un signal de pratique interdite, de haut risque ou d’obligation de transparence ?",
    answers: [
      { label: 'Non, ces catégories restent difficiles à distinguer', score: 0 },
      { label: 'Je reconnais quelques situations, sans méthode formalisée', score: 1 },
      { label: 'Oui, avec une procédure d’orientation vers la fonction compétente', score: 2 },
    ],
  },
  {
    id: 'data',
    domain: 'vigilance_and_controls',
    question: "Les données personnelles et confidentielles sont-elles prises en compte avant l'emploi d'un outil d'IA ?",
    answers: [
      { label: 'Pas systématiquement', score: 0 },
      { label: 'Une vigilance existe, sans processus formel', score: 1 },
      { label: 'Oui, avec un processus et des responsables identifiés', score: 2 },
    ],
  },
  {
    id: 'human_oversight',
    domain: 'vigilance_and_controls',
    question: "La supervision humaine et les situations imposant de corriger, suspendre ou rejeter un résultat sont-elles définies ?",
    answers: [
      { label: 'Non', score: 0 },
      { label: 'Une relecture est généralement prévue, sans règle d’arrêt', score: 1 },
      { label: 'Oui, les contrôles, responsables et conditions d’arrêt sont connus', score: 2 },
    ],
  },
  {
    id: 'literacy',
    domain: 'literacy_and_action',
    question: "Les personnes qui utilisent l'IA ont-elles été sensibilisées à ses limites et à ses risques ?",
    answers: [
      { label: 'Pas encore', score: 0 },
      { label: 'Pour une partie des utilisateurs', score: 1 },
      { label: 'Oui, selon leurs fonctions et leurs usages', score: 2 },
    ],
  },
  {
    id: 'responsibility',
    domain: 'literacy_and_action',
    question: "Une personne ou une fonction pilote-t-elle les sujets liés à l'IA ?",
    answers: [
      { label: 'Non', score: 0 },
      { label: 'Le rôle est en cours de définition', score: 1 },
      { label: 'Oui, les responsabilités sont connues', score: 2 },
    ],
  },
  {
    id: 'action_plan',
    domain: 'literacy_and_action',
    question: "Votre structure dispose-t-elle d’un plan d’action daté pour encadrer et actualiser ses usages de l’IA ?",
    answers: [
      { label: 'Non', score: 0 },
      { label: 'Quelques actions sont prévues, sans suivi commun', score: 1 },
      { label: 'Oui, avec priorités, responsables, échéances et points de revue', score: 2 },
    ],
  },
];

const promptLevelOneModules = [
  {
    id: 'cadrer-besoin',
    number: 1,
    duration: '1 h 15',
    title: 'Cadrer le besoin et construire un prompt professionnel',
    summary: 'Transformer une demande vague en consigne claire, contrôlable et adaptée à une situation professionnelle.',
    goals: [
      'Définir le résultat concret attendu avant de rédiger le prompt',
      'Sélectionner le contexte utile sans transmettre de donnée inappropriée',
      'Formuler des contraintes, un format et des critères de réussite observables',
    ],
    keyPoints: [
      'Un prompt professionnel est une consigne de travail, pas une formule magique',
      'Objectif, contexte, public, informations autorisées, contraintes et format attendu',
      'Critères de réussite et questions de clarification avant la production',
    ],
    activity: 'Structurer une demande d’e-mail professionnel, la tester puis repérer les informations qui doivent encore être précisées.',
    exerciseId: 1,
    lesson: {
      introduction: [
        "Un prompt professionnel décrit le travail à réaliser et les conditions qui permettront de vérifier le résultat. Une phrase comme « Rédige un e-mail » laisse trop de décisions à l’IA : elle ne connaît ni votre objectif, ni votre destinataire, ni les informations qui doivent absolument apparaître.",
        "La qualité ne dépend pas du nombre de mots ou d’une formule secrète. Elle repose sur un besoin bien cadré, des informations autorisées et des critères simples. Le premier résultat reste une proposition à relire, tester et améliorer avant toute utilisation.",
      ],
      video: {
        title: 'Capsule : rédiger un bon prompt',
        description: 'Cette courte démonstration introduit les éléments essentiels d’une consigne structurée. Utilisez ensuite la méthode ci-dessous pour les appliquer à votre propre situation.',
        url: serverControlledPromptEngineeringVideoUrl,
      },
      concepts: [
        {
          title: 'Besoin professionnel',
          description: 'La situation réelle à traiter, le résultat recherché et l’action qui sera réalisée après la réponse.',
        },
        {
          title: 'Prompt professionnel',
          description: 'Une consigne qui précise le travail, les informations utiles, les limites et la forme du résultat attendu.',
        },
        {
          title: 'Critère de réussite',
          description: 'Un point observable qui permet de contrôler le résultat, par exemple la présence d’une date, un ton adapté ou une longueur maximale.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Nommer le résultat attendu',
          description: 'Commencez par un verbe d’action et un livrable précis : rédiger un e-mail, préparer un plan ou produire un tableau comparatif.',
        },
        {
          title: '2. Décrire le contexte et le public',
          description: 'Précisez la situation, le destinataire, son niveau de connaissance et l’action attendue après la lecture.',
        },
        {
          title: '3. Sélectionner les informations autorisées',
          description: 'Transmettez uniquement les faits nécessaires et retirez les données personnelles, sensibles ou confidentielles qui ne sont pas indispensables.',
        },
        {
          title: '4. Fixer les contraintes et le format',
          description: 'Indiquez le ton, la longueur, la structure, les éléments obligatoires et ceux qui doivent être évités.',
        },
        {
          title: '5. Définir les contrôles',
          description: 'Ajoutez des critères de réussite et demandez à l’IA de poser des questions lorsqu’une information essentielle manque.',
        },
      ],
      demonstration: {
        title: 'Démonstration : préparer un e-mail de confirmation',
        introduction: 'Une assistante doit confirmer un rendez-vous à un client. Elle construit sa consigne progressivement, sans transmettre de donnée personnelle inutile.',
        columns: ['Élément', 'Information donnée', 'Utilité pour le résultat'],
        rows: [
          [
            'Objectif',
            'Confirmer un rendez-vous et obtenir une réponse en cas d’indisponibilité.',
            'Le message poursuit une action précise au lieu de produire un texte générique.',
          ],
          [
            'Public et contexte',
            'Client déjà informé oralement ; ton professionnel, cordial et direct.',
            'Le vocabulaire et le niveau de détail peuvent être adaptés au destinataire.',
          ],
          [
            'Contraintes et format',
            'Objet explicite, trois paragraphes courts, date fictive, appel à l’action final.',
            'La réponse possède une structure directement contrôlable.',
          ],
          [
            'Contrôle',
            'Ne rien inventer et poser jusqu’à trois questions si une information manque.',
            'Les éléments absents sont signalés au lieu d’être complétés de façon hasardeuse.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : passer d’une demande vague à une consigne exploitable',
        unsafeRequest: '« Écris-moi un mail professionnel pour mon client. »',
        saferRequest: '« Rédige un e-mail destiné à un client pour confirmer un rendez-vous fixé au 22 septembre à 14 h. Utilise un ton cordial et direct, un objet explicite et trois paragraphes courts. Termine en demandant au destinataire de signaler toute indisponibilité. N’ajoute aucune information absente et pose-moi une question si un élément indispensable manque. »',
        analysis: [
          'Le résultat attendu et l’action demandée au destinataire sont explicites.',
          'Le ton, la structure et la longueur peuvent être vérifiés facilement.',
          'La consigne interdit l’invention et prévoit une clarification en cas de manque.',
        ],
      },
      commonMistakes: [
        'Commencer par attribuer un rôle à l’IA sans définir le résultat concret attendu.',
        'Ajouter beaucoup de contexte sans distinguer les informations utiles des données à protéger.',
        'Demander un résultat « professionnel » sans préciser le public, le ton ou le format.',
        'Accepter la première réponse sans la comparer à des critères définis à l’avance.',
      ],
      takeaways: [
        'Un prompt professionnel part du besoin et du livrable attendu.',
        'Le contexte doit être utile, autorisé et limité au strict nécessaire.',
        'Les contraintes et critères rendent le résultat vérifiable.',
        'Une question de clarification vaut mieux qu’une information inventée.',
      ],
    },
  },
  {
    id: 'ancrer-source',
    number: 2,
    duration: '1 h 15',
    title: 'Ancrer la réponse dans une source et produire une synthèse vérifiable',
    summary: 'Obtenir une synthèse fidèle sans laisser l’IA inventer, déduire ou masquer les informations absentes.',
    goals: [
      'Délimiter clairement la source que l’IA est autorisée à utiliser',
      'Distinguer les faits, les décisions, les actions et les points à confirmer',
      'Comparer la synthèse au document d’origine avant de l’utiliser',
    ],
    keyPoints: [
      'Une réponse fluide ne garantit ni l’exactitude ni l’exhaustivité',
      'La source doit être identifiable, autorisée et séparée des consignes',
      'Les informations absentes doivent être signalées plutôt que complétées',
    ],
    activity: 'Produire la synthèse structurée d’une note fictive ou non confidentielle, puis contrôler chaque information importante dans la source.',
    exerciseId: 2,
    lesson: {
      introduction: [
        "Une IA peut résumer rapidement un document, mais elle peut aussi simplifier une réserve importante, confondre une proposition avec une décision ou compléter une information manquante. Une synthèse agréable à lire n’est donc pas nécessairement fidèle.",
        "Pour garder le contrôle, le prompt doit délimiter la source autorisée, préciser les catégories attendues et imposer une règle simple : ce qui n’est pas présent dans le document doit être signalé comme absent. La synthèse reste ensuite à comparer au texte d’origine.",
      ],
      concepts: [
        {
          title: 'Source de référence',
          description: 'Le document autorisé qui contient les informations utilisables. Il doit être clairement séparé des consignes données à l’IA.',
        },
        {
          title: 'Fidélité',
          description: 'Le résultat conserve le sens, les réserves et les informations importantes sans ajouter ni transformer un élément de la source.',
        },
        {
          title: 'Point à confirmer',
          description: 'Une information absente, ambiguë ou incomplète qui doit être vérifiée par une personne au lieu d’être déduite par l’IA.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Définir l’usage de la synthèse',
          description: 'Précisez le destinataire, ce qu’il doit comprendre et la décision ou l’action que la synthèse doit préparer.',
        },
        {
          title: '2. Préparer une source autorisée',
          description: 'Utilisez un document fictif ou non confidentiel, retirez les données inutiles et placez le texte entre des balises clairement nommées.',
        },
        {
          title: '3. Définir les catégories attendues',
          description: 'Demandez de séparer les faits, les décisions, les actions, les responsables, les échéances et les points à confirmer.',
        },
        {
          title: '4. Interdire les compléments inventés',
          description: 'Exigez la mention « non précisé » lorsqu’une information manque et demandez que les ambiguïtés restent visibles.',
        },
        {
          title: '5. Vérifier dans le document',
          description: 'Retrouvez chaque fait, décision et échéance dans la source, puis corrigez les omissions ou reformulations qui changent le sens.',
        },
      ],
      demonstration: {
        title: 'Démonstration : contrôler une synthèse de réunion',
        introduction: 'À partir d’une note fictive, le formateur montre comment classer chaque information et repérer ce que la source ne permet pas d’affirmer.',
        columns: ['Élément de la source', 'Classement attendu', 'Contrôle à effectuer'],
        rows: [
          [
            '« La réunion a eu lieu le 12 septembre. »',
            'Fait établi.',
            'Conserver la date exacte sans en déduire la durée ou les participants.',
          ],
          [
            '« L’équipe valide l’envoi d’une version simplifiée. »',
            'Décision.',
            'Ne pas transformer cette décision en simple proposition.',
          ],
          [
            '« Préparer la nouvelle version avant le 18 septembre. »',
            'Action avec échéance.',
            'Indiquer que le responsable n’est pas précisé dans la source.',
          ],
          [
            'Aucune information sur le budget.',
            'Point à confirmer.',
            'Écrire « budget non précisé » au lieu de proposer un montant.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : empêcher l’ajout d’informations absentes',
        unsafeRequest: '« Résume ce document et complète les informations qui manquent pour que ce soit professionnel. »',
        saferRequest: '« Utilise uniquement le texte placé entre les balises <source>. Sépare les faits, les décisions, les actions et les points à confirmer. N’ajoute aucune information. Lorsqu’un responsable, une date ou un montant manque, écris “non précisé”. Termine par trois vérifications à effectuer dans le document d’origine. »',
        analysis: [
          'La source autorisée et les catégories de sortie sont clairement définies.',
          'Les informations absentes restent visibles au lieu d’être complétées.',
          'La vérification humaine dans le document d’origine est prévue avant utilisation.',
        ],
      },
      commonMistakes: [
        'Demander un résumé sans préciser son destinataire ni son usage.',
        'Mélanger la source, les consignes et des commentaires personnels dans un même bloc.',
        'Supposer qu’un texte plus court conserve automatiquement toutes les réserves importantes.',
        'Contrôler uniquement le style sans retrouver les faits, décisions et échéances dans la source.',
      ],
      takeaways: [
        'Une synthèse fiable utilise une source clairement délimitée et autorisée.',
        'Les faits, décisions et actions ne doivent pas être confondus.',
        'Une information absente doit rester absente ou être signalée comme à confirmer.',
        'La validation finale consiste à comparer le résultat au document d’origine.',
      ],
    },
  },
  {
    id: 'adapter-publics',
    number: 3,
    duration: '1 h 30',
    title: 'Adapter un contenu à différents publics sans perdre le sens',
    summary: 'Faire varier le vocabulaire, les exemples et le niveau de détail tout en conservant les informations essentielles.',
    goals: [
      'Décrire les besoins et le niveau de connaissance de chaque public',
      'Adapter la forme d’un contenu sans modifier son message principal',
      'Comparer deux versions à partir de critères explicites',
    ],
    keyPoints: [
      'Adapter ne signifie ni appauvrir ni ajouter des informations absentes',
      'Le vocabulaire, les exemples, la longueur et l’action attendue dépendent du public',
      'Les faits, les réserves et les messages essentiels doivent rester stables',
    ],
    activity: 'Produire deux versions d’une même explication pour un débutant et un professionnel, puis comparer les choix de vocabulaire, d’exemples et de profondeur.',
    exerciseId: 3,
    lesson: {
      introduction: [
        "Un contenu utile à une personne débutante ne se présente pas comme un contenu destiné à un professionnel expérimenté. Le premier public a besoin de repères, de mots expliqués et d’un exemple concret ; le second peut attendre davantage de précision, de conditions et de vocabulaire métier.",
        "L’adaptation ne doit toutefois pas changer le sens. Les faits, les limites et les informations importantes restent identiques. Le prompt sert à faire varier la forme, le niveau de détail et les exemples, puis la comparaison des deux versions permet de vérifier que le message principal a été conservé.",
      ],
      concepts: [
        {
          title: 'Public cible',
          description: 'Le groupe précis qui recevra le contenu, avec son niveau de connaissance, ses besoins et l’action attendue après la lecture.',
        },
        {
          title: 'Niveau de langage',
          description: 'Le choix des mots, la longueur des phrases et la quantité de vocabulaire technique adaptés au lecteur.',
        },
        {
          title: 'Message invariant',
          description: 'L’idée, le fait ou la règle qui doit rester identique dans toutes les versions, même lorsque la présentation change.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Définir le message à conserver',
          description: 'Identifiez les faits, les réserves et les trois idées qui doivent apparaître dans toutes les versions.',
        },
        {
          title: '2. Décrire chaque public',
          description: 'Précisez son niveau de connaissance, son contexte, son besoin et ce qu’il devra comprendre ou savoir faire.',
        },
        {
          title: '3. Choisir les adaptations utiles',
          description: 'Décidez du vocabulaire, de la longueur, du type d’exemple et du niveau de détail adaptés à chaque public.',
        },
        {
          title: '4. Produire les deux versions',
          description: 'Demandez une structure comparable afin de pouvoir observer facilement les différences et les informations conservées.',
        },
        {
          title: '5. Comparer avec des critères',
          description: 'Vérifiez la fidélité du message, la clarté, l’utilité de l’exemple et l’adaptation du vocabulaire pour chaque public.',
        },
      ],
      demonstration: {
        title: 'Démonstration : expliquer l’authentification à deux facteurs',
        introduction: 'Le même sujet est présenté à une personne qui découvre l’outil et à un professionnel chargé d’accompagner son déploiement.',
        columns: ['Dimension', 'Public débutant', 'Public professionnel'],
        rows: [
          [
            'Objectif',
            'Comprendre pourquoi une seconde vérification protège le compte.',
            'Expliquer le principe et préparer les conditions d’accompagnement des utilisateurs.',
          ],
          [
            'Vocabulaire',
            '« Deuxième preuve » et exemple du code reçu sur un appareil.',
            '« Facteur de possession », modalités d’activation et solutions de récupération.',
          ],
          [
            'Exemple',
            'Connexion à une messagerie depuis un nouvel ordinateur.',
            'Déploiement auprès d’une équipe avec procédure en cas de perte du second facteur.',
          ],
          [
            'Vérification',
            'Le lecteur peut expliquer l’intérêt avec ses propres mots.',
            'Le lecteur peut identifier les étapes, les risques et les points d’assistance.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : préciser les différences attendues entre deux versions',
        unsafeRequest: '« Explique l’authentification à deux facteurs en version simple et en version experte. »',
        saferRequest: '« Explique l’authentification à deux facteurs à deux publics : une personne débutante qui doit l’activer et un responsable qui doit accompagner son équipe. Conserve dans les deux versions le principe, le bénéfice et la limite principale. Adapte le vocabulaire, l’exemple et le niveau de détail. Termine chaque version par une question permettant de vérifier la compréhension. »',
        analysis: [
          'Les deux publics et les actions qu’ils doivent réaliser sont précisés.',
          'Le message invariant empêche de supprimer une information essentielle.',
          'Les éléments à adapter et la vérification finale sont observables.',
        ],
      },
      commonMistakes: [
        'Décrire un public uniquement par son métier sans préciser son niveau ni son besoin.',
        'Confondre langage accessible et suppression des limites ou réserves importantes.',
        'Ajouter des détails techniques non présents dans la source pour rendre la version professionnelle plus longue.',
        'Comparer seulement la longueur des versions sans vérifier le sens, l’exemple et l’action attendue.',
      ],
      takeaways: [
        'Une adaptation réussie commence par un public et une action attendue clairement définis.',
        'La forme varie, mais les faits, limites et messages essentiels restent stables.',
        'Un exemple pertinent dépend du contexte réel du lecteur.',
        'La comparaison des versions permet de vérifier la fidélité autant que la clarté.',
      ],
    },
  },
  {
    id: 'concevoir-activite-pedagogique',
    number: 4,
    duration: '1 h',
    title: 'Concevoir une activité pédagogique observable et adaptable',
    summary: 'Utiliser l’IA pour préparer une activité cohérente tout en laissant au formateur la validation du contenu, de la durée et des adaptations.',
    goals: [
      'Formuler un objectif pédagogique observable adapté au public et à la durée',
      'Aligner les consignes, la production attendue, la correction et les critères d’évaluation',
      'Contrôler la faisabilité, les sources et les adaptations proposées avant l’animation',
    ],
    keyPoints: [
      'Une activité utile fait agir l’apprenant et produit une trace que le formateur peut observer',
      'L’objectif, l’activité, la production attendue et l’évaluation doivent mesurer la même compétence',
      'L’IA peut proposer une trame, mais le formateur valide le contenu, le rythme, la correction et l’accessibilité',
    ],
    activity: 'Concevoir une activité courte sur une compétence maîtrisée, tester son alignement pédagogique puis corriger un point de faisabilité ou d’évaluation.',
    exerciseId: 4,
    lesson: {
      introduction: [
        "Une ressource pédagogique ne se résume pas à une fiche bien présentée. Elle doit aider un public précis à réaliser une action, dans un temps donné, et permettre au formateur d’observer ce qui a été compris ou produit.",
        "Une IA peut accélérer la préparation d’une activité, mais elle peut proposer un déroulé trop long, supposer des prérequis inexistants ou inventer une correction. Le formateur reste responsable des contenus, des sources, de la faisabilité et des adaptations nécessaires pour les apprenants.",
      ],
      concepts: [
        {
          title: 'Objectif observable',
          description: 'Une compétence formulée avec une action que l’apprenant devra réaliser et que le formateur pourra constater dans une production.',
        },
        {
          title: 'Alignement pédagogique',
          description: 'La cohérence entre l’objectif annoncé, l’activité demandée, la production attendue, la correction et les critères d’évaluation.',
        },
        {
          title: 'Preuve d’apprentissage',
          description: 'La trace concrète produite pendant l’activité, par exemple un document annoté, une procédure expliquée ou une réalisation contrôlable.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Cadrer la situation de formation',
          description: 'Précisez le public, ses prérequis, la modalité, la durée disponible, les outils autorisés et les besoins d’adaptation déjà connus.',
        },
        {
          title: '2. Formuler une action observable',
          description: 'Décrivez ce que l’apprenant devra savoir faire à la fin avec un verbe d’action, des conditions de réalisation et un résultat vérifiable.',
        },
        {
          title: '3. Concevoir une production cohérente',
          description: 'Demandez une activité dans laquelle l’apprenant agit réellement et remet une trace directement liée à l’objectif.',
        },
        {
          title: '4. Préparer la correction et les critères',
          description: 'Définissez les éléments attendus, les erreurs acceptables et quatre critères permettant au formateur de justifier son appréciation.',
        },
        {
          title: '5. Simuler puis valider le déroulé',
          description: 'Vérifiez les temps, les consignes, le matériel, les sources et les adaptations avant d’utiliser la ressource avec un groupe.',
        },
      ],
      demonstration: {
        title: 'Démonstration : préparer une activité sur les e-mails suspects',
        introduction: 'Le formateur construit une activité courte à partir d’un message entièrement fictif et vérifie que chaque élément permet d’observer la compétence annoncée.',
        columns: ['Élément', 'Proposition pédagogique', 'Contrôle du formateur'],
        rows: [
          [
            'Objectif',
            'Repérer trois indices de vigilance dans un e-mail fictif et justifier la décision prise.',
            'Le verbe « repérer » et la justification produisent une action observable.',
          ],
          [
            'Activité',
            'Annoter individuellement le message, puis comparer les indices en binôme.',
            'La durée et la constitution des binômes doivent être compatibles avec le groupe.',
          ],
          [
            'Production attendue',
            'Une copie annotée, trois indices expliqués et une décision argumentée.',
            'La trace permet de retrouver les éléments réellement observés par l’apprenant.',
          ],
          [
            'Correction et adaptation',
            'Corrigé commenté fondé sur la source ; version textuelle structurée et temps supplémentaire si l’aménagement retenu le prévoit.',
            'Le formateur vérifie la source et confirme l’adaptation avec la personne concernée selon le cadre prévu.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : passer d’une idée d’activité à un scénario contrôlable',
        unsafeRequest: '« Crée une activité ludique sur les e-mails frauduleux pour des débutants. »',
        saferRequest: '« Conçois une activité de 30 minutes pour des adultes débutants. À la fin, ils devront repérer dans un e-mail fictif trois indices de vigilance et justifier leur décision. Utilise uniquement les informations de référence fournies. Prévois les étapes minutées, la production attendue, un corrigé commenté, quatre critères observables et une variante d’accessibilité à faire valider par le formateur. Signale toute information manquante au lieu de l’inventer. »',
        analysis: [
          'Le public, la durée et l’action observable limitent les propositions trop générales.',
          'La production, le corrigé et les critères permettent d’observer la même compétence.',
          'Les sources et adaptations restent soumises à une validation humaine explicite.',
        ],
      },
      commonMistakes: [
        'Utiliser un verbe vague comme « comprendre » sans préciser ce que l’apprenant devra produire.',
        'Ajouter trop d’étapes pour le temps disponible ou supposer des outils et prérequis non vérifiés.',
        'Évaluer la présentation du livrable alors que l’objectif porte sur une autre compétence.',
        'Reprendre une correction, une règle ou une adaptation proposée par l’IA sans validation du formateur.',
      ],
      takeaways: [
        'Une activité pédagogique part d’une compétence et d’une action observables.',
        'La production attendue constitue une preuve lorsque ses critères sont définis à l’avance.',
        'La correction doit s’appuyer sur des informations maîtrisées et des sources autorisées.',
        'La faisabilité et l’accessibilité se vérifient dans le contexte réel avant l’animation.',
      ],
    },
  },
  {
    id: 'cadrer-page-html',
    number: 5,
    duration: '45 min',
    title: 'Préparer le cahier des charges d’une page HTML accessible et responsive',
    summary: 'Décrire le public, les contenus, la structure et les contrôles d’une page avant de demander sa production technique.',
    goals: [
      'Transformer un besoin de page web en cahier des charges compréhensible et vérifiable',
      'Organiser les contenus et l’action principale selon les besoins du public',
      'Prévoir des contrôles simples d’accessibilité, d’affichage mobile et de validation avant diffusion',
    ],
    keyPoints: [
      'Le besoin, les contenus et l’arborescence se valident avant la production du code',
      'Une page responsive hiérarchise les informations pour rester utilisable sur un écran étroit comme sur un ordinateur',
      'Un code généré doit être relu, affiché et testé ; une réponse techniquement plausible ne garantit pas une page accessible',
    ],
    activity: 'Préparer le cahier des charges d’une page d’information simple, valider son arborescence puis contrôler les tests manuels proposés.',
    exerciseId: 5,
    lesson: {
      introduction: [
        "Il n’est pas nécessaire de savoir programmer pour décrire correctement une page web. Avant de parler de code, il faut savoir à qui la page s’adresse, ce que la personne doit trouver, quelle action elle doit pouvoir réaliser et quels contenus sont réellement disponibles.",
        "Une IA peut proposer rapidement une arborescence ou du code HTML et CSS. Elle peut aussi inventer un contenu, oublier un état d’erreur ou produire une page difficile à utiliser au clavier ou sur téléphone. Une étape de validation entre le cahier des charges et la production limite ces écarts.",
      ],
      concepts: [
        {
          title: 'Cahier des charges',
          description: 'Le document qui décrit le public, l’objectif, les contenus, les sections, les interactions, les contraintes et les contrôles attendus.',
        },
        {
          title: 'Structure sémantique',
          description: 'Une organisation logique de la page avec un titre principal, des sections clairement nommées et des éléments utilisés selon leur fonction.',
        },
        {
          title: 'Affichage responsive',
          description: 'Une mise en page qui adapte l’ordre, l’espace et la présentation des contenus à différentes largeurs d’écran sans perdre d’information essentielle.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Définir le public et l’action principale',
          description: 'Précisez ce que la personne vient chercher et l’action prioritaire qu’elle doit pouvoir réaliser sans hésitation.',
        },
        {
          title: '2. Fournir les contenus autorisés',
          description: 'Listez les textes, informations et médias disponibles, leur source et les éléments encore manquants sans demander à l’IA de les inventer.',
        },
        {
          title: '3. Organiser l’arborescence',
          description: 'Définissez les sections dans un ordre logique, un seul titre principal et des intitulés qui permettent de comprendre la page rapidement.',
        },
        {
          title: '4. Décrire les contraintes d’usage',
          description: 'Prévoyez l’affichage sur écran étroit, la navigation au clavier, les libellés explicites, les alternatives aux images et les messages utiles.',
        },
        {
          title: '5. Valider avant de produire et tester',
          description: 'Corrigez le cahier des charges, autorisez ensuite la production si elle est utile, puis contrôlez la page dans plusieurs situations réelles.',
        },
      ],
      demonstration: {
        title: 'Démonstration : cadrer une page présentant un atelier',
        introduction: 'Une page fictive doit permettre à un adulte débutant de comprendre un atelier de bureautique et de contacter l’organisme sans transmettre de donnée inutile.',
        columns: ['Décision', 'Choix dans le cahier des charges', 'Contrôle à effectuer'],
        rows: [
          [
            'Besoin principal',
            'Comprendre le contenu, la durée et les prérequis avant de demander des informations.',
            'Ces informations doivent être repérables avant l’action de contact.',
          ],
          [
            'Arborescence',
            'Titre, résumé, compétences visées, programme, informations pratiques, accessibilité et contact.',
            'Chaque section répond à une question réelle du public et possède un intitulé explicite.',
          ],
          [
            'Affichage étroit',
            'Une seule colonne ; informations essentielles et action principale présentées dans un ordre logique.',
            'Le texte reste lisible et aucun contenu important ne nécessite un défilement horizontal.',
          ],
          [
            'Accessibilité',
            'Titres hiérarchisés, lien de contact explicite, focus visible et alternative pertinente pour l’image informative.',
            'Parcourir la page au clavier et vérifier les textes, les liens, les images et les contrastes.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : imposer une validation avant le code',
        unsafeRequest: '« Fais une belle page HTML moderne pour présenter mon atelier. »',
        saferRequest: '« Prépare d’abord le cahier des charges d’une page destinée à des adultes débutants qui souhaitent comprendre un atelier et contacter l’organisme. Utilise uniquement les contenus fournis. Propose l’arborescence, l’ordre sur écran étroit, les interactions et les contrôles d’accessibilité. Liste les éléments à confirmer, puis attends ma validation avant de produire du code. »',
        analysis: [
          'Le public, son besoin et l’action principale guident la structure de la page.',
          'Les contenus manquants restent visibles au lieu d’être complétés automatiquement.',
          'La pause de validation permet de corriger les choix avant une production plus coûteuse à reprendre.',
        ],
      },
      commonMistakes: [
        'Demander immédiatement du code sans avoir validé le contenu, le public et l’action principale.',
        'Décrire seulement les couleurs ou le style sans préciser la hiérarchie des informations.',
        'Considérer qu’une page réduite visuellement est automatiquement utilisable sur téléphone.',
        'Diffuser un code généré sans tester le clavier, les liens, les libellés, les images et plusieurs largeurs d’écran.',
      ],
      takeaways: [
        'Le cahier des charges transforme une idée générale en décisions contrôlables.',
        'L’arborescence et l’ordre des contenus dépendent du public et de son action principale.',
        'L’accessibilité et l’affichage mobile se prévoient avant la production technique.',
        'Le code reste une proposition à afficher, tester, corriger et valider avant diffusion.',
      ],
    },
  },
  {
    id: 'organiser-processus-controle',
    number: 6,
    duration: '45 min',
    title: 'Construire un processus de travail contrôlé et réutilisable',
    summary: 'Décomposer une tâche en étapes simples, chacune associée à un résultat attendu, des critères et une validation humaine.',
    goals: [
      'Décomposer une tâche professionnelle en trois à cinq étapes compréhensibles',
      'Définir pour chaque étape les entrées, le résultat, les critères et le contrôle humain',
      'Créer des prompts réutilisables avec des variables et des conditions d’arrêt explicites',
    ],
    keyPoints: [
      'Au Niveau 1, un workflow est un enchaînement manuel de prompts et de contrôles, pas une automatisation technique',
      'Seul un résultat vérifié peut devenir l’entrée de l’étape suivante',
      'Une décision métier, une donnée sensible, un envoi ou une publication exige une intervention humaine',
    ],
    activity: 'Construire puis tester un processus de trois à cinq étapes pour un livrable récurrent, repérer un point de rupture et améliorer le workflow.',
    exerciseId: 6,
    lesson: {
      introduction: [
        "Un prompt unique peut produire rapidement un livrable, mais il devient difficile de comprendre où une erreur est apparue. En séparant le cadrage, l’extraction des informations, la rédaction et la vérification, chaque résultat peut être contrôlé avant de poursuivre.",
        "Dans cette formation, un workflow désigne simplement une méthode de travail organisée. L’apprenant déclenche chaque étape, vérifie le résultat et décide de continuer, de corriger ou de s’arrêter. Il ne s’agit pas de connecter des outils ni d’automatiser une action externe.",
      ],
      concepts: [
        {
          title: 'Entrée et résultat',
          description: 'L’entrée contient les informations autorisées nécessaires à une étape ; le résultat est la production précise qui devra être vérifiée.',
        },
        {
          title: 'Point de validation',
          description: 'Le moment où une personne compare le résultat aux critères et choisit de poursuivre, de corriger ou d’arrêter le processus.',
        },
        {
          title: 'Condition d’arrêt',
          description: 'Une règle qui interdit de continuer lorsqu’une source manque, qu’une donnée ne peut pas être transmise ou qu’une décision dépasse le rôle de l’IA.',
        },
      ],
      guidedSteps: [
        {
          title: '1. Définir le livrable final',
          description: 'Précisez son destinataire, son usage, son format et les critères qui permettront de décider qu’il est prêt.',
        },
        {
          title: '2. Recenser les entrées autorisées',
          description: 'Listez les sources nécessaires, leur propriétaire, les données à retirer et les informations qui devront rester vérifiables.',
        },
        {
          title: '3. Découper le travail',
          description: 'Créez trois à cinq étapes dont chacune poursuit un seul objectif et produit une sortie identifiable.',
        },
        {
          title: '4. Ajouter les contrôles et arrêts',
          description: 'Associez à chaque sortie des critères, une validation humaine et les situations dans lesquelles le processus ne doit pas continuer.',
        },
        {
          title: '5. Tester et documenter une correction',
          description: 'Utilisez un cas fictif, repérez l’étape qui produit un écart puis améliorez uniquement le prompt ou le contrôle concerné.',
        },
      ],
      demonstration: {
        title: 'Démonstration : préparer un compte rendu à partir de notes fictives',
        introduction: 'Le formateur montre comment quatre étapes courtes rendent les erreurs plus faciles à repérer qu’une demande unique de compte rendu final.',
        columns: ['Étape', 'Résultat attendu', 'Validation avant de poursuivre'],
        rows: [
          [
            '1. Cadrer',
            'Usage, destinataire, format et source autorisée clairement identifiés.',
            'Retirer les données inutiles et signaler les informations manquantes.',
          ],
          [
            '2. Extraire',
            'Tableau séparant faits, décisions, actions, responsables et échéances.',
            'Retrouver chaque élément dans les notes et écrire « non précisé » si nécessaire.',
          ],
          [
            '3. Rédiger',
            'Brouillon conforme au format et au public définis.',
            'Vérifier que le texte ne transforme ni une hypothèse en fait, ni une proposition en décision.',
          ],
          [
            '4. Finaliser',
            'Version corrigée accompagnée de la checklist complétée.',
            'Une personne autorisée approuve la diffusion ; l’IA n’envoie pas le document.',
          ],
        ],
      },
      professionalExample: {
        title: 'Exemple commenté : remplacer une demande globale par des étapes validées',
        unsafeRequest: '« Transforme mes notes clients en compte rendu définitif et envoie-le aux participants. »',
        saferRequest: '« Aide-moi à préparer un compte rendu à partir de notes fictives en quatre étapes : cadrage, extraction, rédaction et vérification. Pour chaque étape, indique l’entrée autorisée, le résultat, les critères et la validation humaine. Arrête-toi si une information manque ou si une donnée ne doit pas être transmise. Aucun envoi ni aucune publication ne doit être effectué. »',
        analysis: [
          'Chaque étape produit une trace qui peut être comparée à la source ou aux critères.',
          'Les informations absentes et les données à protéger déclenchent un arrêt au lieu d’être ignorées.',
          'La décision de diffuser et l’action d’envoi restent entièrement humaines.',
        ],
      },
      commonMistakes: [
        'Créer un très long prompt qui mélange cadrage, production, contrôle et diffusion.',
        'Transmettre un résultat non vérifié à l’étape suivante et propager ainsi une erreur.',
        'Réutiliser un modèle contenant encore des données personnelles ou confidentielles du cas précédent.',
        'Confondre processus guidé et automatisation d’une décision, d’un envoi ou d’une publication.',
      ],
      takeaways: [
        'Un processus contrôlé transforme une tâche complexe en petites décisions vérifiables.',
        'Chaque étape possède une entrée, un résultat, des critères et un responsable de la validation.',
        'Les variables rendent les prompts réutilisables sans conserver les données du cas précédent.',
        'Une condition d’arrêt protège mieux qu’une correction effectuée trop tard dans le processus.',
      ],
    },
  },
];

const promptLevelOneExercises = [
  {
    id: 1,
    title: 'Passer d’une demande vague à une consigne exploitable',
    objective: 'Objectif, contexte et résultat attendu',
    instructions: 'Choisissez une situation professionnelle simple et non confidentielle. Conservez votre demande initiale, testez sa version structurée puis analysez les écarts observés.',
    howTo: [
      'Écrivez d’abord la demande vague que vous auriez spontanément adressée à l’IA, sans ajouter de donnée personnelle ou confidentielle.',
      'Personnalisez chaque champ du modèle et définissez trois critères qui permettront de vérifier le résultat.',
      'Testez la consigne, répondez aux éventuelles questions de clarification puis conservez le résultat obtenu.',
      'Comparez le résultat avec vos trois critères, repérez au moins un écart et rédigez une amélioration ciblée du prompt.',
    ],
    successCriteria: [
      'L’objectif, le destinataire et l’action attendue sont formulés sans ambiguïté.',
      'Les informations transmises sont utiles, autorisées et ne contiennent aucune donnée personnelle ou confidentielle inutile.',
      'Le format, les contraintes et trois critères de réussite peuvent être contrôlés dans le résultat.',
      'La réponse enregistrée présente la demande initiale, le prompt structuré, le résultat testé et au moins une amélioration justifiée.',
    ],
    prompt: `Je souhaite rédiger un e-mail professionnel.

Objectif : [indiquer le résultat recherché].
Contexte : [préciser la situation utile].
Destinataire : [fonction, niveau de connaissance et attentes].
Informations autorisées : [faits ou éléments non confidentiels que l’IA peut utiliser].
Contraintes : [ton, longueur, informations obligatoires et éléments à éviter].
Format attendu : [objet, formule d’appel, paragraphes, appel à l’action et signature].
Critères de réussite : [indiquer trois points observables permettant de contrôler le résultat].

Avant de rédiger, pose-moi jusqu’à trois questions si une information essentielle manque.`,
  },
  {
    id: 2,
    title: 'Créer une synthèse fidèle et vérifiable',
    objective: 'Données sources, structure et contrôle',
    instructions: 'Utilisez uniquement une courte source fictive ou explicitement autorisée. La synthèse doit pouvoir être contrôlée point par point dans le document d’origine.',
    howTo: [
      'Préparez une source courte contenant au moins un fait, une décision, une action et une information volontairement absente.',
      'Indiquez le destinataire et l’usage de la synthèse, puis placez la source entre les balises prévues sans ajouter de donnée personnelle ou confidentielle.',
      'Testez le prompt et vérifiez que le résultat sépare les faits, les décisions, les actions et les points à confirmer.',
      'Retrouvez chaque information importante dans la source, notez au moins un contrôle effectué et corrigez tout ajout, omission ou changement de sens.',
    ],
    successCriteria: [
      'La source utilisée est fictive ou autorisée, clairement délimitée et adaptée à l’exercice.',
      'Le destinataire, l’usage et le format de la synthèse sont explicitement indiqués.',
      'Les faits, décisions, actions et informations absentes sont distingués sans contenu inventé.',
      'La réponse enregistrée contient le prompt testé, la synthèse obtenue et la trace d’au moins un contrôle réalisé dans la source.',
    ],
    prompt: `À partir du texte placé entre <source> et </source>, produis une synthèse destinée à [public].

Usage de la synthèse : [informer, préparer une décision, organiser des actions ou autre usage précis].

<source>
[coller ici une courte source fictive ou explicitement autorisée]
</source>

Format attendu :
1. faits établis ;
2. décisions prises ;
3. actions à réaliser, avec responsable et échéance uniquement s’ils sont précisés ;
4. points à confirmer.

Contraintes :
- ne rien inventer ;
- conserver le sens et les réserves du document ;
- écrire « non précisé » lorsqu’une information attendue est absente ;
- signaler toute formulation ambiguë au lieu de la compléter ;
- terminer par une liste de vérifications à effectuer dans le document source.`,
  },
  {
    id: 3,
    title: 'Adapter un contenu à deux publics',
    objective: 'Audience, niveau et exemples',
    instructions: 'Choisissez un sujet professionnel que vous maîtrisez et définissez trois informations essentielles qui devront rester identiques dans les deux versions.',
    howTo: [
      'Choisissez un sujet non sensible que vous maîtrisez, puis notez trois faits, idées ou limites à conserver à partir d’informations fiables et non confidentielles.',
      'Décrivez les deux publics : leurs connaissances de départ, leur besoin et l’action qu’ils devront pouvoir réaliser après la lecture.',
      'Personnalisez le prompt, testez-le dans votre outil d’IA générative et conservez les deux versions obtenues.',
      'Comparez la fidélité du message, le vocabulaire, les exemples et le niveau de détail, puis corrigez au moins un écart constaté.',
    ],
    successCriteria: [
      'Les deux publics et les actions attendues sont distincts et décrits avec précision.',
      'Les trois informations essentielles apparaissent dans les deux versions, sans ajout inventé.',
      'Le vocabulaire, les exemples et le niveau de détail sont réellement adaptés sans modifier le sens.',
      'La réponse enregistrée contient le message invariant, le prompt testé, les deux versions, leur comparaison et au moins une amélioration justifiée.',
    ],
    prompt: `Sujet : [sujet].

Informations de référence autorisées :
- [fait ou idée essentielle 1] ;
- [fait ou idée essentielle 2] ;
- [limite ou réserve à conserver].

Public 1 : [profil débutant, besoin et action attendue].
Public 2 : [profil professionnel, niveau de connaissance et action attendue].

Pour chaque public, fournis :
1. une explication courte ;
2. un exemple adapté à son contexte ;
3. une erreur fréquente ;
4. une question de vérification ;
5. l’action à retenir.

Contraintes :
- conserver dans les deux versions les trois informations de référence ;
- ne rien inventer ;
- expliquer ou éviter le vocabulaire technique pour le public débutant ;
- préciser les conditions et limites utiles pour le public professionnel.

Termine par un tableau comparant le vocabulaire, l’exemple, le niveau de détail et le message conservé.`,
  },
  {
    id: 4,
    title: 'Construire une ressource pédagogique',
    objective: 'Scénario, activité et évaluation',
    instructions: 'Choisissez une compétence que vous maîtrisez et concevez une activité courte à partir d’informations fiables, autorisées et adaptées à votre public réel.',
    howTo: [
      'Décrivez le public, les prérequis, la modalité, la durée et l’action observable que l’apprenant devra réaliser.',
      'Préparez les informations de référence et les contraintes matérielles sans utiliser de donnée personnelle, sensible ou confidentielle.',
      'Personnalisez le prompt, testez-le puis vérifiez l’alignement entre l’objectif, les consignes, la production, le corrigé et les critères.',
      'Simulez le déroulé du point de vue d’un apprenant, corrigez au moins un problème de faisabilité ou d’évaluation et conservez les deux versions.',
    ],
    successCriteria: [
      'Le public, les prérequis, la durée, la modalité et l’objectif observable sont définis sans ambiguïté.',
      'L’activité fait produire une trace directement liée à la compétence annoncée et réalisable dans le temps prévu.',
      'Le corrigé ou les réponses attendues et les quatre critères permettent au formateur de justifier l’évaluation.',
      'La réponse enregistrée contient le prompt testé, la première proposition, le contrôle réalisé, une amélioration justifiée et les points restant à valider par le formateur.',
    ],
    prompt: `Conçois une activité pédagogique à partir des informations suivantes.

Compétence travaillée : [compétence].
Public : [profil, niveau et besoin].
Prérequis : [connaissances ou outils déjà maîtrisés].
Modalité : [présentiel, classe virtuelle ou autre modalité].
Durée totale : [durée].
Objectif observable : à la fin, l’apprenant sera capable de [verbe d’action et résultat attendu].
Informations de référence autorisées : [faits, procédure ou source fournie].
Matériel et outils disponibles : [liste].
Contraintes ou adaptations déjà validées : [éléments connus ou « aucune à ce stade »].

Propose :
1. un titre et un rappel de l’objectif ;
2. les étapes minutées pour le formateur et pour l’apprenant ;
3. des consignes prêtes à être données à l’apprenant ;
4. un exemple utilisant uniquement les informations de référence ;
5. la production attendue comme preuve de réalisation ;
6. un corrigé commenté ou les éléments de réponse attendus ;
7. quatre critères observables avec les indicateurs « acquis » et « à reprendre » ;
8. une variante d’accessibilité à confirmer avec le formateur et la personne concernée ;
9. une liste finale des points que le formateur doit valider avant l’animation.

Contraintes :
- l’activité doit être réalisable dans la durée indiquée ;
- ne rien inventer au-delà des informations de référence ;
- écrire « à confirmer par le formateur » lorsqu’une information manque ;
- ne créer aucune obligation réglementaire ou adaptation individuelle non validée ;
- ne demander aucune donnée personnelle, sensible ou confidentielle à l’apprenant.`,
  },
  {
    id: 5,
    title: 'Préparer une page HTML',
    objective: 'Spécification structurée avant production',
    instructions: 'Travaillez sur une page d’information simple, fictive ou fondée sur des contenus que vous êtes autorisé à utiliser. Validez son organisation avant toute production de code.',
    howTo: [
      'Définissez le sujet, le public, son besoin, l’action principale et les contenus de référence réellement disponibles.',
      'Personnalisez le prompt et demandez uniquement le cahier des charges, l’arborescence et les points à confirmer lors de la première réponse.',
      'Contrôlez l’ordre des contenus, l’affichage sur écran étroit, la navigation au clavier et les informations inventées, puis corrigez au moins un choix.',
      'Après validation, demandez le code si vous souhaitez poursuivre, affichez-le dans un environnement autorisé et notez les résultats des tests manuels.',
    ],
    successCriteria: [
      'Le public, son besoin, l’action principale et les contenus autorisés sont définis avec précision.',
      'L’arborescence hiérarchise les sections et indique l’ordre des contenus sur ordinateur et sur écran étroit.',
      'La première réponse s’arrête aux choix à valider et n’invente ni contenu, ni collecte de données, ni dépendance externe.',
      'La réponse enregistrée contient le prompt testé, l’arborescence proposée, le contrôle réalisé, une correction justifiée et les tests prévus ou effectués.',
    ],
    prompt: `Nous allons préparer une page HTML en deux phases. Ne produis aucun code pendant la première phase.

Sujet de la page : [sujet].
Public : [profil, niveau et besoin].
Objectif de la page : [ce que le public doit comprendre ou trouver].
Action principale attendue : [action].
Contenus de référence autorisés : [textes, faits et médias disponibles].
Sections obligatoires : [liste].
Identité visuelle disponible : [couleurs, typographies, logo ou « non précisée »].
Interactions prévues : [liens, boutons, formulaire ou « aucune »].
Dépendances externes autorisées : [liste ou « aucune »].
Données à ne pas collecter ou afficher : [liste].

Phase 1 — Cahier des charges :
1. reformule le besoin et pose jusqu’à cinq questions si une information essentielle manque ;
2. propose une arborescence avec un titre principal, les sections et leur ordre ;
3. précise pour chaque section son contenu, son utilité et l’action éventuelle ;
4. indique l’ordre et les priorités sur un écran étroit ;
5. décris les éléments interactifs et leur utilisation au clavier ;
6. prévois des libellés explicites, un focus visible, les alternatives utiles aux images et des contrastes à vérifier ;
7. termine par un tableau « élément / choix proposé / à confirmer » ;
8. attends ma validation explicite avant toute production de code.

Phase 2 — Uniquement après ma validation :
- produis un fichier HTML autonome avec un CSS simple et lisible ;
- utilise une structure sémantique et n’ajoute aucune dépendance non autorisée ;
- remplace toute information absente par « contenu à fournir » ;
- n’ajoute aucun suivi, aucune collecte ou aucun envoi de données non demandé ;
- fournis une liste de tests manuels : clavier, liens et boutons, titres et libellés, images, contrastes, écran étroit, ordinateur et absence de défilement horizontal.`,
  },
  {
    id: 6,
    title: 'Créer un workflow de production contrôlé',
    objective: 'Décomposition, critères et validation humaine',
    instructions: 'Choisissez une tâche professionnelle simple et récurrente. Construisez un processus manuel de trois à cinq étapes à partir d’informations fictives ou explicitement autorisées.',
    howTo: [
      'Décrivez le livrable final, son destinataire, son usage, les entrées autorisées et les limites à ne pas franchir.',
      'Personnalisez le prompt, obtenez le tableau du processus puis contrôlez l’ordre, les sorties, les critères et les conditions d’arrêt.',
      'Après validation du tableau, demandez les prompts réutilisables et testez chaque étape avec un cas fictif sans transmettre automatiquement le résultat suivant.',
      'Repérez au moins un écart, corrigez uniquement l’étape concernée et conservez le workflow initial, le test et la version améliorée.',
    ],
    successCriteria: [
      'Le processus comporte trois à cinq étapes ordonnées, chacune avec une entrée et un résultat clairement identifiés.',
      'Chaque étape possède des critères observables, une validation humaine et au moins une condition d’arrêt pertinente.',
      'Les prompts utilisent des variables explicites, limitent les données transmises et ne déclenchent aucune action externe.',
      'La réponse enregistrée contient le workflow initial, les prompts testés, le contrôle effectué, l’écart constaté et la correction justifiée.',
    ],
    prompt: `Nous allons construire un processus de travail manuel et contrôlé. Il ne doit déclencher aucune automatisation ni action externe.

Tâche récurrente : [tâche].
Livrable final : [résultat attendu et format].
Destinataire et usage : [public et décision ou action préparée].
Entrées autorisées : [sources et informations utilisables].
Données à ne pas transmettre : [données personnelles, sensibles ou confidentielles].
Critères du livrable final : [trois à cinq critères observables].
Personne responsable de la validation : [fonction].
Actions interdites à l’IA : [envoi, publication, décision ou autre action].

Phase 1 — Plan du processus :
1. reformule l’objectif et signale les informations manquantes ;
2. propose trois à cinq étapes dans un tableau ;
3. indique pour chaque étape : objectif, entrée autorisée, résultat attendu, critères, validation humaine et condition d’arrêt ;
4. vérifie que seul un résultat validé devient l’entrée de l’étape suivante ;
5. attends ma validation explicite avant de rédiger les prompts.

Phase 2 — Uniquement après ma validation :
- rédige un prompt réutilisable par étape avec des variables entre crochets ;
- demande uniquement les informations nécessaires à l’étape ;
- impose le format du résultat et les critères à vérifier ;
- écris « information manquante » au lieu d’inventer ;
- termine chaque prompt par une pause de validation ;
- arrête le processus lorsqu’une donnée interdite, une source absente ou une décision humaine est nécessaire.

Phase 3 — Protocole de test :
- propose un cas fictif court pour tester le processus ;
- indique les traces à conserver pour chaque étape ;
- fournis une grille permettant de noter le résultat, l’écart constaté, la correction apportée et la décision de poursuivre ou d’arrêter.`,
  },
];

const promptLevelOneFinalProject = {
  title: 'Concevoir, tester et présenter un prompt professionnel maîtrisé',
  description: 'En 30 minutes, le participant finalise un cas simple issu de son activité ou d’une situation réaliste, avec des informations fictives ou explicitement autorisées.',
  learnerGuidance: 'Réutilisez de préférence un travail commencé dans l’un des six exercices. Le formateur n’attend pas un résultat parfait : il évalue votre capacité à cadrer, tester, corriger, vérifier et expliquer votre décision d’usage.',
  steps: [
    'Choisir un cas limité et définir le besoin, le public, le résultat attendu et les informations autorisées',
    'Présenter le prompt initial, trois critères de réussite et le premier résultat obtenu',
    'Repérer au moins un écart puis réaliser une correction ciblée du prompt ou du processus',
    'Contrôler le résultat final, les sources, les données, les limites et les validations humaines nécessaires',
    'Présenter le modèle réutilisable, la décision d’usage et une situation proche dans laquelle le transférer',
  ],
  deliverables: [
    'Le prompt final et la principale amélioration apportée',
    'Le résultat final ou sa maquette',
    'La grille de contrôle et la décision d’usage',
    'Le modèle réutilisable et le prochain usage envisagé',
  ],
  submissionFields: [
    {
      id: 'prompt_and_iterations',
      label: '1. Prompt final et amélioration apportée',
      help: 'Collez le prompt final ou indiquez son emplacement sécurisé, puis présentez le prompt initial, l’écart constaté et la correction principale.',
      placeholder: 'Exemple : le premier essai ne signalait pas les informations absentes ; ajout de la règle « écris non précisé » et d’un contrôle dans la source…',
    },
    {
      id: 'final_output',
      label: '2. Résultat final ou maquette',
      help: 'Décrivez le résultat obtenu et précisez où le formateur peut le consulter sans transmettre de donnée personnelle ou confidentielle.',
      placeholder: 'Exemple : synthèse fictive structurée en faits, décisions, actions et points à confirmer, collée ci-dessous ou déposée dans un espace autorisé…',
    },
    {
      id: 'verification_grid_reference',
      label: '3. Contrôles réalisés et décision d’usage',
      help: 'Présentez les critères vérifiés, les sources consultées, les limites restantes et votre décision : utiliser, corriger ou rejeter.',
      placeholder: 'Exemple : les trois faits ont été retrouvés dans la source ; aucune donnée personnelle utilisée ; format conforme ; résultat utilisable après validation du responsable…',
    },
    {
      id: 'action_plan',
      label: '4. Modèle réutilisable et prochain usage',
      help: 'Indiquez les variables du modèle, la situation proche dans laquelle vous pourrez le réutiliser et le contrôle humain à conserver.',
      placeholder: 'Exemple : modèle avec [source], [public], [format] et [critères] ; prochain test sur une note fictive ; comparaison obligatoire avant diffusion…',
    },
  ],
  criteria: [
    'Cadrage du besoin, du public, des informations autorisées et du résultat attendu',
    'Qualité du prompt, des critères de réussite et de l’amélioration réalisée',
    'Fiabilité des contrôles, protection des données et validation humaine',
    'Capacité à expliquer les choix, les limites et les conditions de réutilisation',
  ],
  rubricLevels: [
    {
      id: 'not_acquired',
      label: 'Non acquis',
      help: 'Les éléments indispensables sont absents ou le résultat ne peut pas être utilisé en sécurité.',
    },
    {
      id: 'developing',
      label: "En cours d'acquisition",
      help: 'La démarche est engagée, mais des précisions ou des corrections importantes restent nécessaires.',
    },
    {
      id: 'acquired',
      label: 'Acquis',
      help: 'La méthode attendue est appliquée et le résultat peut être utilisé après les validations prévues.',
    },
    {
      id: 'mastered',
      label: 'Maîtrisé',
      help: 'La méthode est appliquée avec autonomie, justification et capacité de transfert.',
    },
  ],
  rubric: [
    {
      id: 'need_and_audience',
      criterion: 'Cadrage du besoin et du public',
      descriptors: {
        not_acquired: 'Le besoin, le public, les informations autorisées ou le résultat attendu ne sont pas identifiés.',
        developing: 'Le cas est compréhensible, mais le public, les sources, les contraintes ou l’usage du résultat restent partiellement définis.',
        acquired: 'Le besoin, le public, le résultat, les informations autorisées et les contraintes utiles sont définis avec précision.',
        mastered: 'Le cadrage justifie les choix, anticipe les limites du cas et permet d’adapter la méthode à une situation proche.',
      },
    },
    {
      id: 'prompt_and_success_criteria',
      criterion: 'Prompt, critères et amélioration',
      descriptors: {
        not_acquired: 'Le prompt reste vague et aucun critère ne permet de contrôler le résultat.',
        developing: 'Le prompt possède une structure, mais le contexte, le format, les critères ou l’amélioration restent incomplets.',
        acquired: 'Le prompt précise l’objectif, le contexte, le public, les informations, les contraintes, le format et des critères observables. Une correction ciblée est justifiée.',
        mastered: 'Le prompt est réutilisable grâce à des variables et les essais démontrent une amélioration autonome fondée sur les écarts constatés.',
      },
    },
    {
      id: 'checks_and_risks',
      criterion: 'Contrôles et maîtrise des risques',
      descriptors: {
        not_acquired: 'Le résultat est conservé sans contrôle suffisant ou des données non autorisées sont utilisées.',
        developing: 'Des contrôles sont mentionnés, mais les sources, les critères, les données, les limites ou la validation humaine ne sont pas tous traités.',
        acquired: 'Le résultat est comparé aux critères et aux sources utiles. Les données sont minimisées, les incertitudes signalées et la validation humaine prévue.',
        mastered: 'Les contrôles sont hiérarchisés, traçables et proportionnés ; les conditions d’arrêt, de correction ou de rejet sont clairement expliquées.',
      },
    },
    {
      id: 'choices_and_limits',
      criterion: 'Explication des choix et réutilisation',
      descriptors: {
        not_acquired: 'L’écart, la correction, la décision d’usage ou les limites ne peuvent pas être expliqués.',
        developing: 'Les étapes sont décrites, mais la correction, la décision d’usage ou les conditions de réutilisation restent peu justifiées.',
        acquired: 'L’écart, la correction, la décision d’usage, les limites, les variables et le contrôle à conserver sont expliqués clairement.',
        mastered: 'L’analyse tire un enseignement transférable, précise les situations dans lesquelles le modèle ne doit pas être utilisé et propose un prochain usage réaliste.',
      },
    },
  ],
  validationRule: 'Le cas pratique final est validé lorsque les quatre critères atteignent au minimum le niveau « Acquis ». Le niveau « Maîtrisé » valorise une autonomie supplémentaire sans être obligatoire. Si un critère reste « Non acquis » ou « En cours d’acquisition », le formateur précise les éléments à reprendre avant une nouvelle remise.',
};

const promptLevelOneGlossary = [
  {
    term: 'Action externe',
    definition: 'Opération réalisée hors de la conversation avec l’IA, par exemple envoyer un e-mail, publier une page ou modifier un dossier.',
    example: 'Le prompt prépare le message, mais son envoi reste une action externe déclenchée uniquement par une personne autorisée.',
  },
  {
    term: 'Ancrage dans une source',
    definition: 'Consigne qui limite la réponse aux informations présentes dans un document ou un ensemble de références clairement identifié.',
    example: 'La synthèse doit utiliser uniquement le compte rendu placé entre les balises <source> et </source>.',
  },
  {
    term: 'Arborescence',
    definition: 'Organisation hiérarchique des titres, sections et contenus d’un document ou d’une page.',
    example: 'La page comporte un titre principal, une présentation de l’atelier, le programme, les informations pratiques et un contact.',
  },
  {
    term: 'Balise de délimitation',
    definition: 'Repère placé avant et après un contenu pour montrer précisément à l’IA quelle partie elle peut utiliser.',
    example: 'Les notes autorisées sont placées entre <source> et </source> afin de les distinguer des consignes.',
  },
  {
    term: 'Cahier des charges',
    definition: 'Document qui décrit le besoin, le public, les contenus, les contraintes, les fonctionnalités et les contrôles attendus avant la production.',
    example: 'Avant de demander le code HTML, l’apprenant fait valider l’ordre des sections, les interactions et les règles d’accessibilité.',
  },
  {
    term: 'Condition d’arrêt',
    definition: 'Situation dans laquelle le processus doit s’interrompre pour éviter une erreur ou demander une décision humaine.',
    example: 'Le workflow s’arrête si la source manque, si une donnée confidentielle apparaît ou si un responsable doit trancher.',
  },
  {
    term: 'Contexte',
    definition: 'Informations utiles qui permettent à l’IA de comprendre la situation, le public, l’usage et les limites de la demande.',
    example: 'Le message est destiné à des participants débutants inscrits à un atelier à distance de deux heures.',
  },
  {
    term: 'Contrainte',
    definition: 'Règle à respecter concernant le contenu, la longueur, le ton, les sources, les outils ou le format.',
    example: 'Le résultat doit tenir en 180 mots, utiliser un ton professionnel et ne contenir aucune information inventée.',
  },
  {
    term: 'Critère de réussite',
    definition: 'Condition observable utilisée pour déterminer si le résultat répond réellement au besoin.',
    example: 'Le courriel est réussi s’il contient la date, l’horaire, le lien de connexion et une action clairement demandée.',
  },
  {
    term: 'Donnée confidentielle',
    definition: 'Information dont l’accès est limité par l’organisation, un contrat ou le contexte professionnel.',
    example: 'Un tarif négocié, un dossier interne ou une stratégie non publiée ne doit pas être collé dans un outil non autorisé.',
  },
  {
    term: 'Donnée personnelle',
    definition: 'Information qui permet d’identifier directement ou indirectement une personne physique.',
    example: 'Un nom, une adresse électronique nominative ou un numéro de téléphone sont remplacés par des données fictives pour l’exercice.',
  },
  {
    term: 'Entrée',
    definition: 'Information, document ou résultat validé fourni au début d’une étape de travail.',
    example: 'Dans le workflow, les notes fictives validées constituent l’entrée de l’étape de synthèse.',
  },
  {
    term: 'Exemple',
    definition: 'Démonstration concrète d’une forme ou d’un résultat attendu qui aide à comprendre la consigne.',
    example: 'Le prompt montre un exemple de tableau avec les colonnes « action », « responsable » et « échéance ».',
  },
  {
    term: 'Format de sortie',
    definition: 'Forme précise demandée pour présenter le résultat : texte, liste, tableau, plan, code ou autre structure.',
    example: 'La synthèse est demandée sous forme de quatre rubriques : faits, décisions, actions et points à confirmer.',
  },
  {
    term: 'Hallucination',
    definition: 'Information fausse, inventée ou non vérifiée produite par une IA, parfois avec une formulation convaincante.',
    example: 'L’IA ajoute une échéance absente du document source : cette information doit être supprimée et signalée.',
  },
  {
    term: 'Information autorisée',
    definition: 'Contenu que l’utilisateur a le droit de transmettre à l’outil choisi et qui est réellement nécessaire à la tâche.',
    example: 'L’exercice utilise un compte rendu fictif plutôt qu’un document réel contenant des noms de clients.',
  },
  {
    term: 'Instruction',
    definition: 'Action précise demandée à l’IA dans le prompt.',
    example: '« Compare les deux versions avec les quatre critères fournis » est une instruction contrôlable.',
  },
  {
    term: 'Itération',
    definition: 'Nouvel essai réalisé après avoir analysé un résultat et apporté une amélioration ciblée au prompt.',
    example: 'Après avoir repéré un ton trop technique, l’apprenant précise le niveau débutant du public puis teste une deuxième version.',
  },
  {
    term: 'Maquette',
    definition: 'Représentation préparatoire d’un résultat qui permet de valider son organisation avant sa réalisation complète.',
    example: 'L’arborescence et les contenus attendus servent de maquette textuelle avant la création de la page HTML.',
  },
  {
    term: 'Message invariant',
    definition: 'Information essentielle qui doit conserver le même sens lorsque le contenu est adapté à plusieurs publics ou formats.',
    example: 'La règle de sécurité reste identique dans la version pour débutants et dans celle destinée aux professionnels.',
  },
  {
    term: 'Minimisation des données',
    definition: 'Principe consistant à utiliser uniquement les informations nécessaires à l’objectif poursuivi.',
    example: 'Pour rédiger une invitation, le prompt indique le type de public sans transmettre la liste nominative des participants.',
  },
  {
    term: 'Objectif observable',
    definition: 'Résultat formulé avec une action que l’on peut constater ou évaluer à la fin d’une activité.',
    example: 'À la fin de l’exercice, l’apprenant sera capable de repérer trois informations absentes dans une synthèse.',
  },
  {
    term: 'Point à confirmer',
    definition: 'Information absente, ambiguë ou incertaine qui doit rester visible jusqu’à sa vérification par une personne compétente.',
    example: 'Le responsable de l’action n’est pas indiqué dans la source : la synthèse affiche « responsable à confirmer ».',
  },
  {
    term: 'Prompt',
    definition: 'Instruction, question ou ensemble de consignes fourni à une IA pour guider son résultat.',
    example: 'Le prompt précise l’objectif, le contexte, les informations autorisées, le format et les critères de réussite.',
  },
  {
    term: 'Prompt réutilisable',
    definition: 'Modèle de consigne contenant des variables explicites que l’on peut adapter à plusieurs situations proches.',
    example: 'Le modèle utilise [public], [source], [format] et [critères] sans conserver les informations du cas précédent.',
  },
  {
    term: 'Question de clarification',
    definition: 'Question posée avant la production lorsqu’une information indispensable manque ou reste ambiguë.',
    example: 'Avant de rédiger le courriel, l’IA demande quelle action le destinataire doit réaliser et pour quelle date.',
  },
  {
    term: 'Résultat attendu',
    definition: 'Livrable concret que la demande doit permettre d’obtenir et d’utiliser après contrôle.',
    example: 'Le résultat attendu est un e-mail de confirmation prêt à relire, et non une simple liste d’idées.',
  },
  {
    term: 'Responsive',
    definition: 'Capacité d’une page à adapter son organisation aux différentes largeurs d’écran sans perdre d’information ni créer de défilement horizontal.',
    example: 'Sur téléphone, les deux colonnes passent l’une sous l’autre et le bouton principal reste visible et utilisable.',
  },
  {
    term: 'Source de référence',
    definition: 'Document ou ensemble d’informations identifié dans lequel les faits doivent être vérifiés.',
    example: 'Le compte rendu autorisé est la seule source de référence utilisée pour produire la synthèse.',
  },
  {
    term: 'Structure sémantique',
    definition: 'Organisation d’une page avec des éléments qui décrivent le rôle de chaque contenu, comme le titre principal, la navigation et les sections.',
    example: 'La page utilise un seul titre principal, des titres de section ordonnés et un bouton dont le libellé décrit clairement l’action.',
  },
  {
    term: 'Synthèse',
    definition: 'Présentation condensée qui conserve les informations essentielles, leur sens et leurs réserves.',
    example: 'La synthèse distingue les faits établis des décisions et des points qui doivent encore être confirmés.',
  },
  {
    term: 'Test manuel',
    definition: 'Vérification réalisée par une personne en utilisant concrètement le résultat obtenu.',
    example: 'La page est parcourue au clavier et contrôlée sur téléphone pour vérifier les liens, le focus et l’absence de débordement.',
  },
  {
    term: 'Traçabilité',
    definition: 'Conservation des éléments utiles pour comprendre ce qui a été demandé, produit, contrôlé et décidé.',
    example: 'L’apprenant conserve le prompt initial, l’écart observé, la correction, le résultat final et sa décision d’usage.',
  },
  {
    term: 'Validation humaine',
    definition: 'Contrôle réalisé par une personne compétente avant l’utilisation, la transmission ou la diffusion du résultat.',
    example: 'Le formateur valide le corrigé et la faisabilité de l’activité avant de la proposer aux apprenants.',
  },
  {
    term: 'Variable',
    definition: 'Élément à remplacer dans un modèle de prompt pour l’adapter à un nouveau cas.',
    example: 'Dans « Rédige pour [public] au format [format] », les deux éléments entre crochets sont des variables.',
  },
  {
    term: 'Workflow',
    definition: 'Enchaînement organisé de plusieurs étapes, entrées, résultats et contrôles pour produire un livrable.',
    example: 'Les notes validées sont synthétisées, la synthèse est contrôlée, puis le courriel est préparé sans envoi automatique.',
  },
];

const promptLevelOneQuiz = [
  {
    id: 'definition',
    domain: 'structure',
    question: 'Quel énoncé décrit le mieux un prompt professionnel ?',
    answers: [
      { label: 'Une question très courte suffit toujours', score: 0 },
      { label: 'Une consigne qui précise le besoin et le résultat attendu', score: 1 },
      { label: 'Une consigne contextualisée avec contraintes, format et critères de réussite', score: 2 },
    ],
  },
  {
    id: 'context',
    domain: 'structure',
    question: 'Pourquoi préciser le contexte dans une demande adressée à une IA ?',
    answers: [
      { label: 'Ce n’est généralement pas nécessaire', score: 0 },
      { label: 'Pour obtenir une réponse plus longue', score: 1 },
      { label: 'Pour adapter la réponse à la situation, au public et à l’objectif', score: 2 },
    ],
  },
  {
    id: 'format',
    domain: 'structure',
    question: 'Comment demander un résultat directement exploitable ?',
    answers: [
      { label: 'En laissant l’IA choisir entièrement la présentation', score: 0 },
      { label: 'En donnant seulement un nombre de mots', score: 1 },
      { label: 'En décrivant la structure, le ton, la longueur et les éléments attendus', score: 2 },
    ],
  },
  {
    id: 'confidentiality',
    domain: 'verification',
    question: 'Que faire avec une information personnelle ou confidentielle ?',
    answers: [
      { label: 'La copier dans n’importe quel outil si le prompt est bien écrit', score: 0 },
      { label: 'Retirer seulement le nom de la personne', score: 1 },
      { label: 'Vérifier le cadre autorisé, minimiser ou anonymiser les données et s’abstenir en cas de doute', score: 2 },
    ],
  },
  {
    id: 'clarification',
    domain: 'structure',
    question: 'Une demande contient des informations importantes manquantes. Quelle pratique est la plus adaptée ?',
    answers: [
      { label: 'Laisser l’IA inventer les éléments manquants', score: 0 },
      { label: 'Relancer après avoir lu une première réponse', score: 1 },
      { label: 'Demander à l’IA de poser des questions ciblées avant de produire le livrable', score: 2 },
    ],
  },
  {
    id: 'examples',
    domain: 'structure',
    question: 'Quand un exemple de résultat est-il utile dans un prompt ?',
    answers: [
      { label: 'Jamais, car il limite toujours la créativité', score: 0 },
      { label: 'Uniquement pour produire du code', score: 1 },
      { label: 'Lorsque la structure, le ton ou les catégories attendues doivent être reproduits avec précision', score: 2 },
    ],
  },
  {
    id: 'verification',
    domain: 'verification',
    question: 'Comment vérifier une réponse contenant des faits importants ?',
    answers: [
      { label: 'Se fier au ton assuré de la réponse', score: 0 },
      { label: 'Relire uniquement l’orthographe', score: 1 },
      { label: 'Comparer avec des sources fiables, le document d’origine et les critères définis', score: 2 },
    ],
  },
  {
    id: 'iteration',
    domain: 'verification',
    question: 'Un premier résultat ne respecte pas deux contraintes. Que faire ?',
    answers: [
      { label: 'Tout recommencer avec une demande différente sans analyser le résultat', score: 0 },
      { label: 'Demander simplement une meilleure réponse', score: 1 },
      { label: 'Identifier les écarts, préciser les contraintes concernées puis retester', score: 2 },
    ],
  },
  {
    id: 'variables',
    domain: 'reuse',
    question: 'À quoi servent les variables comme [public] ou [objectif] dans un modèle de prompt ?',
    answers: [
      { label: 'À rendre le prompt plus technique sans autre intérêt', score: 0 },
      { label: 'À raccourcir systématiquement toutes les réponses', score: 1 },
      { label: 'À réutiliser une structure fiable dans plusieurs situations', score: 2 },
    ],
  },
  {
    id: 'workflow',
    domain: 'reuse',
    question: 'Pourquoi décomposer une tâche complexe en plusieurs prompts ?',
    answers: [
      { label: 'Pour éviter toute vérification entre les étapes', score: 0 },
      { label: 'Pour obtenir davantage de texte', score: 1 },
      { label: 'Pour contrôler les entrées, les résultats intermédiaires et les validations', score: 2 },
    ],
  },
  {
    id: 'success-criteria',
    domain: 'structure',
    question: 'Quel est le rôle des critères de réussite ?',
    answers: [
      { label: 'Ils servent uniquement à noter la longueur de la réponse', score: 0 },
      { label: 'Ils permettent de choisir l’outil le plus populaire', score: 1 },
      { label: 'Ils permettent d’évaluer objectivement si le résultat répond au besoin', score: 2 },
    ],
  },
  {
    id: 'transfer',
    domain: 'reuse',
    question: 'Comment rendre une méthode de prompting utilisable avec plusieurs assistants IA ?',
    answers: [
      { label: 'Mémoriser uniquement les commandes propres à un seul modèle', score: 0 },
      { label: 'Utiliser exactement le même prompt sans jamais comparer les résultats', score: 1 },
      { label: 'Conserver une structure fondée sur le besoin et adapter les détails après test selon l’outil', score: 2 },
    ],
  },
];

// Le lien éventuellement configuré est injecté côté serveur après autorisation.
const promptLibraryNotionUrl = null;

export const courseCatalog = {
  'formation-ia': {
    title: 'IA générative : comprendre, pratiquer et sécuriser ses usages',
    landingPath: '/formation-ia-generative',
    durationLabel: '10 heures accompagnées',
    moduleTitle: 'Votre parcours de 10 heures en cinq modules',
    onboarding: {
      title: 'Comment suivre cette formation ?',
      introduction: "Vous pouvez avancer progressivement : lisez un module, pratiquez avec le formateur, puis enregistrez votre exercice. Il n’est pas nécessaire de tout terminer en une seule fois.",
      steps: [
        {
          title: 'Ouvrez le module prévu pour votre séance',
          description: "Commencez par l’explication pour débuter, puis suivez la méthode et l’exemple commenté. Le module 1 est ouvert par défaut.",
        },
        {
          title: 'Testez avec un cas professionnel simple',
          description: "Reproduisez la démonstration avec une tâche que vous connaissez, sans transmettre de donnée personnelle, sensible ou confidentielle.",
        },
        {
          title: 'Réalisez l’exercice du module',
          description: "Enregistrez un brouillon aussi souvent que nécessaire. Déclarez la réponse terminée uniquement lorsqu’elle respecte les critères d’autoévaluation.",
        },
        {
          title: 'Consultez le retour du formateur',
          description: "Un exercice peut être validé ou demandé en reprise. Les commentaires restent visibles sous votre réponse et une nouvelle version ne supprime pas l’ancienne.",
        },
        {
          title: 'Terminez par le cas pratique final',
          description: "Après les cinq modules, préparez les quatre livrables du cas final. Votre évaluation et vos attestations seront disponibles lorsque toutes les preuves requises seront finalisées.",
        },
      ],
      reminders: [
        'Votre progression compte les exercices déclarés terminés ; un brouillon reste simplement en cours.',
        'Les onglets Supports et liens, Exercices pratiques et Lexique restent accessibles en bas de la page.',
        'Si une consigne n’est pas claire, notez votre question et reprenez-la avec le formateur pendant la séance.',
      ],
    },
    videoUrl: null,
    quiz: generativeAiQuiz,
    positioningLevels: [
      { maximumRatio: 0.34, label: 'Niveau découverte' },
      { maximumRatio: 0.7, label: 'Pratiques à structurer' },
      { maximumRatio: 1, label: 'Usages déjà réguliers' },
    ],
    positioningDomains: [
      {
        id: 'usages',
        label: 'Usages',
        guidance: [
          {
            maximumRatio: 0.34,
            label: 'Repères à construire',
            advice: "Commencez par le module 1 pour distinguer les outils, choisir une tâche adaptée et définir ce qui doit rester sous contrôle humain.",
          },
          {
            maximumRatio: 0.7,
            label: 'Usages à structurer',
            advice: "Vous identifiez déjà certains usages. Appuyez-vous sur les modules 1 et 5 pour mieux choisir vos cas et formaliser un plan d'action réaliste.",
          },
          {
            maximumRatio: 1,
            label: 'Base déjà solide',
            advice: "Vos repères sont établis. Concentrez-vous sur la justification des choix, les limites et le suivi d'une expérimentation professionnelle.",
          },
        ],
      },
      {
        id: 'formulation',
        label: 'Formulation',
        guidance: [
          {
            maximumRatio: 0.34,
            label: 'Méthode à découvrir',
            advice: "Le module 2 vous guidera pour préciser l'objectif, le contexte, le public, le format et les critères de réussite d'une demande.",
          },
          {
            maximumRatio: 0.7,
            label: 'Méthode à consolider',
            advice: "Vous savez déjà préciser une demande. Entraînez-vous à faire poser des questions, comparer deux résultats et corriger un écart précis.",
          },
          {
            maximumRatio: 1,
            label: 'Pratique déjà structurée',
            advice: "Votre formulation est méthodique. Utilisez les modules 2 et 3 pour renforcer vos critères de comparaison et la qualité du livrable final.",
          },
        ],
      },
      {
        id: 'verification',
        label: 'Vérification et sécurité',
        guidance: [
          {
            maximumRatio: 0.34,
            label: 'Vigilance à développer',
            advice: "Accordez une attention particulière au module 4 : vérification des sources, protection des données, droits d'utilisation et validation humaine.",
          },
          {
            maximumRatio: 0.7,
            label: 'Contrôles à systématiser',
            advice: "Vos réflexes existent. Utilisez la grille du module 4 pour rendre vos contrôles réguliers, traçables et proportionnés aux risques.",
          },
          {
            maximumRatio: 1,
            label: 'Réflexes déjà établis',
            advice: "Vos contrôles sont structurés. Travaillez surtout la preuve des sources consultées, les responsabilités et les validations avant diffusion.",
          },
        ],
      },
    ],
    modules: generativeAiModules,
    exercises: generativeAiExercises,
    finalProject: generativeAiFinalProject,
    glossary: generativeAiGlossary,
    resources: [
      {
        title: "Guide pratique de l'IA générative",
        description: 'Le support pas à pas des cinq modules : choix des usages, consignes, production, vérification et plan d’action.',
        href: '/assets/guide-pratique-ia-generative-formaprompt.pdf',
        action: 'Télécharger le guide pratique',
        download: 'guide-pratique-ia-generative-formaprompt.pdf',
      },
      {
        title: "Cahier d'activités – les cinq exercices",
        description: 'Un support imprimable pour préparer chaque exercice, analyser ses essais, s’autoévaluer et conserver le retour du formateur.',
        href: '/assets/cahier-activites-ia-generative-formaprompt.pdf',
        action: "Télécharger le cahier d'activités",
        download: 'cahier-activites-ia-generative-formaprompt.pdf',
      },
      {
        title: "Modèle du cas pratique final et plan d'action",
        description: 'Un dossier imprimable pour réunir les quatre livrables, préparer l’expérimentation à 30 jours et appliquer la grille d’évaluation finale.',
        href: '/assets/modele-cas-final-plan-action-ia-generative-formaprompt.pdf',
        action: 'Télécharger le modèle du cas final',
        download: 'modele-cas-final-plan-action-ia-generative-formaprompt.pdf',
      },
      {
        title: 'Fiche synthétique – aide-mémoire IA',
        description: "Un résumé des bonnes pratiques, structures de prompts et points de vérification.",
        href: '/assets/Fiche_synthetique_aide_memoire_IA_FormaPrompt.pdf',
        action: "Télécharger l'aide-mémoire",
        download: 'Fiche_synthetique_aide_memoire_IA_FormaPrompt.pdf',
      },
      generativeAiVerificationGrid,
    ],
  },
  'formation-ia-act': {
    title: 'IA : acculturation et préparation à la conformité AI Act',
    landingPath: '/formation-ia-act-conformite',
    durationLabel: '4 h 45 de formation',
    moduleTitle: 'Parcours guidé : comprendre l’IA et préparer les premiers repères de conformité',
    onboarding: {
      title: 'Comment suivre cette formation ?',
      introduction: "Avancez avec le formateur, un module après l’autre. Vous partirez d’un usage précis, apprendrez à repérer les vigilances, préparerez l’acculturation des équipes puis construirez une première feuille de route.",
      steps: [
        {
          title: 'Relisez votre positionnement initial',
          description: "Le questionnaire indique les domaines auxquels accorder le plus d’attention. Il sert à adapter l’accompagnement et ne constitue ni une évaluation des acquis, ni une validation de conformité.",
        },
        {
          title: 'Ouvrez le module prévu pour la séance',
          description: 'Commencez par les explications et la démonstration. Avancez dans l’ordre : cartographie, vigilances, acculturation, puis plan d’action.',
        },
        {
          title: 'Réalisez l’exercice lié au module',
          description: 'Utilisez un cas fictif ou des informations génériques. Enregistrez un brouillon, puis déclarez la réponse terminée lorsqu’elle respecte les quatre critères indiqués.',
        },
        {
          title: 'Utilisez le retour du formateur',
          description: 'Une réponse peut être validée ou demandée en reprise. Les versions et commentaires restent disponibles dans votre espace apprenant pour montrer votre progression.',
        },
        {
          title: 'Terminez par le cas pratique final',
          description: 'Les quatre livrables permettent d’évaluer vos acquis. Le questionnaire de satisfaction, distinct de cette évaluation, devient accessible après la dernière séance signée.',
        },
      ],
      reminders: [
        'Le parcours prépare des repères et des actions ; il ne remplace pas un avis juridique, technique ou relatif aux données.',
        'Les sources officielles doivent être consultées, datées et vérifiées de nouveau lorsque le cadre ou l’usage évolue.',
        'Les onglets Supports et liens, Exercices pratiques et Lexique restent disponibles en bas de l’espace apprenant.',
      ],
    },
    quiz: aiActQuiz,
    positioningLevels: [
      { maximumRatio: 0.34, label: 'Repères à construire' },
      { maximumRatio: 0.7, label: 'Démarche à structurer' },
      { maximumRatio: 1, label: 'Démarche déjà avancée' },
    ],
    positioningDomains: [
      {
        id: 'uses_and_roles',
        label: 'Usages et rôles',
        guidance: [
          {
            maximumRatio: 0.34,
            label: 'Cartographie à démarrer',
            advice: 'Commencez par le module 1 pour décrire un usage précis, distinguer les acteurs et repérer les personnes ainsi que les données concernées.',
          },
          {
            maximumRatio: 0.7,
            label: 'Cartographie à préciser',
            advice: 'Vos premiers repères existent. Utilisez les modules 1 et 2 pour mieux distinguer les faits, les rôles, les effets possibles et les informations encore inconnues.',
          },
          {
            maximumRatio: 1,
            label: 'Cartographie déjà structurée',
            advice: 'Votre inventaire est avancé. Concentrez-vous sur les changements d’usage, la qualité des sources et les questions qui exigent encore une confirmation compétente.',
          },
        ],
      },
      {
        id: 'vigilance_and_controls',
        label: 'Vigilances et contrôles',
        guidance: [
          {
            maximumRatio: 0.34,
            label: 'Vigilance à développer',
            advice: 'Accordez une attention particulière au module 2 : signaux d’interdiction ou de haut risque, transparence, données et conditions d’arrêt.',
          },
          {
            maximumRatio: 0.7,
            label: 'Contrôles à formaliser',
            advice: 'Vous reconnaissez certaines vigilances. Entraînez-vous à séparer les faits des conclusions, puis à documenter la supervision et l’orientation vers les fonctions compétentes.',
          },
          {
            maximumRatio: 1,
            label: 'Contrôles déjà structurés',
            advice: 'Vos contrôles sont solides. Travaillez surtout leur proportionnalité, leur traçabilité et leur actualisation lorsque l’outil, l’usage ou les sources officielles évoluent.',
          },
        ],
      },
      {
        id: 'literacy_and_action',
        label: 'Acculturation et plan d’action',
        guidance: [
          {
            maximumRatio: 0.34,
            label: 'Organisation à construire',
            advice: 'Les modules 3 et 4 vous aideront à adapter l’acculturation aux fonctions, attribuer les actions et conserver des preuves minimales.',
          },
          {
            maximumRatio: 0.7,
            label: 'Organisation à consolider',
            advice: 'Des actions existent déjà. Reliez-les aux usages, aux responsabilités, aux règles d’arrêt, aux échéances et aux déclencheurs de mise à jour.',
          },
          {
            maximumRatio: 1,
            label: 'Pilotage déjà avancé',
            advice: 'Votre démarche est structurée. Utilisez le module 4 et le cas final pour tester la cohérence des priorités, des validations, des preuves et des revues prévues.',
          },
        ],
      },
    ],
    modules: aiActModules,
    exercises: aiActExercises,
    finalProject: aiActFinalProject,
    glossary: aiActGlossary,
    resources: [
      {
        title: "Guide pratique de l'IA Act",
        description: "Le support pas à pas des quatre modules : inventaire des usages, premier tri des vigilances, maîtrise de l'IA et feuille de route 30-60-90 jours.",
        href: '/assets/guide-pratique-ia-act-formaprompt.pdf',
        action: 'Télécharger le guide pratique',
        download: 'guide-pratique-ia-act-formaprompt.pdf',
      },
      {
        title: "Cahier d'activités IA Act",
        description: "Les quatre exercices imprimables pour préparer la cartographie, le premier tri, le plan d'acculturation et la feuille de route avant la remise dans l'espace apprenant.",
        href: '/assets/cahier-activites-ia-act-formaprompt.pdf',
        action: "Télécharger le cahier d'activités",
        download: 'cahier-activites-ia-act-formaprompt.pdf',
      },
      {
        title: 'Modèle du cas pratique final IA Act',
        description: "Un dossier imprimable pour cadrer l'usage, préparer les quatre livrables, s'autoévaluer et appliquer la grille d'évaluation finale.",
        href: '/assets/modele-cas-final-ia-act-formaprompt.pdf',
        action: 'Télécharger le modèle du cas final',
        download: 'modele-cas-final-ia-act-formaprompt.pdf',
      },
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
    durationLabel: '7 heures accompagnées',
    moduleTitle: 'Parcours guidé : construire, tester et améliorer ses prompts',
    onboarding: {
      title: 'Comment suivre cette formation ?',
      introduction: "Avancez avec le formateur, un module après l’autre. Chaque module explique une méthode, montre un exemple professionnel puis vous conduit vers un exercice directement lié.",
      steps: [
        {
          title: 'Relisez votre positionnement initial',
          description: "Le quiz préalable indique les points auxquels accorder le plus d’attention. Il sert à adapter l’accompagnement et ne constitue pas une évaluation des acquis.",
        },
        {
          title: 'Ouvrez le module prévu pour la séance',
          description: 'Commencez par les explications, suivez la méthode guidée et observez la démonstration avant de personnaliser le modèle proposé.',
        },
        {
          title: 'Réalisez l’exercice du module',
          description: 'Enregistrez un brouillon si nécessaire, puis déclarez votre réponse terminée lorsqu’elle respecte les quatre critères indiqués.',
        },
        {
          title: 'Utilisez le retour du formateur',
          description: 'Une réponse peut être validée ou demandée en reprise. Les versions et commentaires restent visibles pour documenter votre progression.',
        },
        {
          title: 'Terminez par le cas pratique final',
          description: "Les quatre livrables permettent d’évaluer vos acquis. Le questionnaire de satisfaction, distinct de cette évaluation, s’ouvre dans votre espace apprenant après la dernière séance signée.",
        },
      ],
      reminders: [
        'Le positionnement initial adapte le parcours ; il ne valide aucune compétence.',
        'Les exercices et le cas pratique final constituent les évaluations pédagogiques de vos acquis.',
        'Les onglets Supports et liens, Exercices pratiques et Lexique restent disponibles en bas de la page.',
      ],
    },
    videoUrl: serverControlledPromptEngineeringVideoUrl,
    quiz: promptLevelOneQuiz,
    positioningLevels: [
      { maximumRatio: 0.34, label: 'Niveau découverte' },
      { maximumRatio: 0.7, label: 'Niveau intermédiaire' },
      { maximumRatio: 1, label: 'Niveau autonome ou avancé' },
    ],
    positioningDomains: [
      {
        id: 'structure',
        label: 'Structuration du prompt',
        guidance: [
          {
            maximumRatio: 0.34,
            label: 'Méthode à découvrir',
            advice: 'Commencez par le module 1 pour définir le besoin, le public, le format et des critères de réussite observables.',
          },
          {
            maximumRatio: 0.7,
            label: 'Méthode à consolider',
            advice: 'Utilisez les modules 1 à 3 pour mieux cadrer les informations, poser des questions et adapter le résultat sans perdre le sens.',
          },
          {
            maximumRatio: 1,
            label: 'Base déjà structurée',
            advice: 'Votre cadrage est solide. Concentrez-vous sur les critères, les comparaisons et la justification des améliorations réalisées.',
          },
        ],
      },
      {
        id: 'verification',
        label: 'Vérification et sécurité',
        guidance: [
          {
            maximumRatio: 0.34,
            label: 'Vigilance à développer',
            advice: 'Accordez une attention particulière au module 2 : sources autorisées, informations absentes, protection des données et contrôle humain.',
          },
          {
            maximumRatio: 0.7,
            label: 'Contrôles à systématiser',
            advice: 'Vous avez de bons réflexes. Formalisez vos vérifications, conservez les écarts observés et corrigez uniquement les points nécessaires.',
          },
          {
            maximumRatio: 1,
            label: 'Réflexes déjà établis',
            advice: 'Vos contrôles sont solides. Travaillez surtout leur traçabilité, les conditions d’arrêt et la décision d’usage du résultat.',
          },
        ],
      },
      {
        id: 'reuse',
        label: 'Réutilisation et processus',
        guidance: [
          {
            maximumRatio: 0.34,
            label: 'Repères à construire',
            advice: 'Les modules 5 et 6 vous aideront à utiliser des variables, séparer les étapes et conserver une validation humaine avant toute action.',
          },
          {
            maximumRatio: 0.7,
            label: 'Pratique à organiser',
            advice: 'Transformez vos prompts en modèles et testez chaque étape séparément avant de réutiliser le processus dans une situation proche.',
          },
          {
            maximumRatio: 1,
            label: 'Pratique déjà transférable',
            advice: 'Votre méthode est réutilisable. Concentrez-vous sur les limites, les variables minimales et les cas dans lesquels le processus doit s’arrêter.',
          },
        ],
      },
    ],
    modules: promptLevelOneModules,
    exercises: promptLevelOneExercises,
    finalProject: promptLevelOneFinalProject,
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
        title: 'Guide pratique Prompt Engineering – Niveau 1',
        description: 'Guide textuel de 19 pages : six modules, productions attendues, prompts complets, méthode d’itération, cas final, lexique et checklist.',
        href: '/assets/guide-pratique-prompt-engineering-niveau-1-formaprompt.pdf',
        action: 'Télécharger le PDF',
        download: 'guide-pratique-prompt-engineering-niveau-1-formaprompt.pdf',
      },
      {
        title: 'Cahier d’activités – Prompt Engineering Niveau 1',
        description: 'Support imprimable de 21 pages pour préparer, tester, analyser et autoévaluer les six exercices.',
        href: '/assets/cahier-activites-prompt-engineering-niveau-1-formaprompt.pdf',
        action: 'Télécharger le PDF',
        download: 'cahier-activites-prompt-engineering-niveau-1-formaprompt.pdf',
      },
      {
        title: 'Modèle du cas pratique final et plan d’action',
        description: 'Dossier imprimable de 12 pages pour préparer les quatre livrables, documenter l’amélioration et appliquer la grille d’évaluation.',
        href: '/assets/modele-cas-final-plan-action-prompt-engineering-niveau-1-formaprompt.pdf',
        action: 'Télécharger le modèle du cas final',
        download: 'modele-cas-final-plan-action-prompt-engineering-niveau-1-formaprompt.pdf',
      },
    ],
  },
};
