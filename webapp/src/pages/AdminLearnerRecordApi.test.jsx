import { describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc: rpcMock } }));
import { fetchAdminLearnerRecord } from '../lib/adminLearnerRecordApi';

describe('API de fiche apprenant', () => {
  it.each(['', 'learner-id', '72000000-0000-0000-0000-000000000002'])('refuse un identifiant absent ou mal formé : %s', async (userId) => {
    await expect(fetchAdminLearnerRecord(userId)).rejects.toThrow('Identifiant apprenant invalide');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
