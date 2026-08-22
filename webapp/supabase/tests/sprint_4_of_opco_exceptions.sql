BEGIN;
SELECT plan(34);

SELECT has_table('public', 'training_enrollment_events', 'Le journal des exceptions existe');
SELECT has_table('public', 'training_document_versions', 'Les versions documentaires existent');
SELECT has_table('public', 'training_amendments', 'Les avenants existent');
SELECT has_column('public', 'training_enrollments', 'funding_requested_cents', 'Le montant demandé est suivi');
SELECT has_column('public', 'training_enrollments', 'funding_granted_cents', 'Le montant accordé est suivi');
SELECT has_column('public', 'training_enrollments', 'funding_balance_cents', 'Le reste est calculé');
SELECT has_column('public', 'training_enrollments', 'payer_name', 'Le payeur est distingué');
SELECT has_column('public', 'training_enrollments', 'client_name', 'Le client est distingué');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.training_enrollment_events'::regclass), 'RLS active sur les événements');
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.training_enrollment_events'::regclass), 'RLS forcée sur les événements');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.training_document_versions'::regclass), 'RLS active sur les versions');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.training_amendments'::regclass), 'RLS active sur les avenants');

SELECT is((SELECT count(*)::integer FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'training_enrollment_events' AND grantee = 'authenticated' AND privilege_type <> 'SELECT'), 0, 'Le frontend ne peut pas muter les événements');
SELECT is((SELECT count(*)::integer FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'training_document_versions' AND grantee = 'authenticated' AND privilege_type <> 'SELECT'), 0, 'Le frontend ne peut pas muter les versions');
SELECT is((SELECT count(*)::integer FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'training_amendments' AND grantee = 'authenticated' AND privilege_type <> 'SELECT'), 0, 'Le frontend ne peut pas muter les avenants');

SELECT has_trigger('public', 'training_enrollment_events', 'prevent_training_enrollment_event_mutation', 'Le journal est append-only');
SELECT has_trigger('public', 'training_document_versions', 'prevent_training_document_version_mutation', 'Les versions sont append-only');
SELECT has_trigger('public', 'training_amendments', 'prevent_training_amendment_mutation', 'Les avenants sont append-only');
SELECT has_trigger('public', 'training_documents', 'capture_training_document_version', 'Chaque régénération conserve une version');

SELECT col_is_unique('public', 'training_amendments', 'amendment_number', 'La numérotation des avenants est unique');
SELECT fk_ok('public', 'training_enrollment_events', 'enrollment_id', 'public', 'training_enrollments', 'id', 'Les événements restent rattachés au dossier');
SELECT fk_ok('public', 'training_amendments', 'enrollment_id', 'public', 'training_enrollments', 'id', 'Les avenants restent rattachés au dossier');

SELECT is((SELECT count(*)::integer FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('training_rights', 'enrollment_rights', 'pedagogical_access')), 0, 'Aucun second système de droits n est créé');
SELECT is((SELECT count(*)::integer FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table IN ('training_enrollment_events', 'training_amendments') AND action_statement ILIKE '%course_access%'), 0, 'Les preuves ne déclenchent aucune mutation de course_access');
SELECT is((SELECT count(*)::integer FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'training_enrollments' AND action_statement ILIKE '%purchases%'), 0, 'Les exceptions ne suppriment ni ne modifient les achats');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('84000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin-s4@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('84000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'learner-s4@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now());

INSERT INTO public.profiles (id, email, role) VALUES
  ('84000000-0000-0000-0000-000000000001', 'admin-s4@example.test', 'admin'),
  ('84000000-0000-0000-0000-000000000002', 'learner-s4@example.test', 'user')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role;

INSERT INTO public.course_access (id, user_id, course_id, status, access_source, expires_at)
VALUES ('84000000-0000-0000-0000-000000000003', '84000000-0000-0000-0000-000000000002', 'formation-ia', 'suspended', 'opco', NULL);

SELECT lives_ok($$
  INSERT INTO public.training_enrollments (
    id, user_id, course_id, status, enrollment_source, learner_first_name, learner_last_name,
    funding_mode, funder_name, funding_reference, funding_status, funding_requested_cents,
    funding_granted_cents, funding_requested_at, funding_decided_at, delivery_mode,
    starts_at, ends_at, duration_minutes, price_amount_cents, course_access_id, created_by
  ) VALUES (
    '84000000-0000-0000-0000-000000000004', '84000000-0000-0000-0000-000000000002',
    'formation-ia', 'validated', 'opco', 'Camille', 'Martin', 'opco', 'OPCO Exemple', 'DOSSIER-S4',
    'partially_granted', 49700, 30000, now(), now(), 'remote', now() + interval '10 days',
    now() + interval '10 days 10 hours', 600, 49700,
    '84000000-0000-0000-0000-000000000003', '84000000-0000-0000-0000-000000000001'
  )$$,
  'Une prise en charge partielle cohérente est enregistrée'
);

SELECT is((SELECT funding_balance_cents FROM public.training_enrollments WHERE id = '84000000-0000-0000-0000-000000000004'), 19700, 'Le reste à charge est calculé sans créer de droit');
SELECT is((SELECT status FROM public.course_access WHERE id = '84000000-0000-0000-0000-000000000003'), 'suspended', 'La promesse de financement ne réactive pas un droit suspendu');

UPDATE public.training_enrollments SET
  status = 'cancelled', cancelled_at = now(), cancelled_by_actor = 'Bénéficiaire',
  cancellation_reason = 'Annulation contrôlée pour le test Sprint 4'
WHERE id = '84000000-0000-0000-0000-000000000004';
INSERT INTO public.training_enrollment_events (
  enrollment_id, event_type, reason, previous_state, new_state, rights_impact, actor_user_id
) VALUES (
  '84000000-0000-0000-0000-000000000004', 'cancelled', 'Annulation contrôlée pour le test Sprint 4',
  '{"status":"validated"}', '{"status":"cancelled"}', 'review_required', '84000000-0000-0000-0000-000000000001'
);

SELECT is((SELECT status FROM public.course_access WHERE id = '84000000-0000-0000-0000-000000000003'), 'suspended', 'Une annulation ne réactive ni ne supprime le droit suspendu');
SELECT is((SELECT count(*)::integer FROM public.training_enrollment_events WHERE enrollment_id = '84000000-0000-0000-0000-000000000004'), 1, 'L annulation est historisée');
SELECT throws_ok($$UPDATE public.training_enrollment_events SET reason = 'altération' WHERE enrollment_id = '84000000-0000-0000-0000-000000000004'$$, 'P0001', 'Les preuves administratives sont append-only', 'Une preuve historique ne peut pas être modifiée');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000002', true);
SELECT is((SELECT count(*)::integer FROM public.training_enrollment_events WHERE enrollment_id = '84000000-0000-0000-0000-000000000004'), 0, 'Le bénéficiaire est isolé du journal administratif');
RESET ROLE;

SELECT lives_ok($$
  INSERT INTO public.training_amendments (
    enrollment_id, effective_date, reason, change_summary, previous_values, new_values,
    frozen_snapshot, created_by
  ) VALUES (
    '84000000-0000-0000-0000-000000000004', current_date,
    'Report accepté par les parties', 'La date de formation est reportée.',
    '{"startsAt":"2026-09-01"}', '{"startsAt":"2026-10-01"}',
    '{"version":1,"reason":"Report accepté par les parties"}',
    '84000000-0000-0000-0000-000000000001'
  )$$,
  'Un avenant figé peut être ajouté sans écraser le dossier initial'
);
SELECT throws_ok($$UPDATE public.training_amendments SET change_summary = 'altération impossible' WHERE enrollment_id = '84000000-0000-0000-0000-000000000004'$$, 'P0001', 'Les preuves administratives sont append-only', 'Un avenant figé ne peut pas être écrasé');

SELECT * FROM finish();
ROLLBACK;
