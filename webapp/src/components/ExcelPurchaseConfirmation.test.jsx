import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentSuccess from '../pages/PaymentSuccess';

const { read, eq, auth } = vi.hoisted(() => ({ read: vi.fn(), eq: vi.fn(), auth: { user: { id: 'local-user' } } }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => auth }));
vi.mock('./SEO', () => ({ default: () => null }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: () => {
  const query = { select: () => query, eq: (...args) => { eq(...args); return query; }, maybeSingle: read };
  return query;
} } }));
afterEach(() => { cleanup(); read.mockReset(); eq.mockReset(); auth.user = { id: 'local-user' }; });

function show() { render(<MemoryRouter initialEntries={['/paiement-reussi?course=excel-avance-individuel']}><PaymentSuccess /></MemoryRouter>); }

it('confirme uniquement un achat payé du bon utilisateur et ne propose aucun cours IA ou calendrier fictif', async () => {
  read.mockResolvedValue({ data: { id: 'purchase', course_id: 'excel-avance-individuel', payment_status: 'paid' }, error: null });
  show();
  expect(await screen.findByRole('heading', { name: 'Votre inscription Excel est enregistrée' })).toBeVisible();
  expect(eq).toHaveBeenCalledWith('user_id', 'local-user');
  expect(eq).toHaveBeenCalledWith('course_id', 'excel-avance-individuel');
  expect(screen.getByText(/Excel Avancé – Individuel/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Organiser ma formation Excel' })).toHaveAttribute('href', '/contact');
  expect(screen.queryByText(/AI Act/)).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Commencer la formation|Réserver/ })).not.toBeInTheDocument();
});

it('ne prend pas l’URL de succès pour une preuve de paiement', async () => {
  read.mockResolvedValue({ data: null, error: { message: 'Indisponible' } });
  show();
  expect(await screen.findByText(/La confirmation de votre achat n’est pas disponible/)).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Votre inscription Excel est enregistrée' })).not.toBeInTheDocument();
});

it('un achat remboursé ne présente pas une confirmation payée', async () => {
  read.mockResolvedValue({ data: { payment_status: 'refunded' }, error: null });
  show();
  expect(await screen.findByText(/La confirmation de votre achat n’est pas disponible/)).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Votre inscription Excel est enregistrée' })).not.toBeInTheDocument();
});
