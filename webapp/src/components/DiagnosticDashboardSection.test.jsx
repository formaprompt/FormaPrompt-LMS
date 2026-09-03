import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import DiagnosticDashboardSection from './DiagnosticDashboardSection';

const ORDER_ID = '81000000-0000-4000-8000-000000000001';
const BOOKING_ID = '82000000-0000-4000-8000-000000000001';

function diagnostic({ bookingStatus = null, questionnaire = false, published = false } = {}) {
  return {
    order: { id: ORDER_ID, status: 'paid' },
    booking: bookingStatus ? {
      id: BOOKING_ID,
      status: bookingStatus,
      starts_at: '2026-09-10T08:00:00Z',
      ends_at: '2026-09-10T09:30:00Z',
    } : null,
    questionnaire: questionnaire ? { id: 'questionnaire-test', submitted_at: '2026-09-01T08:00:00Z' } : null,
    restitution: published ? { id: 'restitution-test', status: 'published' } : null,
  };
}

function renderSection(diagnostics = [], props = {}) {
  return render(<MemoryRouter><DiagnosticDashboardSection diagnostics={diagnostics} loading={false} error={false} {...props} /></MemoryRouter>);
}

afterEach(cleanup);

describe('section Mes diagnostics IA du dashboard', () => {
  it('affiche un état distinct lorsque le client n’a aucun Diagnostic', () => {
    renderSection();
    expect(screen.getByRole('heading', { name: 'Mes diagnostics IA' })).toBeVisible();
    expect(screen.getByText(/aucun Diagnostic IA Express/i)).toBeVisible();
  });

  it('propose la réservation pour une commande payée sans booking', () => {
    renderSection([diagnostic()]);
    expect(screen.getByText('Réservation à effectuer')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Réserver mon diagnostic' })).toHaveAttribute('href', `/diagnostic-ia/reserver?order_id=${ORDER_ID}`);
  });

  it('propose le questionnaire pour un rendez-vous prévu sans réponse', () => {
    renderSection([diagnostic({ bookingStatus: 'booked' })]);
    expect(screen.getByText('Questionnaire à compléter')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Compléter le questionnaire' })).toHaveAttribute('href', `/diagnostic-ia/questionnaire?booking_id=${BOOKING_ID}`);
  });

  it('indique le rendez-vous prévu lorsque le questionnaire est transmis', () => {
    renderSection([diagnostic({ bookingStatus: 'booked', questionnaire: true })]);
    expect(screen.getByText('Rendez-vous prévu')).toBeVisible();
    expect(screen.getByText('Transmis')).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('annonce une restitution en préparation après réalisation', () => {
    renderSection([diagnostic({ bookingStatus: 'completed', questionnaire: true })]);
    expect(screen.getByText('Restitution en préparation')).toBeVisible();
    expect(screen.getByText('En préparation')).toBeVisible();
  });

  it('ouvre uniquement une restitution publiée', () => {
    renderSection([diagnostic({ bookingStatus: 'completed', questionnaire: true, published: true })]);
    expect(screen.getByText('Restitution disponible')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Consulter ma restitution' })).toHaveAttribute('href', `/diagnostic-ia/restitution?booking_id=${BOOKING_ID}`);
  });

  it('distingue chargement et erreur sans détail technique', () => {
    const { rerender } = renderSection([], { loading: true });
    expect(screen.getByRole('status')).toHaveTextContent('Chargement de vos diagnostics');
    rerender(<MemoryRouter><DiagnosticDashboardSection diagnostics={[]} loading={false} error /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('ne peuvent pas être chargés');
    expect(screen.queryByText(/PGRST|SQL|Supabase/i)).not.toBeInTheDocument();
  });
});
