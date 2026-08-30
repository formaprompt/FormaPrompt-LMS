import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AdminCockpit from './AdminCockpit';

const { rpcMock, fromMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), fromMock: vi.fn() }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc: rpcMock, from: fromMock },
}));

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin-1' }, role: 'admin' }),
}));

function summary(overrides = {}) {
  return {
    filters: { date_from: '2026-01-01', date_to: '2026-08-22', course_id: null },
    kpis: {
      action_items_total: 0,
      critical_action_items: 0,
      active_course_access: 4,
      completed_training_activities: 3,
      completed_trainees: 5,
      overdue_quality_actions: 1,
    },
    action_counts_by_domain: {},
    priority_actions: [],
    stripe_financial_by_currency: [{
      currency: 'eur',
      estimated_net_stripe_cents: 15000,
      successful_refund_cents: 2000,
      open_dispute_cents: 0,
      is_estimate: true,
    }],
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div aria-label="route active">{location.pathname}</div>;
}

function renderCockpit(initialEntry = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AdminCockpit />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('AdminCockpit', () => {
  beforeEach(() => {
    rpcMock.mockResolvedValue({ data: summary(), error: null });
    const builder = {
      select: vi.fn(), gte: vi.fn(), lte: vi.fn(), eq: vi.fn(), neq: vi.fn(),
      then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    builder.select.mockReturnValue(builder); builder.gte.mockReturnValue(builder);
    builder.lte.mockReturnValue(builder); builder.eq.mockReturnValue(builder); builder.neq.mockReturnValue(builder);
    fromMock.mockReturnValue(builder);
  });

  afterEach(() => {
    cleanup();
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('charge le résumé Lot 1 et affiche les KPI fiables', async () => {
    renderCockpit();

    expect(screen.getByRole('status')).toHaveTextContent('Chargement du cockpit');
    expect(await screen.findByRole('heading', { name: 'Indicateurs clés' })).toBeVisible();
    expect(screen.getByText('Apprenants actifs').closest('article')).toHaveTextContent('4');
    expect(screen.getByText('Source : course_access')).toBeVisible();
    expect(screen.getAllByText('150,00 €')[0]).toBeVisible();
    expect(screen.getByRole('link', { name: 'Gérer les Diagnostics IA' })).toHaveAttribute('href', '/admin/diagnostics');
    expect(rpcMock).toHaveBeenCalledWith('admin_get_cockpit_summary', expect.any(Object));
  });

  it('présente un état vide positif sans masquer les autres repères', async () => {
    renderCockpit();

    expect(await screen.findByText('Aucune action prioritaire actuellement')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Échéances proches' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Activité récente' })).toBeVisible();
  });

  it('affiche une erreur récupérable lorsque le RPC échoue', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    renderCockpit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('permission denied');
    expect(within(alert).getByRole('button', { name: 'Réessayer' })).toBeEnabled();
  });

  it('applique les filtres période et formation au RPC', async () => {
    renderCockpit();
    await screen.findByRole('heading', { name: 'Indicateurs clés' });

    await userEvent.selectOptions(screen.getByLabelText('Formation'), 'formation-ia-act');
    await userEvent.clear(screen.getByLabelText('Du'));
    await userEvent.type(screen.getByLabelText('Du'), '2026-07-01');
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    await waitFor(() => expect(rpcMock).toHaveBeenLastCalledWith('admin_get_cockpit_summary', expect.objectContaining({
      p_date_from: '2026-07-01',
      p_course_id: 'formation-ia-act',
    })));
  });

  it('place les actions client avant la technique et navigue vers l’écran existant', async () => {
    rpcMock.mockResolvedValue({ data: summary({
      kpis: { ...summary().kpis, action_items_total: 2 },
      action_counts_by_domain: { commercial: 1, stripe: 1 },
      priority_actions: [
        { domain: 'stripe', severity: 'high', item_type: 'orphan_transaction', item_id: 'stripe-1', neutral_label: 'Anomalie interne', created_at: '2026-08-20T10:00:00Z', age_seconds: 1000, destination_path: '/admin/stripe-apres-paiement' },
        { domain: 'commercial', severity: 'medium', item_type: 'commercial_follow_up', item_id: 'client-1', neutral_label: 'Client à rappeler', created_at: '2026-08-22T10:00:00Z', age_seconds: 100, destination_path: '/admin/commercial' },
      ],
    }), error: null });
    renderCockpit();

    const actionsHeading = await screen.findByRole('heading', { name: 'À traiter maintenant' });
    const list = actionsHeading.closest('section').querySelector('.cockpit-actions');
    const actionTexts = within(list).getAllByRole('listitem').map((item) => item.textContent);
    expect(actionTexts[0]).toContain('Client à rappeler');

    await userEvent.click(within(list).getAllByRole('link', { name: 'Traiter' })[0]);
    expect(screen.getByLabelText('route active')).toHaveTextContent('/admin/commercial');
  });

  it('conserve la file d’actions avant la colonne secondaire dans l’ordre mobile', async () => {
    renderCockpit();
    const actionsHeading = await screen.findByRole('heading', { name: 'À traiter maintenant' });
    const deadlinesHeading = screen.getByRole('heading', { name: 'Échéances proches' });

    expect(actionsHeading.compareDocumentPosition(deadlinesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelector('.cockpit-primary-grid')).toBeInTheDocument();
    expect(document.querySelector('table')).not.toBeInTheDocument();
  });

  it('préserve les anciens liens administratifs à onglet', async () => {
    renderCockpit('/admin?onglet=bookings');
    await waitFor(() => expect(screen.getByLabelText('route active')).toHaveTextContent('/admin/pedagogique'));
  });
});
