-- Sprint 6 - Lot 1 : contrat de donnees et securite du cockpit.
-- Cette migration n ajoute aucune source de droits, aucune donnee KPI persistee
-- et ne declenche aucun appel externe.

BEGIN;

CREATE TABLE public.quality_complaints (
  quality_record_id uuid PRIMARY KEY
    REFERENCES public.quality_records(id) ON DELETE RESTRICT,
  received_at timestamptz NOT NULL,
  channel text NOT NULL,
  complainant_type text NOT NULL,
  complainant_name text,
  complainant_email text,
  training_enrollment_id uuid
    REFERENCES public.training_enrollments(id) ON DELETE RESTRICT,
  contact_request_id uuid
    REFERENCES public.contact_requests(id) ON DELETE RESTRICT,
  acknowledged_at timestamptz,
  response_due_at timestamptz,
  final_response_at timestamptz,
  outcome text NOT NULL DEFAULT 'pending',
  resolution_summary text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quality_complaints_channel_check CHECK (
    channel IN ('email', 'form', 'mail', 'phone', 'other')
  ),
  CONSTRAINT quality_complaints_complainant_type_check CHECK (
    complainant_type IN ('learner', 'customer', 'funder', 'partner', 'other')
  ),
  CONSTRAINT quality_complaints_outcome_check CHECK (
    outcome IN ('pending', 'substantiated', 'partially_substantiated', 'unsubstantiated', 'withdrawn')
  ),
  CONSTRAINT quality_complaints_name_check CHECK (
    complainant_name IS NULL
    OR char_length(btrim(complainant_name)) BETWEEN 2 AND 200
  ),
  CONSTRAINT quality_complaints_email_check CHECK (
    complainant_email IS NULL
    OR (
      char_length(btrim(complainant_email)) <= 320
      AND complainant_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    )
  ),
  CONSTRAINT quality_complaints_primary_link_check CHECK (
    num_nonnulls(training_enrollment_id, contact_request_id) <= 1
  ),
  CONSTRAINT quality_complaints_dates_check CHECK (
    received_at <= created_at + interval '5 minutes'
    AND (acknowledged_at IS NULL OR acknowledged_at >= received_at)
    AND (response_due_at IS NULL OR response_due_at >= received_at)
    AND (final_response_at IS NULL OR final_response_at >= received_at)
  ),
  CONSTRAINT quality_complaints_resolution_check CHECK (
    (
      outcome = 'pending'
      AND final_response_at IS NULL
      AND resolution_summary IS NULL
    )
    OR (
      outcome <> 'pending'
      AND final_response_at IS NOT NULL
      AND char_length(btrim(coalesce(resolution_summary, ''))) BETWEEN 10 AND 5000
    )
  )
);

CREATE INDEX quality_complaints_outcome_due_idx
  ON public.quality_complaints (outcome, response_due_at, received_at DESC);

COMMENT ON TABLE public.quality_complaints IS
  'Complement operationnel un-a-un d un quality_record de type complaint. Le statut principal reste dans quality_records.';

CREATE TABLE public.external_training_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  activity_relationship text NOT NULL,
  ordering_organization text,
  customer_category text NOT NULL,
  funding_mode text NOT NULL,
  delivery_mode text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  trainee_count integer NOT NULL DEFAULT 0,
  delivered_hours numeric(8,2) NOT NULL DEFAULT 0,
  trainee_hours numeric(10,2) NOT NULL DEFAULT 0,
  invoiced_amount_cents integer NOT NULL DEFAULT 0,
  collected_amount_cents integer,
  invoice_reference text,
  invoice_status text NOT NULL DEFAULT 'not_invoiced',
  administrative_note text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_training_activities_title_check CHECK (
    char_length(btrim(title)) BETWEEN 3 AND 250
  ),
  CONSTRAINT external_training_activities_relationship_check CHECK (
    activity_relationship IN ('direct', 'subcontracted_to_us', 'subcontracted_by_us')
  ),
  CONSTRAINT external_training_activities_organization_check CHECK (
    (ordering_organization IS NULL OR char_length(btrim(ordering_organization)) BETWEEN 2 AND 200)
    AND (activity_relationship = 'direct' OR ordering_organization IS NOT NULL)
  ),
  CONSTRAINT external_training_activities_customer_check CHECK (
    customer_category IN ('individual', 'company', 'training_organization', 'public_body', 'nonprofit', 'other')
  ),
  CONSTRAINT external_training_activities_funding_check CHECK (
    funding_mode IN ('self_funded', 'company', 'opco', 'free', 'other')
  ),
  CONSTRAINT external_training_activities_delivery_check CHECK (
    delivery_mode IN ('remote', 'in_person', 'hybrid')
  ),
  CONSTRAINT external_training_activities_status_check CHECK (
    status IN ('planned', 'completed', 'cancelled')
  ),
  CONSTRAINT external_training_activities_invoice_status_check CHECK (
    invoice_status IN ('not_invoiced', 'invoiced', 'partially_paid', 'paid', 'cancelled')
  ),
  CONSTRAINT external_training_activities_dates_check CHECK (ends_on >= starts_on),
  CONSTRAINT external_training_activities_volume_check CHECK (
    trainee_count >= 0 AND delivered_hours >= 0 AND trainee_hours >= 0
  ),
  CONSTRAINT external_training_activities_completed_check CHECK (
    status <> 'completed'
    OR (trainee_count > 0 AND delivered_hours > 0 AND trainee_hours > 0)
  ),
  CONSTRAINT external_training_activities_amounts_check CHECK (
    invoiced_amount_cents >= 0
    AND (collected_amount_cents IS NULL OR collected_amount_cents >= 0)
    AND coalesce(collected_amount_cents, 0) <= invoiced_amount_cents
  ),
  CONSTRAINT external_training_activities_invoice_coherence_check CHECK (
    (invoice_status = 'not_invoiced' AND invoiced_amount_cents = 0 AND coalesce(collected_amount_cents, 0) = 0)
    OR (invoice_status = 'invoiced' AND invoiced_amount_cents > 0 AND coalesce(collected_amount_cents, 0) = 0)
    OR (invoice_status = 'partially_paid' AND coalesce(collected_amount_cents, 0) > 0
      AND collected_amount_cents < invoiced_amount_cents)
    OR (invoice_status = 'paid' AND invoiced_amount_cents > 0
      AND collected_amount_cents = invoiced_amount_cents)
    OR (invoice_status = 'cancelled' AND coalesce(collected_amount_cents, 0) = 0)
  ),
  CONSTRAINT external_training_activities_invoice_reference_check CHECK (
    invoice_reference IS NULL OR char_length(btrim(invoice_reference)) BETWEEN 2 AND 120
  ),
  CONSTRAINT external_training_activities_note_check CHECK (
    administrative_note IS NULL OR char_length(administrative_note) <= 4000
  )
);

CREATE INDEX external_training_activities_status_period_idx
  ON public.external_training_activities (status, starts_on, ends_on);

COMMENT ON TABLE public.external_training_activities IS
  'Activites de formation hors LMS. Elles ne creent ni purchase, ni training_enrollment, ni course_access, ni transaction Stripe.';
COMMENT ON COLUMN public.external_training_activities.trainee_hours IS
  'Valeur saisie et controlee, jamais derivee automatiquement de trainee_count multiplie par delivered_hours.';

ALTER TABLE public.quality_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_complaints FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_training_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_training_activities FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture admin stricte des reclamations qualite"
ON public.quality_complaints FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

CREATE POLICY "Lecture admin stricte des activites externes"
ON public.external_training_activities FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

REVOKE ALL ON public.quality_complaints, public.external_training_activities
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.quality_complaints, public.external_training_activities
TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.quality_complaints, public.external_training_activities
TO service_role;
REVOKE DELETE, TRUNCATE ON public.quality_complaints, public.external_training_activities
FROM service_role;

CREATE FUNCTION private.validate_quality_complaint_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_record_type text;
BEGIN
  SELECT record_type INTO v_record_type
  FROM public.quality_records
  WHERE id = NEW.quality_record_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Constat qualite introuvable.' USING ERRCODE = '23503';
  END IF;
  IF v_record_type <> 'complaint' THEN
    RAISE EXCEPTION 'Le complement reclamation exige un constat de type complaint.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_quality_complaint_parent()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER validate_quality_complaint_parent
BEFORE INSERT OR UPDATE OF quality_record_id ON public.quality_complaints
FOR EACH ROW EXECUTE FUNCTION private.validate_quality_complaint_parent();

CREATE FUNCTION private.protect_quality_complaint_parent_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.record_type <> 'complaint' AND EXISTS (
    SELECT 1 FROM public.quality_complaints
    WHERE quality_record_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Un constat lie a une reclamation doit conserver le type complaint.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.protect_quality_complaint_parent_type()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER protect_quality_complaint_parent_type
BEFORE UPDATE OF record_type ON public.quality_records
FOR EACH ROW EXECUTE FUNCTION private.protect_quality_complaint_parent_type();

CREATE FUNCTION private.set_sprint6_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.set_sprint6_updated_at()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER set_quality_complaints_updated_at
BEFORE UPDATE ON public.quality_complaints
FOR EACH ROW EXECUTE FUNCTION private.set_sprint6_updated_at();
CREATE TRIGGER set_external_training_activities_updated_at
BEFORE UPDATE ON public.external_training_activities
FOR EACH ROW EXECUTE FUNCTION private.set_sprint6_updated_at();

CREATE FUNCTION private.audit_sprint6_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_reason text := nullif(current_setting('formaprompt.audit_reason', true), '');
  v_target_id text;
  v_action_type text;
  v_previous_state jsonb;
  v_new_state jsonb;
BEGIN
  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Un motif d audit de 10 a 2000 caracteres est requis.';
  END IF;

  IF TG_TABLE_NAME = 'quality_complaints' THEN
    v_target_id := NEW.quality_record_id::text;
    v_action_type := CASE WHEN TG_OP = 'INSERT'
      THEN 'quality_complaint_created' ELSE 'quality_complaint_updated' END;
    v_previous_state := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object(
      'channel', OLD.channel,
      'complainant_type', OLD.complainant_type,
      'training_enrollment_id', OLD.training_enrollment_id,
      'contact_request_id', OLD.contact_request_id,
      'acknowledged_at', OLD.acknowledged_at,
      'response_due_at', OLD.response_due_at,
      'final_response_at', OLD.final_response_at,
      'outcome', OLD.outcome
    )) END;
    v_new_state := jsonb_strip_nulls(jsonb_build_object(
      'channel', NEW.channel,
      'complainant_type', NEW.complainant_type,
      'training_enrollment_id', NEW.training_enrollment_id,
      'contact_request_id', NEW.contact_request_id,
      'acknowledged_at', NEW.acknowledged_at,
      'response_due_at', NEW.response_due_at,
      'final_response_at', NEW.final_response_at,
      'outcome', NEW.outcome
    ));
  ELSE
    v_target_id := NEW.id::text;
    v_action_type := CASE WHEN TG_OP = 'INSERT'
      THEN 'external_training_activity_created' ELSE 'external_training_activity_updated' END;
    v_previous_state := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object(
      'activity_relationship', OLD.activity_relationship,
      'status', OLD.status,
      'starts_on', OLD.starts_on,
      'ends_on', OLD.ends_on,
      'trainee_count', OLD.trainee_count,
      'delivered_hours', OLD.delivered_hours,
      'trainee_hours', OLD.trainee_hours,
      'invoiced_amount_cents', OLD.invoiced_amount_cents,
      'collected_amount_cents', OLD.collected_amount_cents,
      'invoice_status', OLD.invoice_status
    ) END;
    v_new_state := jsonb_build_object(
      'activity_relationship', NEW.activity_relationship,
      'status', NEW.status,
      'starts_on', NEW.starts_on,
      'ends_on', NEW.ends_on,
      'trainee_count', NEW.trainee_count,
      'delivered_hours', NEW.delivered_hours,
      'trainee_hours', NEW.trainee_hours,
      'invoiced_amount_cents', NEW.invoiced_amount_cents,
      'collected_amount_cents', NEW.collected_amount_cents,
      'invoice_status', NEW.invoice_status
    );
  END IF;

  INSERT INTO public.audit_log (
    actor_user_id, action_type, target_type, target_id,
    previous_state, new_state, reason, metadata
  ) VALUES (
    v_actor, v_action_type, TG_TABLE_NAME, v_target_id,
    v_previous_state, v_new_state, v_reason,
    CASE WHEN TG_TABLE_NAME = 'quality_complaints'
      THEN jsonb_build_object('quality_record_id', NEW.quality_record_id)
      ELSE jsonb_build_object('source_kind', 'external')
    END
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_sprint6_admin_change()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER audit_quality_complaints_changes
AFTER INSERT OR UPDATE ON public.quality_complaints
FOR EACH ROW EXECUTE FUNCTION private.audit_sprint6_admin_change();
CREATE TRIGGER audit_external_training_activities_changes
AFTER INSERT OR UPDATE ON public.external_training_activities
FOR EACH ROW EXECUTE FUNCTION private.audit_sprint6_admin_change();

CREATE FUNCTION public.admin_create_quality_complaint(
  p_quality_record_id uuid,
  p_received_at timestamptz,
  p_channel text,
  p_complainant_type text,
  p_reason text,
  p_complainant_name text DEFAULT NULL,
  p_complainant_email text DEFAULT NULL,
  p_training_enrollment_id uuid DEFAULT NULL,
  p_contact_request_id uuid DEFAULT NULL,
  p_acknowledged_at timestamptz DEFAULT NULL,
  p_response_due_at timestamptz DEFAULT NULL,
  p_final_response_at timestamptz DEFAULT NULL,
  p_outcome text DEFAULT 'pending',
  p_resolution_summary text DEFAULT NULL
)
RETURNS public.quality_complaints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_quality_admin(p_reason);
  v_parent public.quality_records%ROWTYPE;
  v_result public.quality_complaints%ROWTYPE;
BEGIN
  SELECT * INTO v_parent
  FROM public.quality_records
  WHERE id = p_quality_record_id
  FOR UPDATE;
  IF NOT FOUND OR v_parent.record_type <> 'complaint' THEN
    RAISE EXCEPTION 'Constat de reclamation ouvert introuvable.';
  END IF;
  IF v_parent.status = 'closed' THEN
    RAISE EXCEPTION 'Un constat cloture est immuable.';
  END IF;

  INSERT INTO public.quality_complaints (
    quality_record_id, received_at, channel, complainant_type,
    complainant_name, complainant_email, training_enrollment_id,
    contact_request_id, acknowledged_at, response_due_at,
    final_response_at, outcome, resolution_summary, created_by
  ) VALUES (
    p_quality_record_id, p_received_at, p_channel, p_complainant_type,
    nullif(btrim(p_complainant_name), ''), nullif(lower(btrim(p_complainant_email)), ''),
    p_training_enrollment_id, p_contact_request_id, p_acknowledged_at,
    p_response_due_at, p_final_response_at, p_outcome,
    nullif(btrim(p_resolution_summary), ''), v_actor
  ) RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.admin_update_quality_complaint(
  p_quality_record_id uuid,
  p_reason text,
  p_channel text DEFAULT NULL,
  p_complainant_type text DEFAULT NULL,
  p_complainant_name text DEFAULT NULL,
  p_complainant_email text DEFAULT NULL,
  p_training_enrollment_id uuid DEFAULT NULL,
  p_contact_request_id uuid DEFAULT NULL,
  p_acknowledged_at timestamptz DEFAULT NULL,
  p_response_due_at timestamptz DEFAULT NULL,
  p_final_response_at timestamptz DEFAULT NULL,
  p_outcome text DEFAULT NULL,
  p_resolution_summary text DEFAULT NULL
)
RETURNS public.quality_complaints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_quality_admin(p_reason);
  v_parent_status text;
  v_result public.quality_complaints%ROWTYPE;
BEGIN
  SELECT r.status INTO v_parent_status
  FROM public.quality_complaints c
  JOIN public.quality_records r ON r.id = c.quality_record_id
  WHERE c.quality_record_id = p_quality_record_id
  FOR UPDATE OF c, r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reclamation qualite introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_parent_status = 'closed' THEN
    RAISE EXCEPTION 'Une reclamation cloturee est immuable.';
  END IF;

  UPDATE public.quality_complaints
  SET channel = coalesce(p_channel, channel),
      complainant_type = coalesce(p_complainant_type, complainant_type),
      complainant_name = coalesce(nullif(btrim(p_complainant_name), ''), complainant_name),
      complainant_email = coalesce(nullif(lower(btrim(p_complainant_email)), ''), complainant_email),
      training_enrollment_id = coalesce(p_training_enrollment_id, training_enrollment_id),
      contact_request_id = coalesce(p_contact_request_id, contact_request_id),
      acknowledged_at = coalesce(p_acknowledged_at, acknowledged_at),
      response_due_at = coalesce(p_response_due_at, response_due_at),
      final_response_at = coalesce(p_final_response_at, final_response_at),
      outcome = coalesce(p_outcome, outcome),
      resolution_summary = coalesce(nullif(btrim(p_resolution_summary), ''), resolution_summary)
  WHERE quality_record_id = p_quality_record_id
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.admin_create_external_training_activity(
  p_title text,
  p_activity_relationship text,
  p_customer_category text,
  p_funding_mode text,
  p_delivery_mode text,
  p_starts_on date,
  p_ends_on date,
  p_status text,
  p_trainee_count integer,
  p_delivered_hours numeric,
  p_trainee_hours numeric,
  p_invoiced_amount_cents integer,
  p_invoice_status text,
  p_reason text,
  p_ordering_organization text DEFAULT NULL,
  p_collected_amount_cents integer DEFAULT NULL,
  p_invoice_reference text DEFAULT NULL,
  p_administrative_note text DEFAULT NULL
)
RETURNS public.external_training_activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_quality_admin(p_reason);
  v_result public.external_training_activities%ROWTYPE;
BEGIN
  INSERT INTO public.external_training_activities (
    title, activity_relationship, ordering_organization, customer_category,
    funding_mode, delivery_mode, starts_on, ends_on, status, trainee_count,
    delivered_hours, trainee_hours, invoiced_amount_cents,
    collected_amount_cents, invoice_reference, invoice_status,
    administrative_note, created_by
  ) VALUES (
    btrim(p_title), p_activity_relationship, nullif(btrim(p_ordering_organization), ''),
    p_customer_category, p_funding_mode, p_delivery_mode, p_starts_on, p_ends_on,
    p_status, p_trainee_count, p_delivered_hours, p_trainee_hours,
    p_invoiced_amount_cents, p_collected_amount_cents,
    nullif(btrim(p_invoice_reference), ''), p_invoice_status,
    nullif(btrim(p_administrative_note), ''), v_actor
  ) RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.admin_update_external_training_activity(
  p_activity_id uuid,
  p_reason text,
  p_title text DEFAULT NULL,
  p_activity_relationship text DEFAULT NULL,
  p_ordering_organization text DEFAULT NULL,
  p_customer_category text DEFAULT NULL,
  p_funding_mode text DEFAULT NULL,
  p_delivery_mode text DEFAULT NULL,
  p_starts_on date DEFAULT NULL,
  p_ends_on date DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_trainee_count integer DEFAULT NULL,
  p_delivered_hours numeric DEFAULT NULL,
  p_trainee_hours numeric DEFAULT NULL,
  p_invoiced_amount_cents integer DEFAULT NULL,
  p_collected_amount_cents integer DEFAULT NULL,
  p_invoice_reference text DEFAULT NULL,
  p_invoice_status text DEFAULT NULL,
  p_administrative_note text DEFAULT NULL
)
RETURNS public.external_training_activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_quality_admin(p_reason);
  v_current public.external_training_activities%ROWTYPE;
  v_result public.external_training_activities%ROWTYPE;
BEGIN
  SELECT * INTO v_current
  FROM public.external_training_activities
  WHERE id = p_activity_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activite externe introuvable.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.external_training_activities
  SET title = coalesce(nullif(btrim(p_title), ''), title),
      activity_relationship = coalesce(p_activity_relationship, activity_relationship),
      ordering_organization = coalesce(nullif(btrim(p_ordering_organization), ''), ordering_organization),
      customer_category = coalesce(p_customer_category, customer_category),
      funding_mode = coalesce(p_funding_mode, funding_mode),
      delivery_mode = coalesce(p_delivery_mode, delivery_mode),
      starts_on = coalesce(p_starts_on, starts_on),
      ends_on = coalesce(p_ends_on, ends_on),
      status = coalesce(p_status, status),
      trainee_count = coalesce(p_trainee_count, trainee_count),
      delivered_hours = coalesce(p_delivered_hours, delivered_hours),
      trainee_hours = coalesce(p_trainee_hours, trainee_hours),
      invoiced_amount_cents = coalesce(p_invoiced_amount_cents, invoiced_amount_cents),
      collected_amount_cents = coalesce(p_collected_amount_cents, collected_amount_cents),
      invoice_reference = coalesce(nullif(btrim(p_invoice_reference), ''), invoice_reference),
      invoice_status = coalesce(p_invoice_status, invoice_status),
      administrative_note = coalesce(nullif(btrim(p_administrative_note), ''), administrative_note)
  WHERE id = p_activity_id
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_quality_complaint(
  uuid,timestamptz,text,text,text,text,text,uuid,uuid,timestamptz,timestamptz,timestamptz,text,text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_update_quality_complaint(
  uuid,text,text,text,text,text,uuid,uuid,timestamptz,timestamptz,timestamptz,text,text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_create_external_training_activity(
  text,text,text,text,text,date,date,text,integer,numeric,numeric,integer,text,text,text,integer,text,text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_update_external_training_activity(
  uuid,text,text,text,text,text,text,text,date,date,text,integer,numeric,numeric,integer,integer,text,text,text
) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.admin_create_quality_complaint(
  uuid,timestamptz,text,text,text,text,text,uuid,uuid,timestamptz,timestamptz,timestamptz,text,text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_quality_complaint(
  uuid,text,text,text,text,text,uuid,uuid,timestamptz,timestamptz,timestamptz,text,text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_external_training_activity(
  text,text,text,text,text,date,date,text,integer,numeric,numeric,integer,text,text,text,integer,text,text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_external_training_activity(
  uuid,text,text,text,text,text,text,text,date,date,text,integer,numeric,numeric,integer,integer,text,text,text
) TO authenticated;

CREATE VIEW public.admin_cockpit_action_items
WITH (security_invoker = true, security_barrier = true)
AS
SELECT items.*
FROM (
  SELECT
    'stripe'::text AS domain,
    c.severity,
    c.case_type AS item_type,
    c.id::text AS item_id,
    c.course_id,
    'Cas de reconciliation Stripe a examiner'::text AS neutral_label,
    c.detected_at AS created_at,
    NULL::timestamptz AS due_at,
    greatest(0, extract(epoch FROM now() - c.detected_at)::bigint) AS age_seconds,
    '/admin/stripe-apres-paiement'::text AS destination_path
  FROM public.stripe_reconciliation_cases c
  WHERE c.status IN ('pending', 'reviewed')

  UNION ALL

  SELECT
    'quality', a.priority, 'quality_action', a.id::text, NULL::text,
    'Action qualite a traiter', a.created_at, a.due_at,
    greatest(0, extract(epoch FROM now() - a.created_at)::bigint),
    '/admin/qualite'
  FROM public.quality_actions a
  JOIN public.quality_records r ON r.id = a.quality_record_id
  WHERE a.status IN ('planned', 'in_progress', 'blocked')
    AND r.status <> 'closed'

  UNION ALL

  SELECT
    'quality', r.severity, 'complaint', c.quality_record_id::text,
    coalesce(e.course_id, q.course_id),
    'Reclamation a instruire', c.received_at, c.response_due_at,
    greatest(0, extract(epoch FROM now() - c.received_at)::bigint),
    '/admin/qualite'
  FROM public.quality_complaints c
  JOIN public.quality_records r ON r.id = c.quality_record_id
  LEFT JOIN public.training_enrollments e ON e.id = c.training_enrollment_id
  LEFT JOIN public.contact_requests q ON q.id = c.contact_request_id
  WHERE c.outcome = 'pending' AND r.status NOT IN ('resolved', 'closed')

  UNION ALL

  SELECT
    'commercial',
    CASE WHEN f.status = 'failed' THEN 'high' ELSE 'medium' END,
    'commercial_follow_up', f.id::text, q.course_id,
    CASE WHEN f.status = 'failed' THEN 'Relance commerciale en echec'
      ELSE 'Relance commerciale arrivee a echeance' END,
    f.created_at, f.scheduled_for,
    greatest(0, extract(epoch FROM now() - f.created_at)::bigint),
    '/admin/commercial'
  FROM public.commercial_follow_ups f
  JOIN public.contact_requests q ON q.id = f.contact_request_id
  WHERE f.status = 'failed'
    OR (f.status = 'scheduled' AND f.scheduled_for <= now())

  UNION ALL

  SELECT
    'commercial', 'medium', 'funding_review', e.id::text, e.course_id,
    'Dossier de financement a instruire', e.updated_at, e.starts_at,
    greatest(0, extract(epoch FROM now() - e.updated_at)::bigint),
    '/admin/dossiers'
  FROM public.training_enrollments e
  WHERE e.funding_status = 'requested'
    AND e.status NOT IN ('completed', 'archived', 'cancelled', 'abandoned')

  UNION ALL

  SELECT
    'legal',
    CASE WHEN w.acknowledgement_delivery_status = 'failed' THEN 'high' ELSE 'medium' END,
    'withdrawal_request', w.id::text, w.course_id,
    CASE WHEN w.acknowledgement_delivery_status = 'failed'
      THEN 'Accuse de reception de retractation en echec'
      ELSE 'Demande de retractation a instruire' END,
    w.received_at, NULL::timestamptz,
    greatest(0, extract(epoch FROM now() - w.received_at)::bigint),
    '/admin'
  FROM public.withdrawal_requests w
  WHERE w.status IN ('received', 'under_review')
     OR w.acknowledgement_delivery_status = 'failed'

  UNION ALL

  SELECT
    'privacy', 'high', 'privacy_request', p.id::text, NULL::text,
    'Demande RGPD a instruire', p.received_at, NULL::timestamptz,
    greatest(0, extract(epoch FROM now() - p.received_at)::bigint),
    '/admin/demandes-rgpd'
  FROM public.privacy_requests p
  WHERE p.status <> 'closed'
) AS items
WHERE (SELECT private.is_strict_admin());

CREATE VIEW public.admin_internal_training_activity
WITH (security_invoker = true, security_barrier = true)
AS
WITH attendance AS (
  SELECT
    a.booking_request_id,
    count(*) AS session_count,
    count(*) FILTER (WHERE a.trainer_status IN ('pending', 'technical_issue')) AS unresolved_count,
    round(sum(
      CASE
        WHEN a.trainer_status = 'present' THEN
          extract(epoch FROM (a.session_ends_at - a.session_starts_at)) / 3600.0
        WHEN a.trainer_status = 'partial' THEN
          extract(epoch FROM (a.actual_ends_at - a.session_starts_at)) / 3600.0
        WHEN a.trainer_status = 'absent' THEN 0
        ELSE 0
      END
    )::numeric, 2) AS verified_hours
  FROM public.course_session_attendance a
  GROUP BY a.booking_request_id
)
SELECT
  'internal_lms'::text AS source_kind,
  e.id AS activity_id,
  e.id AS training_enrollment_id,
  e.user_id AS trainee_reference,
  e.course_id AS title,
  e.course_id,
  NULL::text AS activity_relationship,
  e.organization_name AS ordering_organization,
  NULL::text AS customer_category,
  e.funding_mode,
  e.funder_name,
  e.delivery_mode,
  (e.starts_at AT TIME ZONE 'Europe/Paris')::date AS starts_on,
  (e.ends_at AT TIME ZONE 'Europe/Paris')::date AS ends_on,
  e.status,
  1::integer AS trainee_count,
  round((e.duration_minutes::numeric / 60.0), 2) AS planned_hours,
  CASE WHEN a.session_count IS NULL OR a.unresolved_count > 0
    THEN NULL ELSE a.verified_hours END AS delivered_hours,
  CASE WHEN a.session_count IS NULL OR a.unresolved_count > 0
    THEN NULL ELSE a.verified_hours END AS trainee_hours,
  e.price_amount_cents AS administrative_amount_cents,
  NULL::integer AS invoiced_amount_cents,
  NULL::integer AS collected_amount_cents,
  NULL::text AS invoice_status,
  e.commercial_request_id AS commercial_reference_id,
  e.booking_request_id
FROM public.training_enrollments e
LEFT JOIN attendance a ON a.booking_request_id = e.booking_request_id
WHERE (SELECT private.is_strict_admin());

CREATE VIEW public.admin_training_activity_all_sources
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  i.source_kind, i.activity_id, i.training_enrollment_id, i.trainee_reference,
  i.title, i.course_id, i.activity_relationship, i.ordering_organization,
  i.customer_category, i.funding_mode, i.funder_name, i.delivery_mode,
  i.starts_on, i.ends_on, i.status, i.trainee_count, i.planned_hours,
  i.delivered_hours, i.trainee_hours, i.administrative_amount_cents,
  i.invoiced_amount_cents, i.collected_amount_cents, i.invoice_status,
  i.commercial_reference_id, i.booking_request_id
FROM public.admin_internal_training_activity i

UNION ALL

SELECT
  'external'::text, e.id, NULL::uuid, NULL::uuid,
  e.title, NULL::text, e.activity_relationship, e.ordering_organization,
  e.customer_category, e.funding_mode, NULL::text, e.delivery_mode,
  e.starts_on, e.ends_on, e.status, e.trainee_count, NULL::numeric,
  e.delivered_hours, e.trainee_hours, NULL::integer,
  e.invoiced_amount_cents, e.collected_amount_cents, e.invoice_status,
  NULL::uuid, NULL::uuid
FROM public.external_training_activities e
WHERE (SELECT private.is_strict_admin());

CREATE VIEW public.admin_stripe_financial_summary
WITH (security_invoker = true, security_barrier = true)
AS
WITH refunds AS (
  SELECT r.transaction_id,
    sum(r.amount) FILTER (WHERE r.status = 'succeeded')::bigint AS succeeded_amount
  FROM public.stripe_refunds r
  GROUP BY r.transaction_id
), disputes AS (
  SELECT d.transaction_id,
    sum(d.amount) FILTER (WHERE d.status = 'lost')::bigint AS lost_amount,
    sum(d.amount) FILTER (WHERE d.status NOT IN ('lost', 'won', 'warning_closed'))::bigint AS open_amount
  FROM public.stripe_disputes d
  GROUP BY d.transaction_id
), amounts AS (
  SELECT
    t.*,
    least(coalesce(r.succeeded_amount, 0), coalesce(t.amount_total, 0)::bigint) AS refund_amount,
    least(
      greatest(coalesce(d.lost_amount, 0) - least(coalesce(r.succeeded_amount, 0), coalesce(t.amount_total, 0)::bigint), 0),
      greatest(coalesce(t.amount_total, 0)::bigint - least(coalesce(r.succeeded_amount, 0), coalesce(t.amount_total, 0)::bigint), 0)
    ) AS non_overlapping_lost_amount,
    coalesce(d.open_amount, 0) AS open_dispute_amount,
    t.status IN ('paid', 'partially_refunded', 'refunded', 'disputed', 'dispute_won', 'dispute_lost') AS reached_paid_state
  FROM public.stripe_payment_transactions t
  LEFT JOIN refunds r ON r.transaction_id = t.id
  LEFT JOIN disputes d ON d.transaction_id = t.id
)
SELECT
  a.id AS transaction_id,
  a.purchase_id,
  a.course_id,
  a.payment_type,
  a.status AS transaction_status,
  a.currency,
  (a.created_at AT TIME ZONE 'Europe/Paris')::date AS occurred_on,
  CASE WHEN a.reached_paid_state AND a.payment_type = 'course'
    THEN coalesce(a.amount_total, 0)::bigint ELSE 0 END AS gross_training_cents,
  CASE WHEN a.reached_paid_state AND a.payment_type = 'in_person_travel_fee'
    THEN coalesce(a.amount_total, 0)::bigint ELSE 0 END AS travel_fee_cents,
  CASE WHEN a.reached_paid_state THEN a.refund_amount ELSE 0 END AS successful_refund_cents,
  a.open_dispute_amount AS open_dispute_cents,
  CASE WHEN a.reached_paid_state THEN a.non_overlapping_lost_amount ELSE 0 END AS lost_dispute_cents,
  CASE WHEN a.reached_paid_state THEN greatest(
    coalesce(a.amount_total, 0)::bigint - a.refund_amount - a.non_overlapping_lost_amount, 0
  ) ELSE 0 END AS estimated_net_stripe_cents,
  CASE WHEN a.reached_paid_state AND a.payment_type = 'course' THEN greatest(
    coalesce(a.amount_total, 0)::bigint - a.refund_amount - a.non_overlapping_lost_amount, 0
  ) ELSE 0 END AS estimated_net_training_cents,
  true AS is_estimate
FROM amounts a
WHERE (SELECT private.is_strict_admin());

CREATE VIEW public.admin_bpf_preparation_rows
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  a.source_kind,
  a.activity_id,
  a.training_enrollment_id,
  a.title,
  a.course_id,
  a.activity_relationship,
  a.ordering_organization,
  a.customer_category,
  a.funding_mode,
  a.funder_name,
  a.starts_on,
  a.ends_on,
  a.trainee_count,
  a.planned_hours,
  a.delivered_hours AS training_hours,
  a.trainee_hours,
  CASE WHEN a.source_kind = 'external'
    THEN a.invoiced_amount_cents ELSE a.administrative_amount_cents END AS product_amount_cents,
  CASE WHEN a.source_kind = 'external'
    THEN 'external_invoiced_amount' ELSE 'internal_administrative_amount' END AS product_amount_basis,
  a.invoice_status
FROM public.admin_training_activity_all_sources a
WHERE a.status = 'completed'
  AND (SELECT private.is_strict_admin());

REVOKE ALL ON public.admin_cockpit_action_items,
  public.admin_internal_training_activity,
  public.admin_training_activity_all_sources,
  public.admin_stripe_financial_summary,
  public.admin_bpf_preparation_rows
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_cockpit_action_items,
  public.admin_internal_training_activity,
  public.admin_training_activity_all_sources,
  public.admin_stripe_financial_summary,
  public.admin_bpf_preparation_rows
TO authenticated;

COMMENT ON VIEW public.admin_cockpit_action_items IS
  'File derivee d elements objectivement actionnables. Aucun libelle ne contient de donnee personnelle.';
COMMENT ON VIEW public.admin_stripe_financial_summary IS
  'Projection locale estimee par transaction. Elle ne represente ni le solde Stripe ni un solde bancaire.';
COMMENT ON VIEW public.admin_bpf_preparation_rows IS
  'Lignes preparatoires controlables, sans valeur de declaration BPF automatique.';

CREATE FUNCTION public.admin_get_cockpit_summary(
  p_date_from date DEFAULT date_trunc('year', current_date)::date,
  p_date_to date DEFAULT current_date,
  p_course_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_actions jsonb;
  v_domain_counts jsonb;
  v_financial jsonb;
  v_action_count integer;
  v_critical_count integer;
  v_active_access_count integer;
  v_completed_activity_count integer;
  v_completed_trainee_count bigint;
  v_overdue_quality_count integer;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action reservee au role admin.' USING ERRCODE = '42501';
  END IF;
  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to < p_date_from THEN
    RAISE EXCEPTION 'Periode de cockpit invalide.' USING ERRCODE = '22007';
  END IF;
  IF p_course_id IS NOT NULL AND p_course_id NOT IN (
    'formation-ia', 'formation-prompt-level-1', 'formation-ia-act'
  ) THEN
    RAISE EXCEPTION 'Formation de filtre invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE severity = 'critical')::integer
  INTO v_action_count, v_critical_count
  FROM public.admin_cockpit_action_items
  WHERE p_course_id IS NULL OR course_id = p_course_id;

  SELECT coalesce(jsonb_object_agg(domain, item_count), '{}'::jsonb)
  INTO v_domain_counts
  FROM (
    SELECT domain, count(*)::integer AS item_count
    FROM public.admin_cockpit_action_items
    WHERE p_course_id IS NULL OR course_id = p_course_id
    GROUP BY domain
  ) counts;

  SELECT coalesce(jsonb_agg((to_jsonb(priorities) - 'priority_rank' - 'overdue_rank')
    ORDER BY priority_rank, overdue_rank, due_at NULLS LAST, created_at), '[]'::jsonb)
  INTO v_actions
  FROM (
    SELECT domain, severity, item_type, item_id, course_id, neutral_label,
           created_at, due_at, age_seconds, destination_path,
           CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END AS priority_rank,
           CASE WHEN due_at IS NOT NULL AND due_at < now() THEN 0 ELSE 1 END AS overdue_rank
    FROM public.admin_cockpit_action_items
    WHERE p_course_id IS NULL OR course_id = p_course_id
    ORDER BY priority_rank, overdue_rank, due_at NULLS LAST, created_at
    LIMIT 20
  ) priorities;

  SELECT count(*)::integer INTO v_active_access_count
  FROM public.course_access a
  WHERE a.status = 'active'
    AND (a.expires_at IS NULL OR a.expires_at > now())
    AND (p_course_id IS NULL OR a.course_id = p_course_id);

  SELECT count(*)::integer, coalesce(sum(trainee_count), 0)::bigint
  INTO v_completed_activity_count, v_completed_trainee_count
  FROM public.admin_training_activity_all_sources a
  WHERE a.status = 'completed'
    AND a.starts_on BETWEEN p_date_from AND p_date_to
    AND (p_course_id IS NULL OR a.course_id = p_course_id);

  SELECT count(*)::integer INTO v_overdue_quality_count
  FROM public.quality_actions a
  WHERE a.status IN ('planned', 'in_progress', 'blocked')
    AND a.due_at < now();

  SELECT coalesce(jsonb_agg(to_jsonb(finances) ORDER BY currency), '[]'::jsonb)
  INTO v_financial
  FROM (
    SELECT coalesce(currency, 'unknown') AS currency,
      sum(gross_training_cents) AS gross_training_cents,
      sum(travel_fee_cents) AS travel_fee_cents,
      sum(successful_refund_cents) AS successful_refund_cents,
      sum(open_dispute_cents) AS open_dispute_cents,
      sum(lost_dispute_cents) AS lost_dispute_cents,
      sum(estimated_net_stripe_cents) AS estimated_net_stripe_cents,
      sum(estimated_net_training_cents) AS estimated_net_training_cents,
      true AS is_estimate
    FROM public.admin_stripe_financial_summary f
    WHERE f.occurred_on BETWEEN p_date_from AND p_date_to
      AND (p_course_id IS NULL OR f.course_id = p_course_id)
    GROUP BY coalesce(currency, 'unknown')
  ) finances;

  RETURN jsonb_build_object(
    'filters', jsonb_build_object(
      'date_from', p_date_from,
      'date_to', p_date_to,
      'course_id', p_course_id
    ),
    'kpis', jsonb_build_object(
      'action_items_total', v_action_count,
      'critical_action_items', v_critical_count,
      'active_course_access', v_active_access_count,
      'completed_training_activities', v_completed_activity_count,
      'completed_trainees', v_completed_trainee_count,
      'overdue_quality_actions', v_overdue_quality_count
    ),
    'action_counts_by_domain', v_domain_counts,
    'priority_actions', v_actions,
    'stripe_financial_by_currency', v_financial
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_cockpit_summary(date,date,text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_cockpit_summary(date,date,text)
TO authenticated;

COMMIT;
