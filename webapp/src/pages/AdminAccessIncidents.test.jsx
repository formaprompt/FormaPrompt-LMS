import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminAccessIncidents from './AdminAccessIncidents';

const ADMIN_ID = 'user-admin-a';
const USER_B_ID = 'user-b';
const ACCESS_A_ID = 'access-a';
const ACCESS_B_ID = 'access-b';

const { fromMock, rpcMock, database } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  database: {
    profiles: [],
    training_enrollments: [],
    course_positioning_assessments: [],
    course_access: [],
    disciplinary_incidents: [],
    incident_categories: [],
    audit_log: [],
  },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: ADMIN_ID }, role: 'admin' }),
}));

function queryFor(table) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    then: (resolve, reject) => Promise.resolve({ data: structuredClone(database[table]), error: null }).then(resolve, reject),
  };
  return query;
}

function resetDatabase() {
  database.profiles = [
    { id: ADMIN_ID, email: 'thierry227@gmail.com', role: 'admin' },
    { id: USER_B_ID, email: 'thierry270363@gmail.com', role: 'user' },
  ];
  database.training_enrollments = [
    { user_id: USER_B_ID, learner_first_name: 'Thierry', learner_last_name: 'Frezard', updated_at: '2026-08-11T10:00:00Z' },
  ];
  database.course_positioning_assessments = [
    { user_id: ADMIN_ID, learner_name: 'Thierry FREZARD', submitted_at: '2026-08-11T09:00:00Z' },
  ];
  database.course_access = [
    {
      id: ACCESS_A_ID,
      user_id: ADMIN_ID,
      course_id: 'formation-ia',
      status: 'active',
      access_source: 'admin',
      granted_at: '2026-07-01T10:00:00Z',
      expires_at: null,
      status_changed_at: '2026-07-01T10:00:00Z',
      suspension_ends_at: null,
    },
    {
      id: ACCESS_B_ID,
      user_id: USER_B_ID,
      course_id: 'formation-ia',
      status: 'active',
      access_source: 'admin',
      granted_at: '2026-07-02T10:00:00Z',
      expires_at: null,
      status_changed_at: '2026-07-02T10:00:00Z',
      suspension_ends_at: null,
    },
  ];
  database.disciplinary_incidents = [];
  database.incident_categories = [];
  database.audit_log = [];
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/acces-incidents']}>
      <AdminAccessIncidents />
    </MemoryRouter>,
  );
}

function cardFor(email) {
  return screen.getByText(email).closest('article');
}

async function submitAction(user, action, email, reason) {
  await user.click(within(cardFor(email)).getByRole('button', { name: action }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText('Motif obligatoire'), reason);
  await user.click(within(dialog).getByRole('button', { name: new RegExp(`${action}.*de ${email}`, 'i') }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

describe('administration sécurisée des accès', () => {
  beforeEach(() => {
    resetDatabase();
    fromMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockImplementation((table) => queryFor(table));
    rpcMock.mockImplementation(async (_functionName, parameters) => {
      const access = database.course_access.find(({ id }) => id === parameters.p_access_id);
      if (!access
        || access.user_id !== parameters.p_expected_user_id
        || access.course_id !== parameters.p_expected_course_id) {
        return { data: { ok: false, message: 'Cible incohérente' }, error: null };
      }
      const previousStatus = access.status;
      access.status = {
        revoke: 'revoked',
        restore: 'active',
        suspend: 'suspended',
        reactivate: 'active',
      }[parameters.p_action];
      access.status_changed_at = '2026-08-11T18:26:41Z';
      database.audit_log.unshift({
        id: `audit-${database.audit_log.length + 1}`,
        actor_user_id: ADMIN_ID,
        action_type: previousStatus === 'revoked' && access.status === 'active'
          ? 'access_restored'
          : `access_${access.status}`,
        target_type: 'course_access',
        target_id: access.id,
        target_user_id: access.user_id,
        course_id: access.course_id,
        previous_state: { status: previousStatus },
        new_state: { status: access.status },
        reason: parameters.p_reason,
        metadata: {},
        created_at: '2026-08-11T18:26:41Z',
      });
      return { data: { ok: true, access: structuredClone(access) }, error: null };
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  });

  it('révoque puis restaure B sans modifier A, y compris après rafraîchissement', async () => {
    const user = userEvent.setup();
    const view = renderPage();

    await screen.findByText('thierry270363@gmail.com');
    expect(screen.getByText('thierry227@gmail.com')).toBeInTheDocument();
    expect(screen.queryByText(ADMIN_ID)).not.toBeInTheDocument();

    const search = screen.getByLabelText(/rechercher un apprenant/i);
    await user.type(search, 'thierry270363@gmail.com');
    expect(screen.queryByText('thierry227@gmail.com')).not.toBeInTheDocument();
    await submitAction(user, 'Révoquer', 'thierry270363@gmail.com', 'Révocation ciblée du compte B');

    expect(within(cardFor('thierry270363@gmail.com')).getByText('Révoqué')).toBeInTheDocument();
    expect(database.course_access.find(({ id }) => id === ACCESS_A_ID).status).toBe('active');
    expect(database.course_access.find(({ id }) => id === ACCESS_B_ID).status).toBe('revoked');

    view.unmount();
    renderPage();
    await screen.findByText('thierry270363@gmail.com');
    expect(within(cardFor('thierry270363@gmail.com')).getByText('Révoqué')).toBeInTheDocument();

    const refreshedSearch = screen.getByLabelText(/rechercher un apprenant/i);
    await user.type(refreshedSearch, 'thierry227@gmail.com');
    expect(screen.queryByText('thierry270363@gmail.com')).not.toBeInTheDocument();
    await user.clear(refreshedSearch);
    await user.type(refreshedSearch, 'thierry270363@gmail.com');
    expect(screen.queryByText('thierry227@gmail.com')).not.toBeInTheDocument();

    await submitAction(
      user,
      'Restaurer l’accès',
      'thierry270363@gmail.com',
      'Révocation effectuée par erreur sur le mauvais compte',
    );

    expect(within(cardFor('thierry270363@gmail.com')).getByText('Actif')).toBeInTheDocument();
    const historyB = within(cardFor('thierry270363@gmail.com')).getByText(/Historique sensible/).closest('details');
    expect(historyB).toHaveTextContent('Accès à « Formation IA générative » révoqué');
    expect(historyB).toHaveTextContent('restauré après révocation');
    expect(historyB).toHaveTextContent('thierry270363@gmail.com');
    expect(database.audit_log.every((entry) => entry.target_id === ACCESS_B_ID)).toBe(true);
  });

  it('confirme nom, email, formation, statut et triple identifiant stable', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('thierry270363@gmail.com');

    await user.click(within(cardFor('thierry270363@gmail.com')).getByRole('button', { name: 'Révoquer' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Thierry Frezard');
    expect(dialog).toHaveTextContent('thierry270363@gmail.com');
    expect(dialog).toHaveTextContent('Formation IA générative');
    expect(dialog).toHaveTextContent('Actif');
    await user.type(within(dialog).getByLabelText('Motif obligatoire'), 'Révocation ciblée et confirmée');
    await user.click(within(dialog).getByRole('button', { name: /Révoquer l’accès de thierry270363@gmail.com/i }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('admin_change_course_access', expect.objectContaining({
      p_access_id: ACCESS_B_ID,
      p_expected_user_id: USER_B_ID,
      p_expected_course_id: 'formation-ia',
      p_action: 'revoke',
    })));
  });

  it('distingue le statut stocké de l’accès effectif et explicite les états sans action', async () => {
    database.course_access.push(
      {
        id: 'access-expired-deadline',
        user_id: USER_B_ID,
        course_id: 'formation-ia-act',
        status: 'active',
        access_source: 'admin',
        granted_at: '2025-07-02T10:00:00Z',
        expires_at: '2025-08-02T10:00:00Z',
        status_changed_at: '2025-07-02T10:00:00Z',
        suspension_ends_at: null,
      },
      {
        id: 'access-refunded',
        user_id: USER_B_ID,
        course_id: 'formation-prompt-level-1',
        status: 'refunded',
        access_source: 'admin',
        granted_at: '2026-07-02T10:00:00Z',
        expires_at: null,
        status_changed_at: '2026-07-02T10:00:00Z',
        suspension_ends_at: null,
      },
      {
        id: 'access-suspended',
        user_id: USER_B_ID,
        course_id: 'formation-ia',
        status: 'suspended',
        access_source: 'admin',
        granted_at: '2026-07-02T10:00:00Z',
        expires_at: null,
        status_changed_at: '2026-08-02T10:00:00Z',
        suspension_ends_at: '2026-09-02T10:00:00Z',
      },
    );
    renderPage();
    await screen.findByText('Aucune action disponible dans ce cockpit.');

    expect(screen.getAllByText('Actif').length).toBeGreaterThan(0);
    expect(screen.getByText('Fermé — échéance dépassée')).toBeInTheDocument();
    expect(screen.getByText('Aucune action disponible dans ce cockpit.')).toBeInTheDocument();
    expect(screen.getByText('Fin indicative de suspension')).toBeInTheDocument();
    expect(screen.getByText('Ne réactive jamais automatiquement l’accès.')).toBeInTheDocument();
    expect(screen.getByText('Signification du statut')).toBeInTheDocument();
  });

  it('conserve les identités et la confirmation utilisables à 390 px', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    window.dispatchEvent(new Event('resize'));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('thierry270363@gmail.com');

    await user.click(within(cardFor('thierry270363@gmail.com')).getByRole('button', { name: 'Révoquer' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Thierry Frezard');
    expect(dialog).toHaveTextContent('thierry270363@gmail.com');
    expect(dialog).toHaveTextContent('Formation IA générative');
    expect(within(dialog).getByRole('button', { name: /Révoquer l’accès de thierry270363@gmail.com/i })).toBeVisible();
  });
});
