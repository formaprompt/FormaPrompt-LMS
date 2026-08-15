import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  resolve(testsDirectory, '../../migrations/20260814160000_add_quality_register.sql'),
  'utf8',
);

test('sépare constats, risques et actions qualité', () => {
  assert.match(migration, /CREATE TABLE public\.quality_records/);
  assert.match(migration, /CREATE TABLE public\.quality_risks/);
  assert.match(migration, /CREATE TABLE public\.quality_actions/);
  assert.match(migration, /risk_score smallint GENERATED ALWAYS AS \(likelihood \* impact\) STORED/);
});

test('référence l incident sans recopier ses données disciplinaires', () => {
  const recordTable = migration.slice(
    migration.indexOf('CREATE TABLE public.quality_records'),
    migration.indexOf('CREATE TABLE public.quality_risks'),
  );
  assert.match(recordTable, /incident_id uuid REFERENCES public\.disciplinary_incidents\(id\) ON DELETE RESTRICT/);
  assert.doesNotMatch(recordTable, /learner_user_id|course_id|factual_description_disciplinaire/);
  assert.match(migration, /quality_records_one_per_incident_uidx/);
});

test('interdit les écritures Data API et force la RLS administrateur', () => {
  for (const table of ['quality_records', 'quality_risks', 'quality_actions']) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /REVOKE ALL ON public\.quality_records, public\.quality_risks, public\.quality_actions\s+FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE)[^;]* TO authenticated/);
});

test('réserve les RPC au rôle admin et exige un motif', () => {
  assert.match(migration, /private\.require_quality_admin\(p_reason\)/g);
  assert.match(migration, /NOT \(SELECT private\.is_strict_admin\(\)\)/);
  assert.match(migration, /motif administratif de 10 à 2000 caractères/);
  assert.doesNotMatch(migration, /GRANT EXECUTE[^;]* TO anon/);
});

test('journalise uniquement les changements structurés sans dupliquer les descriptions', () => {
  const auditFunction = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION private.audit_quality_change'),
    migration.indexOf('CREATE OR REPLACE FUNCTION private.require_quality_admin'),
  );
  assert.match(auditFunction, /INSERT INTO public\.audit_log/);
  assert.match(auditFunction, /quality_action_deadline_changed/);
  assert.doesNotMatch(auditFunction, /factual_description|risk_description|action_description|completion_evidence/);
});

test('ne crée aucun droit pédagogique et aucune suppression automatisée', () => {
  assert.doesNotMatch(migration, /course_access|admin_change_course_access/);
  assert.doesNotMatch(migration, /DELETE FROM public\.quality_|ON DELETE CASCADE/);
});
