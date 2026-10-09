import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIENCE_COOKIE, createAudienceConsent } from './audienceConsent.js';

function fixture(initial = '') {
  const cookies = new Map(initial.split(';').filter(Boolean).map((part) => part.trim().split('=')));
  const writes = [];
  const doc = { get cookie() { return [...cookies].map(([key, value]) => `${key}=${value}`).join('; '); },
    set cookie(value) { writes.push(value); const [name, content] = value.split(';')[0].split('=');
      if (value.includes('Max-Age=0')) cookies.delete(name); else cookies.set(name, content); } };
  return { doc, cookies, writes, consent: createAudienceConsent({ document: doc,
    window: { location: { protocol: 'https:', hostname: 'formaprompt.com' } } }) };
}
test('advertising consent alone never grants audience consent; malformed audience cookies fail closed', () => {
  for (const cookie of ['formaprompt_advertising_v1=v1.granted', `${AUDIENCE_COOKIE}=granted`, `${AUDIENCE_COOKIE}=v2.granted`]) {
    assert.equal(fixture(cookie).consent.getAudienceConsent(), 'unknown');
  }
});
test('separate cookie stores explicit choice and notifies subscribers', () => {
  const { consent, cookies, writes } = fixture('formaprompt_advertising_v1=v1.denied');
  const choices = []; const unsubscribe = consent.subscribeAudienceConsent((value) => choices.push(value));
  consent.setAudienceConsent('granted');
  assert.equal(consent.getAudienceConsent(), 'granted');
  assert.equal(cookies.get('formaprompt_advertising_v1'), 'v1.denied');
  assert.match(writes[0], /SameSite=Lax; Secure$/);
  unsubscribe(); consent.setAudienceConsent('denied');
  assert.deepEqual(choices, ['granted']);
});
test('withdrawal removes only GA cookies, preserves authentication and advertising', () => {
  const { consent, cookies } = fixture('_ga=1; _ga_FL8HMVXF4Z=2; _gcl_aw=3; sb-project-auth-token=4; _gallery=5');
  consent.setAudienceConsent('denied');
  assert.equal(consent.getAudienceConsent(), 'denied');
  assert.equal(cookies.has('_ga'), false); assert.equal(cookies.has('_ga_FL8HMVXF4Z'), false);
  for (const name of ['_gcl_aw', 'sb-project-auth-token', '_gallery']) assert.equal(cookies.has(name), true);
});
test('blocked cookie write cannot grant; refusal still overrides a stale grant', () => {
  const doc = { get cookie() { return `${AUDIENCE_COOKIE}=v1.granted`; }, set cookie(_value) { throw Error('blocked'); } };
  const consent = createAudienceConsent({ document: doc });
  consent.setAudienceConsent('denied'); assert.equal(consent.getAudienceConsent(), 'denied');
  const unavailable = createAudienceConsent({ document: { get cookie() { throw Error('blocked'); }, set cookie(_v) {} } });
  unavailable.setAudienceConsent('granted'); assert.equal(unavailable.getAudienceConsent(), 'unknown');
});
