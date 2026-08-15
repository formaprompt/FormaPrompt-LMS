-- Sprint 1.1A : demandes RGPD et analyse non destructive des dépendances.
-- Cette migration ne contient aucun moteur d'effacement ou d'anonymisation.

BEGIN;

CREATE TABLE public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject_reference uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  request_type text NOT NULL DEFAULT 'erasure',
  request_origin text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'received',
  identity_verification_status text NOT NULL DEFAULT 'pending',
  identity_verified_at timestamptz,
  analysis_conclusion text,
  administrative_decision text,
  decision_reason text,
  last_analyzed_at timestamptz,
  processing_started_at timestamptz,
  decision_recorded_at timestamptz,
  closed_at timestamptz,
  responsible_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_requests_subject_required_check
    CHECK (subject_user_id IS NOT NULL OR status = 'closed'),
  CONSTRAINT privacy_requests_type_check
    CHECK (request_type IN ('erasure', 'access', 'rectification', 'restriction', 'portability', 'objection', 'other')),
  CONSTRAINT privacy_requests_origin_check
    CHECK (request_origin IN ('email', 'contact_form', 'postal_mail', 'verbal', 'other')),
  CONSTRAINT privacy_requests_status_check
    CHECK (status IN ('received', 'identity_check', 'under_analysis', 'under_review', 'decision_recorded', 'closed')),
  CONSTRAINT privacy_requests_identity_check
    CHECK (identity_verification_status IN ('pending', 'not_required', 'verified', 'failed')),
  CONSTRAINT privacy_requests_analysis_conclusion_check
    CHECK (analysis_conclusion IS NULL OR analysis_conclusion IN (
      'full_erasure_possible',
      'partial_erasure_or_anonymization_required',
      'retention_justified',
      'manual_legal_review_required'
    )),
  CONSTRAINT privacy_requests_decision_check
    CHECK (administrative_decision IS NULL OR administrative_decision IN (
      'full_erasure_possible',
      'partial_erasure_or_anonymization_required',
      'retention_justified',
      'manual_legal_review_required'
    )),
  CONSTRAINT privacy_requests_identity_date_check
    CHECK (
      (identity_verification_status = 'verified' AND identity_verified_at IS NOT NULL)
      OR identity_verification_status <> 'verified'
    ),
  CONSTRAINT privacy_requests_decision_reason_check
    CHECK (
      administrative_decision IS NULL
      OR char_length(btrim(coalesce(decision_reason, ''))) BETWEEN 5 AND 4000
    )
);

CREATE INDEX privacy_requests_subject_idx
  ON public.privacy_requests (subject_user_id, created_at DESC);
CREATE INDEX privacy_requests_status_idx
  ON public.privacy_requests (status, received_at DESC);
CREATE INDEX privacy_requests_responsible_idx
  ON public.privacy_requests (responsible_admin_id, updated_at DESC);

CREATE TABLE public.privacy_dependency_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.privacy_requests(id) ON DELETE RESTRICT,
  analysis_run_id uuid NOT NULL,
  subject_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  category text NOT NULL,
  source_system text NOT NULL DEFAULT 'supabase_database',
  source_relation text NOT NULL,
  detection_method text NOT NULL,
  record_count integer NOT NULL,
  risk_level text NOT NULL,
  proposed_action text NOT NULL,
  legal_review_required boolean NOT NULL DEFAULT false,
  external_check_required boolean NOT NULL DEFAULT false,
  note_code text,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_dependency_count_check CHECK (record_count >= 0),
  CONSTRAINT privacy_dependency_risk_check CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT privacy_dependency_action_check CHECK (proposed_action IN (
    'deletion_candidate',
    'anonymization_to_review',
    'potential_retention_to_review',
    'legal_review_required',
    'external_verification_required'
  )),
  CONSTRAINT privacy_dependency_run_item_key
    UNIQUE (analysis_run_id, category, source_system, source_relation, detection_method)
);

CREATE INDEX privacy_dependency_request_idx
  ON public.privacy_dependency_assessments (request_id, assessed_at DESC);
CREATE INDEX privacy_dependency_subject_idx
  ON public.privacy_dependency_assessments (subject_user_id, assessed_at DESC);
CREATE INDEX privacy_dependency_run_idx
  ON public.privacy_dependency_assessments (analysis_run_id);

CREATE TABLE public.privacy_processing_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.privacy_requests(id) ON DELETE RESTRICT,
  assessment_id uuid REFERENCES public.privacy_dependency_assessments(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_processing_action_type_check CHECK (action_type IN (
    'review_deletion_candidate',
    'review_anonymization',
    'review_potential_retention',
    'legal_review',
    'external_check'
  )),
  CONSTRAINT privacy_processing_status_check CHECK (status IN ('proposed', 'reviewed', 'deferred', 'rejected')),
  CONSTRAINT privacy_processing_reason_check CHECK (reason IS NULL OR char_length(reason) <= 4000)
);

CREATE INDEX privacy_processing_request_idx
  ON public.privacy_processing_actions (request_id, created_at DESC);
CREATE INDEX privacy_processing_assessment_idx
  ON public.privacy_processing_actions (assessment_id);
CREATE INDEX privacy_processing_actor_idx
  ON public.privacy_processing_actions (actor_user_id, created_at DESC);

CREATE TABLE public.privacy_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.privacy_requests(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_event_type_check CHECK (event_type IN (
    'request_created',
    'analysis_started',
    'analysis_completed',
    'status_changed',
    'identity_verification_changed',
    'administrative_decision_recorded'
  )),
  CONSTRAINT privacy_event_details_check CHECK (
    jsonb_typeof(event_details) = 'object'
    AND octet_length(event_details::text) <= 8192
  )
);

CREATE INDEX privacy_events_request_idx
  ON public.privacy_request_events (request_id, created_at DESC);
CREATE INDEX privacy_events_actor_idx
  ON public.privacy_request_events (actor_user_id, created_at DESC);

COMMENT ON TABLE public.privacy_requests IS
  'Demandes RGPD administratives. Sprint 1.1A : analyse et revue uniquement, sans exécution destructive.';
COMMENT ON TABLE public.privacy_dependency_assessments IS
  'Instantanés successifs de comptages de dépendances ; aucun contenu personnel complet n est copié.';
COMMENT ON TABLE public.privacy_processing_actions IS
  'Actions de revue proposées. Aucun état executed ni moteur de suppression n existe dans le Sprint 1.1A.';
COMMENT ON TABLE public.privacy_request_events IS
  'Journal append-only minimal des demandes RGPD, sans document ni snapshot personnel complet.';

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_dependency_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_dependency_assessments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_processing_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_processing_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_request_events FORCE ROW LEVEL SECURITY;

CREATE POLICY "Administrateurs consultent les demandes RGPD"
ON public.privacy_requests FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

CREATE POLICY "Administrateurs consultent les analyses RGPD"
ON public.privacy_dependency_assessments FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

CREATE POLICY "Administrateurs consultent les actions RGPD proposées"
ON public.privacy_processing_actions FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

CREATE POLICY "Administrateurs consultent le journal RGPD"
ON public.privacy_request_events FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

REVOKE ALL ON public.privacy_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.privacy_dependency_assessments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.privacy_processing_actions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.privacy_request_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.privacy_requests TO authenticated;
GRANT SELECT ON public.privacy_dependency_assessments TO authenticated;
GRANT SELECT ON public.privacy_processing_actions TO authenticated;
GRANT SELECT ON public.privacy_request_events TO authenticated;
GRANT ALL ON public.privacy_requests TO service_role;
GRANT ALL ON public.privacy_dependency_assessments TO service_role;
GRANT ALL ON public.privacy_processing_actions TO service_role;
GRANT ALL ON public.privacy_request_events TO service_role;

CREATE TRIGGER privacy_requests_set_updated_at
BEFORE UPDATE ON public.privacy_requests
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER privacy_processing_actions_set_updated_at
BEFORE UPDATE ON public.privacy_processing_actions
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE OR REPLACE FUNCTION private.reject_privacy_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Le journal RGPD est append-only.' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION private.reject_privacy_event_mutation() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER privacy_request_events_reject_update
BEFORE UPDATE ON public.privacy_request_events
FOR EACH ROW EXECUTE FUNCTION private.reject_privacy_event_mutation();

CREATE TRIGGER privacy_request_events_reject_delete
BEFORE DELETE ON public.privacy_request_events
FOR EACH ROW EXECUTE FUNCTION private.reject_privacy_event_mutation();

CREATE OR REPLACE FUNCTION private.record_privacy_assessment(
  p_request_id uuid,
  p_run_id uuid,
  p_subject_user_id uuid,
  p_category text,
  p_source_system text,
  p_source_relation text,
  p_detection_method text,
  p_record_count integer,
  p_risk_level text,
  p_proposed_action text,
  p_legal_review_required boolean DEFAULT false,
  p_external_check_required boolean DEFAULT false,
  p_note_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_record_count <= 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.privacy_dependency_assessments (
    request_id, analysis_run_id, subject_user_id, category, source_system,
    source_relation, detection_method, record_count, risk_level,
    proposed_action, legal_review_required, external_check_required, note_code
  ) VALUES (
    p_request_id, p_run_id, p_subject_user_id, p_category, p_source_system,
    p_source_relation, p_detection_method, p_record_count, p_risk_level,
    p_proposed_action, p_legal_review_required, p_external_check_required, p_note_code
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.record_privacy_assessment(
  uuid, uuid, uuid, text, text, text, text, integer, text, text, boolean, boolean, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_create_privacy_request(
  p_subject_user_id uuid,
  p_request_type text,
  p_request_origin text,
  p_received_at timestamptz DEFAULT now(),
  p_identity_verification_status text DEFAULT 'pending'
)
RETURNS public.privacy_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_result public.privacy_requests%ROWTYPE;
  v_identity_date timestamptz;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_subject_user_id) THEN
    RAISE EXCEPTION 'Personne concernée introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF p_received_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'La date de réception ne peut pas être future.';
  END IF;
  v_identity_date := CASE WHEN p_identity_verification_status = 'verified' THEN now() ELSE NULL END;

  INSERT INTO public.privacy_requests (
    subject_user_id, request_type, request_origin, received_at,
    identity_verification_status, identity_verified_at,
    responsible_admin_id, created_by
  ) VALUES (
    p_subject_user_id, p_request_type, p_request_origin, p_received_at,
    p_identity_verification_status, v_identity_date, v_actor, v_actor
  ) RETURNING * INTO v_result;

  INSERT INTO public.privacy_request_events (request_id, actor_user_id, event_type, event_details)
  VALUES (
    v_result.id, v_actor, 'request_created',
    jsonb_build_object(
      'request_type', v_result.request_type,
      'request_origin', v_result.request_origin,
      'identity_verification_status', v_result.identity_verification_status
    )
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_privacy_request(uuid, text, text, timestamptz, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_privacy_request(uuid, text, text, timestamptz, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_analyze_privacy_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_request public.privacy_requests%ROWTYPE;
  v_run_id uuid := gen_random_uuid();
  v_email text;
  v_role text;
  v_name text;
  v_phone text;
  v_count integer;
  v_dependency_count integer := 0;
  v_category_count integer := 0;
  v_manual_review boolean := false;
  v_external_check boolean := false;
  v_conclusion text;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
  FROM public.privacy_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.subject_user_id IS NULL THEN
    RAISE EXCEPTION 'Demande RGPD ou personne concernée introuvable.' USING ERRCODE = 'P0002';
  END IF;

  SELECT email, role INTO v_email, v_role
  FROM public.profiles
  WHERE id = v_request.subject_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil de la personne concernée introuvable.' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    nullif(btrim(concat_ws(' ', learner_first_name, learner_last_name)), ''),
    nullif(btrim(learner_phone), '')
  INTO v_name, v_phone
  FROM public.training_enrollments
  WHERE user_id = v_request.subject_user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_name IS NULL THEN
    SELECT nullif(btrim(learner_name), '') INTO v_name
    FROM public.course_positioning_assessments
    WHERE user_id = v_request.subject_user_id
    ORDER BY submitted_at DESC
    LIMIT 1;
  END IF;

  UPDATE public.privacy_requests
  SET status = 'under_analysis', processing_started_at = coalesce(processing_started_at, now())
  WHERE id = v_request.id;

  INSERT INTO public.privacy_request_events (request_id, actor_user_id, event_type, event_details)
  VALUES (v_request.id, v_actor, 'analysis_started', jsonb_build_object('analysis_run_id', v_run_id));

  PERFORM private.record_privacy_assessment(v_request.id, v_run_id, v_request.subject_user_id,
    'profile', 'supabase_database', 'profiles', 'direct_user_id', 1, 'low',
    'deletion_candidate', false, false, 'account_profile');

  SELECT count(*)::integer INTO v_count FROM public.course_access WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'course_access','supabase_database','course_access','direct_user_id',v_count,'medium','anonymization_to_review') THEN v_dependency_count:=v_dependency_count+v_count; END IF;
  SELECT count(*)::integer INTO v_count FROM public.purchases WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'purchases','supabase_database','purchases','direct_user_id',v_count,'high','potential_retention_to_review',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(*)::integer INTO v_count FROM public.course_booking_requests WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'booking_requests','supabase_database','course_booking_requests','direct_user_id',v_count,'medium','anonymization_to_review') THEN v_dependency_count:=v_dependency_count+v_count; END IF;
  SELECT count(*)::integer INTO v_count FROM public.course_session_bookings WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'session_bookings','supabase_database','course_session_bookings','direct_user_id',v_count,'medium','anonymization_to_review') THEN v_dependency_count:=v_dependency_count+v_count; END IF;
  SELECT count(*)::integer INTO v_count FROM public.course_session_attendance WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'attendance','supabase_database','course_session_attendance','direct_user_id',v_count,'high','potential_retention_to_review',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(DISTINCT l.id)::integer INTO v_count
  FROM public.course_attendance_audit_log l
  LEFT JOIN public.course_session_attendance a ON a.id = l.attendance_id
  LEFT JOIN public.course_booking_requests b ON b.id = l.booking_request_id
  WHERE a.user_id = v_request.subject_user_id OR b.user_id = v_request.subject_user_id OR l.actor_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'attendance_audit','supabase_database','course_attendance_audit_log','indirect_relation',v_count,'high','potential_retention_to_review',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(*)::integer INTO v_count FROM public.course_lesson_progress WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'lesson_progress','supabase_database','course_lesson_progress','direct_user_id',v_count,'medium','anonymization_to_review') THEN v_dependency_count:=v_dependency_count+v_count; END IF;
  SELECT count(*)::integer INTO v_count FROM public.course_positioning_assessments WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'positioning','supabase_database','course_positioning_assessments','direct_user_id',v_count,'medium','anonymization_to_review') THEN v_dependency_count:=v_dependency_count+v_count; END IF;
  SELECT count(*)::integer INTO v_count FROM public.course_exercise_responses WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'exercise_responses','supabase_database','course_exercise_responses','direct_user_id',v_count,'medium','anonymization_to_review') THEN v_dependency_count:=v_dependency_count+v_count; END IF;
  SELECT count(DISTINCT r.id)::integer INTO v_count FROM public.course_exercise_reviews r JOIN public.course_exercise_responses e ON e.id=r.response_id WHERE e.user_id=v_request.subject_user_id OR r.reviewer_id=v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'exercise_reviews','supabase_database','course_exercise_reviews','indirect_relation',v_count,'high','potential_retention_to_review',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(*)::integer INTO v_count FROM public.course_final_project_submissions WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'final_projects','supabase_database','course_final_project_submissions','direct_user_id',v_count,'high','potential_retention_to_review',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(DISTINCT r.id)::integer INTO v_count FROM public.course_final_project_reviews r JOIN public.course_final_project_submissions s ON s.id=r.submission_id WHERE s.user_id=v_request.subject_user_id OR r.reviewer_id=v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'final_project_reviews','supabase_database','course_final_project_reviews','indirect_relation',v_count,'high','potential_retention_to_review',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(*)::integer INTO v_count FROM public.course_attestation_issuances WHERE user_id=v_request.subject_user_id OR issued_by=v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'attestations','supabase_database','course_attestation_issuances','direct_or_actor_user_id',v_count,'high','potential_retention_to_review',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(*)::integer INTO v_count FROM public.satisfaction_surveys WHERE user_id=v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'satisfaction','supabase_database','satisfaction_surveys','direct_user_id',v_count,'medium','anonymization_to_review') THEN v_dependency_count:=v_dependency_count+v_count; END IF;
  SELECT count(*)::integer INTO v_count FROM public.training_enrollments WHERE user_id=v_request.subject_user_id OR created_by=v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'training_enrollments','supabase_database','training_enrollments','direct_or_actor_user_id',v_count,'high','potential_retention_to_review',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(DISTINCT d.id)::integer INTO v_count FROM public.training_documents d LEFT JOIN public.training_enrollments e ON e.id=d.enrollment_id WHERE d.user_id=v_request.subject_user_id OR d.generated_by=v_request.subject_user_id OR e.user_id=v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'training_documents','supabase_database','training_documents','direct_or_indirect_relation',v_count,'high','potential_retention_to_review',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(*)::integer INTO v_count FROM public.disciplinary_incidents WHERE learner_user_id=v_request.subject_user_id OR reported_by=v_request.subject_user_id OR responsible_admin_id=v_request.subject_user_id OR decided_by=v_request.subject_user_id OR closed_by=v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'disciplinary_incidents','supabase_database','disciplinary_incidents','subject_or_actor_user_id',v_count,'critical','legal_review_required',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(DISTINCT h.id)::integer INTO v_count FROM public.disciplinary_hearings h JOIN public.disciplinary_incidents i ON i.id=h.incident_id WHERE i.learner_user_id=v_request.subject_user_id OR h.created_by=v_request.subject_user_id;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'disciplinary_hearings','supabase_database','disciplinary_hearings','indirect_or_actor_relation',v_count,'critical','legal_review_required',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(*)::integer INTO v_count FROM public.audit_log WHERE actor_user_id=v_request.subject_user_id OR target_user_id=v_request.subject_user_id OR target_id=v_request.subject_user_id::text;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'audit_logs','supabase_database','audit_log','subject_actor_or_target_identifier',v_count,'high','legal_review_required',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;

  SELECT count(*)::integer INTO v_count FROM public.contact_requests WHERE lower(email)=lower(v_email);
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'contact_requests','supabase_database','contact_requests','exact_email_without_fk',v_count,'medium','anonymization_to_review',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(*)::integer INTO v_count FROM public.satisfaction_surveys WHERE user_id IS DISTINCT FROM v_request.subject_user_id AND lower(student_email)=lower(v_email);
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'satisfaction_without_fk','supabase_database','satisfaction_surveys','exact_email_without_fk',v_count,'medium','anonymization_to_review',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(*)::integer INTO v_count FROM public.calendar_bookings
  WHERE strpos(lower(coalesce(comments,'')),lower(v_email))>0 OR strpos(lower(coalesce(of_name,'')),lower(v_email))>0
    OR (v_name IS NOT NULL AND char_length(v_name)>=5 AND (strpos(lower(coalesce(comments,'')),lower(v_name))>0 OR strpos(lower(coalesce(of_name,'')),lower(v_name))>0))
    OR (v_phone IS NOT NULL AND char_length(v_phone)>=6 AND strpos(coalesce(comments,''),v_phone)>0);
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'calendar_text_matches','supabase_database','calendar_bookings','email_name_or_phone_text_scan',v_count,'high','legal_review_required',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;
  SELECT count(*)::integer INTO v_count FROM public.training_documents
  WHERE strpos(lower(content_snapshot::text),lower(v_email))>0
    OR (v_name IS NOT NULL AND char_length(v_name)>=5 AND strpos(lower(content_snapshot::text),lower(v_name))>0)
    OR (v_phone IS NOT NULL AND char_length(v_phone)>=6 AND strpos(content_snapshot::text,v_phone)>0);
  v_count := v_count + (SELECT count(*)::integer FROM public.course_attestation_issuances
    WHERE strpos(lower(content_snapshot::text),lower(v_email))>0
      OR (v_name IS NOT NULL AND char_length(v_name)>=5 AND strpos(lower(content_snapshot::text),lower(v_name))>0)
      OR (v_phone IS NOT NULL AND char_length(v_phone)>=6 AND strpos(content_snapshot::text,v_phone)>0));
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'snapshot_matches','supabase_database','jsonb_snapshots','email_name_or_phone_content_scan',v_count,'critical','legal_review_required',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;

  SELECT count(*)::integer INTO v_count FROM storage.objects
  WHERE owner_id=v_request.subject_user_id::text OR strpos(lower(name),lower(v_email))>0;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'storage_objects','supabase_storage','storage.objects','owner_id_or_email_path',v_count,'high','legal_review_required',true) THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; END IF;

  SELECT (
    (SELECT count(*) FROM public.purchases WHERE user_id=v_request.subject_user_id AND (stripe_session_id IS NOT NULL OR stripe_checkout_session_id IS NOT NULL OR stripe_payment_intent_id IS NOT NULL OR stripe_event_id IS NOT NULL))
    + (SELECT count(*) FROM public.course_booking_requests WHERE user_id=v_request.subject_user_id AND (stripe_checkout_session_id IS NOT NULL OR stripe_payment_intent_id IS NOT NULL OR stripe_event_id IS NOT NULL))
  )::integer INTO v_count;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'stripe_external','stripe','external_api','local_stripe_reference',v_count,'critical','external_verification_required',true,true,'external_check_required') THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; v_external_check:=true; END IF;
  SELECT count(*)::integer INTO v_count FROM public.course_session_bookings WHERE user_id=v_request.subject_user_id AND meeting_url IS NOT NULL;
  IF private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'meeting_provider_external','external_meeting_provider','external_api','local_meeting_reference',v_count,'high','external_verification_required',true,true,'external_check_required') THEN v_dependency_count:=v_dependency_count+v_count; v_manual_review:=true; v_external_check:=true; END IF;

  IF v_role <> 'user' THEN
    v_manual_review := true;
    PERFORM private.record_privacy_assessment(v_request.id,v_run_id,v_request.subject_user_id,'staff_account','supabase_auth','profiles','administrative_role',1,'critical','legal_review_required',true,false,'staff_or_admin_account');
  END IF;

  IF v_dependency_count = 0 AND NOT v_manual_review AND NOT v_external_check THEN
    v_conclusion := 'full_erasure_possible';
  ELSIF v_manual_review OR v_external_check THEN
    v_conclusion := 'manual_legal_review_required';
  ELSE
    v_conclusion := 'partial_erasure_or_anonymization_required';
  END IF;

  INSERT INTO public.privacy_processing_actions (request_id, assessment_id, action_type, actor_user_id)
  SELECT
    v_request.id,
    a.id,
    CASE a.proposed_action
      WHEN 'deletion_candidate' THEN 'review_deletion_candidate'
      WHEN 'anonymization_to_review' THEN 'review_anonymization'
      WHEN 'potential_retention_to_review' THEN 'review_potential_retention'
      WHEN 'external_verification_required' THEN 'external_check'
      ELSE 'legal_review'
    END,
    v_actor
  FROM public.privacy_dependency_assessments a
  WHERE a.analysis_run_id=v_run_id;

  SELECT count(*)::integer INTO v_category_count
  FROM public.privacy_dependency_assessments WHERE analysis_run_id=v_run_id;

  UPDATE public.privacy_requests
  SET status='under_review', analysis_conclusion=v_conclusion, last_analyzed_at=now()
  WHERE id=v_request.id;

  INSERT INTO public.privacy_request_events (request_id, actor_user_id, event_type, event_details)
  VALUES (v_request.id,v_actor,'analysis_completed',jsonb_build_object(
    'analysis_run_id',v_run_id,
    'analysis_conclusion',v_conclusion,
    'dependency_count',v_dependency_count,
    'category_count',v_category_count,
    'external_check_required',v_external_check
  ));

  RETURN jsonb_build_object(
    'request_id',v_request.id,
    'analysis_run_id',v_run_id,
    'analysis_conclusion',v_conclusion,
    'dependency_count',v_dependency_count,
    'category_count',v_category_count,
    'external_check_required',v_external_check
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_analyze_privacy_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analyze_privacy_request(uuid) TO authenticated;

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
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF p_administrative_decision IS NOT NULL AND char_length(btrim(coalesce(p_decision_reason,'')))<5 THEN
    RAISE EXCEPTION 'Une décision exige un motif de 5 caractères minimum.';
  END IF;

  SELECT * INTO v_before FROM public.privacy_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande RGPD introuvable.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.privacy_requests
  SET status=p_status,
      identity_verification_status=p_identity_verification_status,
      identity_verified_at=CASE WHEN p_identity_verification_status='verified' THEN coalesce(identity_verified_at,now()) ELSE NULL END,
      administrative_decision=p_administrative_decision,
      decision_reason=CASE WHEN p_administrative_decision IS NOT NULL THEN btrim(p_decision_reason) ELSE decision_reason END,
      decision_recorded_at=CASE WHEN p_administrative_decision IS NOT NULL THEN now() ELSE decision_recorded_at END,
      closed_at=CASE WHEN p_status='closed' THEN coalesce(closed_at,now()) ELSE NULL END,
      responsible_admin_id=v_actor
  WHERE id=p_request_id
  RETURNING * INTO v_result;

  IF v_before.identity_verification_status IS DISTINCT FROM v_result.identity_verification_status THEN
    INSERT INTO public.privacy_request_events(request_id,actor_user_id,event_type,event_details)
    VALUES(v_result.id,v_actor,'identity_verification_changed',jsonb_build_object('previous',v_before.identity_verification_status,'new',v_result.identity_verification_status));
  END IF;
  IF v_before.status IS DISTINCT FROM v_result.status THEN
    INSERT INTO public.privacy_request_events(request_id,actor_user_id,event_type,event_details)
    VALUES(v_result.id,v_actor,'status_changed',jsonb_build_object('previous',v_before.status,'new',v_result.status));
  END IF;
  IF p_administrative_decision IS NOT NULL THEN
    INSERT INTO public.privacy_request_events(request_id,actor_user_id,event_type,event_details)
    VALUES(v_result.id,v_actor,'administrative_decision_recorded',jsonb_build_object('decision',v_result.administrative_decision));
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_privacy_request(uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_privacy_request(uuid,text,text,text,text) TO authenticated;

COMMIT;
