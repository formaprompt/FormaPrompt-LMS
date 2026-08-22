-- Sprint 4 : suivi OF/OPCO et exceptions administratives.
-- Cette migration reste additive : purchases et course_access ne sont jamais
-- modifiés par les mécanismes ci-dessous.

BEGIN;

ALTER TABLE public.training_enrollments
  DROP CONSTRAINT training_enrollments_status_check,
  ADD CONSTRAINT training_enrollments_status_check
    CHECK (status IN ('draft', 'pending', 'validated', 'in_progress', 'completed', 'archived', 'cancelled', 'abandoned')),
  ADD COLUMN payer_name text,
  ADD COLUMN payer_email text,
  ADD COLUMN client_name text,
  ADD COLUMN client_email text,
  ADD COLUMN funding_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN funding_requested_cents integer,
  ADD COLUMN funding_granted_cents integer,
  ADD COLUMN funding_requested_at timestamptz,
  ADD COLUMN funding_decided_at timestamptz,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by_actor text,
  ADD COLUMN cancellation_reason text,
  ADD COLUMN abandoned_at timestamptz,
  ADD COLUMN abandonment_origin text,
  ADD COLUMN abandonment_reason text,
  ADD COLUMN funding_balance_cents integer GENERATED ALWAYS AS
    (GREATEST(COALESCE(price_amount_cents, 0) - COALESCE(funding_granted_cents, 0), 0)) STORED,
  ADD CONSTRAINT training_enrollments_funding_status_check CHECK (
    funding_status IN ('not_requested', 'requested', 'under_review', 'partially_granted', 'granted', 'refused', 'withdrawn')
  ),
  ADD CONSTRAINT training_enrollments_funding_amounts_check CHECK (
    (funding_requested_cents IS NULL OR funding_requested_cents >= 0)
    AND (funding_granted_cents IS NULL OR funding_granted_cents >= 0)
    AND (funding_requested_cents IS NULL OR funding_granted_cents IS NULL OR funding_granted_cents <= funding_requested_cents)
  ),
  ADD CONSTRAINT training_enrollments_funding_dates_check CHECK (
    (funding_status = 'not_requested' AND funding_requested_at IS NULL)
    OR (funding_status <> 'not_requested' AND funding_requested_at IS NOT NULL)
  ),
  ADD CONSTRAINT training_enrollments_cancellation_check CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND cancelled_by_actor IS NOT NULL)
    OR status <> 'cancelled'
  ),
  ADD CONSTRAINT training_enrollments_abandonment_check CHECK (
    (status = 'abandoned' AND abandoned_at IS NOT NULL AND abandonment_reason IS NOT NULL AND abandonment_origin IS NOT NULL)
    OR status <> 'abandoned'
  ),
  ADD CONSTRAINT training_enrollments_payer_name_check CHECK (payer_name IS NULL OR char_length(btrim(payer_name)) BETWEEN 2 AND 200),
  ADD CONSTRAINT training_enrollments_payer_email_check CHECK (payer_email IS NULL OR char_length(btrim(payer_email)) BETWEEN 3 AND 320),
  ADD CONSTRAINT training_enrollments_client_name_check CHECK (client_name IS NULL OR char_length(btrim(client_name)) BETWEEN 2 AND 200),
  ADD CONSTRAINT training_enrollments_client_email_check CHECK (client_email IS NULL OR char_length(btrim(client_email)) BETWEEN 3 AND 320),
  ADD CONSTRAINT training_enrollments_exception_text_check CHECK (
    (cancelled_by_actor IS NULL OR char_length(btrim(cancelled_by_actor)) BETWEEN 2 AND 120)
    AND (cancellation_reason IS NULL OR char_length(btrim(cancellation_reason)) BETWEEN 5 AND 2000)
    AND (abandonment_origin IS NULL OR char_length(btrim(abandonment_origin)) BETWEEN 2 AND 120)
    AND (abandonment_reason IS NULL OR char_length(btrim(abandonment_reason)) BETWEEN 5 AND 2000)
  );

CREATE INDEX training_enrollments_funding_status_idx
  ON public.training_enrollments (funding_status, updated_at DESC);

DROP INDEX public.training_enrollments_open_user_course_uidx;
CREATE UNIQUE INDEX training_enrollments_open_user_course_uidx
  ON public.training_enrollments (user_id, course_id)
  WHERE status NOT IN ('archived', 'cancelled', 'abandoned');

CREATE TABLE public.training_enrollment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.training_enrollments(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  reason text NOT NULL,
  previous_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  rights_impact text NOT NULL DEFAULT 'none',
  actor_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_enrollment_events_type_check CHECK (
    event_type IN ('initial_snapshot', 'dossier_updated', 'funding_updated', 'cancelled', 'postponed', 'beneficiary_transferred', 'abandoned', 'amendment_created')
  ),
  CONSTRAINT training_enrollment_events_reason_check CHECK (char_length(btrim(reason)) BETWEEN 3 AND 2000),
  CONSTRAINT training_enrollment_events_states_check CHECK (
    jsonb_typeof(previous_state) = 'object' AND jsonb_typeof(new_state) = 'object'
    AND octet_length(previous_state::text) <= 65536 AND octet_length(new_state::text) <= 65536
  ),
  CONSTRAINT training_enrollment_events_rights_check CHECK (
    rights_impact IN ('none', 'review_required', 'managed_separately')
  )
);

CREATE INDEX training_enrollment_events_enrollment_idx
  ON public.training_enrollment_events (enrollment_id, created_at DESC);
CREATE INDEX training_enrollment_events_actor_idx
  ON public.training_enrollment_events (actor_user_id);

CREATE TABLE public.training_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.training_documents(id) ON DELETE RESTRICT,
  enrollment_id uuid NOT NULL REFERENCES public.training_enrollments(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  document_version integer NOT NULL,
  document_type text NOT NULL,
  status text NOT NULL,
  content_snapshot jsonb NOT NULL,
  visible_to_learner boolean NOT NULL,
  generated_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  generated_at timestamptz,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_document_versions_revision_key UNIQUE (document_id, revision_number),
  CONSTRAINT training_document_versions_snapshot_check CHECK (
    jsonb_typeof(content_snapshot) = 'object' AND octet_length(content_snapshot::text) <= 65536
  )
);

CREATE INDEX training_document_versions_enrollment_idx
  ON public.training_document_versions (enrollment_id, captured_at DESC);
CREATE INDEX training_document_versions_generated_by_idx
  ON public.training_document_versions (generated_by) WHERE generated_by IS NOT NULL;

CREATE OR REPLACE FUNCTION private.capture_training_document_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_revision integer;
BEGIN
  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO next_revision
  FROM public.training_document_versions
  WHERE document_id = NEW.id;

  INSERT INTO public.training_document_versions (
    document_id, enrollment_id, revision_number, document_version, document_type,
    status, content_snapshot, visible_to_learner, generated_by, generated_at
  ) VALUES (
    NEW.id, NEW.enrollment_id, next_revision, NEW.version, NEW.document_type,
    NEW.status, NEW.content_snapshot, NEW.visible_to_learner, NEW.generated_by, NEW.generated_at
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.capture_training_document_version() FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO public.training_document_versions (
  document_id, enrollment_id, revision_number, document_version, document_type,
  status, content_snapshot, visible_to_learner, generated_by, generated_at, captured_at
)
SELECT id, enrollment_id, 1, version, document_type, status, content_snapshot,
       visible_to_learner, generated_by, generated_at, COALESCE(updated_at, created_at)
FROM public.training_documents;

CREATE TRIGGER capture_training_document_version
AFTER INSERT OR UPDATE OF status, version, content_snapshot, visible_to_learner, generated_by, generated_at
ON public.training_documents
FOR EACH ROW EXECUTE FUNCTION private.capture_training_document_version();

CREATE SEQUENCE public.training_amendment_number_seq;
REVOKE ALL ON SEQUENCE public.training_amendment_number_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.training_amendment_number_seq TO service_role;

CREATE TABLE public.training_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_number text NOT NULL UNIQUE DEFAULT (
    'FP-AV-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('public.training_amendment_number_seq')::text, 6, '0')
  ),
  enrollment_id uuid NOT NULL REFERENCES public.training_enrollments(id) ON DELETE RESTRICT,
  source_document_id uuid REFERENCES public.training_documents(id) ON DELETE RESTRICT,
  source_quote_id uuid REFERENCES public.commercial_quotes(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,
  effective_date date NOT NULL,
  reason text NOT NULL,
  change_summary text NOT NULL,
  previous_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  frozen_snapshot jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_amendments_enrollment_version_key UNIQUE (enrollment_id, version),
  CONSTRAINT training_amendments_version_check CHECK (version BETWEEN 1 AND 1000),
  CONSTRAINT training_amendments_reason_check CHECK (char_length(btrim(reason)) BETWEEN 5 AND 2000),
  CONSTRAINT training_amendments_summary_check CHECK (char_length(btrim(change_summary)) BETWEEN 5 AND 4000),
  CONSTRAINT training_amendments_json_check CHECK (
    jsonb_typeof(previous_values) = 'object' AND jsonb_typeof(new_values) = 'object'
    AND jsonb_typeof(frozen_snapshot) = 'object'
    AND octet_length(previous_values::text) <= 65536
    AND octet_length(new_values::text) <= 65536
    AND octet_length(frozen_snapshot::text) <= 131072
  )
);

CREATE INDEX training_amendments_enrollment_idx
  ON public.training_amendments (enrollment_id, created_at DESC);
CREATE INDEX training_amendments_source_document_idx
  ON public.training_amendments (source_document_id) WHERE source_document_id IS NOT NULL;
CREATE INDEX training_amendments_source_quote_idx
  ON public.training_amendments (source_quote_id) WHERE source_quote_id IS NOT NULL;
CREATE INDEX training_amendments_created_by_idx
  ON public.training_amendments (created_by);

ALTER TABLE public.training_enrollment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_enrollment_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.training_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_document_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.training_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_amendments FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture administrative des événements de dossier"
ON public.training_enrollment_events FOR SELECT TO authenticated
USING ((SELECT private.is_admin()));

CREATE POLICY "Lecture des versions documentaires autorisées"
ON public.training_document_versions FOR SELECT TO authenticated
USING (
  (SELECT private.is_admin()) OR EXISTS (
    SELECT 1 FROM public.training_documents d
    WHERE d.id = document_id
      AND d.user_id = (SELECT auth.uid())
      AND d.visible_to_learner
  )
);

CREATE POLICY "Lecture administrative des avenants"
ON public.training_amendments FOR SELECT TO authenticated
USING ((SELECT private.is_admin()));

REVOKE ALL ON public.training_enrollment_events, public.training_document_versions, public.training_amendments
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.training_enrollment_events, public.training_document_versions, public.training_amendments
  TO authenticated;
GRANT ALL ON public.training_enrollment_events, public.training_document_versions, public.training_amendments
  TO service_role;

CREATE OR REPLACE FUNCTION private.prevent_training_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Les preuves administratives sont append-only';
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_training_evidence_mutation() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER prevent_training_enrollment_event_mutation
BEFORE UPDATE OR DELETE ON public.training_enrollment_events
FOR EACH ROW EXECUTE FUNCTION private.prevent_training_evidence_mutation();
CREATE TRIGGER prevent_training_document_version_mutation
BEFORE UPDATE OR DELETE ON public.training_document_versions
FOR EACH ROW EXECUTE FUNCTION private.prevent_training_evidence_mutation();
CREATE TRIGGER prevent_training_amendment_mutation
BEFORE UPDATE OR DELETE ON public.training_amendments
FOR EACH ROW EXECUTE FUNCTION private.prevent_training_evidence_mutation();

COMMENT ON TABLE public.training_enrollment_events IS
  'Historique append-only des financements, annulations, reports, transferts et abandons. Aucun événement ne modifie course_access.';
COMMENT ON TABLE public.training_document_versions IS
  'Versions figées des documents administratifs ; une régénération ne détruit jamais la preuve précédente.';
COMMENT ON TABLE public.training_amendments IS
  'Avenants immuables rattachés à un dossier et, si nécessaire, au document ou devis initial.';
COMMENT ON COLUMN public.training_enrollments.funding_balance_cents IS
  'Reste administratif calculé. Une promesse ou décision de financement ne crée aucun droit pédagogique.';

COMMIT;
