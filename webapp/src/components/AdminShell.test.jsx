import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminShell from './AdminShell';

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
});
