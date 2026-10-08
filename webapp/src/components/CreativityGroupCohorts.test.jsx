import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreativityGroupCohorts from './CreativityGroupCohorts';
import { fetchAvailableCourseCohorts, fetchMyCourseCohortEnrollment, joinCourseCohort } from '../lib/courseCohorts';
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../lib/courseCohorts', () => ({ fetchAvailableCourseCohorts: vi.fn(), fetchMyCourseCohortEnrollment: vi.fn(), joinCourseCohort: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const session = { id: 's1', position: 1, starts_at: '2027-01-05T08:00:00Z', ends_at: '2027-01-05T11:30:00Z', meeting_url: 'https://meet.example.test/one' };
it('enregistre le choix après accès cadeau sans confirmer automatiquement le groupe', async () => {
  fetchAvailableCourseCohorts.mockResolvedValue([{ id: 'group-1', course_id: 'ia-creativite-groupe', status: 'published', available_places: 3, capacity: 6, delivery_mode: 'remote', sessions: [session] }]);
  fetchMyCourseCohortEnrollment.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: 'active', cohort_status: 'published', is_paid: false, delivery_mode: 'remote', sessions: [session] });
  joinCourseCohort.mockResolvedValue({ id: 'enrollment-1' });
  render(<CreativityGroupCohorts userId="gift-user" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Rejoindre cette session' }));
  await waitFor(() => expect(joinCourseCohort).toHaveBeenCalledWith({}, 'group-1'));
  expect(await screen.findByText(/Votre choix de session est enregistré/)).toHaveTextContent('reste à confirmer');
  expect(screen.queryByRole('link', { name: /visioconférence/ })).not.toBeInTheDocument();
});
it('expose la visioconférence seulement après confirmation du groupe', async () => {
  fetchAvailableCourseCohorts.mockResolvedValue([]);
  fetchMyCourseCohortEnrollment.mockResolvedValue({ status: 'active', cohort_status: 'confirmed', is_paid: true, delivery_mode: 'remote', sessions: [session] });
  render(<CreativityGroupCohorts userId="paid-user" />);
  expect(await screen.findByText('Votre groupe est confirmé.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /visioconférence/ })).toHaveAttribute('href', session.meeting_url);
});
it('explique le suivi manuel après annulation sans remboursement automatique', async () => {
  fetchAvailableCourseCohorts.mockResolvedValue([]);
  fetchMyCourseCohortEnrollment.mockResolvedValue({ status: 'cohort_cancelled_refund_review', cohort_status: 'cancelled', is_paid: true, sessions: [] });
  render(<CreativityGroupCohorts userId="paid-user" />);
  expect(await screen.findByText('Cette session a été annulée.')).toBeInTheDocument();
  expect(screen.getByText(/suivi du remboursement/)).toHaveTextContent('intégralement');
  expect(screen.queryByRole('button', { name: /Rejoindre/ })).not.toBeInTheDocument();
});

it('affiche le seuil deux choisi par Thierry pour la session de l’apprenant', async () => {
  fetchAvailableCourseCohorts.mockResolvedValue([]);
  fetchMyCourseCohortEnrollment.mockResolvedValue({ status: 'active', cohort_status: 'confirmed', is_paid: true, minimum_participants: 2, capacity: 5, delivery_mode: 'remote', sessions: [] });
  render(<CreativityGroupCohorts userId="two-user" />);
  expect(await screen.findByText(/2 participants minimum, 5 maximum/)).toBeInTheDocument();
});

it.each(['manual', 'opco'])('ne présente pas le dossier %s annulé comme un cadeau ou un achat à rembourser', async access_source => {
  fetchAvailableCourseCohorts.mockResolvedValue([]);
  fetchMyCourseCohortEnrollment.mockResolvedValue({ status: 'cohort_cancelled_refund_review', cohort_status: 'cancelled', is_paid: false, is_administrative: true, access_source, sessions: [] });
  render(<CreativityGroupCohorts userId="administrative-user" />);
  expect(await screen.findByText('Contactez Thierry pour réorganiser la formation inscrite dans votre dossier.')).toBeInTheDocument();
  expect(screen.queryByText(/vous a été offerte/)).not.toBeInTheDocument();
  expect(screen.queryByText(/suivi du remboursement/)).not.toBeInTheDocument();
});
