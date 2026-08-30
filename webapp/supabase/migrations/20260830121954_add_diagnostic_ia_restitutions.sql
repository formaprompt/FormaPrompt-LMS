-- LOT 1E-A : restitution metier du Diagnostic IA Express.
-- Migration additive uniquement : aucune interaction avec purchases, course_access,
-- Stripe, Google Calendar ou Google Meet.

BEGIN;

CREATE FUNCTION private.diagnostic_ia_plain_text_is_valid(
  p_value text,
  p_min_length integer,
  p_max_length integer
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT p_value IS NOT NULL
    AND p_min_length >= 0
    AND p_max_length >= p_min_length
    AND char_length(btrim(p_value)) BETWEEN p_min_length AND p_max_length
    -- Le contenu est du texte brut. Les balises HTML libres sont refusees.
    AND p_value !~ '<[[:space:]]*/?[[:alpha:]!][^>]*>';
$$;

CREATE FUNCTION private.diagnostic_ia_text_array_is_valid(
  p_values text[],
  p_max_items integer,
  p_max_item_length integer
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_value text;
BEGIN
  IF p_values IS NULL
    OR p_max_items < 0
    OR p_max_item_length < 1
    OR cardinality(p_values) > p_max_items
    OR coalesce(array_ndims(p_values), 1) <> 1
  THEN
    RETURN false;
  END IF;

  FOREACH v_value IN ARRAY p_values LOOP
    IF NOT private.diagnostic_ia_plain_text_is_valid(v_value, 1, p_max_item_length) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE FUNCTION private.diagnostic_ia_jsonb_text_array_is_valid(
  p_values jsonb,
  p_max_items integer,
  p_max_item_length integer
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_value jsonb;
BEGIN
  IF p_values IS NULL
    OR jsonb_typeof(p_values) <> 'array'
    OR jsonb_array_length(p_values) > p_max_items
  THEN
    RETURN false;
  END IF;

  FOR v_value IN SELECT value FROM jsonb_array_elements(p_values) LOOP
    IF jsonb_typeof(v_value) <> 'string'
      OR NOT private.diagnostic_ia_plain_text_is_valid(v_value #>> '{}', 1, p_max_item_length)
    THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE FUNCTION private.diagnostic_ia_priority_opportunities_are_valid(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_keys constant text[] := ARRAY[
    'title', 'expected_benefit', 'effort', 'indicative_cost',
    'risk_or_watchpoint', 'first_action'
  ];
BEGIN
  IF p_value IS NULL
    OR jsonb_typeof(p_value) <> 'array'
    OR jsonb_array_length(p_value) > 3
  THEN
    RETURN false;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
    IF jsonb_typeof(v_item) <> 'object'
      OR NOT (v_item ?& v_keys)
      OR (v_item - v_keys) <> '{}'::jsonb
      OR jsonb_typeof(v_item->'title') <> 'string'
      OR jsonb_typeof(v_item->'expected_benefit') <> 'string'
      OR jsonb_typeof(v_item->'effort') <> 'string'
      OR jsonb_typeof(v_item->'indicative_cost') <> 'string'
      OR jsonb_typeof(v_item->'risk_or_watchpoint') <> 'string'
      OR jsonb_typeof(v_item->'first_action') <> 'string'
      OR NOT private.diagnostic_ia_plain_text_is_valid(v_item->>'title', 0, 200)
      OR NOT private.diagnostic_ia_plain_text_is_valid(v_item->>'expected_benefit', 0, 1000)
      OR NOT private.diagnostic_ia_plain_text_is_valid(v_item->>'effort', 0, 300)
      OR NOT private.diagnostic_ia_plain_text_is_valid(v_item->>'indicative_cost', 0, 300)
      OR NOT private.diagnostic_ia_plain_text_is_valid(v_item->>'risk_or_watchpoint', 0, 1000)
      OR NOT private.diagnostic_ia_plain_text_is_valid(v_item->>'first_action', 0, 1000)
    THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE FUNCTION private.diagnostic_ia_short_term_actions_are_valid(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_keys constant text[] := ARRAY['action', 'horizon'];
BEGIN
  IF p_value IS NULL
    OR jsonb_typeof(p_value) <> 'array'
    OR jsonb_array_length(p_value) > 6
  THEN
    RETURN false;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
    IF jsonb_typeof(v_item) <> 'object'
      OR NOT (v_item ?& v_keys)
      OR (v_item - v_keys) <> '{}'::jsonb
      OR jsonb_typeof(v_item->'action') <> 'string'
      OR jsonb_typeof(v_item->'horizon') <> 'string'
      OR NOT private.diagnostic_ia_plain_text_is_valid(v_item->>'action', 0, 1000)
      OR (v_item->>'horizon') NOT IN ('', 'immediate', '30_days', '90_days')
    THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE TABLE public.diagnostic_ia_restitutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE
    REFERENCES public.diagnostic_ia_bookings(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  source_questionnaire_id uuid
    REFERENCES public.diagnostic_ia_preparation_questionnaires(id) ON DELETE SET NULL,
  questionnaire_version_used text,
  content_version text NOT NULL DEFAULT 'DIAGNOSTIC-IA-RESTITUTION-2026-08-30',
  status text NOT NULL DEFAULT 'draft',
  revision integer NOT NULL DEFAULT 1,
  content_sha256 text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  published_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  corrected_at timestamptz,
  retention_due_at timestamptz,

  overall_summary text NOT NULL DEFAULT '',
  observed_maturity_level smallint,
  maturity_assessment text NOT NULL DEFAULT '',
  current_uses text NOT NULL DEFAULT '',
  strengths text[] NOT NULL DEFAULT ARRAY[]::text[],
  watch_points text[] NOT NULL DEFAULT ARRAY[]::text[],
  priority_opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations text[] NOT NULL DEFAULT ARRAY[]::text[],
  short_term_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_tool_families text[] NOT NULL DEFAULT ARRAY[]::text[],
  privacy_rgpd_considerations text NOT NULL DEFAULT '',
  ai_act_considerations text NOT NULL DEFAULT '',
  next_steps text NOT NULL DEFAULT '',

  CONSTRAINT diagnostic_ia_restitutions_content_version_check CHECK (
    content_version = 'DIAGNOSTIC-IA-RESTITUTION-2026-08-30'
  ),
  CONSTRAINT diagnostic_ia_restitutions_status_check CHECK (
    status IN ('draft', 'published')
  ),
  CONSTRAINT diagnostic_ia_restitutions_revision_check CHECK (revision >= 1),
  CONSTRAINT diagnostic_ia_restitutions_sha_check CHECK (
    content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT diagnostic_ia_restitutions_questionnaire_version_check CHECK (
    questionnaire_version_used IS NULL
    OR char_length(btrim(questionnaire_version_used)) BETWEEN 1 AND 100
  ),
  CONSTRAINT diagnostic_ia_restitutions_maturity_level_check CHECK (
    observed_maturity_level IS NULL OR observed_maturity_level BETWEEN 1 AND 5
  ),
  CONSTRAINT diagnostic_ia_restitutions_narrative_bounds_check CHECK (
    private.diagnostic_ia_plain_text_is_valid(overall_summary, 0, 6000)
    AND private.diagnostic_ia_plain_text_is_valid(maturity_assessment, 0, 4000)
    AND private.diagnostic_ia_plain_text_is_valid(current_uses, 0, 4000)
    AND private.diagnostic_ia_plain_text_is_valid(privacy_rgpd_considerations, 0, 4000)
    AND private.diagnostic_ia_plain_text_is_valid(ai_act_considerations, 0, 4000)
    AND private.diagnostic_ia_plain_text_is_valid(next_steps, 0, 4000)
  ),
  CONSTRAINT diagnostic_ia_restitutions_text_lists_check CHECK (
    private.diagnostic_ia_text_array_is_valid(strengths, 10, 500)
    AND private.diagnostic_ia_text_array_is_valid(watch_points, 10, 500)
    AND private.diagnostic_ia_text_array_is_valid(recommendations, 12, 1000)
    AND private.diagnostic_ia_text_array_is_valid(recommended_tool_families, 12, 300)
  ),
  CONSTRAINT diagnostic_ia_restitutions_opportunities_check CHECK (
    private.diagnostic_ia_priority_opportunities_are_valid(priority_opportunities)
  ),
  CONSTRAINT diagnostic_ia_restitutions_actions_check CHECK (
    private.diagnostic_ia_short_term_actions_are_valid(short_term_actions)
  ),
  CONSTRAINT diagnostic_ia_restitutions_publication_check CHECK (
    (
      status = 'draft'
      AND published_by IS NULL
      AND published_at IS NULL
      AND corrected_at IS NULL
      AND retention_due_at IS NULL
    )
    OR (
      status = 'published'
      AND published_by IS NOT NULL
      AND published_at IS NOT NULL
      AND retention_due_at IS NOT NULL
      AND retention_due_at >= published_at
      AND (corrected_at IS NULL OR corrected_at >= published_at)
    )
  ),
  CONSTRAINT diagnostic_ia_restitutions_timestamps_check CHECK (
    updated_at >= created_at
    AND (published_at IS NULL OR published_at >= created_at)
  )
);

CREATE INDEX diagnostic_ia_restitutions_owner_status_idx
  ON public.diagnostic_ia_restitutions(user_id, status, published_at DESC);
CREATE INDEX diagnostic_ia_restitutions_admin_status_idx
  ON public.diagnostic_ia_restitutions(status, updated_at DESC);
CREATE INDEX diagnostic_ia_restitutions_retention_idx
  ON public.diagnostic_ia_restitutions(retention_due_at)
  WHERE status = 'published';
CREATE INDEX diagnostic_ia_restitutions_questionnaire_idx
  ON public.diagnostic_ia_restitutions(source_questionnaire_id)
  WHERE source_questionnaire_id IS NOT NULL;

CREATE FUNCTION private.diagnostic_ia_restitution_content_json(
  p_restitution public.diagnostic_ia_restitutions
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'overall_summary', p_restitution.overall_summary,
    'observed_maturity_level', p_restitution.observed_maturity_level,
    'maturity_assessment', p_restitution.maturity_assessment,
    'current_uses', p_restitution.current_uses,
    'strengths', to_jsonb(p_restitution.strengths),
    'watch_points', to_jsonb(p_restitution.watch_points),
    'priority_opportunities', p_restitution.priority_opportunities,
    'recommendations', to_jsonb(p_restitution.recommendations),
    'short_term_actions', p_restitution.short_term_actions,
    'recommended_tool_families', to_jsonb(p_restitution.recommended_tool_families),
    'privacy_rgpd_considerations', p_restitution.privacy_rgpd_considerations,
    'ai_act_considerations', p_restitution.ai_act_considerations,
    'next_steps', p_restitution.next_steps
  );
$$;

CREATE FUNCTION private.diagnostic_ia_restitution_content_sha256(
  p_restitution public.diagnostic_ia_restitutions
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        private.diagnostic_ia_restitution_content_json(p_restitution)::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

COMMENT ON FUNCTION private.diagnostic_ia_restitution_content_json(public.diagnostic_ia_restitutions) IS
  'Representation canonique JSONB des treize champs metier de la restitution. Le hash exclut identifiants, acteurs, statut, revision et horodatages.';

CREATE FUNCTION private.diagnostic_ia_restitution_payload_is_valid(p_content jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_keys constant text[] := ARRAY[
    'overall_summary', 'observed_maturity_level', 'maturity_assessment',
    'current_uses', 'strengths', 'watch_points', 'priority_opportunities',
    'recommendations', 'short_term_actions', 'recommended_tool_families',
    'privacy_rgpd_considerations', 'ai_act_considerations', 'next_steps'
  ];
BEGIN
  IF p_content IS NULL
    OR jsonb_typeof(p_content) <> 'object'
    OR NOT (p_content ?& v_keys)
    OR (p_content - v_keys) <> '{}'::jsonb
  THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(p_content->'overall_summary') <> 'string'
    OR jsonb_typeof(p_content->'maturity_assessment') <> 'string'
    OR jsonb_typeof(p_content->'current_uses') <> 'string'
    OR jsonb_typeof(p_content->'privacy_rgpd_considerations') <> 'string'
    OR jsonb_typeof(p_content->'ai_act_considerations') <> 'string'
    OR jsonb_typeof(p_content->'next_steps') <> 'string'
  THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(p_content->'observed_maturity_level') NOT IN ('number', 'null')
    OR (
      jsonb_typeof(p_content->'observed_maturity_level') = 'number'
      AND (p_content->>'observed_maturity_level') !~ '^[1-5]$'
    )
  THEN
    RETURN false;
  END IF;

  RETURN private.diagnostic_ia_plain_text_is_valid(p_content->>'overall_summary', 0, 6000)
    AND private.diagnostic_ia_plain_text_is_valid(p_content->>'maturity_assessment', 0, 4000)
    AND private.diagnostic_ia_plain_text_is_valid(p_content->>'current_uses', 0, 4000)
    AND private.diagnostic_ia_plain_text_is_valid(p_content->>'privacy_rgpd_considerations', 0, 4000)
    AND private.diagnostic_ia_plain_text_is_valid(p_content->>'ai_act_considerations', 0, 4000)
    AND private.diagnostic_ia_plain_text_is_valid(p_content->>'next_steps', 0, 4000)
    AND private.diagnostic_ia_jsonb_text_array_is_valid(p_content->'strengths', 10, 500)
    AND private.diagnostic_ia_jsonb_text_array_is_valid(p_content->'watch_points', 10, 500)
    AND private.diagnostic_ia_priority_opportunities_are_valid(p_content->'priority_opportunities')
    AND private.diagnostic_ia_jsonb_text_array_is_valid(p_content->'recommendations', 12, 1000)
    AND private.diagnostic_ia_short_term_actions_are_valid(p_content->'short_term_actions')
    AND private.diagnostic_ia_jsonb_text_array_is_valid(p_content->'recommended_tool_families', 12, 300);
END;
$$;

CREATE FUNCTION private.diagnostic_ia_trim_text_array(p_values text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT coalesce(array_agg(btrim(item) ORDER BY ordinal), ARRAY[]::text[])
  FROM unnest(p_values) WITH ORDINALITY AS values_with_order(item, ordinal);
$$;

CREATE FUNCTION private.normalize_diagnostic_ia_priority_opportunities(p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_result jsonb := '[]'::jsonb;
BEGIN
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'title', btrim(v_item->>'title'),
      'expected_benefit', btrim(v_item->>'expected_benefit'),
      'effort', btrim(v_item->>'effort'),
      'indicative_cost', btrim(v_item->>'indicative_cost'),
      'risk_or_watchpoint', btrim(v_item->>'risk_or_watchpoint'),
      'first_action', btrim(v_item->>'first_action')
    ));
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE FUNCTION private.normalize_diagnostic_ia_short_term_actions(p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_result jsonb := '[]'::jsonb;
BEGIN
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'action', btrim(v_item->>'action'),
      'horizon', btrim(v_item->>'horizon')
    ));
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE FUNCTION private.diagnostic_ia_restitution_is_publishable(
  p_restitution public.diagnostic_ia_restitutions
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT char_length(btrim(p_restitution.overall_summary)) >= 50
    AND p_restitution.observed_maturity_level BETWEEN 1 AND 5
    AND char_length(btrim(p_restitution.maturity_assessment)) >= 20
    AND char_length(btrim(p_restitution.current_uses)) >= 10
    AND cardinality(p_restitution.strengths) >= 1
    AND cardinality(p_restitution.watch_points) >= 1
    AND jsonb_array_length(p_restitution.priority_opportunities) BETWEEN 1 AND 3
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_restitution.priority_opportunities) AS opportunity
      WHERE char_length(btrim(opportunity->>'title')) < 1
        OR char_length(btrim(opportunity->>'first_action')) < 1
    )
    AND cardinality(p_restitution.recommendations) >= 1
    AND jsonb_array_length(p_restitution.short_term_actions) >= 1
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_restitution.short_term_actions) AS action
      WHERE char_length(btrim(action->>'action')) < 1
        OR (action->>'horizon') NOT IN ('immediate', '30_days', '90_days')
    )
    AND char_length(btrim(p_restitution.privacy_rgpd_considerations)) >= 20
    AND char_length(btrim(p_restitution.next_steps)) >= 10;
$$;

CREATE FUNCTION private.prepare_diagnostic_ia_restitution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_booking_user_id uuid;
  v_questionnaire public.diagnostic_ia_preparation_questionnaires%ROWTYPE;
BEGIN
  SELECT user_id INTO v_booking_user_id
  FROM public.diagnostic_ia_bookings
  WHERE id = NEW.booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation Diagnostic IA introuvable.' USING ERRCODE = '23503';
  END IF;

  NEW.user_id := v_booking_user_id;

  IF NEW.source_questionnaire_id IS NOT NULL THEN
    SELECT * INTO v_questionnaire
    FROM public.diagnostic_ia_preparation_questionnaires
    WHERE id = NEW.source_questionnaire_id
      AND booking_id = NEW.booking_id
      AND user_id = v_booking_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Questionnaire source incohérent avec la réservation.' USING ERRCODE = '23514';
    END IF;
    NEW.questionnaire_version_used := v_questionnaire.questionnaire_version;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.revision <> 1 THEN
      RAISE EXCEPTION 'Une restitution doit être créée en brouillon à la révision 1.' USING ERRCODE = '23514';
    END IF;
    NEW.created_at := coalesce(NEW.created_at, now());
  ELSE
    IF NEW.booking_id IS DISTINCT FROM OLD.booking_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Les références fondatrices de la restitution sont immuables.' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'published' AND NEW.status <> 'published' THEN
      RAISE EXCEPTION 'Une restitution publiée ne peut pas revenir en brouillon.' USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.updated_at := now();
  NEW.content_sha256 := private.diagnostic_ia_restitution_content_sha256(NEW);
  RETURN NEW;
END;
$$;

CREATE TRIGGER prepare_diagnostic_ia_restitution
BEFORE INSERT OR UPDATE ON public.diagnostic_ia_restitutions
FOR EACH ROW EXECUTE FUNCTION private.prepare_diagnostic_ia_restitution();

CREATE FUNCTION private.reject_diagnostic_ia_restitution_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'La suppression des restitutions Diagnostic IA n’est pas autorisée dans cette version.'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER reject_diagnostic_ia_restitution_delete
BEFORE DELETE ON public.diagnostic_ia_restitutions
FOR EACH ROW EXECUTE FUNCTION private.reject_diagnostic_ia_restitution_delete();

ALTER TABLE public.diagnostic_ia_restitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_ia_restitutions FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture de sa restitution Diagnostic IA publiée"
ON public.diagnostic_ia_restitutions
FOR SELECT TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND status = 'published'
  AND retention_due_at > now()
);

CREATE POLICY "Lecture administrative des restitutions Diagnostic IA"
ON public.diagnostic_ia_restitutions
FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

REVOKE ALL ON public.diagnostic_ia_restitutions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.diagnostic_ia_restitutions TO authenticated, service_role;

CREATE FUNCTION private.require_diagnostic_ia_restitution_admin()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée à l’administrateur strict.' USING ERRCODE = '42501';
  END IF;
  RETURN v_actor;
END;
$$;

CREATE FUNCTION public.admin_complete_diagnostic_ia_booking(
  p_booking_id uuid,
  p_completed_at timestamptz DEFAULT NULL
)
RETURNS public.diagnostic_ia_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_diagnostic_ia_restitution_admin();
  v_booking public.diagnostic_ia_bookings%ROWTYPE;
  v_result public.diagnostic_ia_bookings%ROWTYPE;
  v_completed_at timestamptz := coalesce(p_completed_at, now());
BEGIN
  SELECT * INTO v_booking
  FROM public.diagnostic_ia_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation Diagnostic IA introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_booking.status = 'completed' THEN
    RETURN v_booking;
  END IF;
  IF v_booking.status <> 'booked' THEN
    RAISE EXCEPTION 'Seule une réservation confirmée peut être marquée comme réalisée.' USING ERRCODE = 'P0001';
  END IF;
  IF v_completed_at < v_booking.ends_at OR v_completed_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'La date de réalisation est incompatible avec le rendez-vous.' USING ERRCODE = '22007';
  END IF;

  UPDATE public.diagnostic_ia_bookings
  SET status = 'completed', completed_at = v_completed_at
  WHERE id = v_booking.id
  RETURNING * INTO v_result;

  INSERT INTO public.audit_log(
    actor_user_id, action_type, target_type, target_id, target_user_id,
    previous_state, new_state, reason, metadata
  ) VALUES (
    v_actor, 'diagnostic_ia_booking_completed', 'diagnostic_ia_booking',
    v_booking.id::text, v_booking.user_id,
    jsonb_build_object('status', v_booking.status, 'completed_at', v_booking.completed_at),
    jsonb_build_object('status', v_result.status, 'completed_at', v_result.completed_at),
    'Diagnostic IA Express marqué comme réalisé',
    jsonb_build_object('order_id', v_booking.order_id)
  );

  RETURN v_result;
END;
$$;

CREATE FUNCTION public.admin_save_diagnostic_ia_restitution(
  p_booking_id uuid,
  p_expected_revision integer,
  p_content jsonb
)
RETURNS public.diagnostic_ia_restitutions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_diagnostic_ia_restitution_admin();
  v_booking public.diagnostic_ia_bookings%ROWTYPE;
  v_existing public.diagnostic_ia_restitutions%ROWTYPE;
  v_existing_found boolean;
  v_payload public.diagnostic_ia_restitutions%ROWTYPE;
  v_result public.diagnostic_ia_restitutions%ROWTYPE;
  v_questionnaire public.diagnostic_ia_preparation_questionnaires%ROWTYPE;
BEGIN
  IF NOT private.diagnostic_ia_restitution_payload_is_valid(p_content) THEN
    RAISE EXCEPTION 'Le contenu de la restitution est invalide ou dépasse les limites autorisées.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_booking
  FROM public.diagnostic_ia_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation Diagnostic IA introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_booking.status NOT IN ('booked', 'completed') THEN
    RAISE EXCEPTION 'La restitution exige une réservation confirmée ou réalisée.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_questionnaire
  FROM public.diagnostic_ia_preparation_questionnaires
  WHERE booking_id = v_booking.id;

  SELECT * INTO v_existing
  FROM public.diagnostic_ia_restitutions
  WHERE booking_id = v_booking.id
  FOR UPDATE;
  v_existing_found := FOUND;

  v_payload := jsonb_populate_record(NULL::public.diagnostic_ia_restitutions, p_content);
  v_payload.overall_summary := btrim(v_payload.overall_summary);
  v_payload.maturity_assessment := btrim(v_payload.maturity_assessment);
  v_payload.current_uses := btrim(v_payload.current_uses);
  v_payload.strengths := private.diagnostic_ia_trim_text_array(v_payload.strengths);
  v_payload.watch_points := private.diagnostic_ia_trim_text_array(v_payload.watch_points);
  v_payload.priority_opportunities := private.normalize_diagnostic_ia_priority_opportunities(v_payload.priority_opportunities);
  v_payload.recommendations := private.diagnostic_ia_trim_text_array(v_payload.recommendations);
  v_payload.short_term_actions := private.normalize_diagnostic_ia_short_term_actions(v_payload.short_term_actions);
  v_payload.recommended_tool_families := private.diagnostic_ia_trim_text_array(v_payload.recommended_tool_families);
  v_payload.privacy_rgpd_considerations := btrim(v_payload.privacy_rgpd_considerations);
  v_payload.ai_act_considerations := btrim(v_payload.ai_act_considerations);
  v_payload.next_steps := btrim(v_payload.next_steps);

  IF NOT v_existing_found THEN
    IF p_expected_revision IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'Conflit de révision lors de la création du brouillon.' USING ERRCODE = '40001';
    END IF;

    INSERT INTO public.diagnostic_ia_restitutions(
      booking_id, user_id, source_questionnaire_id, questionnaire_version_used,
      content_version, status, revision, content_sha256, created_by, updated_by,
      overall_summary, observed_maturity_level, maturity_assessment, current_uses,
      strengths, watch_points, priority_opportunities, recommendations,
      short_term_actions, recommended_tool_families, privacy_rgpd_considerations,
      ai_act_considerations, next_steps
    ) VALUES (
      v_booking.id, v_booking.user_id, v_questionnaire.id, v_questionnaire.questionnaire_version,
      'DIAGNOSTIC-IA-RESTITUTION-2026-08-30', 'draft', 1, repeat('0', 64), v_actor, v_actor,
      v_payload.overall_summary, v_payload.observed_maturity_level,
      v_payload.maturity_assessment, v_payload.current_uses,
      v_payload.strengths, v_payload.watch_points, v_payload.priority_opportunities,
      v_payload.recommendations, v_payload.short_term_actions,
      v_payload.recommended_tool_families, v_payload.privacy_rgpd_considerations,
      v_payload.ai_act_considerations, v_payload.next_steps
    ) RETURNING * INTO v_result;

    INSERT INTO public.audit_log(
      actor_user_id, action_type, target_type, target_id, target_user_id,
      previous_state, new_state, metadata
    ) VALUES (
      v_actor, 'diagnostic_ia_restitution_draft_created', 'diagnostic_ia_restitution',
      v_result.id::text, v_result.user_id, NULL,
      jsonb_build_object('status', v_result.status, 'revision', v_result.revision, 'content_sha256', v_result.content_sha256),
      jsonb_build_object('booking_id', v_result.booking_id)
    );
  ELSE
    IF v_existing.status <> 'draft' THEN
      RAISE EXCEPTION 'Une restitution publiée ne peut pas être modifiée par la sauvegarde de brouillon.' USING ERRCODE = 'P0001';
    END IF;
    IF p_expected_revision IS DISTINCT FROM v_existing.revision THEN
      RAISE EXCEPTION 'Conflit de révision lors de la sauvegarde du brouillon.' USING ERRCODE = '40001';
    END IF;

    UPDATE public.diagnostic_ia_restitutions
    SET source_questionnaire_id = v_questionnaire.id,
        questionnaire_version_used = v_questionnaire.questionnaire_version,
        revision = v_existing.revision + 1,
        updated_by = v_actor,
        overall_summary = v_payload.overall_summary,
        observed_maturity_level = v_payload.observed_maturity_level,
        maturity_assessment = v_payload.maturity_assessment,
        current_uses = v_payload.current_uses,
        strengths = v_payload.strengths,
        watch_points = v_payload.watch_points,
        priority_opportunities = v_payload.priority_opportunities,
        recommendations = v_payload.recommendations,
        short_term_actions = v_payload.short_term_actions,
        recommended_tool_families = v_payload.recommended_tool_families,
        privacy_rgpd_considerations = v_payload.privacy_rgpd_considerations,
        ai_act_considerations = v_payload.ai_act_considerations,
        next_steps = v_payload.next_steps
    WHERE id = v_existing.id
    RETURNING * INTO v_result;

    INSERT INTO public.audit_log(
      actor_user_id, action_type, target_type, target_id, target_user_id,
      previous_state, new_state, metadata
    ) VALUES (
      v_actor, 'diagnostic_ia_restitution_draft_saved', 'diagnostic_ia_restitution',
      v_result.id::text, v_result.user_id,
      jsonb_build_object('status', v_existing.status, 'revision', v_existing.revision, 'content_sha256', v_existing.content_sha256),
      jsonb_build_object('status', v_result.status, 'revision', v_result.revision, 'content_sha256', v_result.content_sha256),
      jsonb_build_object('booking_id', v_result.booking_id)
    );
  END IF;

  RETURN v_result;
END;
$$;

CREATE FUNCTION public.admin_publish_diagnostic_ia_restitution(
  p_restitution_id uuid,
  p_expected_revision integer
)
RETURNS public.diagnostic_ia_restitutions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_diagnostic_ia_restitution_admin();
  v_existing public.diagnostic_ia_restitutions%ROWTYPE;
  v_booking public.diagnostic_ia_bookings%ROWTYPE;
  v_result public.diagnostic_ia_restitutions%ROWTYPE;
  v_published_at timestamptz := now();
BEGIN
  SELECT * INTO v_existing
  FROM public.diagnostic_ia_restitutions
  WHERE id = p_restitution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restitution Diagnostic IA introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_existing.status <> 'draft' THEN
    RAISE EXCEPTION 'Seul un brouillon peut être publié.' USING ERRCODE = 'P0001';
  END IF;
  IF p_expected_revision IS DISTINCT FROM v_existing.revision THEN
    RAISE EXCEPTION 'Conflit de révision lors de la publication.' USING ERRCODE = '40001';
  END IF;

  SELECT * INTO v_booking
  FROM public.diagnostic_ia_bookings
  WHERE id = v_existing.booking_id
  FOR UPDATE;

  IF v_booking.status <> 'completed' OR v_booking.completed_at IS NULL THEN
    RAISE EXCEPTION 'Le diagnostic doit être marqué comme réalisé avant publication.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT private.diagnostic_ia_restitution_is_publishable(v_existing) THEN
    RAISE EXCEPTION 'Le contenu métier minimal de la restitution est incomplet.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.diagnostic_ia_restitutions
  SET status = 'published',
      published_at = v_published_at,
      published_by = v_actor,
      updated_by = v_actor,
      retention_due_at = greatest(v_booking.completed_at, v_published_at) + interval '5 years'
  WHERE id = v_existing.id
  RETURNING * INTO v_result;

  INSERT INTO public.audit_log(
    actor_user_id, action_type, target_type, target_id, target_user_id,
    previous_state, new_state, metadata
  ) VALUES (
    v_actor, 'diagnostic_ia_restitution_published', 'diagnostic_ia_restitution',
    v_result.id::text, v_result.user_id,
    jsonb_build_object('status', v_existing.status, 'revision', v_existing.revision, 'content_sha256', v_existing.content_sha256),
    jsonb_build_object('status', v_result.status, 'revision', v_result.revision, 'content_sha256', v_result.content_sha256),
    jsonb_build_object('booking_id', v_result.booking_id, 'retention_due_at', v_result.retention_due_at)
  );

  RETURN v_result;
END;
$$;

CREATE FUNCTION public.admin_correct_diagnostic_ia_restitution(
  p_restitution_id uuid,
  p_expected_revision integer,
  p_content jsonb,
  p_reason text
)
RETURNS public.diagnostic_ia_restitutions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_diagnostic_ia_restitution_admin();
  v_existing public.diagnostic_ia_restitutions%ROWTYPE;
  v_payload public.diagnostic_ia_restitutions%ROWTYPE;
  v_result public.diagnostic_ia_restitutions%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF char_length(v_reason) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'Un motif de correction de 5 à 1000 caractères est requis.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.diagnostic_ia_restitution_payload_is_valid(p_content) THEN
    RAISE EXCEPTION 'Le contenu de la restitution est invalide ou dépasse les limites autorisées.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.diagnostic_ia_restitutions
  WHERE id = p_restitution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restitution Diagnostic IA introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_existing.status <> 'published' THEN
    RAISE EXCEPTION 'Seule une restitution publiée peut être corrigée.' USING ERRCODE = 'P0001';
  END IF;
  IF p_expected_revision IS DISTINCT FROM v_existing.revision THEN
    RAISE EXCEPTION 'Conflit de révision lors de la correction.' USING ERRCODE = '40001';
  END IF;

  v_payload := jsonb_populate_record(NULL::public.diagnostic_ia_restitutions, p_content);

  UPDATE public.diagnostic_ia_restitutions
  SET revision = v_existing.revision + 1,
      updated_by = v_actor,
      corrected_at = now(),
      overall_summary = btrim(v_payload.overall_summary),
      observed_maturity_level = v_payload.observed_maturity_level,
      maturity_assessment = btrim(v_payload.maturity_assessment),
      current_uses = btrim(v_payload.current_uses),
      strengths = private.diagnostic_ia_trim_text_array(v_payload.strengths),
      watch_points = private.diagnostic_ia_trim_text_array(v_payload.watch_points),
      priority_opportunities = private.normalize_diagnostic_ia_priority_opportunities(v_payload.priority_opportunities),
      recommendations = private.diagnostic_ia_trim_text_array(v_payload.recommendations),
      short_term_actions = private.normalize_diagnostic_ia_short_term_actions(v_payload.short_term_actions),
      recommended_tool_families = private.diagnostic_ia_trim_text_array(v_payload.recommended_tool_families),
      privacy_rgpd_considerations = btrim(v_payload.privacy_rgpd_considerations),
      ai_act_considerations = btrim(v_payload.ai_act_considerations),
      next_steps = btrim(v_payload.next_steps)
  WHERE id = v_existing.id
  RETURNING * INTO v_result;

  IF NOT private.diagnostic_ia_restitution_is_publishable(v_result) THEN
    RAISE EXCEPTION 'Une correction doit conserver un contenu métier publiable.' USING ERRCODE = '22023';
  END IF;
  IF v_result.content_sha256 = v_existing.content_sha256 THEN
    RAISE EXCEPTION 'La correction ne modifie aucun contenu métier.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.audit_log(
    actor_user_id, action_type, target_type, target_id, target_user_id,
    previous_state, new_state, reason, metadata
  ) VALUES (
    v_actor, 'diagnostic_ia_restitution_corrected', 'diagnostic_ia_restitution',
    v_result.id::text, v_result.user_id,
    jsonb_build_object('status', v_existing.status, 'revision', v_existing.revision, 'content_sha256', v_existing.content_sha256),
    jsonb_build_object('status', v_result.status, 'revision', v_result.revision, 'content_sha256', v_result.content_sha256),
    v_reason,
    jsonb_build_object('booking_id', v_result.booking_id)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION private.diagnostic_ia_plain_text_is_valid(text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.diagnostic_ia_text_array_is_valid(text[], integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.diagnostic_ia_jsonb_text_array_is_valid(jsonb, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.diagnostic_ia_priority_opportunities_are_valid(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.diagnostic_ia_short_term_actions_are_valid(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.diagnostic_ia_restitution_content_json(public.diagnostic_ia_restitutions)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.diagnostic_ia_restitution_content_sha256(public.diagnostic_ia_restitutions)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.diagnostic_ia_restitution_payload_is_valid(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.diagnostic_ia_trim_text_array(text[])
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.normalize_diagnostic_ia_priority_opportunities(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.normalize_diagnostic_ia_short_term_actions(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.diagnostic_ia_restitution_is_publishable(public.diagnostic_ia_restitutions)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.prepare_diagnostic_ia_restitution()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.reject_diagnostic_ia_restitution_delete()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.require_diagnostic_ia_restitution_admin()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_complete_diagnostic_ia_booking(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_complete_diagnostic_ia_booking(uuid, timestamptz)
  TO authenticated;

REVOKE ALL ON FUNCTION public.admin_save_diagnostic_ia_restitution(uuid, integer, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_diagnostic_ia_restitution(uuid, integer, jsonb)
  TO authenticated;

REVOKE ALL ON FUNCTION public.admin_publish_diagnostic_ia_restitution(uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_publish_diagnostic_ia_restitution(uuid, integer)
  TO authenticated;

REVOKE ALL ON FUNCTION public.admin_correct_diagnostic_ia_restitution(uuid, integer, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_correct_diagnostic_ia_restitution(uuid, integer, jsonb, text)
  TO authenticated;

COMMENT ON TABLE public.diagnostic_ia_restitutions IS
  'Restitution metier privee et versionnee du Diagnostic IA Express, unique par booking.';
COMMENT ON COLUMN public.diagnostic_ia_restitutions.content_sha256 IS
  'SHA-256 du JSONB canonique des treize champs metier, hors identifiants, acteurs, statut, revision et horodatages.';
COMMENT ON COLUMN public.diagnostic_ia_restitutions.retention_due_at IS
  'Echeance de consultation fixee a cinq ans apres la date la plus recente entre completion et publication. Aucune purge automatique dans ce lot.';
COMMENT ON FUNCTION public.admin_complete_diagnostic_ia_booking(uuid, timestamptz) IS
  'Marque une reservation Diagnostic confirmee comme realisee sans modifier order, Calendar ni Meet.';
COMMENT ON FUNCTION public.admin_save_diagnostic_ia_restitution(uuid, integer, jsonb) IS
  'Cree un brouillon avec expected_revision=0 ou sauvegarde un brouillon a la revision attendue.';
COMMENT ON FUNCTION public.admin_publish_diagnostic_ia_restitution(uuid, integer) IS
  'Publie une restitution complete uniquement apres completion du booking et fixe sa retention a cinq ans.';
COMMENT ON FUNCTION public.admin_correct_diagnostic_ia_restitution(uuid, integer, jsonb, text) IS
  'Corrige une restitution publiee avec motif, controle de revision et audit sans contenu metier.';

COMMIT;
