-- LOT 1G-C : integration du moteur promotionnel aux checkouts formations.
-- L'intention commerciale reste le contexte stable avant paiement. La RPC
-- historique de paiement reste seule responsable de purchases et des droits.

BEGIN;

ALTER TABLE public.commercial_checkout_intents
  ADD COLUMN checkout_request_id uuid,
  ADD COLUMN original_amount_cents integer,
  ADD COLUMN discount_amount_cents integer,
  ADD COLUMN final_amount_cents integer,
  ADD COLUMN promo_redemption_id uuid REFERENCES public.promo_redemptions(id) ON DELETE RESTRICT,
  ADD COLUMN catalog_price_id text,
  ADD COLUMN stripe_product_id text,
  ADD COLUMN checkout_configuration_locked_at timestamptz,
  ADD CONSTRAINT commercial_checkout_intents_promotion_amounts_check CHECK (
    (original_amount_cents IS NULL AND discount_amount_cents IS NULL AND final_amount_cents IS NULL)
    OR (
      original_amount_cents > 0
      AND discount_amount_cents >= 0
      AND discount_amount_cents <= original_amount_cents
      AND final_amount_cents = original_amount_cents - discount_amount_cents
      AND final_amount_cents > 0
    )
  ),
  ADD CONSTRAINT commercial_checkout_intents_promotion_reference_check CHECK (
    promo_redemption_id IS NOT NULL
    OR discount_amount_cents IS NULL
    OR discount_amount_cents = 0
  ),
  ADD CONSTRAINT commercial_checkout_intents_catalog_price_check CHECK (
    catalog_price_id IS NULL OR catalog_price_id ~ '^price_[A-Za-z0-9_]+$'
  ),
  ADD CONSTRAINT commercial_checkout_intents_product_check CHECK (
    stripe_product_id IS NULL OR stripe_product_id ~ '^prod_[A-Za-z0-9_]+$'
  );

CREATE UNIQUE INDEX commercial_checkout_intents_user_request_uidx
  ON public.commercial_checkout_intents(user_id, checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE UNIQUE INDEX commercial_checkout_intents_promo_redemption_uidx
  ON public.commercial_checkout_intents(promo_redemption_id)
  WHERE promo_redemption_id IS NOT NULL;

COMMENT ON COLUMN public.commercial_checkout_intents.checkout_request_id IS
  'Identifiant de tentative stable genere par le client, toujours rattache a l utilisateur authentifie cote serveur.';
COMMENT ON COLUMN public.commercial_checkout_intents.promo_redemption_id IS
  'Reservation promotionnelle commune associee de maniere unique a cette intention commerciale.';
COMMENT ON COLUMN public.commercial_checkout_intents.checkout_configuration_locked_at IS
  'Fige le cours, le prix catalogue, la remise et le produit Stripe avant la premiere tentative Checkout.';

CREATE OR REPLACE FUNCTION public.prepare_course_checkout_intent(
  p_checkout_request_id uuid,
  p_user_id uuid,
  p_course_id text,
  p_offer_classification text,
  p_sales_context text,
  p_access_start_choice text,
  p_access_activation_policy text,
  p_beneficiary_email text,
  p_buyer_organization_name text,
  p_cgv_document_version_id uuid,
  p_consent_documents jsonb,
  p_catalog_price_id text,
  p_stripe_product_id text
)
RETURNS TABLE (
  id uuid,
  status text,
  stripe_checkout_session_id text,
  promo_redemption_id uuid,
  normalized_code text,
  original_amount_cents integer,
  discount_amount_cents integer,
  final_amount_cents integer,
  checkout_configuration_locked_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_intent public.commercial_checkout_intents%ROWTYPE;
  v_expected_consent_count integer;
  v_normalized_code text;
BEGIN
  IF p_checkout_request_id IS NULL OR p_user_id IS NULL OR p_course_id IS NULL
    OR p_cgv_document_version_id IS NULL OR p_catalog_price_id !~ '^price_[A-Za-z0-9_]+$'
    OR p_stripe_product_id !~ '^prod_[A-Za-z0-9_]+$'
    OR jsonb_typeof(p_consent_documents) <> 'array'
    OR jsonb_array_length(p_consent_documents) = 0
  THEN
    RAISE EXCEPTION 'Intention commerciale invalide.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('course-checkout:' || p_user_id::text || ':' || p_course_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_checkout_request_id::text, 0));
  SELECT * INTO v_intent
  FROM public.commercial_checkout_intents AS intents
  WHERE intents.user_id = p_user_id
    AND intents.checkout_request_id = p_checkout_request_id
  FOR UPDATE;

  IF FOUND AND v_intent.status IN ('failed', 'expired') THEN
    UPDATE public.commercial_checkout_intents
    SET checkout_request_id = NULL, updated_at = now()
    WHERE public.commercial_checkout_intents.id = v_intent.id;
    v_intent.id := NULL;
  END IF;

  IF v_intent.id IS NULL THEN
    SELECT * INTO v_intent
    FROM public.commercial_checkout_intents AS intents
    WHERE intents.user_id = p_user_id
      AND intents.course_id = p_course_id
      AND intents.checkout_request_id IS NOT NULL
      AND intents.status IN ('created', 'stripe_session_created')
    ORDER BY intents.created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_intent.id IS NULL THEN
    INSERT INTO public.commercial_checkout_intents (
      user_id, course_id, offer_classification, sales_context, access_start_choice,
      access_activation_policy, beneficiary_email, buyer_organization_name,
      cgv_document_version_id, checkout_request_id, catalog_price_id, stripe_product_id
    ) VALUES (
      p_user_id, p_course_id, p_offer_classification, p_sales_context, p_access_start_choice,
      p_access_activation_policy, nullif(lower(btrim(p_beneficiary_email)), ''),
      nullif(btrim(p_buyer_organization_name), ''), p_cgv_document_version_id,
      p_checkout_request_id, p_catalog_price_id, p_stripe_product_id
    ) RETURNING * INTO v_intent;

    INSERT INTO public.commercial_consents (
      checkout_intent_id, user_id, course_id, consent_type,
      granted, legal_document_version_id, source
    )
    SELECT
      v_intent.id, p_user_id, p_course_id,
      consent->>'consent_type', true,
      (consent->>'legal_document_version_id')::uuid, 'web_checkout'
    FROM jsonb_array_elements(p_consent_documents) AS consent;
  ELSIF v_intent.course_id IS DISTINCT FROM p_course_id
    OR v_intent.offer_classification IS DISTINCT FROM p_offer_classification
    OR v_intent.sales_context IS DISTINCT FROM p_sales_context
    OR v_intent.access_start_choice IS DISTINCT FROM p_access_start_choice
    OR v_intent.access_activation_policy IS DISTINCT FROM p_access_activation_policy
    OR v_intent.beneficiary_email IS DISTINCT FROM nullif(lower(btrim(p_beneficiary_email)), '')
    OR v_intent.buyer_organization_name IS DISTINCT FROM nullif(btrim(p_buyer_organization_name), '')
    OR v_intent.cgv_document_version_id IS DISTINCT FROM p_cgv_document_version_id
    OR v_intent.catalog_price_id IS DISTINCT FROM p_catalog_price_id
    OR v_intent.stripe_product_id IS DISTINCT FROM p_stripe_product_id
    OR v_intent.status NOT IN ('created', 'stripe_session_created', 'paid')
  THEN
    RAISE EXCEPTION 'Cette tentative de paiement possede deja une autre configuration.' USING ERRCODE = '23505';
  END IF;

  v_expected_consent_count := jsonb_array_length(p_consent_documents);
  IF (SELECT count(*) FROM public.commercial_consents AS consents WHERE consents.checkout_intent_id = v_intent.id)
      <> v_expected_consent_count
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_consent_documents) AS expected
      WHERE NOT EXISTS (
        SELECT 1 FROM public.commercial_consents AS actual
        WHERE actual.checkout_intent_id = v_intent.id
          AND actual.user_id = p_user_id
          AND actual.course_id = p_course_id
          AND actual.consent_type = expected->>'consent_type'
          AND actual.granted
          AND actual.legal_document_version_id = (expected->>'legal_document_version_id')::uuid
      )
    )
  THEN
    RAISE EXCEPTION 'Les preuves de consentement de cette tentative sont incoherentes.' USING ERRCODE = '23505';
  END IF;

  IF v_intent.promo_redemption_id IS NOT NULL THEN
    SELECT codes.code INTO v_normalized_code
    FROM public.promo_redemptions AS redemptions
    JOIN public.promo_codes AS codes ON codes.id = redemptions.promo_code_id
    WHERE redemptions.id = v_intent.promo_redemption_id;
  END IF;

  RETURN QUERY SELECT
    v_intent.id, v_intent.status, v_intent.stripe_checkout_session_id,
    v_intent.promo_redemption_id, v_normalized_code, v_intent.original_amount_cents,
    v_intent.discount_amount_cents, v_intent.final_amount_cents,
    v_intent.checkout_configuration_locked_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_course_promotion_checkout(
  p_checkout_intent_id uuid,
  p_user_id uuid,
  p_email text,
  p_course_id text,
  p_original_amount_cents integer,
  p_promo_code text DEFAULT NULL
)
RETURNS TABLE (
  checkout_intent_id uuid,
  promo_redemption_id uuid,
  normalized_code text,
  original_amount_cents integer,
  discount_amount_cents integer,
  final_amount_cents integer,
  reservation_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_intent public.commercial_checkout_intents%ROWTYPE;
  v_reservation record;
  v_normalized_code text := nullif(upper(btrim(coalesce(p_promo_code, ''))), '');
  v_redemption_status text;
BEGIN
  IF p_checkout_intent_id IS NULL OR p_user_id IS NULL OR p_email IS NULL
    OR p_course_id NOT IN ('formation-ia', 'formation-ia-act', 'formation-prompt-level-1')
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
  ELSIF v_intent.original_amount_cents IS DISTINCT FROM p_original_amount_cents THEN
    PERFORM private.promo_invalid();
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

  checkout_intent_id := v_intent.id;
  promo_redemption_id := v_intent.promo_redemption_id;
  original_amount_cents := v_intent.original_amount_cents;
  discount_amount_cents := v_intent.discount_amount_cents;
  final_amount_cents := v_intent.final_amount_cents;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_course_promotion_checkout(
  p_checkout_intent_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_intent public.commercial_checkout_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_intent FROM public.commercial_checkout_intents AS intents
  WHERE intents.id = p_checkout_intent_id FOR UPDATE;
  IF NOT FOUND OR v_intent.user_id IS DISTINCT FROM p_user_id
    OR v_intent.status <> 'created' OR v_intent.stripe_checkout_session_id IS NOT NULL
  THEN RETURN false; END IF;

  IF v_intent.promo_redemption_id IS NOT NULL THEN
    PERFORM * FROM private.release_promo_redemption(
      v_intent.promo_redemption_id, 'commercial_checkout_intent', v_intent.id
    );
  END IF;
  UPDATE public.commercial_checkout_intents
  SET status = 'failed', failure_code = 'stripe_session_creation_failed', updated_at = now()
  WHERE id = v_intent.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_course_stripe_event(p_event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_event_id text := p_event->>'event_id';
  v_event_type text := p_event->>'event_type';
  v_event_created timestamptz := (p_event->>'created_at')::timestamptz;
  v_intent_id uuid := private.stripe_json_uuid(p_event->>'checkout_intent_id');
  v_user_id uuid := private.stripe_json_uuid(p_event->>'user_id');
  v_session_id text := nullif(p_event->>'stripe_checkout_session_id', '');
  v_amount_total integer := CASE WHEN p_event ? 'amount_total' THEN (p_event->>'amount_total')::integer ELSE NULL END;
  v_currency text := lower(nullif(p_event->>'currency', ''));
  v_intent public.commercial_checkout_intents%ROWTYPE;
  v_promo_status text;
  v_result jsonb;
  v_inserted_event text;
BEGIN
  IF v_event_type NOT IN (
    'checkout.session.completed', 'checkout.session.async_payment_succeeded',
    'payment_intent.payment_failed', 'checkout.session.async_payment_failed',
    'checkout.session.expired'
  ) OR p_event->>'validation_status' <> 'validated' OR v_intent_id IS NULL OR v_user_id IS NULL
  THEN RAISE EXCEPTION 'Preuve de paiement formation invalide.'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_intent_id::text, 0));
  SELECT * INTO v_intent FROM public.commercial_checkout_intents AS intents
  WHERE intents.id = v_intent_id FOR UPDATE;
  IF NOT FOUND OR v_intent.user_id IS DISTINCT FROM v_user_id
    OR v_intent.course_id IS DISTINCT FROM nullif(p_event->>'course_id', '')
    OR v_intent.original_amount_cents IS NULL OR v_intent.final_amount_cents IS NULL
    OR v_currency IS DISTINCT FROM 'eur'
    OR v_amount_total IS DISTINCT FROM v_intent.final_amount_cents
    OR (v_session_id IS NOT NULL AND v_intent.stripe_checkout_session_id IS NOT NULL
      AND v_intent.stripe_checkout_session_id IS DISTINCT FROM v_session_id)
  THEN RAISE EXCEPTION 'Intention de paiement formation inconnue ou incoherente.'; END IF;

  IF v_event_type = 'payment_intent.payment_failed' THEN
    INSERT INTO public.stripe_webhook_events (
      event_id, event_type, stripe_object_id, livemode, api_version,
      payload_sha256, stripe_created_at, processing_result
    ) VALUES (
      v_event_id, v_event_type, nullif(p_event->>'object_id', ''),
      (p_event->>'livemode')::boolean, nullif(p_event->>'api_version', ''),
      nullif(p_event->>'payload_sha256', ''), v_event_created, 'ignored'
    ) ON CONFLICT (event_id) DO NOTHING RETURNING event_id INTO v_inserted_event;
    IF v_inserted_event IS NOT NULL THEN
      INSERT INTO public.audit_log (
        action_type, target_type, target_id, target_user_id, course_id, reason, metadata
      ) VALUES (
        'stripe_event_ignored', 'stripe_webhook_event', v_event_id, v_user_id, v_intent.course_id,
        'Echec de carte non terminal conserve pour permettre un nouvel essai Checkout.',
        jsonb_build_object('event_type', v_event_type, 'checkout_intent_id', v_intent_id)
      );
    END IF;
    RETURN jsonb_build_object('ok', true, 'already_processed', v_inserted_event IS NULL, 'processing_result', 'ignored');
  END IF;

  IF v_session_id IS NOT NULL AND v_intent.stripe_checkout_session_id IS NULL THEN
    UPDATE public.commercial_checkout_intents
    SET stripe_checkout_session_id = v_session_id, status = 'stripe_session_created', updated_at = now()
    WHERE id = v_intent.id AND status = 'created';
  END IF;

  IF v_intent.promo_redemption_id IS NOT NULL THEN
    IF v_event_type IN ('checkout.session.completed', 'checkout.session.async_payment_succeeded') THEN
      SELECT status INTO v_promo_status FROM private.consume_promo_redemption(
        v_intent.promo_redemption_id, 'commercial_checkout_intent', v_intent.id
      );
      IF v_promo_status IS DISTINCT FROM 'consumed' THEN
        RAISE EXCEPTION 'Reservation promotionnelle formation indisponible.';
      END IF;
    ELSE
      SELECT status INTO v_promo_status FROM private.release_promo_redemption(
        v_intent.promo_redemption_id, 'commercial_checkout_intent', v_intent.id
      );
    END IF;
  END IF;

  SELECT public.process_stripe_post_payment_event(p_event) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_course_checkout_intent(
  uuid, uuid, text, text, text, text, text, text, text, uuid, jsonb, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_course_promotion_checkout(uuid, uuid, text, text, integer, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_course_promotion_checkout(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_course_stripe_event(jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.prepare_course_checkout_intent(
  uuid, uuid, text, text, text, text, text, text, text, uuid, jsonb, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_course_promotion_checkout(uuid, uuid, text, text, integer, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_course_promotion_checkout(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.process_course_stripe_event(jsonb)
  TO service_role;

COMMIT;
