import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleAdsPurchase, sanitizeAdvertisingUrl } from './googleAdsPurchase.js';
const receipt = { verified: true, livemode: true, transaction_id: '12345678-1234-1234-1234-123456789abc', amount_total_cents: 11900, currency: 'eur' };
function fixture(overrides = {}) {
  let choice = 'granted';
  let subscriber;
  let loads = 0;
  let reloads = 0;
  const commands = [];
  const store = new Map();
  const storage = { getItem: (key) => store.get(key), setItem: (key,value) => store.set(key,value) };
  const options = { window: { location: { hostname: 'formaprompt.com', href: 'https://formaprompt.com/paiement-reussi?session_id=cs_secret#token', origin: 'https://formaprompt.com' }, gtag: (...args) => commands.push(args) },
    document: { referrer: 'https://formaprompt.com/login?token=secret' }, env: { PROD: true, VITE_GOOGLE_ADS_PURCHASE_ENABLED: 'true' },
    storage, getConsent: () => choice, subscribeConsent: (fn) => { subscriber = fn; }, loadScript: async () => { loads++; }, reload: () => { reloads++; }, ...overrides };
  const api = createGoogleAdsPurchase(options);
  return { api, commands, options, get loads() { return loads; }, get reloads() { return reloads; }, withdraw() { choice = 'denied'; subscriber(choice); } };
}
test('119 euro verified purchase: minimal payload, singleton, concurrent dedup and reload', async () => {
  const f = fixture();
  await Promise.all([f.api.sendGoogleAdsPurchase(receipt), f.api.sendGoogleAdsPurchase(receipt)]);
  assert.equal(f.loads, 1);
  const events = f.commands.filter((cmd) => cmd[0] === 'event');
  assert.equal(events.length, 1);
  assert.deepEqual(events[0][2], { send_to: 'AW-18489285500/WOz2COeP5I0dEPy2sPBE', value: 119, currency: 'EUR', transaction_id: receipt.transaction_id,
    page_title: 'FormaPrompt', page_location: 'https://formaprompt.com/', page_referrer: 'https://formaprompt.com/' });
  const config = f.commands.find((cmd) => cmd[0] === 'config')[2];
  assert.equal(config.page_title, 'FormaPrompt');
  assert.equal(config.allow_interest_groups, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal('user_data' in config, false);
  assert.equal((await createGoogleAdsPurchase(f.options).sendGoogleAdsPurchase(receipt)).status, 'duplicate');
});
test('formation price also uses receipt cents', async () => {
  const f = fixture(); await f.api.sendGoogleAdsPurchase({ ...receipt, amount_total_cents: 49900 });
  assert.equal(f.commands.find((cmd) => cmd[0] === 'event')[2].value, 499);
});
test('SPA conversion sanitizes the current location and referrer again', async () => {
  const f = fixture(); await f.api.initGoogleAds();
  f.options.window.location.href = 'https://formaprompt.com/course/private?email=person@example.com#access_token';
  f.options.document.referrer = 'https://formaprompt.com/reset-password?token=new';
  await f.api.sendGoogleAdsPurchase(receipt);
  const payload = f.commands.find((cmd) => cmd[0] === 'event')[2];
  assert.equal(payload.page_location, 'https://formaprompt.com/');
  assert.equal(payload.page_referrer, 'https://formaprompt.com/');
  assert.equal(JSON.stringify(payload).includes('private'), false);
});
test('unverified, test, zero, malformed receipt never loads script', async () => {
  const f = fixture();
  for (const patch of [{ verified: false }, { livemode: false }, { amount_total_cents: 0 }, { currency: 'EURO' }, { transaction_id: 'cs_live_secret' }]) {
    assert.equal((await f.api.sendGoogleAdsPurchase({ ...receipt, ...patch })).status, 'ineligible');
  }
  assert.equal(f.loads, 0);
});
test('no consent, refusal, local and disabled flag never load or send', async () => {
  for (const overrides of [{ getConsent: () => 'unknown' }, { getConsent: () => 'denied' }, { env: { PROD: false, VITE_GOOGLE_ADS_PURCHASE_ENABLED: 'true' } }, { env: { PROD: true } }, { window: { location: { hostname: 'localhost' } } }]) {
    const f = fixture(overrides); await f.api.sendGoogleAdsPurchase(receipt); assert.equal(f.loads, 0); assert.equal(f.commands.length, 0);
  }
});
test('withdrawal while loading or after send stops conversions', async () => {
  let finish;
  const f = fixture({ loadScript: () => new Promise((resolve) => { finish = resolve; }) });
  const pending = f.api.sendGoogleAdsPurchase(receipt); f.withdraw(); finish();
  assert.equal((await pending).status, 'denied');
  assert.equal(f.commands.filter((cmd) => cmd[0] === 'event' || cmd[0] === 'config').length, 0);
  assert.equal(f.reloads, 1);
  assert.equal(f.commands.some((cmd) => cmd[0] === 'consent' && cmd[1] === 'update'), false);
  const other = fixture(); await other.api.sendGoogleAdsPurchase(receipt); other.withdraw();
  assert.equal(other.reloads, 1);
  assert.equal((await other.api.sendGoogleAdsPurchase({ ...receipt, transaction_id: '22345678-1234-1234-1234-123456789abc' })).status, 'denied');
});
test('refusal without tag attempt does not reload or command Google', () => {
  const f = fixture(); f.withdraw(); assert.equal(f.reloads, 0); assert.equal(f.commands.length, 0);
});
test('blocked localStorage getter and corrupt ledger fail closed without import or UI failure', async () => {
  const win = { location: { hostname: 'formaprompt.com' } };
  Object.defineProperty(win, 'localStorage', { get() { throw new Error('SecurityError'); } });
  const f = fixture({ window: win, storage: undefined });
  assert.equal((await f.api.sendGoogleAdsPurchase(receipt)).status, 'unavailable');
  assert.equal(f.loads, 0);
  for (const value of ['{', '{}', '["unexpected"]']) {
    const corrupted = fixture({ storage: { getItem: () => value, setItem() {} } });
    assert.equal((await corrupted.api.sendGoogleAdsPurchase(receipt)).status, 'unavailable');
    assert.equal(corrupted.loads, 0);
  }
});
test('gtag throws or document is unavailable never reject init or send', async () => {
  const f = fixture(); f.options.window.gtag = () => { throw new Error('blocked'); };
  assert.equal((await f.api.initGoogleAds()).status, 'unavailable');
  assert.equal((await f.api.sendGoogleAdsPurchase(receipt)).status, 'unavailable');
  const missing = fixture({ document: undefined });
  assert.equal((await missing.api.initGoogleAds()).status, 'unavailable');
});
test('preexisting loaded tag is reused and configuration occurs once', async () => {
  const f = fixture({ loadScript: undefined, document: { referrer: '',
    querySelector: () => ({ dataset: { formapromptLoaded: 'true' } }),
    createElement() { throw new Error('Must not create second script'); } } });
  await f.api.initGoogleAds(); await f.api.initGoogleAds();
  await createGoogleAdsPurchase(f.options).initGoogleAds();
  assert.equal(f.commands.filter((cmd) => cmd[0] === 'config').length, 1);
});
test('ledger prunes expiry, bounds volume, and skips sending when writes are blocked', async () => {
  const f = fixture({ now: () => 200 * 86400 * 1000 });
  f.options.storage.setItem('formaprompt_ads_sent_v1', JSON.stringify([{ id: receipt.transaction_id, at: 1 }]));
  assert.equal((await f.api.sendGoogleAdsPurchase(receipt)).status, 'sent');
  assert.equal(JSON.parse(f.options.storage.getItem('formaprompt_ads_sent_v1')).length, 1);
  const many = Array.from({ length: 1000 }, (_, n) => ({ id: `${String(n).padStart(8, '0')}-1234-1234-1234-123456789abc`, at: 200 * 86400 * 1000 }));
  f.options.storage.setItem('formaprompt_ads_sent_v1', JSON.stringify(many));
  assert.equal((await f.api.sendGoogleAdsPurchase({ ...receipt, transaction_id: '22345678-1234-1234-1234-123456789abc' })).status, 'sent');
  assert.equal(JSON.parse(f.options.storage.getItem('formaprompt_ads_sent_v1')).length, 1000);
  const blocked = fixture({ storage: { getItem: () => null, setItem() { throw new Error('Quota'); } } });
  assert.equal((await blocked.api.sendGoogleAdsPurchase(receipt)).status, 'unavailable');
  assert.equal(blocked.commands.filter((cmd) => cmd[0] === 'event').length, 0);
});
test('conversion failure rolls back persistent marker and permits retry', async () => {
  const f = fixture();
  const original = f.options.window.gtag;
  f.options.window.gtag = (...args) => { if (args[0] === 'event') throw new Error('blocked'); original(...args); };
  assert.equal((await f.api.sendGoogleAdsPurchase(receipt)).status, 'unavailable');
  assert.deepEqual(JSON.parse(f.options.storage.getItem('formaprompt_ads_sent_v1')), []);
  f.options.window.gtag = original;
  assert.equal((await f.api.sendGoogleAdsPurchase(receipt)).status, 'sent');
});
test('script failure or timeout never marks sent', async () => {
  for (const loadScript of [async () => { throw new Error('blocked'); }, () => new Promise(() => {})]) {
    const f = fixture({ loadScript, timeoutMs: 5 });
    assert.equal((await f.api.sendGoogleAdsPurchase(receipt)).status, 'unavailable');
    assert.equal(f.options.storage.getItem('formaprompt_ads_sent_v1'), undefined);
  }
});
test('URL sanitization excludes sensitive identifiers and unsafe schemes', () => {
  assert.equal(sanitizeAdvertisingUrl('https://formaprompt.com/course/private?token=secret#password'), 'https://formaprompt.com/');
  assert.equal(sanitizeAdvertisingUrl('javascript:alert(1)'), '');
});
