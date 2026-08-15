BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(38);

SELECT has_table('public', 'quality_records', 'Le registre des constats existe');
SELECT has_table('public', 'quality_risks', 'Le registre des risques existe');
SELECT has_table('public', 'quality_actions', 'Le registre des actions existe');

SELECT has_column('public', 'quality_records', 'incident_id', 'Un constat peut référencer un incident');
SELECT col_is_fk('public', 'quality_records', 'incident_id', 'Le lien incident est une clé étrangère');
SELECT has_column('public', 'quality_records', 'owner_user_id', 'Le constat possède un responsable');
SELECT has_column('public', 'quality_records', 'status', 'Le constat possède un statut');
SELECT has_column('public', 'quality_risks', 'likelihood', 'Le risque possède une probabilité');
SELECT has_column('public', 'quality_risks', 'impact', 'Le risque possède un impact');
SELECT has_column('public', 'quality_risks', 'risk_score', 'Le score de risque est calculé');
SELECT has_column('public', 'quality_risks', 'review_due_at', 'Le risque possède une échéance de revue');
SELECT has_column('public', 'quality_actions', 'action_type', 'L action distingue correction et prévention');
SELECT has_column('public', 'quality_actions', 'responsible_user_id', 'L action possède un responsable');
SELECT has_column('public', 'quality_actions', 'due_at', 'L action possède une échéance');
SELECT has_column('public', 'quality_actions', 'completion_evidence', 'La réalisation exige une preuve');
SELECT col_is_fk('public', 'quality_actions', 'quality_record_id', 'L action dépend du constat');

SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.quality_records'::regclass), 'RLS forcée sur les constats');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.quality_risks'::regclass), 'RLS forcée sur les risques');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.quality_actions'::regclass), 'RLS forcée sur les actions');

SELECT ok(NOT has_table_privilege('anon', 'public.quality_records', 'SELECT'), 'Anon ne lit pas les constats');
SELECT ok(NOT has_table_privilege('anon', 'public.quality_risks', 'SELECT'), 'Anon ne lit pas les risques');
SELECT ok(NOT has_table_privilege('anon', 'public.quality_actions', 'SELECT'), 'Anon ne lit pas les actions');
SELECT ok(NOT has_table_privilege('authenticated', 'public.quality_records', 'INSERT'), 'Authenticated ne crée pas directement de constat');
SELECT ok(NOT has_table_privilege('authenticated', 'public.quality_risks', 'UPDATE'), 'Authenticated ne modifie pas directement de risque');
SELECT ok(NOT has_table_privilege('authenticated', 'public.quality_actions', 'DELETE'), 'Authenticated ne supprime pas d action');

SELECT has_function('public', 'admin_create_quality_record', ARRAY['text','text','text','text','text','uuid','text','timestamptz','uuid'], 'RPC de création de constat');
SELECT has_function('public', 'admin_update_quality_record', ARRAY['uuid','text','text','text','uuid','text','text'], 'RPC de suivi du constat');
SELECT has_function('public', 'admin_create_quality_risk', ARRAY['uuid','text','text','smallint','smallint','text','uuid','text','timestamptz'], 'RPC de création de risque');
SELECT has_function('public', 'admin_update_quality_risk', ARRAY['uuid','text','text','smallint','smallint','text','uuid','timestamptz'], 'RPC de suivi du risque');
SELECT has_function('public', 'admin_create_quality_action', ARRAY['uuid','uuid','text','text','text','text','uuid','text','timestamptz'], 'RPC de création d action');
SELECT has_function('public', 'admin_update_quality_action', ARRAY['uuid','text','text','uuid','timestamptz','text'], 'RPC de suivi d action');

SELECT has_trigger('public', 'quality_records', 'audit_quality_records_changes', 'Les constats sont audités');
SELECT has_trigger('public', 'quality_risks', 'audit_quality_risks_changes', 'Les risques sont audités');
SELECT has_trigger('public', 'quality_actions', 'audit_quality_actions_changes', 'Les actions sont auditées');

SELECT hasnt_column('public', 'quality_records', 'learner_user_id', 'Le registre ne duplique pas l apprenant disciplinaire');
SELECT hasnt_column('public', 'quality_records', 'course_id', 'Le registre ne duplique pas la formation disciplinaire');
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'quality_records_one_per_incident_uidx'
  ),
  'Un incident ne crée pas plusieurs constats qualité concurrents'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('quality_records','quality_risks','quality_actions')
      AND column_name IN ('course_access_id','access_status','learner_can_access')
  ),
  'Le registre qualité ne crée aucun système de droits'
);

SELECT * FROM finish();
ROLLBACK;
