import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreativityDashboardSection from './CreativityDashboardSection';
const mocks = vi.hoisted(() => ({ read: vi.fn(), eq: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: () => {
  const query = { select: () => query, in: () => query, eq: (...args) => { mocks.eq(...args); return query; }, then: (...args) => mocks.read().then(...args) };
  return query;
} } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('retrouve un achat payé même sans droit actif pour un démarrage différé ou bénéficiaire', async () => {
  mocks.read.mockResolvedValue({ data: [{ id: 'purchase', course_id: 'ia-creativite-individuel', payment_status: 'paid' }], error: null });
  render(<MemoryRouter><CreativityDashboardSection userId="local-user" /></MemoryRouter>);
  const link = await screen.findByRole('link', { name: 'Retrouver mon inscription' });
  expect(link).toHaveAttribute('href', '/paiement-reussi?course=ia-creativite-individuel');
  expect(screen.getByText(/Votre calendrier de réservation sera disponible dès l’activation de votre droit/)).toBeInTheDocument();
  expect(mocks.eq).toHaveBeenCalledWith('user_id', 'local-user');
  expect(mocks.eq).toHaveBeenCalledWith('payment_status', 'paid');
});

it('ne double pas la carte déjà présente pour un accès actif', async () => {
  mocks.read.mockResolvedValue({ data: [{ id: 'purchase', course_id: 'ia-creativite-individuel', payment_status: 'paid' }], error: null });
  render(<MemoryRouter><CreativityDashboardSection userId="local-user" activeCourseIds={['ia-creativite-individuel']} /></MemoryRouter>);
  await vi.waitFor(() => expect(mocks.read).toHaveBeenCalled());
  expect(screen.queryByRole('link', { name: 'Retrouver mon inscription' })).not.toBeInTheDocument();
});
