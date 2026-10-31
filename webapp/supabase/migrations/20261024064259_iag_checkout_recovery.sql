-- DRAFT NON EXECUTE. Après 03-iag-offer-allowlists.DRAFT.sql, en recette autorisée.
-- Même contrat et mêmes verrous que prepare_course_checkout_intent, réservé à IAG.
-- Aucune mutation Stripe. Aucune configuration verrouillée n'est clôturée.
BEGIN;

CREATE OR REPLACE FUNCTION public.prepare_iag_course_checkout_intent(
  p_checkout_request_id uuid, p_user_id uuid, p_course_id text,
  p_offer_classification text, p_sales_context text, p_access_start_choice text,
  p_access_activation_policy text, p_beneficiary_email text,
  p_buyer_organization_name text, p_cgv_document_version_id uuid,
  p_consent_documents jsonb, p_catalog_price_id text, p_stripe_product_id text,
  p_intro_price_id text, p_standard_price_id text
)
RETURNS TABLE (
  id uuid, status text, stripe_checkout_session_id text, promo_redemption_id uuid,
  normalized_code text, original_amount_cents integer, discount_amount_cents integer,
  final_amount_cents integer, checkout_configuration_locked_at timestamptz
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF p_course_id IS DISTINCT FROM 'formation-ia-generative-elearning'
    OR p_user_id IS NULL OR p_checkout_request_id IS NULL
    OR p_intro_price_id IS NULL OR p_standard_price_id IS NULL
    OR p_intro_price_id !~ '^price_[A-Za-z0-9_]+$'
    OR p_standard_price_id !~ '^price_[A-Za-z0-9_]+$'
    OR p_intro_price_id = p_standard_price_id
    OR p_catalog_price_id IS NULL
    OR p_catalog_price_id NOT IN (p_intro_price_id, p_standard_price_id)
  THEN RAISE EXCEPTION 'Configuration de reprise IAG invalide.' USING ERRCODE = '22023'; END IF;

  -- Ordre identique à la RPC historique ; réentrant lors de sa délégation.
  PERFORM pg_advisory_xact_lock(hashtextextended('course-checkout:' || p_user_id::text || ':' || p_course_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_checkout_request_id::text, 0));

  IF clock_timestamp() >= timestamptz '2027-01-01 00:00:00 Europe/Paris'
    AND p_catalog_price_id = p_standard_price_id
  THEN
    -- FOR UPDATE sérialise aussi le passage vers le verrou promotionnel :
    -- si un autre worker l'a posé, le prédicat relu ne permet plus de clôturer.
    PERFORM intents.id FROM public.commercial_checkout_intents AS intents
    WHERE intents.user_id = p_user_id AND intents.course_id = p_course_id
      AND intents.checkout_request_id IS NOT NULL
      AND intents.status IN ('created', 'stripe_session_created')
    ORDER BY intents.created_at DESC, intents.id FOR UPDATE;

    UPDATE public.commercial_checkout_intents AS intents
    SET status = 'expired', checkout_request_id = NULL,
        failure_code = 'iag_price_transition_unlocked', updated_at = now()
    WHERE intents.user_id = p_user_id AND intents.course_id = p_course_id
      AND intents.status = 'created'
      AND intents.checkout_request_id IS NOT NULL
      AND intents.catalog_price_id = p_intro_price_id
      AND intents.checkout_configuration_locked_at IS NULL
      AND intents.stripe_checkout_session_id IS NULL
      AND intents.promo_redemption_id IS NULL
      AND intents.original_amount_cents IS NULL
      AND intents.discount_amount_cents IS NULL
      AND intents.final_amount_cents IS NULL;
  END IF;

  -- Clôture, nouvelle intention et consentements sont dans la même transaction.
  -- Un échec de validation annule aussi la clôture précédente.
  RETURN QUERY SELECT * FROM public.prepare_course_checkout_intent(
    p_checkout_request_id, p_user_id, p_course_id, p_offer_classification,
    p_sales_context, p_access_start_choice, p_access_activation_policy,
    p_beneficiary_email, p_buyer_organization_name, p_cgv_document_version_id,
    p_consent_documents, p_catalog_price_id, p_stripe_product_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_iag_course_checkout_intent(
  uuid, uuid, text, text, text, text, text, text, text, uuid, jsonb, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_iag_course_checkout_intent(
  uuid, uuid, text, text, text, text, text, text, text, uuid, jsonb, text, text, text, text
) TO service_role;
COMMIT;
