import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CoursePlayer from './CoursePlayer';
import { creativityCourseCatalog } from '../../supabase/functions/_shared/creativityCourseCatalog.js';
const state = vi.hoisted(() => ({ access: null, tables: [], writes: [], course: null, user: { id: 'learner', email: 'learner@example.test' } }));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('../lib/paidCourseContent', () => ({ fetchPaidCourseContent: async (_client, id) => {
  if (!state.access || state.access.course_id !== id || state.access.status !== 'active' || (state.access.expires_at && new Date(state.access.expires_at) <= new Date())) {
    throw Object.assign(new Error('Accès à la formation refusé.'), { status: 403 });
  }
  const { creativityCourseCatalog: catalog } = await import('../../supabase/functions/_shared/creativityCourseCatalog.js');
  return state.course || catalog[id];
} }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: table => {
  state.tables.push(table);
  let payload;
  const query = { select: () => query, eq: () => query, limit: () => query, order: () => query,
    insert: value => { payload = value; state.writes.push({ table, payload: value }); return query; },
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: { id: 'saved-version', ...payload, saved_at: new Date().toISOString() }, error: null }),
    then: resolve => Promise.resolve({ data: [], error: null }).then(resolve),
  }; return query;
} } }));
const ids = Object.keys(creativityCourseCatalog);
beforeEach(() => { state.access = { course_id: ids[0], status: 'active', expires_at: null }; state.tables = []; state.writes = []; state.course = null; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const show = (id = ids[0]) => render(<MemoryRouter initialEntries={[`/course/${id}`]}><Routes><Route path='/course/:id' element={<CoursePlayer />} /><Route path='/formation-ia-creativite' element={<h1>Présentation créativité</h1>} /></Routes></MemoryRouter>);
for (const id of ids) it(`droit actif exact ${id} : quatre séances, six activités et cinq supports sans quiz`, async () => {
  state.access.course_id = id;
  show(id);
  expect(await screen.findByRole('heading', { name: creativityCourseCatalog[id].title, level: 1 })).toBeVisible();
  for (const module of creativityCourseCatalog[id].modules) expect(screen.getByText(module.title)).toBeVisible();
  for (const resource of creativityCourseCatalog[id].textResources) expect(screen.getByRole('heading', { name: resource.title })).toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: /Exercices pratiques/ }));
  expect(screen.getAllByRole('textbox', { name: /Votre réponse à l'exercice/ })).toHaveLength(6);
  expect(state.tables).not.toContain('course_positioning_assessments');
  expect(state.tables).not.toContain('purchases');
});
it('une réponse terminée est enregistrée avec l’identifiant exact et une progression réelle', async () => {
  show(); await screen.findByRole('heading', { name: creativityCourseCatalog[ids[0]].title, level: 1 });
  fireEvent.click(screen.getByRole('tab', { name: /Exercices pratiques/ }));
  const answer = screen.getAllByRole('textbox', { name: /Votre réponse à l'exercice/ })[0];
  fireEvent.change(answer, { target: { value: 'Mon cadrage et mes critères ont été vérifiés.' } });
  const article = answer.closest('article');
  fireEvent.click(within(article).getByRole('button', { name: /Déclarer la réponse terminée/ }));
  await waitFor(() => expect(state.writes).toContainEqual({ table: 'course_exercise_responses', payload: { user_id: 'learner', course_id: ids[0], exercise_id: String(creativityCourseCatalog[ids[0]].exercises[0].id), response_text: 'Mon cadrage et mes critères ont été vérifiés.', status: 'submitted' } }));
  expect((await screen.findAllByText('17 %'))[0]).toBeVisible();
  expect(state.writes.some(write => write.table === 'course_positioning_assessments')).toBe(false);
});
it('les quatre livrables sont remis au formateur avec les champs de stockage existants', async () => {
  show(); await screen.findByRole('heading', { name: creativityCourseCatalog[ids[0]].title, level: 1 });
  for (const field of creativityCourseCatalog[ids[0]].finalProject.submissionFields) fireEvent.change(screen.getByLabelText(field.label), { target: { value: `Description vérifiée ${field.id}` } });
  fireEvent.click(screen.getByRole('button', { name: 'Remettre au formateur' }));
  await screen.findByText('Vos quatre livrables ont été remis au formateur.');
  expect(state.writes[0]).toEqual({ table: 'course_final_project_submissions', payload: { user_id: 'learner', course_id: ids[0], prompt_and_iterations: 'Description vérifiée prompt_and_iterations', final_output: 'Description vérifiée final_output', verification_grid_reference: 'Description vérifiée verification_grid_reference', action_plan: 'Description vérifiée action_plan', learner_note: '', status: 'submitted' } });
});
for (const status of ['refunded', 'revoked', 'suspended']) it(`droit ${status} : aucun contenu ni suivi chargé`, async () => {
  state.access.status = status; show(); await screen.findByRole('heading', { name: 'Présentation créativité' }); expect(state.tables).toEqual([]); expect(state.writes).toEqual([]);
});
it('un droit groupe ne donne pas accès au contenu individuel', async () => {
  state.access.course_id = 'ia-creativite-groupe'; show('ia-creativite-individuel'); await screen.findByRole('heading', { name: 'Présentation créativité' }); expect(state.tables).toEqual([]);
});
it('un droit expiré ne donne pas accès au contenu', async () => {
  state.access.expires_at = '2020-01-01'; show(); await screen.findByRole('heading', { name: 'Présentation créativité' }); expect(state.tables).toEqual([]);
});
it('aucun HTML brut, image ou lien externe n’est activé dans les supports textuels', async () => {
  state.course = structuredClone(creativityCourseCatalog[ids[0]]);
  state.course.textResources[0].markdown = '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[lien externe](https://example.test)';
  show(); await screen.findByRole('heading', { name: state.course.title, level: 1 });
  const article = screen.getByRole('heading', { name: state.course.textResources[0].title }).closest('details');
  fireEvent.click(within(article).getByText(state.course.textResources[0].title));
  expect(article.querySelector('script,img,a')).toBeNull(); expect(within(article).getByText('lien externe')).toBeVisible();
});
