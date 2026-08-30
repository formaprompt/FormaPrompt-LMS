import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const migration = readFileSync(
  resolve('supabase/migrations/20260830121954_add_diagnostic_ia_restitutions.sql'),
  'utf8',
)
const sqlTests = readFileSync(
  resolve('supabase/tests/diagnostic_ia_restitutions.sql'),
  'utf8',
)

function sqlWithoutComments(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

test('la migration crée une restitution unique par booking sans droit LMS parallèle', () => {
  assert.match(migration, /CREATE TABLE public[.]diagnostic_ia_restitutions/)
  assert.match(migration, /booking_id uuid NOT NULL UNIQUE\s+REFERENCES public[.]diagnostic_ia_bookings\(id\) ON DELETE RESTRICT/)
  assert.match(migration, /source_questionnaire_id uuid\s+REFERENCES public[.]diagnostic_ia_preparation_questionnaires\(id\) ON DELETE SET NULL/)

  const executableSql = sqlWithoutComments(migration)
  assert.doesNotMatch(executableSql, /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public[.]purchases\b/i)
  assert.doesNotMatch(executableSql, /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public[.]course_access\b/i)
})

test('les treize champs métier sont bornés et la maturité utilise cinq niveaux stables', () => {
  for (const column of [
    'overall_summary',
    'observed_maturity_level',
    'maturity_assessment',
    'current_uses',
    'strengths',
    'watch_points',
    'priority_opportunities',
    'recommendations',
    'short_term_actions',
    'recommended_tool_families',
    'privacy_rgpd_considerations',
    'ai_act_considerations',
    'next_steps',
  ]) {
    assert.match(migration, new RegExp(`\\b${column}\\b`))
  }
  assert.match(migration, /observed_maturity_level BETWEEN 1 AND 5/)
  assert.match(migration, /jsonb_array_length\(p_value\) > 3/)
  assert.match(migration, /revision >= 1/)
  assert.match(migration, /Les balises HTML libres sont refusees/)
})

test('le SHA canonique inclut uniquement les treize champs métier', () => {
  const canonicalFunction = migration.match(
    /CREATE FUNCTION private[.]diagnostic_ia_restitution_content_json[\s\S]*?\n\$\$;/,
  )?.[0]
  assert.ok(canonicalFunction)

  for (const field of [
    'overall_summary', 'observed_maturity_level', 'maturity_assessment', 'current_uses',
    'strengths', 'watch_points', 'priority_opportunities', 'recommendations',
    'short_term_actions', 'recommended_tool_families', 'privacy_rgpd_considerations',
    'ai_act_considerations', 'next_steps',
  ]) {
    assert.match(canonicalFunction, new RegExp(`'${field}'`))
  }
  for (const excluded of ['created_at', 'updated_at', 'published_at', 'user_id', 'revision', 'published_by']) {
    assert.doesNotMatch(canonicalFunction, new RegExp(`'${excluded}'`))
  }
  assert.match(migration, /extensions[.]digest\([\s\S]*'sha256'/)
  assert.match(migration, /content_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/)
})

test('RLS ne publie au propriétaire que sa restitution publiée et non expirée', () => {
  assert.match(migration, /ALTER TABLE public[.]diagnostic_ia_restitutions ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /ALTER TABLE public[.]diagnostic_ia_restitutions FORCE ROW LEVEL SECURITY/)
  assert.match(migration, /\(SELECT auth[.]uid\(\)\) = user_id\s+AND status = 'published'\s+AND retention_due_at > now\(\)/)
  assert.match(migration, /USING \(\(SELECT private[.]is_strict_admin\(\)\)\)/)
  assert.match(migration, /REVOKE ALL ON public[.]diagnostic_ia_restitutions FROM PUBLIC, anon, authenticated, service_role/)
  assert.match(migration, /GRANT SELECT ON public[.]diagnostic_ia_restitutions TO authenticated, service_role/)
  assert.doesNotMatch(migration, /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON public[.]diagnostic_ia_restitutions\s+TO authenticated/i)
})

test('les quatre RPC sont admin strict, transactionnelles et à privilèges minimaux', () => {
  for (const rpc of [
    'admin_complete_diagnostic_ia_booking',
    'admin_save_diagnostic_ia_restitution',
    'admin_publish_diagnostic_ia_restitution',
    'admin_correct_diagnostic_ia_restitution',
  ]) {
    const definition = migration.match(new RegExp(
      `CREATE FUNCTION public[.]${rpc}\\([\\s\\S]*?\\n\\$\\$;`,
    ))?.[0]
    assert.ok(definition, `${rpc} doit être défini`)
    assert.match(definition, /SECURITY DEFINER/)
    assert.match(definition, /SET search_path = ''/)
    assert.match(definition, /private[.]require_diagnostic_ia_restitution_admin\(\)/)
    assert.match(migration, new RegExp(
      `REVOKE ALL ON FUNCTION public[.]${rpc}\\([\\s\\S]*?FROM PUBLIC, anon, authenticated, service_role;[\\s\\S]*?GRANT EXECUTE ON FUNCTION public[.]${rpc}`,
    ))
  }
})

test('publication, correction et audit respectent le cycle irréversible', () => {
  assert.match(migration, /OLD[.]status = 'published' AND NEW[.]status <> 'published'/)
  assert.match(migration, /v_booking[.]status <> 'completed'/)
  assert.match(migration, /greatest\(v_booking[.]completed_at, v_published_at\) \+ interval '5 years'/)
  assert.match(migration, /v_existing[.]status <> 'published'/)
  assert.match(migration, /char_length\(v_reason\) NOT BETWEEN 5 AND 1000/)
  assert.match(migration, /v_existing[.]revision \+ 1/)
  assert.match(migration, /diagnostic_ia_restitution_corrected/)
  assert.match(migration, /jsonb_build_object\('status', v_existing[.]status, 'revision', v_existing[.]revision, 'content_sha256', v_existing[.]content_sha256\)/)
  assert.doesNotMatch(migration, /previous_state[^;]*(?:overall_summary|priority_opportunities)/)
  assert.doesNotMatch(migration, /new_state[^;]*(?:overall_summary|priority_opportunities)/)
})

test('aucune purge, Edge Function ou suppression n est créée dans le lot', () => {
  assert.doesNotMatch(migration, /cron[.]schedule|pg_cron|CREATE FUNCTION .*?(?:purge|cleanup|delete_expired)_diagnostic_ia_restitution/i)
  assert.doesNotMatch(migration, /CREATE FUNCTION public[.].*delete.*diagnostic_ia_restitution/i)
  assert.match(migration, /reject_diagnostic_ia_restitution_delete/)
  assert.match(sqlTests, /Aucune routine de purge des restitutions n est créée/)
})

test('les tests SQL couvrent RLS, concurrence, publication, correction et non-régression', () => {
  for (const evidence of [
    'Un utilisateur normal ne termine pas le diagnostic',
    'Une révision obsolète est refusée',
    'La publication est impossible avant completion',
    'Un autre utilisateur ne voit aucune existence de restitution',
    'Authenticated ne peut pas modifier directement',
    'La correction incrémente la révision',
    'Le contenu métier complet n est jamais écrit dans audit_log',
    'Le LOT 1E-A ne touche pas purchases',
    'Le LOT 1E-A ne touche pas course_access',
  ]) {
    assert.match(sqlTests, new RegExp(evidence))
  }
})
