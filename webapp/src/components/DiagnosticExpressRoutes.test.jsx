import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const { auth } = vi.hoisted(() => ({ auth: { user: { id: 'local-test' } } }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => auth }));
vi.mock('./Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { default: () => <Outlet /> };
});
vi.mock('./ScrollToTop', () => ({ default: () => null }));
vi.mock('react-cookie-consent', () => ({ default: () => null }));
vi.mock('../pages/DiagnosticIA', () => ({ default: () => <h1>Offre Diagnostic</h1> }));
vi.mock('../pages/DiagnosticPaymentConfirmation', () => ({ default: () => <h1>Confirmation Diagnostic</h1> }));
vi.mock('../pages/DiagnosticBooking', () => ({ default: () => <h1>Réservation Diagnostic</h1> }));
vi.mock('../pages/DiagnosticQuestionnaire', () => ({ default: () => <h1>Questionnaire Diagnostic</h1> }));
vi.mock('../pages/DiagnosticRestitution', () => ({ default: () => <h1>Restitution Diagnostic</h1> }));
vi.mock('../pages/AdminDiagnosticRestitutions', () => ({ default: () => <h1>Administration Diagnostic</h1> }));
vi.mock('../pages/AdminPromotions', () => ({ default: () => <h1>Administration Promotions</h1> }));
vi.mock('../pages/Login', () => ({ default: () => <h1>Connexion requise</h1> }));

const routes = [
  ['/diagnostic-ia', 'Offre Diagnostic'],
  ['/diagnostic-ia/confirmation', 'Confirmation Diagnostic'],
  ['/diagnostic-ia/reserver', 'Réservation Diagnostic'],
  ['/diagnostic-ia/questionnaire', 'Questionnaire Diagnostic'],
  ['/diagnostic-ia/restitution', 'Restitution Diagnostic'],
  ['/admin/diagnostics', 'Administration Diagnostic'],
  ['/admin/promotions', 'Administration Promotions'],
];

describe('routes réelles App : Diagnostic historique et Promotions Express', () => {
  beforeEach(() => { auth.user = { id: 'local-test' }; });
  afterEach(() => cleanup());

  it.each(routes)('raccorde %s sans remplacer les routes Express', async (path, title) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: title })).toBeVisible();
    if (path.startsWith('/admin/')) {
      expect(screen.getByRole('link', { name: 'Diagnostics IA' })).toHaveAttribute('href', '/admin/diagnostics');
      expect(screen.getByRole('link', { name: 'Promotions' })).toHaveAttribute('href', '/admin/promotions');
    }
  });

  it.each(routes.slice(2))('protège %s sans session', async (path) => {
    auth.user = null;
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Connexion requise' })).toBeVisible();
  });
});
