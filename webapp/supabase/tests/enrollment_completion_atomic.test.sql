BEGIN;
SET LOCAL plpgsql.check_asserts = on;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('9e110000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'staff.closure@example.test', '', '{}', '{}'),
  ('9e110000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'learner.closure@example.test', '', '{}', '{}');

INSERT INTO public.profiles (id, email, role)
VALUES
  ('9e110000-0000-4000-8000-000000000001', 'staff.closure@example.test', 'employee'),
  ('9e110000-0000-4000-8000-000000000002', 'learner.closure@example.test', 'user')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.course_booking_requests (
  id, user_id, course_id, delivery_mode, schedule_format, status, distance_status, travel_fee_status
) VALUES (
  '9e110000-0000-4000-8000-000000000003', '9e110000-0000-4000-8000-000000000002',
  'formation-ia-act', 'remote', 'one_4h', 'completed', 'not_required', 'not_required'
);

INSERT INTO public.training_enrollments (
  id, user_id, course_id, status, enrollment_source, learner_first_name, learner_last_name,
  funding_mode, delivery_mode, starts_at, ends_at, duration_minutes, booking_request_id, created_by,
  updated_at, completed_at
)
SELECT entry.id::uuid, '9e110000-0000-4000-8000-000000000002', entry.course, entry.status,
  'manual', 'Camille', 'Exemple', 'free', 'remote', now() - interval '3 days', now() + entry.end_offset,
  240, entry.booking::uuid, '9e110000-0000-4000-8000-000000000001', now() - interval '2 hours',
  CASE WHEN entry.status = 'completed' THEN now() - interval '4 hours' END
FROM (VALUES
  ('9e110000-0000-4000-8000-000000000004', 'formation-ia-act', 'in_progress', interval '-1 day', '9e110000-0000-4000-8000-000000000003'),
  ('9e110000-0000-4000-8000-000000000005', 'formation-ia', 'completed', interval '-1 day', NULL),
  ('9e110000-0000-4000-8000-000000000006', 'formation-prompt-level-1', 'validated', interval '1 day', NULL)
) AS entry(id, course, status, end_offset, booking);

INSERT INTO public.training_documents (id, enrollment_id, user_id, course_id, document_type, status)
VALUES
  ('9e110000-0000-4000-8000-000000000007', '9e110000-0000-4000-8000-000000000004',
    '9e110000-0000-4000-8000-000000000002', 'formation-ia-act', 'completion_certificate', 'missing'),
  ('9e110000-0000-4000-8000-000000000008', '9e110000-0000-4000-8000-000000000004',
    '9e110000-0000-4000-8000-000000000002', 'formation-ia-act', 'satisfaction_questionnaire', 'missing');

SET LOCAL ROLE service_role;

DO $$
DECLARE
  staff_id constant uuid := '9e110000-0000-4000-8000-000000000001';
  learner_id constant uuid := '9e110000-0000-4000-8000-000000000002';
  booking_id constant uuid := '9e110000-0000-4000-8000-000000000003';
  dossier_id constant uuid := '9e110000-0000-4000-8000-000000000004';
  legacy_id constant uuid := '9e110000-0000-4000-8000-000000000005';
  future_id constant uuid := '9e110000-0000-4000-8000-000000000006';
  rpc_signature constant text := 'public.complete_training_enrollment(uuid,uuid,timestamptz,timestamptz,jsonb)';
  completed_at constant timestamptz := now();
  previous_update constant timestamptz := now() - interval '2 hours';
  certificate constant jsonb := jsonb_build_object('completion', jsonb_build_object('completedAt', completed_at));
  returned public.training_enrollments%ROWTYPE;
  first_documents jsonb;
BEGIN
  ASSERT NOT has_function_privilege('anon', rpc_signature, 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', rpc_signature, 'EXECUTE');

  BEGIN
    PERFORM public.complete_training_enrollment(dossier_id, learner_id, previous_update, completed_at, certificate);
    RAISE EXCEPTION 'Learner unexpectedly allowed to close a dossier';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'ENROLLMENT_COMPLETION_FORBIDDEN';
  END;

  BEGIN
    PERFORM public.complete_training_enrollment(future_id, staff_id, previous_update, completed_at, certificate);
    RAISE EXCEPTION 'Future dossier unexpectedly completed';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'ENROLLMENT_COMPLETION_TOO_EARLY';
  END;

  BEGIN
    PERFORM public.complete_training_enrollment(dossier_id, staff_id, completed_at, completed_at, certificate);
    RAISE EXCEPTION 'Outdated dossier unexpectedly completed';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'ENROLLMENT_COMPLETION_STALE';
  END;

  BEGIN
    PERFORM public.complete_training_enrollment(dossier_id, staff_id, previous_update, completed_at,
      certificate || jsonb_build_object('oversized', repeat('x', 66000)));
    RAISE EXCEPTION 'Document write unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  ASSERT EXISTS (SELECT 1 FROM public.training_enrollments AS e
    WHERE id = dossier_id AND status = 'in_progress' AND e.completed_at IS NULL AND updated_at = previous_update);
  ASSERT (SELECT count(*) FROM public.training_documents WHERE enrollment_id = dossier_id AND status = 'missing') = 2;

  returned := public.complete_training_enrollment(dossier_id, staff_id, previous_update, completed_at, certificate);
  ASSERT returned.status = 'completed' AND returned.completed_at = completed_at;
  ASSERT EXISTS (SELECT 1 FROM public.training_documents
    WHERE id = '9e110000-0000-4000-8000-000000000007' AND status = 'ready' AND content_snapshot = certificate);
  ASSERT EXISTS (SELECT 1 FROM public.training_documents
    WHERE id = '9e110000-0000-4000-8000-000000000008' AND status = 'ready'
      AND content_snapshot->>'bookingRequestId' = booking_id::text);
  SELECT jsonb_agg(to_jsonb(d) ORDER BY id) INTO first_documents FROM public.training_documents d WHERE enrollment_id = dossier_id;

  returned := public.complete_training_enrollment(dossier_id, staff_id, previous_update, completed_at + interval '10 seconds', '{}');
  ASSERT returned.completed_at = completed_at;
  ASSERT first_documents = (SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM public.training_documents d WHERE enrollment_id = dossier_id);

  -- Simulate a legacy partial closure with a previously issued certificate.
  UPDATE public.training_documents SET status = 'missing', generated_at = NULL
  WHERE id = '9e110000-0000-4000-8000-000000000008';
  returned := public.complete_training_enrollment(dossier_id, staff_id, completed_at, completed_at + interval '10 seconds', certificate);
  ASSERT returned.completed_at = completed_at;
  ASSERT first_documents->0 = (SELECT to_jsonb(d) FROM public.training_documents d
    WHERE id = '9e110000-0000-4000-8000-000000000007');
  ASSERT EXISTS (SELECT 1 FROM public.training_documents
    WHERE id = '9e110000-0000-4000-8000-000000000008' AND status = 'ready'
      AND content_snapshot->>'bookingRequestId' = booking_id::text);

  returned := public.complete_training_enrollment(legacy_id, staff_id, previous_update, completed_at,
    jsonb_build_object('completion', jsonb_build_object('completedAt', now() - interval '4 hours')));
  ASSERT returned.completed_at = now() - interval '4 hours';
  ASSERT (SELECT count(*) FROM public.training_documents WHERE enrollment_id = legacy_id
    AND document_type = 'completion_certificate' AND status = 'ready') = 1;
  ASSERT NOT EXISTS (SELECT 1 FROM public.training_documents WHERE enrollment_id = legacy_id
    AND document_type = 'satisfaction_questionnaire');

  UPDATE public.training_enrollments SET status = 'archived', archived_at = now() WHERE id = dossier_id;
  BEGIN
    PERFORM public.complete_training_enrollment(dossier_id, staff_id, completed_at, completed_at, certificate);
    RAISE EXCEPTION 'Archived dossier unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'ENROLLMENT_COMPLETION_INVALID_STATUS';
  END;
END;
$$;

ROLLBACK;
