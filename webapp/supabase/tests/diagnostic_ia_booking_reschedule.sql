BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

SELECT has_function(
  'public', 'admin_claim_diagnostic_ia_booking_reschedule', ARRAY['uuid', 'uuid[]'],
  'La RPC de prise des nouveaux creneaux existe'
);
SELECT has_function(
  'public', 'cancel_diagnostic_ia_booking_reschedule_claim', ARRAY['uuid', 'uuid', 'text'],
  'La RPC d annulation de la prise existe'
);
SELECT has_function(
  'public', 'finalize_diagnostic_ia_booking_reschedule', ARRAY['uuid', 'uuid', 'text'],
  'La RPC de finalisation du deplacement existe'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.admin_claim_diagnostic_ia_booking_reschedule(uuid,uuid[])',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.finalize_diagnostic_ia_booking_reschedule(uuid,uuid,text)',
    'EXECUTE'
  ),
  'La prise passe par l admin authentifie et la finalisation reste reservee au service serveur'
);

INSERT INTO auth.users(
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('8f000000-0000-4000-8000-000000000001','authenticated','authenticated','admin-reschedule@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('8f000000-0000-4000-8000-000000000002','authenticated','authenticated','owner-reschedule@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('8f000000-0000-4000-8000-000000000003','authenticated','authenticated','user-reschedule@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now());

INSERT INTO public.profiles(id, email, role) VALUES
  ('8f000000-0000-4000-8000-000000000001','admin-reschedule@example.test','admin'),
  ('8f000000-0000-4000-8000-000000000002','owner-reschedule@example.test','user'),
  ('8f000000-0000-4000-8000-000000000003','user-reschedule@example.test','user')
ON CONFLICT(id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role;

INSERT INTO public.diagnostic_ia_orders(
  id, user_id, customer_email, status, sales_context,
  cgv_document_version_id, cgv_acceptance_statement_version_id, paid_at
) VALUES
  (
    '8f000000-0000-4000-8000-000000000010','8f000000-0000-4000-8000-000000000002',
    'owner-reschedule@example.test','paid','personal',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
    now()
  ),
  (
    '8f000000-0000-4000-8000-000000000011','8f000000-0000-4000-8000-000000000002',
    'owner-reschedule@example.test','paid','personal',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
    now()
  );

INSERT INTO public.training_availability_slots(
  id, starts_at, ends_at, delivery_modes, is_active, is_reserved
) VALUES
  ('8f000000-0000-4000-8000-000000000101','2099-02-02T08:00:00Z','2099-02-02T08:30:00Z',ARRAY['remote'],true,true),
  ('8f000000-0000-4000-8000-000000000102','2099-02-02T08:30:00Z','2099-02-02T09:00:00Z',ARRAY['remote'],true,true),
  ('8f000000-0000-4000-8000-000000000103','2099-02-02T09:00:00Z','2099-02-02T09:30:00Z',ARRAY['remote'],true,true),
  ('8f000000-0000-4000-8000-000000000111','2099-02-03T13:00:00Z','2099-02-03T13:30:00Z',ARRAY['remote'],true,false),
  ('8f000000-0000-4000-8000-000000000112','2099-02-03T13:30:00Z','2099-02-03T14:00:00Z',ARRAY['remote'],true,false),
  ('8f000000-0000-4000-8000-000000000113','2099-02-03T14:00:00Z','2099-02-03T14:30:00Z',ARRAY['remote'],true,false);

INSERT INTO public.diagnostic_ia_bookings(
  id, order_id, user_id, starts_at, ends_at, status, booked_at, completed_at,
  google_sync_status, google_meet_status, google_calendar_id,
  google_event_id, google_meet_url
) VALUES
  (
    '8f000000-0000-4000-8000-000000000020','8f000000-0000-4000-8000-000000000010',
    '8f000000-0000-4000-8000-000000000002','2099-02-02T08:00:00Z','2099-02-02T09:30:00Z',
    'booked',now(),NULL,'synced','created','diagnostic-calendar@example.test',
    'eventreschedulemain','https://meet.google.com/abc-defg-hij'
  ),
  (
    '8f000000-0000-4000-8000-000000000021','8f000000-0000-4000-8000-000000000011',
    '8f000000-0000-4000-8000-000000000002','2099-02-04T08:00:00Z','2099-02-04T09:30:00Z',
    'completed',now(),'2099-02-04T09:30:00Z','synced','created','diagnostic-calendar@example.test',
    'eventreschedulecompleted','https://meet.google.com/abc-defg-hij'
  );

INSERT INTO public.diagnostic_ia_booking_slots(
  booking_id, user_id, availability_slot_id, starts_at, ends_at
) VALUES
  ('8f000000-0000-4000-8000-000000000020','8f000000-0000-4000-8000-000000000002','8f000000-0000-4000-8000-000000000101','2099-02-02T08:00:00Z','2099-02-02T08:30:00Z'),
  ('8f000000-0000-4000-8000-000000000020','8f000000-0000-4000-8000-000000000002','8f000000-0000-4000-8000-000000000102','2099-02-02T08:30:00Z','2099-02-02T09:00:00Z'),
  ('8f000000-0000-4000-8000-000000000020','8f000000-0000-4000-8000-000000000002','8f000000-0000-4000-8000-000000000103','2099-02-02T09:00:00Z','2099-02-02T09:30:00Z');

INSERT INTO public.diagnostic_ia_preparation_questionnaires(
  id, booking_id, user_id, questionnaire_version, first_name, last_name,
  organization, job_title, sector, organization_size, tools_used, ai_level,
  repetitive_tasks, documents_handled, main_difficulty, diagnostic_goal,
  one_task_to_remove, retention_due_at
) VALUES (
  '8f000000-0000-4000-8000-000000000030','8f000000-0000-4000-8000-000000000020',
  '8f000000-0000-4000-8000-000000000002','DIAGNOSTIC-IA-PREPARATION-2026-08-29',
  'Test','Reschedule','Organisation test','Responsable test','Conseil','1_9',
  'Outils fictifs','beginner','Taches fictives','Documents generiques',
  'Difficulte fictive','Objectif TEST','Tache fictive',now() + interval '12 months'
);

CREATE TEMP TABLE reschedule_before ON COMMIT DROP AS
SELECT
  (SELECT order_id FROM public.diagnostic_ia_bookings WHERE id='8f000000-0000-4000-8000-000000000020') AS order_id,
  (SELECT user_id FROM public.diagnostic_ia_bookings WHERE id='8f000000-0000-4000-8000-000000000020') AS user_id,
  (SELECT id FROM public.diagnostic_ia_preparation_questionnaires WHERE booking_id='8f000000-0000-4000-8000-000000000020') AS questionnaire_id,
  (SELECT count(*)::integer FROM public.purchases) AS purchases_count,
  (SELECT count(*)::integer FROM public.course_access) AS course_access_count;
GRANT SELECT ON reschedule_before TO authenticated, service_role;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8f000000-0000-4000-8000-000000000003',true);
SELECT throws_ok($$
  SELECT * FROM public.admin_claim_diagnostic_ia_booking_reschedule(
    '8f000000-0000-4000-8000-000000000020',
    ARRAY['8f000000-0000-4000-8000-000000000111'::uuid,'8f000000-0000-4000-8000-000000000112'::uuid,'8f000000-0000-4000-8000-000000000113'::uuid]
  )
$$, '42501', 'Accès administrateur strict requis.', 'Un utilisateur normal ne peut pas déplacer le rendez-vous');

SELECT set_config('request.jwt.claim.sub','8f000000-0000-4000-8000-000000000001',true);
SELECT throws_ok($$
  SELECT * FROM public.admin_claim_diagnostic_ia_booking_reschedule(
    '8f000000-0000-4000-8000-000000000021',
    ARRAY['8f000000-0000-4000-8000-000000000111'::uuid,'8f000000-0000-4000-8000-000000000112'::uuid,'8f000000-0000-4000-8000-000000000113'::uuid]
  )
$$, 'P0001', 'Seul un rendez-vous réservé peut être déplacé.', 'Un booking completed est refusé');

SELECT lives_ok($$
  SELECT * FROM public.admin_claim_diagnostic_ia_booking_reschedule(
    '8f000000-0000-4000-8000-000000000020',
    ARRAY['8f000000-0000-4000-8000-000000000111'::uuid,'8f000000-0000-4000-8000-000000000112'::uuid,'8f000000-0000-4000-8000-000000000113'::uuid]
  )
$$, 'L administrateur strict prend atomiquement les trois nouveaux creneaux');

RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.training_availability_slots
   WHERE id IN ('8f000000-0000-4000-8000-000000000111','8f000000-0000-4000-8000-000000000112','8f000000-0000-4000-8000-000000000113')
     AND is_reserved),
  3, 'Les trois nouveaux creneaux sont reserves pendant la prise'
);
SELECT is(
  (SELECT count(*)::integer FROM public.diagnostic_ia_booking_slots
   WHERE booking_id='8f000000-0000-4000-8000-000000000020' AND released_at IS NULL),
  3, 'Les trois anciens liens restent actifs pendant la prise'
);
SELECT is(
  (SELECT count(*)::integer FROM public.training_availability_slots
   WHERE id IN ('8f000000-0000-4000-8000-000000000101','8f000000-0000-4000-8000-000000000102','8f000000-0000-4000-8000-000000000103')
     AND is_reserved),
  3, 'Les trois anciens creneaux restent reserves pendant la prise'
);

CREATE TEMP TABLE first_reschedule_claim ON COMMIT DROP AS
SELECT reschedule_claim_token AS claim_token
FROM public.diagnostic_ia_bookings
WHERE id='8f000000-0000-4000-8000-000000000020';
GRANT SELECT ON first_reschedule_claim TO authenticated, service_role;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8f000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$
  SELECT * FROM public.admin_claim_diagnostic_ia_booking_reschedule(
    '8f000000-0000-4000-8000-000000000020',
    ARRAY['8f000000-0000-4000-8000-000000000113'::uuid,'8f000000-0000-4000-8000-000000000112'::uuid,'8f000000-0000-4000-8000-000000000111'::uuid]
  )
$$, 'La reprise idempotente du meme deplacement est acceptee');
SELECT is(
  (SELECT reschedule_claim_token FROM public.diagnostic_ia_bookings WHERE id='8f000000-0000-4000-8000-000000000020'),
  (SELECT claim_token FROM first_reschedule_claim),
  'La reprise idempotente conserve le meme jeton'
);

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT ok(
  public.cancel_diagnostic_ia_booking_reschedule_claim(
    '8f000000-0000-4000-8000-000000000020',
    (SELECT claim_token FROM first_reschedule_claim),
    'not_updated_test'
  ),
  'Le service serveur annule la prise'
);
SELECT is(
  (SELECT count(*)::integer FROM public.training_availability_slots
   WHERE id IN ('8f000000-0000-4000-8000-000000000111','8f000000-0000-4000-8000-000000000112','8f000000-0000-4000-8000-000000000113')
     AND is_reserved),
  0, 'L annulation libere les trois nouveaux creneaux'
);
SELECT is(
  (SELECT count(*)::integer FROM public.diagnostic_ia_booking_slots
   WHERE booking_id='8f000000-0000-4000-8000-000000000020' AND released_at IS NULL),
  3, 'L annulation conserve les trois anciens liens'
);

RESET ROLE;
UPDATE public.training_availability_slots
SET is_reserved=true
WHERE id='8f000000-0000-4000-8000-000000000112';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8f000000-0000-4000-8000-000000000001',true);
SELECT throws_ok($$
  SELECT * FROM public.admin_claim_diagnostic_ia_booking_reschedule(
    '8f000000-0000-4000-8000-000000000020',
    ARRAY['8f000000-0000-4000-8000-000000000111'::uuid,'8f000000-0000-4000-8000-000000000112'::uuid,'8f000000-0000-4000-8000-000000000113'::uuid]
  )
$$, '23505', 'Le nouveau créneau vient de devenir indisponible.', 'Un créneau devenu indisponible provoque un conflit');

RESET ROLE;
UPDATE public.training_availability_slots
SET is_reserved=false
WHERE id='8f000000-0000-4000-8000-000000000112';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8f000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$
  SELECT * FROM public.admin_claim_diagnostic_ia_booking_reschedule(
    '8f000000-0000-4000-8000-000000000020',
    ARRAY['8f000000-0000-4000-8000-000000000111'::uuid,'8f000000-0000-4000-8000-000000000112'::uuid,'8f000000-0000-4000-8000-000000000113'::uuid]
  )
$$, 'Une nouvelle prise reussit apres liberation du conflit');

CREATE TEMP TABLE final_reschedule_claim ON COMMIT DROP AS
SELECT reschedule_claim_token AS claim_token
FROM public.diagnostic_ia_bookings
WHERE id='8f000000-0000-4000-8000-000000000020';
GRANT SELECT ON final_reschedule_claim TO service_role;

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.finalize_diagnostic_ia_booking_reschedule(
    '8f000000-0000-4000-8000-000000000020',
    (SELECT claim_token FROM final_reschedule_claim),
    'updated_test'
  )
$$, 'La finalisation serveur bascule atomiquement le rendez-vous');

SELECT is(
  (SELECT starts_at FROM public.diagnostic_ia_bookings WHERE id='8f000000-0000-4000-8000-000000000020'),
  '2099-02-03T13:00:00Z'::timestamptz,
  'Le booking porte le nouvel horaire'
);
SELECT is(
  (SELECT count(*)::integer FROM public.diagnostic_ia_booking_slots
   WHERE booking_id='8f000000-0000-4000-8000-000000000020'
     AND availability_slot_id IN ('8f000000-0000-4000-8000-000000000101','8f000000-0000-4000-8000-000000000102','8f000000-0000-4000-8000-000000000103')
     AND released_at IS NOT NULL),
  3, 'La finalisation libere les trois anciens liens'
);
SELECT is(
  (SELECT count(*)::integer FROM public.diagnostic_ia_booking_slots
   WHERE booking_id='8f000000-0000-4000-8000-000000000020'
     AND availability_slot_id IN ('8f000000-0000-4000-8000-000000000111','8f000000-0000-4000-8000-000000000112','8f000000-0000-4000-8000-000000000113')
     AND released_at IS NULL),
  3, 'La finalisation active les trois nouveaux liens'
);
SELECT is(
  (SELECT count(*)::integer FROM public.training_availability_slots
   WHERE id IN ('8f000000-0000-4000-8000-000000000101','8f000000-0000-4000-8000-000000000102','8f000000-0000-4000-8000-000000000103')
     AND is_reserved),
  0, 'La finalisation libere les trois anciens creneaux'
);
SELECT is(
  (SELECT order_id FROM public.diagnostic_ia_bookings WHERE id='8f000000-0000-4000-8000-000000000020'),
  (SELECT order_id FROM reschedule_before),
  'Le meme order_id est conserve'
);
SELECT is(
  (SELECT user_id FROM public.diagnostic_ia_bookings WHERE id='8f000000-0000-4000-8000-000000000020'),
  (SELECT user_id FROM reschedule_before),
  'Le meme user_id est conserve'
);
SELECT is(
  (SELECT id FROM public.diagnostic_ia_preparation_questionnaires WHERE booking_id='8f000000-0000-4000-8000-000000000020'),
  (SELECT questionnaire_id FROM reschedule_before),
  'Le questionnaire reste attache au meme booking'
);
SELECT is(
  (SELECT count(*)::integer FROM public.purchases),
  (SELECT purchases_count FROM reschedule_before),
  'Le deplacement ne modifie pas purchases'
);
SELECT is(
  (SELECT count(*)::integer FROM public.course_access),
  (SELECT course_access_count FROM reschedule_before),
  'Le deplacement ne modifie pas course_access'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_log
   WHERE target_id='8f000000-0000-4000-8000-000000000020'
     AND action_type='diagnostic_ia_booking_rescheduled'),
  1, 'La finalisation produit un audit metier sans contenu sensible'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
