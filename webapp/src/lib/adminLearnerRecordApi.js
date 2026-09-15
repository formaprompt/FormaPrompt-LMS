import { supabase } from './supabaseClient';

export async function fetchAdminLearnerRecord(userId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId || '')) {
    throw new Error('Identifiant apprenant invalide.');
  }
  const { data, error } = await supabase.rpc('admin_get_learner_record', { p_user_id: userId });
  if (error) throw error;
  if (!data?.identity?.userId) throw new Error('Fiche apprenant indisponible.');
  return data;
}
