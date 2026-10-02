import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvertisingConsent, ADVERTISING_COOKIE } from './advertisingConsent.js';

function fixture(cookie = '') {
  const values = new Map(cookie.split(';').filter(Boolean).map((part) => part.trim().split('=')));
  const doc = { get cookie() { return [...values].map(([k,v]) => `${k}=${v}`).join('; '); },
    set cookie(value) { const [key, data] = value.split(';')[0].split('=');
      if (value.includes('Max-Age=0;')) values.delete(key); else values.set(key, data); } };
  return { ...createAdvertisingConsent({ document: doc, window: { location: { hostname: 'formaprompt.com', protocol: 'https:' } } }), doc };
}
test('legacy technical agreement never grants advertising consent', () => {
  assert.equal(fixture('formaprompt_cookie_consent=true').getAdvertisingConsent(), 'unknown');
});
test('withdrawal removes owned advertising cookies and preserves authentication', () => {
  const consent = fixture('_gcl_aw=click; _gcl_au=ads; sb-project-auth-token=session');
  consent.setAdvertisingConsent('denied');
  assert.equal(consent.doc.cookie.includes('_gcl'), false);
  assert.equal(consent.doc.cookie.includes('sb-project-auth-token=session'), true);
});
test('cookie storage failure cannot prevent an immediate refusal', () => {
  const doc = { get cookie() { return `${ADVERTISING_COOKIE}=v1.granted`; }, set cookie(value) { void value; throw new Error('Blocked'); } };
  const consent = createAdvertisingConsent({ document: doc });
  consent.setAdvertisingConsent('denied');
  assert.equal(consent.getAdvertisingConsent(), 'denied');
});
test('versioned choice persists, notifies, and can be withdrawn', () => {
  const consent = fixture(`${ADVERTISING_COOKIE}=v1.granted`);
  assert.equal(consent.getAdvertisingConsent(), 'granted');
  const choices = [];
  const stop = consent.subscribeAdvertisingConsent((choice) => choices.push(choice));
  consent.setAdvertisingConsent('denied');
  assert.equal(consent.getAdvertisingConsent(), 'denied');
  assert.deepEqual(choices, ['denied']);
  stop();
});
