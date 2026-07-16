import promptEngineeringIntroVideoUrl from '../../vidéo/FP_-_Capsule_001_-_Rédiger_un_bon_prompt_finale_with_captions.mp4';

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
    term: "Assistant d'IA",
    definition: "Interface qui permet d'interagir avec un ou plusieurs modèles afin de générer, analyser ou transformer un contenu.",
  },
  {
    term: 'Biais',
    definition: "Tendance d'un modèle ou de ses résultats à reproduire des déséquilibres, stéréotypes ou choix présents dans les données et les consignes.",
  },
  {
    term: 'Contexte',
    definition: 'Informations utiles qui permettent d’adapter une réponse à la situation, au public et au résultat attendu.',
  },
  {
    term: 'Donnée personnelle',
    definition: "Information se rapportant à une personne identifiée ou identifiable. Son utilisation doit respecter un cadre autorisé et le principe de minimisation.",
  },
  {
    term: 'Donnée sensible',
    definition: "Catégorie de donnée personnelle bénéficiant d'une protection renforcée, notamment lorsqu'elle concerne la santé, les opinions ou les caractéristiques biométriques.",
  },
  {
    term: 'Hallucination',
    definition: "Information fausse, inventée ou imprécise produite par une IA, parfois formulée de manière convaincante.",
  },
  {
    term: 'IA multimodale',
    definition: 'Système capable de traiter ou de générer plusieurs types de contenus, par exemple du texte, des images, du son ou de la vidéo.',
  },
  {
    term: 'Itération',
    definition: "Amélioration progressive d'une demande ou d'un résultat après analyse des écarts constatés.",
  },
  {
    term: 'LLM (grand modèle de langage)',
    definition: "Modèle entraîné sur de grands volumes de textes afin d'analyser et de générer du langage naturel.",
  },
  {
    term: 'Prompt',
    definition: "Instruction, question ou ensemble de consignes fourni à une IA pour guider son résultat.",
  },
  {
    term: 'RAG',
    definition: "Méthode qui fournit des documents de référence à un modèle afin d'ancrer sa réponse dans des sources déterminées.",
  },
  {
    term: 'Token',
    definition: "Unité utilisée par un modèle pour découper et traiter un contenu. La taille d'un texte ne correspond donc pas directement à son nombre de tokens.",
  },
  {
    term: 'Validation humaine',
    definition: "Contrôle réalisé par une personne compétente avant l'utilisation, la prise de décision ou la diffusion d'un résultat produit avec l'IA.",
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
    title: 'IA générative : comprendre, pratiquer et sécuriser ses usages',
    landingPath: '/formation-ia-generative',
    durationLabel: '10 heures accompagnées',
    moduleTitle: 'Votre parcours de 10 heures en cinq modules',
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
      generativeAiVerificationGrid,
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
