-- Sprint 1.1A : assistant contrôlé d'effacement et d'anonymisation RGPD.
-- Toute opération irréversible exige une décision par catégorie, un motif,
-- une confirmation explicite et un appel serveur authentifié comme admin.

BEGIN;

ALTER TABLE public.privacy_requests
  DROP CONSTRAINT privacy_requests_status_check,
  ADD CONSTRAINT privacy_requests_status_check CHECK (status IN (
    'received', 'identity_check', 'under_analysis', 'under_review',
    'decision_recorded', 'ready_for_execution', 'processing',
    'external_action_required', 'closed'
  ));

CREATE UNIQUE INDEX privacy_requests_one_open_subject_type_uidx
  ON public.privacy_requests (subject_user_id, request_type)
  WHERE subject_user_id IS NOT NULL AND status <> 'closed';

ALTER TABLE public.privacy_processing_actions
  DROP CONSTRAINT privacy_processing_status_check,
  DROP CONSTRAINT privacy_processing_reason_check,
  ADD COLUMN suggested_resolution text,
  ADD COLUMN resolution text,
  ADD COLUMN approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN executed_at timestamptz,
  ADD COLUMN affected_rows integer,
  ADD COLUMN execution_code text,
  ADD COLUMN failure_code text,
  ADD CONSTRAINT privacy_processing_status_check CHECK (
    status IN ('proposed', 'approved', 'executed', 'deferred', 'rejected', 'failed')
  ),
  ADD CONSTRAINT privacy_processing_suggested_resolution_check CHECK (
    suggested_resolution IS NULL OR suggested_resolution IN (
      'delete', 'anonymize', 'retain', 'disable_access', 'external_action'
    )
  ),
  ADD CONSTRAINT privacy_processing_resolution_check CHECK (
    resolution IS NULL OR resolution IN (
      'delete', 'anonymize', 'retain', 'disable_access', 'external_action'
    )
  ),
  ADD CONSTRAINT privacy_processing_decision_check CHECK (
    (status = 'proposed' AND resolution IS NULL)
    OR (status <> 'proposed' AND resolution IS NOT NULL)
  ),
  ADD CONSTRAINT privacy_processing_reason_check CHECK (
    reason IS NULL OR char_length(btrim(reason)) BETWEEN 10 AND 4000
  ),
  ADD CONSTRAINT privacy_processing_affected_rows_check CHECK (
    affected_rows IS NULL OR affected_rows >= 0
  ),
  ADD CONSTRAINT privacy_processing_code_check CHECK (
    (execution_code IS NULL OR char_length(execution_code) BETWEEN 2 AND 100)
    AND (failure_code IS NULL OR char_length(failure_code) BETWEEN 2 AND 100)
  );

CREATE UNIQUE INDEX privacy_processing_assessment_uidx
  ON public.privacy_processing_actions (assessment_id)
  WHERE assessment_id IS NOT NULL;
CREATE INDEX privacy_processing_request_status_idx
  ON public.privacy_processing_actions (request_id, status, created_at DESC);
CREATE INDEX privacy_processing_approved_by_idx
  ON public.privacy_processing_actions (approved_by, approved_at DESC)
  WHERE approved_by IS NOT NULL;

ALTER TABLE public.privacy_request_events
  DROP CONSTRAINT privacy_event_type_check,
  ADD CONSTRAINT privacy_event_type_check CHECK (event_type IN (
    'request_created', 'analysis_started', 'analysis_completed',
    'analysis_finalized', 'status_changed', 'identity_verification_changed',
    'administrative_decision_recorded', 'action_decided',
    'execution_started', 'action_executed', 'action_failed',
    'external_action_confirmed', 'request_completed'
  ));

COMMENT ON TABLE public.privacy_requests IS
  'Demandes RGPD administratives avec analyse, double confirmation, exécution contrôlée et clôture auditée.';
COMMENT ON TABLE public.privacy_processing_actions IS
  'Décision minimale par catégorie : effacer, anonymiser, conserver, désactiver un droit ou traiter hors base. Aucune approbation implicite.';
COMMENT ON COLUMN public.privacy_processing_actions.resolution IS
  'Décision humaine explicite. Les résolutions autorisées sont limitées côté serveur selon la catégorie.';

CREATE OR REPLACE FUNCTION private.latest_privacy_analysis_run(p_request_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT analysis_run_id
  FROM public.privacy_dependency_assessments
  WHERE request_id = p_request_id
  ORDER BY assessed_at DESC, id DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.latest_privacy_analysis_run(uuid)
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_privacy_resolution_allowed(
  p_category text,
  p_resolution text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_category IN ('profile', 'auth_identity')
      THEN p_resolution = 'external_action'
    WHEN p_category = 'course_access'
      THEN p_resolution IN ('disable_access', 'retain')
    WHEN p_category = 'lesson_progress'
      THEN p_resolution IN ('delete', 'retain')
    WHEN p_category IN ('contact_requests', 'satisfaction', 'satisfaction_without_fk')
      THEN p_resolution IN ('delete', 'anonymize', 'retain')
    WHEN p_category IN (
      'storage_objects', 'stripe_external', 'meeting_provider_external',
      'calendar_text_matches', 'snapshot_matches'
    ) THEN p_resolution IN ('external_action', 'retain')
    ELSE p_resolution = 'retain'
  END
$$;

REVOKE ALL ON FUNCTION private.is_privacy_resolution_allowed(text, text)
FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.admin_analyze_privacy_request(uuid) SET SCHEMA private;
ALTER FUNCTION private.admin_analyze_privacy_request(uuid)
  RENAME TO admin_analyze_privacy_request_base;
REVOKE ALL ON FUNCTION private.admin_analyze_privacy_request_base(uuid)
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_analyze_privacy_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_request public.privacy_requests%ROWTYPE;
  v_run_id uuid;
  v_count integer;
  v_commercial_count integer := 0;
  v_dependency_count integer;
  v_category_count integer;
  v_conclusion text;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;

  v_result := private.admin_analyze_privacy_request_base(p_request_id);
  v_run_id := (v_result ->> 'analysis_run_id')::uuid;

  SELECT * INTO v_request
  FROM public.privacy_requests
  WHERE id = p_request_id
  FOR UPDATE;

  UPDATE public.privacy_dependency_assessments
  SET proposed_action = 'external_verification_required',
      external_check_required = true,
      note_code = 'auth_profile_orchestration_required'
  WHERE analysis_run_id = v_run_id AND category = 'profile';

  UPDATE public.privacy_processing_actions AS action
  SET action_type = 'external_check'
  FROM public.privacy_dependency_assessments AS assessment
  WHERE action.assessment_id = assessment.id
    AND assessment.analysis_run_id = v_run_id
    AND assessment.category = 'profile';

  PERFORM private.record_privacy_assessment(
    v_request.id, v_run_id, v_request.subject_user_id,
    'auth_identity', 'supabase_auth', 'auth.users', 'direct_user_id',
    1, 'critical', 'external_verification_required', true, true,
    'soft_delete_and_session_control_required'
  );

  SELECT count(*)::integer INTO v_count
  FROM public.commercial_checkout_intents
  WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(
    v_request.id, v_run_id, v_request.subject_user_id,
    'commercial_checkout_intents', 'supabase_database',
    'commercial_checkout_intents', 'direct_user_id', v_count,
    'high', 'potential_retention_to_review', true, false,
    'contractual_evidence'
  ) THEN v_commercial_count := v_commercial_count + v_count; END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.commercial_consents
  WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(
    v_request.id, v_run_id, v_request.subject_user_id,
    'commercial_consents', 'supabase_database', 'commercial_consents',
    'direct_user_id', v_count, 'critical', 'legal_review_required',
    true, false, 'consent_evidence'
  ) THEN v_commercial_count := v_commercial_count + v_count; END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.withdrawal_requests
  WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(
    v_request.id, v_run_id, v_request.subject_user_id,
    'withdrawal_requests', 'supabase_database', 'withdrawal_requests',
    'direct_user_id', v_count, 'critical', 'legal_review_required',
    true, false, 'withdrawal_evidence'
  ) THEN v_commercial_count := v_commercial_count + v_count; END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.commercial_payment_reviews
  WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(
    v_request.id, v_run_id, v_request.subject_user_id,
    'commercial_payment_reviews', 'supabase_database',
    'commercial_payment_reviews', 'direct_user_id', v_count,
    'critical', 'legal_review_required', true, false,
    'payment_review_evidence'
  ) THEN v_commercial_count := v_commercial_count + v_count; END IF;

  INSERT INTO public.privacy_processing_actions (
    request_id, assessment_id, action_type, actor_user_id
  )
  SELECT
    v_request.id,
    assessment.id,
    CASE assessment.proposed_action
      WHEN 'deletion_candidate' THEN 'review_deletion_candidate'
      WHEN 'anonymization_to_review' THEN 'review_anonymization'
      WHEN 'potential_retention_to_review' THEN 'review_potential_retention'
      WHEN 'external_verification_required' THEN 'external_check'
      ELSE 'legal_review'
    END,
    (SELECT auth.uid())
  FROM public.privacy_dependency_assessments AS assessment
  WHERE assessment.analysis_run_id = v_run_id
  ON CONFLICT DO NOTHING;

  UPDATE public.privacy_processing_actions AS action
  SET suggested_resolution = CASE
    WHEN assessment.category IN ('profile', 'auth_identity') THEN 'external_action'
    WHEN assessment.category = 'course_access' THEN 'disable_access'
    WHEN assessment.category = 'lesson_progress' THEN 'delete'
    WHEN assessment.category IN ('contact_requests', 'satisfaction', 'satisfaction_without_fk') THEN 'anonymize'
    WHEN assessment.proposed_action = 'external_verification_required' THEN 'external_action'
    ELSE 'retain'
  END
  FROM public.privacy_dependency_assessments AS assessment
  WHERE action.assessment_id = assessment.id
    AND assessment.analysis_run_id = v_run_id;

  SELECT count(*)::integer,
         coalesce(sum(CASE WHEN category IN ('profile', 'auth_identity') THEN 0 ELSE record_count END), 0)::integer
  INTO v_category_count, v_dependency_count
  FROM public.privacy_dependency_assessments
  WHERE analysis_run_id = v_run_id;

  v_conclusion := CASE
    WHEN v_commercial_count > 0 THEN 'manual_legal_review_required'
    ELSE v_request.analysis_conclusion
  END;

  UPDATE public.privacy_requests
  SET analysis_conclusion = v_conclusion,
      status = 'under_review',
      last_analyzed_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.privacy_request_events (
    request_id, actor_user_id, event_type, event_details
  ) VALUES (
    v_request.id, (SELECT auth.uid()), 'analysis_finalized',
    jsonb_build_object(
      'analysis_run_id', v_run_id,
      'analysis_conclusion', v_conclusion,
      'dependency_count', v_dependency_count,
      'category_count', v_category_count,
      'commercial_evidence_count', v_commercial_count,
      'auth_action_required', true
    )
  );

  RETURN jsonb_build_object(
    'request_id', v_request.id,
    'analysis_run_id', v_run_id,
    'analysis_conclusion', v_conclusion,
    'dependency_count', v_dependency_count,
    'category_count', v_category_count,
    'commercial_evidence_count', v_commercial_count,
    'auth_action_required', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_analyze_privacy_request(uuid)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_analyze_privacy_request(uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_privacy_action_decision(
  p_action_id uuid,
  p_resolution text,
  p_reason text
)
RETURNS public.privacy_processing_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_result public.privacy_processing_actions%ROWTYPE;
  v_request public.privacy_requests%ROWTYPE;
  v_action_request_id uuid;
  v_action_status text;
  v_category text;
  v_run_id uuid;
  v_latest_run uuid;
  v_unresolved integer;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 4000 THEN
    RAISE EXCEPTION 'Un motif de 10 à 4000 caractères est requis.';
  END IF;

  SELECT action.request_id, action.status, assessment.category, assessment.analysis_run_id
  INTO v_action_request_id, v_action_status, v_category, v_run_id
  FROM public.privacy_processing_actions AS action
  JOIN public.privacy_dependency_assessments AS assessment
    ON assessment.id = action.assessment_id
  WHERE action.id = p_action_id
  FOR UPDATE OF action;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action RGPD introuvable.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_request
  FROM public.privacy_requests
  WHERE id = v_action_request_id
  FOR UPDATE;
  v_latest_run := private.latest_privacy_analysis_run(v_request.id);

  IF v_run_id IS DISTINCT FROM v_latest_run THEN
    RAISE EXCEPTION 'Cette action appartient à une analyse remplacée.';
  END IF;
  IF v_action_status IN ('executed', 'deferred') THEN
    RAISE EXCEPTION 'Une action déjà traitée ne peut pas être réécrite.';
  END IF;
  IF NOT private.is_privacy_resolution_allowed(v_category, p_resolution) THEN
    RAISE EXCEPTION 'Cette résolution est interdite pour la catégorie %.', v_category;
  END IF;

  UPDATE public.privacy_processing_actions
  SET resolution = p_resolution,
      status = 'approved',
      reason = btrim(p_reason),
      approved_by = v_actor,
      approved_at = now(),
      reviewed_at = now(),
      actor_user_id = v_actor,
      failure_code = NULL
  WHERE id = p_action_id
  RETURNING * INTO v_result;

  INSERT INTO public.privacy_request_events (
    request_id, actor_user_id, event_type, event_details
  ) VALUES (
    v_request.id, v_actor, 'action_decided',
    jsonb_build_object(
      'action_id', v_result.id,
      'category', v_category,
      'resolution', p_resolution
    )
  );

  SELECT count(*)::integer INTO v_unresolved
  FROM public.privacy_processing_actions AS action
  JOIN public.privacy_dependency_assessments AS assessment
    ON assessment.id = action.assessment_id
  WHERE action.request_id = v_request.id
    AND assessment.analysis_run_id = v_latest_run
    AND action.status <> 'approved';

  IF v_unresolved = 0
    AND v_request.identity_verification_status = 'verified'
    AND v_request.administrative_decision IN (
      'full_erasure_possible',
      'partial_erasure_or_anonymization_required'
    )
  THEN
    UPDATE public.privacy_requests
    SET status = 'ready_for_execution', responsible_admin_id = v_actor
    WHERE id = v_request.id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_privacy_action_decision(uuid, text, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_privacy_action_decision(uuid, text, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_privacy_request(
  p_request_id uuid,
  p_status text,
  p_identity_verification_status text,
  p_administrative_decision text DEFAULT NULL,
  p_decision_reason text DEFAULT NULL
)
RETURNS public.privacy_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_before public.privacy_requests%ROWTYPE;
  v_result public.privacy_requests%ROWTYPE;
  v_latest_run uuid;
  v_unresolved integer := 1;
  v_next_status text;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('received', 'identity_check', 'under_review', 'decision_recorded') THEN
    RAISE EXCEPTION 'Ce statut ne peut pas être imposé manuellement.';
  END IF;
  IF p_administrative_decision IS NOT NULL
    AND char_length(btrim(coalesce(p_decision_reason, ''))) NOT BETWEEN 10 AND 4000
  THEN
    RAISE EXCEPTION 'Une décision exige un motif de 10 à 4000 caractères.';
  END IF;

  SELECT * INTO v_before
  FROM public.privacy_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande RGPD introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_before.status IN ('processing', 'external_action_required', 'closed') THEN
    RAISE EXCEPTION 'Cette demande a déjà atteint la phase d exécution.';
  END IF;
  IF p_administrative_decision IS NOT NULL AND v_before.last_analyzed_at IS NULL THEN
    RAISE EXCEPTION 'Une analyse est requise avant la décision.';
  END IF;

  v_latest_run := private.latest_privacy_analysis_run(v_before.id);
  IF v_latest_run IS NOT NULL THEN
    SELECT count(*)::integer INTO v_unresolved
    FROM public.privacy_processing_actions AS action
    JOIN public.privacy_dependency_assessments AS assessment
      ON assessment.id = action.assessment_id
    WHERE action.request_id = v_before.id
      AND assessment.analysis_run_id = v_latest_run
      AND action.status <> 'approved';
  END IF;

  v_next_status := CASE
    WHEN p_administrative_decision IN (
      'full_erasure_possible',
      'partial_erasure_or_anonymization_required'
    )
      AND p_identity_verification_status = 'verified'
      AND v_latest_run IS NOT NULL
      AND v_unresolved = 0
      THEN 'ready_for_execution'
    WHEN p_administrative_decision IS NOT NULL THEN 'decision_recorded'
    ELSE p_status
  END;

  UPDATE public.privacy_requests
  SET status = v_next_status,
      identity_verification_status = p_identity_verification_status,
      identity_verified_at = CASE
        WHEN p_identity_verification_status = 'verified'
          THEN coalesce(identity_verified_at, now())
        ELSE NULL
      END,
      administrative_decision = p_administrative_decision,
      decision_reason = CASE
        WHEN p_administrative_decision IS NOT NULL THEN btrim(p_decision_reason)
        ELSE decision_reason
      END,
      decision_recorded_at = CASE
        WHEN p_administrative_decision IS NOT NULL THEN now()
        ELSE decision_recorded_at
      END,
      responsible_admin_id = v_actor
  WHERE id = p_request_id
  RETURNING * INTO v_result;

  IF v_before.identity_verification_status IS DISTINCT FROM v_result.identity_verification_status THEN
    INSERT INTO public.privacy_request_events (
      request_id, actor_user_id, event_type, event_details
    ) VALUES (
      v_result.id, v_actor, 'identity_verification_changed',
      jsonb_build_object(
        'previous', v_before.identity_verification_status,
        'new', v_result.identity_verification_status
      )
    );
  END IF;
  IF v_before.status IS DISTINCT FROM v_result.status THEN
    INSERT INTO public.privacy_request_events (
      request_id, actor_user_id, event_type, event_details
    ) VALUES (
      v_result.id, v_actor, 'status_changed',
      jsonb_build_object('previous', v_before.status, 'new', v_result.status)
    );
  END IF;
  IF p_administrative_decision IS NOT NULL THEN
    INSERT INTO public.privacy_request_events (
      request_id, actor_user_id, event_type, event_details
    ) VALUES (
      v_result.id, v_actor, 'administrative_decision_recorded',
      jsonb_build_object('decision', v_result.administrative_decision)
    );
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_privacy_request(uuid, text, text, text, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_privacy_request(uuid, text, text, text, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_execute_privacy_request(
  p_request_id uuid,
  p_confirmation text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_request public.privacy_requests%ROWTYPE;
  v_action record;
  v_access record;
  v_latest_run uuid;
  v_email text;
  v_expected_confirmation text;
  v_anonymized_email text;
  v_affected integer;
  v_total_affected integer := 0;
  v_external_actions integer := 0;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 4000 THEN
    RAISE EXCEPTION 'Un motif d exécution de 10 à 4000 caractères est requis.';
  END IF;

  SELECT * INTO v_request
  FROM public.privacy_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.subject_user_id IS NULL THEN
    RAISE EXCEPTION 'Demande RGPD ou personne concernée introuvable.' USING ERRCODE = 'P0002';
  END IF;

  v_expected_confirmation := format('EFFACER %s', v_request.subject_reference);
  IF p_confirmation IS DISTINCT FROM v_expected_confirmation THEN
    RAISE EXCEPTION 'La confirmation explicite est incorrecte.';
  END IF;
  IF v_request.request_type <> 'erasure'
    OR v_request.identity_verification_status <> 'verified'
    OR v_request.administrative_decision NOT IN (
      'full_erasure_possible',
      'partial_erasure_or_anonymization_required'
    )
  THEN
    RAISE EXCEPTION 'La demande n est pas autorisée pour une exécution.';
  END IF;
  IF v_request.status NOT IN ('ready_for_execution', 'external_action_required') THEN
    RAISE EXCEPTION 'Le plan doit être entièrement approuvé avant exécution.';
  END IF;

  v_latest_run := private.latest_privacy_analysis_run(v_request.id);
  IF v_latest_run IS NULL OR EXISTS (
    SELECT 1
    FROM public.privacy_processing_actions AS action
    JOIN public.privacy_dependency_assessments AS assessment
      ON assessment.id = action.assessment_id
    WHERE action.request_id = v_request.id
      AND assessment.analysis_run_id = v_latest_run
      AND action.status NOT IN ('approved', 'executed')
  ) THEN
    RAISE EXCEPTION 'Toutes les catégories de la dernière analyse doivent être approuvées.';
  END IF;

  SELECT email INTO v_email
  FROM public.profiles
  WHERE id = v_request.subject_user_id;
  v_anonymized_email := format(
    'anonymous+%s@privacy.invalid',
    replace(v_request.subject_reference::text, '-', '')
  );

  UPDATE public.privacy_requests
  SET status = 'processing', processing_started_at = coalesce(processing_started_at, now())
  WHERE id = v_request.id;
  INSERT INTO public.privacy_request_events (
    request_id, actor_user_id, event_type, event_details
  ) VALUES (
    v_request.id, v_actor, 'execution_started',
    jsonb_build_object('analysis_run_id', v_latest_run)
  );

  FOR v_action IN
    SELECT action.id, action.resolution, action.status, assessment.category
    FROM public.privacy_processing_actions AS action
    JOIN public.privacy_dependency_assessments AS assessment
      ON assessment.id = action.assessment_id
    WHERE action.request_id = v_request.id
      AND assessment.analysis_run_id = v_latest_run
      AND action.status = 'approved'
    ORDER BY action.created_at, action.id
  LOOP
    v_affected := 0;

    IF v_action.resolution = 'retain' THEN
      v_affected := 0;
    ELSIF v_action.resolution = 'disable_access'
      AND v_action.category = 'course_access'
    THEN
      FOR v_access IN
        SELECT id, course_id
        FROM public.course_access
        WHERE user_id = v_request.subject_user_id
          AND status IN ('active', 'suspended')
        FOR UPDATE
      LOOP
        PERFORM public.admin_change_course_access(
          v_access.id,
          v_request.subject_user_id,
          v_access.course_id,
          'revoke',
          btrim(p_reason),
          NULL,
          NULL
        );
        v_affected := v_affected + 1;
      END LOOP;
    ELSIF v_action.resolution = 'delete'
      AND v_action.category = 'lesson_progress'
    THEN
      DELETE FROM public.course_lesson_progress
      WHERE user_id = v_request.subject_user_id;
      GET DIAGNOSTICS v_affected = ROW_COUNT;
    ELSIF v_action.resolution = 'delete'
      AND v_action.category = 'contact_requests'
    THEN
      DELETE FROM public.contact_requests
      WHERE lower(email) = lower(v_email);
      GET DIAGNOSTICS v_affected = ROW_COUNT;
    ELSIF v_action.resolution = 'anonymize'
      AND v_action.category = 'contact_requests'
    THEN
      UPDATE public.contact_requests
      SET name = 'Personne anonymisée',
          email = 'anonymous@privacy.invalid',
          subject = 'Demande anonymisée',
          message = 'Contenu supprimé après traitement RGPD.'
      WHERE lower(email) = lower(v_email);
      GET DIAGNOSTICS v_affected = ROW_COUNT;
    ELSIF v_action.resolution = 'delete'
      AND v_action.category IN ('satisfaction', 'satisfaction_without_fk')
    THEN
      DELETE FROM public.satisfaction_surveys
      WHERE user_id = v_request.subject_user_id
        OR lower(student_email) = lower(v_email);
      GET DIAGNOSTICS v_affected = ROW_COUNT;
    ELSIF v_action.resolution = 'anonymize'
      AND v_action.category IN ('satisfaction', 'satisfaction_without_fk')
    THEN
      UPDATE public.satisfaction_surveys
      SET user_id = NULL,
          booking_request_id = NULL,
          student_name = 'Personne anonymisée',
          student_email = 'anonymous@privacy.invalid',
          public_testimonial = NULL,
          private_feedback = NULL,
          consent_marketing = false,
          is_published = false
      WHERE user_id = v_request.subject_user_id
        OR lower(student_email) = lower(v_email);
      GET DIAGNOSTICS v_affected = ROW_COUNT;
    ELSIF v_action.resolution = 'external_action' THEN
      v_external_actions := v_external_actions + 1;
      CONTINUE;
    ELSE
      RAISE EXCEPTION 'Résolution non exécutable pour la catégorie %.', v_action.category;
    END IF;

    UPDATE public.privacy_processing_actions
    SET status = 'executed',
        executed_at = now(),
        affected_rows = v_affected,
        execution_code = CASE
          WHEN v_action.resolution = 'retain' THEN 'retained_by_admin_decision'
          WHEN v_action.resolution = 'disable_access' THEN 'access_revoked'
          WHEN v_action.resolution = 'delete' THEN 'rows_deleted'
          ELSE 'direct_identifiers_anonymized'
        END,
        actor_user_id = v_actor
    WHERE id = v_action.id;

    INSERT INTO public.privacy_request_events (
      request_id, actor_user_id, event_type, event_details
    ) VALUES (
      v_request.id, v_actor, 'action_executed',
      jsonb_build_object(
        'action_id', v_action.id,
        'category', v_action.category,
        'resolution', v_action.resolution,
        'affected_rows', v_affected
      )
    );
    v_total_affected := v_total_affected + v_affected;
  END LOOP;

  UPDATE public.privacy_requests
  SET status = CASE
        WHEN v_external_actions > 0 THEN 'external_action_required'
        ELSE 'closed'
      END,
      closed_at = CASE WHEN v_external_actions = 0 THEN now() ELSE NULL END,
      responsible_admin_id = v_actor
  WHERE id = v_request.id;

  IF v_external_actions = 0 THEN
    INSERT INTO public.privacy_request_events (
      request_id, actor_user_id, event_type, event_details
    ) VALUES (
      v_request.id, v_actor, 'request_completed',
      jsonb_build_object('affected_rows', v_total_affected)
    );
  END IF;

  RETURN jsonb_build_object(
    'request_id', v_request.id,
    'subject_user_id', v_request.subject_user_id,
    'subject_reference', v_request.subject_reference,
    'anonymized_email', v_anonymized_email,
    'status', CASE
      WHEN v_external_actions > 0 THEN 'external_action_required'
      ELSE 'closed'
    END,
    'affected_rows', v_total_affected,
    'external_action_count', v_external_actions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_execute_privacy_request(uuid, text, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_execute_privacy_request(uuid, text, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_prepare_privacy_auth_action(
  p_request_id uuid,
  p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.privacy_requests%ROWTYPE;
  v_latest_run uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_request
  FROM public.privacy_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.subject_user_id IS NULL THEN
    RAISE EXCEPTION 'Demande RGPD introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF p_confirmation IS DISTINCT FROM format('EFFACER %s', v_request.subject_reference) THEN
    RAISE EXCEPTION 'La confirmation explicite est incorrecte.';
  END IF;
  IF v_request.status <> 'external_action_required' THEN
    RAISE EXCEPTION 'Les traitements en base doivent précéder l action Auth.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.course_access
    WHERE user_id = v_request.subject_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Un droit course_access actif interdit la désactivation du compte.';
  END IF;
  v_latest_run := private.latest_privacy_analysis_run(v_request.id);
  IF NOT EXISTS (
    SELECT 1
    FROM public.privacy_processing_actions AS action
    JOIN public.privacy_dependency_assessments AS assessment
      ON assessment.id = action.assessment_id
    WHERE action.request_id = v_request.id
      AND assessment.analysis_run_id = v_latest_run
      AND assessment.category = 'auth_identity'
      AND action.resolution = 'external_action'
      AND action.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'L action Auth n est pas approuvée.';
  END IF;

  RETURN jsonb_build_object(
    'subject_user_id', v_request.subject_user_id,
    'auth_already_deleted', EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = v_request.subject_user_id AND deleted_at IS NOT NULL
    ),
    'anonymized_email', format(
      'anonymous+%s@privacy.invalid',
      replace(v_request.subject_reference::text, '-', '')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_prepare_privacy_auth_action(uuid, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_prepare_privacy_auth_action(uuid, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_complete_privacy_auth_action(
  p_request_id uuid,
  p_confirmation text,
  p_reason text
)
RETURNS public.privacy_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_request public.privacy_requests%ROWTYPE;
  v_result public.privacy_requests%ROWTYPE;
  v_latest_run uuid;
  v_anonymized_email text;
  v_remaining integer;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 4000 THEN
    RAISE EXCEPTION 'Un motif de 10 à 4000 caractères est requis.';
  END IF;
  SELECT * INTO v_request
  FROM public.privacy_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.subject_user_id IS NULL THEN
    RAISE EXCEPTION 'Demande RGPD introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF p_confirmation IS DISTINCT FROM format('EFFACER %s', v_request.subject_reference) THEN
    RAISE EXCEPTION 'La confirmation explicite est incorrecte.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = v_request.subject_user_id AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Le compte Auth doit être désactivé côté serveur avant finalisation.';
  END IF;

  v_anonymized_email := format(
    'anonymous+%s@privacy.invalid',
    replace(v_request.subject_reference::text, '-', '')
  );
  UPDATE public.profiles
  SET email = v_anonymized_email
  WHERE id = v_request.subject_user_id;

  v_latest_run := private.latest_privacy_analysis_run(v_request.id);
  UPDATE public.privacy_processing_actions AS action
  SET status = 'executed',
      executed_at = now(),
      affected_rows = 1,
      execution_code = 'auth_soft_deleted_and_profile_anonymized',
      actor_user_id = v_actor
  FROM public.privacy_dependency_assessments AS assessment
  WHERE action.assessment_id = assessment.id
    AND action.request_id = v_request.id
    AND assessment.analysis_run_id = v_latest_run
    AND assessment.category IN ('profile', 'auth_identity')
    AND action.resolution = 'external_action'
    AND action.status = 'approved';

  INSERT INTO public.privacy_request_events (
    request_id, actor_user_id, event_type, event_details
  ) VALUES (
    v_request.id, v_actor, 'external_action_confirmed',
    jsonb_build_object(
      'categories', jsonb_build_array('auth_identity', 'profile'),
      'result', 'auth_soft_deleted_and_profile_anonymized'
    )
  );

  SELECT count(*)::integer INTO v_remaining
  FROM public.privacy_processing_actions AS action
  JOIN public.privacy_dependency_assessments AS assessment
    ON assessment.id = action.assessment_id
  WHERE action.request_id = v_request.id
    AND assessment.analysis_run_id = v_latest_run
    AND action.status = 'approved';

  UPDATE public.privacy_requests
  SET status = CASE WHEN v_remaining = 0 THEN 'closed' ELSE 'external_action_required' END,
      closed_at = CASE WHEN v_remaining = 0 THEN now() ELSE NULL END,
      responsible_admin_id = v_actor
  WHERE id = v_request.id
  RETURNING * INTO v_result;

  IF v_remaining = 0 THEN
    INSERT INTO public.privacy_request_events (
      request_id, actor_user_id, event_type, event_details
    ) VALUES (
      v_request.id, v_actor, 'request_completed',
      jsonb_build_object('result', 'controlled_erasure_completed')
    );
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_complete_privacy_auth_action(uuid, text, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_complete_privacy_auth_action(uuid, text, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_confirm_privacy_external_action(
  p_action_id uuid,
  p_confirmation text,
  p_reason text
)
RETURNS public.privacy_processing_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_result public.privacy_processing_actions%ROWTYPE;
  v_request public.privacy_requests%ROWTYPE;
  v_action_request_id uuid;
  v_action_resolution text;
  v_action_status text;
  v_category text;
  v_run_id uuid;
  v_remaining integer;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 4000 THEN
    RAISE EXCEPTION 'Un motif de 10 à 4000 caractères est requis.';
  END IF;
  SELECT action.request_id, action.resolution, action.status,
         assessment.category, assessment.analysis_run_id
  INTO v_action_request_id, v_action_resolution, v_action_status,
       v_category, v_run_id
  FROM public.privacy_processing_actions AS action
  JOIN public.privacy_dependency_assessments AS assessment
    ON assessment.id = action.assessment_id
  WHERE action.id = p_action_id
  FOR UPDATE OF action;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action RGPD introuvable.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_request
  FROM public.privacy_requests
  WHERE id = v_action_request_id
  FOR UPDATE;
  IF p_confirmation IS DISTINCT FROM format('CONFIRMER %s', v_request.subject_reference) THEN
    RAISE EXCEPTION 'La confirmation externe est incorrecte.';
  END IF;
  IF v_category IN ('profile', 'auth_identity') THEN
    RAISE EXCEPTION 'L identité Auth exige le traitement serveur dédié.';
  END IF;
  IF v_action_resolution <> 'external_action' OR v_action_status <> 'approved' THEN
    RAISE EXCEPTION 'Cette action externe n est pas en attente de confirmation.';
  END IF;
  IF v_run_id IS DISTINCT FROM private.latest_privacy_analysis_run(v_request.id) THEN
    RAISE EXCEPTION 'Cette action appartient à une analyse remplacée.';
  END IF;

  UPDATE public.privacy_processing_actions
  SET status = 'executed',
      executed_at = now(),
      affected_rows = 0,
      execution_code = 'external_action_confirmed',
      reason = btrim(p_reason),
      actor_user_id = v_actor
  WHERE id = p_action_id
  RETURNING * INTO v_result;

  INSERT INTO public.privacy_request_events (
    request_id, actor_user_id, event_type, event_details
  ) VALUES (
    v_request.id, v_actor, 'external_action_confirmed',
    jsonb_build_object('action_id', p_action_id, 'category', v_category)
  );

  SELECT count(*)::integer INTO v_remaining
  FROM public.privacy_processing_actions AS action
  JOIN public.privacy_dependency_assessments AS assessment
    ON assessment.id = action.assessment_id
  WHERE action.request_id = v_request.id
    AND assessment.analysis_run_id = v_run_id
    AND action.status = 'approved';
  IF v_remaining = 0 THEN
    UPDATE public.privacy_requests
    SET status = 'closed', closed_at = now(), responsible_admin_id = v_actor
    WHERE id = v_request.id;
    INSERT INTO public.privacy_request_events (
      request_id, actor_user_id, event_type, event_details
    ) VALUES (
      v_request.id, v_actor, 'request_completed',
      jsonb_build_object('result', 'controlled_erasure_completed')
    );
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_confirm_privacy_external_action(uuid, text, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_confirm_privacy_external_action(uuid, text, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_record_privacy_external_failure(
  p_request_id uuid,
  p_failure_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF p_failure_code !~ '^[a-z0-9_]{2,100}$' THEN
    RAISE EXCEPTION 'Code d échec invalide.';
  END IF;
  UPDATE public.privacy_requests
  SET status = 'external_action_required'
  WHERE id = p_request_id AND status IN ('processing', 'external_action_required');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande RGPD non compatible avec un échec externe.';
  END IF;
  INSERT INTO public.privacy_request_events (
    request_id, actor_user_id, event_type, event_details
  ) VALUES (
    p_request_id, (SELECT auth.uid()), 'action_failed',
    jsonb_build_object('failure_code', p_failure_code)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_privacy_external_failure(uuid, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_record_privacy_external_failure(uuid, text)
TO authenticated;

COMMIT;
