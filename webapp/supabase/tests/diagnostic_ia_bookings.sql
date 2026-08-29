BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

SELECT has_table('public', 'diagnostic_ia_bookings', 'La table des réservations Diagnostic existe');
SELECT has_table('public', 'diagnostic_ia_booking_slots', 'La table des demi-heures Diagnostic existe');
SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.diagnostic_ia_bookings'::regclass)
  AND (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.diagnostic_ia_booking_slots'::regclass),
  'RLS active et forcée sur les deux tables'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.diagnostic_ia_bookings', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.diagnostic_ia_bookings', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.diagnostic_ia_booking_slots', 'INSERT'),
  'Le client ne peut créer ni modifier une réservation'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('87000000-0000-4000-8000-000000000001','authenticated','authenticated','admin-booking@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('87000000-0000-4000-8000-000000000002','authenticated','authenticated','client-booking@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('87000000-0000-4000-8000-000000000003','authenticated','authenticated','other-booking@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now());

INSERT INTO public.profiles(id,email,role) VALUES
  ('87000000-0000-4000-8000-000000000001','admin-booking@example.test','admin'),
  ('87000000-0000-4000-8000-000000000002','client-booking@example.test','user'),
  ('87000000-0000-4000-8000-000000000003','other-booking@example.test','user')
ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email, role=EXCLUDED.role;

INSERT INTO public.diagnostic_ia_orders(
  id,user_id,customer_email,status,sales_context,cgv_document_version_id,
  cgv_acceptance_statement_version_id,paid_at
) VALUES
  (
    '87000000-0000-4000-8000-000000000010','87000000-0000-4000-8000-000000000002',
    'client-booking@example.test','paid','personal',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
    '2099-01-01T09:00:00Z'
  ),
  (
    '87000000-0000-4000-8000-000000000011','87000000-0000-4000-8000-000000000003',
    'other-booking@example.test','paid','professional',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2B-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
    '2099-01-01T09:00:00Z'
  );

INSERT INTO public.training_availability_slots(
  id,starts_at,ends_at,delivery_modes,is_active,is_reserved,created_by
) VALUES
  ('87000000-0000-4000-8000-000000000101','2099-01-05T08:00:00Z','2099-01-05T08:30:00Z',ARRAY['remote'],true,true,'87000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000102','2099-01-05T08:30:00Z','2099-01-05T09:00:00Z',ARRAY['remote'],true,true,'87000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000103','2099-01-05T09:00:00Z','2099-01-05T09:30:00Z',ARRAY['remote'],true,true,'87000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000111','2099-01-08T08:00:00Z','2099-01-08T08:30:00Z',ARRAY['remote'],true,false,'87000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000112','2099-01-08T08:30:00Z','2099-01-08T09:00:00Z',ARRAY['remote'],true,false,'87000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000113','2099-01-08T09:00:00Z','2099-01-08T09:30:00Z',ARRAY['remote'],true,false,'87000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000121','2099-01-09T08:00:00Z','2099-01-09T08:30:00Z',ARRAY['remote'],true,true,'87000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000122','2099-01-09T08:30:00Z','2099-01-09T09:00:00Z',ARRAY['remote'],true,true,'87000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000123','2099-01-09T09:00:00Z','2099-01-09T09:30:00Z',ARRAY['remote'],true,true,'87000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000131','2099-01-10T08:00:00Z','2099-01-10T08:30:00Z',ARRAY['remote'],true,true,'87000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000132','2099-01-10T08:30:00Z','2099-01-10T09:00:00Z',ARRAY['remote'],true,true,'87000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000133','2099-01-10T09:00:00Z','2099-01-10T09:30:00Z',ARRAY['remote'],true,true,'87000000-0000-4000-8000-000000000001');

INSERT INTO public.diagnostic_ia_orders(
  id,user_id,customer_email,status,sales_context,cgv_document_version_id,
  cgv_acceptance_statement_version_id,paid_at
) VALUES (
  '87000000-0000-4000-8000-000000000012','87000000-0000-4000-8000-000000000002',
  'client-booking@example.test','paid','personal',
  (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
  (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
  '2099-01-01T09:00:00Z'
);

INSERT INTO public.diagnostic_ia_orders(
  id,user_id,customer_email,status,sales_context,cgv_document_version_id,
  cgv_acceptance_statement_version_id,paid_at
) VALUES (
  '87000000-0000-4000-8000-000000000014','87000000-0000-4000-8000-000000000002',
  'client-booking@example.test','paid','personal',
  (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
  (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
  '2099-01-01T09:00:00Z'
);

INSERT INTO public.diagnostic_ia_orders(
  id,user_id,customer_email,status,sales_context,cgv_document_version_id,
  cgv_acceptance_statement_version_id,paid_at
) VALUES (
  '87000000-0000-4000-8000-000000000015','87000000-0000-4000-8000-000000000002',
  'client-booking@example.test','paid','personal',
  (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
  (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
  '2099-01-01T09:00:00Z'
);

INSERT INTO public.diagnostic_ia_orders(
  id,user_id,customer_email,status,sales_context,cgv_document_version_id,
  cgv_acceptance_statement_version_id,paid_at
) VALUES (
  '87000000-0000-4000-8000-000000000013','87000000-0000-4000-8000-000000000002',
  'client-booking@example.test','paid','personal',
  (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
  (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
  '2099-01-01T09:00:00Z'
);

SET LOCAL plpgsql.variable_conflict = 'error';
SELECT lives_ok($$
  SELECT * FROM public.claim_diagnostic_ia_booking(
    '87000000-0000-4000-8000-000000000012',
    '87000000-0000-4000-8000-000000000002',
    ARRAY[
      '87000000-0000-4000-8000-000000000111'::uuid,
      '87000000-0000-4000-8000-000000000112'::uuid,
      '87000000-0000-4000-8000-000000000113'::uuid
    ]
  )
$$, 'La prise de créneaux passe avec plpgsql.variable_conflict=error');
SELECT is(
  (SELECT count(*)::integer FROM public.diagnostic_ia_booking_slots
    WHERE booking_id = (
      SELECT id FROM public.diagnostic_ia_bookings
      WHERE order_id = '87000000-0000-4000-8000-000000000012'
    )
  ),
  3,
  'La prise corrige la cible ON CONFLICT sans modifier les trois liens'
);

INSERT INTO public.diagnostic_ia_bookings(
  id,order_id,user_id,starts_at,ends_at,status,google_sync_status,claim_expires_at,created_at,updated_at
) VALUES (
  '87000000-0000-4000-8000-000000000021','87000000-0000-4000-8000-000000000013',
  '87000000-0000-4000-8000-000000000002','2099-01-09T08:00:00Z','2099-01-09T09:30:00Z',
  'booking_pending','pending',now() - interval '1 minute',
  now() - interval '1 hour',now() - interval '10 minutes'
);
INSERT INTO public.diagnostic_ia_booking_slots(
  booking_id,user_id,availability_slot_id,starts_at,ends_at
) VALUES
  ('87000000-0000-4000-8000-000000000021','87000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000121','2099-01-09T08:00:00Z','2099-01-09T08:30:00Z'),
  ('87000000-0000-4000-8000-000000000021','87000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000122','2099-01-09T08:30:00Z','2099-01-09T09:00:00Z'),
  ('87000000-0000-4000-8000-000000000021','87000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000123','2099-01-09T09:00:00Z','2099-01-09T09:30:00Z');

SELECT lives_ok($$
  SELECT * FROM public.claim_diagnostic_ia_booking(
    '87000000-0000-4000-8000-000000000013',
    '87000000-0000-4000-8000-000000000002',
    ARRAY[
      '87000000-0000-4000-8000-000000000121'::uuid,
      '87000000-0000-4000-8000-000000000122'::uuid,
      '87000000-0000-4000-8000-000000000123'::uuid
    ]
  )
$$, 'Un claim expiré du même booking est renouvelé atomiquement');
SELECT ok(
  (SELECT claim_expires_at > now() FROM public.diagnostic_ia_bookings
    WHERE id = '87000000-0000-4000-8000-000000000021'),
  'La reprise conserve les trois créneaux réservés et prolonge le claim'
);
SELECT throws_ok($$
  SELECT * FROM public.claim_diagnostic_ia_booking(
    '87000000-0000-4000-8000-000000000011',
    '87000000-0000-4000-8000-000000000003',
    ARRAY[
      '87000000-0000-4000-8000-000000000121'::uuid,
      '87000000-0000-4000-8000-000000000122'::uuid,
      '87000000-0000-4000-8000-000000000123'::uuid
    ]
  )
$$, '23505', 'Le créneau Diagnostic IA n’est plus disponible.',
  'Un autre booking conserve le refus 23505 des créneaux réservés');

CREATE TEMP TABLE diagnostic_booking_lms_counts(purchases integer, accesses integer) ON COMMIT DROP;
INSERT INTO diagnostic_booking_lms_counts
SELECT (SELECT count(*)::integer FROM public.purchases),
       (SELECT count(*)::integer FROM public.course_access);

INSERT INTO public.diagnostic_ia_bookings(
  id,order_id,user_id,starts_at,ends_at,status,google_sync_status,claim_expires_at
) VALUES (
  '87000000-0000-4000-8000-000000000020','87000000-0000-4000-8000-000000000010',
  '87000000-0000-4000-8000-000000000002','2099-01-05T08:00:00Z','2099-01-05T09:30:00Z',
  'booking_pending','pending',now() + interval '10 minutes'
);
INSERT INTO public.diagnostic_ia_booking_slots(
  booking_id,user_id,availability_slot_id,starts_at,ends_at
) VALUES
  ('87000000-0000-4000-8000-000000000020','87000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000101','2099-01-05T08:00:00Z','2099-01-05T08:30:00Z'),
  ('87000000-0000-4000-8000-000000000020','87000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000102','2099-01-05T08:30:00Z','2099-01-05T09:00:00Z'),
  ('87000000-0000-4000-8000-000000000020','87000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000103','2099-01-05T09:00:00Z','2099-01-05T09:30:00Z');

SELECT is((SELECT count(*)::integer FROM public.diagnostic_ia_booking_slots
  WHERE booking_id = '87000000-0000-4000-8000-000000000020' AND released_at IS NULL), 3,
  'La réservation conserve exactement trois demi-heures actives');
SELECT is((SELECT count(*)::integer FROM public.purchases), (SELECT purchases FROM diagnostic_booking_lms_counts),
  'La réservation Diagnostic ne crée aucun purchase');
SELECT is((SELECT count(*)::integer FROM public.course_access), (SELECT accesses FROM diagnostic_booking_lms_counts),
  'La réservation Diagnostic ne crée aucun course_access');

SELECT lives_ok($$
  INSERT INTO public.diagnostic_ia_bookings(
    id,order_id,user_id,starts_at,ends_at,status,google_sync_status,claim_expires_at
  ) VALUES (
    '87000000-0000-4000-8000-000000000022','87000000-0000-4000-8000-000000000014',
    '87000000-0000-4000-8000-000000000002','2099-01-10T08:00:00Z','2099-01-10T09:30:00Z',
    'booking_pending','pending',now() + interval '15 minutes'
  )
$$, 'Un claim initial de 15 minutes est accepté');
INSERT INTO public.diagnostic_ia_booking_slots(
  booking_id,user_id,availability_slot_id,starts_at,ends_at
) VALUES
  ('87000000-0000-4000-8000-000000000022','87000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000131','2099-01-10T08:00:00Z','2099-01-10T08:30:00Z'),
  ('87000000-0000-4000-8000-000000000022','87000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000132','2099-01-10T08:30:00Z','2099-01-10T09:00:00Z'),
  ('87000000-0000-4000-8000-000000000022','87000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000133','2099-01-10T09:00:00Z','2099-01-10T09:30:00Z');
SET CONSTRAINTS ALL IMMEDIATE;
SELECT lives_ok($$
  UPDATE public.diagnostic_ia_bookings
  SET claim_expires_at = now() + interval '15 minutes'
  WHERE id = '87000000-0000-4000-8000-000000000022'
$$, 'Un renouvellement ultérieur de 15 minutes est accepté');
SELECT ok(
  (SELECT claim_expires_at > updated_at
    AND claim_expires_at <= updated_at + interval '15 minutes'
    FROM public.diagnostic_ia_bookings
    WHERE id = '87000000-0000-4000-8000-000000000022'),
  'Le trigger updated_at borne le renouvellement à 15 minutes'
);
SELECT throws_ok($$
  UPDATE public.diagnostic_ia_bookings
  SET claim_expires_at = now() + interval '15 minutes 1 second'
  WHERE id = '87000000-0000-4000-8000-000000000022'
$$, '23514', NULL, 'Un claim supérieur à 15 minutes est refusé');
SELECT throws_ok($$
  INSERT INTO public.diagnostic_ia_bookings(
    id,order_id,user_id,starts_at,ends_at,status,google_sync_status,claim_expires_at,booked_at
  ) VALUES (
    '87000000-0000-4000-8000-000000000023','87000000-0000-4000-8000-000000000015',
    '87000000-0000-4000-8000-000000000002','2099-01-11T08:00:00Z','2099-01-11T09:30:00Z',
    'booked','pending',now() + interval '1 minute',now()
  )
$$, '23514', NULL, 'Un booking non pending avec claim est refusé');

SELECT lives_ok($$
  UPDATE public.diagnostic_ia_bookings
  SET google_sync_status = 'synced',
      google_meet_status = 'created',
      google_calendar_id = 'diagnostic@example.test',
      google_event_id = repeat('a', 1024),
      google_meet_url = 'https://meet.google.com/abc-defg-hij'
  WHERE id = '87000000-0000-4000-8000-000000000020'
$$, 'Un identifiant Google valide de 1024 caractères passe la contrainte corrigée');
SELECT is(
  (SELECT char_length(google_event_id)::integer
    FROM public.diagnostic_ia_bookings
    WHERE id = '87000000-0000-4000-8000-000000000020'
  ),
  1024,
  'La borne maximale Google Event ID reste 1024 caractères'
);

SELECT throws_ok($$
  INSERT INTO public.diagnostic_ia_bookings(
    order_id,user_id,starts_at,ends_at,status,google_sync_status,claim_expires_at
  ) VALUES (
    '87000000-0000-4000-8000-000000000011','87000000-0000-4000-8000-000000000003',
    '2099-01-05T10:00:00Z','2099-01-05T11:30:00Z','booking_pending','pending',now() + interval '10 minutes'
  )
$$, '23505', NULL, 'Un seul Diagnostic actif est permis par jour Europe/Paris');

SELECT throws_ok($$
  INSERT INTO public.diagnostic_ia_bookings(
    order_id,user_id,starts_at,ends_at,status,google_sync_status,claim_expires_at
  ) VALUES (
    '87000000-0000-4000-8000-000000000011','87000000-0000-4000-8000-000000000003',
    '2099-01-06T20:00:00Z','2099-01-06T21:30:00Z','booking_pending','pending',now() + interval '10 minutes'
  )
$$, '23514', NULL, 'Une réservation finissant après 21 h à Paris est refusée');

SELECT throws_ok($$
  INSERT INTO public.diagnostic_ia_bookings(
    order_id,user_id,starts_at,ends_at,status,google_sync_status,claim_expires_at
  ) VALUES (
    '87000000-0000-4000-8000-000000000011','87000000-0000-4000-8000-000000000003',
    '2099-01-07T10:00:00Z','2099-01-07T11:30:00Z','booking_pending','pending',now() + interval '10 minutes'
  )
$$, '23514', 'Une réservation Diagnostic IA exige trois demi-heures contiguës et cohérentes.',
  'Une réservation sans ses trois demi-heures est refusée à la fin de la transaction');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','87000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*)::integer FROM public.diagnostic_ia_bookings
  WHERE id = '87000000-0000-4000-8000-000000000020'), 1,
  'Le propriétaire lit sa réservation');
SELECT set_config('request.jwt.claim.sub','87000000-0000-4000-8000-000000000003',true);
SELECT is((SELECT count(*)::integer FROM public.diagnostic_ia_bookings
  WHERE id = '87000000-0000-4000-8000-000000000020'), 0,
  'Un autre client ne lit pas la réservation');
SELECT set_config('request.jwt.claim.sub','87000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT count(*)::integer FROM public.diagnostic_ia_bookings
  WHERE id = '87000000-0000-4000-8000-000000000020'), 1,
  'L administrateur strict lit la réservation');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
