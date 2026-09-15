import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FormationWord from './FormationWord';
import FormationPowerPoint from './FormationPowerPoint';

vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../lib/courseAccess', () => ({ fetchActiveCourseAccess: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('../components/SEO', () => ({
  default: ({ url }) => <span hidden data-testid="canonical" data-url={url} />,
}));

afterEach(cleanup);

it.each([
  [FormationWord, 'Formations Word : Initiation et Perfectionnement', 'https://formaprompt.com/formation-word', 2],
  [FormationPowerPoint, 'Formation PowerPoint Initiation', 'https://formaprompt.com/formation-powerpoint', 1],
])('présente %s avec le programme approuvé et la grille bureautique commune', (Page, heading, canonical, programmeCount) => {
  const { container } = render(<MemoryRouter><Page /></MemoryRouter>);

  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  expect(screen.getByTestId('canonical')).toHaveAttribute('data-url', canonical);
  expect(screen.getAllByRole('article', { name: /- / })).toHaveLength(programmeCount);

  const prices = screen.getByRole('region', { name: 'Choisissez votre modalité de formation' });
  for (const [mode, price] of [
    ['Inter-entreprises', '690 €'],
    ['Intra-entreprise', '1 590 €'],
    ['Accompagnement individuel', '990 €'],
  ]) {
    const card = within(prices).getByRole('heading', { name: mode }).closest('article');
    expect(card).toHaveTextContent(price);
  }
  expect(prices).toHaveTextContent('14 h');
  expect(screen.getByRole('heading', { name: 'Évaluation des acquis' }).closest('article')).toHaveTextContent('distinct de l’évaluation finale');
  expect(screen.getByRole('heading', { name: 'Évaluation des acquis' }).closest('article')).toHaveTextContent('grille de critères');
  expect(container.querySelector('form')).toBeNull();
});

it.each([
  [FormationWord, ['Word Initiation', 'Word Perfectionnement']],
  [FormationPowerPoint, ['PowerPoint Initiation']],
])('réserve l achat direct à inter et individuel et conserve l intra sur devis', async (Page, levels) => {
  render(<MemoryRouter><Page /></MemoryRouter>);
  for (const level of levels) {
    const summary = screen.getByText(`Tarifs et inscription — ${level}`);
    await userEvent.click(summary);
    const enrollment = summary.closest('details');
    expect(within(enrollment).getByRole('radio', { name: /Inter-entreprises.*690 €/ })).toBeVisible();
    expect(within(enrollment).getByRole('radio', { name: /Accompagnement individuel.*990 €/ })).toBeVisible();
    expect(within(enrollment).getByRole('link', { name: 'Demander un devis intra' })).toHaveAttribute('href', '/contact');
    expect(enrollment).toHaveTextContent('1 590 € / groupe jusqu’à 8 participants');
  }
});
