BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

SELECT has_column('public', 'diagnostic_ia_orders', 'original_amount_cents',
  'La commande conserve le prix catalogue');
SELECT has_column('public', 'diagnostic_ia_orders', 'discount_amount_cents',
  'La commande conserve la remise');
SELECT has_column('public', 'diagnostic_ia_orders', 'final_amount_cents',
  'La commande conserve le montant final');
SELECT has_column('public', 'diagnostic_ia_orders', 'promo_redemption_id',
  'La commande reference la redemption commune');
SELECT function_privs_are(
  'public', 'prepare_diagnostic_promotion_checkout', ARRAY['uuid','uuid','text','text'],
  'service_role', ARRAY['EXECUTE'], 'La preparation promotionnelle est reservee au service_role'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.prepare_diagnostic_promotion_checkout(uuid,uuid,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon',
    'public.prepare_diagnostic_promotion_checkout(uuid,uuid,text,text)', 'EXECUTE'),
  'Le navigateur ne peut pas reserver directement une promotion'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('98000000-0000-4000-8000-000000000001','authenticated','authenticated','promo-diag-a@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('98000000-0000-4000-8000-000000000002','authenticated','authenticated','promo-diag-b@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('98000000-0000-4000-8000-000000000003','authenticated','authenticated','promo-diag-c@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('98000000-0000-4000-8000-000000000004','authenticated','authenticated','promo-diag-d@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now());

INSERT INTO public.profiles(id,email,role) VALUES
  ('98000000-0000-4000-8000-000000000001','promo-diag-a@example.test','user'),
  ('98000000-0000-4000-8000-000000000002','promo-diag-b@example.test','user'),
  ('98000000-0000-4000-8000-000000000003','promo-diag-c@example.test','user'),
  ('98000000-0000-4000-8000-000000000004','promo-diag-d@example.test','user')
ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email, role=EXCLUDED.role;

INSERT INTO public.promo_codes(
  id,code,discount_type,discount_value,active,max_uses,restricted_email,
  minimum_final_amount_cents
) VALUES
  ('98000000-0000-4000-8000-000000000101','DIAG10','percent',10,true,NULL,NULL,NULL),
  ('98000000-0000-4000-8000-000000000102','DIAG20FIXED','fixed_amount',2000,true,NULL,NULL,NULL),
  ('98000000-0000-4000-8000-000000000103','DIAGINACTIVE','percent',10,false,NULL,NULL,NULL),
  ('98000000-0000-4000-8000-000000000104','DIAGEXPIRED','percent',10,true,NULL,NULL,NULL),
  ('98000000-0000-4000-8000-000000000105','COURSEONLY','percent',10,true,NULL,NULL,NULL),
  ('98000000-0000-4000-8000-000000000106','EMAILONLY','percent',10,true,NULL,'promo-diag-b@example.test',NULL),
  ('98000000-0000-4000-8000-000000000107','DIAGQUOTA','percent',10,true,1,NULL,NULL),
  ('98000000-0000-4000-8000-000000000108','DIAGMIN','fixed_amount',2000,true,NULL,NULL,14000);

UPDATE public.promo_codes SET ends_at=now()-interval '1 minute'
WHERE id='98000000-0000-4000-8000-000000000104';

INSERT INTO public.promo_code_targets(promo_code_id,target_type,target_key) VALUES
  ('98000000-0000-4000-8000-000000000101','diagnostic','diagnostic-ia-express'),
  ('98000000-0000-4000-8000-000000000102','diagnostic','diagnostic-ia-express'),
  ('98000000-0000-4000-8000-000000000103','diagnostic','diagnostic-ia-express'),
  ('98000000-0000-4000-8000-000000000104','diagnostic','diagnostic-ia-express'),
  ('98000000-0000-4000-8000-000000000105','course','formation-ia'),
  ('98000000-0000-4000-8000-000000000106','diagnostic','diagnostic-ia-express'),
  ('98000000-0000-4000-8000-000000000107','diagnostic','diagnostic-ia-express'),
  ('98000000-0000-4000-8000-000000000108','diagnostic','diagnostic-ia-express');

INSERT INTO public.diagnostic_ia_orders(
  id,user_id,customer_email,sales_context,cgv_document_version_id,cgv_acceptance_statement_version_id
) VALUES
  ('98000000-0000-4000-8000-000000000201','98000000-0000-4000-8000-000000000001',
    'promo-diag-a@example.test','personal',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26')),
  ('98000000-0000-4000-8000-000000000202','98000000-0000-4000-8000-000000000002',
    'promo-diag-b@example.test','professional',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2B-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26')),
  ('98000000-0000-4000-8000-000000000203','98000000-0000-4000-8000-000000000003',
    'promo-diag-c@example.test','personal',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26')),
  ('98000000-0000-4000-8000-000000000204','98000000-0000-4000-8000-000000000004',
    'promo-diag-d@example.test','personal',
    (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
    (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'));

CREATE TEMP TABLE diagnostic_promotion_counts(purchases integer, accesses integer) ON COMMIT DROP;
INSERT INTO diagnostic_promotion_counts
SELECT (SELECT count(*)::integer FROM public.purchases),
       (SELECT count(*)::integer FROM public.course_access);

INSERT INTO public.promo_redemptions(
  promo_code_id,user_id,order_context_type,order_context_id,target_type,target_key,
  original_amount_cents,discount_amount_cents,final_amount_cents,status,
  reserved_at,consumed_at
) VALUES (
  '98000000-0000-4000-8000-000000000107','98000000-0000-4000-8000-000000000001',
  'diagnostic_order','98000000-0000-4000-8000-000000000299','diagnostic','diagnostic-ia-express',
  14900,1490,13410,'consumed',now(),now()
);

SET LOCAL ROLE service_role;
SELECT is((SELECT final_amount_cents FROM public.prepare_diagnostic_promotion_checkout(
  '98000000-0000-4000-8000-000000000204','98000000-0000-4000-8000-000000000004',
  'promo-diag-d@example.test',NULL)),14900,'Sans code le prix reste 14900 centimes');
SELECT is((SELECT promo_redemption_id FROM public.prepare_diagnostic_promotion_checkout(
  '98000000-0000-4000-8000-000000000204','98000000-0000-4000-8000-000000000004',
  'promo-diag-d@example.test',NULL)),NULL::uuid,'Sans code aucune redemption n est reservee');
SELECT ok(public.reset_diagnostic_promotion_checkout(
  '98000000-0000-4000-8000-000000000204','98000000-0000-4000-8000-000000000004'),
  'La configuration sans promotion peut etre reprise apres un echec Stripe');

SELECT is((SELECT final_amount_cents FROM public.prepare_diagnostic_promotion_checkout(
  '98000000-0000-4000-8000-000000000201','98000000-0000-4000-8000-000000000001',
  'promo-diag-a@example.test',' diag10 ')),13410,'La remise de dix pour cent vient du moteur commun');
SELECT is((SELECT status FROM public.promo_redemptions
  WHERE order_context_id='98000000-0000-4000-8000-000000000201'),'reserved',
  'La creation du checkout reserve sans consommer');
SELECT is((SELECT count(*)::integer FROM public.promo_redemptions
  WHERE order_context_id='98000000-0000-4000-8000-000000000201'),1,
  'Le double appel conserve une seule redemption');
SELECT is((SELECT promo_redemption_id FROM public.prepare_diagnostic_promotion_checkout(
  '98000000-0000-4000-8000-000000000201','98000000-0000-4000-8000-000000000001',
  'promo-diag-a@example.test','DIAG10')),
  (SELECT promo_redemption_id FROM public.diagnostic_ia_orders
   WHERE id='98000000-0000-4000-8000-000000000201'),
  'Le retry retourne la meme reservation');

SELECT ok(public.reset_diagnostic_promotion_checkout(
  '98000000-0000-4000-8000-000000000201','98000000-0000-4000-8000-000000000001'),
  'Un echec Stripe definitif libere la configuration');
SELECT is((SELECT status FROM public.promo_redemptions
  WHERE order_context_id='98000000-0000-4000-8000-000000000201'),'released',
  'La liberation apres echec Stripe persiste');
SELECT is((SELECT status FROM public.diagnostic_ia_orders
  WHERE id='98000000-0000-4000-8000-000000000201'),'cancelled',
  'La commande est annulee apres liberation sans reutiliser son contexte');

INSERT INTO public.diagnostic_ia_orders(
  id,user_id,customer_email,sales_context,cgv_document_version_id,cgv_acceptance_statement_version_id
) VALUES (
  '98000000-0000-4000-8000-000000000205','98000000-0000-4000-8000-000000000001',
  'promo-diag-a@example.test','personal',
  (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
  (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26')
);

SELECT is((SELECT final_amount_cents FROM public.prepare_diagnostic_promotion_checkout(
  '98000000-0000-4000-8000-000000000205','98000000-0000-4000-8000-000000000001',
  'promo-diag-a@example.test','DIAG20FIXED')),12900,'Le montant fixe est calcule par le moteur commun');
SELECT throws_ok($$SELECT * FROM public.validate_promo_code_for_checkout(
  'DIAGINACTIVE','98000000-0000-4000-8000-000000000001','promo-diag-a@example.test',
  'diagnostic','diagnostic-ia-express',14900)$$,'P0001',
  'Ce code n''est pas valide ou n''est plus disponible.','Un code inactif est refuse generiquement');
SELECT throws_ok($$SELECT * FROM public.validate_promo_code_for_checkout(
  'UNKNOWNDIAG','98000000-0000-4000-8000-000000000001','promo-diag-a@example.test',
  'diagnostic','diagnostic-ia-express',14900)$$,'P0001',
  'Ce code n''est pas valide ou n''est plus disponible.','Un code inconnu est refuse generiquement');
SELECT throws_ok($$SELECT * FROM public.validate_promo_code_for_checkout(
  'DIAGEXPIRED','98000000-0000-4000-8000-000000000001','promo-diag-a@example.test',
  'diagnostic','diagnostic-ia-express',14900)$$,'P0001',
  'Ce code n''est pas valide ou n''est plus disponible.','Un code expire est refuse generiquement');
SELECT throws_ok($$SELECT * FROM public.validate_promo_code_for_checkout(
  'COURSEONLY','98000000-0000-4000-8000-000000000001','promo-diag-a@example.test',
  'diagnostic','diagnostic-ia-express',14900)$$,'P0001',
  'Ce code n''est pas valide ou n''est plus disponible.','Une formation n est pas applicable au Diagnostic');
SELECT throws_ok($$SELECT * FROM public.validate_promo_code_for_checkout(
  'EMAILONLY','98000000-0000-4000-8000-000000000001','promo-diag-a@example.test',
  'diagnostic','diagnostic-ia-express',14900)$$,'P0001',
  'Ce code n''est pas valide ou n''est plus disponible.','La restriction email utilise l email serveur');
SELECT throws_ok($$SELECT * FROM public.validate_promo_code_for_checkout(
  'DIAGMIN','98000000-0000-4000-8000-000000000001','promo-diag-a@example.test',
  'diagnostic','diagnostic-ia-express',14900)$$,'P0001',
  'Ce code n''est pas valide ou n''est plus disponible.','Le minimum final est applique par le moteur');
SELECT throws_ok($$SELECT * FROM public.validate_promo_code_for_checkout(
  'DIAGQUOTA','98000000-0000-4000-8000-000000000002','promo-diag-b@example.test',
  'diagnostic','diagnostic-ia-express',14900)$$,'P0001',
  'Ce code n''est pas valide ou n''est plus disponible.','Le quota atteint est refuse generiquement');

UPDATE public.diagnostic_ia_orders
SET stripe_checkout_session_id='cs_test_diag_promo_paid'
WHERE id='98000000-0000-4000-8000-000000000205';
SELECT lives_ok($$SELECT public.process_diagnostic_ia_stripe_event(jsonb_build_object(
  'event_id','evt_diag_promo_paid','event_type','checkout.session.completed',
  'object_id','cs_test_diag_promo_paid','livemode',false,'created_at','2026-08-31T10:00:00Z',
  'payload_sha256',repeat('a',64),'stripe_checkout_session_id','cs_test_diag_promo_paid',
  'stripe_payment_intent_id','pi_diag_promo_paid','diagnostic_order_id','98000000-0000-4000-8000-000000000205',
  'user_id','98000000-0000-4000-8000-000000000001','payment_type','diagnostic_ia_express',
  'validation_status','validated','amount_total',12900,'currency','eur'))$$,
  'Le paiement au montant final reserve consomme la promotion');
SELECT is((SELECT status FROM public.promo_redemptions
  WHERE id=(SELECT promo_redemption_id FROM public.diagnostic_ia_orders
    WHERE id='98000000-0000-4000-8000-000000000205')),'consumed',
  'La promotion est consommee uniquement apres le webhook');
SELECT lives_ok($$SELECT public.process_diagnostic_ia_stripe_event(jsonb_build_object(
  'event_id','evt_diag_promo_paid','event_type','checkout.session.completed',
  'object_id','cs_test_diag_promo_paid','livemode',false,'created_at','2026-08-31T10:00:00Z',
  'payload_sha256',repeat('a',64),'stripe_checkout_session_id','cs_test_diag_promo_paid',
  'stripe_payment_intent_id','pi_diag_promo_paid','diagnostic_order_id','98000000-0000-4000-8000-000000000205',
  'user_id','98000000-0000-4000-8000-000000000001','payment_type','diagnostic_ia_express',
  'validation_status','validated','amount_total',12900,'currency','eur'))$$,
  'Le double webhook reste idempotent');

SELECT is((SELECT final_amount_cents FROM public.prepare_diagnostic_promotion_checkout(
  '98000000-0000-4000-8000-000000000202','98000000-0000-4000-8000-000000000002',
  'promo-diag-b@example.test','EMAILONLY')),13410,'L email derive autorise la promotion restreinte');
UPDATE public.diagnostic_ia_orders SET stripe_checkout_session_id='cs_test_diag_promo_expired'
WHERE id='98000000-0000-4000-8000-000000000202';
SELECT lives_ok($$SELECT public.process_diagnostic_ia_stripe_event(jsonb_build_object(
  'event_id','evt_diag_promo_expired','event_type','checkout.session.expired',
  'object_id','cs_test_diag_promo_expired','livemode',false,'created_at','2026-08-31T10:05:00Z',
  'payload_sha256',repeat('b',64),'stripe_checkout_session_id','cs_test_diag_promo_expired',
  'diagnostic_order_id','98000000-0000-4000-8000-000000000202',
  'user_id','98000000-0000-4000-8000-000000000002','payment_type','diagnostic_ia_express',
  'validation_status','validated','amount_total',13410,'currency','eur'))$$,
  'L expiration Stripe libere la reservation');
SELECT is((SELECT status FROM public.promo_redemptions
  WHERE id=(SELECT promo_redemption_id FROM public.diagnostic_ia_orders
    WHERE id='98000000-0000-4000-8000-000000000202')),'released',
  'La redemption expiree reste released');
SELECT is((SELECT status FROM public.diagnostic_ia_orders
  WHERE id='98000000-0000-4000-8000-000000000202'),'cancelled',
  'La commande expiree devient cancelled');

SELECT is((SELECT final_amount_cents FROM public.prepare_diagnostic_promotion_checkout(
  '98000000-0000-4000-8000-000000000203','98000000-0000-4000-8000-000000000003',
  'promo-diag-c@example.test','DIAG10')),13410,'Une commande de controle reserve sa remise');
SELECT throws_ok($$SELECT public.process_diagnostic_ia_stripe_event(jsonb_build_object(
  'event_id','evt_diag_promo_wrong_amount','event_type','checkout.session.completed',
  'object_id','cs_test_diag_promo_wrong','livemode',false,'created_at','2026-08-31T10:10:00Z',
  'payload_sha256',repeat('c',64),'stripe_checkout_session_id','cs_test_diag_promo_wrong',
  'stripe_payment_intent_id','pi_diag_promo_wrong','diagnostic_order_id','98000000-0000-4000-8000-000000000203',
  'user_id','98000000-0000-4000-8000-000000000003','payment_type','diagnostic_ia_express',
  'validation_status','validated','amount_total',1,'currency','eur'))$$,
  'P0001','Commande Diagnostic IA inconnue ou incoherente.',
  'Un montant Stripe different du montant reserve est refuse');
SELECT is((SELECT status FROM public.promo_redemptions
  WHERE id=(SELECT promo_redemption_id FROM public.diagnostic_ia_orders
    WHERE id='98000000-0000-4000-8000-000000000203')),'reserved',
  'Un mauvais montant ne consomme pas la promotion');

INSERT INTO public.diagnostic_ia_orders(
  id,user_id,customer_email,sales_context,cgv_document_version_id,cgv_acceptance_statement_version_id
) VALUES (
  '98000000-0000-4000-8000-000000000206','98000000-0000-4000-8000-000000000004',
  'promo-diag-d@example.test','personal',
  (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
  (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26')
);
SELECT is((SELECT final_amount_cents FROM public.prepare_diagnostic_promotion_checkout(
  '98000000-0000-4000-8000-000000000206','98000000-0000-4000-8000-000000000004',
  'promo-diag-d@example.test','DIAG20FIXED')),12900,
  'Une nouvelle commande reserve une promotion avant la tentative de paiement');
SELECT cmp_ok((SELECT extract(epoch FROM (redemptions.reservation_expires_at - redemptions.reserved_at))::integer
  FROM public.promo_redemptions AS redemptions
  WHERE redemptions.order_context_id='98000000-0000-4000-8000-000000000206'),'>=',2100,
  'La reservation Diagnostic conserve au moins trente-cinq minutes');
SELECT lives_ok($$SELECT public.process_diagnostic_ia_stripe_event(jsonb_build_object(
  'event_id','evt_diag_promo_card_failed','event_type','payment_intent.payment_failed',
  'object_id','pi_diag_promo_card_failed','livemode',false,'created_at','2026-08-31T10:11:00Z',
  'payload_sha256',repeat('d',64),'stripe_payment_intent_id','pi_diag_promo_card_failed',
  'diagnostic_order_id','98000000-0000-4000-8000-000000000206',
  'user_id','98000000-0000-4000-8000-000000000004','payment_type','diagnostic_ia_express',
  'validation_status','validated','amount_total',12900,'currency','eur'))$$,
  'Un echec de carte est audite sans rendre Checkout terminal');
SELECT is((SELECT status FROM public.diagnostic_ia_orders
  WHERE id='98000000-0000-4000-8000-000000000206'),'payment_pending',
  'La commande reste payable apres un echec de PaymentIntent');
SELECT is((SELECT status FROM public.promo_redemptions
  WHERE order_context_id='98000000-0000-4000-8000-000000000206'),'reserved',
  'La promotion reste reservee pendant une nouvelle tentative de carte');
UPDATE public.diagnostic_ia_orders SET stripe_checkout_session_id='cs_test_diag_retry_paid'
WHERE id='98000000-0000-4000-8000-000000000206';
SELECT lives_ok($$SELECT public.process_diagnostic_ia_stripe_event(jsonb_build_object(
  'event_id','evt_diag_promo_retry_paid','event_type','checkout.session.completed',
  'object_id','cs_test_diag_retry_paid','livemode',false,'created_at','2026-08-31T10:12:00Z',
  'payload_sha256',repeat('e',64),'stripe_checkout_session_id','cs_test_diag_retry_paid',
  'stripe_payment_intent_id','pi_diag_promo_retry_paid',
  'diagnostic_order_id','98000000-0000-4000-8000-000000000206',
  'user_id','98000000-0000-4000-8000-000000000004','payment_type','diagnostic_ia_express',
  'validation_status','validated','amount_total',12900,'currency','eur'))$$,
  'Le retry de carte peut ensuite confirmer la meme commande');
SELECT is((SELECT status FROM public.promo_redemptions
  WHERE order_context_id='98000000-0000-4000-8000-000000000206'),'consumed',
  'La promotion est consommee par le paiement finalement confirme');
RESET ROLE;

SELECT is((SELECT count(*)::integer FROM public.purchases),
  (SELECT purchases FROM diagnostic_promotion_counts),
  'L integration promotionnelle ne cree aucun purchase');
SELECT is((SELECT count(*)::integer FROM public.course_access),
  (SELECT accesses FROM diagnostic_promotion_counts),
  'L integration promotionnelle ne modifie aucun course_access');

SELECT * FROM finish();
ROLLBACK;
