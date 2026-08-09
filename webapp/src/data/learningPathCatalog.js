export const DEMO_LEARNING_PATH_SLUG = 'introduction-prompt-engineering';

export const learningPathCatalog = {
  [DEMO_LEARNING_PATH_SLUG]: {
    id: DEMO_LEARNING_PATH_SLUG,
    title: 'Introduction au Prompt Engineering',
    description: 'Un parcours court pour structurer une demande claire avec la méthode CROP.',
    accessMode: 'authenticated-demo',
    lessons: [
      {
        id: 'comprendre-un-prompt',
        title: 'Comprendre un prompt',
        duration: '5 min',
        introduction: "Un prompt est une consigne donnée à une IA. Il décrit le résultat attendu et les repères utiles pour éviter une réponse trop vague.",
        example: 'Demande vague : « Rédige un courriel. » Demande cadrée : « Rédige un courriel de rappel cordial, destiné à des participants adultes, en moins de 150 mots. »',
        activity: 'Repérez dans l’exemple le livrable, le public et la contrainte de longueur.',
      },
      {
        id: 'donner-du-contexte',
        title: 'Donner du contexte',
        duration: '6 min',
        introduction: 'Le contexte précise la situation, le public et les informations autorisées. Il aide l’IA à adapter sa proposition sans inventer ce qui manque.',
        example: 'Contexte : une réunion fictive a été déplacée au mardi 15 septembre à 10 h ; le message s’adresse à une équipe de six personnes.',
        activity: 'Ajoutez à une demande professionnelle deux informations de contexte réellement utiles.',
      },
      {
        id: 'definir-un-role',
        title: 'Définir un rôle',
        duration: '5 min',
        introduction: 'Le rôle indique l’expertise et la posture attendues. Il ne transforme pas l’IA en professionnel responsable de la décision.',
        example: 'Rôle : agis comme un assistant de communication pédagogique, attentif à la clarté et à l’accessibilité.',
        activity: 'Choisissez un rôle précis pour votre demande et indiquez la limite qui reste sous contrôle humain.',
      },
      {
        id: 'definir-un-objectif',
        title: 'Définir un objectif',
        duration: '6 min',
        introduction: 'L’objectif nomme un résultat observable : document à produire, décision à préparer ou action attendue du destinataire.',
        example: 'Objectif : obtenir une confirmation de présence avant vendredi, à partir des informations fournies uniquement.',
        activity: 'Reformulez votre besoin avec un verbe d’action et un résultat vérifiable.',
      },
      {
        id: 'ajouter-les-precisions',
        title: 'Ajouter les précisions',
        duration: '8 min',
        introduction: 'Les précisions fixent le format, le ton, la longueur, les exclusions et les contrôles à effectuer avant utilisation.',
        example: 'Précisions : objet explicite, ton cordial, 150 mots maximum, aucune information inventée et éléments manquants signalés.',
        activity: 'Assemblez Contexte, Rôle, Objectif et Précisions, puis relisez le résultat avant toute diffusion.',
      },
    ],
  },
};
