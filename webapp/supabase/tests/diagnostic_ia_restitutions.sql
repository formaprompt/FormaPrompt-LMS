BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

SELECT has_table('public', 'diagnostic_ia_restitutions', 'La table des restitutions Diagnostic existe');
SELECT col_is_unique('public', 'diagnostic_ia_restitutions', 'booking_id', 'Une seule restitution est permise par booking');
SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class WHERE oid = 'public.diagnostic_ia_restitutions'::regclass),
  'RLS est active et forcee sur les restitutions'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.diagnostic_ia_restitutions', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.diagnostic_ia_restitutions', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.diagnostic_ia_restitutions', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.diagnostic_ia_restitutions', 'DELETE'),
  'Authenticated dispose uniquement de SELECT sur la table'
);
SELECT ok(
  has_table_privilege('service_role', 'public.diagnostic_ia_restitutions', 'SELECT')
  AND NOT has_table_privilege('service_role', 'public.diagnostic_ia_restitutions', 'INSERT')
  AND NOT has_table_privilege('service_role', 'public.diagnostic_ia_restitutions', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.diagnostic_ia_restitutions', 'DELETE'),
  'Le service_role ne dispose d aucune mutation directe dans ce lot'
);

SELECT has_function('public', 'admin_complete_diagnostic_ia_booking', ARRAY['uuid', 'timestamptz'], 'RPC de completion disponible');
SELECT has_function('public', 'admin_save_diagnostic_ia_restitution', ARRAY['uuid', 'integer', 'jsonb'], 'RPC de brouillon disponible');
SELECT has_function('public', 'admin_publish_diagnostic_ia_restitution', ARRAY['uuid', 'integer'], 'RPC de publication disponible');
SELECT has_function('public', 'admin_correct_diagnostic_ia_restitution', ARRAY['uuid', 'integer', 'jsonb', 'text'], 'RPC de correction disponible');
SELECT function_privs_are(
  'public', 'admin_complete_diagnostic_ia_booking', ARRAY['uuid', 'timestamptz'],
  'authenticated', ARRAY['EXECUTE'], 'La completion est exposée uniquement aux sessions authentifiees puis controlee par role'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.admin_save_diagnostic_ia_restitution(uuid,integer,jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.admin_save_diagnostic_ia_restitution(uuid,integer,jsonb)', 'EXECUTE'),
  'La RPC de sauvegarde n est executable ni par anon ni directement par service_role'
);

CREATE FUNCTION pg_temp.diagnostic_restitution_content(p_suffix text DEFAULT '')
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'overall_summary', 'Synthèse générale du Diagnostic IA Express avec constats factuels et priorités réalistes. ' || p_suffix,
    'observed_maturity_level', 2,
    'maturity_assessment', 'L organisation expérimente déjà plusieurs usages mais sans méthode commune ni cadre formalisé.',
    'current_uses', 'Préparation de textes, synthèses ponctuelles et recherche d idées avec validation humaine.',
    'strengths', jsonb_build_array('Curiosité active', 'Bonne connaissance des processus métier'),
    'watch_points', jsonb_build_array('Données confidentielles à exclure des outils non approuvés'),
    'priority_opportunities', jsonb_build_array(jsonb_build_object(
      'title', 'Préparer les comptes rendus récurrents',
      'expected_benefit', 'Réduire le temps de structuration sans automatiser la validation finale',
      'effort', 'Faible à modéré',
      'indicative_cost', 'Outil existant ou abonnement standard',
      'risk_or_watchpoint', 'Retirer les données personnelles avant traitement',
      'first_action', 'Tester un modèle de compte rendu sur trois exemples fictifs'
    )),
    'recommendations', jsonb_build_array('Formaliser une charte simple d usage de l IA'),
    'short_term_actions', jsonb_build_array(jsonb_build_object(
      'action', 'Créer un premier modèle de compte rendu avec des données fictives',
      'horizon', '30_days'
    )),
    'recommended_tool_families', jsonb_build_array('Assistant conversationnel avec garanties contractuelles adaptées'),
    'privacy_rgpd_considerations', 'Minimiser les données, anonymiser les exemples et vérifier les conditions de traitement du fournisseur.',
    'ai_act_considerations', 'Maintenir une supervision humaine et documenter les usages lorsque le contexte le justifie.',
    'next_steps', 'Réaliser le test pilote, mesurer le temps gagné puis décider d une généralisation limitée.'
  );
$$;

INSERT INTO auth.users(
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('8e000000-0000-4000-8000-000000000001','authenticated','authenticated','admin-restitution@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('8e000000-0000-4000-8000-000000000002','authenticated','authenticated','owner-restitution@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('8e000000-0000-4000-8000-000000000003','authenticated','authenticated','other-restitution@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now());

INSERT INTO public.profiles(id, email, role) VALUES
  ('8e000000-0000-4000-8000-000000000001','admin-restitution@example.test','admin'),
  ('8e000000-0000-4000-8000-000000000002','owner-restitution@example.test','user'),
  ('8e000000-0000-4000-8000-000000000003','other-restitution@example.test','user')
ON CONFLICT(id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role;

INSERT INTO public.diagnostic_ia_orders(
  id, user_id, customer_email, status, sales_context, cgv_document_version_id,
  cgv_acceptance_statement_version_id, paid_at
) VALUES
  (
    '8e000000-0000-4000-8000-000000000010','8e000000-0000-4000-8000-000000000002',
    'owner-restitution@example.test','paid','personal',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
    '2020-01-01T08:00:00Z'
  ),
  (
    '8e000000-0000-4000-8000-000000000011','8e000000-0000-4000-8000-000000000002',
    'owner-restitution@example.test','paid','professional',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2B-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
    '2020-01-01T08:00:00Z'
  ),
  (
    '8e000000-0000-4000-8000-000000000012','8e000000-0000-4000-8000-000000000003',
    'other-restitution@example.test','paid','professional',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2B-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
    '2020-01-01T08:00:00Z'
  );

INSERT INTO public.diagnostic_ia_bookings(
  id, order_id, user_id, starts_at, ends_at, status, booked_at,
  completed_at,
  google_sync_status, google_meet_status, google_calendar_id,
  google_event_id, google_meet_url
) VALUES
  (
    '8e000000-0000-4000-8000-000000000020','8e000000-0000-4000-8000-000000000010',
    '8e000000-0000-4000-8000-000000000002',
    (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') - interval '1 day' + interval '9 hours') AT TIME ZONE 'Europe/Paris',
    (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') - interval '1 day' + interval '10 hours 30 minutes') AT TIME ZONE 'Europe/Paris',
    'booked',now() - interval '10 days',NULL,'synced','created','diagnostic-calendar@example.test',
    'eventrestitutionmain','https://meet.google.com/abc-defg-hij'
  ),
  (
    '8e000000-0000-4000-8000-000000000021','8e000000-0000-4000-8000-000000000011',
    '8e000000-0000-4000-8000-000000000002',
    (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') - interval '2 days' + interval '9 hours') AT TIME ZONE 'Europe/Paris',
    (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') - interval '2 days' + interval '10 hours 30 minutes') AT TIME ZONE 'Europe/Paris',
    'booked',now() - interval '10 days',NULL,'not_started','not_requested',NULL,NULL,NULL
  ),
  (
    '8e000000-0000-4000-8000-000000000022','8e000000-0000-4000-8000-000000000012',
    '8e000000-0000-4000-8000-000000000003',
    (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') - interval '3 days' + interval '9 hours') AT TIME ZONE 'Europe/Paris',
    (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') - interval '3 days' + interval '10 hours 30 minutes') AT TIME ZONE 'Europe/Paris',
    'completed',now() - interval '10 days',
    (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') - interval '3 days' + interval '10 hours 30 minutes') AT TIME ZONE 'Europe/Paris',
    'not_started','not_requested',NULL,NULL,NULL
  );

INSERT INTO public.diagnostic_ia_preparation_questionnaires(
  id, booking_id, user_id, questionnaire_version, first_name, last_name,
  organization, job_title, sector, organization_size, tools_used, ai_level,
  repetitive_tasks, documents_handled, main_difficulty, diagnostic_goal,
  one_task_to_remove, retention_due_at
) VALUES (
  '8e000000-0000-4000-8000-000000000030','8e000000-0000-4000-8000-000000000020',
  '8e000000-0000-4000-8000-000000000002','DIAGNOSTIC-IA-PREPARATION-2026-08-29',
  'Test','Propriétaire','Organisation test','Responsable test','Conseil','1_9',
  'Outils fictifs','beginner','Tâches fictives répétitives','Documents génériques',
  'Difficulté fictive','Objectif TEST','Tâche fictive à réduire',now() + interval '12 months'
);

CREATE TEMP TABLE diagnostic_restitution_before ON COMMIT DROP AS
SELECT
  (SELECT to_jsonb(orders) FROM public.diagnostic_ia_orders AS orders
   WHERE id = '8e000000-0000-4000-8000-000000000010') AS order_row,
  (SELECT jsonb_build_object(
     'google_sync_status', google_sync_status,
     'google_meet_status', google_meet_status,
     'google_calendar_id', google_calendar_id,
     'google_event_id', google_event_id,
     'google_meet_url', google_meet_url
   ) FROM public.diagnostic_ia_bookings
   WHERE id = '8e000000-0000-4000-8000-000000000020') AS google_state,
  (SELECT count(*)::integer FROM public.purchases) AS purchases_count,
  (SELECT count(*)::integer FROM public.course_access) AS course_access_count;

GRANT SELECT ON diagnostic_restitution_before TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8e000000-0000-4000-8000-000000000002',true);
SELECT throws_ok($$
  SELECT public.admin_complete_diagnostic_ia_booking('8e000000-0000-4000-8000-000000000020', NULL)
$$, '42501', 'Action réservée à l’administrateur strict.', 'Un utilisateur normal ne termine pas le diagnostic');
SELECT throws_ok($$
  SELECT public.admin_complete_diagnostic_ia_booking('8e000000-0000-4000-8000-ffffffffffff', NULL)
$$, '42501', 'Action réservée à l’administrateur strict.', 'Le contrôle de rôle précède toute fuite sur un booking inconnu');

SELECT set_config('request.jwt.claim.sub','8e000000-0000-4000-8000-000000000001',true);
SELECT throws_ok($$
  SELECT public.admin_complete_diagnostic_ia_booking('8e000000-0000-4000-8000-ffffffffffff', NULL)
$$, 'P0002', 'Réservation Diagnostic IA introuvable.', 'Un identifiant qui n est pas un booking Diagnostic est refusé proprement');

SELECT lives_ok($$
  SELECT public.admin_save_diagnostic_ia_restitution(
    '8e000000-0000-4000-8000-000000000020', 0, pg_temp.diagnostic_restitution_content('BROUILLON_INITIAL')
  )
$$, 'L administrateur crée un brouillon sur un booking booked');

SELECT is(
  (SELECT status FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  'draft', 'Le statut initial est draft'
);
SELECT is(
  (SELECT revision FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  1, 'La création commence à la révision 1'
);
SELECT is(
  (SELECT user_id FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  '8e000000-0000-4000-8000-000000000002'::uuid, 'Le propriétaire est dérivé du booking'
);
SELECT is(
  (SELECT source_questionnaire_id FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  '8e000000-0000-4000-8000-000000000030'::uuid, 'Le questionnaire du booking est référencé'
);
SELECT is(
  (SELECT questionnaire_version_used FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  'DIAGNOSTIC-IA-PREPARATION-2026-08-29', 'La version du questionnaire est persistée'
);
SELECT is(
  (SELECT count(*)::integer FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  1, 'Le booking conserve exactement une restitution'
);

SELECT set_config('request.jwt.claim.sub','8e000000-0000-4000-8000-000000000002',true);
SELECT is(
  (SELECT count(*)::integer FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  0, 'Le propriétaire ne voit pas le brouillon'
);
SELECT throws_ok($$
  SELECT public.admin_save_diagnostic_ia_restitution(
    '8e000000-0000-4000-8000-000000000020', 1, pg_temp.diagnostic_restitution_content('REFUS_USER')
  )
$$, '42501', 'Action réservée à l’administrateur strict.', 'Un utilisateur normal ne sauvegarde pas de brouillon');

SELECT set_config('request.jwt.claim.sub','8e000000-0000-4000-8000-000000000001',true);
CREATE TEMP TABLE first_draft_sha ON COMMIT DROP AS
SELECT content_sha256 FROM public.diagnostic_ia_restitutions
WHERE booking_id='8e000000-0000-4000-8000-000000000020';

SELECT lives_ok($$
  SELECT public.admin_save_diagnostic_ia_restitution(
    '8e000000-0000-4000-8000-000000000020', 1, pg_temp.diagnostic_restitution_content('BROUILLON_MODIFIE')
  )
$$, 'La sauvegarde du brouillon contrôle puis incrémente la révision');
SELECT is(
  (SELECT revision FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  2, 'La sauvegarde passe à la révision 2'
);
SELECT isnt(
  (SELECT content_sha256 FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  (SELECT content_sha256 FROM first_draft_sha), 'Le SHA change lorsque le contenu métier change'
);
SELECT throws_ok($$
  SELECT public.admin_save_diagnostic_ia_restitution(
    '8e000000-0000-4000-8000-000000000020', 1, pg_temp.diagnostic_restitution_content('REVISION_OBSOLETE')
  )
$$, '40001', 'Conflit de révision lors de la sauvegarde du brouillon.', 'Une révision obsolète est refusée');

SELECT lives_ok($$
  SELECT public.admin_save_diagnostic_ia_restitution(
    '8e000000-0000-4000-8000-000000000021', 0, pg_temp.diagnostic_restitution_content('NON_COMPLETE')
  )
$$, 'Un autre booking booked accepte son brouillon');
SELECT throws_ok($$
  SELECT public.admin_publish_diagnostic_ia_restitution(
    (SELECT id FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000021'), 1
  )
$$, 'P0001', 'Le diagnostic doit être marqué comme réalisé avant publication.', 'La publication est impossible avant completion');

SELECT lives_ok($$
  SELECT public.admin_complete_diagnostic_ia_booking('8e000000-0000-4000-8000-000000000020', NULL)
$$, 'L administrateur termine un booking confirmé');
SELECT is(
  (SELECT status FROM public.diagnostic_ia_bookings WHERE id='8e000000-0000-4000-8000-000000000020'),
  'completed', 'Le booking passe de booked à completed'
);
SELECT ok(
  (SELECT completed_at IS NOT NULL FROM public.diagnostic_ia_bookings WHERE id='8e000000-0000-4000-8000-000000000020'),
  'completed_at est renseigné'
);
CREATE TEMP TABLE completed_once ON COMMIT DROP AS
SELECT completed_at FROM public.diagnostic_ia_bookings WHERE id='8e000000-0000-4000-8000-000000000020';
SELECT lives_ok($$
  SELECT public.admin_complete_diagnostic_ia_booking('8e000000-0000-4000-8000-000000000020', NULL)
$$, 'La completion répétée est idempotente');
SELECT is(
  (SELECT completed_at FROM public.diagnostic_ia_bookings WHERE id='8e000000-0000-4000-8000-000000000020'),
  (SELECT completed_at FROM completed_once), 'L idempotence ne change pas completed_at'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_log
   WHERE target_id='8e000000-0000-4000-8000-000000000020'
     AND action_type='diagnostic_ia_booking_completed'),
  1, 'La completion idempotente ne double pas l audit'
);
SELECT is(
  (SELECT to_jsonb(orders) FROM public.diagnostic_ia_orders AS orders
   WHERE id='8e000000-0000-4000-8000-000000000010'),
  (SELECT order_row FROM diagnostic_restitution_before), 'La completion ne modifie pas l order'
);
SELECT is(
  (SELECT jsonb_build_object(
     'google_sync_status', google_sync_status,
     'google_meet_status', google_meet_status,
     'google_calendar_id', google_calendar_id,
     'google_event_id', google_event_id,
     'google_meet_url', google_meet_url
   ) FROM public.diagnostic_ia_bookings WHERE id='8e000000-0000-4000-8000-000000000020'),
  (SELECT google_state FROM diagnostic_restitution_before), 'Calendar et Meet restent inchangés'
);

SELECT lives_ok($$
  SELECT public.admin_publish_diagnostic_ia_restitution(
    (SELECT id FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'), 2
  )
$$, 'La restitution complète est publiée après completion');
SELECT is(
  (SELECT status FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  'published', 'La publication conserve le statut published'
);
SELECT is(
  (SELECT revision FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  2, 'La publication sans changement de contenu conserve la révision'
);
SELECT ok(
  (SELECT retention_due_at = greatest(
     (SELECT completed_at FROM public.diagnostic_ia_bookings WHERE id=booking_id), published_at
   ) + interval '5 years'
   FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  'La conservation vaut cinq ans après la date la plus récente entre completion et publication'
);

SELECT set_config('request.jwt.claim.sub','8e000000-0000-4000-8000-000000000002',true);
SELECT is(
  (SELECT count(*)::integer FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  1, 'Le propriétaire lit sa restitution publiée non expirée'
);
SELECT throws_ok($$INSERT INTO public.diagnostic_ia_restitutions DEFAULT VALUES$$,
  '42501', NULL, 'Authenticated ne peut pas insérer directement');
SELECT throws_ok($$
  UPDATE public.diagnostic_ia_restitutions SET overall_summary='Modification directe refusée'
  WHERE booking_id='8e000000-0000-4000-8000-000000000020'
$$, '42501', NULL, 'Authenticated ne peut pas modifier directement');
SELECT throws_ok($$
  DELETE FROM public.diagnostic_ia_restitutions
  WHERE booking_id='8e000000-0000-4000-8000-000000000020'
$$, '42501', NULL, 'Authenticated ne peut pas supprimer directement');

SELECT set_config('request.jwt.claim.sub','8e000000-0000-4000-8000-000000000003',true);
SELECT is(
  (SELECT count(*)::integer FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  0, 'Un autre utilisateur ne voit aucune existence de restitution'
);

SELECT set_config('request.jwt.claim.sub','8e000000-0000-4000-8000-000000000001',true);
SELECT is(
  (SELECT count(*)::integer FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  1, 'L administrateur strict lit la restitution publiée'
);
SELECT throws_ok($$
  SELECT public.admin_save_diagnostic_ia_restitution(
    '8e000000-0000-4000-8000-000000000020', 2, pg_temp.diagnostic_restitution_content('RETOUR_DRAFT_REFUSE')
  )
$$, 'P0001', 'Une restitution publiée ne peut pas être modifiée par la sauvegarde de brouillon.',
  'La restitution publiée ne revient jamais au brouillon');
SELECT throws_ok($$
  SELECT public.admin_correct_diagnostic_ia_restitution(
    (SELECT id FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
    2, pg_temp.diagnostic_restitution_content('CORRECTION_SANS_MOTIF'), ''
  )
$$, '22023', 'Un motif de correction de 5 à 1000 caractères est requis.', 'Le motif de correction est obligatoire');

CREATE TEMP TABLE published_before_correction ON COMMIT DROP AS
SELECT revision, content_sha256, retention_due_at
FROM public.diagnostic_ia_restitutions
WHERE booking_id='8e000000-0000-4000-8000-000000000020';

SELECT lives_ok($$
  SELECT public.admin_correct_diagnostic_ia_restitution(
    (SELECT id FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
    2, pg_temp.diagnostic_restitution_content('CORRECTION_SENSIBLE_1E_A'),
    'Correction contrôlée après relecture métier'
  )
$$, 'L administrateur corrige une restitution publiée avec un motif');
SELECT is(
  (SELECT status FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  'published', 'La correction conserve published'
);
SELECT is(
  (SELECT revision FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  (SELECT revision + 1 FROM published_before_correction), 'La correction incrémente la révision'
);
SELECT isnt(
  (SELECT content_sha256 FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  (SELECT content_sha256 FROM published_before_correction), 'La correction recalcule un SHA différent'
);
SELECT is(
  (SELECT retention_due_at FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  (SELECT retention_due_at FROM published_before_correction), 'La correction ne prolonge pas silencieusement la conservation'
);
SELECT ok(
  (SELECT corrected_at IS NOT NULL FROM public.diagnostic_ia_restitutions WHERE booking_id='8e000000-0000-4000-8000-000000000020'),
  'corrected_at est renseigné'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE action_type='diagnostic_ia_restitution_corrected'
      AND actor_user_id='8e000000-0000-4000-8000-000000000001'
      AND target_user_id='8e000000-0000-4000-8000-000000000002'
      AND reason='Correction contrôlée après relecture métier'
      AND previous_state ?& ARRAY['status','revision','content_sha256']
      AND new_state ?& ARRAY['status','revision','content_sha256']
      AND metadata->>'booking_id'='8e000000-0000-4000-8000-000000000020'
  ),
  'L audit de correction contient acteur, identifiants, révisions, SHA, motif et timestamp'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE target_type='diagnostic_ia_restitution'
      AND concat_ws(' ', previous_state::text, new_state::text, metadata::text) LIKE '%CORRECTION_SENSIBLE_1E_A%'
  ),
  'Le contenu métier complet n est jamais écrit dans audit_log'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_proc
   WHERE proname IN (
     'delete_expired_diagnostic_ia_restitutions',
     'cleanup_expired_diagnostic_ia_restitutions',
     'purge_diagnostic_ia_restitutions'
   )),
  0, 'Aucune routine de purge des restitutions n est créée'
);
SELECT is(
  (SELECT count(*)::integer FROM public.purchases),
  (SELECT purchases_count FROM diagnostic_restitution_before), 'Le LOT 1E-A ne touche pas purchases'
);
SELECT is(
  (SELECT count(*)::integer FROM public.course_access),
  (SELECT course_access_count FROM diagnostic_restitution_before), 'Le LOT 1E-A ne touche pas course_access'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
