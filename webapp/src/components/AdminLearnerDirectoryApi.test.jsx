import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc } }));
import { fetchAdminLearnerDirectory } from '../lib/adminLearnerDirectoryApi';

describe('API annuaire apprenants', () => {
  beforeEach(() => rpc.mockReset());

  it('transmet recherche globale et page bornée à la RPC', async () => {
    rpc.mockResolvedValue({ data: { items: [], total: 0, limit: 25, offset: 25 }, error: null });
    await fetchAdminLearnerDirectory({ search: '  Élodie  ', page: 1 });
    expect(rpc).toHaveBeenCalledWith('admin_list_learners', { p_search: 'Élodie', p_limit: 25, p_offset: 25 });
  });

  it('distingue une réponse invalide d’une liste vide valide', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(fetchAdminLearnerDirectory()).rejects.toThrow('Annuaire apprenants indisponible');
  });
});
