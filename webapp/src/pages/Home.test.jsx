import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';

vi.mock('../components/SEO', () => ({ default: () => null }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) }) } }));
afterEach(cleanup);
it('oriente vers les formations et le diagnostic, sans ouvrir le Lab au public', async () => {
  const { container } = render(<MemoryRouter><Home /></MemoryRouter>);
  await screen.findByText('Ivan');
  const hero = container.querySelector('.hero-actions');
  expect(within(hero).getAllByRole('link')).toHaveLength(2);
  expect(within(hero).getByText('Voir les formations')).toHaveAttribute('href', '#formations');
  expect(within(hero).getByText('Découvrir le Diagnostic IA')).toHaveAttribute('href', '/diagnostic-ia');
  const sections = [...container.querySelectorAll('section')];
  expect(sections.indexOf(container.querySelector('#formations'))).toBeLessThan(sections.indexOf(container.querySelector('.home-studio')));
  expect(screen.getByText(/espace de pratique réservé aux apprenants/)).toBeInTheDocument();
  expect(container.querySelector('a[href*="lab.formaprompt"]')).toBeNull();
  expect(container.querySelectorAll('h1')).toHaveLength(1);
  expect(screen.getByRole('link', { name: /Découvrir le parcours Agents IA/ })).toHaveAttribute('href', '/formation-agents-ia-workflows');
  expect(screen.getByText('À Calais, dans le Pas-de-Calais, et à distance')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Découvrir le parcours de Thierry FREZARD' })).toHaveAttribute('href', '/a-propos');
  expect(screen.getByRole('link', { name: 'Lire les recommandations publiques sur Superprof' })).toHaveAttribute('href', 'https://www.superprof.fr/formez-prompt-engineering-revolutionnez-facon-dinteragir-lia.html');
});
