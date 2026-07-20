import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './Login';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/useAuth';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}));

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}));

function LoginRoutes({ initialEntry = '/login' }) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<p>Destination administration</p>} />
        <Route path="/dashboard" element={<p>Destination espace apprenant</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('connexion et redirection selon le rôle', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: null, role: null });
  });

  it('attend le chargement du rôle avant d’ouvrir l’administration', async () => {
    const user = userEvent.setup();
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    });

    const view = render(<LoginRoutes />);

    await user.type(screen.getByLabelText('Adresse e-mail'), 'admin@example.test');
    await user.type(screen.getByLabelText('Mot de passe'), 'mot-de-passe-test');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@example.test',
        password: 'mot-de-passe-test',
      });
    });

    expect(screen.getByRole('button', { name: 'Ouverture de votre espace…' })).toBeDisabled();
    expect(screen.queryByText('Destination administration')).not.toBeInTheDocument();
    expect(screen.queryByText('Destination espace apprenant')).not.toBeInTheDocument();

    useAuth.mockReturnValue({ user: { id: 'admin-test' }, role: 'admin' });
    view.rerender(<LoginRoutes />);

    expect(await screen.findByText('Destination administration')).toBeInTheDocument();
  });

  it('ouvre directement l’administration pour une session administrateur active', () => {
    useAuth.mockReturnValue({ user: { id: 'admin-test' }, role: 'admin' });

    render(<LoginRoutes />);

    expect(screen.getByText('Destination administration')).toBeInTheDocument();
    expect(screen.queryByText('Destination espace apprenant')).not.toBeInTheDocument();
  });

  it('conserve la redirection vers l’espace apprenant pour un utilisateur standard', () => {
    useAuth.mockReturnValue({ user: { id: 'user-test' }, role: 'user' });

    render(<LoginRoutes />);

    expect(screen.getByText('Destination espace apprenant')).toBeInTheDocument();
    expect(screen.queryByText('Destination administration')).not.toBeInTheDocument();
  });
});
