import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FormationIagElearning from './FormationIagElearning';
const world = vi.hoisted(() => ({ user: null, entitlement: vi.fn() }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: world.user }) }));
vi.mock('../lib/courseAccess', () => ({ fetchCourseAccessEntitlement: (...args) => world.entitlement(...args) }));
vi.mock('../components/SEO', () => ({ default: () => null }));
vi.mock('../components/CommercialCheckout', () => ({ default: ({ hasActiveAccess, activeAccessActions, priceLabel, accessLoading, courseId }) =>
  hasActiveAccess ? activeAccessActions : <button disabled={accessLoading} data-course={courseId}>Inscription {priceLabel}</button> }));
const mount = () => render(<MemoryRouter><FormationIagElearning /></MemoryRouter>);
afterEach(() => { cleanup(); world.user = null; world.entitlement.mockReset(); vi.useRealTimers(); });

it('presents 22 real public lesson titles, seven stages and the agreed commitments', () => {
  mount();
  const programme = document.getElementById('programme');
  expect(programme.querySelectorAll('details')).toHaveLength(7);
  expect(programme.querySelectorAll('li')).toHaveLength(22);
  expect(document.querySelector('main')).toBeNull(); // App already owns #main-content.
  expect(within(programme).getByText('Corriger sans tout recommencer')).toBeInTheDocument();
  expect(screen.getByText('Environ 13 heures')).toBeInTheDocument();
  expect(screen.getByText(/Avant l’accès aux leçons, le questionnaire de départ est obligatoire/)).toBeInTheDocument();
  expect(screen.getByText(/FormaPrompt Studio reste facultatif, mais conseillé !/)).toBeInTheDocument();
  expect(screen.getByText(/deux jours calendaires.*week-ends et jours fériés compris/)).toBeInTheDocument();
  expect(screen.getByText(/Une nouvelle remise du même travail est incluse/)).toBeInTheDocument();
  expect(screen.getByText(/Aucun seuil de note ne la déclenche automatiquement/)).toBeInTheDocument();
});
it.each([['2026-12-31T22:59:59Z', '79'], ['2026-12-31T23:00:00Z', '99']])('uses the existing offer clock at %s', (date, price) => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(date)); mount();
  expect(screen.getByRole('button', { name: new RegExp(`Inscription ${price}`) })).toHaveAttribute('data-course', 'formation-ia-generative-elearning');
  expect(screen.getByRole('link', { name: 'M’inscrire à la formation' })).toHaveAttribute('href', '#inscription');
  expect(document.querySelector('s, del')).toBeNull();
});
it('takes an active learner straight to the course without a purchase action', async () => {
  world.user = { id: 'fixture-a' }; world.entitlement.mockResolvedValue({ data: { status: 'active' }, error: null }); mount();
  const links = await screen.findAllByRole('link', { name: 'Accéder à ma formation' });
  expect(links).toHaveLength(2);
  links.forEach(link => expect(link).toHaveAttribute('href', '/course/formation-ia-generative-elearning'));
  expect(screen.queryByRole('button', { name: /Inscription/ })).not.toBeInTheDocument();
});
it.each(['revoked', 'suspended', 'refunded'])('does not reactivate an existing %s right', async status => {
  world.user = { id: 'fixture-a' }; world.entitlement.mockResolvedValue({ data: { status }, error: null }); mount();
  expect(await screen.findByText(/Un accès existe déjà pour ce compte/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Inscription/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Accéder à ma formation' })).not.toBeInTheDocument();
});
it('keeps access failures closed', async () => {
  world.user = { id: 'fixture-a' }; world.entitlement.mockResolvedValue({ data: null, error: new Error('synthetic') }); mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Votre accès ne peut pas être vérifié');
  expect(screen.queryByRole('button', { name: /Inscription/ })).not.toBeInTheDocument();
});
it('ignores an entitlement response from the previous account', async () => {
  let oldResolve; world.user = { id: 'fixture-a' };
  world.entitlement.mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve; })).mockResolvedValueOnce({ data: null, error: null });
  const view = mount(); world.user = { id: 'fixture-b' };
  view.rerender(<MemoryRouter><FormationIagElearning /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('button', { name: /Inscription/ })).not.toBeDisabled());
  oldResolve({ data: { status: 'active' }, error: null });
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Accéder à ma formation' })).not.toBeInTheDocument());
});
