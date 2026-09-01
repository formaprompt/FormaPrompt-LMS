BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

SELECT has_table('public', 'promo_codes', 'La table generique des codes promotionnels existe');
SELECT has_table('public', 'promo_code_targets', 'La table des cibles promotionnelles existe');
SELECT has_table('public', 'promo_redemptions', 'Le journal des redemptions existe');
SELECT has_column('public', 'promo_redemptions', 'reservation_expires_at', 'Une reservation a une echeance explicite');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.promo_codes'::regclass),
  'RLS active et forcee sur les codes');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.promo_redemptions'::regclass),
  'RLS active et forcee sur les redemptions');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.promo_code_targets'::regclass),
  'RLS active et forcee sur les cibles');
SELECT ok(
  NOT has_table_privilege('authenticated','public.promo_codes','INSERT,UPDATE,DELETE')
  AND NOT has_table_privilege('authenticated','public.promo_code_targets','INSERT,UPDATE,DELETE')
  AND NOT has_table_privilege('authenticated','public.promo_redemptions','INSERT,UPDATE,DELETE'),
  'Authenticated ne dispose d aucun privilege direct de mutation promotionnelle'
);
SELECT function_privs_are('public', 'reserve_promo_code_for_checkout', ARRAY['text','uuid','text','text','text','integer','text','uuid'],
  'service_role', ARRAY['EXECUTE'], 'La reservation est reservee au service_role');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.reserve_promo_code_for_checkout(text,uuid,text,text,text,integer,text,uuid)', 'EXECUTE'),
  'Un client ne peut pas choisir lui-meme son utilisateur, son email ou son montant');
SELECT ok(
  NOT has_function_privilege('anon', 'public.validate_promo_code_for_checkout(text,uuid,text,text,text,integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.validate_promo_code_for_checkout(text,uuid,text,text,text,integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.consume_promo_redemption_for_checkout(uuid,text,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.release_promo_redemption_for_checkout(uuid,text,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.release_expired_promo_reservations()', 'EXECUTE'),
  'Toute la surface RPC publique est interdite aux clients'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('97000000-0000-4000-8000-000000000001','authenticated','authenticated','promo-admin@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('97000000-0000-4000-8000-000000000002','authenticated','authenticated','promo-a@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('97000000-0000-4000-8000-000000000003','authenticated','authenticated','promo-b@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('97000000-0000-4000-8000-000000000004','authenticated','authenticated','vip@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles(id,email,role) VALUES
  ('97000000-0000-4000-8000-000000000001','promo-admin@example.test','admin'),
  ('97000000-0000-4000-8000-000000000002','promo-a@example.test','user'),
  ('97000000-0000-4000-8000-000000000003','promo-b@example.test','user'),
  ('97000000-0000-4000-8000-000000000004','vip@example.test','user')
ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email, role=EXCLUDED.role;

INSERT INTO public.promo_codes(
  id, code, description, discount_type, discount_value, active, max_uses,
  max_uses_per_user, restricted_email, minimum_final_amount_cents, created_by
) VALUES
  ('97000000-0000-4000-8000-000000000101',' welcome10 ','Global','percent',10,true,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000102','DIAG90','Diagnostic','fixed_amount',900,true,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-0000-000000000103','PROMPT20','Formation','percent',20,true,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000104','MULTI','Plusieurs cibles','percent',5,true,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000105','INACTIVE','Inactif','percent',10,false,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000106','FUTURE','Futur','percent',10,true,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000107','EXPIRED','Expire','percent',10,true,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000108','ONEUSE','Quota','percent',10,true,1,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000109','ONEUSER','Quota user','percent',10,true,NULL,1,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000110','VIP','Email','percent',10,true,NULL,NULL,' vip@example.test ',NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000111','MINIMUM','Minimum','fixed_amount',2000,true,NULL,NULL,NULL,14000,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000112','BIGFIXED','Plafond','fixed_amount',20000,true,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000113','ROUND125','Arrondi','percent',12.5,true,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000114','FULL100','Cent pour cent','percent',100,true,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000115','HUGE','Montant fixe borne','fixed_amount',999999999999999999,true,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000116','PRODUCT500','Produit test','fixed_amount',500,true,NULL,NULL,NULL,NULL,'97000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

UPDATE public.promo_codes SET starts_at=now()+interval '1 day' WHERE id='97000000-0000-4000-8000-000000000106';
UPDATE public.promo_codes SET ends_at=now()-interval '1 day' WHERE id='97000000-0000-4000-8000-000000000107';

INSERT INTO public.promo_code_targets(promo_code_id,target_type,target_key) VALUES
  ('97000000-0000-4000-8000-000000000101','all','all'),
  ('97000000-0000-4000-8000-000000000102','diagnostic','diagnostic-ia-express'),
  ('97000000-0000-4000-0000-000000000103','course','formation-prompt-level-1'),
  ('97000000-0000-4000-8000-000000000104','diagnostic','diagnostic-ia-express'),
  ('97000000-0000-4000-8000-000000000104','course','formation-ia'),
  ('97000000-0000-4000-8000-000000000104','course','formation-ia-act'),
  ('97000000-0000-4000-8000-000000000105','all','all'),
  ('97000000-0000-4000-8000-000000000106','all','all'),
  ('97000000-0000-4000-8000-000000000107','all','all'),
  ('97000000-0000-4000-8000-000000000108','all','all'),
  ('97000000-0000-4000-8000-000000000109','all','all'),
  ('97000000-0000-4000-8000-000000000110','all','all'),
  ('97000000-0000-4000-8000-000000000111','all','all'),
  ('97000000-0000-4000-8000-000000000112','all','all'),
  ('97000000-0000-4000-8000-000000000113','all','all'),
  ('97000000-0000-4000-8000-000000000114','all','all'),
  ('97000000-0000-4000-8000-000000000115','all','all'),
  ('97000000-0000-4000-8000-000000000116','product','product-test-addon')
ON CONFLICT DO NOTHING;

SELECT is((SELECT code FROM public.promo_codes WHERE id='97000000-0000-4000-8000-000000000101'), 'WELCOME10',
  'Le code est trim et normalise en majuscules');
SELECT is((SELECT restricted_email FROM public.promo_codes WHERE id='97000000-0000-4000-8000-000000000110'), 'vip@example.test',
  'L email restreint est normalise');
SELECT throws_ok($$
  INSERT INTO public.promo_code_targets(promo_code_id,target_type,target_key)
  VALUES ('97000000-0000-4000-8000-000000000101','all','formation-ia')
$$, '23514', NULL, 'Une cible all impose la cle all');
SELECT throws_ok($$
  INSERT INTO public.promo_code_targets(promo_code_id,target_type,target_key)
  VALUES ('97000000-0000-4000-8000-000000000101','course',' formation-ia ')
$$, '23514', NULL, 'Une cle metier cible ne conserve aucun espace parasite');
SELECT throws_ok($$
  INSERT INTO public.promo_codes(code,discount_type,discount_value) VALUES (' welcome10 ', 'percent', 5)
$$, '23505', NULL, 'Deux codes equivalents apres trim et uppercase sont impossibles');
SELECT throws_ok($$
  INSERT INTO public.promo_codes(code,discount_type,discount_value) VALUES ('ZERO', 'percent', 0)
$$, '23514', NULL, 'Une remise de zero pour cent est interdite');
SELECT throws_ok($$
  INSERT INTO public.promo_codes(code,discount_type,discount_value) VALUES ('OVER100', 'percent', 100.01)
$$, '23514', NULL, 'Une remise superieure a cent pour cent est interdite');
SELECT throws_ok($$
  INSERT INTO public.promo_codes(code,discount_type,discount_value) VALUES ('FIXEDZERO', 'fixed_amount', 0)
$$, '23514', NULL, 'Un montant fixe nul est interdit');
SELECT throws_ok($$
  INSERT INTO public.promo_codes(code,discount_type,discount_value) VALUES ('FIXEDDECIMAL', 'fixed_amount', 1.5)
$$, '23514', NULL, 'Un montant fixe doit representer des centimes entiers');
SELECT throws_ok($$
  INSERT INTO public.promo_codes(code,discount_type,discount_value) VALUES ('FIXEDNAN', 'fixed_amount', 'NaN'::numeric)
$$, '23514', NULL, 'Un montant fixe NaN est interdit');
SELECT throws_ok($$
  INSERT INTO public.promo_codes(code,discount_type,discount_value) VALUES ('FIXEDINFINITY', 'fixed_amount', 'Infinity'::numeric)
$$, '23514', NULL, 'Un montant fixe infini est interdit');
SELECT throws_ok($$
  INSERT INTO public.promo_codes(code,discount_type,discount_value) VALUES ('UNKNOWNKIND', 'unknown', 10)
$$, '23514', NULL, 'Un type de remise inconnu est interdit');
SELECT throws_ok($$
  INSERT INTO public.promo_codes(code,discount_type,discount_value,starts_at,ends_at)
  VALUES ('BADDATES', 'percent', 10, now(), now()-interval '1 minute')
$$, '23514', NULL, 'Une fenetre temporelle inversee est interdite');
SELECT throws_ok($$
  INSERT INTO public.promo_codes(code,discount_type,discount_value,max_uses,max_uses_per_user)
  VALUES ('BADQUOTAS', 'percent', 10, 0, 0)
$$, '23514', NULL, 'Les quotas nuls sont interdits');
SELECT throws_ok($$
  INSERT INTO public.promo_code_targets(promo_code_id,target_type,target_key)
  VALUES ('97000000-0000-4000-8000-000000000101','unknown','target-test')
$$, '23514', NULL, 'Un type de cible inconnu est interdit');

SET LOCAL ROLE service_role;
SELECT is((SELECT discount_amount_cents FROM public.validate_promo_code_for_checkout(' welcome10 ','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900)),1490,
  'Une remise de 10 pour cent est calculee en centimes');
SELECT is((SELECT final_amount_cents FROM public.validate_promo_code_for_checkout('DIAG90','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900)),14000,
  'Une remise fixe Diagnostic est calculee');
SELECT is((SELECT final_amount_cents FROM public.validate_promo_code_for_checkout('PROMPT20','97000000-0000-4000-8000-000000000002','promo-a@example.test','course','formation-prompt-level-1',50000)),40000,
  'Une formation precise utilise sa cle metier stable');
SELECT is((SELECT final_amount_cents FROM public.validate_promo_code_for_checkout('MULTI','97000000-0000-4000-8000-000000000002','promo-a@example.test','course','formation-ia',50000)),47500,
  'Un meme code cible plusieurs offres');
SELECT is((SELECT final_amount_cents FROM public.validate_promo_code_for_checkout('MULTI','97000000-0000-4000-8000-000000000002','promo-a@example.test','course','formation-ia-act',50000)),47500,
  'Le multi-target couvre aussi la cle stable formation-ia-act');
SELECT is((SELECT final_amount_cents FROM public.validate_promo_code_for_checkout('PRODUCT500','97000000-0000-4000-8000-000000000002','promo-a@example.test','product','product-test-addon',2500)),2000,
  'Une cible produit utilise une cle metier sans titre marketing');
SELECT throws_ok($$ SELECT * FROM public.validate_promo_code_for_checkout('DIAG90','97000000-0000-4000-8000-000000000002','promo-a@example.test','course','formation-ia',14900) $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.', 'Une offre hors cible est refusee sans detail');
SELECT throws_ok($$ SELECT * FROM public.validate_promo_code_for_checkout('UNKNOWN','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900) $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.', 'Un code inexistant est refuse');
SELECT throws_ok($$ SELECT * FROM public.validate_promo_code_for_checkout('INACTIVE','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900) $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.', 'Un code inactif est refuse');
SELECT throws_ok($$ SELECT * FROM public.validate_promo_code_for_checkout('FUTURE','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900) $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.', 'Un code futur est refuse');
SELECT throws_ok($$ SELECT * FROM public.validate_promo_code_for_checkout('EXPIRED','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900) $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.', 'Un code expire est refuse');
SELECT throws_ok($$ SELECT * FROM public.validate_promo_code_for_checkout('VIP','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900) $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.', 'La restriction email est appliquee');
SELECT is((SELECT discount_amount_cents FROM public.validate_promo_code_for_checkout('VIP','97000000-0000-4000-8000-000000000004','vip@example.test','diagnostic','diagnostic-ia-express',14900)),1490,
  'L email derive accepte le code restreint');
SELECT throws_ok($$ SELECT * FROM public.validate_promo_code_for_checkout('MINIMUM','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900) $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.', 'Le montant final minimum est respecte');
SELECT is((SELECT final_amount_cents FROM public.validate_promo_code_for_checkout('MINIMUM','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',16000)),14000,
  'Le montant final exactement egal au minimum est accepte');
SELECT is((SELECT final_amount_cents FROM public.validate_promo_code_for_checkout('BIGFIXED','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900)),0,
  'Une remise fixe superieure au prix ne rend jamais le montant negatif');
SELECT is((SELECT discount_amount_cents FROM public.validate_promo_code_for_checkout('ROUND125','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',10005)),1251,
  'Le pourcentage est arrondi au centime le plus proche, demi vers le haut');
SELECT is((SELECT final_amount_cents FROM public.validate_promo_code_for_checkout('FULL100','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900)),0,
  'Cent pour cent produit un montant final nul et non negatif');
SELECT is((SELECT final_amount_cents FROM public.validate_promo_code_for_checkout('HUGE','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900)),0,
  'Un montant fixe numerique tres grand est borne avant conversion en integer');
SELECT throws_ok($$ SELECT * FROM public.validate_promo_code_for_checkout('WELCOME10','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',-1) $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.', 'Un montant original negatif est refuse');
SELECT throws_ok($$ SELECT * FROM public.validate_promo_code_for_checkout('WELCOME10','97000000-0000-4000-8000-000000000002',NULL,'diagnostic','diagnostic-ia-express',14900) $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.', 'Une validation sans email serveur est refusee');
SELECT is((SELECT count(*)::integer FROM public.promo_redemptions),0,
  'Les validations seules ne creent ni reservation ni consommation');

-- Ces assertions de quota sont sequentielles. Elles ne remplacent pas le test
-- obligatoire avec deux connexions PostgreSQL concurrentes.
SELECT lives_ok($$ SELECT * FROM public.reserve_promo_code_for_checkout('ONEUSE','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900,'diagnostic_order','97000000-0000-4000-8000-000000000201') $$,
  'La premiere reservation du quota 1 reussit');
SELECT throws_ok($$ SELECT * FROM public.reserve_promo_code_for_checkout('ONEUSE','97000000-0000-4000-8000-000000000003','promo-b@example.test','diagnostic','diagnostic-ia-express',14900,'diagnostic_order','97000000-0000-4000-8000-000000000202') $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.', 'Le quota global empeche une seconde reservation sequentielle');
SELECT is((SELECT count(*)::integer FROM public.promo_redemptions WHERE promo_code_id='97000000-0000-4000-8000-000000000108'),1,
  'Le scenario sequentiel du dernier quota ne cree qu une redemption');
SELECT lives_ok($$ SELECT * FROM public.reserve_promo_code_for_checkout('ONEUSER','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900,'diagnostic_order','97000000-0000-4000-8000-000000000203') $$,
  'La premiere reservation utilisateur reussit');
SELECT throws_ok($$ SELECT * FROM public.reserve_promo_code_for_checkout('ONEUSER','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900,'diagnostic_order','97000000-0000-4000-8000-000000000204') $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.', 'Le quota par utilisateur est refuse dans le scenario sequentiel');

SELECT is((SELECT status FROM public.reserve_promo_code_for_checkout('WELCOME10','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900,'diagnostic_order','97000000-0000-4000-8000-000000000205')),'reserved',
  'Une creation de checkout reserve sans consommer');
SELECT is((SELECT status FROM public.reserve_promo_code_for_checkout('WELCOME10','97000000-0000-4000-8000-000000000002','promo-a@example.test','diagnostic','diagnostic-ia-express',14900,'diagnostic_order','97000000-0000-4000-8000-000000000205')),'reserved',
  'La meme commande est idempotente pendant sa reservation');
SELECT throws_ok($$ SELECT * FROM public.reserve_promo_code_for_checkout(
  'WELCOME10','97000000-0000-4000-8000-000000000002','promo-a@example.test',
  'diagnostic','diagnostic-ia-express',15000,'diagnostic_order','97000000-0000-4000-8000-000000000205') $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.',
  'Une reprise du meme contexte avec un montant different est refusee');
SELECT throws_ok($$ SELECT * FROM public.reserve_promo_code_for_checkout(
  'DIAG90','97000000-0000-4000-8000-000000000002','promo-a@example.test',
  'diagnostic','diagnostic-ia-express',14900,'diagnostic_order','97000000-0000-4000-8000-000000000205') $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.',
  'Un second code sur le meme contexte est refuse sans exposer la contrainte SQL');
SELECT throws_ok($$ SELECT * FROM public.reserve_promo_code_for_checkout(
  'WELCOME10',NULL,'promo-a@example.test','diagnostic','diagnostic-ia-express',14900,
  'diagnostic_order','97000000-0000-4000-8000-000000000205') $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.',
  'Une reprise du meme contexte avec une identite NULL est refusee');
SELECT is((SELECT status FROM public.consume_promo_redemption_for_checkout(
  (SELECT id FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000205'),
  'diagnostic_order','97000000-0000-4000-8000-000000000205')),'consumed',
  'Le paiement confirme consomme la reservation');
SELECT is((SELECT status FROM public.consume_promo_redemption_for_checkout(
  (SELECT id FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000205'),
  'diagnostic_order','97000000-0000-4000-8000-000000000205')),'consumed',
  'La double consommation du meme ordre est idempotente');
SELECT is((SELECT status FROM public.release_promo_redemption_for_checkout(
  (SELECT id FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000205'),
  'diagnostic_order','97000000-0000-4000-8000-000000000205')),'consumed',
  'Une redemption consommee ne peut pas etre liberee');

SELECT lives_ok($$ SELECT * FROM public.reserve_promo_code_for_checkout('WELCOME10','97000000-0000-4000-8000-000000000003','promo-b@example.test','diagnostic','diagnostic-ia-express',14900,'diagnostic_order','97000000-0000-4000-8000-000000000206') $$,
  'Une seconde reservation est preparee pour abandon');
SELECT is((SELECT status FROM public.release_promo_redemption_for_checkout(
  (SELECT id FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000206'),
  'diagnostic_order','97000000-0000-4000-8000-000000000206')),'released',
  'Un checkout abandonne libere la remise');
SELECT is((SELECT status FROM public.release_promo_redemption_for_checkout(
  (SELECT id FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000206'),
  'diagnostic_order','97000000-0000-4000-8000-000000000206')),'released',
  'La double liberation est idempotente');
SELECT throws_ok($$ SELECT * FROM public.consume_promo_redemption_for_checkout(
  (SELECT id FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000206'),
  'diagnostic_order','97000000-0000-4000-8000-000000000206') $$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.',
  'Une redemption released ne peut pas etre consommee');

SELECT lives_ok($$ SELECT * FROM public.reserve_promo_code_for_checkout('WELCOME10','97000000-0000-4000-8000-000000000003','promo-b@example.test','diagnostic','diagnostic-ia-express',14900,'diagnostic_order','97000000-0000-4000-8000-000000000207') $$,
  'Une reservation est preparee pour tester l expiration');
UPDATE public.promo_redemptions
SET reserved_at=now()-interval '1 hour', reservation_expires_at=now()-interval '30 minutes'
WHERE order_context_id='97000000-0000-4000-8000-000000000207';
SELECT is((SELECT status FROM public.consume_promo_redemption_for_checkout(
  (SELECT id FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000207'),
  'diagnostic_order','97000000-0000-4000-8000-000000000207')),'released',
  'Une reservation expiree est liberee sans consommation');
SELECT is((SELECT status FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000207'),'released',
  'La liberation de la reservation expiree persiste dans le journal');

UPDATE public.promo_redemptions
SET reserved_at=now()-interval '1 hour', reservation_expires_at=now()-interval '1 minute'
WHERE order_context_id='97000000-0000-4000-8000-000000000203';
SELECT is(public.release_expired_promo_reservations(),1,'Le nettoyage libere les reservations expirees');
SELECT is((SELECT status FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000203'),'released',
  'Une reservation expiree ne bloque plus un quota');

UPDATE public.promo_redemptions
SET reserved_at=now()-interval '1 hour', reservation_expires_at=now()-interval '1 minute'
WHERE order_context_id='97000000-0000-4000-8000-000000000201';
SELECT is((
  WITH new_reservation AS MATERIALIZED (
    SELECT status FROM public.reserve_promo_code_for_checkout(
      'ONEUSE','97000000-0000-4000-8000-000000000003','promo-b@example.test',
      'diagnostic','diagnostic-ia-express',14900,'diagnostic_order','97000000-0000-4000-8000-000000000208'
    )
  )
  SELECT concat(
    (SELECT status FROM public.promo_redemptions WHERE order_context_id='97000000-0000-4000-8000-000000000201'),
    ':', new_reservation.status
  )
  FROM new_reservation
),'released:reserved',
  'Une nouvelle reservation libere l usage expire avant de recalculer le quota');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*)::integer FROM public.promo_codes),0,'Un utilisateur ne peut pas lister les codes');
SELECT is((SELECT count(*)::integer FROM public.promo_code_targets),0,'Un utilisateur ne peut pas lister les cibles');
SELECT is((SELECT count(*)::integer FROM public.promo_redemptions),0,'Un utilisateur ne peut pas lire les statistiques');
SELECT throws_ok($$ INSERT INTO public.promo_codes(code,discount_type,discount_value) VALUES ('CLIENT', 'percent', 10) $$,
  '42501', 'permission denied for table promo_codes', 'Un utilisateur ne peut pas creer un code');
SELECT throws_ok($$ UPDATE public.promo_code_targets SET target_key='formation-ia' $$,
  '42501', 'permission denied for table promo_code_targets', 'Un utilisateur ne peut pas modifier une cible');
SELECT throws_ok($$ DELETE FROM public.promo_redemptions $$,
  '42501', 'permission denied for table promo_redemptions', 'Un utilisateur ne peut pas effacer une utilisation');
SELECT set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000001',true);
SELECT ok((SELECT count(*) FROM public.promo_codes) > 0,
  'Un administrateur strict peut lire les codes pour la future administration');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT count(*) FROM public.promo_codes $$,
  '42501', 'permission denied for table promo_codes', 'Anon ne peut pas lire les codes');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
