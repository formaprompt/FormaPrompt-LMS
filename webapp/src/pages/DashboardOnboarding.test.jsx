import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
const { auth, client, accesses, fixtures, queryCalls } = vi.hoisted(() => ({
  auth: { user: { id: 'account-a', email: 'a@example.test' }, signOut: vi.fn() },
  client: { from: vi.fn() }, accesses: vi.fn(), fixtures: {}, queryCalls: [],
}));
vi.mock('../components/CreativityGroupCohorts', () => ({ default: () => <section><h2>Mes dates — groupe créativité</h2></section> }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../lib/supabaseClient', () => ({ supabase: client }));
vi.mock('../lib/courseAccess', () => ({ fetchCourseAccesses: accesses, fetchCourseAccessEntitlement: async () => ({ data: null, error: null }) }));
vi.mock('../lib/diagnosticRestitution', () => ({ fetchClientDiagnostics: async () => [] }));
vi.mock('../lib/learnerOnboarding', () => ({
  DEFAULT_ONBOARDING_CONFIG: { enabled: true, version: '1' },
  loadLearnerOnboardingConfig: async () => ({ enabled: true, version: '1', title: 'Bienvenue dans votre espace FormaPrompt', description: 'Découvrir votre formation', videoUrl: null }),
  hasSeenOnboardingVideo: () => false,
}));
vi.mock('../data/courseCatalog', () => ({ courseCatalog: { 'formation-ia': { exercises: [{ id: 'known-exercise' }] }, 'ia-creativite-individuel':{exercises:[{id:1}]}, 'ia-creativite-groupe':{exercises:[{id:1}]}, 'ia-creativite-ecole-association':{exercises:[{id:1}]} } }));
vi.mock('../data/learningPathCatalog', () => ({ DEMO_LEARNING_PATH_SLUG: 'known-path', learningPathCatalog: { 'known-path': { id: 'known-path', requiredCourseAccessId: 'formation-ia', lessons: [{ id: 'known-lesson' }] } } }));
beforeEach(() => {
  vi.clearAllMocks(); queryCalls.length = 0;
  Object.keys(fixtures).forEach((key) => delete fixtures[key]);
  auth.user = { id: 'account-a', email: 'a@example.test' }; accesses.mockResolvedValue({ data: [], error: null });
  client.from.mockImplementation((table) => {
    const call = { table, filters: [] }; queryCalls.push(call);
    const query = { then: (resolve) => Promise.resolve(fixtures[table] || { data: [], error: null }).then(resolve) };
    ['select', 'eq', 'neq', 'in', 'order'].forEach((method) => { query[method] = (...args) => { if (method === 'eq') call.filters.push(args); return query; }; });
    return query;
  });
});
afterEach(cleanup);
const mount = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);
describe('Accueil selon progression réelle', () => {
  it('A/B : l’accès seul ne prouve pas une progression et les lectures sont filtrées par compte', async () => {
    accesses.mockResolvedValue({ data: [{ id: 'access', course_id: 'formation-ia', status: 'active' }], error: null });
    mount(); expect(await screen.findByRole('link', { name: 'Découvrir mon espace' })).toBeVisible();
    const lessons = queryCalls.find((query) => query.table === 'course_lesson_progress');
    expect(lessons.filters).toContainEqual(['user_id', 'account-a']); expect(lessons.filters).toContainEqual(['status', 'completed']);
  });
  it.each([
    ['course_exercise_latest_responses', { course_id: 'formation-ia', exercise_id: 'known-exercise', status: 'draft' }],
    ['course_lesson_progress', { user_id: 'account-a', course_id: 'known-path', lesson_id: 'known-lesson', status: 'completed' }],
  ])('C : rend l’accueil discret après signal pédagogique connu (%s)', async (table, row) => {
    fixtures[table] = { data: [row], error: null }; mount();
    await screen.findByText("Vous n'avez pas encore de formation");
    expect(screen.getByRole('link', { name: 'Bien démarrer' })).toBeVisible();
  });
  it.each([
    { user_id: 'account-a', course_id: 'known-path', lesson_id: 'known-lesson', status: 'in_progress' },
    { user_id: 'account-a', course_id: 'unknown-path', lesson_id: 'known-lesson', status: 'completed' },
    { user_id: 'account-a', course_id: 'known-path', lesson_id: 'unknown-lesson', status: 'completed' },
    { user_id: 'account-other', course_id: 'known-path', lesson_id: 'known-lesson', status: 'completed' },
  ])('ne confond pas consultation ou contenu inconnu avec progression réelle (%o)', async (row) => {
    fixtures.course_lesson_progress = { data: [row], error: null }; mount();
    expect(await screen.findByRole('link', { name: 'Découvrir mon espace' })).toBeVisible();
  });
  it('E : progression indisponible reste neutre', async () => {
    fixtures.course_lesson_progress = { data: null, error: { code: 'network' } }; mount();
    await screen.findByText("Vous n'avez pas encore de formation");
    expect(screen.queryByRole('link', { name: 'Découvrir mon espace' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Bien démarrer' })).toBeVisible();
  });
  it('C : une réponse tardive du compte A ne change pas l’accueil du compte B', async () => {
    let resolveA; accesses.mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }));
    fixtures.course_lesson_progress = { data: [{ user_id: 'account-a', course_id: 'known-path', lesson_id: 'known-lesson', status: 'completed' }], error: null };
    const view = mount();
    auth.user = { id: 'account-b', email: 'b@example.test' }; fixtures.course_lesson_progress = { data: [], error: null };
    view.rerender(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Découvrir mon espace' })).toBeVisible();
    resolveA({ data: [], error: null });
    await waitFor(() => expect(screen.getByText('Bienvenue, b@example.test !')).toBeVisible());
    expect(screen.getByRole('link', { name: 'Découvrir mon espace' })).toBeVisible();
    expect(screen.queryByText('Bienvenue, a@example.test !')).toBeNull();
  });
});

it('le cadeau individuel ouvre sa formation et conserve la planification séparée', async () => {
  accesses.mockResolvedValue({ data: [{ id: 'individual-gift', course_id: 'ia-creativite-individuel', status: 'active', access_source: 'gift', purchase_id: null }], error: null });
  mount();
  expect(await screen.findByText('Retrouvez les quatre modules, les activités et les supports de votre formation accompagnée de 14 heures.')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Mes dates — groupe créativité' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '▶ Voir la formation' })).toHaveAttribute('href', '/course/ia-creativite-individuel');
});
it('le cadeau groupe ouvre sa formation et conserve le groupe ouvert', async () => {
  accesses.mockResolvedValue({ data: [{ id: 'group-gift', course_id: 'ia-creativite-groupe', status: 'active', access_source: 'gift', purchase_id: null }], error: null });
  mount();
  expect(await screen.findByRole('heading', { name: 'Mes dates — groupe créativité' })).toBeVisible();
  expect(screen.getByText(/Retrouvez les quatre modules/)).toBeVisible();
  expect(screen.getByRole('link', { name: '▶ Voir la formation' })).toHaveAttribute('href', '/course/ia-creativite-groupe');
  expect(screen.queryByText(/Formation individuelle offerte/)).not.toBeInTheDocument();
});

for (const courseId of ['ia-creativite-individuel','ia-creativite-groupe','ia-creativite-ecole-association']) {
  for (const source of ['gift','purchase']) it(`accès ${source} ${courseId} ouvre le contenu avant réservation`, async () => {
    accesses.mockResolvedValue({data:[{id:'access',course_id:courseId,status:'active',access_source:source,purchase_id:source==='purchase'?'purchase':null}],error:null})
    mount()
    expect(await screen.findByRole('link',{name:'▶ Voir la formation'})).toHaveAttribute('href',`/course/${courseId}`)
    expect(screen.getAllByText('0 %')[0]).toBeVisible()
  })
}
it('réservation confirmée : le contenu individuel reste accessible',async()=>{
  accesses.mockResolvedValue({data:[{id:'access',course_id:'ia-creativite-individuel',status:'active'}],error:null})
  fixtures.course_booking_requests={data:[{id:'booking',course_id:'ia-creativite-individuel',status:'confirmed',delivery_mode:'remote',schedule_format:'four_half_days_3h30',course_session_bookings:[],course_session_attendance:[]}],error:null}
  mount()
  expect(await screen.findByRole('link',{name:'▶ Voir la formation'})).toHaveAttribute('href','/course/ia-creativite-individuel')
})
it('progression créativité provient des réponses enregistrées',async()=>{
  accesses.mockResolvedValue({data:[{id:'access',course_id:'ia-creativite-individuel',status:'active'}],error:null})
  fixtures.course_exercise_latest_responses={data:[{course_id:'ia-creativite-individuel',exercise_id:1,status:'submitted'}],error:null}
  mount()
  expect(await screen.findByRole('link',{name:'▶ Voir la formation'})).toHaveAttribute('href','/course/ia-creativite-individuel')
  expect(screen.getAllByText('100 %')[0]).toBeVisible()
})
