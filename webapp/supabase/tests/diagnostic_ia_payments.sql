BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

SELECT has_table('public', 'diagnostic_ia_orders', 'La table des commandes Diagnostic existe');
SELECT has_table('public', 'diagnostic_ia_consents', 'La table des preuves de consentement Diagnostic existe');
SELECT has_column('public', 'stripe_payment_transactions', 'diagnostic_order_id', 'La transaction référence la commande Diagnostic');
SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.diagnostic_ia_orders'::regclass),
  'RLS active et forcée sur les commandes Diagnostic'
);
SELECT function_privs_are(
  'public', 'process_diagnostic_ia_stripe_event', ARRAY['jsonb'], 'service_role', ARRAY['EXECUTE'],
  'Le processeur Diagnostic est réservé au service_role'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.diagnostic_ia_orders', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.diagnostic_ia_orders', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.diagnostic_ia_orders', 'DELETE'),
  'Le client ne peut pas créer ou modifier sa commande'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('86000000-0000-4000-8000-000000000001','authenticated','authenticated','admin-diagnostic@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('86000000-0000-4000-8000-000000000002','authenticated','authenticated','client-a-diagnostic@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('86000000-0000-4000-8000-000000000003','authenticated','authenticated','client-b-diagnostic@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now());

INSERT INTO public.profiles(id,email,role) VALUES
  ('86000000-0000-4000-8000-000000000001','admin-diagnostic@example.test','admin'),
  ('86000000-0000-4000-8000-000000000002','client-a-diagnostic@example.test','user'),
  ('86000000-0000-4000-8000-000000000003','client-b-diagnostic@example.test','user')
ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email, role=EXCLUDED.role;

INSERT INTO public.diagnostic_ia_orders(
  id,user_id,customer_email,sales_context,cgv_document_version_id,cgv_acceptance_statement_version_id
) VALUES
  (
    '86000000-0000-4000-8000-000000000010',
    '86000000-0000-4000-8000-000000000002',
    'client-a-diagnostic@example.test','personal',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26')
  ),
  (
    '86000000-0000-4000-8000-000000000011',
    '86000000-0000-4000-8000-000000000003',
    'client-b-diagnostic@example.test','professional',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2B-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26')
  );

INSERT INTO public.diagnostic_ia_consents(
  order_id,user_id,consent_type,legal_document_version_id,granted,source
) VALUES (
  '86000000-0000-4000-8000-000000000010',
  '86000000-0000-4000-8000-000000000002',
  'cgv_acceptance',
  (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'),
  true,'web_checkout'
);

INSERT INTO public.diagnostic_ia_consents(
  order_id,user_id,consent_type,legal_document_version_id,granted,source,
  consent_context_id,appointment_starts_at,withdrawal_period_ends_at
) VALUES
  (
    '86000000-0000-4000-8000-000000000010','86000000-0000-4000-8000-000000000002',
    'early_service_start',
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-EARLY-START-2026-08-26'),
    true,'web_booking','86000000-0000-4000-8000-000000000020',
    '2026-09-01T14:00:00Z','2026-09-09T16:00:00Z'
  ),
  (
    '86000000-0000-4000-8000-000000000010','86000000-0000-4000-8000-000000000002',
    'full_performance_withdrawal_acknowledgement',
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-FULL-PERFORMANCE-ACK-2026-08-26'),
    true,'web_booking','86000000-0000-4000-8000-000000000020',
    '2026-09-01T14:00:00Z','2026-09-09T16:00:00Z'
  );

SELECT is(
  (SELECT count(*)::integer FROM public.diagnostic_ia_consents
   WHERE order_id='86000000-0000-4000-8000-000000000010'
     AND consent_context_id='86000000-0000-4000-8000-000000000020'),
  2,
  'Les deux consentements B2C anticipes sont conserves comme deux preuves distinctes'
);

SELECT throws_ok($$
  INSERT INTO public.diagnostic_ia_consents(
    order_id,user_id,consent_type,legal_document_version_id,granted,source,
    consent_context_id,appointment_starts_at,withdrawal_period_ends_at
  ) VALUES (
    '86000000-0000-4000-8000-000000000011','86000000-0000-4000-8000-000000000003',
    'early_service_start',
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-EARLY-START-2026-08-26'),
    true,'web_booking','86000000-0000-4000-8000-000000000021',
    '2026-09-01T14:00:00Z','2026-09-09T16:00:00Z'
  )
$$, '23514', 'Le consentement de retractation anticipee est reserve au parcours B2C.',
  'Le parcours professionnel ne collecte pas un consentement B2C');

SELECT throws_ok($$
  INSERT INTO public.diagnostic_ia_orders(
    user_id,customer_email,sales_context,cgv_document_version_id,cgv_acceptance_statement_version_id
  ) VALUES (
    '86000000-0000-4000-8000-000000000002','client-a-diagnostic@example.test','personal',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26')
  )
$$, '23505', NULL,
  'Une seule commande en attente est permise par client');

CREATE TEMP TABLE diagnostic_test_counts(purchases integer, accesses integer) ON COMMIT DROP;
INSERT INTO diagnostic_test_counts
SELECT (SELECT count(*)::integer FROM public.purchases),
       (SELECT count(*)::integer FROM public.course_access);

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_diagnostic_ia_stripe_event(jsonb_build_object(
    'event_id','evt_diagnostic_paid','event_type','checkout.session.completed',
    'object_id','cs_test_diagnostic_paid','livemode',false,
    'created_at','2026-08-26T16:00:00Z','payload_sha256',repeat('a',64),
    'stripe_checkout_session_id','cs_test_diagnostic_paid',
    'stripe_payment_intent_id','pi_diagnostic_paid','stripe_customer_id','cus_diagnostic_test',
    'diagnostic_order_id','86000000-0000-4000-8000-000000000010',
    'user_id','86000000-0000-4000-8000-000000000002',
    'payment_type','diagnostic_ia_express','validation_status','validated',
    'amount_total',14900,'currency','eur'
  ))
$$, 'Le paiement Diagnostic est traité atomiquement');
RESET ROLE;

SELECT is(
  (SELECT status FROM public.diagnostic_ia_orders WHERE id='86000000-0000-4000-8000-000000000010'),
  'paid', 'La commande devient paid uniquement après le processeur serveur'
);
SELECT is(
  (SELECT payment_type FROM public.stripe_payment_transactions WHERE diagnostic_order_id='86000000-0000-4000-8000-000000000010'),
  'diagnostic_ia_express', 'La transaction est identifiée séparément'
);
SELECT is(
  (SELECT count(*)::integer FROM public.purchases),
  (SELECT purchases FROM diagnostic_test_counts),
  'Le paiement Diagnostic ne crée aucun purchase de formation'
);
SELECT is(
  (SELECT count(*)::integer FROM public.course_access),
  (SELECT accesses FROM diagnostic_test_counts),
  'Le paiement Diagnostic ne crée aucun course_access'
);

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_diagnostic_ia_stripe_event(jsonb_build_object(
    'event_id','evt_diagnostic_paid','event_type','checkout.session.completed',
    'object_id','cs_test_diagnostic_paid','livemode',false,
    'created_at','2026-08-26T16:00:00Z','payload_sha256',repeat('a',64),
    'stripe_checkout_session_id','cs_test_diagnostic_paid',
    'stripe_payment_intent_id','pi_diagnostic_paid',
    'diagnostic_order_id','86000000-0000-4000-8000-000000000010',
    'user_id','86000000-0000-4000-8000-000000000002',
    'payment_type','diagnostic_ia_express','validation_status','validated',
    'amount_total',14900,'currency','eur'
  ))
$$, 'La relivraison du webhook est acceptée sans nouvel effet');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.stripe_webhook_events WHERE event_id='evt_diagnostic_paid'), 1,
  'L événement Diagnostic rejoué reste unique');
SELECT is((SELECT count(*)::integer FROM public.stripe_payment_transactions WHERE diagnostic_order_id='86000000-0000-4000-8000-000000000010'), 1,
  'La transaction Diagnostic rejouée reste unique');

SET LOCAL ROLE service_role;
SELECT throws_ok($$
  SELECT public.process_diagnostic_ia_stripe_event(jsonb_build_object(
    'event_id','evt_diagnostic_wrong_amount','event_type','checkout.session.completed',
    'object_id','cs_test_diagnostic_wrong','livemode',false,
    'created_at','2026-08-26T16:05:00Z','payload_sha256',repeat('b',64),
    'stripe_checkout_session_id','cs_test_diagnostic_wrong',
    'stripe_payment_intent_id','pi_diagnostic_wrong',
    'diagnostic_order_id','86000000-0000-4000-8000-000000000011',
    'user_id','86000000-0000-4000-8000-000000000003',
    'payment_type','diagnostic_ia_express','validation_status','validated',
    'amount_total',1,'currency','eur'
  ))
$$, 'P0001', 'Commande Diagnostic IA inconnue ou incoherente.',
  'Le processeur refuse un montant falsifié');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.stripe_webhook_events WHERE event_id='evt_diagnostic_wrong_amount'), 0,
  'Un événement incohérent est entièrement rollbacké');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_diagnostic_refund','event_type','refund.updated',
    'object_id','re_diagnostic_refund','livemode',false,
    'created_at','2026-08-26T17:00:00Z','payload_sha256',repeat('c',64),
    'stripe_payment_intent_id','pi_diagnostic_paid','status','succeeded',
    'amount',14900,'currency','eur'
  ))
$$, 'Le remboursement utilise le registre Stripe central');
RESET ROLE;
SELECT is(
  (SELECT status FROM public.diagnostic_ia_orders WHERE id='86000000-0000-4000-8000-000000000010'),
  'refunded', 'Un remboursement total rapproche la commande Diagnostic'
);
SELECT is((SELECT count(*)::integer FROM public.course_access), (SELECT accesses FROM diagnostic_test_counts),
  'Le remboursement Diagnostic ne modifie aucun course_access');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','86000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*)::integer FROM public.diagnostic_ia_orders), 1,
  'Le propriétaire lit uniquement sa commande');
SELECT is((SELECT count(*)::integer FROM public.diagnostic_ia_consents), 3,
  'Le propriétaire lit uniquement ses preuves de consentement');
SELECT throws_ok(
  $$UPDATE public.diagnostic_ia_orders SET status='paid' WHERE id='86000000-0000-4000-8000-000000000010'$$,
  '42501', 'permission denied for table diagnostic_ia_orders',
  'Le client ne peut pas se marquer paid'
);
SELECT set_config('request.jwt.claim.sub','86000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT count(*)::integer FROM public.diagnostic_ia_orders), 2,
  'L administrateur strict lit toutes les commandes Diagnostic');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT count(*) FROM public.diagnostic_ia_orders$$,
  '42501', 'permission denied for table diagnostic_ia_orders',
  'Un visiteur anonyme ne consulte aucune commande Diagnostic'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
