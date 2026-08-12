import { supabase } from './supabaseClient.js';

export async function fetchActiveCourseAccesses({ userId, courseId } = {}) {
  let accessQuery = supabase
    .from('course_access')
    .select('id, user_id, course_id, status, granted_at, access_source, purchase_id, expires_at')
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (userId) accessQuery = accessQuery.eq('user_id', userId);
  if (courseId) accessQuery = accessQuery.eq('course_id', courseId);

  return accessQuery;
}

export async function fetchCourseAccesses({ userId, courseId } = {}) {
  let accessQuery = supabase
    .from('course_access')
    .select('id, user_id, course_id, status, granted_at, access_source, purchase_id, expires_at, status_changed_at, suspension_ends_at');

  if (userId) accessQuery = accessQuery.eq('user_id', userId);
  if (courseId) accessQuery = accessQuery.eq('course_id', courseId);

  return accessQuery;
}

// Contrôle strict réservé aux contenus protégés : course_access est l'unique
// source de droit et aucune compatibilité historique via purchases n'est admise.
export async function fetchCourseAccessEntitlement({ userId, courseId }) {
  return supabase
    .from('course_access')
    .select('id, user_id, course_id, status, granted_at, access_source, purchase_id, expires_at, status_changed_at, suspension_ends_at')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();
}

export async function fetchActiveCourseAccess(userId, courseId) {
  const result = await fetchActiveCourseAccesses({ userId, courseId });
  return {
    data: result.data?.[0] ?? null,
    error: result.error,
  };
}
