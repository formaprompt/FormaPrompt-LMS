import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Header from '../components/Header';

const { auth } = vi.hoisted(() => ({ auth: { user: null, role: null } }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));

describe('navigation vers le Diagnostic historique', () => {
  beforeEach(() => { auth.user = null; auth.role = null; });
  afterEach(() => cleanup());

  it('rend le Diagnostic accessible depuis le menu public', () => {
    render(<MemoryRouter><Header /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Diagnostic IA' })).toHaveAttribute('href', '/diagnostic-ia');
  });

  it('conserve le retour Diagnostic entre connexion et inscription', () => {
    render(<MemoryRouter initialEntries={['/login?redirect=%2Fdiagnostic-ia%23reserver']}><Login /></MemoryRouter>);
    expect(screen.getByRole('link', { name: "S'inscrire" }))
      .toHaveAttribute('href', '/register?redirect=%2Fdiagnostic-ia%23reserver');
  });

  it('conserve le retour Diagnostic entre inscription et connexion', () => {
    render(<MemoryRouter initialEntries={['/register?redirect=%2Fdiagnostic-ia%23reserver']}><Register /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Se connecter' }))
      .toHaveAttribute('href', '/login?redirect=%2Fdiagnostic-ia%23reserver');
  });

  it('ramène une session déjà connectée vers le Diagnostic', () => {
    auth.user = { id: 'client-test' };
    render(<MemoryRouter initialEntries={['/register?redirect=%2Fdiagnostic-ia%23reserver']}><Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/diagnostic-ia" element={<h1>Réserver le Diagnostic</h1>} />
    </Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Réserver le Diagnostic' })).toBeVisible();
  });

  it.each(['https://example.test', '//example.test'])('écarte une destination externe %s', (redirect) => {
    render(<MemoryRouter initialEntries={['/register?redirect=' + encodeURIComponent(redirect)]}><Register /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/login');
  });
});
