import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminPrivacyRequests from './AdminPrivacyRequests';

const ADMIN_ID = 'privacy-admin';
const EMPTY_ID = 'privacy-empty';
const COMPLEX_ID = 'privacy-complex';

const { database, fromMock, rpcMock, functionsInvokeMock, authState } = vi.hoisted(() => ({
  database: { profiles: [], privacy_requests: [], privacy_dependency_assessments: [], privacy_processing_actions: [], privacy_request_events: [] },
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  functionsInvokeMock: vi.fn(),
  authState: { user: { id: 'privacy-admin' }, role: 'admin' },
}));

vi.mock('../lib/supabaseClient', () => ({ supabase: { from: fromMock, rpc: rpcMock, functions: { invoke: functionsInvokeMock } } }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => authState }));

function queryFor(table) {
  const query = {
    select: () => query,
    order: () => query,
    then: (resolve, reject) => Promise.resolve({ data: structuredClone(database[table]), error: null }).then(resolve, reject),
  };
  return query;
}

function resetDatabase() {
  authState.user = { id: ADMIN_ID };
  authState.role = 'admin';
  database.profiles = [
    { id: ADMIN_ID, email: 'admin@example.test', role: 'admin' },
    { id: EMPTY_ID, email: 'erreur-inscription@example.test', role: 'user' },
    { id: COMPLEX_ID, email: 'apprenant-complexe@example.test', role: 'user' },
  ];
  database.privacy_requests = [];
  database.privacy_dependency_assessments = [];
  database.privacy_processing_actions = [];
  database.privacy_request_events = [];
}

function renderPage() {
  return render(<MemoryRouter initialEntries={['/admin/demandes-rgpd']}><AdminPrivacyRequests /></MemoryRouter>);
}

describe('workflow RGPD non destructif', () => {
  beforeEach(() => {
    resetDatabase();
    fromMock.mockReset();
    rpcMock.mockReset();
    functionsInvokeMock.mockReset();
    fromMock.mockImplementation((table) => queryFor(table));
    rpcMock.mockImplementation(async (name, parameters) => {
      if (name === 'admin_create_privacy_request') {
        const request = {
          id: `request-${database.privacy_requests.length + 1}`,
          subject_user_id: parameters.p_subject_user_id,
          request_type: parameters.p_request_type,
          request_origin: parameters.p_request_origin,
          received_at: parameters.p_received_at,
          status: 'received',
          identity_verification_status: parameters.p_identity_verification_status,
          analysis_conclusion: null,
          administrative_decision: null,
          decision_reason: null,
          last_analyzed_at: null,
          created_at: '2026-08-12T10:00:00Z',
        };
        database.privacy_requests.unshift(request);
        database.privacy_request_events.unshift({ id: `event-${Date.now()}`, request_id: request.id, event_type: 'request_created', created_at: request.created_at });
        return { data: request, error: null };
      }
      if (name === 'admin_analyze_privacy_request') {
        const request = database.privacy_requests.find(({ id }) => id === parameters.p_request_id);
        const run = `run-${Date.now()}`;
        const complex = request.subject_user_id === COMPLEX_ID;
        request.analysis_conclusion = complex ? 'manual_legal_review_required' : 'full_erasure_possible';
        request.status = 'under_review';
        request.last_analyzed_at = new Date().toISOString();
        database.privacy_dependency_assessments.unshift({
          id: `assessment-${Date.now()}`,
          request_id: request.id,
          analysis_run_id: run,
          category: complex ? 'purchases' : 'profile',
          record_count: 1,
          risk_level: complex ? 'high' : 'low',
          proposed_action: complex ? 'potential_retention_to_review' : 'deletion_candidate',
          external_check_required: complex,
          assessed_at: request.last_analyzed_at,
        });
        database.privacy_processing_actions.unshift({
          id: `action-${Date.now()}`,
          request_id: request.id,
          assessment_id: database.privacy_dependency_assessments[0].id,
          status: 'proposed',
          suggested_resolution: complex ? 'retain' : 'external_action',
          resolution: null,
          reason: null,
          created_at: request.last_analyzed_at,
        });
        database.privacy_request_events.unshift({ id: `event-${Date.now()}`, request_id: request.id, event_type: 'analysis_completed', created_at: request.last_analyzed_at });
        return { data: { analysis_conclusion: request.analysis_conclusion }, error: null };
      }
      if (name === 'admin_set_privacy_action_decision') {
        const action = database.privacy_processing_actions.find(({ id }) => id === parameters.p_action_id);
        action.status = 'approved';
        action.resolution = parameters.p_resolution;
        action.reason = parameters.p_reason;
        return { data: action, error: null };
      }
      if (name === 'admin_review_privacy_request') {
        const request = database.privacy_requests.find(({ id }) => id === parameters.p_request_id);
        Object.assign(request, {
          status: parameters.p_status,
          identity_verification_status: parameters.p_identity_verification_status,
          administrative_decision: parameters.p_administrative_decision,
          decision_reason: parameters.p_decision_reason,
        });
        return { data: request, error: null };
      }
      return { data: null, error: new Error('RPC inconnue') };
    });
    functionsInvokeMock.mockResolvedValue({ data: { status: 'closed' }, error: null });
  });

  afterEach(cleanup);

  it('analyse un compte vide sans proposer de suppression réelle', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Aucune action irréversible n’est automatique/i);
    await user.type(screen.getByLabelText('Rechercher la personne'), 'erreur-inscription@example.test');
    await user.selectOptions(screen.getByLabelText('Compte concerné'), EMPTY_ID);
    await user.click(screen.getByRole('button', { name: /Enregistrer sans traiter/i }));
    const card = await screen.findByRole('heading', { name: 'erreur-inscription@example.test' });
    await user.click(within(card.closest('article')).getByRole('button', { name: 'Lancer l’analyse' }));
    await waitFor(() => expect(screen.getByText('Effacement complet potentiellement possible', { selector: '.privacy-conclusion' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^Supprimer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Effacer/i })).not.toBeInTheDocument();
  });

  it('classe un dossier complexe en revue juridique et signale le contrôle externe', async () => {
    database.privacy_requests = [{
      id: 'request-complex', subject_user_id: COMPLEX_ID, request_type: 'erasure', request_origin: 'email',
      received_at: '2026-08-12T09:00:00Z', status: 'received', identity_verification_status: 'verified',
      analysis_conclusion: null, administrative_decision: null, decision_reason: null, last_analyzed_at: null, created_at: '2026-08-12T09:00:00Z',
    }];
    const user = userEvent.setup();
    renderPage();
    const heading = await screen.findByRole('heading', { name: 'apprenant-complexe@example.test' });
    await user.click(within(heading.closest('article')).getByRole('button', { name: 'Lancer l’analyse' }));
    expect(await screen.findByText('Revue juridique manuelle requise', { selector: '.privacy-conclusion' })).toBeInTheDocument();
    expect(screen.getByText('Achats')).toBeInTheDocument();
    expect(screen.getByText('Contrôle externe requis')).toBeInTheDocument();
    expect(screen.getByText(/Conservation potentiellement nécessaire/i)).toBeInTheDocument();
  });

  it('refuse visuellement l’accès à un apprenant', async () => {
    authState.user = { id: EMPTY_ID };
    authState.role = 'user';
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Accès réservé à l’administrateur');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('exige une décision par catégorie avant toute exécution', async () => {
    database.privacy_requests = [{
      id: '2cb81599-d845-45e2-95b6-89b5c32f8bba', subject_user_id: EMPTY_ID,
      subject_reference: '9ab1eb0c-8258-4f62-9403-76f382079f62', request_type: 'erasure', request_origin: 'email',
      received_at: '2026-08-12T09:00:00Z', status: 'under_review', identity_verification_status: 'verified',
      analysis_conclusion: 'partial_erasure_or_anonymization_required', administrative_decision: null,
      decision_reason: null, last_analyzed_at: '2026-08-12T10:00:00Z', created_at: '2026-08-12T09:00:00Z',
    }];
    database.privacy_dependency_assessments = [{
      id: 'assessment-contact', request_id: database.privacy_requests[0].id, analysis_run_id: 'run-1',
      category: 'contact_requests', record_count: 1, risk_level: 'low', proposed_action: 'anonymization_to_review',
      external_check_required: false, assessed_at: '2026-08-12T10:00:00Z',
    }];
    database.privacy_processing_actions = [{
      id: 'action-contact', request_id: database.privacy_requests[0].id, assessment_id: 'assessment-contact',
      status: 'proposed', suggested_resolution: 'anonymize', resolution: null, reason: null,
      created_at: '2026-08-12T10:00:00Z',
    }];
    const user = userEvent.setup();
    renderPage();
    const article = (await screen.findByRole('heading', { name: 'erreur-inscription@example.test' })).closest('article');
    expect(within(article).queryByText('Exécution contrôlée')).not.toBeInTheDocument();
    await user.type(within(article).getByLabelText('Justification'), 'Suppression des identifiants directs validée par l’administrateur.');
    await user.click(within(article).getByRole('button', { name: 'Approuver cette décision' }));
    expect(rpcMock).toHaveBeenCalledWith('admin_set_privacy_action_decision', expect.objectContaining({
      p_action_id: 'action-contact', p_resolution: 'anonymize',
    }));
    expect(functionsInvokeMock).not.toHaveBeenCalled();
  });

  it('n active l exécution qu après la phrase exacte et transmet seulement le plan validé', async () => {
    const subjectReference = '9ab1eb0c-8258-4f62-9403-76f382079f62';
    database.privacy_requests = [{
      id: '2cb81599-d845-45e2-95b6-89b5c32f8bba', subject_user_id: EMPTY_ID, subject_reference: subjectReference,
      request_type: 'erasure', request_origin: 'email', received_at: '2026-08-12T09:00:00Z',
      status: 'ready_for_execution', identity_verification_status: 'verified',
      analysis_conclusion: 'partial_erasure_or_anonymization_required',
      administrative_decision: 'partial_erasure_or_anonymization_required', decision_reason: 'Plan vérifié.',
      last_analyzed_at: '2026-08-12T10:00:00Z', created_at: '2026-08-12T09:00:00Z',
    }];
    const user = userEvent.setup();
    renderPage();
    const article = (await screen.findByRole('heading', { name: 'erreur-inscription@example.test' })).closest('article');
    await user.click(within(article).getByText('Exécution contrôlée'));
    const executeButton = within(article).getByRole('button', { name: 'Exécuter le plan approuvé' });
    await user.type(within(article).getByLabelText('Motif d’exécution'), 'Plan RGPD validé par contrôle administratif.');
    await user.type(within(article).getByLabelText(/Recopier exactement/), 'EFFACER incorrect');
    expect(executeButton).toBeDisabled();
    await user.clear(within(article).getByLabelText(/Recopier exactement/));
    await user.type(within(article).getByLabelText(/Recopier exactement/), `EFFACER ${subjectReference}`);
    await user.click(executeButton);
    expect(functionsInvokeMock).toHaveBeenCalledWith('admin-process-privacy-request', {
      body: expect.objectContaining({ requestId: database.privacy_requests[0].id, confirmation: `EFFACER ${subjectReference}` }),
    });
  });
});
