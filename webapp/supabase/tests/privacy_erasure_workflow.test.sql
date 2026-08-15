BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(36);

SELECT has_table('public', 'privacy_requests', 'Le registre des demandes RGPD existe');
SELECT has_table('public', 'privacy_dependency_assessments', 'Les dépendances RGPD sont séparées');
SELECT has_table('public', 'privacy_processing_actions', 'Les décisions par catégorie sont séparées');
SELECT has_table('public', 'privacy_request_events', 'Le journal RGPD append-only existe');
SELECT has_column('public', 'privacy_processing_actions', 'resolution', 'La résolution humaine est stockée');
SELECT has_column('public', 'privacy_processing_actions', 'approved_by', 'L administrateur approbateur est stocké');
SELECT has_column('public', 'privacy_processing_actions', 'executed_at', 'L horodatage d exécution est stocké');
SELECT col_is_fk('public', 'privacy_processing_actions', 'approved_by', 'L approbateur référence profiles');

SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.privacy_requests'::regclass), 'RLS forcée sur privacy_requests');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.privacy_dependency_assessments'::regclass), 'RLS forcée sur les dépendances');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.privacy_processing_actions'::regclass), 'RLS forcée sur les actions');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.privacy_request_events'::regclass), 'RLS forcée sur le journal');

SELECT has_function('public', 'admin_analyze_privacy_request', ARRAY['uuid'], 'RPC d analyse disponible');
SELECT has_function('public', 'admin_set_privacy_action_decision', ARRAY['uuid', 'text', 'text'], 'RPC de décision disponible');
SELECT has_function('public', 'admin_execute_privacy_request', ARRAY['uuid', 'text', 'text'], 'RPC d exécution disponible');
SELECT has_function('public', 'admin_prepare_privacy_auth_action', ARRAY['uuid', 'text'], 'Préparation Auth serveur disponible');
SELECT has_function('public', 'admin_complete_privacy_auth_action', ARRAY['uuid', 'text', 'text'], 'Finalisation Auth serveur disponible');
SELECT has_function('public', 'admin_confirm_privacy_external_action', ARRAY['uuid', 'text', 'text'], 'Confirmation externe disponible');

SELECT function_privs_are(
  'public', 'admin_execute_privacy_request', ARRAY['uuid', 'text', 'text'], 'authenticated', ARRAY['EXECUTE'],
  'Authenticated peut appeler l exécution qui contrôle ensuite le rôle admin'
);
SELECT function_privs_are(
  'public', 'admin_execute_privacy_request', ARRAY['uuid', 'text', 'text'], 'anon', ARRAY[]::text[],
  'Anon ne peut pas exécuter un traitement RGPD'
);
SELECT function_privs_are(
  'public', 'admin_execute_privacy_request', ARRAY['uuid', 'text', 'text'], 'service_role', ARRAY[]::text[],
  'La service role ne contourne pas directement la décision humaine'
);

SELECT ok(private.is_privacy_resolution_allowed('purchases', 'retain'), 'Un achat peut être conservé');
SELECT ok(NOT private.is_privacy_resolution_allowed('purchases', 'delete'), 'Un achat ne peut pas être supprimé par ce workflow');
SELECT ok(NOT private.is_privacy_resolution_allowed('commercial_consents', 'anonymize'), 'Une preuve de consentement ne peut pas être anonymisée arbitrairement');
SELECT ok(NOT private.is_privacy_resolution_allowed('withdrawal_requests', 'delete'), 'Une rétractation ne peut pas être supprimée arbitrairement');
SELECT ok(private.is_privacy_resolution_allowed('course_access', 'disable_access'), 'course_access peut uniquement être révoqué sans supprimer le droit');
SELECT ok(NOT private.is_privacy_resolution_allowed('course_access', 'delete'), 'course_access ne peut pas être supprimé');
SELECT ok(private.is_privacy_resolution_allowed('lesson_progress', 'delete'), 'La progression pédagogique est effaçable');
SELECT ok(private.is_privacy_resolution_allowed('contact_requests', 'anonymize'), 'Une demande de contact est anonymisable');
SELECT ok(NOT private.is_privacy_resolution_allowed('auth_identity', 'delete'), 'Le compte Auth exige l orchestration serveur');

SELECT throws_ok(
  $$SELECT public.admin_execute_privacy_request(gen_random_uuid(), 'EFFACER invalide', 'motif administratif suffisamment long')$$,
  '42501', 'Action réservée au rôle admin.',
  'Une session non authentifiée ne peut rien exécuter'
);

WITH test_request AS (
  INSERT INTO public.privacy_requests (
    subject_user_id,
    request_type,
    request_origin,
    status
  ) VALUES (
    NULL,
    'erasure',
    'other',
    'closed'
  )
  RETURNING id
)
INSERT INTO public.privacy_request_events (request_id, event_type, event_details)
SELECT id, 'request_created', '{}'::jsonb
FROM test_request;

SELECT throws_like(
  $$UPDATE public.privacy_request_events SET event_details = '{}'::jsonb$$,
  '%append-only%',
  'Le journal RGPD ne peut pas être réécrit'
);
SELECT throws_like(
  $$DELETE FROM public.privacy_request_events$$,
  '%append-only%',
  'Le journal RGPD ne peut pas être supprimé'
);

SELECT ok(
  position('admin_change_course_access' IN pg_get_functiondef('public.admin_execute_privacy_request(uuid,text,text)'::regprocedure)) > 0
  AND position('DELETE FROM public.course_access' IN pg_get_functiondef('public.admin_execute_privacy_request(uuid,text,text)'::regprocedure)) = 0,
  'Les droits passent par le système course_access existant et ne sont pas supprimés'
);
SELECT ok(
  position('DELETE FROM public.purchases' IN pg_get_functiondef('public.admin_execute_privacy_request(uuid,text,text)'::regprocedure)) = 0
  AND position('DELETE FROM public.commercial_consents' IN pg_get_functiondef('public.admin_execute_privacy_request(uuid,text,text)'::regprocedure)) = 0
  AND position('DELETE FROM public.withdrawal_requests' IN pg_get_functiondef('public.admin_execute_privacy_request(uuid,text,text)'::regprocedure)) = 0,
  'Les achats, consentements et rétractations ne sont jamais supprimés par le workflow'
);
SELECT ok(
  position($needle$status IN ('active', 'suspended')$needle$ IN pg_get_functiondef('public.admin_execute_privacy_request(uuid,text,text)'::regprocedure)) > 0
  AND position($needle$status = 'active'$needle$ IN pg_get_functiondef('public.admin_execute_privacy_request(uuid,text,text)'::regprocedure)) = 0,
  'L exécution révoque sans réactiver un droit suspendu ou révoqué'
);

SELECT * FROM finish();
ROLLBACK;
