import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const directory = vi.hoisted(() => ({ fetch: vi.fn() }));
const giftRpc = vi.hoisted(() => ({ invoke: vi.fn() }));
const adminAuth = vi.hoisted(() => ({ user: { id: 'admin-id' }, role: 'admin' }));

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => adminAuth,
}));

vi.mock('../lib/supabaseClient', () => {
  const query = () => {
    const result = { data: [], error: null };
    const chain = {
      select: () => chain,
      order: () => chain,
      eq: () => chain,
      or: () => chain,
      range: () => chain,
      gte: () => chain,
      gt: () => chain,
      lt: () => chain,
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };
  return {
    supabase: {
      from: () => query(),
      functions: { invoke: giftRpc.invoke },
      rpc: vi.fn(),
      storage: { from: vi.fn() },
    },
  };
});

vi.mock('../lib/courseAccess', () => ({
  fetchActiveCourseAccesses: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock('../lib/courseCohorts', () => ({
  cancelAdminCourseCohort: vi.fn(),
  cleanupAdminCourseCohortMeetingEvents: vi.fn(),
  confirmAdminCourseCohort: vi.fn(),
  fetchAdminAvailabilitySlotsForMonth: vi.fn(),
  fetchAdminBookingAvailabilitySlots: vi.fn().mockResolvedValue([]),
  fetchAdminCourseCohorts: vi.fn().mockResolvedValue([]),
  fetchAdminCreativityCohortCandidates: vi.fn().mockResolvedValue([]),
  enrollAdminCreativityCohort: vi.fn(),
  generateAdminCourseCohortMeetingLinks: vi.fn(),
  publishAdminCourseCohort: vi.fn(),
  saveAdminCourseCohort: vi.fn(),
  setAdminCourseCohortMeetingUrl: vi.fn(),
}));

vi.mock('../lib/adminLearnerDirectoryApi', () => ({
  LEARNER_DIRECTORY_PAGE_SIZE: 25,
  fetchAdminLearnerDirectory: directory.fetch,
}));

import AdminDashboard from './AdminDashboard';
import { fetchActiveCourseAccesses } from '../lib/courseAccess';
beforeEach(() => { fetchActiveCourseAccesses.mockResolvedValue({ data: [], error: null }); });
afterEach(() => cleanup());
import AdminShell from '../components/AdminShell';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    directory.fetch.mockReset();
    directory.fetch.mockResolvedValue({ items: [], total: 0 });
  });

  afterEach(() => cleanup());

  it('synchronise l’annuaire après une navigation same-route et un retour depuis Vue d’ensemble', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/pedagogique']}>
        <AdminShell><AdminDashboard /></AdminShell>
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByText('Total Utilisateurs');
    fireEvent.click(screen.getByRole('link', { name: 'Apprenants' }));

    expect(await screen.findByRole('heading', { name: 'Apprenants' })).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/pedagogique?onglet=users');
    expect(screen.getByRole('button', { name: 'Apprenants' })).toHaveClass('btn-primary');
    expect(directory.fetch).toHaveBeenCalledWith({ search: '', page: 0 });

    fireEvent.click(screen.getByRole('button', { name: "Vue d'ensemble" }));
    expect(await screen.findByText('Total Utilisateurs')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/pedagogique?onglet=overview');

    fireEvent.click(screen.getByRole('link', { name: 'Apprenants' }));
    expect(await screen.findByRole('heading', { name: 'Apprenants' })).toBeVisible();

    fireEvent.click(screen.getByRole('link', { name: 'Pédagogique' }));
    expect(await screen.findByText('Total Utilisateurs')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/pedagogique');
  });
});

it('présente les trois cadeaux créativité dans le vrai select et attribue explicitement le groupe demandé', async () => {
  directory.fetch.mockResolvedValue({ items: [{ userId: 'local-learner', fullName: 'Apprenant test', email: 'learner@example.test', role: 'user' }], total: 1 });
  giftRpc.invoke.mockReset(); giftRpc.invoke.mockResolvedValue({ data: { access: { id: 'local-gift', user_id: 'local-learner', course_id: 'ia-creativite-groupe', status: 'active', access_source: 'gift' } }, error: null });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  try {
  render(<MemoryRouter initialEntries={['/admin/pedagogique?onglet=users']}><AdminDashboard /></MemoryRouter>);
  const select = await screen.findByLabelText('Formation à offrir');
  for (const courseId of ['ia-creativite-groupe', 'ia-creativite-individuel', 'ia-creativite-ecole-association']) {
    expect(Array.from(select.options).find(option => option.value === courseId)).toBeDefined();
  }
  fireEvent.change(select, { target: { value: 'ia-creativite-groupe' } });
  fireEvent.click(screen.getByRole('button', { name: 'Offrir' }));
  expect(giftRpc.invoke).toHaveBeenCalledWith('admin-grant-course', { body: { targetUserId: 'local-learner', courseId: 'ia-creativite-groupe' } });
  expect(window.confirm).toHaveBeenCalled();
  } finally { confirmSpy.mockRestore(); }
});
