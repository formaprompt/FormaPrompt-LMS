BEGIN;
SELECT plan(78);

SELECT has_table('public', 'stripe_payment_transactions', 'Le registre des transactions existe');
SELECT has_table('public', 'stripe_webhook_events', 'Le journal des webhooks existe');
SELECT has_table('public', 'stripe_refunds', 'Le registre des remboursements existe');
SELECT has_table('public', 'stripe_disputes', 'Le registre des litiges existe');
SELECT has_table('public', 'stripe_reconciliation_cases', 'Le registre de rapprochement existe');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.stripe_payment_transactions'::regclass), 'RLS transactions active');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.stripe_webhook_events'::regclass), 'RLS événements active');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.stripe_refunds'::regclass), 'RLS remboursements active');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.stripe_disputes'::regclass), 'RLS litiges active');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.stripe_reconciliation_cases'::regclass), 'RLS rapprochements active');
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid='public.stripe_payment_transactions'::regclass), 'RLS transactions forcée');
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid='public.stripe_webhook_events'::regclass), 'RLS événements forcée');
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid='public.stripe_refunds'::regclass), 'RLS remboursements forcée');
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid='public.stripe_disputes'::regclass), 'RLS litiges forcée');
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid='public.stripe_reconciliation_cases'::regclass), 'RLS rapprochements forcée');
SELECT is((SELECT count(*)::integer FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('stripe_access','payment_access','refund_access')), 0, 'Aucune source de droits parallèle');
SELECT function_privs_are('public', 'process_stripe_post_payment_event', ARRAY['jsonb'], 'service_role', ARRAY['EXECUTE'], 'Le traitement transactionnel est réservé au service_role');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('85000000-0000-4000-8000-000000000001','authenticated','authenticated','admin-s5@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('85000000-0000-4000-8000-000000000002','authenticated','authenticated','learner-a-s5@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('85000000-0000-4000-8000-000000000003','authenticated','authenticated','learner-b-s5@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('85000000-0000-4000-8000-000000000004','authenticated','authenticated','learner-c-s5@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('85000000-0000-4000-8000-000000000005','authenticated','authenticated','learner-d-s5@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('85000000-0000-4000-8000-000000000006','authenticated','authenticated','learner-e-s5@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now());
INSERT INTO public.profiles (id,email,role) VALUES
  ('85000000-0000-4000-8000-000000000001','admin-s5@example.test','admin'),
  ('85000000-0000-4000-8000-000000000002','learner-a-s5@example.test','user'),
  ('85000000-0000-4000-8000-000000000003','learner-b-s5@example.test','user'),
  ('85000000-0000-4000-8000-000000000004','learner-c-s5@example.test','user'),
  ('85000000-0000-4000-8000-000000000005','learner-d-s5@example.test','user'),
  ('85000000-0000-4000-8000-000000000006','learner-e-s5@example.test','user')
ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, role=EXCLUDED.role;

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_initial','event_type','checkout.session.completed','object_id','cs_test_s5_initial',
    'livemode',false,'created_at','2026-08-22T10:00:00Z','payload_sha256',repeat('a',64),
    'stripe_checkout_session_id','cs_test_s5_initial','stripe_payment_intent_id','pi_s5_initial',
    'user_id','85000000-0000-4000-8000-000000000002','course_id','formation-ia-act',
    'payment_type','course','activation_policy','immediate_after_payment','validation_status','validated',
    'amount_total',18700,'currency','eur'
  ))
$$, 'Le paiement initial est traité atomiquement');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.purchases WHERE user_id='85000000-0000-4000-8000-000000000002' AND course_id='formation-ia-act'), 1, 'Une commande métier est créée');
SELECT is((SELECT status FROM public.stripe_payment_transactions WHERE stripe_payment_intent_id='pi_s5_initial'), 'paid', 'La transaction initiale est payée');
SELECT is((SELECT status FROM public.course_access WHERE user_id='85000000-0000-4000-8000-000000000002' AND course_id='formation-ia-act'), 'active', 'Le droit immédiat est actif');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_initial','event_type','checkout.session.completed','object_id','cs_test_s5_initial',
    'livemode',false,'created_at','2026-08-22T10:00:00Z','payload_sha256',repeat('a',64),
    'stripe_checkout_session_id','cs_test_s5_initial','stripe_payment_intent_id','pi_s5_initial',
    'user_id','85000000-0000-4000-8000-000000000002','course_id','formation-ia-act',
    'payment_type','course','activation_policy','immediate_after_payment','validation_status','validated',
    'amount_total',18700,'currency','eur'
  ))
$$, 'La relivraison du même événement retourne sans erreur');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.stripe_webhook_events WHERE event_id='evt_s5_initial'), 1, 'L événement dupliqué reste unique');
SELECT is((SELECT count(*)::integer FROM public.stripe_payment_transactions WHERE stripe_payment_intent_id='pi_s5_initial'), 1, 'La relivraison ne duplique pas la transaction');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_duplicate','event_type','checkout.session.completed','object_id','cs_test_s5_duplicate',
    'livemode',false,'created_at','2026-08-22T10:05:00Z','payload_sha256',repeat('b',64),
    'stripe_checkout_session_id','cs_test_s5_duplicate','stripe_payment_intent_id','pi_s5_duplicate',
    'user_id','85000000-0000-4000-8000-000000000002','course_id','formation-ia-act',
    'payment_type','course','activation_policy','immediate_after_payment','validation_status','validated',
    'amount_total',18700,'currency','eur'
  ))
$$, 'Un second paiement réel est conservé');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.stripe_payment_transactions WHERE user_id='85000000-0000-4000-8000-000000000002' AND course_id='formation-ia-act'), 2, 'Les deux preuves financières sont conservées');
SELECT is((SELECT count(*)::integer FROM public.purchases WHERE user_id='85000000-0000-4000-8000-000000000002' AND course_id='formation-ia-act'), 1, 'La commande métier reste unique');
SELECT is((SELECT count(*)::integer FROM public.course_access WHERE user_id='85000000-0000-4000-8000-000000000002' AND course_id='formation-ia-act'), 1, 'Le droit reste unique');
SELECT is((SELECT count(*)::integer FROM public.stripe_reconciliation_cases WHERE case_type='duplicate_payment'), 1, 'Le doublon ouvre un cas critique');
SELECT is((SELECT stripe_checkout_session_id FROM public.purchases WHERE user_id='85000000-0000-4000-8000-000000000002' AND course_id='formation-ia-act'), 'cs_test_s5_initial', 'La preuve du premier paiement n est pas écrasée');

INSERT INTO public.course_booking_requests (
  id, user_id, course_id, delivery_mode, schedule_format, city, postal_code,
  status, distance_status, travel_fee_amount, travel_fee_status
) VALUES (
  '85000000-0000-4000-8000-000000000030',
  '85000000-0000-4000-8000-000000000003',
  'formation-ia-act', 'in_person', 'two_2h', 'Metz', '57000',
  'awaiting_travel_payment', 'approved', 3000, 'pending'
);
SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_travel_fee','event_type','checkout.session.completed','object_id','cs_test_s5_travel_fee',
    'livemode',false,'created_at','2026-08-22T10:07:00Z','payload_sha256',repeat('b',64),
    'stripe_checkout_session_id','cs_test_s5_travel_fee','stripe_payment_intent_id','pi_s5_travel_fee',
    'user_id','85000000-0000-4000-8000-000000000003','booking_request_id','85000000-0000-4000-8000-000000000030',
    'payment_type','in_person_travel_fee','amount_total',3000,'currency','eur'
  ))
$$, 'Le paiement des frais de déplacement est conservé');
RESET ROLE;
SELECT is((SELECT travel_fee_status FROM public.course_booking_requests WHERE id='85000000-0000-4000-8000-000000000030'), 'paid', 'Les frais de déplacement deviennent payés');
SELECT is((SELECT status FROM public.stripe_payment_transactions WHERE stripe_payment_intent_id='pi_s5_travel_fee'), 'paid', 'La transaction de déplacement est payée');
SELECT is((SELECT count(*)::integer FROM public.course_access WHERE user_id='85000000-0000-4000-8000-000000000003' AND course_id='formation-ia-act'), 0, 'Les frais de déplacement ne créent aucun droit');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_failed','event_type','payment_intent.payment_failed','object_id','pi_s5_failed',
    'livemode',false,'created_at','2026-08-22T10:10:00Z','payload_sha256',repeat('c',64),
    'stripe_payment_intent_id','pi_s5_failed','user_id','85000000-0000-4000-8000-000000000003',
    'course_id','formation-ia','payment_type','course','amount_total',49700,'currency','eur','status','requires_payment_method'
  ))
$$, 'Un échec de paiement est enregistré');
RESET ROLE;
SELECT is((SELECT status FROM public.stripe_payment_transactions WHERE stripe_payment_intent_id='pi_s5_failed'), 'failed', 'La tentative est marquée échouée');
SELECT is((SELECT count(*)::integer FROM public.course_access WHERE user_id='85000000-0000-4000-8000-000000000003'), 0, 'Un échec ne crée aucun droit');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_expired','event_type','checkout.session.expired','object_id','cs_test_s5_expired',
    'livemode',false,'created_at','2026-08-22T10:12:00Z','payload_sha256',repeat('d',64),
    'stripe_checkout_session_id','cs_test_s5_expired','user_id','85000000-0000-4000-8000-000000000003',
    'course_id','formation-prompt-level-1','payment_type','course','amount_total',34300,'currency','eur'
  ))
$$, 'Un Checkout expiré est enregistré');
RESET ROLE;
SELECT is((SELECT status FROM public.stripe_payment_transactions WHERE stripe_checkout_session_id='cs_test_s5_expired'), 'expired', 'La tentative expirée reste sans droit');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_refund_partial','event_type','refund.created','object_id','re_s5_partial',
    'livemode',false,'created_at','2026-08-22T10:20:00Z','payload_sha256',repeat('e',64),
    'stripe_payment_intent_id','pi_s5_initial','status','succeeded','amount',9000,'currency','eur'
  ))
$$, 'Le remboursement partiel est traité');
RESET ROLE;
SELECT is((SELECT status FROM public.stripe_refunds WHERE stripe_refund_id='re_s5_partial'), 'succeeded', 'Le remboursement est conservé');
SELECT is((SELECT status FROM public.stripe_payment_transactions WHERE stripe_payment_intent_id='pi_s5_initial'), 'partially_refunded', 'La transaction devient partiellement remboursée');
SELECT is((SELECT status FROM public.course_access WHERE user_id='85000000-0000-4000-8000-000000000002' AND course_id='formation-ia-act'), 'active', 'Le remboursement partiel ne retire pas le droit');
SELECT is((SELECT count(*)::integer FROM public.stripe_reconciliation_cases WHERE case_type='partial_refund'), 1, 'Le remboursement partiel ouvre une revue');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_refund_newer','event_type','refund.updated','object_id','re_s5_partial',
    'livemode',false,'created_at','2026-08-22T10:25:00Z','payload_sha256',repeat('f',64),
    'stripe_payment_intent_id','pi_s5_initial','status','succeeded','amount',9000,'currency','eur'
  ))
$$, 'Une mise à jour récente du remboursement est acceptée');
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_refund_older','event_type','refund.created','object_id','re_s5_partial',
    'livemode',false,'created_at','2026-08-22T10:19:00Z','payload_sha256',repeat('1',64),
    'stripe_payment_intent_id','pi_s5_initial','status','pending','amount',9000,'currency','eur'
  ))
$$, 'Un événement ancien est accepté sans restaurer l ancien état');
RESET ROLE;
SELECT is((SELECT status FROM public.stripe_refunds WHERE stripe_refund_id='re_s5_partial'), 'succeeded', 'L événement désordonné ne restaure pas pending');
SELECT is((SELECT processing_result FROM public.stripe_webhook_events WHERE event_id='evt_s5_refund_older'), 'stale', 'L événement ancien est marqué obsolète');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_refund_total','event_type','refund.created','object_id','re_s5_total',
    'livemode',false,'created_at','2026-08-22T10:30:00Z','payload_sha256',repeat('2',64),
    'stripe_payment_intent_id','pi_s5_initial','status','succeeded','amount',9700,'currency','eur'
  ))
$$, 'Le remboursement total cumulé est traité');
RESET ROLE;
SELECT is((SELECT status FROM public.stripe_payment_transactions WHERE stripe_payment_intent_id='pi_s5_initial'), 'refunded', 'La transaction devient remboursée');
SELECT is((SELECT payment_status FROM public.purchases WHERE stripe_payment_intent_id='pi_s5_initial'), 'refunded', 'La commande devient remboursée');
SELECT is((SELECT status FROM public.course_access WHERE user_id='85000000-0000-4000-8000-000000000002' AND course_id='formation-ia-act'), 'refunded', 'Le droit exact devient refunded sans suppression');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_refund_failed','event_type','refund.failed','object_id','re_s5_failed',
    'livemode',false,'created_at','2026-08-22T10:31:00Z','payload_sha256',repeat('3',64),
    'stripe_payment_intent_id','pi_s5_duplicate','status','failed','amount',18700,'currency','eur','failure_reason','declined'
  ))
$$, 'Un remboursement échoué est conservé');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.stripe_reconciliation_cases WHERE case_type='refund_failed'), 1, 'L échec de remboursement ouvre un cas');
SELECT is((SELECT status FROM public.course_access WHERE user_id='85000000-0000-4000-8000-000000000002' AND course_id='formation-ia-act'), 'refunded', 'L échec ne réactive ni ne modifie le droit');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_dispute_payment','event_type','checkout.session.completed','object_id','cs_test_s5_dispute',
    'livemode',false,'created_at','2026-08-22T11:00:00Z','payload_sha256',repeat('4',64),
    'stripe_checkout_session_id','cs_test_s5_dispute','stripe_payment_intent_id','pi_s5_dispute','stripe_charge_id','ch_s5_dispute',
    'user_id','85000000-0000-4000-8000-000000000004','course_id','formation-prompt-level-1',
    'payment_type','course','activation_policy','immediate_after_payment','validation_status','validated','amount_total',34300,'currency','eur'
  ))
$$, 'Le paiement qui sera litigieux est créé');
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_dispute_created','event_type','charge.dispute.created','object_id','dp_s5_won',
    'livemode',false,'created_at','2026-08-22T11:05:00Z','payload_sha256',repeat('5',64),
    'stripe_payment_intent_id','pi_s5_dispute','stripe_charge_id','ch_s5_dispute','status','needs_response','amount',34300,'currency','eur','reason','fraudulent'
  ))
$$, 'Le litige créé est enregistré');
RESET ROLE;
SELECT is((SELECT status FROM public.course_access WHERE user_id='85000000-0000-4000-8000-000000000004' AND course_id='formation-prompt-level-1'), 'suspended', 'Le litige suspend le droit actif');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_dispute_won','event_type','charge.dispute.closed','object_id','dp_s5_won',
    'livemode',false,'created_at','2026-08-22T11:10:00Z','payload_sha256',repeat('6',64),
    'stripe_payment_intent_id','pi_s5_dispute','stripe_charge_id','ch_s5_dispute','status','won','amount',34300,'currency','eur'
  ))
$$, 'Le litige gagné est enregistré');
RESET ROLE;
SELECT is((SELECT status FROM public.course_access WHERE user_id='85000000-0000-4000-8000-000000000004' AND course_id='formation-prompt-level-1'), 'suspended', 'Un litige gagné ne réactive jamais le droit');
SELECT is((SELECT count(*)::integer FROM public.stripe_reconciliation_cases WHERE case_type='dispute_won_review'), 1, 'Le litige gagné ouvre une revue humaine');

SET LOCAL ROLE service_role;
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_lost_payment','event_type','checkout.session.completed','object_id','cs_test_s5_lost',
    'livemode',false,'created_at','2026-08-22T11:20:00Z','payload_sha256',repeat('7',64),
    'stripe_checkout_session_id','cs_test_s5_lost','stripe_payment_intent_id','pi_s5_lost','stripe_charge_id','ch_s5_lost',
    'user_id','85000000-0000-4000-8000-000000000005','course_id','formation-ia',
    'payment_type','course','activation_policy','immediate_after_payment','validation_status','validated','amount_total',49700,'currency','eur'
  ))
$$, 'Le second paiement litigieux est créé');
SELECT lives_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_dispute_lost','event_type','charge.dispute.closed','object_id','dp_s5_lost',
    'livemode',false,'created_at','2026-08-22T11:25:00Z','payload_sha256',repeat('8',64),
    'stripe_payment_intent_id','pi_s5_lost','stripe_charge_id','ch_s5_lost','status','lost','amount',49700,'currency','eur'
  ))
$$, 'Le litige perdu est enregistré');
RESET ROLE;
SELECT is((SELECT status FROM public.course_access WHERE user_id='85000000-0000-4000-8000-000000000005' AND course_id='formation-ia'), 'revoked', 'Le litige perdu révoque le droit sans le supprimer');

SET LOCAL ROLE service_role;
SELECT throws_ok($$
  SELECT public.process_stripe_post_payment_event(jsonb_build_object(
    'event_id','evt_s5_rollback','event_type','checkout.session.completed','object_id','cs_test_s5_rollback',
    'livemode',false,'created_at','2026-08-22T11:30:00Z','payload_sha256',repeat('9',64),
    'stripe_checkout_session_id','cs_test_s5_rollback','stripe_payment_intent_id','pi_s5_rollback',
    'user_id','85000000-0000-4000-8000-000000000006','course_id','formation-ia-act',
    'payment_type','course','activation_policy','immediate_after_payment','validation_status','validated','amount_total',0,'currency','eur'
  ))
$$, 'P0001', 'Montant de paiement Stripe invalide.', 'Une erreur interrompt toute la transaction PostgreSQL');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.stripe_webhook_events WHERE event_id='evt_s5_rollback'), 0, 'Le journal est rollbacké avec la transaction');
SELECT is((SELECT count(*)::integer FROM public.stripe_payment_transactions WHERE stripe_payment_intent_id='pi_s5_rollback'), 0, 'Aucune transaction partielle ne subsiste');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','85000000-0000-4000-8000-000000000002',true);
SELECT throws_ok(
  $$SELECT public.admin_update_stripe_reconciliation_case((SELECT id FROM public.stripe_reconciliation_cases LIMIT 1),'resolved','Tentative interdite')$$,
  '42501','Action reservee au role admin.','Un apprenant ne peut pas résoudre un rapprochement'
);
RESET ROLE;

-- Incohérence volontaire pour valider le détecteur local, sans passer par le webhook.
INSERT INTO public.stripe_webhook_events(event_id,event_type,stripe_object_id,livemode,stripe_created_at)
VALUES('evt_s5_local_inconsistent','legacy_import','pi_s5_local_inconsistent',false,'2026-08-22T11:40:00Z');
INSERT INTO public.purchases(id,user_id,course_id,stripe_checkout_session_id,stripe_payment_intent_id,stripe_event_id,amount_total,currency,payment_status,purchased_at)
VALUES('85000000-0000-4000-8000-000000000020','85000000-0000-4000-8000-000000000006','formation-prompt-level-1','cs_test_s5_local','pi_s5_local_inconsistent','evt_s5_local_inconsistent',34300,'eur','refunded','2026-08-22T11:40:00Z');
INSERT INTO public.stripe_payment_transactions(id,purchase_id,user_id,course_id,stripe_checkout_session_id,stripe_payment_intent_id,payment_type,status,amount_total,amount_refunded,currency,activation_policy,last_event_id,last_event_created_at)
VALUES('85000000-0000-4000-8000-000000000021','85000000-0000-4000-8000-000000000020','85000000-0000-4000-8000-000000000006','formation-prompt-level-1','cs_test_s5_local','pi_s5_local_inconsistent','course','refunded',34300,34300,'eur','immediate_after_payment','evt_s5_local_inconsistent','2026-08-22T11:40:00Z');
INSERT INTO public.course_access(id,user_id,course_id,status,access_source,purchase_id,expires_at)
VALUES('85000000-0000-4000-8000-000000000022','85000000-0000-4000-8000-000000000006','formation-prompt-level-1','active','stripe','85000000-0000-4000-8000-000000000020',NULL);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','85000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$SELECT public.admin_run_stripe_local_reconciliation()$$, 'L administrateur lance le rapprochement local');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.stripe_reconciliation_cases WHERE case_type='active_after_total_refund' AND transaction_id='85000000-0000-4000-8000-000000000021'), 1, 'Le droit actif après remboursement total est détecté');
SELECT is((SELECT status FROM public.course_access WHERE id='85000000-0000-4000-8000-000000000022'), 'active', 'La réconciliation détecte sans modifier automatiquement le droit');
SELECT ok((SELECT count(*) FROM public.audit_log WHERE target_type LIKE 'stripe%') > 0, 'Les traitements Stripe alimentent le journal d audit');
SELECT is((SELECT count(*)::integer FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('funding_access','opco_access','purchase_access','stripe_access')), 0, 'course_access reste l unique source de droits');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','85000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*)::integer FROM public.stripe_payment_transactions), 0, 'Un apprenant ne voit aucune transaction existante');
SELECT is((SELECT count(*)::integer FROM public.stripe_webhook_events), 0, 'Un apprenant ne voit aucun événement existant');
SELECT is((SELECT count(*)::integer FROM public.stripe_refunds), 0, 'Un apprenant ne voit aucun remboursement existant');
SELECT is((SELECT count(*)::integer FROM public.stripe_disputes), 0, 'Un apprenant ne voit aucun litige existant');
SELECT is((SELECT count(*)::integer FROM public.stripe_reconciliation_cases), 0, 'Un apprenant ne voit aucun rapprochement existant');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
