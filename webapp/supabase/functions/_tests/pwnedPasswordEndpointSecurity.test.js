import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const webappRoot = resolve(testsDirectory, '../../..');
const endpoint = readFileSync(resolve(testsDirectory, '../secure-password-auth/index.ts'), 'utf8');
const helper = readFileSync(resolve(testsDirectory, '../_shared/pwnedPassword.js'), 'utf8');
const registerPage = readFileSync(resolve(webappRoot, 'src/pages/Register.jsx'), 'utf8');
const resetPage = readFileSync(resolve(webappRoot, 'src/pages/ResetPassword.jsx'), 'utf8');

test('contrôle HIBP avant toute création ou mise à jour Auth', () => {
  const checkPosition = endpoint.indexOf('checkPwnedPassword(password)');
  assert.ok(checkPosition >= 0);
  assert.ok(endpoint.indexOf('auth.signUp', checkPosition) > checkPosition);
  assert.ok(endpoint.indexOf('auth.admin.updateUserById', checkPosition) > checkPosition);
});

test('authentifie la réinitialisation avant de solliciter HIBP', () => {
  assert.ok(endpoint.indexOf('auth.getUser(accessToken)') < endpoint.indexOf('checkPwnedPassword(password)'));
});

test('ne journalise ni mot de passe, ni email, ni hash ou suffixe', () => {
  for (const source of [endpoint, helper]) {
    const consoleCalls = source.match(/console\.(?:log|info|warn|error)\([^;]*\);/gs) || [];
    for (const call of consoleCalls) {
      assert.doesNotMatch(call, /\b(?:password|email|fullHash|prefix|suffix|body)\b/);
    }
  }
  assert.doesNotMatch(endpoint, /console\.(?:log|info|warn|error)\([^)]*error/s);
});

test('n envoie à HIBP que le préfixe et active le padding', () => {
  assert.match(helper, /fullHash\.slice\(0, 5\)/);
  assert.match(helper, /fullHash\.slice\(5\)/);
  assert.match(helper, /'Add-Padding': 'true'/);
  assert.match(helper, /api\.pwnedpasswords\.com\/range\//);
  assert.doesNotMatch(helper, /hibp-api-key/i);
});

test('les pages ne calculent aucun hash et passent par le serveur', () => {
  assert.match(registerPage, /secureSignup\(supabase, email, password, redirectTo\)/);
  assert.match(resetPage, /securePasswordUpdate\(supabase, password\)/);
  assert.doesNotMatch(registerPage, /auth\.signUp|SHA-?1|pwnedpasswords/i);
  assert.doesNotMatch(resetPage, /auth\.updateUser|SHA-?1|pwnedpasswords/i);
});

test('une indisponibilité HIBP est signalée sans bloquer Supabase Auth', () => {
  assert.match(endpoint, /passwordCheck\.status === 'unavailable'/);
  assert.match(endpoint, /Votre demande a néanmoins été traitée/);
});
