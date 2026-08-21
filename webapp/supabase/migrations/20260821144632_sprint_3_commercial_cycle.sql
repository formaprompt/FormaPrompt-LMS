-- Sprint 3 : cycle commercial minimal, relié aux demandes, achats,
-- inscriptions administratives et droits pédagogiques existants.
BEGIN;

ALTER TABLE public.contact_requests
  DROP CONSTRAINT IF EXISTS contact_requests_status_check;

ALTER TABLE public.contact_requests
  ADD COLUMN request_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN course_id text,
  ADD COLUMN organization_name text,
  ADD COLUMN beneficiary_name text,
  ADD COLUMN beneficiary_email text,
  ADD COLUMN funding_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN administrative_notes text,
  ADD COLUMN assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN converted_at timestamptz,
  ADD COLUMN conversion_kind text,
  ADD COLUMN converted_purchase_id uuid REFERENCES public.purchases(id) ON DELETE RESTRICT,
  ADD COLUMN converted_enrollment_id uuid REFERENCES public.training_enrollments(id) ON DELETE RESTRICT;

UPDATE public.contact_requests
SET status = CASE status WHEN 'processed' THEN 'processing' ELSE 'new' END,
    updated_at = created_at;

ALTER TABLE public.contact_requests
  ALTER COLUMN status SET DEFAULT 'new',
  ADD CONSTRAINT contact_requests_status_check CHECK (
    status IN ('new', 'processing', 'awaiting_client', 'quote_sent', 'follow_up', 'won', 'lost')
  ),
  ADD CONSTRAINT contact_requests_type_check CHECK (
    request_type IN ('individual', 'professional', 'beneficiary', 'funding')
  ),
  ADD CONSTRAINT contact_requests_course_check CHECK (
    course_id IS NULL OR course_id IN ('formation-ia', 'formation-ia-act', 'formation-prompt-level-1')
  ),
  ADD CONSTRAINT contact_requests_organization_check CHECK (
    organization_name IS NULL OR char_length(btrim(organization_name)) BETWEEN 2 AND 200
  ),
  ADD CONSTRAINT contact_requests_beneficiary_name_check CHECK (
    beneficiary_name IS NULL OR char_length(btrim(beneficiary_name)) BETWEEN 2 AND 200
  ),
  ADD CONSTRAINT contact_requests_beneficiary_email_check CHECK (
    beneficiary_email IS NULL OR (
      char_length(beneficiary_email) <= 320
      AND beneficiary_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    )
  ),
  ADD CONSTRAINT contact_requests_notes_check CHECK (
    administrative_notes IS NULL OR char_length(administrative_notes) <= 4000
  ),
  ADD CONSTRAINT contact_requests_conversion_check CHECK (
    (status = 'won' AND converted_at IS NOT NULL AND conversion_kind IS NOT NULL)
    OR (status <> 'won' AND converted_at IS NULL AND conversion_kind IS NULL
      AND converted_purchase_id IS NULL AND converted_enrollment_id IS NULL)
  ),
  ADD CONSTRAINT contact_requests_conversion_kind_check CHECK (
    conversion_kind IS NULL OR conversion_kind IN ('stripe', 'administrative')
  );

CREATE INDEX contact_requests_pipeline_idx
  ON public.contact_requests (status, updated_at DESC);
CREATE INDEX contact_requests_email_idx
  ON public.contact_requests (lower(email), created_at DESC);

CREATE SEQUENCE public.commercial_quote_number_seq AS bigint START WITH 1;
REVOKE ALL ON SEQUENCE public.commercial_quote_number_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.commercial_quote_number_seq TO service_role;

CREATE FUNCTION private.next_commercial_quote_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 'FP-' || to_char(CURRENT_DATE, 'YYYY') || '-' ||
    lpad(nextval('public.commercial_quote_number_seq')::text, 6, '0');
$$;
REVOKE ALL ON FUNCTION private.next_commercial_quote_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.next_commercial_quote_number() TO service_role;

CREATE TABLE public.commercial_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_request_id uuid NOT NULL REFERENCES public.contact_requests(id) ON DELETE CASCADE,
  quote_number text NOT NULL UNIQUE DEFAULT private.next_commercial_quote_number(),
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  client_name text NOT NULL,
  client_email text NOT NULL,
  organization_name text,
  beneficiary_name text,
  beneficiary_email text,
  course_id text NOT NULL,
  course_title text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL,
  total_price_cents integer GENERATED ALWAYS AS (quantity * unit_price_cents) STORED,
  currency text NOT NULL DEFAULT 'eur',
  tax_statement text NOT NULL DEFAULT 'TVA non applicable, article 293 B du CGI',
  valid_until date NOT NULL,
  draft_notes text,
  sent_snapshot jsonb,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  refused_at timestamptz,
  CONSTRAINT commercial_quotes_status_check CHECK (
    status IN ('draft', 'sent', 'accepted', 'refused', 'expired')
  ),
  CONSTRAINT commercial_quotes_course_check CHECK (
    course_id IN ('formation-ia', 'formation-ia-act', 'formation-prompt-level-1')
  ),
  CONSTRAINT commercial_quotes_amount_check CHECK (
    quantity BETWEEN 1 AND 1000 AND unit_price_cents BETWEEN 0 AND 100000000
  ),
  CONSTRAINT commercial_quotes_currency_check CHECK (currency = 'eur'),
  CONSTRAINT commercial_quotes_email_check CHECK (
    char_length(client_email) <= 320
    AND client_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  CONSTRAINT commercial_quotes_snapshot_check CHECK (
    sent_snapshot IS NULL OR (jsonb_typeof(sent_snapshot) = 'object' AND octet_length(sent_snapshot::text) <= 65536)
  ),
  CONSTRAINT commercial_quotes_sent_check CHECK (
    (status = 'draft' AND sent_at IS NULL AND sent_snapshot IS NULL)
    OR (status <> 'draft' AND sent_at IS NOT NULL AND sent_snapshot IS NOT NULL)
  )
);

CREATE INDEX commercial_quotes_request_idx
  ON public.commercial_quotes (contact_request_id, created_at DESC);
CREATE INDEX commercial_quotes_status_idx
  ON public.commercial_quotes (status, valid_until);

ALTER TABLE public.training_enrollments
  ADD COLUMN commercial_request_id uuid REFERENCES public.contact_requests(id) ON DELETE SET NULL,
  ADD COLUMN commercial_quote_id uuid REFERENCES public.commercial_quotes(id) ON DELETE SET NULL,
  ADD CONSTRAINT training_enrollments_commercial_request_key UNIQUE (commercial_request_id),
  ADD CONSTRAINT training_enrollments_commercial_link_check CHECK (
    commercial_quote_id IS NULL OR commercial_request_id IS NOT NULL
  );

CREATE INDEX training_enrollments_commercial_quote_idx
  ON public.training_enrollments (commercial_quote_id)
  WHERE commercial_quote_id IS NOT NULL;

CREATE TABLE public.commercial_request_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contact_request_id uuid NOT NULL REFERENCES public.contact_requests(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  previous_status text,
  new_status text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_history_event_check CHECK (
    event_type IN ('created', 'qualified', 'status_changed', 'note_updated', 'quote_created',
      'quote_updated', 'quote_sent', 'quote_status_changed', 'email_sent', 'email_failed',
      'follow_up_scheduled', 'follow_up_sent', 'follow_up_cancelled', 'converted')
  ),
  CONSTRAINT commercial_history_details_check CHECK (
    jsonb_typeof(details) = 'object' AND octet_length(details::text) <= 16384
  )
);
CREATE INDEX commercial_request_history_request_idx
  ON public.commercial_request_history (contact_request_id, created_at DESC);

CREATE TABLE public.commercial_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_request_id uuid NOT NULL REFERENCES public.contact_requests(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.commercial_quotes(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email',
  direction text NOT NULL DEFAULT 'outbound',
  communication_type text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'prepared',
  idempotency_key text NOT NULL UNIQUE,
  provider_message_id text,
  error_code text,
  prepared_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  attempted_at timestamptz,
  sent_at timestamptz,
  CONSTRAINT commercial_communications_type_check CHECK (
    communication_type IN ('quote', 'follow_up', 'information', 'note')
  ),
  CONSTRAINT commercial_communications_channel_check CHECK (channel IN ('email', 'phone', 'other')),
  CONSTRAINT commercial_communications_direction_check CHECK (direction IN ('inbound', 'outbound')),
  CONSTRAINT commercial_communications_delivery_check CHECK (
    delivery_status IN ('prepared', 'sending', 'sent', 'failed', 'cancelled')
  ),
  CONSTRAINT commercial_communications_email_check CHECK (
    char_length(recipient_email) <= 320
    AND recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  CONSTRAINT commercial_communications_content_check CHECK (
    char_length(subject) BETWEEN 2 AND 300 AND char_length(body) BETWEEN 2 AND 10000
  ),
  CONSTRAINT commercial_communications_idempotency_check CHECK (
    char_length(idempotency_key) BETWEEN 16 AND 200
  )
);
CREATE INDEX commercial_communications_request_idx
  ON public.commercial_communications (contact_request_id, prepared_at DESC);

CREATE TABLE public.commercial_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_request_id uuid NOT NULL REFERENCES public.contact_requests(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.commercial_quotes(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  subject text NOT NULL,
  body text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  communication_id uuid REFERENCES public.commercial_communications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT commercial_follow_ups_status_check CHECK (
    status IN ('scheduled', 'sent', 'failed', 'cancelled')
  ),
  CONSTRAINT commercial_follow_ups_content_check CHECK (
    char_length(subject) BETWEEN 2 AND 300 AND char_length(body) BETWEEN 2 AND 10000
  ),
  CONSTRAINT commercial_follow_ups_schedule_check CHECK (
    scheduled_for >= created_at - interval '5 minutes'
  )
);
CREATE INDEX commercial_follow_ups_due_idx
  ON public.commercial_follow_ups (status, scheduled_for);

ALTER TABLE public.commercial_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_quotes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_request_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_communications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_follow_ups FORCE ROW LEVEL SECURITY;

CREATE POLICY "Le personnel consulte les devis" ON public.commercial_quotes
FOR SELECT TO authenticated USING ((SELECT private.is_admin()));
CREATE POLICY "Le personnel consulte l historique commercial" ON public.commercial_request_history
FOR SELECT TO authenticated USING ((SELECT private.is_admin()));
CREATE POLICY "Le personnel consulte les communications" ON public.commercial_communications
FOR SELECT TO authenticated USING ((SELECT private.is_admin()));
CREATE POLICY "Le personnel consulte les relances" ON public.commercial_follow_ups
FOR SELECT TO authenticated USING ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Soumission publique d'une demande de contact" ON public.contact_requests;
DROP POLICY IF EXISTS "Le personnel modifie les demandes de contact" ON public.contact_requests;
DROP POLICY IF EXISTS "Le personnel supprime les demandes de contact" ON public.contact_requests;
CREATE POLICY "Soumission publique d'une demande commerciale"
ON public.contact_requests FOR INSERT TO anon, authenticated
WITH CHECK (
  char_length(btrim(name)) BETWEEN 2 AND 150
  AND char_length(btrim(email)) BETWEEN 3 AND 320
  AND email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  AND char_length(btrim(subject)) BETWEEN 2 AND 200
  AND char_length(btrim(message)) BETWEEN 10 AND 5000
  AND status = 'new'
  AND request_type IN ('individual', 'professional', 'beneficiary', 'funding')
  AND administrative_notes IS NULL AND assigned_to IS NULL
  AND converted_at IS NULL AND conversion_kind IS NULL
  AND converted_purchase_id IS NULL AND converted_enrollment_id IS NULL
  AND created_at BETWEEN (now() - interval '5 minutes') AND (now() + interval '5 minutes')
);

REVOKE ALL ON public.contact_requests FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.contact_requests TO anon, authenticated;
GRANT SELECT ON public.contact_requests TO authenticated;
GRANT ALL ON public.contact_requests TO service_role;

REVOKE ALL ON public.commercial_quotes, public.commercial_request_history,
  public.commercial_communications, public.commercial_follow_ups FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.commercial_quotes, public.commercial_request_history,
  public.commercial_communications, public.commercial_follow_ups TO authenticated;
GRANT ALL ON public.commercial_quotes, public.commercial_request_history,
  public.commercial_communications, public.commercial_follow_ups TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.commercial_request_history_id_seq TO service_role;

COMMENT ON TABLE public.commercial_quotes IS
  'Devis commerciaux privés. sent_snapshot fige la version effectivement envoyée.';
COMMENT ON TABLE public.commercial_communications IS
  'Journal idempotent des communications commerciales, sans secret SMTP.';
COMMENT ON TABLE public.commercial_follow_ups IS
  'Relances préparées ou planifiées, toujours déclenchées manuellement dans le Sprint 3.';

COMMIT;
