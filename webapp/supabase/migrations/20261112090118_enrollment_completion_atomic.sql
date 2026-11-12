BEGIN;

CREATE FUNCTION public.complete_training_enrollment(
  p_enrollment_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_generated_at timestamptz,
  p_certificate jsonb
)
RETURNS public.training_enrollments
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  enrollment public.training_enrollments%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id AND role IN ('admin', 'employee')
  ) THEN
    RAISE EXCEPTION 'ENROLLMENT_COMPLETION_FORBIDDEN';
  END IF;

  SELECT * INTO enrollment
  FROM public.training_enrollments
  WHERE id = p_enrollment_id
  FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENROLLMENT_COMPLETION_NOT_FOUND';
  END IF;
  IF enrollment.status IN ('archived', 'cancelled', 'abandoned') THEN
    RAISE EXCEPTION 'ENROLLMENT_COMPLETION_INVALID_STATUS';
  END IF;

  -- An identical retry or a concurrent caller can return the first successful closure.
  IF enrollment.status = 'completed'
    AND EXISTS (
      SELECT 1 FROM public.training_documents
      WHERE enrollment_id = enrollment.id AND document_type = 'completion_certificate'
        AND status <> 'missing'
    )
    AND (enrollment.booking_request_id IS NULL OR EXISTS (
      SELECT 1 FROM public.training_documents
      WHERE enrollment_id = enrollment.id AND document_type = 'satisfaction_questionnaire'
        AND status <> 'missing'
    ))
  THEN
    RETURN enrollment;
  END IF;

  -- The Edge function rendered the certificate from the dossier version it read.
  IF enrollment.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'ENROLLMENT_COMPLETION_STALE';
  END IF;

  IF enrollment.status <> 'completed' THEN
    IF enrollment.ends_at > statement_timestamp() OR enrollment.ends_at > p_generated_at THEN
      RAISE EXCEPTION 'ENROLLMENT_COMPLETION_TOO_EARLY';
    END IF;
    UPDATE public.training_enrollments
    SET status = 'completed', completed_at = p_generated_at, updated_at = p_generated_at
    WHERE id = p_enrollment_id
    RETURNING * INTO enrollment;
  END IF;

  IF (p_certificate #>> '{completion,completedAt}')::timestamptz IS DISTINCT FROM enrollment.completed_at THEN
    RAISE EXCEPTION 'ENROLLMENT_COMPLETION_STALE';
  END IF;

  INSERT INTO public.training_documents AS existing (
    enrollment_id, user_id, course_id, document_type, status, content_snapshot,
    visible_to_learner, generated_by, generated_at, updated_at
  )
  SELECT
    enrollment.id, enrollment.user_id, enrollment.course_id, document.type, 'ready',
    document.snapshot, true, p_actor_id, p_generated_at, p_generated_at
  FROM (VALUES
    ('completion_certificate', p_certificate),
    ('satisfaction_questionnaire', jsonb_build_object(
      'version', 1,
      'documentType', 'satisfaction_questionnaire',
      'bookingRequestId', enrollment.booking_request_id,
      'courseId', enrollment.course_id
    ))
  ) AS document(type, snapshot)
  WHERE document.type = 'completion_certificate' OR enrollment.booking_request_id IS NOT NULL
  ON CONFLICT (enrollment_id, document_type) DO UPDATE SET
    status = EXCLUDED.status,
    content_snapshot = EXCLUDED.content_snapshot,
    visible_to_learner = EXCLUDED.visible_to_learner,
    generated_by = EXCLUDED.generated_by,
    generated_at = EXCLUDED.generated_at,
    updated_at = EXCLUDED.updated_at
  WHERE existing.status = 'missing';

  RETURN enrollment;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_training_enrollment(uuid, uuid, timestamptz, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_training_enrollment(uuid, uuid, timestamptz, timestamptz, jsonb)
  TO service_role;

COMMIT;
