export function keepOwnVisibleAdministrativeDocuments(documents, userId) {
  if (!userId || !Array.isArray(documents)) return [];
  return documents.filter(
    (document) => document.user_id === userId && document.visible_to_learner,
  );
}
