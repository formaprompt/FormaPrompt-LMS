import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminWithdrawalRequests from './AdminWithdrawalRequests';

const mocks = vi.hoisted(() => ({ role: 'admin', fetch: vi.fn(), update: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ role: mocks.role }) }));
vi.mock('../lib/withdrawalAdministration', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchWithdrawalRequests: mocks.fetch,
  updateWithdrawalRequest: mocks.update,
}));

const request = (overrides = {}) => ({
  id: 'withdrawal-1', claimant_first_name: 'Camille', claimant_last_name: 'Martin',
  acknowledgement_email: 'camille@example.test', course_id: 'formation-ia', purchase_id: 'purchase-1',
  declaration: 'Je confirme demander la retractation de cet achat de formation.',
  status: 'received', received_at: '2026-08-23T08:00:00Z', reviewed_at: null,
  acknowledgement_delivery_status: 'sent', admin_note: null, ...overrides,
});

describe('AdminWithdrawalRequests', () => {
  beforeEach(() => {
    mocks.role = 'admin';
    mocks.fetch.mockResolvedValue([request()]);
    mocks.update.mockResolvedValue(request({ status: 'under_review' }));
  });
  afterEach(() => { cleanup(); mocks.fetch.mockReset(); mocks.update.mockReset(); });

  it('affiche les informations utiles et instruit une demande avec un motif', async () => {
    render(<AdminWithdrawalRequests />);
    expect(await screen.findByRole('heading', { name: 'Camille Martin' })).toBeVisible();
    expect(screen.getByText('Accusé envoyé')).toBeVisible();
    await userEvent.type(screen.getByLabelText('Motif administratif obligatoire'), 'Instruction initiale documentée.');
    await userEvent.click(screen.getByRole('button', { name: 'Commencer l’instruction' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(
      expect.anything(), 'withdrawal-1', 'under_review', 'Instruction initiale documentée.',
    ));
  });

  it('propose une decision puis la cloture selon le statut existant', async () => {
    mocks.fetch.mockResolvedValueOnce([request({ status: 'under_review', reviewed_at: '2026-08-23T10:00:00Z' })]);
    const view = render(<AdminWithdrawalRequests />);
    expect(await screen.findByRole('button', { name: 'Accepter' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refuser' })).toBeDisabled();
    view.unmount();
    mocks.fetch.mockResolvedValueOnce([request({ status: 'accepted' })]);
    render(<AdminWithdrawalRequests />);
    expect(await screen.findByRole('button', { name: 'Clôturer' })).toBeVisible();
  });

  it('gere les etats vide et erreur', async () => {
    mocks.fetch.mockResolvedValueOnce([]);
    const view = render(<AdminWithdrawalRequests />);
    expect(await screen.findByText('Aucune demande de rétractation pour ces critères.')).toBeVisible();
    view.unmount();
    mocks.fetch.mockRejectedValueOnce(new Error('RPC indisponible'));
    render(<AdminWithdrawalRequests />);
    expect(await screen.findByRole('alert')).toHaveTextContent('RPC indisponible');
  });

  it('refuse toute consultation a un non-administrateur', () => {
    mocks.role = 'user';
    render(<AdminWithdrawalRequests />);
    expect(screen.getByRole('alert')).toHaveTextContent('Accès réservé');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
