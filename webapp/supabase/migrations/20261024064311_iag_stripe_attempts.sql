-- DRAFT NON EXECUTE, après 03 et 04. Aucun appel Stripe, aucun backfill.
BEGIN;
CREATE TABLE private.iag_stripe_attempts (
  checkout_intent_id uuid PRIMARY KEY REFERENCES public.commercial_checkout_intents(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('ready', 'in_flight', 'known')),
  claim_id uuid,
  stripe_checkout_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  CHECK ((state = 'ready' AND claim_id IS NULL AND claimed_at IS NULL)
    OR (state IN ('in_flight', 'known') AND claim_id IS NOT NULL AND claimed_at IS NOT NULL)),
  CHECK (state <> 'known' OR stripe_checkout_session_id IS NOT NULL)
);
ALTER TABLE private.iag_stripe_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.iag_stripe_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.iag_stripe_attempts TO service_role;

CREATE FUNCTION public.prepare_iag_course_promotion_checkout(
  p_checkout_intent_id uuid, p_user_id uuid, p_email text, p_course_id text,
  p_original_amount_cents integer, p_promo_code text DEFAULT NULL
) RETURNS TABLE(checkout_intent_id uuid, promo_redemption_id uuid, normalized_code text,
  original_amount_cents integer, discount_amount_cents integer, final_amount_cents integer,
  reservation_expires_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_intent public.commercial_checkout_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_intent FROM public.commercial_checkout_intents i
  WHERE i.id = p_checkout_intent_id FOR UPDATE;
  IF NOT FOUND OR p_course_id IS DISTINCT FROM 'formation-ia-generative-elearning'
    OR v_intent.course_id IS DISTINCT FROM p_course_id
    OR v_intent.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Intention IAG invalide.' USING ERRCODE = '22023';
  END IF;
  -- Exécute tous les contrôles SQL03 : montant, code, réservation et expiration.
  RETURN QUERY SELECT * FROM public.prepare_course_promotion_checkout(
    p_checkout_intent_id, p_user_id, p_email, p_course_id, p_original_amount_cents, p_promo_code);
  -- Une ancienne configuration verrouillée sans preuve de tentative reste inconnue.
  -- Ne jamais la convertir rétroactivement en ready.
  IF v_intent.checkout_configuration_locked_at IS NULL THEN
    INSERT INTO private.iag_stripe_attempts(checkout_intent_id, state)
    VALUES (p_checkout_intent_id, 'ready');
  END IF;
END;
$$;

CREATE FUNCTION public.claim_iag_stripe_attempt(p_checkout_intent_id uuid, p_user_id uuid)
RETURNS TABLE(claimed boolean, claim_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_intent public.commercial_checkout_intents%ROWTYPE; v_claim uuid;
BEGIN
  SELECT * INTO v_intent FROM public.commercial_checkout_intents i
  WHERE i.id = p_checkout_intent_id FOR UPDATE;
  IF NOT FOUND OR v_intent.user_id IS DISTINCT FROM p_user_id
    OR v_intent.course_id <> 'formation-ia-generative-elearning'
    OR v_intent.status <> 'created' OR v_intent.stripe_checkout_session_id IS NOT NULL
    OR v_intent.checkout_configuration_locked_at IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid; RETURN;
  END IF;
  v_claim := gen_random_uuid();
  UPDATE private.iag_stripe_attempts a
  SET state = 'in_flight', claim_id = v_claim, claimed_at = clock_timestamp()
  WHERE a.checkout_intent_id = p_checkout_intent_id AND a.state = 'ready';
  IF FOUND THEN RETURN QUERY SELECT true, v_claim;
  ELSE RETURN QUERY SELECT false, NULL::uuid;
  END IF;
END;
$$;

CREATE FUNCTION public.record_iag_stripe_session(
  p_checkout_intent_id uuid, p_user_id uuid, p_claim_id uuid, p_session_id text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_intent public.commercial_checkout_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_intent FROM public.commercial_checkout_intents i
  WHERE i.id = p_checkout_intent_id FOR UPDATE;
  IF NOT FOUND OR v_intent.user_id IS DISTINCT FROM p_user_id
    OR v_intent.course_id <> 'formation-ia-generative-elearning'
    OR p_session_id IS NULL OR p_session_id !~ '^cs_[A-Za-z0-9_]+$'
    OR (v_intent.stripe_checkout_session_id IS NOT NULL
      AND v_intent.stripe_checkout_session_id IS DISTINCT FROM p_session_id)
    OR NOT EXISTS (SELECT 1 FROM private.iag_stripe_attempts a
      WHERE a.checkout_intent_id = p_checkout_intent_id AND a.claim_id = p_claim_id
        AND a.state IN ('in_flight', 'known')) THEN RETURN false; END IF;
  UPDATE public.commercial_checkout_intents i
  SET stripe_checkout_session_id = p_session_id,
      status = CASE WHEN i.status = 'created' THEN 'stripe_session_created' ELSE i.status END,
      updated_at = now() WHERE i.id = p_checkout_intent_id;
  UPDATE private.iag_stripe_attempts a SET state = 'known', stripe_checkout_session_id = p_session_id
  WHERE a.checkout_intent_id = p_checkout_intent_id;
  RETURN true;
END;
$$;

CREATE FUNCTION public.reset_iag_course_promotion_checkout(p_checkout_intent_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_intent public.commercial_checkout_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_intent FROM public.commercial_checkout_intents i
  WHERE i.id = p_checkout_intent_id FOR UPDATE;
  IF NOT FOUND OR v_intent.user_id IS DISTINCT FROM p_user_id
    OR v_intent.course_id <> 'formation-ia-generative-elearning'
    OR v_intent.status <> 'created' OR v_intent.stripe_checkout_session_id IS NOT NULL
    OR v_intent.checkout_configuration_locked_at IS NOT NULL
    OR v_intent.promo_redemption_id IS NOT NULL OR v_intent.original_amount_cents IS NOT NULL
    OR v_intent.discount_amount_cents IS NOT NULL OR v_intent.final_amount_cents IS NOT NULL
    OR EXISTS (SELECT 1 FROM private.iag_stripe_attempts a WHERE a.checkout_intent_id = p_checkout_intent_id)
  THEN RETURN false; END IF;
  UPDATE public.commercial_checkout_intents SET status = 'failed',
    failure_code = 'iag_validation_failed_before_lock', updated_at = now()
  WHERE id = p_checkout_intent_id;
  RETURN true;
END;
$$;

-- Même un ancien appel de reset ne doit pas abandonner une configuration IAG
-- verrouillée sans session fiable. Le trigger prend le verrou de la ligne UPDATE.
CREATE FUNCTION private.guard_iag_uncertain_checkout() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.course_id = 'formation-ia-generative-elearning'
    AND OLD.checkout_configuration_locked_at IS NOT NULL
    AND OLD.stripe_checkout_session_id IS NULL AND NEW.stripe_checkout_session_id IS NULL
    AND (NEW.status IN ('failed', 'expired', 'cancelled')
      OR NEW.checkout_request_id IS DISTINCT FROM OLD.checkout_request_id
      OR NEW.checkout_configuration_locked_at IS DISTINCT FROM OLD.checkout_configuration_locked_at
      OR NEW.catalog_price_id IS DISTINCT FROM OLD.catalog_price_id
      OR NEW.stripe_product_id IS DISTINCT FROM OLD.stripe_product_id
      OR NEW.original_amount_cents IS DISTINCT FROM OLD.original_amount_cents
      OR NEW.discount_amount_cents IS DISTINCT FROM OLD.discount_amount_cents
      OR NEW.final_amount_cents IS DISTINCT FROM OLD.final_amount_cents
      OR NEW.promo_redemption_id IS DISTINCT FROM OLD.promo_redemption_id) THEN
    RAISE EXCEPTION 'Résultat Stripe IAG non résolu : clôture interdite.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_iag_uncertain_checkout() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_iag_uncertain_checkout BEFORE UPDATE ON public.commercial_checkout_intents
FOR EACH ROW EXECUTE FUNCTION private.guard_iag_uncertain_checkout();

REVOKE ALL ON FUNCTION public.prepare_iag_course_promotion_checkout(uuid,uuid,text,text,integer,text),
  public.claim_iag_stripe_attempt(uuid,uuid), public.record_iag_stripe_session(uuid,uuid,uuid,text),
  public.reset_iag_course_promotion_checkout(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_iag_course_promotion_checkout(uuid,uuid,text,text,integer,text),
  public.claim_iag_stripe_attempt(uuid,uuid), public.record_iag_stripe_session(uuid,uuid,uuid,text),
  public.reset_iag_course_promotion_checkout(uuid,uuid) TO service_role;
COMMIT;
