-- Sprint 0.2 : preuves contractuelles B2C et demandes de rétractation.
-- Migration additive uniquement. Elle ne publie aucune version juridique et
-- ne modifie ni les achats, ni les droits course_access existants.

BEGIN;

CREATE TABLE public.legal_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  public_path text,
  content_text text NOT NULL,
  content_sha256 text NOT NULL,
  effective_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_document_versions_type_check
    CHECK (document_type IN (
      'cgv_b2c',
      'cgv_b2b',
      'privacy_policy',
      'internal_rules',
      'precontractual_information',
      'early_service_start_statement',
      'digital_content_start_statement',
      'digital_content_withdrawal_acknowledgement'
    )),
  CONSTRAINT legal_document_versions_version_check
    CHECK (char_length(btrim(version)) BETWEEN 3 AND 100),
  CONSTRAINT legal_document_versions_status_check
    CHECK (status IN ('draft', 'published', 'retired')),
  CONSTRAINT legal_document_versions_hash_check
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT legal_document_versions_publication_check
    CHECK (
      (status = 'draft' AND effective_at IS NULL)
      OR (status IN ('published', 'retired') AND effective_at IS NOT NULL)
    ),
  CONSTRAINT legal_document_versions_retirement_check
    CHECK (retired_at IS NULL OR (effective_at IS NOT NULL AND retired_at >= effective_at)),
  CONSTRAINT legal_document_versions_type_version_key UNIQUE (document_type, version)
);

CREATE UNIQUE INDEX legal_document_versions_one_published_type_uidx
  ON public.legal_document_versions (document_type)
  WHERE status = 'published';

CREATE OR REPLACE FUNCTION private.protect_published_legal_document_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IN ('published', 'retired') THEN
    IF OLD.status = 'published'
      AND TG_OP = 'UPDATE'
      AND NEW.status = 'retired'
      AND NEW.retired_at IS NOT NULL
      AND NEW.id = OLD.id
      AND NEW.document_type = OLD.document_type
      AND NEW.version = OLD.version
      AND NEW.public_path IS NOT DISTINCT FROM OLD.public_path
      AND NEW.content_text = OLD.content_text
      AND NEW.content_sha256 = OLD.content_sha256
      AND NEW.effective_at = OLD.effective_at
      AND NEW.created_at = OLD.created_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Une version juridique publiée est figée ; créez une nouvelle version.'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER protect_published_legal_document_version
BEFORE UPDATE OR DELETE ON public.legal_document_versions
FOR EACH ROW EXECUTE FUNCTION private.protect_published_legal_document_version();

COMMENT ON TABLE public.legal_document_versions IS
  'Une copie figée par version des documents et formulations contractuelles. Aucune version Sprint 0 préparatoire n est publiée par cette migration.';

CREATE TABLE public.commercial_checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id text NOT NULL,
  offer_classification text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  cgv_document_version_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
  stripe_checkout_session_id text,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_checkout_intents_course_check
    CHECK (char_length(btrim(course_id)) BETWEEN 2 AND 100),
  CONSTRAINT commercial_checkout_intents_classification_check
    CHECK (offer_classification IN (
      'B2C_STANDARD',
      'B2C_INDIVIDUAL_TRAINING_CONTRACT',
      'B2B',
      'OF_OPCO',
      'MANUAL_LEGAL_REVIEW_REQUIRED'
    )),
  CONSTRAINT commercial_checkout_intents_status_check
    CHECK (status IN ('created', 'stripe_session_created', 'paid', 'failed', 'cancelled', 'expired')),
  CONSTRAINT commercial_checkout_intents_failure_check
    CHECK (failure_code IS NULL OR char_length(failure_code) BETWEEN 2 AND 100)
);

CREATE UNIQUE INDEX commercial_checkout_intents_stripe_session_uidx
  ON public.commercial_checkout_intents (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE INDEX commercial_checkout_intents_user_created_idx
  ON public.commercial_checkout_intents (user_id, created_at DESC);

CREATE TABLE public.commercial_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_intent_id uuid NOT NULL
    REFERENCES public.commercial_checkout_intents(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id text NOT NULL,
  consent_type text NOT NULL,
  granted boolean NOT NULL,
  legal_document_version_id uuid NOT NULL
    REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
  source text NOT NULL DEFAULT 'web_checkout',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_consents_course_check
    CHECK (char_length(btrim(course_id)) BETWEEN 2 AND 100),
  CONSTRAINT commercial_consents_type_check
    CHECK (consent_type IN (
      'cgv_acceptance',
      'early_service_start',
      'digital_content_start',
      'digital_content_withdrawal_acknowledgement'
    )),
  CONSTRAINT commercial_consents_granted_check CHECK (granted),
  CONSTRAINT commercial_consents_source_check
    CHECK (source IN ('web_checkout', 'admin_recorded')),
  CONSTRAINT commercial_consents_intent_type_key UNIQUE (checkout_intent_id, consent_type)
);

CREATE INDEX commercial_consents_user_created_idx
  ON public.commercial_consents (user_id, created_at DESC);

COMMENT ON TABLE public.commercial_consents IS
  'Preuves minimales des consentements distincts. Le texte exact est conservé une seule fois dans legal_document_versions.';
COMMENT ON COLUMN public.commercial_consents.created_at IS
  'Horodatage produit par PostgreSQL, jamais fourni par le navigateur.';

CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  checkout_intent_id uuid REFERENCES public.commercial_checkout_intents(id) ON DELETE SET NULL,
  course_id text NOT NULL,
  claimant_first_name text NOT NULL,
  claimant_last_name text NOT NULL,
  acknowledgement_email text NOT NULL,
  declaration text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  received_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_note text,
  acknowledgement_delivery_status text NOT NULL DEFAULT 'pending',
  acknowledgement_delivered_at timestamptz,
  acknowledgement_delivery_attempted_at timestamptz,
  acknowledgement_delivery_attempts integer NOT NULL DEFAULT 0,
  acknowledgement_delivery_error_code text,
  CONSTRAINT withdrawal_requests_course_check
    CHECK (char_length(btrim(course_id)) BETWEEN 2 AND 100),
  CONSTRAINT withdrawal_requests_name_check
    CHECK (
      char_length(btrim(claimant_first_name)) BETWEEN 1 AND 100
      AND char_length(btrim(claimant_last_name)) BETWEEN 1 AND 100
    ),
  CONSTRAINT withdrawal_requests_email_check
    CHECK (char_length(btrim(acknowledgement_email)) BETWEEN 3 AND 254),
  CONSTRAINT withdrawal_requests_declaration_check
    CHECK (char_length(btrim(declaration)) BETWEEN 20 AND 2000),
  CONSTRAINT withdrawal_requests_status_check
    CHECK (status IN ('received', 'under_review', 'accepted', 'rejected', 'closed')),
  CONSTRAINT withdrawal_requests_delivery_check
    CHECK (
      acknowledgement_delivery_status IN ('pending_configuration', 'pending', 'sent', 'failed')
      AND (acknowledgement_delivery_status <> 'sent' OR acknowledgement_delivered_at IS NOT NULL)
      AND acknowledgement_delivery_attempts >= 0
      AND (acknowledgement_delivery_error_code IS NULL OR char_length(acknowledgement_delivery_error_code) BETWEEN 2 AND 100)
    ),
  CONSTRAINT withdrawal_requests_review_check
    CHECK (
      (status = 'received' AND reviewed_at IS NULL AND reviewed_by IS NULL)
      OR status <> 'received'
    )
);

CREATE TABLE public.commercial_payment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  stripe_checkout_session_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  received_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT commercial_payment_reviews_status_check
    CHECK (status IN ('pending', 'resolved', 'rejected')),
  CONSTRAINT commercial_payment_reviews_reason_check
    CHECK (char_length(btrim(reason)) BETWEEN 2 AND 200)
);

COMMENT ON TABLE public.commercial_payment_reviews IS
  'Paiements Stripe anciens ou ambigus placés en revue humaine sans création automatique de purchase ni de course_access.';

CREATE INDEX withdrawal_requests_user_received_idx
  ON public.withdrawal_requests (user_id, received_at DESC);
CREATE INDEX withdrawal_requests_status_received_idx
  ON public.withdrawal_requests (status, received_at);
CREATE UNIQUE INDEX withdrawal_requests_one_active_per_purchase_idx
  ON public.withdrawal_requests (purchase_id)
  WHERE purchase_id IS NOT NULL AND status IN ('received', 'under_review', 'accepted');

COMMENT ON TABLE public.withdrawal_requests IS
  'Demandes de rétractation à instruire. Une insertion ne rembourse pas Stripe et ne modifie jamais course_access.';

ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_checkout_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_checkout_intents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_payment_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_payment_reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture des versions juridiques publiées"
ON public.legal_document_versions
FOR SELECT
TO anon, authenticated
USING (status = 'published');

CREATE POLICY "Administration des versions juridiques"
ON public.legal_document_versions
FOR SELECT
TO authenticated
USING ((SELECT private.is_admin()));

CREATE POLICY "Lecture de ses intentions commerciales"
ON public.commercial_checkout_intents
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT private.is_admin()));

CREATE POLICY "Lecture de ses consentements commerciaux"
ON public.commercial_consents
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT private.is_admin()));

CREATE POLICY "Lecture de ses demandes de rétractation"
ON public.withdrawal_requests
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT private.is_admin()));

CREATE POLICY "Administration des paiements à revoir"
ON public.commercial_payment_reviews
FOR SELECT
TO authenticated
USING ((SELECT private.is_admin()));

REVOKE ALL ON public.legal_document_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commercial_checkout_intents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commercial_consents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.withdrawal_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commercial_payment_reviews FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id, document_type, version, status, public_path, content_text,
  content_sha256, effective_at, retired_at, created_at
) ON public.legal_document_versions TO anon, authenticated;
GRANT SELECT (
  id, user_id, course_id, offer_classification, status,
  cgv_document_version_id, stripe_checkout_session_id, created_at, updated_at
) ON public.commercial_checkout_intents TO authenticated;
GRANT SELECT (
  id, checkout_intent_id, user_id, course_id, consent_type, granted,
  legal_document_version_id, source, created_at
) ON public.commercial_consents TO authenticated;
GRANT SELECT (
  id, user_id, purchase_id, checkout_intent_id, course_id,
  claimant_first_name, claimant_last_name, acknowledgement_email,
  declaration, status, received_at, reviewed_at
) ON public.withdrawal_requests TO authenticated;

GRANT ALL ON public.legal_document_versions TO service_role;
GRANT ALL ON public.commercial_checkout_intents TO service_role;
GRANT ALL ON public.commercial_consents TO service_role;
GRANT ALL ON public.withdrawal_requests TO service_role;
GRANT ALL ON public.commercial_payment_reviews TO service_role;

COMMIT;
