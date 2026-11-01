export const reasoningLevels = [
  { label: 'Faible', alias: 'Light / Low', description: 'Pour une tâche ciblée, avec peu d’arbitrages.', example: 'Reformater une liste.', tradeoff: 'Privilégie la rapidité et un usage modéré.' },
  { label: 'Moyen', alias: 'Medium', description: 'Un équilibre pour préparer une demande structurée.', example: 'Préparer un exercice de formation.', tradeoff: 'Un point de comparaison utile avec le réglage par défaut.' },
  { label: 'Élevé', alias: 'High', description: 'Pour examiner plusieurs contraintes ou hypothèses.', example: 'Analyser un dossier et ses points à vérifier.', tradeoff: 'Peut demander davantage de temps et de capacité.' },
  { label: 'Très élevé', alias: 'Extra High / xhigh', description: 'À essayer pour des recoupements particulièrement difficiles.', example: 'Croiser des sources contradictoires en citant les passages.', tradeoff: 'À comparer avec Élevé pour vérifier l’intérêt du surcroît d’analyse.' },
  { label: 'Max', alias: 'Max', description: 'Approfondir une difficulté exigeante dans une même tâche.', example: 'Examiner un diagnostic difficile après un premier essai insuffisant.', tradeoff: 'La profondeur passe avant le délai et la consommation.' },
  { label: 'Ultra', alias: 'Mode Work/Codex', description: 'Raisonnement poussé et répartition du travail entre sous-agents.', example: 'Répartir un projet en analyses parallèles, puis réunir leurs résultats.', tradeoff: 'Le parallélisme peut réduire l’attente, mais mobiliser davantage de capacité.' },
];

export const reasoningNotes = {
  defaults: 'Tous les niveaux ne sont pas proposés avec chaque modèle ou abonnement. Un effort plus élevé peut prendre davantage de temps et consommer plus d’usage, sans garantir un meilleur résultat. Commencez avec le réglage par défaut et vérifiez la réponse.',
  names: 'Les intitulés varient : Light apparaît dans certaines interfaces et Low dans la CLI. Très élevé correspond ici au repère Extra High/xhigh. Ces exemples sont des conseils de choix, pas des gains garantis.',
  chat: 'Dans Chat classique, les niveaux documentés sont Instant, Medium, High, Extra High et Pro, selon le forfait. Max et Ultra ne sont pas documentés comme des niveaux de ce sélecteur.',
  availability: 'Dans Work/Codex, utilisez Ultra pour Astra ou Sol lorsque l’interface le propose. Luna est documenté jusqu’à Max, sans Ultra. Les pages publiques consultées n’établissent pas spécifiquement Ultra pour Terra.',
  ultra: 'Ultra associe raisonnement poussé et délégation proactive à des sous-agents. Ultrafast est un mode de vitesse, avec ses conditions d’accès et de consommation. Ce sont deux réglages distincts.',
  api: 'Dans l’API, les fiches Astra et Sol 6.1 listent low, medium, high, xhigh et max. Terra 6.1 et Luna ajoutent none. Ultra n’est pas une valeur universelle de reasoning.effort ; les modes d’une application ne se transposent pas automatiquement à l’API.',
};

export const reasoningSources = [
  { label: 'Modèles et réglages Work/Codex', href: 'https://learn.chatgpt.com/docs/models' },
  { label: 'Raisonnement et sous-agents', href: 'https://learn.chatgpt.com/docs/agent-configuration/subagents' },
  { label: 'Sélecteur de Chat', href: 'https://help.openai.com/en/articles/20001354-gpt-6-and-other-models-in-chatgpt' },
  { label: 'Effort dans l’API', href: 'https://developers.openai.com/api/docs/guides/reasoning' },
];
