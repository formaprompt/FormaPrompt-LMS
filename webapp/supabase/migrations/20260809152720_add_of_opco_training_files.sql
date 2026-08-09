-- Ajoute le dossier administratif OF/OPCO sans dupliquer les droits LMS.
-- Les données documentaires restent privées dans PostgreSQL ; aucun fichier
-- administratif n'est placé dans le bucket public utilisé par le blog.

BEGIN;

CREATE TABLE public.training_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  course_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  enrollment_source text NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  organization_name text,
  learner_first_name text NOT NULL,
  learner_last_name text NOT NULL,
  learner_job_title text,
  learner_phone text,
  learner_address_line1 text,
  learner_postal_code text,
  learner_city text,
  funding_mode text NOT NULL,
  funder_name text,
  funding_reference text,
  delivery_mode text NOT NULL,
  training_location text,
  remote_access_details text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL,
  price_amount_cents integer,
  course_access_id uuid REFERENCES public.course_access(id) ON DELETE SET NULL,
  booking_request_id uuid REFERENCES public.course_booking_requests(id) ON DELETE SET NULL,
  administrative_notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  archived_at timestamptz,
  CONSTRAINT training_enrollments_course_id_check
    CHECK (course_id IN ('formation-ia', 'formation-ia-act', 'formation-prompt-level-1')),
  CONSTRAINT training_enrollments_status_check
    CHECK (status IN ('draft', 'pending', 'validated', 'in_progress', 'completed', 'archived', 'cancelled')),
  CONSTRAINT training_enrollments_source_check
    CHECK (enrollment_source IN ('stripe', 'manual', 'company', 'opco', 'free')),
  CONSTRAINT training_enrollments_funding_check
    CHECK (funding_mode IN ('self_funded', 'company', 'opco', 'free', 'other')),
  CONSTRAINT training_enrollments_delivery_check
    CHECK (delivery_mode IN ('remote', 'in_person', 'hybrid')),
  CONSTRAINT training_enrollments_dates_check
    CHECK (ends_at > starts_at),
  CONSTRAINT training_enrollments_duration_check
    CHECK (duration_minutes BETWEEN 30 AND 60000),
  CONSTRAINT training_enrollments_price_check
    CHECK (price_amount_cents IS NULL OR price_amount_cents >= 0),
  CONSTRAINT training_enrollments_completion_check
    CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR status <> 'completed'),
  CONSTRAINT training_enrollments_archive_check
    CHECK ((status = 'archived' AND archived_at IS NOT NULL) OR status <> 'archived'),
  CONSTRAINT training_enrollments_first_name_check
    CHECK (char_length(btrim(learner_first_name)) BETWEEN 1 AND 100),
  CONSTRAINT training_enrollments_last_name_check
    CHECK (char_length(btrim(learner_last_name)) BETWEEN 1 AND 120),
  CONSTRAINT training_enrollments_organization_check
    CHECK (organization_name IS NULL OR char_length(btrim(organization_name)) BETWEEN 2 AND 200),
  CONSTRAINT training_enrollments_job_check
    CHECK (learner_job_title IS NULL OR char_length(btrim(learner_job_title)) BETWEEN 2 AND 150),
  CONSTRAINT training_enrollments_phone_check
    CHECK (learner_phone IS NULL OR char_length(btrim(learner_phone)) BETWEEN 6 AND 30),
  CONSTRAINT training_enrollments_address_check
    CHECK (learner_address_line1 IS NULL OR char_length(btrim(learner_address_line1)) BETWEEN 3 AND 250),
  CONSTRAINT training_enrollments_postal_code_check
    CHECK (learner_postal_code IS NULL OR char_length(btrim(learner_postal_code)) BETWEEN 2 AND 20),
  CONSTRAINT training_enrollments_city_check
    CHECK (learner_city IS NULL OR char_length(btrim(learner_city)) BETWEEN 2 AND 120),
  CONSTRAINT training_enrollments_funder_check
    CHECK (funder_name IS NULL OR char_length(btrim(funder_name)) BETWEEN 2 AND 200),
  CONSTRAINT training_enrollments_reference_check
    CHECK (funding_reference IS NULL OR char_length(btrim(funding_reference)) BETWEEN 2 AND 120),
  CONSTRAINT training_enrollments_location_check
    CHECK (training_location IS NULL OR char_length(btrim(training_location)) BETWEEN 2 AND 500),
  CONSTRAINT training_enrollments_remote_details_check
    CHECK (remote_access_details IS NULL OR char_length(btrim(remote_access_details)) BETWEEN 3 AND 1000),
  CONSTRAINT training_enrollments_notes_check
    CHECK (administrative_notes IS NULL OR char_length(administrative_notes) <= 4000)
);

CREATE INDEX training_enrollments_user_idx
  ON public.training_enrollments (user_id, created_at DESC);
CREATE INDEX training_enrollments_status_idx
  ON public.training_enrollments (status, starts_at);
CREATE UNIQUE INDEX training_enrollments_open_user_course_uidx
  ON public.training_enrollments (user_id, course_id)
  WHERE status NOT IN ('archived', 'cancelled');

COMMENT ON TABLE public.training_enrollments IS
  'Inscription et dossier administratif minimal pour les parcours Stripe, manuels, entreprise, OPCO ou gratuits.';
COMMENT ON COLUMN public.training_enrollments.administrative_notes IS
  'Notes strictement nécessaires au suivi administratif. Ne pas y stocker de données sensibles.';

CREATE TABLE public.training_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.training_enrollments(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  course_id text NOT NULL,
  document_type text NOT NULL,
  status text NOT NULL DEFAULT 'missing',
  version integer NOT NULL DEFAULT 1,
  content_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  visible_to_learner boolean NOT NULL DEFAULT false,
  generated_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_documents_enrollment_type_key UNIQUE (enrollment_id, document_type),
  CONSTRAINT training_documents_course_id_check
    CHECK (course_id IN ('formation-ia', 'formation-ia-act', 'formation-prompt-level-1')),
  CONSTRAINT training_documents_type_check
    CHECK (document_type IN ('training_agreement', 'convocation', 'attendance_sheet', 'completion_certificate', 'satisfaction_questionnaire')),
  CONSTRAINT training_documents_status_check
    CHECK (status IN ('missing', 'ready', 'completed', 'archived')),
  CONSTRAINT training_documents_version_check
    CHECK (version BETWEEN 1 AND 1000),
  CONSTRAINT training_documents_snapshot_check
    CHECK (jsonb_typeof(content_snapshot) = 'object' AND octet_length(content_snapshot::text) <= 65536),
  CONSTRAINT training_documents_generated_check
    CHECK ((status = 'missing' AND generated_at IS NULL) OR (status <> 'missing' AND generated_at IS NOT NULL))
);

CREATE INDEX training_documents_user_idx
  ON public.training_documents (user_id, created_at DESC);

COMMENT ON TABLE public.training_documents IS
  'Snapshots structurés privés des documents administratifs imprimables associés à une inscription.';
COMMENT ON COLUMN public.training_documents.content_snapshot IS
  'Données minimisées servant au rendu HTML imprimable. Aucun document n est exposé par URL publique permanente.';

ALTER TABLE public.training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.training_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY "Gestion administrative des inscriptions"
ON public.training_enrollments
FOR SELECT
TO authenticated
USING ((SELECT private.is_admin()));

CREATE POLICY "Lecture de ses documents visibles ou gestion administrative"
ON public.training_documents
FOR SELECT
TO authenticated
USING (
  (user_id = (SELECT auth.uid()) AND visible_to_learner)
  OR (SELECT private.is_admin())
);

REVOKE ALL ON public.training_enrollments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.training_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.training_enrollments TO authenticated;
GRANT SELECT ON public.training_documents TO authenticated;
GRANT ALL ON public.training_enrollments TO service_role;
GRANT ALL ON public.training_documents TO service_role;

COMMIT;
