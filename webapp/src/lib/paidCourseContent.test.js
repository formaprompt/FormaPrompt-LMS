import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPaidCourseContent, fetchTrainerGuideUrl } from './paidCourseContent.js';

test('le contenu et le guide passent par l unique Edge Function sécurisée', async (t) => {
  const calls = [];
  const supabase = { functions: { invoke: t.mock.fn(async (name, options) => {
      calls.push({ name, body: options.body });
      return options.body.action === 'course'
        ? { data: { course: { title: 'Cours protégé' } }, error: null }
        : { data: { signedUrl: 'https://signed.invalid/temporary' }, error: null };
    }) } };

  assert.equal((await fetchPaidCourseContent(supabase, 'formation-ia')).title, 'Cours protégé');
  assert.equal(await fetchTrainerGuideUrl(supabase, 'formation-ia'), 'https://signed.invalid/temporary');
  assert.deepEqual(calls, [
    { name: 'paid-course-content', body: { action: 'course', courseId: 'formation-ia' } },
    { name: 'paid-course-content', body: { action: 'trainer_guide', courseId: 'formation-ia' } },
  ]);
});

test('les erreurs serveur sont présentées sans charge utile technique', async (t) => {
  const supabase = {
    functions: {
      invoke: t.mock.fn(async () => ({
        data: null,
        error: {
          context: {
            status: 403,
            json: async () => ({ error: 'Accès à la formation refusé.', internal: 'secret' }),
          },
        },
      })),
    },
  };
  await assert.rejects(fetchPaidCourseContent(supabase, 'formation-ia'), (error) => {
    assert.equal(error.message, 'Accès à la formation refusé.');
    assert.equal(error.status, 403);
    assert.doesNotMatch(error.message, /secret|internal/);
    return true;
  });
});
