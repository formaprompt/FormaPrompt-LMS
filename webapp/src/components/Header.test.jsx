import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';

const auth = vi.hoisted(() => ({ user: null, role: null }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => auth }));
afterEach(() => { cleanup(); auth.user = null; auth.role = null; });
const mount = () => render(<MemoryRouter><Header /></MemoryRouter>);

describe('Navigation publique', () => {
  it('ouvre au clavier puis ferme un groupe avec Échap et restitue le focus', async () => {
    const user = userEvent.setup();
    mount();
    const button = screen.getByRole('button', { name: 'Formations' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    expect(screen.getByRole('link', { name: 'IA Générative' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
  it('ferme le groupe après sélection et expose le contact sans accès public au Lab', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Outils et ressources' }));
    await user.click(screen.getByRole('link', { name: 'Studio — outil gratuit' }));
    expect(screen.getByRole('button', { name: 'Outils et ressources' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.queryByRole('link', { name: /Training Lab/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/login');
  });
  it('restaure le défilement et le focus après fermeture du menu mobile', async () => {
    const user = userEvent.setup();
    mount();
    // jsdom n'applique pas les media queries : rendre le contrôle mobile visible.
    document.querySelector('.mobile-header-actions').style.display = 'flex';
    document.querySelector('.mobile-menu-btn').style.display = 'block';
    const button = screen.getByRole('button', { name: 'Ouvrir le menu' });
    await user.click(button);
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
    expect(button).toHaveFocus();
  });
  it.each(['student', 'admin', 'employee'])('préserve les raccourcis du rôle %s', (role) => {
    auth.user = { id: 'local-test' }; auth.role = role;
    mount();
    expect(screen.getAllByRole('link', { name: /Espace apprenant/ })[0]).toHaveAttribute('href', '/dashboard');
    expect(screen.queryAllByRole('link', { name: 'Admin' }).length).toBe(role === 'student' ? 0 : 1);
  });
});
