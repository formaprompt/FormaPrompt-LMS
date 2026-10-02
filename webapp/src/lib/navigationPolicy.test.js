import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchDocumentFromNetwork, matchesDocumentNavigation } from '../pwa/navigationPolicy.js';

test('le worker ne prend en charge que les documents navigués sur son origine', () => {
  const previousSelf = globalThis.self;
  globalThis.self = { location: { origin: 'https://formaprompt.com' } };
  try {
    const navigation = { mode: 'navigate' };
    for (const route of ['/dashboard', '/aide/bien-demarrer', '/', '/inconnue']) {
      assert.equal(matchesDocumentNavigation({ request: navigation, url: new URL(route, self.location.origin) }), true);
    }
    assert.equal(matchesDocumentNavigation({ request: navigation, url: new URL('https://example.invalid/') }), false);
    for (const mode of ['cors', 'same-origin', 'no-cors']) {
      assert.equal(matchesDocumentNavigation({ request: { mode }, url: new URL('https://formaprompt.com/config/learner-onboarding.json') }), false);
    }
  } finally {
    if (previousSelf === undefined) delete globalThis.self;
    else globalThis.self = previousSelf;
  }
});

test('une navigation contourne le cache HTTP sans changer URL, session ou méthode', async () => {
  const previousFetch = globalThis.fetch;
  const request = new Request('https://formaprompt.com/dashboard');
  const response = new Response('document à jour');
  const calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); return response; };
  try {
    assert.equal(await fetchDocumentFromNetwork({ request }), response);
    assert.deepEqual(calls, [[request, { cache: 'no-store' }]]);
    assert.equal(request.url, 'https://formaprompt.com/dashboard');
    assert.equal(request.method, 'GET');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('une panne réseau ne remplace pas le document par un ancien HTML', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('réseau indisponible'); };
  try {
    await assert.rejects(fetchDocumentFromNetwork({ request: new Request('https://formaprompt.com/dashboard') }), /réseau indisponible/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
