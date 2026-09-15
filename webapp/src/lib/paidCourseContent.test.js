import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchExcelResources,
  fetchExcelTrainerResources,
  fetchOfficeResources,
  fetchOfficeTrainerResources,
  fetchPaidCourseContent,
  fetchTrainerGuideUrl,
} from './paidCourseContent.js';

test('le contenu et le guide passent par l unique Edge Function sécurisée', async (t) => {
  const calls = [];
  const supabase = { functions: { invoke: t.mock.fn(async (name, options) => {
      calls.push({ name, body: options.body });
      if (options.body.action === 'course') {
        return { data: { course: { title: 'Cours protégé' } }, error: null };
      }
      if (options.body.action.startsWith('excel_') || options.body.action.startsWith('office_')) {
        return { data: { resources: [{ title: 'Fichier protégé' }] }, error: null };
      }
      return options.body.action === 'course'
        ? { data: { course: { title: 'Cours protégé' } }, error: null }
        : { data: { signedUrl: 'https://signed.invalid/temporary' }, error: null };
    }) } };

  assert.equal((await fetchPaidCourseContent(supabase, 'formation-ia')).title, 'Cours protégé');
  assert.equal(await fetchTrainerGuideUrl(supabase, 'formation-ia'), 'https://signed.invalid/temporary');
  assert.equal((await fetchExcelResources(supabase, 'excel-perfectionnement-inter'))[0].title, 'Fichier protégé');
  assert.equal((await fetchExcelTrainerResources(supabase, 'excel-avance-inter'))[0].title, 'Fichier protégé');
  assert.equal((await fetchOfficeResources(supabase, 'word-initiation'))[0].title, 'Fichier protégé');
  assert.equal((await fetchOfficeTrainerResources(supabase, 'powerpoint-initiation'))[0].title, 'Fichier protégé');
  assert.deepEqual(calls, [
    { name: 'paid-course-content', body: { action: 'course', courseId: 'formation-ia' } },
    { name: 'paid-course-content', body: { action: 'trainer_guide', courseId: 'formation-ia' } },
    { name: 'paid-course-content', body: { action: 'excel_resources', courseId: 'excel-perfectionnement-inter' } },
    { name: 'paid-course-content', body: { action: 'excel_trainer_resources', courseId: 'excel-avance-inter' } },
    { name: 'paid-course-content', body: { action: 'office_resources', courseId: 'word-initiation' } },
    { name: 'paid-course-content', body: { action: 'office_trainer_resources', courseId: 'powerpoint-initiation' } },
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

test('le grant vidéo est échangé par POST sans placer la signature dans l URL', async (t) => {
  const grant = {
    endpoint: 'https://formaprompt.com/paid-video.php',
    courseId: 'formation-prompt-level-1',
    expiresAt: 1786795200,
    signature: 'a'.repeat(64),
  };
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: String(url), options });
    return { ok: true };
  });
  const supabase = {
    functions: {
      invoke: t.mock.fn(async () => ({ data: { course: { title: 'Cours', videoGrant: grant } }, error: null })),
    },
  };

  const course = await fetchPaidCourseContent(supabase, 'formation-prompt-level-1');
  assert.equal(course.videoUrl, grant.endpoint);
  assert.equal('videoGrant' in course, false);
  assert.equal(requests[0].url, grant.endpoint);
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.credentials, 'include');
  assert.doesNotMatch(requests[0].url, /sig=|signature/);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    course: grant.courseId,
    exp: grant.expiresAt,
    sig: grant.signature,
  });
});
