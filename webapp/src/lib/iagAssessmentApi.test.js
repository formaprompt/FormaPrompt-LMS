import test from 'node:test';
import assert from 'node:assert/strict';
import { createIagAssessmentApi } from './iagAssessmentApi.js';

// Fictive labels only: never copy the paid rubric into a public test fixture.
function source() {
  return { grilles: Object.fromEntries(['1', '2', '3'].map(id => [id, [['Groupe fictif', 20,
    Array.from({ length: 20 }, (_, i) => `Observable fictif ${id}-${i + 1}`)]]])),
  criteres_essentiels: Object.fromEntries(['1', '2', '3'].map(id => [id, [['E1', `Essentiel fictif ${id}`]]])) };
}
function client({ user = 'A', response = { rubricVersion: 'v7-2026-10-21', rubrics: source() }, error = null, afterUser = user } = {}) {
  const calls = []; let authCalls = 0;
  return { calls, auth: { getUser: async () => ({ data: { user: (authCalls++ ? afterUser : user) ? { id: authCalls === 1 ? user : afterUser } : null } }) },
    functions: { invoke: async (name, options) => { calls.push({ name, ...options }); return { data: response, error }; } } };
}
test('private rubric is read by the authenticated endpoint and normalized for three works', async () => {
  const c = client(); const result = await createIagAssessmentApi(c).loadRubrics();
  assert.deepEqual(Object.keys(result), ['1', '2', '3']); assert.equal(result['1'].observations.length, 20);
  assert.equal(result['1'].observations[0].label, 'Observable fictif 1-1');
  assert.deepEqual(c.calls, [{ name: 'paid-course-content', body: { action: 'iag_rubrics', courseId: 'formation-ia-generative-elearning', contentVersion: 'iag-v7-2026-10-21-with-explicit-v8-media' } }]);
});
test('anonymous client never requests the private rubric', async () => {
  const c = client({ user: null }); await assert.rejects(() => createIagAssessmentApi(c).loadRubrics(), /Connectez-vous/); assert.equal(c.calls.length, 0);
});
test('account change discards the returned rubric', async () => {
  const c = client({ afterUser: 'B' }); await assert.rejects(() => createIagAssessmentApi(c).loadRubrics(), /session a changé/);
});
test('server refusal is preserved without falling back to embedded criteria', async () => {
  const c = client({ error: { context: { json: async () => ({ code: 'IAG_POSITIONING_REQUIRED', error: 'Questionnaire requis.' }) } } });
  await assert.rejects(() => createIagAssessmentApi(c).loadRubrics(), { message: 'Questionnaire requis.', code: 'IAG_POSITIONING_REQUIRED' });
});
test('unexpected rubric version and incomplete grids are rejected before rendering', async () => {
  for (const response of [{ rubricVersion: 'other', rubrics: source() }, { rubricVersion: 'v7-2026-10-21', rubrics: {} }])
    await assert.rejects(() => createIagAssessmentApi(client({ response })).loadRubrics(), /version attendue/);
});
