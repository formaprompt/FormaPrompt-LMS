import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGoogleAnalytics, getPublicAnalyticsPage } from './googleAnalytics.js';

const ID = 'G-FL8HMVXF4Z';
function fixture(options = {}) {
  let choice = options.choice ?? 'granted';
  let auth = options.auth ?? { loading: false, user: null };
  let subscriber;
  let cleaned = 0;
  const scripts = [];
  const policies = [];
  const win = { location: { origin: 'https://formaprompt.com', search: '', hash: '', ...options.location },
    ...options.window };
  const doc = { head: { appendChild: (node) => node.tagName === 'SCRIPT' ? scripts.push(node) : policies.push(node) },
    createElement: (tag) => ({ tagName: tag.toUpperCase() }) };
  const engine = createGoogleAnalytics({ window: win, document: doc,
    env: { PROD: true, VITE_GOOGLE_ANALYTICS_ENABLED: 'true', VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID: ID,
      VITE_GOOGLE_ANALYTICS_PRIVACY_REVIEWED: 'true', ...options.env },
    getConsent: () => choice, subscribeConsent: (fn) => { subscriber = fn; },
    getAuthState: () => auth, clearCookies: () => { cleaned += 1; } });
  return { engine, win, scripts, policies, load: () => scripts.at(-1)?.onload?.(),
    choose: (value) => { choice = value; subscriber(value); }, setAuth: (value) => { auth = value; },
    commands: () => (win.formapromptAudienceLayer || []).map((args) => [...args]),
    views: () => (win.formapromptAudienceLayer || []).filter((args) => args[0] === 'event'), cleaned: () => cleaned };
}
test('production, privacy review, exact origin, valid ID and audience grant all required before script', () => {
  for (const options of [{ env: { PROD: false } }, { env: { VITE_GOOGLE_ANALYTICS_ENABLED: undefined } },
    { env: { VITE_GOOGLE_ANALYTICS_PRIVACY_REVIEWED: undefined } }, { env: { VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID: 'AW-1234' } },
    { location: { origin: 'https://preview.formaprompt.com' } }, { choice: 'unknown' }, { choice: 'denied' },
    { location: { search: '?email=test@example.com' } }, { location: { hash: '#access_token=secret' } },
    { auth: { loading: true, user: null } }, { auth: { loading: false, user: { id: 'learner' } } }]) {
    const f = fixture(options); f.engine.updateAnalyticsPage('/', 'a');
    assert.equal(f.scripts.length, 0, JSON.stringify(options)); assert.deepEqual(f.commands(), []);
  }
});
test('stored auth tokens and inaccessible storage prevent same-origin SDK loading', () => {
  for (const storage of [{ length: 1, key: () => 'sb-project-auth-token' }, { length: 1, key: () => 'sb-project-auth-token.0' }]) {
    const f = fixture({ window: { localStorage: storage } }); f.engine.updateAnalyticsPage('/'); assert.equal(f.scripts.length, 0);
  }
  const f = fixture(); Object.defineProperty(f.win, 'localStorage', { get() { throw Error('blocked'); } });
  f.engine.updateAnalyticsPage('/'); assert.equal(f.scripts.length, 0);
});
test('explicit public allowlist excludes private routes, arbitrary slugs, URL inputs and personal paths', () => {
  for (const path of ['/login', '/admin', '/course/123', '/reservation-formation', '/paiement-reussi', '/diagnostic-ia/confirmation',
    '/blog/email@example.com', '/guides/private', '/contact?email=a', '/contact#token', 'https://formaprompt.com/', '/%63ontact']) {
    assert.equal(getPublicAnalyticsPage(path), null); const f = fixture(); f.engine.updateAnalyticsPage(path); assert.equal(f.scripts.length, 0);
  }
  assert.equal(getPublicAnalyticsPage('/contact').url, 'https://formaprompt.com/contact');
});
test('script waits for load; manual views use fixed metadata and only GA destination', () => {
  const f = fixture(); f.engine.updateAnalyticsPage('/contact', 'entry');
  assert.equal(f.engine.isAnalyticsDocumentLoaded(), true); assert.equal(f.scripts[0].async, true);
  assert.equal(f.scripts[0].referrerPolicy, 'no-referrer'); assert.deepEqual(f.commands(), []);
  f.load(); assert.equal(f.views().length, 1);
  const config = f.commands().find((args) => args[0] === 'config');
  assert.equal(config[2].send_page_view, false); assert.equal(config[2].allow_google_signals, false);
  assert.equal(config[2].allow_ad_personalization_signals, false);
  assert.deepEqual(f.views()[0][2], { send_to: ID, page_location: 'https://formaprompt.com/contact', page_title: 'Contact — FormaPrompt', page_referrer: '' });
  const consent = f.commands().find((args) => args[0] === 'consent')[2];
  assert.equal(consent.analytics_storage, 'granted'); assert.equal(consent.ad_storage, 'denied');
  assert.equal(consent.ad_user_data, 'denied'); assert.equal(consent.ad_personalization, 'denied');
  assert.equal(f.win.gtag, undefined);
});
test('repeated effects and repeated grant do not duplicate; real navigation including return does', () => {
  const f = fixture(); f.engine.updateAnalyticsPage('/', 'entry'); f.load();
  f.engine.updateAnalyticsPage('/', 'entry'); f.choose('granted'); assert.equal(f.views().length, 1);
  f.engine.updateAnalyticsPage('/contact', 'contact'); f.engine.updateAnalyticsPage('/', 'entry');
  assert.equal(f.views().length, 3);
});
test('late grant measures latest page only, navigation during loading also uses latest page', () => {
  const f = fixture({ choice: 'unknown' }); f.engine.updateAnalyticsPage('/', 'first');
  f.engine.updateAnalyticsPage('/contact', 'second'); f.choose('granted'); f.load();
  assert.equal(f.views().length, 1); assert.equal(f.views()[0][2].page_location, 'https://formaprompt.com/contact');
  const g = fixture(); g.engine.updateAnalyticsPage('/', 'first'); g.engine.updateAnalyticsPage('/faq', 'next'); g.load();
  assert.equal(g.views().length, 1); assert.equal(g.views()[0][2].page_location, 'https://formaprompt.com/faq');
});
test('withdrawal during load or after load immediately disables and permanently stops this document', () => {
  for (const loaded of [false, true]) {
    const f = fixture(); f.engine.updateAnalyticsPage('/'); if (loaded) f.load();
    const before = f.views().length; const pendingCallback = f.scripts[0].onload;
    f.choose('denied'); pendingCallback(); f.choose('granted'); f.engine.updateAnalyticsPage('/contact', 'next');
    assert.equal(f.views().length, before); assert.equal(f.win[`ga-disable-${ID}`], true);
    assert.equal(f.cleaned() > 0, true); assert.equal(f.scripts.length, 1);
  }
});
test('private navigation and auth changes while loading abort all commands', () => {
  const f = fixture(); f.engine.updateAnalyticsPage('/'); const callback = f.scripts[0].onload;
  f.engine.updateAnalyticsPage('/admin'); callback(); assert.deepEqual(f.commands(), []);
  const g = fixture(); g.engine.updateAnalyticsPage('/'); g.setAuth({ loading: false, user: { id: 'private' } }); g.load();
  assert.deepEqual(g.commands(), []); assert.equal(g.win[`ga-disable-${ID}`], true);
});
test('private or dirty transition after SDK loaded blocks all further emissions', () => {
  const f = fixture(); f.engine.updateAnalyticsPage('/'); f.load(); f.engine.updateAnalyticsPage('/login');
  f.engine.updateAnalyticsPage('/contact'); assert.equal(f.views().length, 1); assert.equal(f.win[`ga-disable-${ID}`], true);
  const g = fixture(); g.engine.updateAnalyticsPage('/'); g.load(); g.win.location.search = '?token=secret';
  g.engine.updateAnalyticsPage('/contact'); assert.equal(g.views().length, 1); assert.equal(g.win[`ga-disable-${ID}`], true);
});
test('script failure leaves document disabled and cannot trigger retries or queued views', () => {
  const f = fixture(); f.engine.updateAnalyticsPage('/'); f.scripts[0].onerror();
  f.engine.updateAnalyticsPage('/'); assert.equal(f.scripts.length, 1); assert.deepEqual(f.commands(), []);
  assert.equal(f.policies.length, 0);
});

test('withdrawal seals the loaded document before replacement, once only', () => {
  const f = fixture(); f.engine.updateAnalyticsPage('/'); f.load();
  f.choose('denied');
  assert.equal(f.policies.length, 1);
  assert.equal(f.policies[0].httpEquiv, 'Content-Security-Policy');
  assert.match(f.policies[0].content, /connect-src 'none'/);
  assert.match(f.policies[0].content, /default-src 'none'/);
  f.engine.stopAudienceMeasurement(); f.choose('denied');
  assert.equal(f.policies.length, 1);
  assert.equal(f.win[`ga-disable-${ID}`], true);
});

test('private transition seals an audience document while a never-loaded document stays unchanged', () => {
  const f = fixture(); f.engine.updateAnalyticsPage('/'); f.load();
  f.engine.updateAnalyticsPage('/dashboard');
  assert.equal(f.policies.length, 1);
  const g = fixture({ choice: 'denied' }); g.engine.stopAudienceMeasurement();
  assert.equal(g.policies.length, 0);
});

test('every published catalogue guide has an explicit reviewed audience path', () => {
  const catalogue = readFileSync(new URL('../data/practicalGuides.jsx', import.meta.url), 'utf8');
  const slugs = [...catalogue.matchAll(/slug: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(slugs.length, 7);
  for (const slug of slugs) {
    const page = getPublicAnalyticsPage(`/guides/${slug}`);
    assert.ok(page, `Review and explicitly allow the public guide: ${slug}`);
    assert.equal(page.url, `https://formaprompt.com/guides/${slug}`);
    assert.ok(page.title.endsWith(' — FormaPrompt'));
  }
  for (const path of ['/guides/new-unreviewed-guide', '/guides/gemini-guide-pratique/learner-123',
    '/guides/gemini-guide-pratique?email=private@example.test', '/guides/gemini-guide-pratique#answer',
    '/guides/%67emini-guide-pratique', '/guides//gemini-guide-pratique']) {
    assert.equal(getPublicAnalyticsPage(path), null, path);
  }
});

test('new guides send only fixed public metadata after a separate audience grant', () => {
  for (const name of ['claude', 'copilot', 'gemini']) {
    const path = `/guides/${name}-guide-pratique`;
    const f = fixture({ choice: 'unknown' });
    f.win.document = { title: 'Private Person — private@example.test — score 9/12' };
    f.engine.updateAnalyticsPage(path, 'guide');
    assert.equal(f.scripts.length, 0);
    f.choose('granted');
    assert.equal(f.scripts.length, 1);
    assert.deepEqual(f.commands(), []);
    f.load();
    assert.deepEqual(f.views()[0][2], { send_to: ID,
      page_location: `https://formaprompt.com${path}`,
      page_title: getPublicAnalyticsPage(path).title, page_referrer: '' });
    assert.equal(/Private Person|private@example|9\/12|user_id|user_data|score|answer/.test(JSON.stringify(f.views())), false);
    f.choose('denied');
    f.engine.updateAnalyticsPage('/contact', 'after-withdrawal');
    assert.equal(f.views().length, 1);
  }
});

test('new guides cannot bypass disabled environment, private sessions or dirty URLs', () => {
  for (const name of ['claude', 'copilot', 'gemini']) {
    for (const options of [{ env: { VITE_GOOGLE_ANALYTICS_ENABLED: undefined } },
      { env: { VITE_GOOGLE_ANALYTICS_ENABLED: 'false' } },
      { env: { VITE_GOOGLE_ANALYTICS_PRIVACY_REVIEWED: undefined } },
      { env: { VITE_GOOGLE_ANALYTICS_PRIVACY_REVIEWED: 'false' } },
      { env: { VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID: undefined } },
      { auth: { loading: false, user: { id: 'private-account' } } },
      { location: { search: '?utm_source=newsletter' } }, { location: { hash: '#consigne' } },
      { choice: 'denied' }]) {
      const f = fixture(options);
      f.engine.updateAnalyticsPage(`/guides/${name}-guide-pratique`);
      assert.equal(f.scripts.length, 0);
      assert.deepEqual(f.commands(), []);
    }
  }
});

test('example configuration keeps both production activation gates disabled', () => {
  const example = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
  assert.match(example, /^VITE_GOOGLE_ANALYTICS_ENABLED=false$/m);
  assert.match(example, /^VITE_GOOGLE_ANALYTICS_PRIVACY_REVIEWED=false$/m);
});

test('Challenge, learner, trainer and administration routes never load or emit audience commands', () => {
  const privatePaths = ['/course/formation-ia-act', '/formateur/ai-act-challenge', '/dashboard',
    '/admin', '/admin/apprenants/00000000-0000-4000-8000-000000000001',
    '/parcours/formation-ia-act/question-Q01', '/ai-act-challenge', '/ai-act-challenge/results'];
  for (const path of privatePaths) {
    const f = fixture();
    f.win.document = { title: 'Camille Exemple — 9/12 — Question et correction confidentielles' };
    for (let index = 0; index < 3; index += 1) f.engine.updateAnalyticsPage(path, `private-${index}`);
    f.choose('granted');
    assert.equal(f.scripts.length, 0, path);
    assert.deepEqual(f.commands(), [], path);
  }
});
test('public AI Act page emits only fixed page metadata and never session identity or DOM title', () => {
  const f = fixture();
  f.win.document = { title: 'Camille Exemple — email@example.test — note 9/12 — réponse B' };
  f.engine.updateAnalyticsPage('/formation-ia-act-conformite', 'public-ai-act'); f.load();
  assert.deepEqual(f.views()[0][2], { send_to: ID,
    page_location: 'https://formaprompt.com/formation-ia-act-conformite',
    page_title: 'Formation AI Act — FormaPrompt', page_referrer: '' });
  assert.equal(/Camille|email@example|9\/12|réponse|user_id|attempt_id|score|question_code|option_code/.test(JSON.stringify(f.commands())), false);
});
