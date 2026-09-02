-- LOT 1G-A : moteur de codes promotionnels transversal.
-- Les remises sont calculees en centimes entiers dans PostgreSQL. Les checkouts
-- restent proprietaires de leur prix catalogue et appellent exclusivement les
-- RPC reservees au service_role avec un contexte et un montant deja verifies cote serveur.

BEGIN;

CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL,
  discount_value numeric NOT NULL,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer,
  max_uses_per_user integer,
  restricted_email text,
  minimum_final_amount_cents integer,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_code_format_check CHECK (
    code = upper(btrim(code))
    AND code ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$'
  ),
  CONSTRAINT promo_codes_discount_check CHECK (
    discount_value NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    AND (
      (discount_type = 'percent' AND discount_value > 0 AND discount_value <= 100)
      OR (discount_type = 'fixed_amount' AND discount_value > 0 AND discount_value = trunc(discount_value))
    )
  ),
  CONSTRAINT promo_codes_dates_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT promo_codes_max_uses_check CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT promo_codes_max_uses_per_user_check CHECK (max_uses_per_user IS NULL OR max_uses_per_user > 0),
  CONSTRAINT promo_codes_minimum_final_amount_check CHECK (
    minimum_final_amount_cents IS NULL OR minimum_final_amount_cents >= 0
  ),
  CONSTRAINT promo_codes_restricted_email_check CHECK (
    restricted_email IS NULL OR (
      restricted_email = lower(btrim(restricted_email))
      AND char_length(restricted_email) BETWEEN 3 AND 254
      AND restricted_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    )
  )
);

CREATE TABLE public.promo_code_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE RESTRICT,
  target_type text NOT NULL,
  target_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_code_targets_type_check CHECK (target_type IN ('all', 'diagnostic', 'course', 'product')),
  CONSTRAINT promo_code_targets_key_check CHECK (
    (target_type = 'all' AND target_key = 'all')
    OR (target_type <> 'all'
      AND target_key = btrim(target_key)
      AND char_length(target_key) BETWEEN 1 AND 200)
  ),
  CONSTRAINT promo_code_targets_unique UNIQUE (promo_code_id, target_type, target_key)
);

CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  order_context_type text NOT NULL,
  order_context_id uuid NOT NULL,
  target_type text NOT NULL,
  target_key text NOT NULL,
  original_amount_cents integer NOT NULL,
  discount_amount_cents integer NOT NULL,
  final_amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  reserved_at timestamptz NOT NULL DEFAULT now(),
  reservation_expires_at timestamptz,
  consumed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_redemptions_context_format_check CHECK (
    order_context_type ~ '^[a-z][a-z0-9_]{1,63}$'
  ),
  CONSTRAINT promo_redemptions_target_type_check CHECK (target_type IN ('diagnostic', 'course', 'product')),
  CONSTRAINT promo_redemptions_target_key_check CHECK (
    target_key = btrim(target_key) AND char_length(target_key) BETWEEN 1 AND 200
  ),
  CONSTRAINT promo_redemptions_amounts_check CHECK (
    original_amount_cents >= 0
    AND discount_amount_cents >= 0
    AND discount_amount_cents <= original_amount_cents
    AND final_amount_cents = original_amount_cents - discount_amount_cents
    AND final_amount_cents >= 0
  ),
  CONSTRAINT promo_redemptions_status_check CHECK (status IN ('reserved', 'consumed', 'released')),
  CONSTRAINT promo_redemptions_state_check CHECK (
    (status = 'reserved'
      AND reservation_expires_at IS NOT NULL AND reservation_expires_at > reserved_at
      AND consumed_at IS NULL AND released_at IS NULL)
    OR (status = 'consumed'
      AND reservation_expires_at IS NULL AND consumed_at IS NOT NULL AND released_at IS NULL)
    OR (status = 'released'
      AND reservation_expires_at IS NULL AND consumed_at IS NULL AND released_at IS NOT NULL)
  ),
  CONSTRAINT promo_redemptions_one_per_order_context UNIQUE (order_context_type, order_context_id)
);

CREATE INDEX promo_redemptions_quota_idx
  ON public.promo_redemptions(promo_code_id, status, reservation_expires_at);
CREATE INDEX promo_redemptions_user_quota_idx
  ON public.promo_redemptions(promo_code_id, user_id, status, reservation_expires_at);
CREATE INDEX promo_redemptions_expiry_idx
  ON public.promo_redemptions(reservation_expires_at)
  WHERE status = 'reserved';

COMMENT ON TABLE public.promo_codes IS
  'Regles de promotion communes : les montants fixes sont exprimes en centimes et les codes sont normalises en majuscules.';
COMMENT ON TABLE public.promo_code_targets IS
  'Cibles des promotions. all/all cible le catalogue FormaPrompt ; course utilise une cle metier stable de la formation.';
COMMENT ON TABLE public.promo_redemptions IS
  'Journal minimal des reservations et consommations de promotions, idempotent par contexte de commande.';

CREATE OR REPLACE FUNCTION private.normalize_promo_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  NEW.restricted_email := CASE
    WHEN NEW.restricted_email IS NULL THEN NULL
    ELSE lower(btrim(NEW.restricted_email))
  END;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER promo_codes_normalize_before_write
BEFORE INSERT OR UPDATE ON public.promo_codes
FOR EACH ROW EXECUTE FUNCTION private.normalize_promo_code();

CREATE TRIGGER promo_redemptions_set_updated_at
BEFORE UPDATE ON public.promo_redemptions
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_targets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture administrative des promotions"
ON public.promo_codes FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));
CREATE POLICY "Lecture administrative des cibles promotionnelles"
ON public.promo_code_targets FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));
CREATE POLICY "Lecture administrative des utilisations promotionnelles"
ON public.promo_redemptions FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

REVOKE ALL ON public.promo_codes, public.promo_code_targets, public.promo_redemptions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.promo_codes, public.promo_code_targets, public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_codes, public.promo_code_targets, public.promo_redemptions TO service_role;

CREATE OR REPLACE FUNCTION private.promo_invalid()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Ce code n''est pas valide ou n''est plus disponible.' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION private.validate_promo_code(
  p_code text,
  p_user_id uuid,
  p_email text,
  p_target_type text,
  p_target_key text,
  p_original_amount_cents integer
)
RETURNS TABLE (
  valid boolean,
  normalized_code text,
  original_amount_cents integer,
  discount_amount_cents integer,
  final_amount_cents integer,
  message text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_promo public.promo_codes%ROWTYPE;
  v_normalized_code text := upper(btrim(coalesce(p_code, '')));
  v_actor_email text := lower(btrim(coalesce(p_email, '')));
  v_discount integer;
  v_final integer;
  v_total_uses integer;
  v_user_uses integer;
BEGIN
  IF p_user_id IS NULL
    OR p_target_type IS NULL OR p_target_type NOT IN ('diagnostic', 'course', 'product')
    OR char_length(btrim(coalesce(p_target_key, ''))) = 0
    OR p_original_amount_cents IS NULL OR p_original_amount_cents < 0
    OR char_length(v_actor_email) NOT BETWEEN 3 AND 254
    OR v_actor_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  THEN
    PERFORM private.promo_invalid();
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE code = v_normalized_code
    AND active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now());
  IF NOT FOUND THEN
    PERFORM private.promo_invalid();
  END IF;

  IF v_promo.restricted_email IS NOT NULL AND v_promo.restricted_email <> v_actor_email THEN
    PERFORM private.promo_invalid();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.promo_code_targets targets
    WHERE targets.promo_code_id = v_promo.id
      AND ((targets.target_type = 'all' AND targets.target_key = 'all')
        OR (targets.target_type = p_target_type AND targets.target_key = btrim(p_target_key)))
  ) THEN
    PERFORM private.promo_invalid();
  END IF;

  SELECT count(*)::integer INTO v_total_uses
  FROM public.promo_redemptions redemptions
  WHERE redemptions.promo_code_id = v_promo.id
    AND (redemptions.status = 'consumed'
      OR (redemptions.status = 'reserved' AND redemptions.reservation_expires_at > now()));
  IF v_promo.max_uses IS NOT NULL AND v_total_uses >= v_promo.max_uses THEN
    PERFORM private.promo_invalid();
  END IF;

  SELECT count(*)::integer INTO v_user_uses
  FROM public.promo_redemptions redemptions
  WHERE redemptions.promo_code_id = v_promo.id
    AND redemptions.user_id = p_user_id
    AND (redemptions.status = 'consumed'
      OR (redemptions.status = 'reserved' AND redemptions.reservation_expires_at > now()));
  IF v_promo.max_uses_per_user IS NOT NULL AND v_user_uses >= v_promo.max_uses_per_user THEN
    PERFORM private.promo_invalid();
  END IF;

  v_discount := CASE v_promo.discount_type
    WHEN 'percent' THEN floor((p_original_amount_cents::numeric * v_promo.discount_value / 100) + 0.5)::integer
    WHEN 'fixed_amount' THEN least(v_promo.discount_value, p_original_amount_cents::numeric)::integer
  END;
  v_discount := least(v_discount, p_original_amount_cents);
  v_final := p_original_amount_cents - v_discount;
  IF v_promo.minimum_final_amount_cents IS NOT NULL
    AND v_final < v_promo.minimum_final_amount_cents
  THEN
    PERFORM private.promo_invalid();
  END IF;

  RETURN QUERY SELECT true, v_promo.code, p_original_amount_cents, v_discount, v_final, 'Le code est applicable.';
END;
$$;

CREATE OR REPLACE FUNCTION private.reserve_promo_code(
  p_code text,
  p_user_id uuid,
  p_email text,
  p_target_type text,
  p_target_key text,
  p_original_amount_cents integer,
  p_order_context_type text,
  p_order_context_id uuid
)
RETURNS TABLE (
  redemption_id uuid,
  normalized_code text,
  original_amount_cents integer,
  discount_amount_cents integer,
  final_amount_cents integer,
  status text,
  reservation_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_promo public.promo_codes%ROWTYPE;
  v_existing public.promo_redemptions%ROWTYPE;
  v_quote record;
  v_normalized_code text := upper(btrim(coalesce(p_code, '')));
  v_actor_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF p_user_id IS NULL
    OR p_target_type IS NULL OR p_target_type NOT IN ('diagnostic', 'course', 'product')
    OR char_length(btrim(coalesce(p_target_key, ''))) = 0
    OR p_original_amount_cents IS NULL OR p_original_amount_cents < 0
    OR char_length(v_actor_email) NOT BETWEEN 3 AND 254
    OR v_actor_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    OR p_order_context_type IS NULL
    OR p_order_context_type !~ '^[a-z][a-z0-9_]{1,63}$'
    OR p_order_context_id IS NULL
  THEN
    PERFORM private.promo_invalid();
  END IF;

  -- Ce verrou par code serialise le controle des quotas et l insertion de la
  -- reservation : le dernier usage ne peut donc pas etre reserve deux fois.
  SELECT * INTO v_promo FROM public.promo_codes WHERE code = v_normalized_code FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM private.promo_invalid();
  END IF;

  SELECT * INTO v_existing
  FROM public.promo_redemptions
  WHERE order_context_type = p_order_context_type AND order_context_id = p_order_context_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.promo_code_id IS DISTINCT FROM v_promo.id
      OR v_existing.user_id IS DISTINCT FROM p_user_id
      OR v_existing.target_type IS DISTINCT FROM p_target_type
      OR v_existing.target_key IS DISTINCT FROM btrim(p_target_key)
      OR v_existing.original_amount_cents IS DISTINCT FROM p_original_amount_cents
      OR v_existing.status = 'released'
      OR (v_existing.status = 'reserved' AND v_existing.reservation_expires_at <= now())
    THEN
      PERFORM private.promo_invalid();
    END IF;
    RETURN QUERY SELECT v_existing.id, v_promo.code, v_existing.original_amount_cents,
      v_existing.discount_amount_cents, v_existing.final_amount_cents, v_existing.status,
      v_existing.reservation_expires_at;
    RETURN;
  END IF;

  UPDATE public.promo_redemptions AS redemption
  SET status = 'released', released_at = now(), reservation_expires_at = NULL
  WHERE redemption.promo_code_id = v_promo.id
    AND redemption.status = 'reserved'
    AND redemption.reservation_expires_at <= now();

  SELECT * INTO v_quote FROM private.validate_promo_code(
    p_code, p_user_id, p_email, p_target_type, p_target_key, p_original_amount_cents
  );
  BEGIN
    INSERT INTO public.promo_redemptions AS redemption (
      promo_code_id, user_id, order_context_type, order_context_id, target_type, target_key,
      original_amount_cents, discount_amount_cents, final_amount_cents, status,
      reserved_at, reservation_expires_at
    ) VALUES (
      v_promo.id, p_user_id, p_order_context_type, p_order_context_id, p_target_type, btrim(p_target_key),
      v_quote.original_amount_cents, v_quote.discount_amount_cents, v_quote.final_amount_cents, 'reserved',
      now(), now() + interval '30 minutes'
    ) RETURNING redemption.id, v_promo.code, redemption.original_amount_cents,
      redemption.discount_amount_cents, redemption.final_amount_cents,
      redemption.status, redemption.reservation_expires_at
    INTO redemption_id, normalized_code, original_amount_cents, discount_amount_cents,
      final_amount_cents, status, reservation_expires_at;
  EXCEPTION
    WHEN unique_violation THEN
      -- Deux codes differents peuvent viser simultanement le meme contexte.
      -- L unicite reste la garde finale sans exposer le nom de la contrainte.
      PERFORM private.promo_invalid();
  END;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION private.consume_promo_redemption(
  p_redemption_id uuid,
  p_order_context_type text,
  p_order_context_id uuid
)
RETURNS TABLE (redemption_id uuid, status text, consumed_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_redemption public.promo_redemptions%ROWTYPE;
BEGIN
  SELECT * INTO v_redemption FROM public.promo_redemptions
  WHERE id = p_redemption_id
    AND order_context_type = p_order_context_type
    AND order_context_id = p_order_context_id
  FOR UPDATE;
  IF NOT FOUND THEN PERFORM private.promo_invalid(); END IF;
  IF v_redemption.status = 'consumed' THEN
    RETURN QUERY SELECT v_redemption.id, v_redemption.status, v_redemption.consumed_at;
    RETURN;
  END IF;
  IF v_redemption.status <> 'reserved' THEN
    PERFORM private.promo_invalid();
  END IF;
  IF v_redemption.reservation_expires_at <= now() THEN
    UPDATE public.promo_redemptions AS redemption
    SET status='released', released_at=now(), reservation_expires_at=NULL
    WHERE redemption.id = v_redemption.id
    RETURNING redemption.id, redemption.status, NULL::timestamptz
    INTO redemption_id, status, consumed_at;
    RETURN NEXT;
    RETURN;
  END IF;
  UPDATE public.promo_redemptions AS redemption
  SET status='consumed', consumed_at=now(), reservation_expires_at=NULL
  WHERE redemption.id = v_redemption.id
  RETURNING redemption.id, redemption.status, redemption.consumed_at INTO redemption_id, status, consumed_at;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION private.release_promo_redemption(
  p_redemption_id uuid,
  p_order_context_type text,
  p_order_context_id uuid
)
RETURNS TABLE (redemption_id uuid, status text, released_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_redemption public.promo_redemptions%ROWTYPE;
BEGIN
  SELECT * INTO v_redemption FROM public.promo_redemptions
  WHERE id = p_redemption_id
    AND order_context_type = p_order_context_type
    AND order_context_id = p_order_context_id
  FOR UPDATE;
  IF NOT FOUND THEN PERFORM private.promo_invalid(); END IF;
  IF v_redemption.status = 'reserved' THEN
    UPDATE public.promo_redemptions AS redemption
    SET status='released', released_at=now(), reservation_expires_at=NULL
    WHERE redemption.id = v_redemption.id
    RETURNING redemption.id, redemption.status, redemption.released_at INTO redemption_id, status, released_at;
  ELSE
    redemption_id := v_redemption.id;
    status := v_redemption.status;
    released_at := v_redemption.released_at;
  END IF;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION private.release_expired_promo_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_released integer;
BEGIN
  UPDATE public.promo_redemptions
  SET status='released', released_at=now(), reservation_expires_at=NULL
  WHERE status='reserved' AND reservation_expires_at <= now();
  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

-- PostgREST n'expose que les schemas d'API configures. Ces wrappers publics
-- constituent donc l'unique surface RPC des futures Edge Functions. Ils
-- restent SECURITY INVOKER et ne sont executables que par service_role.
CREATE OR REPLACE FUNCTION public.validate_promo_code_for_checkout(
  p_code text,
  p_user_id uuid,
  p_email text,
  p_target_type text,
  p_target_key text,
  p_original_amount_cents integer
)
RETURNS TABLE (
  valid boolean,
  normalized_code text,
  original_amount_cents integer,
  discount_amount_cents integer,
  final_amount_cents integer,
  message text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.validate_promo_code(
    p_code, p_user_id, p_email, p_target_type, p_target_key, p_original_amount_cents
  );
$$;

CREATE OR REPLACE FUNCTION public.reserve_promo_code_for_checkout(
  p_code text,
  p_user_id uuid,
  p_email text,
  p_target_type text,
  p_target_key text,
  p_original_amount_cents integer,
  p_order_context_type text,
  p_order_context_id uuid
)
RETURNS TABLE (
  redemption_id uuid,
  normalized_code text,
  original_amount_cents integer,
  discount_amount_cents integer,
  final_amount_cents integer,
  status text,
  reservation_expires_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.reserve_promo_code(
    p_code, p_user_id, p_email, p_target_type, p_target_key,
    p_original_amount_cents, p_order_context_type, p_order_context_id
  );
$$;

CREATE OR REPLACE FUNCTION public.consume_promo_redemption_for_checkout(
  p_redemption_id uuid,
  p_order_context_type text,
  p_order_context_id uuid
)
RETURNS TABLE (redemption_id uuid, status text, consumed_at timestamptz)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.consume_promo_redemption(
    p_redemption_id, p_order_context_type, p_order_context_id
  );
$$;

CREATE OR REPLACE FUNCTION public.release_promo_redemption_for_checkout(
  p_redemption_id uuid,
  p_order_context_type text,
  p_order_context_id uuid
)
RETURNS TABLE (redemption_id uuid, status text, released_at timestamptz)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.release_promo_redemption(
    p_redemption_id, p_order_context_type, p_order_context_id
  );
$$;

CREATE OR REPLACE FUNCTION public.release_expired_promo_reservations()
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.release_expired_promo_reservations();
$$;

REVOKE ALL ON FUNCTION private.normalize_promo_code() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.promo_invalid() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.validate_promo_code(text, uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reserve_promo_code(text, uuid, text, text, text, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.consume_promo_redemption(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.release_promo_redemption(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.release_expired_promo_reservations() FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.promo_invalid() TO service_role;
GRANT EXECUTE ON FUNCTION private.validate_promo_code(text, uuid, text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION private.reserve_promo_code(text, uuid, text, text, text, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.consume_promo_redemption(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.release_promo_redemption(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.release_expired_promo_reservations() TO service_role;

REVOKE ALL ON FUNCTION public.validate_promo_code_for_checkout(text, uuid, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_promo_code_for_checkout(text, uuid, text, text, text, integer, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_promo_redemption_for_checkout(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_promo_redemption_for_checkout(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_expired_promo_reservations()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_promo_code_for_checkout(text, uuid, text, text, text, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_promo_code_for_checkout(text, uuid, text, text, text, integer, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_promo_redemption_for_checkout(uuid, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_promo_redemption_for_checkout(uuid, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_promo_reservations()
  TO service_role;

COMMIT;
