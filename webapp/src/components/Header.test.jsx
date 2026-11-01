import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Header from './Header';

const auth = vi.hoisted(() => ({ user: null, role: null }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => auth }));
afterEach(() => { cleanup(); auth.user = null; auth.role = null; document.body.style.overflow = ''; });
const mount = () => render(<MemoryRouter><Header /></MemoryRouter>);
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="header-location">{location.pathname}</output>;
}

function showMobileControls() {
  const actions = document.querySelector('.mobile-header-actions');
  if (actions) actions.style.display = 'flex';
  document.querySelector('.mobile-menu-btn').style.display = 'block';
}

describe('Navigation publique', () => {
  it('expose le parcours e-learning au clavier et ferme le menu mobile après sélection', async () => {
    const user = userEvent.setup(); mount(); showMobileControls();
    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    const group = screen.getByRole('button', { name: 'Formations' });
    group.focus(); await user.keyboard('{Enter}'); await user.tab(); await user.tab();
    const link = screen.getByRole('link', { name: 'IA générative — e-learning' });
    expect(link).toHaveFocus(); expect(link).toHaveAttribute('href', '/formation-ia-generative-elearning');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Ouvrir le menu' })).toHaveAttribute('aria-expanded', 'false');
  });
  it('ouvre au clavier puis ferme un groupe avec Échap et restitue le focus', async () => {
    const user = userEvent.setup();
    mount();
    const button = screen.getByRole('button', { name: 'Formations' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Agents IA & Workflows' })).toHaveAttribute('href', '/formation-agents-ia-workflows');
    expect(screen.getByRole('link', { name: 'IA et créativité' })).toHaveAttribute('href', '/formation-ia-creativite');
    await user.tab();
    expect(screen.getByRole('link', { name: 'IA Générative' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
  it('ferme le groupe après sélection et expose le contact sans accès public au Lab', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Header /><LocationProbe /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Ressources' }));
    const resourceLinks = [...document.querySelector('#navigation-ressources').querySelectorAll('a')];
    expect(screen.getByRole('link', { name: 'Guide Gemini' })).toHaveAttribute('href', '/guides/gemini-guide-pratique');
    expect(screen.getByRole('link', { name: 'Guide GPT‑6 et GPT‑6.1' })).toHaveAttribute('href', '/guide-gpt-6-codex');
    expect(resourceLinks.map(link => link.getAttribute('href'))).toEqual([
      '/blog', '/studio', '/guides', '/guides/claude-guide-pratique', '/guides/copilot-guide-pratique', '/guides/gemini-guide-pratique',
      '/guide-gpt-6-codex', '/guide-gpt-5-6-codex',
    ]);
    await user.tab();
    expect(screen.getByRole('link', { name: 'Blog' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('header-location')).toHaveTextContent('/blog');
    expect(screen.getByRole('button', { name: 'Ressources' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Ressources' }));
    expect(screen.getByRole('link', { name: 'Guides pratiques' })).toHaveAttribute('href', '/guides');
    await user.click(screen.getByRole('link', { name: 'Studio — outil gratuit' }));
    expect(screen.getByRole('button', { name: 'Ressources' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.queryByRole('link', { name: /Training Lab/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: 'Aide' })).not.toBeInTheDocument();
  });
  it('restaure le défilement et le focus après fermeture du menu mobile', async () => {
    const user = userEvent.setup();
    mount();
    // jsdom n'applique pas les media queries : rendre le contrôle mobile visible.
    showMobileControls();
    const button = screen.getByRole('button', { name: 'Ouvrir le menu' });
    await user.click(button);
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
    expect(button).toHaveFocus();
  });
  it.each(['user', 'admin', 'employee'])('préserve les raccourcis du rôle %s', (role) => {
    auth.user = { id: 'local-test' }; auth.role = role;
    mount();
    expect(screen.getAllByRole('link', { name: /Espace apprenant/ })[0]).toHaveAttribute('href', '/dashboard');
    expect(screen.queryAllByRole('link', { name: 'Admin' }).length).toBe(role === 'user' ? 0 : 1);
    expect(screen.getByRole('link', { name: 'Aide' })).toHaveAttribute('href', '/aide/bien-demarrer');
  });
  it('expose Aide dans le raccourci mobile connecté', () => {
    auth.user = { id: 'local-test' }; auth.role = 'user'; mount();
    document.querySelector('.mobile-header-actions').style.display = 'flex';
    expect(screen.getAllByRole('link', { name: 'Aide' })).toHaveLength(2);
  });

  it.each(['admin', 'employee', 'user', null])('garde le menu indépendant des raccourcis et navigable au clavier pour %s', async (role) => {
    auth.user = role ? { id: 'local-header-test' } : null;
    auth.role = role;
    const user = userEvent.setup();
    render(<MemoryRouter><Header /><LocationProbe /></MemoryRouter>);
    showMobileControls();
    const button = screen.getByRole('button', { name: 'Ouvrir le menu' });
    expect(button.closest('.mobile-header-actions')).toBeNull();
    if (role) {
      const actions = document.querySelector('.mobile-header-actions');
      expect(actions).toHaveTextContent('Espace apprenant');
      expect(actions).toHaveTextContent('Aide');
      const adminShortcut = actions.querySelector('a[href="/admin"]');
      if (role === 'user') expect(adminShortcut).toBeNull();
      else expect(adminShortcut).toHaveAttribute('href', '/admin');
    } else {
      expect(document.querySelector('.mobile-header-actions')).toBeNull();
    }
    document.body.style.overflow = 'auto';
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(screen.getByRole('button', { name: 'Formations' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Formations' })).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('auto');
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Formations' }));
    await user.click(screen.getByRole('link', { name: 'IA et créativité' }));
    expect(screen.getByTestId('header-location')).toHaveTextContent('/formation-ia-creativite');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });
});
