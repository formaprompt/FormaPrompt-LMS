import { supabase } from './supabaseClient';

export const LEARNER_DIRECTORY_PAGE_SIZE = 25;

export async function fetchAdminLearnerDirectory({ search = '', page = 0 } = {}) {
  const safePage = Number.isInteger(page) && page >= 0 ? page : 0;
  const normalizedSearch = String(search || '').trim().slice(0, 200);
  const { data, error } = await supabase.rpc('admin_list_learners', {
    p_search: normalizedSearch || null,
    p_limit: LEARNER_DIRECTORY_PAGE_SIZE,
    p_offset: safePage * LEARNER_DIRECTORY_PAGE_SIZE,
  });
  if (error) throw error;
  if (!data || !Array.isArray(data.items) || !Number.isInteger(data.total)) {
    throw new Error('Annuaire apprenants indisponible.');
  }
  return data;
}
