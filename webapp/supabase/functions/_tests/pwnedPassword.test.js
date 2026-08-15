import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkPwnedPassword,
  findPwnedPasswordCount,
  sha1Hex,
  validatePasswordSecurityPolicy,
} from '../_shared/pwnedPassword.js';

const TEST_PASSWORD = 'ThisIsASecureTestPassword!';

test('applique une politique locale fondée sur la longueur', () => {
  assert.match(validatePasswordSecurityPolicy('trop-court'), /12 caractères/);
  assert.match(validatePasswordSecurityPolicy(' '.repeat(12)), /uniquement des espaces/);
  assert.equal(validatePasswordSecurityPolicy(TEST_PASSWORD), null);
});

test('calcule SHA-1 côté serveur avec l encodage UTF-8', async () => {
  assert.equal(await sha1Hex('password'), '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
});

test('envoie uniquement cinq caractères du hash avec padding', async () => {
  const fullHash = await sha1Hex(TEST_PASSWORD);
  let requestedUrl = '';
  let requestedHeaders;
  const result = await checkPwnedPassword(TEST_PASSWORD, {
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedHeaders = options.headers;
      return new Response(`${fullHash.slice(5)}:42\r\n${'0'.repeat(35)}:0`, { status: 200 });
    },
  });
  assert.deepEqual(result, { status: 'compromised', count: 42 });
  assert.equal(requestedUrl, `https://api.pwnedpasswords.com/range/${fullHash.slice(0, 5)}`);
  assert.equal(requestedHeaders['Add-Padding'], 'true');
  assert.equal(requestedUrl.includes(TEST_PASSWORD), false);
  assert.equal(requestedUrl.includes(fullHash), false);
  assert.equal(requestedUrl.includes(fullHash.slice(5)), false);
});

test('compare les suffixes localement et ignore les lignes de padding', () => {
  const suffix = 'A'.repeat(35);
  assert.equal(findPwnedPasswordCount(`${suffix}:15\n${'B'.repeat(35)}:0`, suffix), 15);
  assert.equal(findPwnedPasswordCount(`${suffix}:0`, suffix), 0);
  assert.equal(findPwnedPasswordCount(`${'B'.repeat(35)}:12`, suffix), 0);
});

test('traite proprement l indisponibilité HIBP sans exposer d erreur réseau', async () => {
  assert.deepEqual(
    await checkPwnedPassword(TEST_PASSWORD, { fetchImpl: async () => { throw new Error('network details'); } }),
    { status: 'unavailable', code: 'hibp_unreachable' },
  );
  assert.deepEqual(
    await checkPwnedPassword(TEST_PASSWORD, { fetchImpl: async () => new Response('', { status: 503 }) }),
    { status: 'unavailable', code: 'hibp_http_error' },
  );
});
