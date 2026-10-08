-- Étend les promotions et cadeaux administratifs aux trois formules IA et créativité.
-- Les prix, contrôles Stripe, réservations et remboursements restent ceux du catalogue existant.
-- Un cadeau crée seulement un course_access audité ; aucune purchase ou Checkout fictive.
BEGIN;

CREATE OR REPLACE FUNCTION public.prepare_course_promotion_checkout(p_checkout_intent_id uuid, p_user_id uuid, p_email text, p_course_id text, p_original_amount_cents integer, p_promo_code text DEFAULT NULL::text)
 RETURNS TABLE(checkout_intent_id uuid, promo_redemption_id uuid, normalized_code text, original_amount_cents integer, discount_amount_cents integer, final_amount_cents integer, reservation_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_intent public.commercial_checkout_intents%ROWTYPE;
  v_reservation record;
  v_normalized_code text := nullif(upper(btrim(coalesce(p_promo_code, ''))), '');
  v_redemption_status text;
  v_configuration_was_locked boolean;
BEGIN
  IF p_checkout_intent_id IS NULL OR p_user_id IS NULL OR p_email IS NULL
    OR p_course_id NOT IN (
      'formation-ia', 'formation-ia-act', 'formation-prompt-level-1',
      'excel-initiation-inter', 'excel-initiation-individuel',
      'excel-perfectionnement-inter', 'excel-perfectionnement-individuel',
      'excel-avance-inter', 'excel-avance-individuel',
      'word-initiation-inter', 'word-initiation-individuel',
      'word-perfectionnement-inter', 'word-perfectionnement-individuel',
      'powerpoint-initiation-inter', 'powerpoint-initiation-individuel',
      'ia-creativite-groupe', 'ia-creativite-individuel', 'ia-creativite-ecole-association'
    )
    OR (p_course_id IN (
      'excel-initiation-inter', 'excel-perfectionnement-inter', 'excel-avance-inter',
      'word-initiation-inter', 'word-perfectionnement-inter', 'powerpoint-initiation-inter'
    ) AND p_original_amount_cents IS DISTINCT FROM 69000)
    OR (p_course_id IN (
      'excel-initiation-individuel', 'excel-perfectionnement-individuel', 'excel-avance-individuel',
      'word-initiation-individuel', 'word-perfectionnement-individuel', 'powerpoint-initiation-individuel'
    ) AND p_original_amount_cents IS DISTINCT FROM 99000)
    OR (p_course_id = 'ia-creativite-groupe' AND p_original_amount_cents IS DISTINCT FROM 69000)
    OR (p_course_id = 'ia-creativite-individuel' AND p_original_amount_cents IS DISTINCT FROM 90000)
    OR (p_course_id = 'ia-creativite-ecole-association' AND p_original_amount_cents IS DISTINCT FROM 160000)
    OR p_original_amount_cents IS NULL OR p_original_amount_cents <= 0
  THEN
    PERFORM private.promo_invalid();
  END IF;

  SELECT * INTO v_intent
  FROM public.commercial_checkout_intents AS intents
  WHERE intents.id = p_checkout_intent_id
  FOR UPDATE;

  IF NOT FOUND OR v_intent.user_id IS DISTINCT FROM p_user_id
    OR v_intent.course_id IS DISTINCT FROM p_course_id
    OR v_intent.status NOT IN ('created', 'stripe_session_created')
  THEN
    PERFORM private.promo_invalid();
  END IF;

  v_configuration_was_locked := v_intent.checkout_configuration_locked_at IS NOT NULL;

  IF v_intent.checkout_configuration_locked_at IS NULL THEN
    IF v_normalized_code IS NOT NULL THEN
      SELECT * INTO v_reservation
      FROM private.reserve_promo_code(
        v_normalized_code, p_user_id, p_email, 'course', p_course_id,
        p_original_amount_cents, 'commercial_checkout_intent', p_checkout_intent_id
      );
      IF v_reservation.final_amount_cents <= 0 THEN
        PERFORM private.promo_invalid();
      END IF;

      UPDATE public.promo_redemptions AS redemptions
      SET reservation_expires_at = greatest(redemptions.reservation_expires_at, now() + interval '35 minutes')
      WHERE redemptions.id = v_reservation.redemption_id AND redemptions.status = 'reserved'
      RETURNING redemptions.reservation_expires_at INTO reservation_expires_at;
      IF NOT FOUND THEN PERFORM private.promo_invalid(); END IF;

      UPDATE public.commercial_checkout_intents AS intents
      SET promo_redemption_id = v_reservation.redemption_id,
          original_amount_cents = v_reservation.original_amount_cents,
          discount_amount_cents = v_reservation.discount_amount_cents,
          final_amount_cents = v_reservation.final_amount_cents,
          checkout_configuration_locked_at = now(), updated_at = now()
      WHERE intents.id = p_checkout_intent_id
      RETURNING * INTO v_intent;
    ELSE
      UPDATE public.commercial_checkout_intents AS intents
      SET original_amount_cents = p_original_amount_cents,
          discount_amount_cents = 0,
          final_amount_cents = p_original_amount_cents,
          checkout_configuration_locked_at = now(), updated_at = now()
      WHERE intents.id = p_checkout_intent_id
      RETURNING * INTO v_intent;
    END IF;
  ELSE
    IF v_intent.original_amount_cents IS DISTINCT FROM p_original_amount_cents THEN
      PERFORM private.promo_invalid();
    END IF;
  END IF;

  IF v_intent.promo_redemption_id IS NOT NULL THEN
    SELECT redemptions.reservation_expires_at, codes.code, redemptions.status
    INTO reservation_expires_at, normalized_code, v_redemption_status
    FROM public.promo_redemptions AS redemptions
    JOIN public.promo_codes AS codes ON codes.id = redemptions.promo_code_id
    WHERE redemptions.id = v_intent.promo_redemption_id;
    IF v_redemption_status <> 'reserved' OR reservation_expires_at <= now() THEN
      PERFORM private.promo_invalid();
    END IF;
  ELSE
    reservation_expires_at := NULL;
    normalized_code := NULL;
  END IF;

  IF v_configuration_was_locked
    AND v_normalized_code IS DISTINCT FROM normalized_code
  THEN
    PERFORM private.promo_invalid();
  END IF;

  checkout_intent_id := v_intent.id;
  promo_redemption_id := v_intent.promo_redemption_id;
  original_amount_cents := v_intent.original_amount_cents;
  discount_amount_cents := v_intent.discount_amount_cents;
  final_amount_cents := v_intent.final_amount_cents;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.prepare_course_promotion_checkout(uuid, uuid, text, text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_course_promotion_checkout(uuid, uuid, text, text, integer, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.admin_grant_course_access(p_target_user_id uuid, p_course_id text, p_reason text DEFAULT 'Attribution administrative explicite'::text)
 RETURNS course_access
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_course_id text := btrim(coalesce(p_course_id, ''));
  v_existing public.course_access%ROWTYPE;
  v_result public.course_access%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) < 5 OR char_length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'Un motif de 5 à 2000 caractères est requis.';
  END IF;
  IF v_course_id NOT IN (
    'formation-ia', 'formation-ia-act', 'formation-prompt-level-1',
    'excel-initiation-inter', 'excel-initiation-individuel',
    'excel-perfectionnement-inter', 'excel-perfectionnement-individuel',
    'excel-avance-inter', 'excel-avance-individuel',
    'word-initiation-inter', 'word-initiation-individuel',
    'word-perfectionnement-inter', 'word-perfectionnement-individuel',
    'powerpoint-initiation-inter', 'powerpoint-initiation-individuel',
    'ia-creativite-groupe', 'ia-creativite-individuel', 'ia-creativite-ecole-association'
  ) THEN
    RAISE EXCEPTION 'Formation non autorisée pour une attribution administrative.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Compte apprenant introuvable.' USING ERRCODE = 'P0002';
  END IF;

  SELECT access.* INTO v_existing
  FROM public.course_access AS access
  WHERE access.user_id = p_target_user_id AND access.course_id = v_course_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'active'
      AND (v_existing.expires_at IS NULL OR v_existing.expires_at > now()) THEN
      RETURN v_existing;
    END IF;
    RAISE EXCEPTION 'Un droit existe déjà. Utilisez une décision explicite de cycle de vie.';
  END IF;

  PERFORM set_config('formaprompt.audit_reason', btrim(p_reason), true);
  INSERT INTO public.course_access (
    user_id, course_id, status, access_source, granted_at,
    expires_at, status_changed_at, updated_at
  ) VALUES (
    p_target_user_id, v_course_id, 'active', 'gift', now(),
    NULL, now(), now()
  )
  ON CONFLICT (user_id, course_id) DO NOTHING
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    SELECT access.* INTO v_existing
    FROM public.course_access AS access
    WHERE access.user_id = p_target_user_id AND access.course_id = v_course_id
    FOR UPDATE;
    IF v_existing.id IS NOT NULL
      AND v_existing.status = 'active'
      AND (v_existing.expires_at IS NULL OR v_existing.expires_at > now()) THEN
      RETURN v_existing;
    END IF;
    RAISE EXCEPTION 'Un droit existe déjà. Utilisez une décision explicite de cycle de vie.';
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_grant_course_access(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_course_access(uuid, text, text)
  TO authenticated;

COMMIT;
