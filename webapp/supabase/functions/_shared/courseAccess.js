export const COURSE_ACCESS_CONFLICT_TARGET = 'user_id,course_id';

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
