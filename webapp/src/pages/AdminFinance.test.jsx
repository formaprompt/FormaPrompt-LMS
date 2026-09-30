import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminFinance from './AdminFinance';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ role: 'admin' }) }));
vi.mock('../lib/financeAdministration', async (importOriginal) => ({ ...(await importOriginal()), fetchFinanceAdministration: fetchMock }));

function renderPage() { return render(<MemoryRouter><AdminFinance /></MemoryRouter>); }
describe('AdminFinance', () => {
  beforeEach(() => fetchMock.mockResolvedValue({ rows: [{ stripe_mode: 'live', currency: 'eur', gross_training_cents: 100000, travel_fee_cents: 15000, successful_refund_cents: 10000, open_dispute_cents: 5000, lost_dispute_cents: 2000, estimated_net_stripe_cents: 103000, estimated_net_training_cents: 88000 }], openCases: [{ id: 'case-1' }] }));
  afterEach(() => { cleanup(); fetchMock.mockReset(); });
  it('distingue les flux et avertit que le net est une estimation', async () => {
    renderPage();
    expect(await screen.findByText('Formation encaissée brute')).toBeVisible();
    expect(screen.getByText('Frais de déplacement').closest('article')).toHaveTextContent('150,00 €');
    expect(screen.getByText('Net Stripe estimé').closest('article')).toHaveTextContent('ni le solde Stripe ni le solde bancaire');
    expect(screen.getByText(/1 cas nécessite/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ouvrir le registre Stripe' })).toHaveAttribute('href', '/admin/stripe-apres-paiement');
  });
  it('applique les filtres sans lancer de réconciliation', async () => {
    renderPage(); await screen.findByText('Formation encaissée brute');
    await userEvent.selectOptions(screen.getByLabelText('Formation'), 'formation-ia-act');
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ courseId: 'formation-ia-act' })));
  });
  it('gère les états vide et erreur', async () => {
    fetchMock.mockResolvedValueOnce({ rows: [], openCases: [] });
    const view = renderPage();
    expect(await screen.findByText('Aucun encaissement Stripe pour ce mode sur cette période.')).toBeVisible();
    view.unmount(); fetchMock.mockRejectedValueOnce(new Error('Vue indisponible')); renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Vue indisponible');
  });
  it('affiche les réels par défaut et permet de contrôler tests et modes indéterminés séparément', async () => {
    fetchMock.mockResolvedValueOnce({ rows: [
      { stripe_mode: 'live', currency: 'eur', gross_training_cents: 935, successful_refund_cents: 935, estimated_net_stripe_cents: 0 },
      { stripe_mode: 'test', currency: 'eur', gross_training_cents: 18700, estimated_net_stripe_cents: 18700 },
      { stripe_mode: 'unknown', currency: 'eur', gross_training_cents: 3000, estimated_net_stripe_cents: 3000 },
    ], openCases: [] });
    renderPage();
    expect(await screen.findByText('Formation encaissée brute')).toBeVisible();
    expect(screen.getByText('Net Stripe estimé').closest('article')).toHaveTextContent('0,00 €');
    expect(screen.getByText(/1 transaction\(s\) de test et 1 de mode indéterminé exclues/)).toBeVisible();
    const initialFetchCount = fetchMock.mock.calls.length;
    await userEvent.selectOptions(screen.getByLabelText('Mode Stripe'), 'test');
    expect(screen.getByText('Net Stripe estimé').closest('article')).toHaveTextContent('187,00 €');
    await userEvent.selectOptions(screen.getByLabelText('Mode Stripe'), 'unknown');
    expect(screen.getByText('Net Stripe estimé').closest('article')).toHaveTextContent('30,00 €');
    expect(fetchMock).toHaveBeenCalledTimes(initialFetchCount);
  });
});
