export const practicalGuides = [
  {
    slug: 'ia-generative-debutants',
    title: 'IA générative pour débutants : comprendre, essayer, vérifier',
    description: 'Comprendre ce que fait une IA générative, choisir un premier essai sans risque et garder les vérifications utiles.',
    label: 'Démarrer',
    readingTime: '6 min',
    sections: [
      { id: 'comprendre', label: 'Ce que l’outil fait' },
      { id: 'premier-essai', label: 'Un premier essai' },
      { id: 'precautions', label: 'Les précautions' },
    ],
  },
  {
    slug: 'prompt-engineering-professionnel-methode',
    title: 'Prompt engineering professionnel : une méthode simple pour des demandes utiles',
    description: 'Passer d’une demande vague à un livrable contrôlable grâce à la méthode CROP.',
    label: 'Méthode CROP',
    readingTime: '8 min',
    sections: [
      { id: 'crop', label: 'La méthode CROP' },
      { id: 'deux-temps', label: 'Travailler en deux temps' },
      { id: 'controles', label: 'Les contrôles' },
    ],
  },
  {
    slug: 'checklist-ai-act-organisme-formation',
    title: 'Checklist AI Act pour les organismes de formation : usages, compétences et transparence',
    description: 'Une première démarche pour examiner les usages réels de l’IA dans un organisme de formation.',
    label: 'AI Act',
    readingTime: '9 min',
    sections: [
      { id: 'checklist', label: 'Checklist de départ' },
      { id: 'situations', label: 'Trois situations' },
      { id: 'limites', label: 'Ce que cela ne prouve pas' },
    ],
  },
];

export const getPracticalGuide = (slug) => practicalGuides.find((guide) => guide.slug === slug);
