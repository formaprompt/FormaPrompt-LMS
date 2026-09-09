// Catalogue pédagogique ; les identifiants d'achat sont définis côté serveur.
export const excelCourses = [
  {
    id: 'initiation',
    level: 'Initiation',
    title: 'Créer et exploiter ses premiers tableaux professionnels',
    promise: 'Je crée et j’utilise correctement mes premiers tableaux Excel.',
    situation: 'Vous utilisez rarement Excel et les formules vous intimident.',
    audience: 'Débutants, utilisateurs occasionnels et personnes qui souhaitent acquérir des bases solides pour leur activité professionnelle.',
    prerequisites: 'Savoir utiliser un ordinateur, une souris et un clavier, ouvrir et enregistrer un fichier. Aucune connaissance préalable d’Excel n’est nécessaire.',
    objective: 'Créer un tableau professionnel lisible, réaliser des calculs simples et présenter ses résultats.',
    outcome: 'Un tableau de suivi avec calculs, graphique, image et mise en page prête à imprimer ou à exporter en PDF.',
    sequences: [
      { title: 'Prendre en main et organiser', content: 'Se repérer dans Excel ; saisir et organiser les données ; mettre en forme un tableau.' },
      { title: 'Calculer avec les fonctions essentielles', content: 'Calculs simples ; SOMME, MOYENNE, MIN, MAX, NB, NBVAL ; pourcentages ; référence absolue simple.' },
      { title: 'Exploiter et illustrer un tableau', content: 'Tri et filtres ; graphique simple ; insertion, redimensionnement et placement d’images ou de photos ; sensibilisation au droit d’auteur, au copyright et aux licences d’utilisation des images.' },
      { title: 'Présenter et mettre en pratique', content: 'Impression et export PDF ; cas pratique final mobilisant les compétences acquises.' },
    ],
    boundary: 'SI/ET/OU, fonctions de recherche et TCD sont abordés en Perfectionnement. Les fonctions avancées, Power Query et VBA ne font pas partie de l’Initiation.',
  },
  {
    id: 'perfectionnement',
    level: 'Perfectionnement',
    title: 'Fiabiliser ses données et construire des analyses professionnelles',
    promise: 'Je fiabilise mes données, automatise mes calculs courants et construis mes premières analyses.',
    situation: 'Vous utilisez déjà SOMME, les filtres et quelques formules, mais souhaitez automatiser davantage.',
    audience: 'Utilisateurs réguliers d’Excel qui souhaitent fiabiliser leurs fichiers de suivi et produire des synthèses professionnelles.',
    prerequisites: 'Savoir créer et mettre en forme un tableau, utiliser les calculs simples et les fonctions SOMME, MOYENNE, MIN, MAX, NB et NBVAL, une référence absolue simple, les tris et filtres, un graphique simple et l’impression ou l’export PDF.',
    objective: 'Sécuriser la saisie, automatiser les calculs courants, croiser des informations et synthétiser des données avec un TCD.',
    outcome: 'Un fichier de suivi fiabilisé, enrichi par des recherches et accompagné d’un tableau croisé dynamique (TCD) et d’un graphique simple.',
    sequences: [
      { title: 'Fiabiliser la base de travail', content: 'Tableaux structurés ; validation des données et listes déroulantes ; tris multicritères et filtres ; mise en forme conditionnelle.' },
      { title: 'Automatiser les calculs courants', content: 'SI, ET, OU ; NB.SI, SOMME.SI, MOYENNE.SI ; NB.SI.ENS et SOMME.SI.ENS ; fonctions texte et dates courantes.' },
      { title: 'Rechercher et contrôler', content: 'RECHERCHEV et RECHERCHEH pour les fichiers historiques et Excel 2016 ; RECHERCHEX comme méthode moderne sur les versions compatibles ; gestion raisonnée des erreurs.' },
      { title: 'Construire ses premières analyses', content: 'Tableaux croisés dynamiques ; graphique croisé dynamique simple ; cas pratique final.' },
    ],
    boundary: 'Les modèles de calcul complexes, les tableaux dynamiques Microsoft 365 et l’approfondissement des TCD sont réservés au niveau Avancé.',
  },
  {
    id: 'avance',
    level: 'Avancé',
    title: 'Concevoir des modèles de calcul et des analyses dynamiques',
    promise: 'Je construis des modèles de calcul puissants et des analyses dynamiques.',
    situation: 'Vous maîtrisez déjà SI, les recherches et les TCD et souhaitez aller vers des analyses plus complexes.',
    audience: 'Utilisateurs confirmés amenés à maintenir des classeurs complexes, construire des modèles de calcul et approfondir leurs analyses.',
    prerequisites: 'Maîtriser les tableaux structurés, SI/ET/OU, les calculs conditionnels, les fonctions de recherche et la création de TCD. Avoir les compétences du niveau Perfectionnement.',
    objective: 'Combiner des formules avancées, construire des résultats dynamiques, auditer un modèle et approfondir ses analyses.',
    outcome: 'Un modèle de calcul contrôlé, associé à des extractions dynamiques et à une analyse pilotée par segments et chronologies.',
    sequences: [
      { title: 'Construire des recherches et calculs complexes', content: 'INDEX/EQUIV ; RECHERCHEX approfondie ; recherches complexes ; SOMMEPROD ; noms de plages et paramètres nommés.' },
      { title: 'Exploiter les fonctions modernes', content: 'FILTRE, UNIQUE, TRIER et tableaux dynamiques ; LET ; découverte courte de LAMBDA ; compatibilité entre différentes versions d’Excel.' },
      { title: 'Contrôler et approfondir les analyses', content: 'Audit des formules ; gestion avancée des erreurs ; TCD approfondis ; segments et chronologies ; comparaisons et analyses dynamiques.' },
      { title: 'Tester un modèle et mobiliser ses acquis', content: 'Valeur cible ; cas pratique final combinant modèle de calcul et analyse dynamique.' },
    ],
    boundary: 'Macros, VBA, Power Query, Power Pivot, modèle de données, DAX, Power BI et développement avancé avec LAMBDA sont exclus. Ces domaines pourront faire l’objet de formations spécialisées distinctes.',
  },
];

export const excelPrices = [
  { mode: 'Inter-entreprises', price: '690 €', unit: 'par participant', description: 'Pour se former avec des participants de différentes entreprises.' },
  { mode: 'Intra-entreprise', price: '1 590 €', unit: 'par groupe jusqu’à 8 participants', description: 'Pour former une équipe au sein d’une même entreprise.' },
  { mode: 'Accompagnement individuel', price: '990 €', unit: 'pour une personne', description: 'Pour travailler individuellement avec le formateur.' },
];
