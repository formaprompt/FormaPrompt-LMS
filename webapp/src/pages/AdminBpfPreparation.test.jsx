import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminBpfPreparation from './AdminBpfPreparation';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ role: 'admin' }) }));
vi.mock('../lib/bpfAdministration', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchBpfAdministration: mocks.fetch,
  createExternalActivity: mocks.create,
  updateExternalActivity: mocks.update,
}));

function external(overrides = {}) {
  return {
    id: 'ext-1', source_kind: 'external', activity_id: 'ext-1', title: 'Formation Excel externe',
    activity_relationship: 'subcontracted_to_us', ordering_organization: 'OF partenaire',
    customer_category: 'training_organization', funding_mode: 'company', delivery_mode: 'remote',
    starts_on: '2026-03-01', ends_on: '2026-03-02', status: 'completed', trainee_count: 3,
    delivered_hours: 7, trainee_hours: 18, invoiced_amount_cents: 100000,
    collected_amount_cents: 60000, invoice_status: 'partially_paid', invoice_reference: 'F-01',
    administrative_note: 'Note', ...overrides,
  };
}

function dataset(overrides = {}) {
  const row = external();
  return {
    externalActivities: [row],
    internalActivities: [{ ...row, id: undefined, source_kind: 'internal_lms', activity_id: 'int-1', activity_relationship: null, ordering_organization: null, trainee_reference: 'learner-1', title: 'formation-ia', trainee_count: 1, delivered_hours: 7, trainee_hours: 7, invoiced_amount_cents: null, collected_amount_cents: null, invoice_status: null }],
    allActivities: [{ ...row, source_kind: 'internal_lms', activity_id: 'int-1', activity_relationship: null, ordering_organization: null, trainee_reference: 'learner-1', title: 'formation-ia', trainee_count: 1, delivered_hours: 7, trainee_hours: 7, invoiced_amount_cents: null, collected_amount_cents: null, invoice_status: null }, row],
    bpfRows: [
      { source_kind: 'internal_lms', activity_id: 'int-1', title: 'formation-ia', starts_on: '2026-03-01', ends_on: '2026-03-02', trainee_count: 1, training_hours: 7, trainee_hours: 7, product_amount_cents: 50000, product_amount_basis: 'internal_administrative_amount' },
      { source_kind: 'external', activity_id: 'ext-1', title: row.title, activity_relationship: row.activity_relationship, starts_on: row.starts_on, ends_on: row.ends_on, trainee_count: 3, training_hours: 7, trainee_hours: 18, product_amount_cents: 100000, product_amount_basis: 'external_invoiced_amount', invoice_status: row.invoice_status },
    ],
    identities: [{ id: 'int-1', user_id: 'learner-1', course_id: 'formation-ia', learner_first_name: 'Marie', learner_last_name: 'Dupont', organization_name: 'Entreprise Alpha' }],
    ...overrides,
  };
}

function renderPage(path = '/admin/bpf') {
  return render(<MemoryRouter initialEntries={[path]}><AdminBpfPreparation /></MemoryRouter>);
}

describe('AdminBpfPreparation', () => {
  beforeEach(() => {
    mocks.fetch.mockResolvedValue(dataset());
    mocks.create.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
  });
  afterEach(() => { cleanup(); Object.values(mocks).forEach((mock) => mock.mockReset()); });

  it('affiche la consolidation interne/externe avec les limites BPF explicites', async () => {
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement');
    expect(await screen.findByRole('heading', { name: 'Synthèse de l’activité réalisée' })).toBeVisible();
    expect(screen.getByText('Formations réalisées').closest('article')).toHaveTextContent('2');
    expect(screen.getAllByText('Heures-stagiaires')[0].closest('article')).toHaveTextContent('25 h');
    expect(screen.getByText(/ces données ne constituent pas une déclaration officielle/i)).toBeVisible();
    expect(screen.getByText(/Facturé :/)).toHaveTextContent('Encaissé');
  });

  it('crée une activité directe sans donnée nominative de stagiaire', async () => {
    mocks.fetch.mockResolvedValue(dataset({ externalActivities: [], allActivities: [], internalActivities: [], bpfRows: [] }));
    renderPage();
    await screen.findByText('Aucune activité externe pour ces filtres.');
    await userEvent.click(screen.getByText('Créer une activité externe'));
    await userEvent.type(screen.getByLabelText('Intitulé'), 'Formation bureautique externe');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’activité' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ title: 'Formation bureautique externe', activityRelationship: 'direct' })));
    expect(screen.queryByLabelText(/nom du stagiaire/i)).not.toBeInTheDocument();
  });

  it('modifie une activité et permet de la marquer annulée', async () => {
    renderPage();
    const card = (await screen.findAllByRole('heading', { name: 'Formation Excel externe' }))[0].closest('article');
    await userEvent.click(within(card).getByText('Modifier l’activité'));
    await userEvent.selectOptions(within(card).getByLabelText('Statut'), 'cancelled');
    await userEvent.click(within(card).getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ activityId: 'ext-1', status: 'cancelled' })));
  });

  it('explique que les heures-stagiaires peuvent différer du produit simple', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Activités de formation hors LMS' });
    await userEvent.click(screen.getByText('Créer une activité externe'));
    expect(screen.getAllByText(/peuvent différer de stagiaires × durée/)[0]).toBeVisible();
  });

  it('filtre les relations de sous-traitance et reste sans table illisible', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Activités de formation hors LMS' });
    await userEvent.selectOptions(screen.getByLabelText('Relation'), 'direct');
    expect(screen.getByText('Aucune activité externe pour ces filtres.')).toBeVisible();
    expect(document.querySelector('table')).not.toBeInTheDocument();
  });

  it('gère les états vide et erreur', async () => {
    mocks.fetch.mockResolvedValueOnce(dataset({ externalActivities: [], internalActivities: [], allActivities: [], bpfRows: [] }));
    const view = renderPage();
    expect(await screen.findByText(/Aucune activité réalisée ne remplit/)).toBeVisible();
    view.unmount();
    mocks.fetch.mockRejectedValueOnce(new Error('Projection indisponible'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Projection indisponible');
  });

  it('conserve une erreur de création visible sans masquer silencieusement le RPC', async () => {
    mocks.create.mockRejectedValueOnce(new Error('Création refusée'));
    renderPage();
    await screen.findByRole('heading', { name: 'Activités de formation hors LMS' });
    const createPanel = screen.getByText('Créer une activité externe').closest('details');
    await userEvent.click(within(createPanel).getByText('Créer une activité externe'));
    await userEvent.type(within(createPanel).getByLabelText('Intitulé'), 'Formation externe contrôlée');
    await userEvent.click(within(createPanel).getByRole('button', { name: 'Créer l’activité' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Création refusée');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('présente les activités individuelles par nom et entreprise avec un dossier ciblé', async () => {
    renderPage();
    const heading = await screen.findByRole('heading', { name: /Entreprise Alpha — Marie Dupont · Formation IA générative/ });
    const card = heading.closest('article');
    expect(card).toHaveAttribute('id', 'bpf-activity-internal_lms-int-1');
    expect(within(card).getByRole('link', { name: 'Ouvrir le dossier apprenant' })).toHaveAttribute('href', '/admin/apprenants/learner-1');
    expect(screen.getByRole('heading', { name: /OF partenaire — 3 participants concernés · Formation Excel externe/ })).toBeVisible();
  });

  it('affiche le nom individuel sans entreprise et masque les noms pour un groupe LMS', async () => {
    const individual = dataset({ identities: [{ id: 'int-1', learner_first_name: 'Nora', learner_last_name: 'Bernard' }] });
    mocks.fetch.mockResolvedValueOnce(individual);
    const view = renderPage();
    expect(await screen.findByRole('heading', { name: /Nora Bernard · Formation IA générative/ })).toBeVisible();
    view.unmount();
    const group = dataset();
    group.allActivities[0].trainee_count = 3;
    group.internalActivities[0].trainee_count = 3;
    group.bpfRows[0].trainee_count = 3;
    mocks.fetch.mockResolvedValueOnce(group);
    renderPage();
    expect(await screen.findByRole('heading', { name: /Entreprise Alpha — 3 participants concernés · Formation IA générative/ })).toBeVisible();
    expect(screen.queryByText(/Marie Dupont/)).not.toBeInTheDocument();
  });

  it('un lien de contrôle conserve la période et cible la carte externe', async () => {
    const row = external({ invoice_status: 'not_invoiced' });
    mocks.fetch.mockResolvedValue(dataset({ externalActivities: [row], allActivities: [row], internalActivities: [], bpfRows: [] }));
    renderPage('/admin/bpf?du=2026-03-01&au=2026-03-02#bpf-activity-external-ext-1');
    const link = await screen.findByRole('link', { name: 'Contrôler l’activité' });
    expect(link).toHaveAttribute('href', '/admin/bpf?du=2026-03-01&au=2026-03-02#bpf-activity-external-ext-1');
    expect(screen.getByLabelText('Début de l’exercice')).toHaveValue('2026-03-01');
    expect(screen.getByLabelText('Fin de l’exercice')).toHaveValue('2026-03-02');
    expect(mocks.fetch).toHaveBeenCalledWith(expect.anything(), { dateFrom: '2026-03-01', dateTo: '2026-03-02' });
    const card = document.getElementById('bpf-activity-external-ext-1');
    expect(card).toHaveFocus();
    expect(within(card).getByRole('heading', { name: 'Formation Excel externe' })).toBeVisible();
  });

  it('une activité interne hors projection reste identifiable et ciblable sans produit inventé', async () => {
    const data = dataset();
    const internal = { ...data.internalActivities[0], delivered_hours: null, trainee_hours: null };
    mocks.fetch.mockResolvedValue(dataset({ externalActivities: [], allActivities: [internal], internalActivities: [internal], bpfRows: [] }));
    renderPage('/admin/bpf?du=2026-03-01&au=2026-03-02#bpf-activity-internal_lms-int-1');
    expect(await screen.findByRole('heading', { name: 'Activités LMS hors projection BPF' })).toBeVisible();
    const card = document.getElementById('bpf-activity-internal_lms-int-1');
    expect(card).toHaveFocus();
    expect(card).toHaveTextContent('Entreprise Alpha — Marie Dupont');
    expect(card).toHaveTextContent('Hors projection');
    expect(within(card).getAllByText('À vérifier')).toHaveLength(2);
    expect(card).not.toHaveTextContent('0 h');
    expect(card).toHaveTextContent('contrôle requis');
    for (const link of screen.getAllByRole('link', { name: 'Contrôler l’activité' })) {
      expect(link).toHaveAttribute('href', '/admin/bpf?du=2026-03-01&au=2026-03-02#bpf-activity-internal_lms-int-1');
    }
    expect(within(card).getByRole('link', { name: 'Ouvrir le dossier apprenant' })).toHaveAttribute('href', '/admin/apprenants/learner-1');
  });
});
