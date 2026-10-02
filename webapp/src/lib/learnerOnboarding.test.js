import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ONBOARDING_CONFIG, normalizeLearnerOnboardingConfig,
  loadLearnerOnboardingConfig, hasSeenOnboardingVideo, markOnboardingVideoSeen,
} from './learnerOnboarding.js';

test('configuration absente ou invalide : guide disponible sans média inventé', () => {
  for (const raw of [null, undefined, [], 'invalid', {}]) {
    assert.deepEqual(normalizeLearnerOnboardingConfig(raw), DEFAULT_ONBOARDING_CONFIG);
  }
  const config = normalizeLearnerOnboardingConfig({ enabled: false, title: '  Mon espace  ', version: '2' });
  assert.equal(config.enabled, false);
  assert.equal(config.title, 'Mon espace');
  assert.equal(config.version, '2');
  assert.equal(normalizeLearnerOnboardingConfig({ title: 'x'.repeat(161) }).title, DEFAULT_ONBOARDING_CONFIG.title);
});

test('accepte les fichiers publics du site et supprime les données inconnues', () => {
  const config = normalizeLearnerOnboardingConfig({
    videoUrl: '/media/onboarding/prise-en-main.mp4', thumbnailUrl: 'https://formaprompt.com/media/onboarding/image.webp',
    captionsUrl: '/media/onboarding/prise-en-main.vtt', durationLabel: '3 min', secret: 'not-copied',
  });
  assert.equal(config.videoUrl, '/media/onboarding/prise-en-main.mp4');
  assert.equal(config.captionsUrl, '/media/onboarding/prise-en-main.vtt');
  assert.equal(config.thumbnailUrl, 'https://formaprompt.com/media/onboarding/image.webp');
  assert.equal(config.durationLabel, '3 min');
  assert.equal('secret' in config, false);
});

test('refuse origine externe, URLs privées, exécutables et signées', () => {
  for (const videoUrl of [
    '//formaprompt.com/a.mp4', 'javascript:alert(1)', 'data:video/mp4,abc',
    'https://other.test/a.mp4', 'https://user:password@formaprompt.com/a.mp4',
    'http://formaprompt.com/a.mp4', '/a.mp4?token=x', '/a.mp4#fragment', '/a.mp4?', '/a.mp4#',
    '/private-course-content/a.mp4', '/storage/v1/object/sign/a.mp4', '/api/a.mp4',
    '/paid-video/a.mp4', '/a.php', '/media%2fprivate-course-content/a.mp4',
    '/media%252fprivate-course-content/a.mp4', '/media/a.mp4%3ftoken=x', '/media\\a.mp4',
    '/assets/FP_-_Capsule_001.mp4', '/media/onboarding/guide.mp4?token=x',
    '/media/onboarding/guide.mp4?', '/media/onboarding/guide.mp4#',
    'https://other.test/media/onboarding/guide.mp4', '/media/onboarding/../private/guide.mp4',
  ]) {
    assert.equal(normalizeLearnerOnboardingConfig({ videoUrl }).videoUrl, null, videoUrl);
  }
  const config = normalizeLearnerOnboardingConfig({
    videoUrl: '/media/onboarding/a.mp4', thumbnailUrl: '/media/onboarding/a.svg', captionsUrl: 'https://other.test/a.vtt',
  });
  assert.equal(config.thumbnailUrl, null);
  assert.equal(config.captionsUrl, null);
  assert.equal(normalizeLearnerOnboardingConfig({ durationLabel: '3 min', thumbnailUrl: '/a.png' }).durationLabel, null);
});

test('origine courante respectée également en démonstration locale', (t) => {
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'http://localhost:5173' } });
  t.after(() => delete globalThis.location);
  assert.equal(normalizeLearnerOnboardingConfig({ videoUrl: '/media/onboarding/a.mp4' }).videoUrl, '/media/onboarding/a.mp4');
  assert.equal(normalizeLearnerOnboardingConfig({ videoUrl: 'https://formaprompt.com/media/onboarding/a.mp4' }).videoUrl, null);
});

test('sous-titres incrustés déclarés explicitement et seulement avec une vidéo', () => {
  const videoUrl = '/media/onboarding/bien-demarrer-espace-apprenant-v2.mp4';
  assert.equal(normalizeLearnerOnboardingConfig({ videoUrl, captionsEmbedded: true }).captionsEmbedded, true);
  assert.equal(normalizeLearnerOnboardingConfig({ videoUrl, captionsEmbedded: 'true' }).captionsEmbedded, false);
  assert.equal(normalizeLearnerOnboardingConfig({ captionsEmbedded: true }).captionsEmbedded, false);
});

test('chargement runtime sans cache, fallback réseau/JSON/HTTP et annulation conservée', async (t) => {
  const controller = new AbortController();
  let argumentsReceived;
  t.mock.method(globalThis, 'fetch', async (...args) => {
    argumentsReceived = args;
    return { ok: true, json: async () => ({ title: 'Guide actuel' }) };
  });
  assert.equal((await loadLearnerOnboardingConfig({ signal: controller.signal })).title, 'Guide actuel');
  assert.deepEqual(argumentsReceived, ['/config/learner-onboarding.json', { cache: 'no-store', signal: controller.signal }]);
  for (const response of [
    async () => ({ ok: false }),
    async () => { throw new Error('offline'); },
    async () => ({ ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } }),
  ]) {
    globalThis.fetch = response;
    assert.deepEqual(await loadLearnerOnboardingConfig(), DEFAULT_ONBOARDING_CONFIG);
  }
  globalThis.fetch = async () => { throw new DOMException('cancelled', 'AbortError'); };
  await assert.rejects(loadLearnerOnboardingConfig(), { name: 'AbortError' });
});

test('consultation propre au compte et à la version, sans information de droit', (t) => {
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value),
  } });
  t.after(() => delete globalThis.localStorage);
  assert.equal(hasSeenOnboardingVideo('a', '1'), false);
  assert.equal(markOnboardingVideoSeen('a', '1'), true);
  assert.equal(hasSeenOnboardingVideo('a', '1'), true);
  assert.equal(hasSeenOnboardingVideo('b', '1'), false);
  assert.equal(hasSeenOnboardingVideo('a', '2'), false);
  assert.equal(markOnboardingVideoSeen('', '1'), false);
  assert.equal(markOnboardingVideoSeen('a', ''), false);
  assert.equal(hasSeenOnboardingVideo(null, '1'), false);
  assert.deepEqual([...values.values()], ['seen']);
});

test('stockage absent ou bloqué : aucune exception et aucun faux état consulté', (t) => {
  assert.equal(markOnboardingVideoSeen('a', '1'), false);
  assert.equal(hasSeenOnboardingVideo('a', '1'), false);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  t.after(() => delete globalThis.localStorage);
  assert.equal(markOnboardingVideoSeen('a', '1'), false);
  assert.equal(hasSeenOnboardingVideo('a', '1'), false);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); },
  } });
  assert.equal(markOnboardingVideoSeen('a', '1'), false);
  assert.equal(hasSeenOnboardingVideo('a', '1'), false);
});
