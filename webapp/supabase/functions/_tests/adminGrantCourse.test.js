import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMIN_GIFT_COURSES, BUREAUTIQUE_PURCHASES } from '../_shared/purchaseConfig.js';

const endpoint = readFileSync(new URL('../admin-grant-course/index.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../migrations/20260913124811_enable_bureautique_gifts.sql', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../../../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');

test('UI et Edge partagent le registre fermé des douze offres bureautiques', () => {
  assert.equal(Object.keys(ADMIN_GIFT_COURSES).length, 15);
  assert.equal(Object.keys(BUREAUTIQUE_PURCHASES).length, 12);
  assert.match(endpoint, /new Set\(Object\.keys\(ADMIN_GIFT_COURSES\)\)/);
  assert.match(dashboard, /Object\.values\(ADMIN_GIFT_COURSES\)/);
  for (const [courseId, offer] of Object.entries(BUREAUTIQUE_PURCHASES)) {
    assert.equal(ADMIN_GIFT_COURSES[courseId], offer);
    assert.match(offer.label, /Inter-entreprises|Individuel/);
  }
});

test('l attribution reste admin seulement, auditée et idempotente sans altérer un droit actif', () => {
  const grantFunction = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.admin_grant_course_access'),
    migration.indexOf('CREATE OR REPLACE FUNCTION public.join_course_cohort'),
  );
  assert.match(endpoint, /administrator\?\.role !== 'admin'/);
  assert.match(grantFunction, /private\.is_strict_admin\(\)/);
  assert.match(grantFunction, /SELECT access\.\* INTO v_existing[\s\S]*FOR UPDATE/);
  assert.match(grantFunction, /v_existing\.status = 'active'[\s\S]*RETURN v_existing/);
  for (const courseId of Object.keys(ADMIN_GIFT_COURSES)) {
    assert.match(grantFunction, new RegExp(`'${courseId}'`));
  }
  assert.match(grantFunction, /ON CONFLICT \(user_id, course_id\) DO NOTHING[\s\S]*IF v_result\.id IS NULL[\s\S]*FOR UPDATE/);
  assert.match(grantFunction, /set_config\('formaprompt\.audit_reason'/);
  assert.match(grantFunction, /'active', 'gift'/);
  assert.doesNotMatch(grantFunction, /UPDATE public\.course_access/);
  assert.doesNotMatch(grantFunction, /INSERT INTO public\.purchases|UPDATE public\.purchases/);
  assert.match(grantFunction, /REVOKE ALL ON FUNCTION public\.admin_grant_course_access[\s\S]*FROM PUBLIC, anon/);
});
