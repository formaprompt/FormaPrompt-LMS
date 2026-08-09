import { supabase } from './supabaseClient.js';
import {
  isCourseAccessUnavailable,
  mapPurchaseToCourseAccess,
} from './courseAccessAvailability.js';

export async function fetchActiveCourseAccesses({ userId, courseId } = {}) {
  let accessQuery = supabase
    .from('course_access')
    .select('id, user_id, course_id, status, granted_at, access_source, purchase_id, expires_at')
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (userId) accessQuery = accessQuery.eq('user_id', userId);
  if (courseId) accessQuery = accessQuery.eq('course_id', courseId);

  const accessResult = await accessQuery;
  if (!isCourseAccessUnavailable(accessResult.error)) return accessResult;

  // Compatibilité de déploiement : tant que la migration course_access n'est
  // pas appliquée, les achats historiques restent la source d'accès existante.
  let purchaseQuery = supabase
    .from('purchases')
    .select('id, user_id, course_id, purchased_at, payment_status');

  if (userId) purchaseQuery = purchaseQuery.eq('user_id', userId);
  if (courseId) purchaseQuery = purchaseQuery.eq('course_id', courseId);

  const purchaseResult = await purchaseQuery;
  return {
    ...purchaseResult,
    data: purchaseResult.data?.map(mapPurchaseToCourseAccess) ?? null,
  };
}

export async function fetchActiveCourseAccess(userId, courseId) {
  const result = await fetchActiveCourseAccesses({ userId, courseId });
  return {
    data: result.data?.[0] ?? null,
    error: result.error,
  };
}
