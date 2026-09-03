import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

const { fetchDiagnostics, accesses, auth, client } = vi.hoisted(() => ({
  fetchDiagnostics: vi.fn(), accesses: vi.fn(),
  auth: { user: { id: 'client-test', email: 'client@example.test' }, signOut: vi.fn() },
  client: { from: vi.fn() },
}));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../lib/supabaseClient', () => ({ supabase: client }));
vi.mock('../lib/diagnosticRestitution', async (importOriginal) => ({
  ...await importOriginal(), fetchClientDiagnostics: fetchDiagnostics,
}));
vi.mock('../lib/courseAccess', () => ({
  fetchCourseAccesses: accesses,
  fetchCourseAccessEntitlement: async () => ({ data: null, error: null }),
}));

describe('Dashboard : raccordement Diagnostic historique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accesses.mockResolvedValue({ data: [], error: null });
    client.from.mockImplementation(() => {
      const query = { then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve) };
      for (const method of ['select', 'eq', 'neq', 'in', 'order']) query[method] = () => query;
      return query;
    });
  });
  afterEach(() => cleanup());

  it('relie une commande payée à la réservation sans créer de droit formation', async () => {
    fetchDiagnostics.mockResolvedValue([{ order: { id: 'order-test', status: 'paid' }, booking: null }]);
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Réserver mon diagnostic' }))
      .toHaveAttribute('href', '/diagnostic-ia/reserver?order_id=order-test');
    expect(fetchDiagnostics).toHaveBeenCalledWith(client, 'client-test');
    expect(screen.getByText("Vous n'avez pas encore de formation")).toBeVisible();
    expect(accesses).toHaveBeenCalledWith({ userId: 'client-test' });
  });

  it('isole une erreur Diagnostic et conserve le tableau des formations', async () => {
    fetchDiagnostics.mockRejectedValue(new Error('erreur interne simulée'));
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Vos diagnostics ne peuvent pas être chargés');
    expect(screen.getByText("Vous n'avez pas encore de formation")).toBeVisible();
    expect(screen.queryByText(/erreur interne simulée/)).not.toBeInTheDocument();
  });
});
