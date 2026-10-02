import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createGoogleAdsPurchase, ADS_PENDING_KEY, ADS_ATTEMPT_KEY, ADS_SENT_KEY, ADS_CLICK_KEY } from './googleAdsPurchase.js';

const receipt = { verified: true, livemode: true, transaction_id: '12345678-1234-1234-1234-123456789abc', amount_total_cents: 11900, currency: 'eur' };
const clock = 1800000000000;
const relayHtml = readFileSync(new URL('../../public/ads-purchase-confirmation.html', import.meta.url), 'utf8');
const relayScript = relayHtml.match(/<script>([\s\S]*?)<\/script>/)[1];
function store() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}
function fixture(overrides = {}) {
  let choice = 'granted';
  let subscriber;
  const navigation = [];
  const fetches = [];
  const elements = [];
  const storage = store(); const sessionStorage = store();
  const doc = { head: { appendChild: (element) => elements.push(element) }, createElement: (tag) => ({ tag }) };
  const options = { window: { location: { origin: 'https://formaprompt.com', href: 'https://formaprompt.com/paiement-reussi?session_id=cs_private#token' } },
    document: doc, env: { PROD: true, VITE_GOOGLE_ADS_PURCHASE_ENABLED: 'true' }, storage, sessionStorage,
    getConsent: () => choice, subscribeConsent: (fn) => { subscriber = fn; }, navigate: (url) => navigation.push(url), now: () => clock,
    fetch: async (...args) => { fetches.push(args); return { ok: true, headers: { get: () => 'text/html' }, text: async () => relayHtml }; }, ...overrides };
  const api = createGoogleAdsPurchase(options);
  return { api, options, navigation, fetches, elements, change: (value) => { choice = value; subscriber(choice); } };
}
function relay({ payload = { version: 1, transaction_id: receipt.transaction_id, amount_total_cents: 11900, currency: 'EUR', expires: clock + 60000 },
  query = '', cookie = 'formaprompt_advertising_v1=v1.granted', topLevel = true, attempt = true, sent = false, storageBlocked = false } = {}) {
  const localStorage = store(); const sessionStorage = store();
  if (payload !== null) sessionStorage.setItem(ADS_PENDING_KEY, typeof payload === 'string' ? payload : JSON.stringify(payload));
  if (attempt) localStorage.setItem(ADS_ATTEMPT_KEY, JSON.stringify([{ id: receipt.transaction_id, at: clock }]));
  if (sent) localStorage.setItem(ADS_SENT_KEY, JSON.stringify([{ id: receipt.transaction_id, at: clock }]));
  const scripts = []; const timers = []; const events = {}; const redirects = []; let backs = 0; let click;
  const location = { href: `https://formaprompt.com/ads-purchase-confirmation.html${query}`, origin: 'https://formaprompt.com', pathname: '/ads-purchase-confirmation.html', hash: '', replace: (url) => redirects.push(url) };
  const document = { cookie, getElementById: () => ({ addEventListener: (_name, fn) => { click = fn; } }),
    createElement: (tag) => ({ tag }), head: { appendChild: (script) => { assert.equal(sessionStorage.getItem(ADS_PENDING_KEY), null); scripts.push(script); } } };
  const window = { addEventListener: (name, fn) => { events[name] = fn; } };
  window.self = window; window.top = topLevel ? window : {};
  const context = { window, document, location, history: { length: 2, back: () => { backs++; } },
    localStorage: storageBlocked ? { getItem() { throw new Error('blocked'); } } : localStorage,
    sessionStorage, URL, Date: class extends Date { static now() { return clock; } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {} };
  vm.runInNewContext(relayScript, context);
  return { window, document, scripts, timers, events, redirects, localStorage, sessionStorage, get backs() { return backs; }, click: () => click({ preventDefault() {} }) };
}

test('LMS init dormant ne charge aucun SDK ni requête, même après consentement', async () => {
  const f = fixture();
  assert.deepEqual(await f.api.initGoogleAds(), { status: 'dormant' });
  assert.equal(f.fetches.length, 0); assert.equal(f.elements.length, 0); assert.equal(f.options.window.gtag, undefined);
  f.change('denied'); f.change('granted'); await f.api.initGoogleAds(); assert.equal(f.fetches.length, 0);
});
test('reçu119EUR : handoff minimal sans route/session/identité, préflight sûr et dédoublonnage concurrent/reload', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.api.sendGoogleAdsPurchase({ ...receipt, email: 'fixture@example.invalid', session_id: 'private' }), f.api.sendGoogleAdsPurchase(receipt)]);
  assert.equal(a.status, 'handoff'); assert.equal(b.status, 'handoff'); assert.equal(f.navigation.length, 1); assert.equal(f.fetches.length, 1);
  assert.equal(f.navigation[0], 'https://formaprompt.com/ads-purchase-confirmation.html');
  assert.deepEqual(JSON.parse(f.options.sessionStorage.getItem(ADS_PENDING_KEY)), { version: 1, transaction_id: receipt.transaction_id, amount_total_cents: 11900, currency: 'EUR', expires: clock + 60000 });
  assert.equal(f.options.storage.getItem(ADS_SENT_KEY), null);
  const request = f.fetches[0]; assert.equal(request[0], '/ads-purchase-confirmation.html');
  for (const [name, value] of Object.entries({ method: 'GET', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' })) assert.equal(request[1][name], value);
  assert.deepEqual(f.elements, [{ tag: 'meta', name: 'referrer', content: 'no-referrer' }]);
  assert.equal((await createGoogleAdsPurchase(f.options).sendGoogleAdsPurchase(receipt)).status, 'duplicate');
});
test('499EUR provient aussi uniquement des centimes du reçu', async () => {
  const f = fixture(); await f.api.sendGoogleAdsPurchase({ ...receipt, amount_total_cents: 49900 });
  assert.equal(JSON.parse(f.options.sessionStorage.getItem(ADS_PENDING_KEY)).amount_total_cents, 49900);
});
test('reçus test/non vérifiés/annulés/invalides ne déclenchent ni préflight ni navigation', async () => {
  const f = fixture();
  for (const patch of [{ verified: false }, { livemode: false }, { amount_total_cents: 0 }, { amount_total_cents: '11900' }, { currency: 'EURO' }, { transaction_id: 'cs_live_private' }]) assert.equal((await f.api.sendGoogleAdsPurchase({ ...receipt, ...patch })).status, 'ineligible');
  assert.equal((await f.api.sendGoogleAdsPurchase(null)).status, 'ineligible'); assert.equal(f.fetches.length, 0);
});
test('refus/inconnu/flagfalse/local/www ne chargent jamais Google ni handoff', async () => {
  for (const overrides of [{ getConsent: () => 'unknown' }, { getConsent: () => 'denied' }, { env: { PROD: false, VITE_GOOGLE_ADS_PURCHASE_ENABLED: 'true' } },
    { env: { PROD: true, VITE_GOOGLE_ADS_PURCHASE_ENABLED: 'false' } }, { window: { location: { origin: 'http://localhost:5173' } } }, { window: { location: { origin: 'https://www.formaprompt.com' } } }]) {
    const f = fixture(overrides); await f.api.initGoogleAds(); await f.api.sendGoogleAdsPurchase(receipt); assert.equal(f.fetches.length, 0); assert.equal(f.navigation.length, 0);
  }
});
test('capture gclid/gbraid/wbraid consentie, un seul paramètre et fenêtre30j non renouvelée', async () => {
  for (const name of ['gclid', 'gbraid', 'wbraid']) {
    const f = fixture(); f.options.window.location.href += `&${name}=fixtureclick123456`; // Fragment is not query.
    f.options.window.location.href = `https://formaprompt.com/?email=private&${name}=fixtureclick123456#token`;
    await f.api.initGoogleAds(); await f.api.sendGoogleAdsPurchase(receipt);
    assert.equal(f.navigation[0], `https://formaprompt.com/ads-purchase-confirmation.html?${name}=fixtureclick123456`);
    assert.deepEqual(JSON.parse(f.options.storage.getItem(ADS_CLICK_KEY)), { version: 1, name, value: 'fixtureclick123456', expires: clock + 30 * 86400000 });
    const later = createGoogleAdsPurchase({ ...f.options, now: () => clock + 1000 }); await later.initGoogleAds();
    assert.equal(JSON.parse(f.options.storage.getItem(ADS_CLICK_KEY)).expires, clock + 30 * 86400000);
  }
});
test('identifiants malformés/doubles/expirés ignorés, retrait efface puis empêche recapturepersistée', async () => {
  for (const query of ['gclid=x@y.com', 'gclid=short', 'gclid=fixtureclick12345&gclid=fixtureclick67890']) {
    const f = fixture(); f.options.window.location.href = `https://formaprompt.com/?${query}`; await f.api.initGoogleAds(); assert.equal(f.options.storage.getItem(ADS_CLICK_KEY), null);
  }
  const f = fixture(); f.options.window.location.href = 'https://formaprompt.com/?gclid=fixtureclick123456'; await f.api.initGoogleAds();
  f.options.storage.setItem(ADS_CLICK_KEY, JSON.stringify({ version: 1, name: 'gclid', value: 'fixtureclick123456', expires: clock - 1 }));
  await f.api.sendGoogleAdsPurchase(receipt); assert.equal(f.navigation[0].includes('?'), false);
  f.change('denied'); assert.equal(f.options.storage.getItem(ADS_CLICK_KEY), null); assert.equal(f.options.sessionStorage.getItem(ADS_PENDING_KEY), null);
  f.change('granted'); await f.api.initGoogleAds(); await createGoogleAdsPurchase(f.options).initGoogleAds(); assert.equal(f.options.storage.getItem(ADS_CLICK_KEY), null);
});
test('retrait durant le préflight empêche handoff même si l’accord revient', async () => {
  let finish; const f = fixture({ fetch: () => new Promise((resolve) => { finish = resolve; }) });
  const pending = f.api.sendGoogleAdsPurchase(receipt); f.change('denied'); f.change('granted');
  finish({ ok: true, headers: { get: () => 'text/html' }, text: async () => relayHtml });
  assert.equal((await pending).status, 'denied'); assert.equal(f.navigation.length, 0); assert.equal(f.options.storage.getItem(ADS_ATTEMPT_KEY), null);
});
test('HTML absent/version incorrecte/erreur/délai y compris corps bloqué : reste LMS et aucune tentative', async () => {
  for (const fetch of [async () => ({ ok: false }), async () => ({ ok: true, headers: { get: () => 'application/json' } }),
    async () => ({ ok: true, headers: { get: () => 'text/html' }, text: async () => '<html>SPA</html>' }), async () => { throw new Error('blocked'); },
    () => new Promise(() => {}), async () => ({ ok: true, headers: { get: () => 'text/html' }, text: () => new Promise(() => {}) })]) {
    const f = fixture({ fetch, timeoutMs: 5 }); assert.equal((await f.api.sendGoogleAdsPurchase(receipt)).status, 'unavailable');
    assert.equal(f.navigation.length, 0); assert.equal(f.options.storage.getItem(ADS_ATTEMPT_KEY), null);
  }
});
test('changement de route pendantpréflight annule la navigation différée, sans stocker l’URLprivée', async () => {
  let finish;
  const f = fixture({ fetch: () => new Promise((resolve) => { finish = resolve; }) });
  const pending = f.api.sendGoogleAdsPurchase(receipt);
  f.options.window.location.href = 'https://formaprompt.com/course/fixture-private';
  finish({ ok: true, headers: { get: () => 'text/html' }, text: async () => relayHtml });
  assert.equal((await pending).status, 'cancelled'); assert.equal(f.navigation.length, 0);
  assert.equal(f.options.sessionStorage.getItem(ADS_PENDING_KEY), null);
});
test('registre corrompu/stockage bloqué : failsoft, zéro navigation', async () => {
  for (const value of ['{', '{}', '["invalid"]']) {
    const f = fixture(); f.options.storage.setItem(ADS_SENT_KEY, value); assert.equal((await f.api.sendGoogleAdsPurchase(receipt)).status, 'unavailable'); assert.equal(f.fetches.length, 0);
  }
  const f = fixture({ sessionStorage: { getItem: () => null, setItem() { throw new Error('blocked'); }, removeItem() {} } });
  assert.equal((await f.api.sendGoogleAdsPurchase(receipt)).status, 'unavailable'); assert.equal(f.navigation.length, 0);
  assert.equal((await createGoogleAdsPurchase(f.options).sendGoogleAdsPurchase(receipt)).status, 'duplicate');
});
test('registres expirés purgés et maximum1000 tentatives', async () => {
  const f = fixture(); f.options.storage.setItem(ADS_ATTEMPT_KEY, JSON.stringify([{ id: receipt.transaction_id, at: 1 }]));
  assert.equal((await f.api.sendGoogleAdsPurchase(receipt)).status, 'handoff');
  assert.equal(JSON.parse(f.options.storage.getItem(ADS_ATTEMPT_KEY)).length, 1);
  const many = Array.from({ length: 1000 }, (_, n) => ({ id: `${String(n).padStart(8, '0')}-1234-1234-1234-123456789abc`, at: clock }));
  f.options.storage.setItem(ADS_ATTEMPT_KEY, JSON.stringify(many));
  await f.api.sendGoogleAdsPurchase({ ...receipt, transaction_id: '22345678-1234-1234-1234-123456789abc' });
  assert.equal(JSON.parse(f.options.storage.getItem(ADS_ATTEMPT_KEY)).length, 1000);
});
test('script relais réel :119 et499EUR, pending effacé avantSDK, configuration minimale, marqueurcommande et retour', () => {
  for (const cents of [11900, 49900]) {
    const f = relay({ payload: { version: 1, transaction_id: receipt.transaction_id, amount_total_cents: cents, currency: 'EUR', expires: clock + 60000 }, query: '?gclid=fixtureclick12345' });
    assert.equal(f.scripts.length, 1); assert.equal(f.scripts[0].referrerPolicy, 'no-referrer'); assert.equal(f.sessionStorage.getItem(ADS_PENDING_KEY), null);
    f.scripts[0].onload();
    const commands = f.window.dataLayer.map((args) => [...args]);
    const event = commands.find(([name]) => name === 'event')[2];
    assert.equal(event.value, cents / 100); assert.equal(event.currency, 'EUR'); assert.equal(event.transaction_id, receipt.transaction_id);
    assert.equal(event.send_to, 'AW-18489285500/WOz2COeP5I0dEPy2sPBE'); assert.equal(event.page_referrer, ''); assert.equal(event.page_title, 'Confirmation – FormaPrompt');
    assert.equal('user_data' in event, false);
    const config = commands.find(([name]) => name === 'config')[2]; assert.equal(config.allow_google_signals, false); assert.equal(config.allow_interest_groups, false); assert.equal(config.allow_ad_personalization_signals, false);
    assert.equal(JSON.parse(f.localStorage.getItem(ADS_SENT_KEY)).length, 1); event.event_callback(); assert.equal(f.backs, 1);
    f.events.pagehide(); f.events.pageshow({ persisted: true }); assert.deepEqual(f.redirects, ['/dashboard']);
  }
});
test('relai direct/reload/refus/iframe/queryprivée/reçuexpire : zéroSDK, payloadconsommé et dashboard', () => {
  for (const options of [{ payload: null }, { payload: '{' }, { cookie: '' }, { cookie: 'formaprompt_advertising_v1=v1.denied' }, { topLevel: false }, { attempt: false }, { sent: true }, { storageBlocked: true },
    { query: '?session_id=cs_private' }, { query: '?gclid=fixtureclick12345&email=private' },
    { payload: { version: 1, transaction_id: receipt.transaction_id, amount_total_cents: 11900, currency: 'EUR', expires: clock - 1 } },
    { payload: { version: 1, transaction_id: receipt.transaction_id, amount_total_cents: 11900, currency: 'EUR', expires: clock + 60000, email: 'private' } }]) {
    const f = relay(options); assert.equal(f.scripts.length, 0); assert.equal(f.sessionStorage.getItem(ADS_PENDING_KEY), null); assert.deepEqual(f.redirects, ['/dashboard']);
  }
});
test('SDK bloqué/refus pendantchargement/absencecallback : retourborné8s sans marqueurfinal', () => {
  const blocked = relay(); blocked.scripts[0].onerror(); assert.equal(blocked.backs, 1); assert.equal(blocked.localStorage.getItem(ADS_SENT_KEY), '[]');
  const withdrawn = relay(); withdrawn.document.cookie = 'formaprompt_advertising_v1=v1.denied'; withdrawn.scripts[0].onload();
  assert.equal(withdrawn.window.dataLayer.some((args) => args[0] === 'event'), false); assert.equal(withdrawn.backs, 1);
  const slow = relay(); slow.timers.find(({ ms }) => ms === 7500).fn(); assert.equal(slow.backs, 1); slow.click(); assert.equal(slow.backs, 1);
  slow.scripts[0].onload(); assert.equal(slow.window.dataLayer.some((args) => args[0] === 'event'), false);
  assert.equal(slow.timers.some(({ ms }) => ms === 500), true);
});
