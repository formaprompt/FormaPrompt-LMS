import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentSuccess from '../pages/PaymentSuccess';
const mocks = vi.hoisted(() => ({ read: vi.fn(), eq: vi.fn(), auth: { user: { id: 'local-user' } } }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('./SEO', () => ({ default: () => null }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: () => {
  const query = { select: () => query, eq: (...args) => { mocks.eq(...args); return query; }, maybeSingle: mocks.read };
  return query;
} } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.auth.user = { id: 'local-user' }; });
const show = id => render(<MemoryRouter initialEntries={[`/paiement-reussi?course=${id}&activation=deferred_after_withdrawal_period`]}><PaymentSuccess /></MemoryRouter>);

it.each(['ia-creativite-individuel', 'ia-creativite-ecole-association'])('confirme %s sur preuve serveur sans cours numérique par défaut', async id => {
  mocks.read.mockResolvedValue({ data: { id: 'purchase', course_id: id, payment_status: 'paid' }, error: null });
  const { container } = show(id);
  expect(await screen.findByRole('heading', { name: 'Votre paiement est confirmé' })).toBeInTheDocument();
  expect(mocks.eq).toHaveBeenCalledWith('user_id', 'local-user');
  expect(mocks.eq).toHaveBeenCalledWith('course_id', id);
  expect(screen.getByRole('link', { name: id === 'ia-creativite-individuel' ? 'Retrouver mon calendrier de réservation' : 'Organiser ma formation' })).toHaveAttribute('href', id === 'ia-creativite-individuel' ? '/dashboard' : '/contact');
  if (id === 'ia-creativite-individuel') expect(screen.getByText(/Le calendrier de réservation de vos 14 heures/)).toHaveTextContent('dès l’activation de votre droit');
  expect(container.querySelector('a[href^="/course/"]')).toBeNull();
  expect(screen.getByText(/dans le respect du choix effectué/)).toBeInTheDocument();
});

it.each(['ia-creativite-individuel', 'ia-creativite-groupe', 'ia-creativite-ecole-association'])('une URL de succès conservée après remboursement de %s affiche son état exact', async id => {
  mocks.read.mockResolvedValue({ data: { payment_status: 'refunded' }, error: null });
  show(id);
  expect(await screen.findByRole('heading', { name: 'Votre paiement a été remboursé' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Commander et payer/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Le paiement n’est pas confirmé/)).not.toBeInTheDocument();
  expect(screen.queryByText(/groupe n’ouvre pas/)).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Votre paiement est confirmé' })).not.toBeInTheDocument();
});

it('le paiement du groupe ne confirme pas son ouverture et rappelle le remboursement intégral', async () => {
  mocks.read.mockResolvedValue({ data: { id: 'purchase', course_id: 'ia-creativite-groupe', payment_status: 'paid' }, error: null });
  show('ia-creativite-groupe');
  expect(await screen.findByRole('heading', { name: 'Votre paiement est confirmé' })).toBeInTheDocument();
  expect(screen.getByText(/Votre paiement ne vaut pas confirmation de l’ouverture du groupe/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Choisir ma session de groupe' })).toHaveAttribute('href', '/dashboard#creativity-group-sessions');
  expect(screen.getByText(/Dès l’activation de votre droit/)).toBeInTheDocument();
  expect(screen.getByText(/Remboursement intégral si le groupe n’ouvre pas/)).toHaveTextContent('dès l’inscription');
});

it('demande une connexion sans prétendre que le paiement est confirmé', () => {
  mocks.auth.user = null;
  show('ia-creativite-ecole-association');
  expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toContain('redirect=');
  expect(mocks.read).not.toHaveBeenCalled();
});
