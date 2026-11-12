BEGIN;

-- Sur le schéma reconstruit par les migrations, l'ancienne référence Stripe
-- n'existe pas. Conserver sa détection sur les bases où la colonne subsiste.
DO $migration$
DECLARE
  v_source text := pg_get_functiondef('private.admin_analyze_privacy_request_base(uuid)'::regprocedure);
  v_anchor text := 'stripe_session_id IS NOT NULL OR stripe_checkout_session_id';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.purchases'::regclass AND attname = 'stripe_session_id' AND NOT attisdropped
  ) THEN
    IF (length(v_source) - length(replace(v_source, v_anchor, ''))) <> length(v_anchor) THEN
      RAISE EXCEPTION 'Ancre de détection Stripe RGPD absente ou ambiguë.';
    END IF;
    EXECUTE replace(v_source, v_anchor, 'stripe_checkout_session_id');
  END IF;
END;
$migration$;

-- La branche financière ajoutait cet événement au journal sans l'autoriser
-- dans sa contrainte. Garder les types existants et déclarer les deux ajouts.
ALTER TABLE public.privacy_request_events
  DROP CONSTRAINT privacy_event_type_check,
  ADD CONSTRAINT privacy_event_type_check CHECK (event_type IN (
    'request_created', 'analysis_started', 'analysis_completed', 'analysis_finalized',
    'analysis_stripe_evidence_added', 'analysis_iag_dependencies_added',
    'status_changed', 'identity_verification_changed', 'administrative_decision_recorded',
    'action_decided', 'execution_started', 'action_executed', 'action_failed',
    'external_action_confirmed', 'request_completed'
  ));

-- Les réponses validées, la progression, les travaux et les certificats émis
-- figurent déjà dans l'inventaire commun. Ajouter les données IAG complémentaires.
CREATE FUNCTION private.iag_privacy_dependencies(p_subject uuid)
RETURNS TABLE(category text, source_relation text, detection_method text, record_count integer)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT 'iag_positioning_drafts', 'course_positioning_drafts', 'direct_user_id', count(*)::integer
  FROM public.course_positioning_drafts WHERE user_id = p_subject
  UNION ALL
  SELECT 'iag_submission_details', 'iag_submission_details', 'direct_user_id', count(*)::integer
  FROM public.iag_submission_details WHERE user_id = p_subject
  UNION ALL
  SELECT 'iag_review_details', 'iag_review_details', 'indirect_subject_or_reviewer', count(*)::integer
  FROM public.iag_review_details d
  JOIN public.iag_submission_details s ON s.response_id = d.response_id
  JOIN public.course_exercise_reviews r ON r.id = d.review_id
  WHERE s.user_id = p_subject OR r.reviewer_id = p_subject
  UNION ALL
  SELECT 'iag_assessment_events', 'iag_assessment_events', 'indirect_subject_or_actor', count(*)::integer
  FROM public.iag_assessment_events e
  JOIN public.iag_submission_details s ON s.response_id = e.response_id
  WHERE s.user_id = p_subject OR e.actor_id = p_subject
  UNION ALL
  SELECT 'iag_certificate_identities', 'iag_certificate_identities', 'direct_user_id', count(*)::integer
  FROM public.iag_certificate_identities WHERE user_id = p_subject
  UNION ALL
  SELECT 'iag_stripe_attempts', 'private.iag_stripe_attempts', 'indirect_checkout_intent', count(*)::integer
  FROM private.iag_stripe_attempts a
  JOIN public.commercial_checkout_intents i ON i.id = a.checkout_intent_id
  WHERE i.user_id = p_subject;
$$;
REVOKE ALL ON FUNCTION private.iag_privacy_dependencies(uuid) FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.admin_analyze_privacy_request(uuid) SET SCHEMA private;
ALTER FUNCTION private.admin_analyze_privacy_request(uuid) RENAME TO iag_privacy_analysis_previous;
REVOKE ALL ON FUNCTION private.iag_privacy_analysis_previous(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.admin_analyze_privacy_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_result jsonb;
  v_request public.privacy_requests%ROWTYPE;
  v_run uuid;
  v_categories integer;
  v_dependencies integer;
BEGIN
  v_result := private.iag_privacy_analysis_previous(p_request_id);
  v_run := (v_result->>'analysis_run_id')::uuid;
  SELECT * INTO STRICT v_request FROM public.privacy_requests WHERE id = p_request_id;

  WITH added AS (
    INSERT INTO public.privacy_dependency_assessments (
      request_id, analysis_run_id, subject_user_id, category, source_relation, detection_method,
      record_count, risk_level, proposed_action, legal_review_required, note_code
    )
    SELECT p_request_id, v_run, v_request.subject_user_id, d.category, d.source_relation, d.detection_method,
      d.record_count, 'high', 'legal_review_required', true, 'iag_retention_decision_required'
    FROM private.iag_privacy_dependencies(v_request.subject_user_id) d
    WHERE d.record_count > 0
    RETURNING id
  )
  INSERT INTO public.privacy_processing_actions (request_id, assessment_id, action_type, actor_user_id)
  SELECT p_request_id, id, 'legal_review', (SELECT auth.uid()) FROM added;

  GET DIAGNOSTICS v_categories = ROW_COUNT;
  IF v_categories = 0 THEN RETURN v_result; END IF;

  SELECT sum(record_count)::integer INTO v_dependencies
  FROM public.privacy_dependency_assessments
  WHERE analysis_run_id = v_run AND note_code = 'iag_retention_decision_required';

  UPDATE public.privacy_requests SET analysis_conclusion = 'manual_legal_review_required'
  WHERE id = p_request_id;

  INSERT INTO public.privacy_request_events (request_id, actor_user_id, event_type, event_details)
  VALUES (p_request_id, (SELECT auth.uid()), 'analysis_iag_dependencies_added', jsonb_build_object(
    'analysis_run_id', v_run, 'iag_dependency_count', v_dependencies,
    'iag_category_count', v_categories, 'analysis_conclusion', 'manual_legal_review_required'
  ));

  RETURN v_result || jsonb_build_object(
    'analysis_conclusion', 'manual_legal_review_required',
    'dependency_count', (v_result->>'dependency_count')::integer + v_dependencies,
    'category_count', (v_result->>'category_count')::integer + v_categories,
    'iag_dependency_count', v_dependencies
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_analyze_privacy_request(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_analyze_privacy_request(uuid) TO authenticated;

-- La décision existante « retain » exige une motivation et un approbateur.
-- Toute autre résolution IAG requiert un traitement dédié à arbitrer.
CREATE FUNCTION private.assert_iag_privacy_decisions(p_request public.privacy_requests)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_run uuid := private.latest_privacy_analysis_run(p_request.id);
BEGIN
  IF p_request.request_type <> 'erasure' THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM private.iag_privacy_dependencies(p_request.subject_user_id) d
    WHERE d.record_count > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.privacy_dependency_assessments a
        JOIN public.privacy_processing_actions p ON p.assessment_id = a.id AND p.request_id = a.request_id
        WHERE a.request_id = p_request.id AND a.analysis_run_id = v_run
          AND a.category = d.category AND a.record_count = d.record_count
          AND p.status IN ('approved', 'executed') AND p.resolution = 'retain'
          AND p.approved_by IS NOT NULL AND char_length(btrim(p.reason)) >= 10
      )
  ) THEN
    RAISE EXCEPTION 'Les données IAG exigent une analyse à jour et une décision motivée par catégorie.'
      USING ERRCODE = '55000';
  END IF;

  IF p_request.administrative_decision = 'full_erasure_possible' AND EXISTS (
    SELECT 1 FROM private.iag_privacy_dependencies(p_request.subject_user_id) WHERE record_count > 0
  ) THEN
    RAISE EXCEPTION 'Des données IAG sont conservées. Enregistrez une décision d’effacement partiel.'
      USING ERRCODE = '55000';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.assert_iag_privacy_decisions(public.privacy_requests) FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.admin_execute_privacy_request(uuid, text, text) SET SCHEMA private;
ALTER FUNCTION private.admin_execute_privacy_request(uuid, text, text) RENAME TO iag_privacy_execution_previous;
REVOKE ALL ON FUNCTION private.iag_privacy_execution_previous(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.admin_execute_privacy_request(p_request_id uuid, p_confirmation text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public.privacy_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_strict_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  -- Les écritures IAG du participant prennent également le verrou sur le droit.
  PERFORM 1 FROM public.course_access a
  JOIN public.privacy_requests p ON p.subject_user_id = a.user_id
  WHERE p.id = p_request_id AND a.course_id = 'formation-ia-generative-elearning'
  FOR UPDATE OF a;
  SELECT * INTO v_request FROM public.privacy_requests WHERE id = p_request_id FOR UPDATE;
  IF FOUND THEN PERFORM private.assert_iag_privacy_decisions(v_request); END IF;
  RETURN private.iag_privacy_execution_previous(p_request_id, p_confirmation, p_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_execute_privacy_request(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_execute_privacy_request(uuid, text, text) TO authenticated;

ALTER FUNCTION public.admin_prepare_privacy_auth_action(uuid, text) SET SCHEMA private;
ALTER FUNCTION private.admin_prepare_privacy_auth_action(uuid, text) RENAME TO iag_privacy_auth_previous;
REVOKE ALL ON FUNCTION private.iag_privacy_auth_previous(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.admin_prepare_privacy_auth_action(p_request_id uuid, p_confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_result jsonb;
  v_request public.privacy_requests%ROWTYPE;
BEGIN
  v_result := private.iag_privacy_auth_previous(p_request_id, p_confirmation);
  SELECT * INTO STRICT v_request FROM public.privacy_requests WHERE id = p_request_id;
  PERFORM private.assert_iag_privacy_decisions(v_request);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_prepare_privacy_auth_action(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_prepare_privacy_auth_action(uuid, text) TO authenticated;

CREATE FUNCTION private.check_iag_privacy_closure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.assert_iag_privacy_decisions(NEW);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.check_iag_privacy_closure() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER check_iag_privacy_closure BEFORE UPDATE OF status ON public.privacy_requests
FOR EACH ROW WHEN (NEW.status = 'closed' AND OLD.status <> 'closed')
EXECUTE FUNCTION private.check_iag_privacy_closure();

COMMIT;
