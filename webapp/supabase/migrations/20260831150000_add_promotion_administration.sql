-- LOT 1G-D : administration stricte du moteur promotionnel transversal.
-- Les tables restent privees. Les mutations admin remplacent promotion et
-- targets dans une transaction unique et utilisent le journal audit_log existant.

BEGIN;

ALTER TABLE public.promo_codes
  ADD CONSTRAINT promo_codes_user_quota_coherence_check CHECK (
    max_uses IS NULL OR max_uses_per_user IS NULL OR max_uses_per_user <= max_uses
  );

CREATE OR REPLACE FUNCTION private.prevent_promo_code_identifier_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'Le code promotionnel est immuable. Creez une nouvelle promotion.'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_promo_code_identifier_change()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER promo_codes_prevent_identifier_change
BEFORE UPDATE OF code ON public.promo_codes
FOR EACH ROW EXECUTE FUNCTION private.prevent_promo_code_identifier_change();

CREATE OR REPLACE FUNCTION private.require_promotion_admin()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action reservee au role admin.' USING ERRCODE = '42501';
  END IF;
  RETURN v_actor;
END;
$$;

CREATE OR REPLACE FUNCTION private.normalize_promotion_admin_targets(p_targets jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_target jsonb;
  v_type text;
  v_key text;
  v_fingerprint text;
  v_seen jsonb := '{}'::jsonb;
  v_result jsonb := '[]'::jsonb;
  v_has_global boolean := false;
BEGIN
  IF jsonb_typeof(p_targets) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_targets) = 0
    OR jsonb_array_length(p_targets) > 50
  THEN
    RAISE EXCEPTION 'Au moins une cible valide est requise.' USING ERRCODE = '22023';
  END IF;

  FOR v_target IN SELECT value FROM jsonb_array_elements(p_targets)
  LOOP
    IF jsonb_typeof(v_target) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Cible promotionnelle invalide.' USING ERRCODE = '22023';
    END IF;
    v_type := lower(btrim(coalesce(v_target->>'target_type', '')));
    v_key := btrim(coalesce(v_target->>'target_key', ''));
    IF v_type NOT IN ('all', 'diagnostic', 'course', 'product')
      OR v_key !~ '^[a-z0-9][a-z0-9_-]{0,199}$'
      OR (v_type = 'all' AND v_key <> 'all')
      OR (v_type <> 'all' AND v_key = 'all')
      OR (v_type = 'diagnostic' AND v_key <> 'diagnostic-ia-express')
    THEN
      RAISE EXCEPTION 'Cible promotionnelle invalide.' USING ERRCODE = '22023';
    END IF;
    v_fingerprint := v_type || ':' || v_key;
    IF v_seen ? v_fingerprint THEN
      RAISE EXCEPTION 'Une cible promotionnelle ne peut pas etre dupliquee.' USING ERRCODE = '22023';
    END IF;
    v_seen := v_seen || jsonb_build_object(v_fingerprint, true);
    v_has_global := v_has_global OR v_type = 'all';
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'target_type', v_type,
      'target_key', v_key
    ));
  END LOOP;

  IF v_has_global AND jsonb_array_length(v_result) > 1 THEN
    RAISE EXCEPTION 'La cible globale ne peut pas etre combinee avec une autre cible.'
      USING ERRCODE = '22023';
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION private.validate_promotion_admin_values(
  p_description text,
  p_discount_type text,
  p_discount_value numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_uses integer,
  p_max_uses_per_user integer,
  p_restricted_email text,
  p_minimum_final_amount_cents integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_email text := nullif(lower(btrim(coalesce(p_restricted_email, ''))), '');
BEGIN
  IF p_description IS NOT NULL AND char_length(btrim(p_description)) > 2000 THEN
    RAISE EXCEPTION 'La description est trop longue.' USING ERRCODE = '22023';
  END IF;
  IF p_discount_value IS NULL
    OR p_discount_value IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    OR NOT (
      (p_discount_type = 'percent' AND p_discount_value > 0 AND p_discount_value <= 100)
      OR (p_discount_type = 'fixed_amount' AND p_discount_value > 0
        AND p_discount_value = trunc(p_discount_value))
    )
  THEN
    RAISE EXCEPTION 'Valeur de remise invalide.' USING ERRCODE = '22023';
  END IF;
  IF p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'La date de fin doit etre posterieure a la date de debut.' USING ERRCODE = '22023';
  END IF;
  IF (p_max_uses IS NOT NULL AND p_max_uses <= 0)
    OR (p_max_uses_per_user IS NOT NULL AND p_max_uses_per_user <= 0)
    OR (p_max_uses IS NOT NULL AND p_max_uses_per_user IS NOT NULL
      AND p_max_uses_per_user > p_max_uses)
  THEN
    RAISE EXCEPTION 'Quotas promotionnels invalides.' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NOT NULL AND (
    char_length(v_email) NOT BETWEEN 3 AND 254
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ) THEN
    RAISE EXCEPTION 'Adresse e-mail restreinte invalide.' USING ERRCODE = '22023';
  END IF;
  IF p_minimum_final_amount_cents IS NOT NULL AND p_minimum_final_amount_cents < 0 THEN
    RAISE EXCEPTION 'Montant final minimum invalide.' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.require_promotion_admin()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.normalize_promotion_admin_targets(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.validate_promotion_admin_values(text,text,numeric,timestamptz,timestamptz,integer,integer,text,integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_list_promotions()
RETURNS TABLE (
  id uuid,
  code text,
  description text,
  discount_type text,
  discount_value numeric,
  active boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer,
  max_uses_per_user integer,
  restricted_email text,
  restricted_email_present boolean,
  minimum_final_amount_cents integer,
  targets jsonb,
  consumed_uses bigint,
  active_reservations bigint,
  released_uses bigint,
  remaining_uses integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_promotion_admin();
  RETURN QUERY
  SELECT codes.id, codes.code, codes.description, codes.discount_type,
    codes.discount_value, codes.active, codes.starts_at, codes.ends_at,
    codes.max_uses, codes.max_uses_per_user, codes.restricted_email,
    codes.restricted_email IS NOT NULL, codes.minimum_final_amount_cents,
    coalesce(target_stats.targets, '[]'::jsonb),
    coalesce(use_stats.consumed_uses, 0),
    coalesce(use_stats.active_reservations, 0),
    coalesce(use_stats.released_uses, 0),
    CASE WHEN codes.max_uses IS NULL THEN NULL
      ELSE greatest(codes.max_uses
        - coalesce(use_stats.consumed_uses, 0)::integer
        - coalesce(use_stats.active_reservations, 0)::integer, 0)
    END,
    codes.created_at, codes.updated_at
  FROM public.promo_codes AS codes
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'target_type', targets.target_type,
      'target_key', targets.target_key
    ) ORDER BY targets.target_type, targets.target_key) AS targets
    FROM public.promo_code_targets AS targets
    WHERE targets.promo_code_id = codes.id
  ) AS target_stats ON true
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE redemptions.status = 'consumed') AS consumed_uses,
      count(*) FILTER (WHERE redemptions.status = 'reserved'
        AND redemptions.reservation_expires_at > now()) AS active_reservations,
      count(*) FILTER (WHERE redemptions.status = 'released') AS released_uses
    FROM public.promo_redemptions AS redemptions
    WHERE redemptions.promo_code_id = codes.id
  ) AS use_stats ON true
  ORDER BY codes.created_at DESC, codes.code;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_promotion(
  p_code text,
  p_description text,
  p_discount_type text,
  p_discount_value numeric,
  p_active boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_uses integer,
  p_max_uses_per_user integer,
  p_restricted_email text,
  p_minimum_final_amount_cents integer,
  p_targets jsonb
)
RETURNS public.promo_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_promotion_admin();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_targets jsonb := private.normalize_promotion_admin_targets(p_targets);
  v_result public.promo_codes%ROWTYPE;
BEGIN
  IF v_code !~ '^[A-Z0-9][A-Z0-9_-]{0,63}$' THEN
    RAISE EXCEPTION 'Code promotionnel invalide.' USING ERRCODE = '22023';
  END IF;
  IF p_active IS NULL THEN
    RAISE EXCEPTION 'Etat promotionnel invalide.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.validate_promotion_admin_values(
    p_description, p_discount_type, p_discount_value, p_starts_at, p_ends_at,
    p_max_uses, p_max_uses_per_user, p_restricted_email,
    p_minimum_final_amount_cents
  );

  BEGIN
    INSERT INTO public.promo_codes (
      code, description, discount_type, discount_value, active, starts_at, ends_at,
      max_uses, max_uses_per_user, restricted_email,
      minimum_final_amount_cents, created_by
    ) VALUES (
      v_code, nullif(btrim(coalesce(p_description, '')), ''), p_discount_type,
      p_discount_value, p_active, p_starts_at, p_ends_at, p_max_uses,
      p_max_uses_per_user, nullif(lower(btrim(coalesce(p_restricted_email, ''))), ''),
      p_minimum_final_amount_cents, v_actor
    ) RETURNING * INTO v_result;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ce code promotionnel existe deja.' USING ERRCODE = '23505';
  END;

  INSERT INTO public.promo_code_targets (promo_code_id, target_type, target_key)
  SELECT v_result.id, item.value->>'target_type', item.value->>'target_key'
  FROM jsonb_array_elements(v_targets) AS item(value);

  INSERT INTO public.audit_log (
    actor_user_id, action_type, target_type, target_id, reason, new_state, metadata
  ) VALUES (
    v_actor, 'promotion_created', 'promo_code', v_result.id::text,
    'Creation administrative d une promotion.',
    jsonb_build_object(
      'active', v_result.active,
      'discount_type', v_result.discount_type,
      'discount_value', v_result.discount_value,
      'restricted_email_present', v_result.restricted_email IS NOT NULL,
      'target_count', jsonb_array_length(v_targets)
    ),
    jsonb_build_object('target_count', jsonb_array_length(v_targets))
  );
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_promotion(
  p_promo_code_id uuid,
  p_description text,
  p_discount_type text,
  p_discount_value numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_uses integer,
  p_max_uses_per_user integer,
  p_restricted_email text,
  p_minimum_final_amount_cents integer,
  p_targets jsonb
)
RETURNS public.promo_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_promotion_admin();
  v_targets jsonb := private.normalize_promotion_admin_targets(p_targets);
  v_existing public.promo_codes%ROWTYPE;
  v_result public.promo_codes%ROWTYPE;
  v_previous_target_count integer;
BEGIN
  IF p_promo_code_id IS NULL THEN
    RAISE EXCEPTION 'Promotion introuvable.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.validate_promotion_admin_values(
    p_description, p_discount_type, p_discount_value, p_starts_at, p_ends_at,
    p_max_uses, p_max_uses_per_user, p_restricted_email,
    p_minimum_final_amount_cents
  );

  SELECT * INTO v_existing FROM public.promo_codes AS codes
  WHERE codes.id = p_promo_code_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promotion introuvable.' USING ERRCODE = 'P0002';
  END IF;
  SELECT count(*)::integer INTO v_previous_target_count
  FROM public.promo_code_targets AS targets
  WHERE targets.promo_code_id = p_promo_code_id;

  UPDATE public.promo_codes AS codes
  SET description = nullif(btrim(coalesce(p_description, '')), ''),
      discount_type = p_discount_type,
      discount_value = p_discount_value,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      max_uses = p_max_uses,
      max_uses_per_user = p_max_uses_per_user,
      restricted_email = nullif(lower(btrim(coalesce(p_restricted_email, ''))), ''),
      minimum_final_amount_cents = p_minimum_final_amount_cents,
      updated_at = now()
  WHERE codes.id = p_promo_code_id
  RETURNING * INTO v_result;

  DELETE FROM public.promo_code_targets AS targets
  WHERE targets.promo_code_id = p_promo_code_id;
  INSERT INTO public.promo_code_targets (promo_code_id, target_type, target_key)
  SELECT p_promo_code_id, item.value->>'target_type', item.value->>'target_key'
  FROM jsonb_array_elements(v_targets) AS item(value);

  INSERT INTO public.audit_log (
    actor_user_id, action_type, target_type, target_id, reason,
    previous_state, new_state, metadata
  ) VALUES (
    v_actor, 'promotion_updated', 'promo_code', p_promo_code_id::text,
    'Modification administrative d une promotion.',
    jsonb_build_object(
      'active', v_existing.active,
      'discount_type', v_existing.discount_type,
      'discount_value', v_existing.discount_value,
      'restricted_email_present', v_existing.restricted_email IS NOT NULL,
      'target_count', v_previous_target_count
    ),
    jsonb_build_object(
      'active', v_result.active,
      'discount_type', v_result.discount_type,
      'discount_value', v_result.discount_value,
      'restricted_email_present', v_result.restricted_email IS NOT NULL,
      'target_count', jsonb_array_length(v_targets)
    ),
    jsonb_build_object('targets_replaced', true)
  );
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_promotion_active(
  p_promo_code_id uuid,
  p_active boolean
)
RETURNS public.promo_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_promotion_admin();
  v_existing public.promo_codes%ROWTYPE;
  v_result public.promo_codes%ROWTYPE;
BEGIN
  IF p_promo_code_id IS NULL OR p_active IS NULL THEN
    RAISE EXCEPTION 'Promotion ou etat invalide.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_existing FROM public.promo_codes AS codes
  WHERE codes.id = p_promo_code_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promotion introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_existing.active = p_active THEN
    RETURN v_existing;
  END IF;

  UPDATE public.promo_codes AS codes
  SET active = p_active, updated_at = now()
  WHERE codes.id = p_promo_code_id
  RETURNING * INTO v_result;

  INSERT INTO public.audit_log (
    actor_user_id, action_type, target_type, target_id, reason,
    previous_state, new_state
  ) VALUES (
    v_actor,
    CASE WHEN p_active THEN 'promotion_activated' ELSE 'promotion_deactivated' END,
    'promo_code', p_promo_code_id::text,
    CASE WHEN p_active THEN 'Reactivation administrative d une promotion.'
      ELSE 'Desactivation administrative d une promotion.' END,
    jsonb_build_object('active', v_existing.active),
    jsonb_build_object('active', v_result.active)
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_promotions()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_create_promotion(text,text,text,numeric,boolean,timestamptz,timestamptz,integer,integer,text,integer,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_update_promotion(uuid,text,text,numeric,timestamptz,timestamptz,integer,integer,text,integer,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_set_promotion_active(uuid,boolean)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.admin_list_promotions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_promotion(text,text,text,numeric,boolean,timestamptz,timestamptz,integer,integer,text,integer,jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_promotion(uuid,text,text,numeric,timestamptz,timestamptz,integer,integer,text,integer,jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_promotion_active(uuid,boolean)
  TO authenticated;

COMMIT;
