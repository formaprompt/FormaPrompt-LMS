BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

SELECT has_column('public','commercial_checkout_intents','checkout_request_id','L intention conserve la tentative idempotente');
SELECT has_column('public','commercial_checkout_intents','original_amount_cents','L intention conserve le prix catalogue');
SELECT has_column('public','commercial_checkout_intents','discount_amount_cents','L intention conserve la remise');
SELECT has_column('public','commercial_checkout_intents','final_amount_cents','L intention conserve le montant final');
SELECT has_column('public','commercial_checkout_intents','promo_redemption_id','L intention reference la redemption commune');
SELECT has_column('public','commercial_checkout_intents','catalog_price_id','L intention fige le Price catalogue');
SELECT has_column('public','commercial_checkout_intents','stripe_product_id','L intention fige le produit Stripe');
SELECT has_column('public','commercial_checkout_intents','checkout_configuration_locked_at','La configuration Stripe est verrouillable');

SELECT has_function('public','prepare_course_checkout_intent',ARRAY['uuid','uuid','text','text','text','text','text','text','text','uuid','jsonb','text','text'],'La preparation idempotente existe');
SELECT has_function('public','prepare_course_promotion_checkout',ARRAY['uuid','uuid','text','text','integer','text'],'La reservation formation existe');
SELECT has_function('public','reset_course_promotion_checkout',ARRAY['uuid','uuid'],'La liberation apres echec existe');
SELECT has_function('public','process_course_stripe_event',ARRAY['jsonb'],'Le processeur atomique formation existe');
SELECT ok(
  NOT has_function_privilege('authenticated','public.prepare_course_promotion_checkout(uuid,uuid,text,text,integer,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.prepare_course_promotion_checkout(uuid,uuid,text,text,integer,text)','EXECUTE'),
  'Le navigateur ne peut jamais reserver directement'
);
SELECT function_privs_are(
  'public','process_course_stripe_event',ARRAY['jsonb'],'service_role',ARRAY['EXECUTE'],
  'Seul service_role traite paiement et promotion'
);
SELECT ok(
  pg_get_functiondef('public.prepare_course_checkout_intent(uuid,uuid,text,text,text,text,text,text,text,uuid,jsonb,text,text)'::regprocedure)
    LIKE '%course-checkout:%'
  AND pg_get_functiondef('public.prepare_course_checkout_intent(uuid,uuid,text,text,text,text,text,text,text,uuid,jsonb,text,text)'::regprocedure)
    LIKE '%pg_advisory_xact_lock%',
  'Deux intentions concurrentes du meme utilisateur et cours sont serialisees'
);

INSERT INTO auth.users(
  id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  is_super_admin,created_at,updated_at
) VALUES
  ('97000000-0000-4000-8000-000000000001','authenticated','authenticated','course-a@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('97000000-0000-4000-8000-000000000002','authenticated','authenticated','course-b@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('97000000-0000-4000-8000-000000000003','authenticated','authenticated','course-c@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now());
INSERT INTO public.profiles(id,email,role) VALUES
  ('97000000-0000-4000-8000-000000000001','course-a@example.test','user'),
  ('97000000-0000-4000-8000-000000000002','course-b@example.test','user'),
  ('97000000-0000-4000-8000-000000000003','course-c@example.test','user')
ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,role=EXCLUDED.role;

INSERT INTO public.promo_codes(id,code,discount_type,discount_value,active,max_uses,restricted_email,minimum_final_amount_cents) VALUES
  ('97000000-0000-4000-8000-000000000101','COURSE10','percent',10,true,NULL,NULL,NULL),
  ('97000000-0000-4000-8000-000000000102','COURSEFIXED','fixed_amount',2000,true,NULL,NULL,NULL),
  ('97000000-0000-4000-8000-000000000103','GLOBAL5','percent',5,true,NULL,NULL,NULL),
  ('97000000-0000-4000-8000-000000000104','OTHERCOURSE','percent',10,true,NULL,NULL,NULL),
  ('97000000-0000-4000-8000-000000000105','DIAGONLYC','percent',10,true,NULL,NULL,NULL),
  ('97000000-0000-4000-8000-000000000106','COURSEEMAIL','percent',10,true,NULL,'course-b@example.test',NULL),
  ('97000000-0000-4000-8000-000000000107','COURSEMIN','fixed_amount',5000,true,NULL,NULL,17000),
  ('97000000-0000-4000-8000-000000000108','COURSEMULTI','percent',20,true,NULL,NULL,NULL),
  ('97000000-0000-4000-8000-000000000109','COURSEQUOTA','percent',10,true,1,NULL,NULL),
  ('97000000-0000-4000-8000-000000000110','COURSEFREE','percent',100,true,NULL,NULL,NULL);
INSERT INTO public.promo_code_targets(promo_code_id,target_type,target_key) VALUES
  ('97000000-0000-4000-8000-000000000101','course','formation-ia'),
  ('97000000-0000-4000-8000-000000000102','course','formation-ia-act'),
  ('97000000-0000-4000-8000-000000000103','all','all'),
  ('97000000-0000-4000-8000-000000000104','course','formation-prompt-level-1'),
  ('97000000-0000-4000-8000-000000000105','diagnostic','diagnostic-ia-express'),
  ('97000000-0000-4000-8000-000000000106','course','formation-ia'),
  ('97000000-0000-4000-8000-000000000107','course','formation-ia-act'),
  ('97000000-0000-4000-8000-000000000108','course','formation-ia'),
  ('97000000-0000-4000-8000-000000000108','course','formation-ia-act'),
  ('97000000-0000-4000-8000-000000000109','course','formation-prompt-level-1'),
  ('97000000-0000-4000-8000-000000000110','course','formation-ia-act');

INSERT INTO public.promo_redemptions(
  promo_code_id,user_id,order_context_type,order_context_id,target_type,target_key,
  original_amount_cents,discount_amount_cents,final_amount_cents,status,reserved_at,consumed_at
) VALUES (
  '97000000-0000-4000-8000-000000000109','97000000-0000-4000-8000-000000000003',
  'commercial_checkout_intent','97000000-0000-4000-8000-000000000399',
  'course','formation-prompt-level-1',34300,3430,30870,'consumed',now(),now()
);

INSERT INTO public.commercial_checkout_intents(
  id,user_id,course_id,offer_classification,status,cgv_document_version_id,
  sales_context,access_start_choice,access_activation_policy,checkout_request_id,
  catalog_price_id,stripe_product_id
)
SELECT fixtures.id,fixtures.user_id,fixtures.course_id,'B2C_STANDARD','created',documents.id,
  'personal','immediate','immediate_after_payment',fixtures.request_id,
  fixtures.price_id,fixtures.product_id
FROM (VALUES
  ('97000000-0000-4000-8000-000000000201'::uuid,'97000000-0000-4000-8000-000000000001'::uuid,'formation-ia','97000000-0000-4000-8000-000000000301'::uuid,'price_ia','prod_ia'),
  ('97000000-0000-4000-8000-000000000202'::uuid,'97000000-0000-4000-8000-000000000002'::uuid,'formation-ia-act','97000000-0000-4000-8000-000000000302'::uuid,'price_act','prod_act'),
  ('97000000-0000-4000-8000-000000000203'::uuid,'97000000-0000-4000-8000-000000000003'::uuid,'formation-prompt-level-1','97000000-0000-4000-8000-000000000303'::uuid,'price_prompt','prod_prompt'),
  ('97000000-0000-4000-8000-000000000204'::uuid,'97000000-0000-4000-8000-000000000002'::uuid,'formation-ia-act','97000000-0000-4000-8000-000000000304'::uuid,'price_act','prod_act'),
  ('97000000-0000-4000-8000-000000000205'::uuid,'97000000-0000-4000-8000-000000000003'::uuid,'formation-ia','97000000-0000-4000-8000-000000000305'::uuid,'price_ia','prod_ia')
) AS fixtures(id,user_id,course_id,request_id,price_id,product_id)
CROSS JOIN LATERAL (
  SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26' LIMIT 1
) AS documents;

CREATE TEMP TABLE course_promotion_baseline(purchases integer,accesses integer) ON COMMIT DROP;
INSERT INTO course_promotion_baseline SELECT
  (SELECT count(*)::integer FROM public.purchases),
  (SELECT count(*)::integer FROM public.course_access);

SET LOCAL ROLE service_role;
SELECT is((SELECT final_amount_cents FROM public.prepare_course_promotion_checkout(
  '97000000-0000-4000-8000-000000000203','97000000-0000-4000-8000-000000000003',
  'course-c@example.test','formation-prompt-level-1',34300,NULL)),34300,'Sans code le prix Prompt reste 34300');
SELECT is((SELECT promo_redemption_id FROM public.prepare_course_promotion_checkout(
  '97000000-0000-4000-8000-000000000203','97000000-0000-4000-8000-000000000003',
  'course-c@example.test','formation-prompt-level-1',34300,NULL)),NULL::uuid,'Sans code aucune redemption');
SELECT is((SELECT final_amount_cents FROM public.prepare_course_promotion_checkout(
  '97000000-0000-4000-8000-000000000201','97000000-0000-4000-8000-000000000001',
  'course-a@example.test','formation-ia',49700,' course10 ')),44730,'Le pourcentage utilise le prix serveur formation IA');
SELECT is((SELECT normalized_code FROM public.prepare_course_promotion_checkout(
  '97000000-0000-4000-8000-000000000201','97000000-0000-4000-8000-000000000001',
  'course-a@example.test','formation-ia',49700,'COURSE10')),'COURSE10','Le retry identique reutilise la configuration');
SELECT is((SELECT status FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000201'),'reserved','Le checkout reserve sans consommer');
SELECT ok((SELECT reservation_expires_at >= now()+interval '34 minutes' FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000201'),'La reservation couvre 35 minutes');
SELECT throws_ok(
  $$SELECT * FROM public.prepare_course_promotion_checkout('97000000-0000-4000-8000-000000000201','97000000-0000-4000-8000-000000000001','course-a@example.test','formation-ia',49700,'GLOBAL5')$$,
  'P0001','Ce code n''est pas valide ou n''est plus disponible.','Le code devient immuable apres verrouillage'
);
SELECT throws_ok(
  $$SELECT * FROM public.prepare_course_promotion_checkout('97000000-0000-4000-8000-000000000202','97000000-0000-4000-8000-000000000002','course-b@example.test','formation-ia-act',18700,'OTHERCOURSE')$$,
  'P0001','Ce code n''est pas valide ou n''est plus disponible.','Une autre formation est refusee'
);
SELECT throws_ok(
  $$SELECT * FROM public.prepare_course_promotion_checkout('97000000-0000-4000-8000-000000000202','97000000-0000-4000-8000-000000000002','course-b@example.test','formation-ia-act',18700,'DIAGONLYC')$$,
  'P0001','Ce code n''est pas valide ou n''est plus disponible.','Une promotion Diagnostic est refusee'
);
SELECT is((SELECT final_amount_cents FROM private.validate_promo_code('GLOBAL5','97000000-0000-4000-8000-000000000002','course-b@example.test','course','formation-ia-act',18700)),17765,'La cible globale couvre une formation');
SELECT is((SELECT final_amount_cents FROM private.validate_promo_code('COURSEFIXED','97000000-0000-4000-8000-000000000002','course-b@example.test','course','formation-ia-act',18700)),16700,'La remise fixe est en cents');
SELECT is((SELECT final_amount_cents FROM private.validate_promo_code('COURSEMULTI','97000000-0000-4000-8000-000000000002','course-b@example.test','course','formation-ia-act',18700)),14960,'Le multi-target accepte la formation ciblee');
SELECT throws_ok(
  $$SELECT * FROM private.validate_promo_code('COURSEEMAIL','97000000-0000-4000-8000-000000000001','spoof@example.test','course','formation-ia',49700)$$,
  'P0001','Ce code n''est pas valide ou n''est plus disponible.','La restriction email est serveur'
);
SELECT throws_ok(
  $$SELECT * FROM private.validate_promo_code('COURSEMIN','97000000-0000-4000-8000-000000000002','course-b@example.test','course','formation-ia-act',18700)$$,
  'P0001','Ce code n''est pas valide ou n''est plus disponible.','Le montant final minimum est respecte'
);
SELECT throws_ok(
  $$SELECT * FROM public.prepare_course_promotion_checkout('97000000-0000-4000-8000-000000000202','97000000-0000-4000-8000-000000000001','course-a@example.test','formation-ia-act',18700,'COURSEFIXED')$$,
  'P0001','Ce code n''est pas valide ou n''est plus disponible.','Un user id falsifie ne controle pas une autre intention'
);
SELECT throws_ok(
  $$SELECT * FROM public.prepare_course_promotion_checkout('97000000-0000-4000-8000-000000000202','97000000-0000-4000-8000-000000000002','course-b@example.test','formation-ia-act',18700,'COURSEFREE')$$,
  'P0001','Ce code n''est pas valide ou n''est plus disponible.','Le checkout formations refuse proprement un total nul'
);
SELECT is(
  (SELECT count(*)::integer FROM public.promo_redemptions WHERE promo_code_id='97000000-0000-4000-8000-000000000110'),
  0,
  'Le refus du total nul ne laisse aucune reservation de quota'
);
SELECT throws_ok(
  $$SELECT * FROM private.validate_promo_code('COURSEQUOTA','97000000-0000-4000-8000-000000000003','course-c@example.test','course','formation-prompt-level-1',34300)$$,
  'P0001','Ce code n''est pas valide ou n''est plus disponible.','Le quota global consomme est applique aux formations'
);

SELECT is((SELECT count(*)::integer FROM public.purchases),(SELECT purchases FROM course_promotion_baseline),'Aucun purchase avant paiement confirme');
SELECT is((SELECT count(*)::integer FROM public.course_access),(SELECT accesses FROM course_promotion_baseline),'Aucun droit avant paiement confirme');

SELECT lives_ok($$SELECT public.process_course_stripe_event(jsonb_build_object(
  'event_id','evt_course_retryable','event_type','payment_intent.payment_failed','created_at',now(),
  'object_id','pi_course_retryable','livemode',false,'user_id','97000000-0000-4000-8000-000000000001',
  'course_id','formation-ia','checkout_intent_id','97000000-0000-4000-8000-000000000201',
  'payment_type','course','amount_total',44730,'currency','eur','validation_status','validated'
))$$,'Un echec de carte retentable est journalise sans terminer le checkout');
SELECT is((SELECT status FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000201'),'reserved','Payment failed retentable ne libere pas la promotion');
SELECT is((SELECT status FROM public.commercial_checkout_intents WHERE id='97000000-0000-4000-8000-000000000201'),'created','Payment failed retentable ne ferme pas l intention');

SELECT is((SELECT final_amount_cents FROM public.prepare_course_promotion_checkout(
  '97000000-0000-4000-8000-000000000204','97000000-0000-4000-8000-000000000002',
  'course-b@example.test','formation-ia-act',18700,'COURSEFIXED')),16700,'Une seconde intention fige une remise fixe');
SELECT throws_ok($$SELECT public.process_course_stripe_event(jsonb_build_object(
  'event_id','evt_course_bad_amount','event_type','checkout.session.completed','created_at',now(),
  'object_id','cs_course_bad','stripe_checkout_session_id','cs_course_bad','stripe_payment_intent_id','pi_course_bad',
  'livemode',false,'user_id','97000000-0000-4000-8000-000000000002','course_id','formation-ia-act',
  'checkout_intent_id','97000000-0000-4000-8000-000000000204','payment_type','course',
  'activation_policy','immediate_after_payment','amount_total',18700,'currency','eur','validation_status','validated'
))$$,'P0001','Intention de paiement formation inconnue ou incoherente.','Un mauvais montant interrompt le traitement');
SELECT throws_ok($$SELECT public.process_course_stripe_event(jsonb_build_object(
  'event_id','evt_course_bad_currency','event_type','checkout.session.completed','created_at',now(),
  'object_id','cs_course_bad','stripe_checkout_session_id','cs_course_bad','stripe_payment_intent_id','pi_course_bad',
  'livemode',false,'user_id','97000000-0000-4000-8000-000000000002','course_id','formation-ia-act',
  'checkout_intent_id','97000000-0000-4000-8000-000000000204','payment_type','course',
  'activation_policy','immediate_after_payment','amount_total',16700,'currency','usd','validation_status','validated'
))$$,'P0001','Intention de paiement formation inconnue ou incoherente.','Une mauvaise devise interrompt le traitement');
SELECT lives_ok($$SELECT public.process_course_stripe_event(jsonb_build_object(
  'event_id','evt_course_expired','event_type','checkout.session.expired','created_at',now(),
  'object_id','cs_course_expired','stripe_checkout_session_id','cs_course_expired','stripe_payment_intent_id','pi_course_expired',
  'livemode',false,'user_id','97000000-0000-4000-8000-000000000002','course_id','formation-ia-act',
  'checkout_intent_id','97000000-0000-4000-8000-000000000204','payment_type','course',
  'activation_policy','immediate_after_payment','amount_total',16700,'currency','eur','validation_status','validated'
))$$,'Une Checkout expiree est terminale et idempotente');
SELECT is((SELECT status FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000204'),'released','L expiration libere la promotion reservee');
SELECT is((SELECT count(*)::integer FROM public.course_access WHERE user_id='97000000-0000-4000-8000-000000000002' AND course_id='formation-ia-act'),0,'Une expiration ne cree aucun droit');

SELECT lives_ok($$SELECT public.process_course_stripe_event(jsonb_build_object(
  'event_id','evt_course_paid','event_type','checkout.session.completed','created_at',now(),
  'object_id','cs_course_paid','stripe_checkout_session_id','cs_course_paid','stripe_payment_intent_id','pi_course_paid',
  'livemode',false,'user_id','97000000-0000-4000-8000-000000000001','course_id','formation-ia',
  'checkout_intent_id','97000000-0000-4000-8000-000000000201','payment_type','course',
  'activation_policy','immediate_after_payment','amount_total',44730,'currency','eur','validation_status','validated'
))$$,'Le paiement confirme traite promotion et workflow historique dans une transaction');
SELECT is((SELECT status FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000201'),'consumed','Le paiement confirme consomme la promotion');
SELECT is((SELECT count(*)::integer FROM public.purchases WHERE user_id='97000000-0000-4000-8000-000000000001' AND course_id='formation-ia'),1,'Le workflow historique cree un purchase unique');
SELECT is((SELECT count(*)::integer FROM public.course_access WHERE user_id='97000000-0000-4000-8000-000000000001' AND course_id='formation-ia'),1,'Le workflow historique seul produit le droit apres paiement');
SELECT lives_ok($$SELECT public.process_course_stripe_event(jsonb_build_object(
  'event_id','evt_course_paid','event_type','checkout.session.completed','created_at',now(),
  'object_id','cs_course_paid','stripe_checkout_session_id','cs_course_paid','stripe_payment_intent_id','pi_course_paid',
  'livemode',false,'user_id','97000000-0000-4000-8000-000000000001','course_id','formation-ia',
  'checkout_intent_id','97000000-0000-4000-8000-000000000201','payment_type','course',
  'activation_policy','immediate_after_payment','amount_total',44730,'currency','eur','validation_status','validated'
))$$,'Le double webhook est idempotent');
SELECT is((SELECT count(*)::integer FROM public.purchases WHERE user_id='97000000-0000-4000-8000-000000000001' AND course_id='formation-ia'),1,'Le double webhook ne duplique pas purchase');
SELECT is((SELECT count(*)::integer FROM public.course_access WHERE user_id='97000000-0000-4000-8000-000000000001' AND course_id='formation-ia'),1,'Le double webhook ne duplique pas le droit');

SELECT ok(public.reset_course_promotion_checkout(
  '97000000-0000-4000-8000-000000000205','97000000-0000-4000-8000-000000000003'
),'Un echec Stripe definitif remet une intention non envoyee dans un etat terminal');
SELECT is((SELECT status FROM public.commercial_checkout_intents WHERE id='97000000-0000-4000-8000-000000000205'),'failed','L intention definitivement echouee est marquee failed');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
