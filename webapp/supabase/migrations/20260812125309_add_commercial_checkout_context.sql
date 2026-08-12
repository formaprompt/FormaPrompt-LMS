-- Qualification commerciale enregistrée côté serveur avant la création Stripe.
-- Migration additive : aucune ligne existante n'est supprimée ou réattribuée.

ALTER TABLE public.commercial_checkout_intents
  ADD COLUMN sales_context text,
  ADD COLUMN access_start_choice text,
  ADD COLUMN access_activation_policy text,
  ADD COLUMN beneficiary_email text,
  ADD COLUMN buyer_organization_name text;

UPDATE public.commercial_checkout_intents
SET
  sales_context = CASE offer_classification
    WHEN 'B2C_STANDARD' THEN 'personal'
    WHEN 'B2C_INDIVIDUAL_TRAINING_CONTRACT' THEN 'personal'
    WHEN 'B2B' THEN 'professional_self'
    WHEN 'OF_OPCO' THEN 'of_opco'
    ELSE 'legacy_unknown'
  END,
  access_start_choice = CASE
    WHEN offer_classification IN ('B2C_STANDARD', 'B2C_INDIVIDUAL_TRAINING_CONTRACT') THEN 'immediate'
    ELSE NULL
  END,
  access_activation_policy = CASE offer_classification
    WHEN 'B2C_STANDARD' THEN 'immediate_after_payment'
    WHEN 'B2B' THEN 'immediate_after_payment'
    WHEN 'OF_OPCO' THEN 'of_opco_administrative'
    ELSE 'legacy_administrative_review'
  END
WHERE sales_context IS NULL;

ALTER TABLE public.commercial_checkout_intents
  ALTER COLUMN sales_context SET NOT NULL,
  ALTER COLUMN access_activation_policy SET NOT NULL,
  ADD CONSTRAINT commercial_checkout_intents_sales_context_check
    CHECK (sales_context IN (
      'personal',
      'professional_self',
      'beneficiary',
      'of_opco',
      'legacy_unknown'
    )),
  ADD CONSTRAINT commercial_checkout_intents_start_choice_check
    CHECK (access_start_choice IS NULL OR access_start_choice IN ('immediate', 'deferred')),
  ADD CONSTRAINT commercial_checkout_intents_activation_policy_check
    CHECK (access_activation_policy IN (
      'immediate_after_payment',
      'deferred_after_withdrawal_period',
      'deferred_beneficiary_assignment',
      'of_opco_administrative',
      'legacy_administrative_review'
    )),
  ADD CONSTRAINT commercial_checkout_intents_beneficiary_email_check
    CHECK (
      beneficiary_email IS NULL
      OR (
        char_length(btrim(beneficiary_email)) BETWEEN 3 AND 254
        AND beneficiary_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      )
    ),
  ADD CONSTRAINT commercial_checkout_intents_organization_check
    CHECK (
      buyer_organization_name IS NULL
      OR char_length(btrim(buyer_organization_name)) BETWEEN 2 AND 200
    ),
  ADD CONSTRAINT commercial_checkout_intents_context_consistency_check
    CHECK (
      (sales_context = 'personal'
        AND offer_classification IN ('B2C_STANDARD', 'B2C_INDIVIDUAL_TRAINING_CONTRACT')
        AND access_start_choice IS NOT NULL
        AND beneficiary_email IS NULL
        AND buyer_organization_name IS NULL
        AND (
          (offer_classification = 'B2C_STANDARD'
            AND access_start_choice = 'immediate'
            AND access_activation_policy = 'immediate_after_payment')
          OR (offer_classification = 'B2C_STANDARD'
            AND access_start_choice = 'deferred'
            AND access_activation_policy = 'deferred_after_withdrawal_period')
          OR (offer_classification = 'B2C_INDIVIDUAL_TRAINING_CONTRACT'
            AND access_activation_policy = 'legacy_administrative_review')
        ))
      OR (sales_context = 'professional_self'
        AND offer_classification = 'B2B'
        AND access_start_choice IS NULL
        AND beneficiary_email IS NULL
        AND buyer_organization_name IS NULL
        AND access_activation_policy = 'immediate_after_payment')
      OR (sales_context = 'beneficiary'
        AND offer_classification = 'B2B'
        AND access_start_choice IS NULL
        AND beneficiary_email IS NOT NULL
        AND buyer_organization_name IS NOT NULL
        AND access_activation_policy = 'deferred_beneficiary_assignment')
      OR (sales_context = 'of_opco'
        AND offer_classification = 'OF_OPCO'
        AND access_start_choice IS NULL
        AND access_activation_policy = 'of_opco_administrative')
      OR sales_context = 'legacy_unknown'
    );

CREATE OR REPLACE FUNCTION private.validate_commercial_checkout_cgv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_document_type text;
  v_status text;
BEGIN
  SELECT document_type, status
  INTO v_document_type, v_status
  FROM public.legal_document_versions
  WHERE id = NEW.cgv_document_version_id;

  IF v_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'La version CGV liée doit être publiée.' USING ERRCODE = '23514';
  END IF;

  IF NEW.offer_classification IN ('B2C_STANDARD', 'B2C_INDIVIDUAL_TRAINING_CONTRACT')
    AND v_document_type IS DISTINCT FROM 'cgv_b2c'
  THEN
    RAISE EXCEPTION 'Le parcours B2C doit référencer les CGV B2C publiées.' USING ERRCODE = '23514';
  END IF;

  IF NEW.offer_classification IN ('B2B', 'OF_OPCO')
    AND v_document_type IS DISTINCT FROM 'cgv_b2b'
  THEN
    RAISE EXCEPTION 'Le parcours professionnel doit référencer les CGV B2B publiées.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_commercial_checkout_cgv() FROM PUBLIC;

CREATE TRIGGER validate_commercial_checkout_cgv
BEFORE INSERT OR UPDATE OF offer_classification, cgv_document_version_id
ON public.commercial_checkout_intents
FOR EACH ROW EXECUTE FUNCTION private.validate_commercial_checkout_cgv();

COMMENT ON COLUMN public.commercial_checkout_intents.sales_context IS
  'Qualification déclarée avant Stripe et validée côté serveur.';
COMMENT ON COLUMN public.commercial_checkout_intents.access_activation_policy IS
  'Décorrèle le paiement du moment où un droit course_access peut être créé.';
COMMENT ON COLUMN public.commercial_checkout_intents.beneficiary_email IS
  'Adresse minimale permettant une attribution administrative ultérieure au bénéficiaire ; aucune création automatique de compte.';

GRANT SELECT (
  sales_context,
  access_start_choice,
  access_activation_policy,
  beneficiary_email,
  buyer_organization_name
) ON public.commercial_checkout_intents TO authenticated;
