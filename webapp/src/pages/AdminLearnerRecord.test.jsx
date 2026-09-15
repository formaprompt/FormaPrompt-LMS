import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminLearnerRecord from './AdminLearnerRecord';

const LEARNER_ID = '72000000-0000-4000-8000-000000000002';
const { rpcMock, authState } = vi.hoisted(() => ({ rpcMock: vi.fn(), authState: { user: { id: 'admin-id' }, role: 'admin' } }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc: rpcMock } }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => authState }));

const record = {
  identity: { userId: LEARNER_ID, role: 'user', fullName: 'Camille Martin', email: 'camille@example.fr', organizationName: null, createdAt: '2026-09-01T10:00:00Z' },
  enrollments: [{ id: 'e1', courseId: 'formation-ia', status: 'in_progress', startsAt: '2026-09-10T09:00:00Z', endsAt: '2026-09-12T17:00:00Z' }],
  rights: [{ id: 'r1', courseId: 'formation-ia', status: 'active', expiresAt: null }],
  purchases: [], gifts: [], progress: [], pendingCorrections: [], bookingRequests: [], commercialRequests: [], reviews: [], documents: [], attestations: [], notes: [],
};

function renderPage(entry = `/admin/apprenants/${LEARNER_ID}`) {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/admin/apprenants/:userId" element={<AdminLearnerRecord />} /><Route path="/dashboard" element={<p>Dashboard apprenant</p>} /></Routes></MemoryRouter>);
}

describe('fiche apprenant administrative', () => {
  afterEach(() => { cleanup(); rpcMock.mockReset(); authState.user = { id: 'admin-id' }; authState.role = 'admin'; });

  it('charge le UUID exact et distingue les rubriques vides', async () => {
    rpcMock.mockResolvedValue({ data: record, error: null });
    renderPage();
    await screen.findByRole('heading', { name: 'Camille Martin' });
    expect(rpcMock).toHaveBeenCalledWith('admin_get_learner_record', { p_user_id: LEARNER_ID });
    expect(screen.getAllByText('Non renseigné').length).toBeGreaterThan(0);
    expect(screen.getByText('Apprenant')).toBeVisible();
    expect(screen.getByText('Aucune progression enregistrée')).toBeInTheDocument();
    expect(screen.getByText('Aucun avis nominativement relié')).toBeInTheDocument();
  });

  it('conserve une recherche bornée dans le retour vers l’annuaire', async () => {
    rpcMock.mockResolvedValue({ data: record, error: null });
    renderPage(`/admin/apprenants/${LEARNER_ID}?retourRecherche=%C3%89lodie%20Martin&retourPage=2`);
    expect(await screen.findByRole('link', { name: '← Retour aux apprenants : Élodie Martin' })).toHaveAttribute('href', '/admin/pedagogique?onglet=users&recherche=%C3%89lodie%20Martin&page=2');
  });

  it('présente une erreur de chargement comme indisponible, jamais comme une fiche vide', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Fiche indisponible'));
    expect(screen.queryByText('Aucune progression enregistrée')).not.toBeInTheDocument();
  });

  it('ouvre les corrections et la seule réservation en attente de réponse formateur par leur identifiant exact', async () => {
    rpcMock.mockResolvedValue({ data: {
      ...record,
      pendingCorrections: [
        { kind: 'exercise', submissionId: 42, courseId: 'formation-ia', exerciseId: 'mise-en-situation', submittedAt: '2026-09-15T08:00:00Z' },
        { kind: 'final_project', submissionId: 84, courseId: 'formation-ia', exerciseId: null, submittedAt: '2026-09-15T09:00:00Z' },
      ],
      bookingRequests: [
        { id: '72000000-0000-4000-8000-000000000009', courseId: 'formation-ia', status: 'pending_distance', needsTrainerResponse: true, createdAt: '2026-09-15T10:00:00Z' },
        { id: '72000000-0000-4000-8000-000000000010', courseId: 'formation-ia', status: 'confirmed', needsTrainerResponse: false, createdAt: '2026-09-14T10:00:00Z' },
      ],
    }, error: null });
    renderPage();
    expect(await screen.findByRole('link', { name: 'Corriger' })).toHaveAttribute('href', '/admin/pedagogique?onglet=corrections&correction=exercise&submissionId=42#exercise-submission-42');
    expect(screen.getByRole('link', { name: 'Évaluer' })).toHaveAttribute('href', '/admin/pedagogique?onglet=corrections&correction=project&submissionId=84#final-project-submission-84');
    expect(screen.getByRole('link', { name: 'Voir et répondre' })).toHaveAttribute('href', '/admin/pedagogique?onglet=bookings&bookingId=72000000-0000-4000-8000-000000000009#booking-request-72000000-0000-4000-8000-000000000009');
    expect(screen.getAllByRole('link', { name: 'Voir et répondre' })).toHaveLength(1);
  });

  it('distingue achat remisé, remboursement et cadeau sans inventer de code promotionnel', async () => {
    rpcMock.mockResolvedValue({ data: {
      ...record,
      purchases: [
        { id: 'p1', courseId: 'formation-ia', paymentStatus: 'partially_refunded', amountPaid: 16830, currency: 'eur', originalAmount: 18700, discountAmount: 1870, promotionCode: null, refundedAmount: 3000, netAmount: 13830, purchasedAt: '2026-09-12T10:00:00Z' },
        { id: 'p2', courseId: 'formation-ia-act', paymentStatus: 'refunded', amountPaid: 14900, currency: 'eur', originalAmount: null, discountAmount: null, promotionCode: null, refundedAmount: 14900, netAmount: 0, purchasedAt: '2026-08-12T10:00:00Z' },
      ],
      gifts: [{ id: 'g1', courseId: 'excel-initiation-inter', status: 'active', grantedAt: '2026-09-10T10:00:00Z' }],
    }, error: null });
    renderPage();
    await screen.findByRole('heading', { name: 'Camille Martin' });
    expect(screen.getByText('Partiellement remboursé')).toBeInTheDocument();
    expect(screen.getByText('Prix avant remise :', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Code promotionnel : Non renseigné')).toBeInTheDocument();
    expect(screen.getByText('Remboursé')).toBeInTheDocument();
    expect(screen.getByText('Offert')).toBeInTheDocument();
  });

  it.each(['user', 'employee'])('redirige le rôle %s sans appeler la RPC', async (role) => {
    authState.role = role;
    renderPage();
    await screen.findByText('Dashboard apprenant');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
