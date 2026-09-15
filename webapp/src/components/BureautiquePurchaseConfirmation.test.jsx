import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentSuccess from '../pages/PaymentSuccess';

const mocks = vi.hoisted(() => ({
  readPurchase: vi.fn(),
  readAccess: vi.fn(),
  eq: vi.fn(),
  auth: { user: { id: 'local-user' } },
}));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('./SEO', () => ({ default: () => null }));
vi.mock('../lib/courseAccess', () => ({ fetchActiveCourseAccess: mocks.readAccess }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: () => {
  const query = {
    select: () => query,
    eq: (...args) => { mocks.eq(...args); return query; },
    maybeSingle: mocks.readPurchase,
  };
  return query;
} } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.auth.user = { id: 'local-user' };
});

function show(courseId, activation = '') {
  const suffix = activation ? `&activation=${activation}` : '';
  render(<MemoryRouter initialEntries={[`/paiement-reussi?course=${courseId}${suffix}`]}><PaymentSuccess /></MemoryRouter>);
}

it.each([
  ['excel-avance-individuel', 'Excel', '/course/excel-supports/excel-avance-individuel'],
  ['word-initiation-inter', 'Word', '/course/office-supports/word-initiation-inter'],
  ['powerpoint-initiation-individuel', 'PowerPoint', '/course/office-supports/powerpoint-initiation-individuel'],
])('ouvre les supports de %s uniquement après paiement et activation du droit exact', async (courseId, family, resourcePath) => {
  mocks.readPurchase.mockResolvedValue({ data: { id: 'purchase', course_id: courseId, payment_status: 'paid' }, error: null });
  mocks.readAccess.mockResolvedValue({ data: { id: 'access', course_id: courseId, status: 'active' }, error: null });
  show(courseId);
  expect(await screen.findByRole('heading', { name: `Votre inscription ${family} est enregistrée` })).toBeVisible();
  expect(mocks.eq).toHaveBeenCalledWith('course_id', courseId);
  expect(mocks.readAccess).toHaveBeenCalledWith('local-user', courseId);
  expect(screen.getByRole('link', { name: 'Accéder à mes exercices' })).toHaveAttribute('href', resourcePath);
  expect(screen.getByText(/formation reste accompagnée/i)).toBeVisible();
});

it('un paiement à activation différée ne donne pas accès aux supports', async () => {
  mocks.readPurchase.mockResolvedValue({ data: { payment_status: 'paid' }, error: null });
  mocks.readAccess.mockResolvedValue({ data: null, error: null });
  show('word-perfectionnement-individuel', 'deferred_after_withdrawal_period');
  expect(await screen.findByText(/sera activé selon le choix effectué/i)).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Accéder à mes exercices' })).not.toBeInTheDocument();
});

it('un achat remboursé ne présente pas un accès payé même si l URL de succès est conservée', async () => {
  mocks.readPurchase.mockResolvedValue({ data: { payment_status: 'refunded' }, error: null });
  mocks.readAccess.mockResolvedValue({ data: null, error: null });
  show('word-initiation-inter');
  expect(await screen.findByText(/confirmation ou l’activation.*n’est pas disponible/i)).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Votre inscription Word est enregistrée' })).not.toBeInTheDocument();
});
