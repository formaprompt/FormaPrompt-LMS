-- Place les fonctions privilégiées hors du schéma exposé par l'API.
-- Les fonctions publiques deviennent de simples façades SECURITY INVOKER.

ALTER FUNCTION public.confirm_course_attendance(uuid, timestamptz, timestamptz)
SET SCHEMA private;

REVOKE ALL ON FUNCTION private.confirm_course_attendance(uuid, timestamptz, timestamptz)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.confirm_course_attendance(uuid, timestamptz, timestamptz)
TO authenticated;

CREATE FUNCTION public.confirm_course_attendance(
  p_booking_request_id uuid,
  p_session_starts_at timestamptz,
  p_session_ends_at timestamptz
)
RETURNS public.course_session_attendance
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.confirm_course_attendance(
    p_booking_request_id, p_session_starts_at, p_session_ends_at
  );
$$;

REVOKE ALL ON FUNCTION public.confirm_course_attendance(uuid, timestamptz, timestamptz)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_course_attendance(uuid, timestamptz, timestamptz)
TO authenticated;

ALTER FUNCTION public.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text
) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text
) TO authenticated;

CREATE FUNCTION public.admin_manage_course_attendance(
  p_booking_request_id uuid,
  p_session_starts_at timestamptz,
  p_session_ends_at timestamptz,
  p_action text,
  p_meeting_url text DEFAULT NULL,
  p_trainer_status text DEFAULT NULL,
  p_actual_ends_at timestamptz DEFAULT NULL,
  p_trainer_note text DEFAULT NULL
)
RETURNS public.course_session_attendance
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_manage_course_attendance(
    p_booking_request_id,
    p_session_starts_at,
    p_session_ends_at,
    p_action,
    p_meeting_url,
    p_trainer_status,
    p_actual_ends_at,
    p_trainer_note
  );
$$;

REVOKE ALL ON FUNCTION public.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text
) TO authenticated;

CREATE INDEX course_attendance_audit_attendance_idx
  ON public.course_attendance_audit_log (attendance_id);
CREATE INDEX course_attendance_audit_actor_idx
  ON public.course_attendance_audit_log (actor_id)
  WHERE actor_id IS NOT NULL;
CREATE INDEX course_session_attendance_trainer_idx
  ON public.course_session_attendance (trainer_validated_by)
  WHERE trainer_validated_by IS NOT NULL;
