const MISSING_COURSE_ACCESS_CODES = new Set(['42P01', 'PGRST205']);

export function isCourseAccessUnavailable(error) {
  return Boolean(error && MISSING_COURSE_ACCESS_CODES.has(error.code));
}

export function mapPurchaseToCourseAccess(purchase) {
  return {
    id: purchase.id,
    user_id: purchase.user_id,
    course_id: purchase.course_id,
    status: 'active',
    granted_at: purchase.purchased_at,
    access_source: purchase.payment_status === 'granted_by_admin' ? 'admin' : 'legacy',
    purchase_id: purchase.id,
    expires_at: null,
  };
}
