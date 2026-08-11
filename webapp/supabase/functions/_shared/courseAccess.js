export const COURSE_ACCESS_CONFLICT_TARGET = 'user_id,course_id';

export function shouldCreateStripeCourseAccess(existingAccess) {
  // Une preuve Stripe crée un droit uniquement lorsqu'il n'en existe aucun.
  // Elle ne réactive jamais implicitement un droit suspendu ou révoqué.
  return !existingAccess;
}

export function buildStripeCourseAccess({ userId, courseId, purchaseId, grantedAt, updatedAt }) {
  if (!userId || !courseId || !purchaseId || !grantedAt || !updatedAt) {
    throw new Error("Données insuffisantes pour créer le droit d'accès Stripe.");
  }

  return {
    user_id: userId,
    course_id: courseId,
    status: 'active',
    access_source: 'stripe',
    purchase_id: purchaseId,
    granted_at: grantedAt,
    expires_at: null,
    updated_at: updatedAt,
  };
}
