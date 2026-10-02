import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import App from '../App';
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../components/Layout', () => ({ default: () => <Outlet /> }));
vi.mock('../components/ScrollToTop', () => ({ default: () => null }));
vi.mock('react-cookie-consent', () => ({ default: () => null }));
vi.mock('./Dashboard', () => ({ default: () => <p>Espace privé autorisé</p> }));
vi.mock('./LearnerGettingStarted', () => ({ default: () => <p>Guide privé autorisé</p> }));
vi.mock('./Login', () => ({ default: function LoginFixture() { const location = useLocation(); return <p>Connexion {location.search}</p>; } }));
afterEach(() => { cleanup(); auth.user = null; });
describe('Protection des routes apprenant', () => {
  it.each(['/dashboard', '/aide/bien-demarrer'])('D : visite anonyme %s conserve la destination de connexion', async (path) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(await screen.findByText(/Connexion/)).toHaveTextContent(`?redirect=${encodeURIComponent(path)}`);
    expect(screen.queryByText(/privé autorisé/)).toBeNull();
  });
  it('D : session expirée retire le guide et revient vers connexion', async () => {
    auth.user = { id: 'account-a' };
    const view = render(<MemoryRouter initialEntries={['/aide/bien-demarrer']}><App /></MemoryRouter>);
    expect(await screen.findByText('Guide privé autorisé')).toBeVisible();
    auth.user = null; view.rerender(<MemoryRouter initialEntries={['/aide/bien-demarrer']}><App /></MemoryRouter>);
    expect(await screen.findByText(/Connexion/)).toBeVisible(); expect(screen.queryByText('Guide privé autorisé')).toBeNull();
  });
});
