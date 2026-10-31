import { IAG_COURSE_ID } from '../../supabase/functions/_shared/iagPositioning.js';

export function checkoutReference(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value : null;
}

// Indication d'affichage uniquement : jamais une preuve de paiement ou d'accès.
export function pendingCourseConfirmationPath(courseId, result) {
  const path = `/paiement-reussi?course=${encodeURIComponent(courseId)}`;
  if (courseId !== IAG_COURSE_ID || result?.reconciliation_required !== true) return path;
  const params = new URLSearchParams({ course: courseId, verification: 'requise' });
  const reference = checkoutReference(result.checkoutIntentId);
  if (reference) params.set('reference', reference);
  return `/paiement-reussi?${params.toString()}`;
}
