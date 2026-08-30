import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminDiagnosticRestitutions from './AdminDiagnosticRestitutions';

const mocks = vi.hoisted(() => ({
  auth: { role: 'admin' },
  database: [],
  fetch: vi.fn(),
  complete: vi.fn(),
  save: vi.fn(),
  publish: vi.fn(),
  correct: vi.fn(),
  availability: vi.fn(),
  reschedule: vi.fn(),
}));

vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ role: mocks.auth.role, user: { id: 'admin-1' } }) }));
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../lib/diagnosticRestitution', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchDiagnosticAdministration: mocks.fetch,
  completeDiagnosticBooking: mocks.complete,
  saveDiagnosticRestitution: mocks.save,
  publishDiagnosticRestitution: mocks.publish,
  correctDiagnosticRestitution: mocks.correct,
}));
vi.mock('../lib/diagnosticBooking', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchDiagnosticRescheduleAvailability: mocks.availability,
  rescheduleDiagnosticBooking: mocks.reschedule,
}));

const RESCHEDULE_CANDIDATE = {
  id: 'candidate-reschedule',
  slot_ids: [
    '99000000-0000-4000-8000-000000000011',
    '99000000-0000-4000-8000-000000000012',
    '99000000-0000-4000-8000-000000000013',
  ],
  starts_at: '2026-09-12T14:00:00Z',
  ends_at: '2026-09-12T15:30:00Z',
};

function validContent(suffix = '') {
  return {
    overall_summary: `Synthèse générale complète avec constats factuels et priorités réalistes pour le client. ${suffix}`,
    observed_maturity_level: 2,
    maturity_assessment: 'L’organisation expérimente déjà mais doit encore formaliser une méthode commune.',
    current_uses: 'Synthèses et préparation de documents avec validation humaine.',
    strengths: ['Bonne connaissance des processus métier'],
    watch_points: ['Écarter les données confidentielles'],
    priority_opportunities: [{ title: 'Comptes rendus', expected_benefit: 'Réduire le temps de préparation', effort: 'Faible', indicative_cost: 'Limité', risk_or_watchpoint: 'Anonymiser les données', first_action: 'Tester sur un exemple fictif' }],
    recommendations: ['Formaliser une charte simple'],
    short_term_actions: [{ action: 'Créer un modèle de compte rendu', horizon: '30_days' }],
    recommended_tool_families: ['Assistant conversationnel sécurisé'],
    privacy_rgpd_considerations: 'Minimiser les données et vérifier les garanties contractuelles du fournisseur.',
    ai_act_considerations: 'Maintenir une supervision humaine proportionnée.',
    next_steps: 'Tester ce premier usage puis mesurer le résultat obtenu.',
  };
}

function diagnostic({ id, status, restitution = null, questionnaire = true }) {
  return {
    id,
    order_id: `order-${id}`,
    user_id: `user-${id}`,
    starts_at: '2026-09-10T08:00:00Z',
    ends_at: '2026-09-10T09:30:00Z',
    timezone: 'Europe/Paris',
    status,
    google_sync_status: 'synced',
    google_meet_status: 'created',
    completed_at: status === 'completed' ? '2026-09-10T09:30:00Z' : null,
    clientName: `Client ${id}`,
    order: { id: `order-${id}`, customer_email: `${id}@example.test`, status: 'paid' },
    questionnaire: questionnaire ? {
      id: `questionnaire-${id}`,
      questionnaire_version: 'DIAGNOSTIC-IA-PREPARATION-2026-08-29',
      first_name: 'Test', last_name: id, organization: 'Organisation TEST', job_title: 'Responsable', sector: 'Conseil',
      organization_size: '1_9', tools_used: 'Outils fictifs', ai_level: 'beginner',
      repetitive_tasks: 'Tâches répétitives TEST', documents_handled: 'Documents fictifs',
      main_difficulty: 'Difficulté TEST', diagnostic_goal: 'Objectif TEST', one_task_to_remove: 'Tâche TEST',
      submitted_at: '2026-09-01T10:00:00Z',
    } : null,
    restitution,
  };
}

function restitution(id, status = 'draft', revision = 1) {
  return {
    id: `restitution-${id}`,
    booking_id: id,
    status,
    revision,
    content_sha256: 'a'.repeat(64),
    published_at: status === 'published' ? '2026-09-11T10:00:00Z' : null,
    corrected_at: null,
    retention_due_at: status === 'published' ? '2031-09-11T10:00:00Z' : null,
    ...validContent(),
  };
}

function resetDatabase() {
  mocks.database = [
    diagnostic({ id: 'booked', status: 'booked' }),
    diagnostic({ id: 'to-write', status: 'completed', questionnaire: false }),
    diagnostic({ id: 'draft', status: 'completed', restitution: restitution('draft') }),
    diagnostic({ id: 'published', status: 'completed', restitution: restitution('published', 'published', 3) }),
  ];
}

function findDiagnostic(id) {
  return mocks.database.find((item) => item.id === id);
}

async function openDiagnostic(user, id) {
  await user.click(await screen.findByRole('button', { name: `Ouvrir la fiche de Client ${id}` }));
  expect(screen.getByRole('heading', { name: `Client ${id}` })).toBeVisible();
}

function renderPage() {
  return render(<MemoryRouter initialEntries={['/admin/diagnostics']}><AdminDiagnosticRestitutions /></MemoryRouter>);
}

describe('administration des Diagnostics IA et restitutions', () => {
  beforeEach(() => {
    mocks.auth.role = 'admin';
    resetDatabase();
    mocks.fetch.mockReset();
    mocks.complete.mockReset();
    mocks.save.mockReset();
    mocks.publish.mockReset();
    mocks.correct.mockReset();
    mocks.availability.mockReset();
    mocks.reschedule.mockReset();
    mocks.fetch.mockImplementation(async () => structuredClone(mocks.database));
    mocks.complete.mockImplementation(async (_client, bookingId) => {
      const item = findDiagnostic(bookingId);
      Object.assign(item, { status: 'completed', completed_at: '2026-09-10T09:30:00Z' });
      return structuredClone(item);
    });
    mocks.availability.mockResolvedValue([RESCHEDULE_CANDIDATE]);
    mocks.reschedule.mockImplementation(async (_client, bookingId, candidate) => ({
      ...findDiagnostic(bookingId),
      starts_at: candidate.starts_at,
      ends_at: candidate.ends_at,
    }));
    mocks.save.mockImplementation(async (_client, bookingId, expectedRevision, content) => {
      const item = findDiagnostic(bookingId);
      const next = { ...(item.restitution || {}), id: item.restitution?.id || `restitution-${bookingId}`, booking_id: bookingId, status: 'draft', revision: expectedRevision + 1, content_sha256: 'b'.repeat(64), ...structuredClone(content) };
      item.restitution = next;
      return structuredClone(next);
    });
    mocks.publish.mockImplementation(async (_client, restitutionId, expectedRevision) => {
      const item = mocks.database.find((entry) => entry.restitution?.id === restitutionId);
      Object.assign(item.restitution, { status: 'published', revision: expectedRevision, published_at: '2026-09-11T10:00:00Z', retention_due_at: '2031-09-11T10:00:00Z' });
      return structuredClone(item.restitution);
    });
    mocks.correct.mockImplementation(async (_client, restitutionId, expectedRevision, content) => {
      const item = mocks.database.find((entry) => entry.restitution?.id === restitutionId);
      Object.assign(item.restitution, content, { status: 'published', revision: expectedRevision + 1, corrected_at: '2026-09-12T10:00:00Z', content_sha256: 'c'.repeat(64) });
      return structuredClone(item.restitution);
    });
  });

  afterEach(() => cleanup());

  it('réserve l’accès au rôle administrateur et ne charge rien pour un utilisateur normal', () => {
    mocks.auth.role = 'user';
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Accès réservé');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('charge la liste et applique les filtres métier', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findAllByRole('button', { name: /Ouvrir la fiche/ })).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'À réaliser' }));
    expect(screen.getAllByRole('button', { name: /Ouvrir la fiche/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche de Client booked' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Brouillons' }));
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche de Client draft' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Publiés' }));
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche de Client published' })).toBeVisible();
  });

  it('affiche commande, rendez-vous et questionnaire strictement en lecture seule', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiagnostic(user, 'booked');
    expect(screen.getByText('order-booked')).toBeVisible();
    expect(screen.getByText('synced')).toBeVisible();
    expect(screen.getByText('created')).toBeVisible();
    const questionnaire = screen.getByRole('heading', { name: 'Questionnaire préalable' }).closest('section');
    expect(questionnaire).toHaveTextContent('Organisation TEST');
    expect(questionnaire).toHaveTextContent('Objectif TEST');
    expect(within(questionnaire).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('propose le déplacement uniquement pour un booking réservé', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiagnostic(user, 'booked');
    expect(screen.getByRole('button', { name: 'Modifier le rendez-vous' })).toBeVisible();
    await openDiagnostic(user, 'to-write');
    expect(screen.queryByRole('button', { name: 'Modifier le rendez-vous' })).not.toBeInTheDocument();
  });

  it('charge les disponibilités et exige la confirmation ancien/nouveau avant déplacement', async () => {
    const user = userEvent.setup();
    mocks.availability.mockResolvedValueOnce([{
      ...RESCHEDULE_CANDIDATE,
      id: 'candidate-current',
      starts_at: '2026-09-10T08:00:00Z',
      ends_at: '2026-09-10T09:30:00Z',
    }, RESCHEDULE_CANDIDATE]);
    renderPage();
    await openDiagnostic(user, 'booked');
    await user.click(screen.getByRole('button', { name: 'Modifier le rendez-vous' }));
    await waitFor(() => expect(mocks.availability).toHaveBeenCalledWith(expect.anything(), 'booked'));
    expect(await screen.findAllByRole('radio')).toHaveLength(1);
    await user.click(screen.getByRole('radio'));
    expect(mocks.reschedule).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Choisir ce nouveau créneau' }));
    const dialog = screen.getByRole('dialog', { name: 'Déplacer ce rendez-vous ?' });
    expect(dialog).toHaveTextContent('Ancien rendez-vous');
    expect(dialog).toHaveTextContent('Nouveau rendez-vous');
    expect(dialog).toHaveTextContent('mise à jour de son invitation');
    expect(mocks.reschedule).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmer le nouveau rendez-vous' }));
    await waitFor(() => expect(mocks.reschedule).toHaveBeenCalledWith(expect.anything(), 'booked', expect.objectContaining({ id: 'candidate-reschedule' })));
    expect(await screen.findByRole('status')).toHaveTextContent('rendez-vous a été déplacé');
  });

  it('signale un créneau devenu indisponible sans modifier la fiche', async () => {
    const user = userEvent.setup();
    mocks.reschedule.mockRejectedValueOnce(new Error('Ce créneau vient de devenir indisponible.'));
    renderPage();
    await openDiagnostic(user, 'booked');
    await user.click(screen.getByRole('button', { name: 'Modifier le rendez-vous' }));
    await user.click(await screen.findByRole('radio'));
    await user.click(screen.getByRole('button', { name: 'Choisir ce nouveau créneau' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmer le nouveau rendez-vous' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('vient de devenir indisponible');
    expect(screen.getAllByText(/10 sept. 2026/).length).toBeGreaterThan(0);
  });

  it('affiche le vocabulaire métier et la définition dynamique du niveau IA', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiagnostic(user, 'to-write');
    const select = screen.getByLabelText(/Niveau d’avancement dans l’usage de l’IA/);
    expect(within(select).getByRole('option', { name: '2. Premiers essais' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: '3. Usages structurés' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: '4. Intégration métier' })).toBeInTheDocument();
    await user.selectOptions(select, '3');
    expect(screen.getByText('3 - Usages structurés')).toBeVisible();
    expect(screen.getByText(/commencent à être organisés avec des méthodes et des règles communes/)).toBeVisible();
  });

  it('marque un booking booked comme completed après confirmation sans appel Calendar ou Meet', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiagnostic(user, 'booked');
    await user.click(screen.getByRole('button', { name: 'Marquer le diagnostic comme réalisé' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Calendar et Meet ne seront pas modifiés');
    await user.click(within(dialog).getByRole('button', { name: 'Marquer comme réalisé' }));
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledWith(expect.anything(), 'booked'));
    expect(await screen.findByRole('status')).toHaveTextContent('marqué comme réalisé');
    expect(screen.queryByRole('button', { name: 'Marquer le diagnostic comme réalisé' })).not.toBeInTheDocument();
  });

  it('crée un brouillon avec expected_revision 0 et affiche la révision reçue', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiagnostic(user, 'to-write');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.anything(), 'to-write', 0, expect.any(Object)));
    expect(await screen.findByRole('status')).toHaveTextContent('révision 1');
  });

  it('met à jour un brouillon avec sa révision courante', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiagnostic(user, 'draft');
    await user.clear(screen.getByLabelText('Usages actuels'));
    await user.type(screen.getByLabelText('Usages actuels'), 'Usages TEST mis à jour');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.anything(), 'draft', 1, expect.objectContaining({ current_uses: 'Usages TEST mis à jour' })));
    expect(await screen.findByRole('status')).toHaveTextContent('révision 2');
  });

  it('signale un conflit 40001 et propose de recharger sans écraser', async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error('Conflit de révision'), { code: '40001' });
    mocks.save.mockRejectedValueOnce(error);
    renderPage();
    await openDiagnostic(user, 'draft');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('version plus récente');
    expect(within(alert).getByRole('button', { name: 'Recharger la fiche' })).toBeVisible();
  });

  it('prévisualise l’état courant sans aucune écriture', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiagnostic(user, 'draft');
    await user.clear(screen.getByLabelText('Synthèse générale'));
    await user.type(screen.getByLabelText('Synthèse générale'), 'Aperçu TEST non sauvegardé');
    await user.click(screen.getByRole('button', { name: 'Prévisualiser' }));
    const preview = screen.getByRole('heading', { name: 'Restitution Diagnostic IA Express' }).closest('section');
    expect(preview).toHaveTextContent('Aperçu TEST non sauvegardé');
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.correct).not.toHaveBeenCalled();
  });

  it('interdit la publication tant que le booking n’est pas completed', async () => {
    const user = userEvent.setup();
    mocks.database[0].restitution = restitution('booked');
    renderPage();
    await openDiagnostic(user, 'booked');
    expect(screen.getByRole('button', { name: 'Publier la restitution' })).toBeDisabled();
    expect(screen.getByText('Le diagnostic doit être marqué comme réalisé avant publication.')).toBeVisible();
  });

  it('publie un brouillon complet après confirmation explicite', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiagnostic(user, 'draft');
    await user.click(screen.getByRole('button', { name: 'Publier la restitution' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('immédiatement visible par le client');
    await user.click(within(dialog).getByRole('button', { name: 'Publier maintenant' }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith(expect.anything(), 'restitution-draft', 1));
    expect(await screen.findByRole('status')).toHaveTextContent('visible par le client');
    expect(screen.queryByRole('button', { name: 'Enregistrer le brouillon' })).not.toBeInTheDocument();
  });

  it('corrige une publication avec motif, conserve published et incrémente la révision', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiagnostic(user, 'published');
    expect(screen.queryByRole('button', { name: 'Enregistrer le brouillon' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Corriger la restitution' }));
    const reason = screen.getByLabelText('Motif de correction obligatoire');
    expect(screen.getByRole('button', { name: 'Enregistrer la correction' })).toBeDisabled();
    await user.type(reason, 'Correction métier contrôlée');
    await user.clear(screen.getByLabelText('Synthèse générale'));
    await user.type(screen.getByLabelText('Synthèse générale'), validContent('CORRIGÉ').overall_summary);
    await user.click(screen.getByRole('button', { name: 'Enregistrer la correction' }));
    await waitFor(() => expect(mocks.correct).toHaveBeenCalledWith(expect.anything(), 'restitution-published', 3, expect.any(Object), 'Correction métier contrôlée'));
    expect(await screen.findByRole('status')).toHaveTextContent('révision 4');
    expect(screen.getByText(/Révision 4 — corrigée le/)).toBeVisible();
    expect(screen.getAllByText('Publiée')).toHaveLength(2);
  });

  it('n’expose aucune suppression et affiche proprement une erreur RPC', async () => {
    const user = userEvent.setup();
    mocks.complete.mockRejectedValueOnce(new Error('RPC indisponible'));
    renderPage();
    await openDiagnostic(user, 'booked');
    expect(screen.queryByRole('button', { name: /supprimer.*restitution/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Marquer le diagnostic comme réalisé' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Marquer comme réalisé' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('RPC indisponible');
  });
});
