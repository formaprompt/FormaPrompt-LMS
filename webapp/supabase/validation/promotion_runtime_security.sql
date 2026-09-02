\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_table text;
  v_function regprocedure;
  v_setting text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname IN ('anon', 'authenticated')
      AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'Un role API client contourne les privileges ou la RLS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'service_role' AND rolbypassrls AND NOT rolsuper
  ) THEN
    RAISE EXCEPTION 'Le role service_role local est absent ou mal configure';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','service_role')) <> 3 THEN
    RAISE EXCEPTION 'Les roles API Supabase attendus ne sont pas tous presents';
  END IF;

  FOREACH v_table IN ARRAY ARRAY['promo_codes', 'promo_code_targets', 'promo_redemptions']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS classes
      JOIN pg_catalog.pg_namespace AS namespaces ON namespaces.oid = classes.relnamespace
      WHERE namespaces.nspname = 'public'
        AND classes.relname = v_table
        AND classes.relrowsecurity
        AND classes.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS/FORCE RLS absent sur public.%', v_table;
    END IF;
    IF has_table_privilege('anon', format('public.%I', v_table), 'SELECT,INSERT,UPDATE,DELETE')
      OR has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT,UPDATE,DELETE')
    THEN
      RAISE EXCEPTION 'Privilege direct excessif sur public.%', v_table;
    END IF;
  END LOOP;

  FOREACH v_function IN ARRAY ARRAY[
    'public.admin_list_promotions()'::regprocedure,
    'public.admin_create_promotion(text,text,text,numeric,boolean,timestamptz,timestamptz,integer,integer,text,integer,jsonb)'::regprocedure,
    'public.admin_update_promotion(uuid,text,text,numeric,timestamptz,timestamptz,integer,integer,text,integer,jsonb)'::regprocedure,
    'public.admin_set_promotion_active(uuid,boolean)'::regprocedure
  ]
  LOOP
    IF NOT (SELECT functions.prosecdef FROM pg_catalog.pg_proc AS functions WHERE functions.oid = v_function) THEN
      RAISE EXCEPTION 'SECURITY DEFINER absent sur %', v_function;
    END IF;
    IF (SELECT pg_catalog.pg_get_userbyid(functions.proowner) FROM pg_catalog.pg_proc AS functions WHERE functions.oid = v_function) <> 'postgres' THEN
      RAISE EXCEPTION 'Proprietaire inattendu pour %', v_function;
    END IF;
    SELECT setting INTO v_setting
    FROM pg_catalog.pg_proc AS functions,
      LATERAL unnest(coalesce(functions.proconfig, ARRAY[]::text[])) AS setting
    WHERE functions.oid = v_function
      AND split_part(setting, '=', 1) = 'search_path';
    IF v_setting IS NULL OR btrim(split_part(v_setting, '=', 2), '"') <> '' THEN
      RAISE EXCEPTION 'search_path non vide pour %: %', v_function, v_setting;
    END IF;
    IF NOT has_function_privilege('authenticated', v_function, 'EXECUTE')
      OR has_function_privilege('anon', v_function, 'EXECUTE')
      OR has_function_privilege('service_role', v_function, 'EXECUTE')
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc AS functions,
          LATERAL aclexplode(coalesce(functions.proacl, acldefault('f', functions.proowner))) AS privilege
        WHERE functions.oid = v_function
          AND privilege.grantee = 0
          AND privilege.privilege_type = 'EXECUTE'
      )
    THEN
      RAISE EXCEPTION 'ACL admin inattendue pour %', v_function;
    END IF;
  END LOOP;

  FOREACH v_function IN ARRAY ARRAY[
    'public.validate_promo_code_for_checkout(text,uuid,text,text,text,integer)'::regprocedure,
    'public.reserve_promo_code_for_checkout(text,uuid,text,text,text,integer,text,uuid)'::regprocedure,
    'public.consume_promo_redemption_for_checkout(uuid,text,uuid)'::regprocedure,
    'public.release_promo_redemption_for_checkout(uuid,text,uuid)'::regprocedure,
    'public.release_expired_promo_reservations()'::regprocedure,
    'public.prepare_course_checkout_intent(uuid,uuid,text,text,text,text,text,text,text,uuid,jsonb,text,text)'::regprocedure,
    'public.prepare_course_promotion_checkout(uuid,uuid,text,text,integer,text)'::regprocedure,
    'public.reset_course_promotion_checkout(uuid,uuid)'::regprocedure,
    'public.process_course_stripe_event(jsonb)'::regprocedure
  ]
  LOOP
    IF NOT has_function_privilege('service_role', v_function, 'EXECUTE')
      OR has_function_privilege('anon', v_function, 'EXECUTE')
      OR has_function_privilege('authenticated', v_function, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'ACL serveur inattendue pour %', v_function;
    END IF;
    IF (SELECT functions.prosecdef FROM pg_catalog.pg_proc AS functions WHERE functions.oid = v_function)
      OR (SELECT pg_catalog.pg_get_userbyid(functions.proowner) FROM pg_catalog.pg_proc AS functions WHERE functions.oid = v_function) <> 'postgres'
    THEN
      RAISE EXCEPTION 'Mode ou proprietaire inattendu pour la RPC serveur %', v_function;
    END IF;
    SELECT setting INTO v_setting
    FROM pg_catalog.pg_proc AS functions,
      LATERAL unnest(coalesce(functions.proconfig, ARRAY[]::text[])) AS setting
    WHERE functions.oid = v_function
      AND split_part(setting, '=', 1) = 'search_path';
    IF v_setting IS NULL OR btrim(split_part(v_setting, '=', 2), '"') <> '' THEN
      RAISE EXCEPTION 'search_path non vide pour la RPC serveur %: %', v_function, v_setting;
    END IF;
  END LOOP;

  FOREACH v_function IN ARRAY ARRAY[
    'private.require_promotion_admin()'::regprocedure,
    'private.normalize_promotion_admin_targets(jsonb)'::regprocedure,
    'private.validate_promotion_admin_values(text,text,numeric,timestamptz,timestamptz,integer,integer,text,integer)'::regprocedure
  ]
  LOOP
    IF has_function_privilege('anon', v_function, 'EXECUTE')
      OR has_function_privilege('authenticated', v_function, 'EXECUTE')
      OR has_function_privilege('service_role', v_function, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'Helper prive expose: %', v_function;
    END IF;
  END LOOP;

  FOREACH v_function IN ARRAY ARRAY[
    'private.promo_invalid()'::regprocedure,
    'private.validate_promo_code(text,uuid,text,text,text,integer)'::regprocedure,
    'private.reserve_promo_code(text,uuid,text,text,text,integer,text,uuid)'::regprocedure,
    'private.consume_promo_redemption(uuid,text,uuid)'::regprocedure,
    'private.release_promo_redemption(uuid,text,uuid)'::regprocedure,
    'private.release_expired_promo_reservations()'::regprocedure
  ]
  LOOP
    IF has_function_privilege('anon', v_function, 'EXECUTE')
      OR has_function_privilege('authenticated', v_function, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'Helper promotionnel prive expose aux clients: %', v_function;
    END IF;
  END LOOP;
END;
$$;

INSERT INTO auth.users(
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('aa000000-0000-4000-8000-000000000001','authenticated','authenticated','ci-promo-admin@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('aa000000-0000-4000-8000-000000000002','authenticated','authenticated','ci-promo-user@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now())
ON CONFLICT(id) DO NOTHING;

INSERT INTO public.profiles(id,email,role) VALUES
  ('aa000000-0000-4000-8000-000000000001','ci-promo-admin@example.test','admin'),
  ('aa000000-0000-4000-8000-000000000002','ci-promo-user@example.test','user')
ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email, role=EXCLUDED.role;

INSERT INTO public.promo_codes(id,code,discount_type,discount_value,active)
VALUES ('aa000000-0000-4000-8000-000000000101','CI_SECURITY_HIDDEN','percent',5,true);
INSERT INTO public.promo_code_targets(promo_code_id,target_type,target_key)
VALUES ('aa000000-0000-4000-8000-000000000101','all','all');

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.promo_codes;
    RAISE EXCEPTION 'anon a lu promo_codes';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.promo_codes(code,discount_type,discount_value)
    VALUES ('CI_ANON_FORBIDDEN','percent',5);
    RAISE EXCEPTION 'anon a modifie promo_codes';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_valid boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.promo_codes WHERE code = 'CI_SECURITY_HIDDEN') THEN
    RAISE EXCEPTION 'service_role ne peut pas lire directement les promotions';
  END IF;
  SELECT valid INTO v_valid
  FROM public.validate_promo_code_for_checkout(
    'CI_SECURITY_HIDDEN','aa000000-0000-4000-8000-000000000002',
    'ci-promo-user@example.test','product','ci-security-product',10000
  );
  IF v_valid IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'service_role ne peut pas invoquer la validation serveur';
  END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000002',true);
DO $$
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM 'aa000000-0000-4000-8000-000000000002'::uuid THEN
    RAISE EXCEPTION 'Le claim non-admin ne produit pas le auth.uid attendu';
  END IF;
  IF (SELECT count(*) FROM public.promo_codes) <> 0 THEN
    RAISE EXCEPTION 'La RLS expose des promotions au non-admin';
  END IF;
  BEGIN
    INSERT INTO public.promo_codes(code,discount_type,discount_value)
    VALUES ('CI_USER_FORBIDDEN','percent',5);
    RAISE EXCEPTION 'authenticated a modifie promo_codes';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.admin_list_promotions();
    RAISE EXCEPTION 'Le non-admin a liste les promotions';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM public.admin_create_promotion(
      'CI_FORBIDDEN',NULL,'percent',5,true,NULL,NULL,NULL,NULL,NULL,NULL,
      '[{"target_type":"all","target_key":"all"}]'::jsonb
    );
    RAISE EXCEPTION 'Le non-admin a cree une promotion';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM public.admin_update_promotion(
      'aa000000-0000-4000-8000-000000000101',NULL,'percent',5,NULL,NULL,
      NULL,NULL,NULL,NULL,'[{"target_type":"all","target_key":"all"}]'::jsonb
    );
    RAISE EXCEPTION 'Le non-admin a modifie une promotion';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM public.admin_set_promotion_active('aa000000-0000-4000-8000-000000000101',false);
    RAISE EXCEPTION 'Le non-admin a desactive une promotion';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE
  v_promo_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM 'aa000000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'Le claim admin ne produit pas le auth.uid attendu';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_list_promotions() WHERE code = 'CI_SECURITY_HIDDEN') THEN
    RAISE EXCEPTION 'Le strict admin ne peut pas consulter les promotions';
  END IF;

  SELECT id INTO v_promo_id
  FROM public.admin_create_promotion(
    ' ci_runtime_admin ', 'Validation CI', 'fixed_amount', 500, true,
    NULL, NULL, 10, 1, NULL, 100,
    '[{"target_type":"course","target_key":"formation-ia"}]'::jsonb
  );
  PERFORM public.admin_update_promotion(
    v_promo_id, 'Validation CI mise a jour', 'percent', 10, NULL, NULL,
    20, 2, NULL, 100,
    '[{"target_type":"course","target_key":"formation-ia"}]'::jsonb
  );
  PERFORM public.admin_set_promotion_active(v_promo_id, false);
  PERFORM public.admin_set_promotion_active(v_promo_id, true);

  IF (SELECT count(*) FROM public.audit_log
      WHERE target_type = 'promo_code' AND target_id = v_promo_id::text
        AND action_type IN ('promotion_created','promotion_updated','promotion_deactivated','promotion_activated')) <> 4
  THEN
    RAISE EXCEPTION 'Audit admin incomplet pour %', v_promo_id;
  END IF;
END;
$$;

RESET ROLE;
ROLLBACK;

\echo 'Promotion runtime security validation: PASS'
