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
  ('87000000-0000-4000-8000-000000000103','2099-01-05T09:00:00Z','2099-01-05T09:30:00Z',ARRAY['remote'],true,true,'87000000-0000-4000-8000-000000000001');

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
SET CONSTRAINTS ALL IMMEDIATE;

SELECT is((SELECT count(*)::integer FROM public.diagnostic_ia_booking_slots WHERE released_at IS NULL), 3,
  'La réservation conserve exactement trois demi-heures actives');
SELECT is((SELECT count(*)::integer FROM public.purchases), (SELECT purchases FROM diagnostic_booking_lms_counts),
  'La réservation Diagnostic ne crée aucun purchase');
SELECT is((SELECT count(*)::integer FROM public.course_access), (SELECT accesses FROM diagnostic_booking_lms_counts),
  'La réservation Diagnostic ne crée aucun course_access');

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
SELECT is((SELECT count(*)::integer FROM public.diagnostic_ia_bookings), 1,
  'Le propriétaire lit sa réservation');
SELECT set_config('request.jwt.claim.sub','87000000-0000-4000-8000-000000000003',true);
SELECT is((SELECT count(*)::integer FROM public.diagnostic_ia_bookings), 0,
  'Un autre client ne lit pas la réservation');
SELECT set_config('request.jwt.claim.sub','87000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT count(*)::integer FROM public.diagnostic_ia_bookings), 1,
  'L administrateur strict lit la réservation');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
