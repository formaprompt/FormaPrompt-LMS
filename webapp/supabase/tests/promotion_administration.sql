BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

SELECT has_function('public', 'admin_list_promotions', ARRAY[]::text[], 'RPC admin de consultation disponible');
SELECT has_function('public', 'admin_create_promotion', ARRAY['text','text','text','numeric','boolean','timestamptz','timestamptz','integer','integer','text','integer','jsonb'], 'RPC admin de creation disponible');
SELECT has_function('public', 'admin_update_promotion', ARRAY['uuid','text','text','numeric','timestamptz','timestamptz','integer','integer','text','integer','jsonb'], 'RPC admin de modification disponible');
SELECT has_function('public', 'admin_set_promotion_active', ARRAY['uuid','boolean'], 'RPC admin d activation disponible');
SELECT ok(to_regprocedure('public.admin_delete_promotion(uuid)') IS NULL, 'Aucune suppression physique V1 n est exposee');
SELECT function_privs_are('public', 'admin_list_promotions', ARRAY[]::text[], 'authenticated', ARRAY['EXECUTE'], 'La liste est reservee aux sessions authentifiees puis controlee strict admin');
SELECT ok(
  NOT has_function_privilege('anon', 'public.admin_list_promotions()', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.admin_list_promotions()', 'EXECUTE'),
  'Anon et service_role ne disposent pas de la surface d administration'
);
SELECT ok(
  NOT has_table_privilege('authenticated','public.promo_codes','INSERT,UPDATE,DELETE')
  AND NOT has_table_privilege('authenticated','public.promo_code_targets','INSERT,UPDATE,DELETE')
  AND NOT has_table_privilege('authenticated','public.promo_redemptions','INSERT,UPDATE,DELETE'),
  'Les mutations directes restent interdites aux utilisateurs authentifies'
);
SELECT ok(
  NOT has_function_privilege('authenticated','private.require_promotion_admin()','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.normalize_promotion_admin_targets(jsonb)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.validate_promotion_admin_values(text,text,numeric,timestamptz,timestamptz,integer,integer,text,integer)','EXECUTE'),
  'Les auxiliaires prives ne sont pas appelables par authenticated'
);

INSERT INTO auth.users(
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('99000000-0000-4000-8000-000000000001','authenticated','authenticated','promo-admin-d@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('99000000-0000-4000-8000-000000000002','authenticated','authenticated','promo-user-d@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now())
ON CONFLICT(id) DO NOTHING;

INSERT INTO public.profiles(id,email,role) VALUES
  ('99000000-0000-4000-8000-000000000001','promo-admin-d@example.test','admin'),
  ('99000000-0000-4000-8000-000000000002','promo-user-d@example.test','user')
ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email, role=EXCLUDED.role;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000002',true);
SELECT throws_ok(
  $$SELECT public.admin_list_promotions()$$,
  '42501', 'Action reservee au role admin.',
  'Un utilisateur ordinaire ne peut pas lister les promotions'
);
SELECT throws_ok(
  $$SELECT public.admin_create_promotion('FORBIDDEN',NULL,'percent',10,true,NULL,NULL,NULL,NULL,NULL,NULL,'[{"target_type":"all","target_key":"all"}]')$$,
  '42501', 'Action reservee au role admin.',
  'Un utilisateur ordinaire ne peut pas creer une promotion'
);
SELECT throws_ok(
  $$SELECT public.admin_update_promotion('99000000-0000-4000-8000-000000000099',NULL,'percent',10,NULL,NULL,NULL,NULL,NULL,NULL,'[{"target_type":"all","target_key":"all"}]')$$,
  '42501', 'Action reservee au role admin.',
  'Un utilisateur ordinaire ne peut pas modifier une promotion'
);
SELECT throws_ok(
  $$SELECT public.admin_set_promotion_active('99000000-0000-4000-8000-000000000099',false)$$,
  '42501', 'Action reservee au role admin.',
  'Un utilisateur ordinaire ne peut pas desactiver une promotion'
);
SELECT is((SELECT count(*) FROM public.promo_codes)::bigint, 0::bigint, 'La RLS masque les codes a l utilisateur ordinaire');

SELECT set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000001',true);
SELECT lives_ok(
  $$SELECT public.admin_create_promotion(
    ' admin10 ', 'Pourcentage admin', 'percent', 10, true, NULL, NULL, 20, 1,
    ' VIP@EXAMPLE.TEST ', 100,
    '[{"target_type":"diagnostic","target_key":"diagnostic-ia-express"}]'
  )$$,
  'L admin strict cree une promotion en pourcentage'
);
SELECT is((SELECT code FROM public.promo_codes WHERE code='ADMIN10'), 'ADMIN10', 'Le code est normalise en uppercase et trim');
SELECT is((SELECT restricted_email FROM public.promo_codes WHERE code='ADMIN10'), 'vip@example.test', 'L email restreint est normalise');
SELECT is((SELECT restricted_email FROM public.admin_list_promotions() WHERE code='ADMIN10'), 'vip@example.test', 'Seul l admin strict recupere l email restreint via la liste admin');
SELECT is((SELECT minimum_final_amount_cents FROM public.promo_codes WHERE code='ADMIN10'), 100, 'Le montant final minimum est conserve en cents');
SELECT is((SELECT target_type||'/'||target_key FROM public.promo_code_targets t JOIN public.promo_codes c ON c.id=t.promo_code_id WHERE c.code='ADMIN10'), 'diagnostic/diagnostic-ia-express', 'La cible Diagnostic stable est creee');

SELECT lives_ok(
  $$SELECT public.admin_create_promotion(
    'FIXED20', 'Montant fixe', 'fixed_amount', 2000, true, NULL, NULL, NULL, NULL,
    NULL, NULL, '[{"target_type":"all","target_key":"all"}]'
  )$$,
  'L admin strict cree une remise fixe globale'
);
SELECT is((SELECT discount_value::integer FROM public.promo_codes WHERE code='FIXED20'), 2000, 'Le montant fixe est stocke en cents entiers');
SELECT is((SELECT target_type||'/'||target_key FROM public.promo_code_targets t JOIN public.promo_codes c ON c.id=t.promo_code_id WHERE c.code='FIXED20'), 'all/all', 'La cible globale est all/all');

SELECT throws_ok(
  $$SELECT public.admin_create_promotion(' admin10 ',NULL,'percent',5,true,NULL,NULL,NULL,NULL,NULL,NULL,'[{"target_type":"all","target_key":"all"}]')$$,
  '23505', 'Ce code promotionnel existe deja.', 'Deux codes equivalents sont refuses'
);
SELECT throws_ok(
  $$SELECT public.admin_create_promotion('BADDATE',NULL,'percent',5,true,'2026-09-02','2026-09-01',NULL,NULL,NULL,NULL,'[{"target_type":"all","target_key":"all"}]')$$,
  '22023', 'La date de fin doit etre posterieure a la date de debut.', 'Les dates invalides sont refusees'
);
SELECT throws_ok(
  $$SELECT public.admin_create_promotion('BADQUOTA',NULL,'percent',5,true,NULL,NULL,1,2,NULL,NULL,'[{"target_type":"all","target_key":"all"}]')$$,
  '22023', 'Quotas promotionnels invalides.', 'Le quota utilisateur ne depasse pas le quota global'
);
SELECT throws_ok(
  $$SELECT public.admin_create_promotion('BADTARGET',NULL,'percent',5,true,NULL,NULL,NULL,NULL,NULL,NULL,'[{"target_type":"course","target_key":"Titre Marketing"}]')$$,
  '22023', 'Cible promotionnelle invalide.', 'Une cible instable est refusee'
);
SELECT is((SELECT count(*)::integer FROM public.promo_codes WHERE code='BADTARGET'), 0, 'Une cible invalide ne laisse aucun code orphelin');
SELECT throws_ok(
  $$SELECT public.admin_create_promotion('DUPTARGET',NULL,'percent',5,true,NULL,NULL,NULL,NULL,NULL,NULL,'[{"target_type":"course","target_key":"formation-ia"},{"target_type":"course","target_key":"formation-ia"}]')$$,
  '22023', 'Une cible promotionnelle ne peut pas etre dupliquee.', 'Une cible dupliquee est refusee'
);
SELECT throws_ok(
  $$SELECT public.admin_create_promotion('MIXGLOBAL',NULL,'percent',5,true,NULL,NULL,NULL,NULL,NULL,NULL,'[{"target_type":"all","target_key":"all"},{"target_type":"course","target_key":"formation-ia"}]')$$,
  '22023', 'La cible globale ne peut pas etre combinee avec une autre cible.', 'La cible globale reste exclusive'
);

SELECT lives_ok(
  $$SELECT public.admin_create_promotion(
    'MULTIADMIN', NULL, 'percent', 5, true, NULL, NULL, NULL, NULL, NULL, NULL,
    '[{"target_type":"course","target_key":"formation-ia"},{"target_type":"course","target_key":"formation-ia-act"},{"target_type":"course","target_key":"formation-prompt-level-1"},{"target_type":"product","target_key":"audit-ia-2027"}]'
  )$$,
  'Une promotion multi-target formation et produit est creee atomiquement'
);
SELECT is((SELECT count(*)::integer FROM public.promo_code_targets t JOIN public.promo_codes c ON c.id=t.promo_code_id WHERE c.code='MULTIADMIN'), 4, 'Les quatre cibles multi-target sont presentes');

SELECT throws_ok(
  $$UPDATE public.promo_codes SET code='RENAMED' WHERE code='ADMIN10'$$,
  '42501', 'permission denied for table promo_codes', 'Authenticated ne peut pas renommer directement un code'
);
RESET ROLE;
SELECT throws_ok(
  $$UPDATE public.promo_codes SET code='RENAMED' WHERE code='ADMIN10'$$,
  '22023', 'Le code promotionnel est immuable. Creez une nouvelle promotion.', 'Le trigger interdit aussi le renommage privilegie'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000001',true);
SELECT lives_ok(
  $$SELECT public.admin_update_promotion(
    (SELECT id FROM public.promo_codes WHERE code='ADMIN10'), 'Parametres modifies',
    'fixed_amount', 500, NULL, NULL, 10, 1, NULL, 0,
    '[{"target_type":"diagnostic","target_key":"diagnostic-ia-express"},{"target_type":"course","target_key":"formation-ia"}]'
  )$$,
  'La promotion et ses cibles sont modifiees par une RPC transactionnelle'
);
SELECT is((SELECT discount_value::integer FROM public.promo_codes WHERE code='ADMIN10'), 500, 'La valeur de remise est modifiee');
SELECT is((SELECT count(*)::integer FROM public.promo_code_targets t JOIN public.promo_codes c ON c.id=t.promo_code_id WHERE c.code='ADMIN10'), 2, 'Le remplacement transactionnel laisse deux cibles coherentes');
SELECT lives_ok($$SELECT public.admin_set_promotion_active((SELECT id FROM public.promo_codes WHERE code='ADMIN10'), false)$$, 'La desactivation est autorisee');
SELECT is((SELECT active FROM public.promo_codes WHERE code='ADMIN10'), false, 'La promotion est inactive sans suppression');
SELECT lives_ok($$SELECT public.admin_set_promotion_active((SELECT id FROM public.promo_codes WHERE code='ADMIN10'), true)$$, 'La reactivation est autorisee');
SELECT is((SELECT active FROM public.promo_codes WHERE code='ADMIN10'), true, 'La promotion est reactivee');
SELECT lives_ok($$SELECT public.admin_set_promotion_active((SELECT id FROM public.promo_codes WHERE code='ADMIN10'), true)$$, 'La reactivation repetee est idempotente');

RESET ROLE;
INSERT INTO public.promo_redemptions(
  promo_code_id,user_id,order_context_type,order_context_id,target_type,target_key,
  original_amount_cents,discount_amount_cents,final_amount_cents,status,reserved_at,
  reservation_expires_at
) VALUES (
  (SELECT id FROM public.promo_codes WHERE code='ADMIN10'),
  '99000000-0000-4000-8000-000000000002','admin_promo_test',
  '99000000-0000-4000-8000-000000000101','diagnostic','diagnostic-ia-express',
  14900,500,14400,'reserved',now(),now()+interval '30 minutes'
);
INSERT INTO public.promo_redemptions(
  promo_code_id,user_id,order_context_type,order_context_id,target_type,target_key,
  original_amount_cents,discount_amount_cents,final_amount_cents,status,reserved_at,
  reservation_expires_at
) VALUES (
  (SELECT id FROM public.promo_codes WHERE code='ADMIN10'),
  '99000000-0000-4000-8000-000000000002','admin_promo_test',
  '99000000-0000-4000-8000-000000000102','diagnostic','diagnostic-ia-express',
  14900,500,14400,'reserved',now()-interval '40 minutes',now()-interval '10 minutes'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000001',true);
SELECT lives_ok(
  $$SELECT public.admin_update_promotion(
    (SELECT id FROM public.promo_codes WHERE code='ADMIN10'), 'Nouvelle valeur future',
    'percent', 25, NULL, NULL, 10, 1, NULL, 0,
    '[{"target_type":"diagnostic","target_key":"diagnostic-ia-express"}]'
  )$$,
  'Une promotion deja utilisee reste modifiable pour les usages futurs'
);
SELECT is((SELECT discount_amount_cents FROM public.promo_redemptions WHERE order_context_id='99000000-0000-4000-8000-000000000101'), 500, 'La redemption existante ne subit aucun recalcul retroactif');
SELECT is((SELECT final_amount_cents FROM public.promo_redemptions WHERE order_context_id='99000000-0000-4000-8000-000000000101'), 14400, 'Le montant final historique reste fige');
SELECT is((SELECT active_reservations::integer FROM public.admin_list_promotions() WHERE code='ADMIN10'), 1, 'La consultation compte la reservation active mais exclut la reservation expiree');
SELECT is((SELECT remaining_uses FROM public.admin_list_promotions() WHERE code='ADMIN10'), 9, 'Le quota restant deduit uniquement les reservations encore actives');
SELECT ok((SELECT restricted_email_present IS false FROM public.admin_list_promotions() WHERE code='ADMIN10'), 'La presence de restriction email est exposee sans ambiguite');

RESET ROLE;
INSERT INTO public.promo_redemptions(
  promo_code_id,user_id,order_context_type,order_context_id,target_type,target_key,
  original_amount_cents,discount_amount_cents,final_amount_cents,status,reserved_at,
  reservation_expires_at,consumed_at
) VALUES (
  (SELECT id FROM public.promo_codes WHERE code='ADMIN10'),
  '99000000-0000-4000-8000-000000000002','admin_promo_test',
  '99000000-0000-4000-8000-000000000103','diagnostic','diagnostic-ia-express',
  14900,500,14400,'consumed',now()-interval '1 hour',NULL,now()-interval '30 minutes'
);
INSERT INTO public.promo_redemptions(
  promo_code_id,user_id,order_context_type,order_context_id,target_type,target_key,
  original_amount_cents,discount_amount_cents,final_amount_cents,status,reserved_at,
  reservation_expires_at,released_at
) VALUES (
  (SELECT id FROM public.promo_codes WHERE code='ADMIN10'),
  '99000000-0000-4000-8000-000000000002','admin_promo_test',
  '99000000-0000-4000-8000-000000000104','diagnostic','diagnostic-ia-express',
  14900,500,14400,'released',now()-interval '1 hour',NULL,now()-interval '20 minutes'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000001',true);
SELECT lives_ok(
  $$SELECT public.admin_update_promotion(
    (SELECT id FROM public.promo_codes WHERE code='ADMIN10'), 'Quota reduit sous historique',
    'percent', 25, NULL, NULL, 1, 1, NULL, 0,
    '[{"target_type":"diagnostic","target_key":"diagnostic-ia-express"}]'
  )$$,
  'Le quota peut etre reduit sous les usages existants sans modifier l historique'
);
SELECT is((SELECT count(*)::integer FROM public.promo_redemptions r JOIN public.promo_codes c ON c.id=r.promo_code_id WHERE c.code='ADMIN10'), 4, 'La reduction du quota conserve toutes les redemptions historiques');
SELECT is((SELECT consumed_uses::integer FROM public.admin_list_promotions() WHERE code='ADMIN10'), 1, 'La consultation compte les usages consommes');
SELECT is((SELECT released_uses::integer FROM public.admin_list_promotions() WHERE code='ADMIN10'), 1, 'La consultation compte les usages liberes sans confondre la reservation expiree');
SELECT is((SELECT remaining_uses FROM public.admin_list_promotions() WHERE code='ADMIN10'), 0, 'Un quota reduit sous les usages apparait atteint pour les futures reservations');
RESET ROLE;
SELECT throws_ok(
  $$SELECT * FROM public.validate_promo_code_for_checkout(
    'ADMIN10','99000000-0000-4000-8000-000000000001','promo-admin-d@example.test',
    'diagnostic','diagnostic-ia-express',14900
  )$$,
  'P0001', 'Ce code n''est pas valide ou n''est plus disponible.',
  'Le moteur refuse une nouvelle validation apres reduction du quota'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000001',true);
SELECT ok(
  EXISTS (SELECT 1 FROM public.audit_log WHERE target_type='promo_code' AND action_type='promotion_created'
    AND actor_user_id='99000000-0000-4000-8000-000000000001')
  AND EXISTS (SELECT 1 FROM public.audit_log WHERE target_type='promo_code' AND action_type='promotion_updated'
    AND metadata->>'targets_replaced'='true')
  AND EXISTS (SELECT 1 FROM public.audit_log WHERE target_type='promo_code' AND action_type='promotion_deactivated')
  AND EXISTS (SELECT 1 FROM public.audit_log WHERE target_type='promo_code' AND action_type='promotion_activated'),
  'Creation, modification des targets, desactivation et activation sont journalisees avec l admin'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE target_type='promo_code'
      AND (coalesce(previous_state::text,'') || coalesce(new_state::text,'') || metadata::text)
        ~* '(vip@example[.]test|ADMIN10)'
  ),
  'Le journal ne contient ni email restreint ni code promotionnel complet'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
