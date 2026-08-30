import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminShell from './AdminShell';

describe('AdminShell', () => {
  afterEach(() => cleanup());

  it('intègre la gestion des Diagnostics IA dans la navigation administrateur', () => {
    render(<MemoryRouter initialEntries={['/admin/diagnostics']}><AdminShell><main>Contenu</main></AdminShell></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Diagnostics IA' });
    expect(link).toHaveAttribute('href', '/admin/diagnostics');
    expect(link).toHaveClass('is-active');
  });
});
