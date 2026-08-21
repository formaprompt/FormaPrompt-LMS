import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve('supabase/functions/admin-commercial-cycle/index.ts'), 'utf8');
const enrollmentSource = readFileSync(resolve('supabase/functions/admin-manage-enrollment/index.ts'), 'utf8');

test('authentifie le personnel avant toute action commerciale', () => {
  assert.match(source, /auth\.getUser\(token\)/);
  assert.match(source, /\['admin', 'employee'\]\.includes\(actor\.role\)/);
  assert.doesNotMatch(source, /user_metadata/);
});

test('les envois possèdent une clé idempotente et aucun secret SMTP en dur', () => {
  assert.match(source, /communicationKey\('quote'/);
  assert.match(source, /communicationKey\('follow-up'/);
  assert.doesNotMatch(source, /SMTP_PASSWORD\s*=|smtp\.ionos\.fr/);
});

test('une conversion Stripe réutilise achat et droit actif sans modifier course_access', () => {
  const block = source.slice(source.indexOf("action === 'convert_stripe'"));
  assert.match(block, /payment_status !== 'paid'/);
  assert.match(block, /access\.status !== 'active'/);
  assert.match(block, /Aucune réactivation automatique/);
  assert.doesNotMatch(block, /from\('course_access'\)\s*\.(?:insert|update|upsert|delete)/);
});

test('la conversion administrative reste dans le gestionnaire d inscription existant', () => {
  assert.match(enrollmentSource, /commercial_request_id/);
  assert.match(enrollmentSource, /shouldCreateEnrollmentCourseAccess\(existingAccess\)/);
  assert.match(enrollmentSource, /ne réactive jamais silencieusement/);
});
