import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import CockpitGlobalSearch from './CockpitGlobalSearch';

const entries = [
  {
    id: 'group-1',
    title: 'Entreprise Bêta — 8 participants concernés',
    detail: 'IA générative · 12 octobre',
    href: '/admin/dossiers?recherche=Entreprise%20B%C3%AAta',
    searchText: 'Entreprise Bêta Alice Durand IA générative',
  },
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderSearch() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <CockpitGlobalSearch entries={entries} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('CockpitGlobalSearch', () => {
  afterEach(cleanup);

  it('retrouve une entreprise, un apprenant ou une formation sans afficher les noms du groupe', async () => {
    renderSearch();
    const input = screen.getByRole('searchbox', { name: 'Que recherchez-vous ?' });
    await userEvent.type(input, 'Alice IA générative');
    expect(screen.getByText('Entreprise Bêta — 8 participants concernés')).toBeVisible();
    expect(screen.queryByText('Alice Durand')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir' })).toHaveAttribute('href', '/admin/dossiers?recherche=Entreprise%20B%C3%AAta');
  });

  it('propose la recherche complète dans l’annuaire lorsque le dossier local ne suffit pas', async () => {
    renderSearch();
    const input = screen.getByRole('searchbox', { name: 'Que recherchez-vous ?' });
    await userEvent.type(input, 'Société inconnue');
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher dans tous les apprenants' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/pedagogique?onglet=users&recherche=Soci%C3%A9t%C3%A9%20inconnue');
  });
});
