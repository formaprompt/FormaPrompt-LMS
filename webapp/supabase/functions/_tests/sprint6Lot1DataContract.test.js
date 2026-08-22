import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  resolve(testsDirectory, '../../migrations/20260822160000_sprint_6_lot_1_data_contract.sql'),
  'utf8',
);

function section(start, end) {
  return migration.slice(migration.indexOf(start), migration.indexOf(end));
}

test('ajoute uniquement les deux persistances métier validées', () => {
  const createdTables = [...migration.matchAll(/CREATE TABLE public\.([a-z0-9_]+)/g)]
    .map((match) => match[1]);
  assert.deepEqual(createdTables, ['quality_complaints', 'external_training_activities']);
  assert.doesNotMatch(migration, /CREATE TABLE public\.(?:cockpit_kpis|operational_alerts|cockpit_snapshots)/);
});

test('fait de la réclamation un complément un-à-un du registre qualité', () => {
  const complaints = section(
    'CREATE TABLE public.quality_complaints',
    'CREATE INDEX quality_complaints_outcome_due_idx',
  );
  assert.match(complaints, /quality_record_id uuid PRIMARY KEY/);
  assert.match(complaints, /REFERENCES public\.quality_records\(id\) ON DELETE RESTRICT/);
  assert.match(migration, /v_record_type <> 'complaint'/);
  assert.doesNotMatch(complaints, /\bstatus\b|severity|owner_user_id/);
});

test('n écrit aucune donnée personnelle de réclamation dans l audit', () => {
  const audit = section(
    'CREATE FUNCTION private.audit_sprint6_admin_change',
    'CREATE TRIGGER audit_quality_complaints_changes',
  );
  assert.match(audit, /INSERT INTO public\.audit_log/);
  assert.doesNotMatch(audit, /NEW\.complainant_(?:name|email)|OLD\.complainant_(?:name|email)/);
  assert.doesNotMatch(audit, /NEW\.resolution_summary|OLD\.resolution_summary/);
});

test('sépare les trois relations de formation externe', () => {
  const external = section(
    'CREATE TABLE public.external_training_activities',
    'CREATE INDEX external_training_activities_status_period_idx',
  );
  assert.match(external, /'direct', 'subcontracted_to_us', 'subcontracted_by_us'/);
  assert.match(external, /delivered_hours numeric\(8,2\)/);
  assert.match(external, /trainee_hours numeric\(10,2\)/);
  assert.match(external, /invoiced_amount_cents integer/);
  assert.match(external, /collected_amount_cents integer/);
  assert.doesNotMatch(external, /purchase_id|course_access_id|training_enrollment_id|stripe_/);
});

test('n automatise jamais les heures stagiaires', () => {
  const external = section(
    'CREATE TABLE public.external_training_activities',
    'ALTER TABLE public.quality_complaints ENABLE ROW LEVEL SECURITY',
  );
  assert.doesNotMatch(external, /GENERATED ALWAYS AS[^;]*(?:trainee_count|delivered_hours)/s);
  assert.doesNotMatch(external, /trainee_count\s*\*\s*delivered_hours/);
});

test('force la RLS et réserve les mutations aux RPC administrateur', () => {
  for (const table of ['quality_complaints', 'external_training_activities']) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /private\.require_quality_admin\(p_reason\)/g);
  assert.match(migration, /SECURITY DEFINER\s+SET search_path = ''/g);
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE)[^;]* TO authenticated/);
  assert.doesNotMatch(migration, /GRANT EXECUTE[^;]* TO anon/);
});

test('publie des projections invoker sans persister les données dérivées', () => {
  for (const view of [
    'admin_cockpit_action_items',
    'admin_internal_training_activity',
    'admin_training_activity_all_sources',
    'admin_stripe_financial_summary',
    'admin_bpf_preparation_rows',
  ]) {
    assert.match(
      migration,
      new RegExp(`CREATE VIEW public\\.${view}\\s+WITH \\(security_invoker = true`),
    );
  }
  assert.match(migration, /'internal_lms'::text AS source_kind/);
  assert.match(migration, /'external'::text/);
  assert.match(migration, /UNION ALL/);
});

test('la projection interne laisse NULL les durées non vérifiables', () => {
  const internal = section(
    'CREATE VIEW public.admin_internal_training_activity',
    'CREATE VIEW public.admin_training_activity_all_sources',
  );
  assert.match(internal, /a\.session_count IS NULL OR a\.unresolved_count > 0\s+THEN NULL/s);
  assert.match(internal, /trainer_status = 'partial'/);
  assert.doesNotMatch(internal, /coalesce\(a\.verified_hours,\s*e\.duration_minutes/);
});

test('le net Stripe estimé neutralise le recouvrement remboursement-litige', () => {
  const finance = section(
    'CREATE VIEW public.admin_stripe_financial_summary',
    'CREATE VIEW public.admin_bpf_preparation_rows',
  );
  assert.match(finance, /non_overlapping_lost_amount/);
  assert.match(finance, /a\.refund_amount - a\.non_overlapping_lost_amount/);
  assert.match(finance, /payment_type = 'in_person_travel_fee'/);
  assert.match(finance, /true AS is_estimate/);
  assert.doesNotMatch(finance, /balance_transaction|available_balance|bank_balance/);
});

test('la RPC cockpit reste en lecture locale et ne touche pas aux droits', () => {
  const rpc = section(
    'CREATE FUNCTION public.admin_get_cockpit_summary',
    'REVOKE ALL ON FUNCTION public.admin_get_cockpit_summary',
  );
  assert.match(rpc, /private\.is_strict_admin\(\)/);
  assert.match(rpc, /'priority_actions'/);
  assert.match(rpc, /'stripe_financial_by_currency'/);
  assert.doesNotMatch(rpc, /\b(?:INSERT|UPDATE|DELETE)\b/);
  assert.doesNotMatch(rpc, /admin_run_stripe_local_reconciliation|functions\.invoke|http|net\./);
  assert.doesNotMatch(rpc, /admin_change_course_access|UPDATE public\.course_access/);
});

test('la migration entière ne crée ni droit ni opération distante', () => {
  assert.doesNotMatch(migration, /INSERT INTO public\.course_access|UPDATE public\.course_access|DELETE FROM public\.course_access/);
  assert.doesNotMatch(migration, /INSERT INTO public\.purchases|INSERT INTO public\.training_enrollments/);
  assert.doesNotMatch(migration, /stripe_reconciliation_read_key|STRIPE_RECONCILIATION_READ_KEY/);
  assert.doesNotMatch(migration, /CREATE EXTENSION (?:http|pg_net)|net\.http|supabase_functions\.http_request/);
});
