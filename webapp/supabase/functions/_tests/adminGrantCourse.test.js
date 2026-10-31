import { EXPECTED_COMMERCIAL_COURSE_IDS } from './commercialExpectedCourses.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { adminGiftAllowlist, latestFunctionMigration } from './migrationFunctionSource.js';
import { ADMIN_GIFT_COURSES, BUREAUTIQUE_PURCHASES } from '../_shared/purchaseConfig.js';

const endpoint = readFileSync(new URL('../admin-grant-course/index.ts', import.meta.url), 'utf8');
const migrationDirectory = new URL('../../migrations/', import.meta.url);
const grantMigration = latestFunctionMigration(readdirSync(migrationDirectory)
  .filter(name => /^\d{14}_[A-Za-z0-9_-]+\.sql$/.test(name))
  .map(name => ({ name, source: readFileSync(new URL(name, migrationDirectory), 'utf8') })),
  'public.admin_grant_course_access');
assert.ok(grantMigration, 'La fonction SQL effective du depot doit exister.');
const migration = grantMigration.source;
const dashboard = readFileSync(new URL('../../../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');

test('UI et Edge partagent le registre fermé des douze offres bureautiques', () => {
  assert.equal(Object.keys(ADMIN_GIFT_COURSES).length, 19);
  assert.deepEqual(Object.keys(ADMIN_GIFT_COURSES).sort(), EXPECTED_COMMERCIAL_COURSE_IDS);
  assert.equal(Object.keys(BUREAUTIQUE_PURCHASES).length, 12);
  assert.match(endpoint, /new Set\(Object\.keys\(ADMIN_GIFT_COURSES\)\)/);
  assert.match(dashboard, /Object\.values\(ADMIN_GIFT_COURSES\)/);
  for (const [courseId, offer] of Object.entries(BUREAUTIQUE_PURCHASES)) {
    assert.equal(ADMIN_GIFT_COURSES[courseId], offer);
    assert.match(offer.label, /Inter-entreprises|Individuel/);
  }
});

test('l attribution reste admin seulement, auditée et idempotente sans altérer un droit actif', () => {
  const grantFunctionStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.admin_grant_course_access');
  const grantFunctionSource = grantFunctionStart >= 0 ? migration.slice(grantFunctionStart) : '';
  const dollarQuote = grantFunctionSource.match(/\bAS\s+(\$[A-Za-z_]*\$)/);
  const closingQuoteIndex = dollarQuote
    ? grantFunctionSource.indexOf(dollarQuote[1], dollarQuote.index + dollarQuote[0].length)
    : -1;
  const afterFunctionQuote = closingQuoteIndex >= 0
    ? grantFunctionSource.slice(closingQuoteIndex + dollarQuote[1].length)
    : '';
  const grantPermissions = afterFunctionQuote.match(/\bREVOKE ALL ON FUNCTION public\.admin_grant_course_access[\s\S]*?\bGRANT EXECUTE ON FUNCTION public\.admin_grant_course_access[\s\S]*?TO authenticated;/);
  const grantFunction = closingQuoteIndex >= 0 && grantPermissions
    ? grantFunctionSource.slice(0, closingQuoteIndex + dollarQuote[1].length + grantPermissions.index + grantPermissions[0].length)
    : '';
  assert.match(endpoint, /administrator\?\.role !== 'admin'/);
  assert.match(grantFunction, /private\.is_strict_admin\(\)/);
  assert.match(grantFunction, /SELECT access\.\* INTO v_existing[\s\S]*FOR UPDATE/);
  assert.match(grantFunction, /v_existing\.status = 'active'[\s\S]*RETURN v_existing/);
  const allowedCourseIds = adminGiftAllowlist(grantFunction);
  assert.equal(allowedCourseIds.length, 19, 'Allowlist executable: exactly 19 entries');
  assert.equal(new Set(allowedCourseIds).size, 19, 'Allowlist executable: no duplicate');
  assert.deepEqual([...allowedCourseIds].sort(), EXPECTED_COMMERCIAL_COURSE_IDS);
  assert.match(grantFunction, /ON CONFLICT \(user_id, course_id\) DO NOTHING[\s\S]*IF v_result\.id IS NULL[\s\S]*FOR UPDATE/);
  assert.match(grantFunction, /set_config\('formaprompt\.audit_reason'/);
  assert.match(grantFunction, /'active', 'gift'/);
  assert.doesNotMatch(grantFunction, /UPDATE public\.course_access/);
  assert.doesNotMatch(grantFunction, /INSERT INTO public\.purchases|UPDATE public\.purchases/);
  assert.match(grantFunction, /REVOKE ALL ON FUNCTION public\.admin_grant_course_access[\s\S]*FROM PUBLIC, anon/);
});
