import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminQuality from './AdminQuality';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), createComplaint: vi.fn(), updateComplaint: vi.fn(),
  createAction: vi.fn(), updateAction: vi.fn(), createRisk: vi.fn(), updateRisk: vi.fn(),
}));
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ role: 'admin', user: { id: 'admin-1' } }) }));
vi.mock('../lib/qualityAdministration', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, fetchQualityAdministration: mocks.fetch, createComplaint: mocks.createComplaint, updateComplaint: mocks.updateComplaint, createQualityAction: mocks.createAction, updateQualityAction: mocks.updateAction, createQualityRisk: mocks.createRisk, updateQualityRisk: mocks.updateRisk };
});

const dataset = (overrides = {}) => ({
  records: [{ id: 'r1', title: 'Réclamation sans réponse', factual_description: 'Le client attend une réponse documentée.', severity: 'high', status: 'open', detected_at: '2026-08-20T10:00:00Z' }],
  complaints: [{ quality_record_id: 'r1', outcome: 'pending', acknowledged_at: null, received_at: '2026-08-20T10:00:00Z', response_due_at: '2026-08-21T10:00:00Z' }],
  actions: [{ id: 'a1', quality_record_id: 'r1', title: 'Corriger le support', action_description: 'Mettre à jour le document apprenant.', priority: 'high', status: 'planned', responsible_user_id: 'admin-1', due_at: '2026-08-21T10:00:00Z' }],
  risks: [{ id: 'risk1', quality_record_id: 'r1', title: 'Insatisfaction', risk_description: 'Risque de réponse tardive au client.', likelihood: 4, impact: 4, risk_score: 16, status: 'identified', treatment_strategy: 'mitigate', owner_user_id: 'admin-1' }],
  profiles: [{ id: 'admin-1', full_name: 'Thierry', role: 'admin' }], ...overrides,
});

describe('AdminQuality', () => {
  beforeEach(() => { mocks.fetch.mockResolvedValue(dataset()); Object.values(mocks).slice(1).forEach((mock) => mock.mockResolvedValue({})); });
  afterEach(() => { cleanup(); Object.values(mocks).forEach((mock) => mock.mockReset()); });

  it('place les réclamations client avant le registre interne et expose les actions liées', async () => {
    render(<AdminQuality />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement');
    const heading = await screen.findByRole('heading', { name: 'Réclamations à traiter maintenant' });
    expect(heading).toBeVisible();
    expect(screen.getByText('Accusé attendu')).toBeVisible();
    expect(screen.getByText('Réclamation sans réponse').closest('article')).toHaveTextContent('Actions liées1');
    expect(heading.compareDocumentPosition(screen.getByRole('navigation', { name: 'Vues du registre' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('présente un état vide positif', async () => {
    mocks.fetch.mockResolvedValue(dataset({ records: [], complaints: [], actions: [], risks: [] }));
    render(<AdminQuality />);
    expect(await screen.findByText('Aucune réclamation ouverte actuellement.')).toBeVisible();
  });

  it('permet d’accuser réception via le RPC dédié', async () => {
    render(<AdminQuality />);
    const card = (await screen.findByText('Réclamation sans réponse')).closest('article');
    await userEvent.click(within(card).getByText('Traiter la réclamation'));
    await userEvent.click(within(card).getByRole('button', { name: 'Accuser réception' }));
    expect(mocks.updateComplaint).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ qualityRecordId: 'r1', acknowledgedAt: expect.any(String) }));
  });

  it('affiche une erreur récupérable', async () => {
    mocks.fetch.mockRejectedValue(new Error('permission denied'));
    render(<AdminQuality />);
    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied');
  });
});
