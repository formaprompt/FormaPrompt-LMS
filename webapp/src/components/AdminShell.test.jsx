import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminShell from './AdminShell';

const auth = { role: 'admin' };
vi.mock('../contexts/useAuth', () => ({ useAuth: () => auth }));

describe('AdminShell', () => {
  afterEach(() => cleanup());

  it('intègre les promotions dans la navigation administrateur', () => {
    render(<MemoryRouter initialEntries={['/admin/promotions']}><AdminShell><main>Contenu</main></AdminShell></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Promotions' });
    expect(link).toHaveAttribute('href', '/admin/promotions');
    expect(link).toHaveClass('is-active');
    expect(screen.getByRole('link', { name: 'Diagnostics IA' })).toHaveAttribute('href', '/admin/diagnostics');
  });

  it('conserve Diagnostics IA et Promotions ensemble sur la page Diagnostic', () => {
    render(<MemoryRouter initialEntries={['/admin/diagnostics']}><AdminShell><main>Diagnostics</main></AdminShell></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Diagnostics IA' })).toHaveClass('is-active');
    expect(screen.getByRole('link', { name: 'Promotions' })).toHaveAttribute('href', '/admin/promotions');
    expect(screen.getByRole('link', { name: 'Promotions' })).not.toHaveClass('is-active');
  });

  it('rend Apprenants seul actif pour onglet users et Pédagogique seul actif ailleurs', () => {
    auth.role = 'admin';
    const first = render(<MemoryRouter initialEntries={['/admin/pedagogique?onglet=users']}><AdminShell><main>Annuaire</main></AdminShell></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Apprenants' })).toHaveClass('is-active');
    expect(screen.getByRole('link', { name: 'Pédagogique' })).not.toHaveClass('is-active');

    first.unmount();
    render(<MemoryRouter initialEntries={['/admin/pedagogique?onglet=corrections']}><AdminShell><main>Pédagogie</main></AdminShell></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Pédagogique' })).toHaveClass('is-active');
  });

  it('masque l’entrée Apprenants aux employés', () => {
    auth.role = 'employee';
    render(<MemoryRouter><AdminShell><main>Contenu</main></AdminShell></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'Apprenants' })).not.toBeInTheDocument();
  });
});
