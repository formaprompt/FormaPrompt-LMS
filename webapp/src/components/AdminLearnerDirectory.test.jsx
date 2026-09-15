import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../lib/adminLearnerDirectoryApi', () => ({ LEARNER_DIRECTORY_PAGE_SIZE: 25, fetchAdminLearnerDirectory: api.fetch }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ role: 'admin' }) }));
import AdminLearnerDirectory from './AdminLearnerDirectory';
import AdminShell from './AdminShell';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderDirectory({ role = 'admin', entry = '/admin/pedagogique?onglet=users' } = {}) {
  return render(<MemoryRouter initialEntries={[entry]}><AdminLearnerDirectory role={role} /><LocationProbe /></MemoryRouter>);
}

describe('annuaire administrateur des apprenants', () => {
  beforeEach(() => api.fetch.mockReset());
  afterEach(() => cleanup());

  it('recherche sur toute la source serveur et conserve le retour dans le lien UUID exact', async () => {
    api.fetch
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({ items: [{ userId: '72000000-0000-4000-8000-000000000002', fullName: 'Élodie Martin', email: 'elodie@example.test', organizationName: 'Société Démo', role: 'user' }], total: 1 });
    renderDirectory();
    await screen.findByText('Aucun apprenant enregistré.');
    fireEvent.change(screen.getByLabelText('Rechercher un apprenant'), { target: { value: '  Élodie   Société  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    await screen.findByRole('link', { name: 'Élodie Martin' });
    expect(api.fetch).toHaveBeenLastCalledWith({ search: 'Élodie   Société', page: 0 });
    expect(screen.getByRole('link', { name: 'Élodie Martin' })).toHaveAttribute('href', '/admin/apprenants/72000000-0000-4000-8000-000000000002?retourRecherche=%C3%89lodie+++Soci%C3%A9t%C3%A9');
    expect(screen.getByTestId('location')).toHaveTextContent('recherche=%C3%89lodie');
    expect(screen.getByText('elodie@example.test')).toBeVisible();
    expect(screen.getByText('Société Démo')).toBeVisible();
  });

  it('pagine au-delà de 25 comptes et conserve les rôles lisibles', async () => {
    api.fetch
      .mockResolvedValueOnce({ items: [{ userId: 'admin-id', fullName: null, email: 'admin@example.test', organizationName: null, role: 'admin' }], total: 26 })
      .mockResolvedValueOnce({ items: [{ userId: 'employee-id', fullName: null, email: 'employee@example.test', organizationName: null, role: 'employee' }], total: 26 });
    renderDirectory();
    expect(await screen.findByText('Administrateur')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(await screen.findByText('Employé')).toBeVisible();
    expect(api.fetch).toHaveBeenLastCalledWith({ search: '', page: 1 });
    expect(screen.getByTestId('location')).toHaveTextContent('page=2');
    expect(screen.getByRole('link', { name: 'employee@example.test' })).toHaveAttribute('href', '/admin/apprenants/employee-id?retourPage=2');
  });

  it('distingue une erreur de chargement d’une recherche sans résultat', async () => {
    api.fetch.mockRejectedValueOnce(new Error('permission denied')).mockResolvedValueOnce({ items: [], total: 0 });
    renderDirectory({ entry: '/admin/pedagogique?onglet=users&recherche=inconnu' });
    expect(await screen.findByRole('alert')).toHaveTextContent('indisponible');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Aucun apprenant ne correspond à cette recherche.')).toBeVisible();
  });

  it('refuse l’annuaire à un employé sans appeler la RPC', async () => {
    renderDirectory({ role: 'employee' });
    expect(screen.getByRole('alert')).toHaveTextContent('réservé aux administrateurs');
    await waitFor(() => expect(api.fetch).not.toHaveBeenCalled());
  });

  it('ignore une ancienne réponse lente après une nouvelle recherche', async () => {
    let resolveFirst;
    const first = new Promise((resolve) => { resolveFirst = resolve; });
    api.fetch
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ items: [{ userId: 'b-id', fullName: 'Béatrice', email: 'b@example.test', organizationName: null, role: 'user' }], total: 1 });
    renderDirectory();
    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Rechercher un apprenant'), { target: { value: 'Béatrice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(await screen.findByRole('link', { name: 'Béatrice' })).toBeVisible();
    resolveFirst({ items: [{ userId: 'a-id', fullName: 'Ancien résultat', email: 'a@example.test', organizationName: null, role: 'user' }], total: 1 });
    await waitFor(() => expect(screen.queryByText('Ancien résultat')).not.toBeInTheDocument());
  });

  it('réinitialise recherche et page quand le menu Apprenants est activé', async () => {
    api.fetch
      .mockResolvedValueOnce({ items: [{ userId: 'page-2', fullName: 'Camille Martin', email: 'camille@example.test', organizationName: 'Atelier', role: 'user' }], total: 26 })
      .mockResolvedValueOnce({ items: [{ userId: 'page-1', fullName: 'Alice Martin', email: 'alice@example.test', organizationName: null, role: 'user' }], total: 1 });
    render(<MemoryRouter initialEntries={['/admin/pedagogique?onglet=users&recherche=Atelier&page=2']}><AdminShell><AdminLearnerDirectory role="admin" /></AdminShell><LocationProbe /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Camille Martin' })).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Apprenants' }));
    expect(await screen.findByRole('link', { name: 'Alice Martin' })).toBeVisible();
    expect(api.fetch).toHaveBeenLastCalledWith({ search: '', page: 0 });
    expect(screen.getByLabelText('Rechercher un apprenant')).toHaveValue('');
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/pedagogique?onglet=users');
  });
});
