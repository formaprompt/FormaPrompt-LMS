import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { COURSE_OPTIONS } from '../lib/adminEnrollmentCourses';
import AdminEnrollments from './AdminEnrollments';

const fixture = vi.hoisted(() => ({ enrollments: [], invoke: vi.fn() }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: staff, role: 'admin' }) }));
const staff = { id: 'fixture-staff' };
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: async () => ({ data: table === 'training_enrollments' ? fixture.enrollments : [], error: null }),
      };
      return chain;
    },
    functions: { invoke: fixture.invoke },
  },
}));
afterEach(() => { cleanup(); fixture.invoke.mockReset(); });

it('propose les trois formules créativité avec 14 h et leurs tarifs catalogues', () => {
  expect(COURSE_OPTIONS['ia-creativite-groupe']).toMatchObject({ durationMinutes: 840, priceAmountCents: 69000, service: true });
  expect(COURSE_OPTIONS['ia-creativite-individuel']).toMatchObject({ durationMinutes: 840, priceAmountCents: 90000, service: true });
  expect(COURSE_OPTIONS['ia-creativite-ecole-association']).toMatchObject({ durationMinutes: 840, priceAmountCents: 160000, service: true });
});

it('permet de compléter un ancien dossier clôturé dont le questionnaire est manquant', async () => {
  const enrollment = {
    id: 'enrollment-1', user_id: 'learner-1', learner_first_name: 'Camille', learner_last_name: 'Exemple',
    course_id: 'formation-ia-act', status: 'completed', booking_request_id: 'booking-1',
    starts_at: '2026-10-04T09:00:00Z', ends_at: '2026-10-04T13:00:00Z',
    training_documents: [
      { id: 'doc-1', document_type: 'completion_certificate', status: 'ready' },
      { id: 'doc-2', document_type: 'satisfaction_questionnaire', status: 'missing' },
    ],
  };
  fixture.enrollments = [enrollment];
  fixture.invoke
    .mockResolvedValueOnce({ error: { context: { json: async () => ({ error: 'Réessayez la clôture.' }) } } })
    .mockImplementationOnce(async () => {
      enrollment.training_documents[1].status = 'ready';
      return { data: { enrollment, certificateGenerated: true }, error: null };
    });
  render(<MemoryRouter><AdminEnrollments /></MemoryRouter>);
  const name = 'Compléter les documents de clôture';
  fireEvent.click(await screen.findByRole('button', { name }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Réessayez la clôture.');
  fireEvent.click(await screen.findByRole('button', { name }));
  expect(await screen.findByText(/Clôture confirmée/)).toBeVisible();
  expect(await screen.findByText('Suivi depuis l’espace apprenant')).toBeVisible();
  expect(screen.queryByRole('button', { name })).toBeNull();
  expect(fixture.invoke).toHaveBeenCalledTimes(2);
  expect(fixture.invoke).toHaveBeenLastCalledWith('admin-manage-enrollment', {
    body: { action: 'complete_enrollment', enrollmentId: 'enrollment-1' },
  });
});
