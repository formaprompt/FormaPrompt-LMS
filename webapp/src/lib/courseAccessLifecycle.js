export const COURSE_ACCESS_STATUS_LABELS = {
  active: 'Actif',
  suspended: 'Suspendu',
  revoked: 'Révoqué',
  refunded: 'Remboursé',
  expired: 'Expiré',
};

export function isCourseAccessOpen(access, referenceTime = new Date()) {
  if (access?.status !== 'active') return false;
  return !access.expires_at || new Date(access.expires_at) > referenceTime;
}

export function learnerAccessMessage(status) {
  if (status === 'suspended') {
    return 'Votre accès à cette formation est temporairement suspendu. Les données de progression restent conservées. Contactez FormaPrompt pour toute question.';
  }
  if (status === 'revoked') {
    return 'Votre accès à cette formation n’est plus disponible. Contactez FormaPrompt si vous avez besoin d’informations.';
  }
  if (status === 'refunded') {
    return 'Votre accès à cette formation n’est pas disponible à la suite d’une décision administrative. Contactez FormaPrompt pour toute question.';
  }
  if (status === 'expired') {
    return 'Votre accès à cette formation est arrivé à échéance. Contactez FormaPrompt pour toute question.';
  }
  return '';
}
