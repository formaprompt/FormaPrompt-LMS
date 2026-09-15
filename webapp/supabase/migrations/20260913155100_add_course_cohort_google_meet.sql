BEGIN;

ALTER TABLE public.course_cohort_sessions
  ADD COLUMN google_calendar_id text,
  ADD COLUMN google_event_id text,
  ADD COLUMN google_sync_status text NOT NULL DEFAULT 'not_requested'
    CHECK (google_sync_status IN (
      'not_requested', 'manual', 'creating', 'pending', 'created', 'error',
      'delete_pending', 'deleting', 'delete_error', 'deleted'
    )),
  ADD COLUMN google_sync_error_code text,
  ADD COLUMN google_claim_token uuid,
  ADD COLUMN google_claim_expires_at timestamptz,
  ADD COLUMN google_conference_attempt integer NOT NULL DEFAULT 0
    CHECK (google_conference_attempt BETWEEN 0 AND 20),
  ADD CONSTRAINT course_cohort_sessions_google_identity_complete CHECK (
    (google_calendar_id IS NULL AND google_event_id IS NULL)
    OR (google_calendar_id IS NOT NULL AND google_event_id IS NOT NULL)
  );

UPDATE public.course_cohort_sessions
SET google_sync_status = 'manual'
WHERE meeting_url IS NOT NULL;

CREATE UNIQUE INDEX course_cohort_sessions_google_event_idx
  ON public.course_cohort_sessions (google_calendar_id, google_event_id)
  WHERE google_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_claim_course_cohort_meet_sessions(
  p_cohort_id uuid,
  p_calendar_id text,
  p_claim_token uuid,
  p_session_events jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cohort public.course_cohorts%ROWTYPE;
  v_session public.course_cohort_sessions%ROWTYPE;
  v_event_id text;
  v_claimed boolean;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF NOT private.is_strict_admin() THEN
    RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501';
  END IF;
  IF p_claim_token IS NULL
    OR char_length(btrim(coalesce(p_calendar_id, ''))) NOT BETWEEN 3 AND 1024
    OR jsonb_typeof(p_session_events) <> 'array' THEN
    RAISE EXCEPTION 'Demande Google Meet invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT cohorts.* INTO v_cohort
  FROM public.course_cohorts AS cohorts
  WHERE cohorts.id = p_cohort_id
  FOR UPDATE;
  IF v_cohort.id IS NULL OR v_cohort.delivery_mode <> 'remote'
    OR v_cohort.status NOT IN ('published', 'confirmed') THEN
    RAISE EXCEPTION 'Publiez la cohorte distante avant de générer ses liens Google Meet.' USING ERRCODE = '22023';
  END IF;

  FOR v_session IN
    SELECT sessions.*
    FROM public.course_cohort_sessions AS sessions
    WHERE sessions.cohort_id = p_cohort_id
    ORDER BY sessions.position
    FOR UPDATE
  LOOP
    v_claimed := false;
    v_event_id := v_session.google_event_id;

    IF v_session.meeting_url IS NULL THEN
      IF v_event_id IS NULL THEN
        SELECT event_item.value ->> 'event_id' INTO v_event_id
        FROM jsonb_array_elements(p_session_events) AS event_item(value)
        WHERE event_item.value ->> 'session_id' = v_session.id::text
        LIMIT 1;
        IF v_event_id IS NULL OR v_event_id !~ '^[0-9a-f]{40}$' THEN
          RAISE EXCEPTION 'Identifiant d événement Google invalide.' USING ERRCODE = '22023';
        END IF;
      ELSIF v_session.google_calendar_id <> btrim(p_calendar_id) THEN
        RAISE EXCEPTION 'Cette séance est déjà liée à un autre agenda Google.' USING ERRCODE = '22023';
      END IF;

      IF v_session.google_claim_token IS NULL
        OR v_session.google_claim_expires_at IS NULL
        OR v_session.google_claim_expires_at <= now()
        OR v_session.google_claim_token = p_claim_token THEN
        UPDATE public.course_cohort_sessions AS sessions
        SET google_calendar_id = btrim(p_calendar_id),
          google_event_id = v_event_id,
          google_sync_status = 'creating',
          google_sync_error_code = NULL,
          google_claim_token = p_claim_token,
          google_claim_expires_at = now() + interval '10 minutes',
          updated_at = now()
        WHERE sessions.id = v_session.id;
        v_claimed := true;
      END IF;
    END IF;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'session_id', v_session.id,
      'position', v_session.position,
      'starts_at', v_session.starts_at,
      'ends_at', v_session.ends_at,
      'meeting_url', v_session.meeting_url,
      'google_calendar_id', coalesce(v_session.google_calendar_id, btrim(p_calendar_id)),
      'google_event_id', v_event_id,
      'google_sync_status', CASE
        WHEN v_session.meeting_url IS NOT NULL THEN coalesce(v_session.google_sync_status, 'manual')
        WHEN v_claimed THEN 'creating'
        ELSE v_session.google_sync_status
      END,
      'google_conference_attempt', v_session.google_conference_attempt,
      'claim_acquired', v_claimed
    ));
  END LOOP;

  IF jsonb_array_length(v_results) <> 4 THEN
    RAISE EXCEPTION 'La cohorte doit contenir exactement quatre séances.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('cohort_id', p_cohort_id, 'course_id', v_cohort.course_id, 'sessions', v_results);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_finalize_course_cohort_meet_session(
  p_session_id uuid,
  p_claim_token uuid,
  p_sync_status text,
  p_meeting_url text,
  p_conference_attempt integer,
  p_error_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.course_cohort_sessions%ROWTYPE;
  v_cohort_id uuid;
  v_cohort_status text;
BEGIN
  IF NOT private.is_strict_admin() THEN
    RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p_sync_status NOT IN ('pending', 'created', 'error'), true)
    OR coalesce(p_conference_attempt NOT BETWEEN 0 AND 20, true)
    OR (p_sync_status = 'created' AND coalesce(btrim(p_meeting_url), '') !~ '^https://meet[.]google[.]com/[A-Za-z0-9-]+$')
    OR (p_sync_status <> 'created' AND p_meeting_url IS NOT NULL) THEN
    RAISE EXCEPTION 'Résultat Google Meet invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT sessions.cohort_id INTO v_cohort_id
  FROM public.course_cohort_sessions AS sessions
  WHERE sessions.id = p_session_id;
  SELECT cohorts.status INTO v_cohort_status
  FROM public.course_cohorts AS cohorts
  WHERE cohorts.id = v_cohort_id
  FOR UPDATE;
  SELECT sessions.* INTO v_session
  FROM public.course_cohort_sessions AS sessions
  WHERE sessions.id = p_session_id
  FOR UPDATE;
  IF v_session.id IS NULL OR v_session.google_claim_token IS DISTINCT FROM p_claim_token THEN
    RAISE EXCEPTION 'La génération Google Meet a expiré.' USING ERRCODE = '40001';
  END IF;

  IF v_cohort_status = 'cancelled' THEN
    UPDATE public.course_cohort_sessions AS sessions
    SET meeting_url = NULL,
      google_sync_status = 'delete_pending',
      google_sync_error_code = 'cohort_cancelled_during_generation',
      google_claim_token = NULL,
      google_claim_expires_at = NULL,
      google_conference_attempt = p_conference_attempt,
      updated_at = now()
    WHERE sessions.id = p_session_id;
    RETURN jsonb_build_object('accepted', false, 'cleanup_required', true);
  END IF;
  IF v_cohort_status NOT IN ('published', 'confirmed') THEN
    RAISE EXCEPTION 'La cohorte ne permet plus cette génération.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.course_cohort_sessions AS sessions
  SET meeting_url = CASE WHEN p_sync_status = 'created' THEN btrim(p_meeting_url) ELSE NULL END,
    google_sync_status = p_sync_status,
    google_sync_error_code = CASE WHEN p_sync_status = 'error' THEN left(coalesce(p_error_code, 'google_sync_failed'), 100) ELSE NULL END,
    google_claim_token = NULL,
    google_claim_expires_at = NULL,
    google_conference_attempt = p_conference_attempt,
    updated_at = now()
  WHERE sessions.id = p_session_id;
  RETURN jsonb_build_object('accepted', true, 'cleanup_required', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_claim_course_cohort_meet_cleanup(
  p_cohort_id uuid,
  p_claim_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cohort public.course_cohorts%ROWTYPE;
  v_session public.course_cohort_sessions%ROWTYPE;
  v_claimed boolean;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF NOT private.is_strict_admin() THEN
    RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501';
  END IF;
  SELECT cohorts.* INTO v_cohort
  FROM public.course_cohorts AS cohorts
  WHERE cohorts.id = p_cohort_id
  FOR UPDATE;
  IF v_cohort.id IS NULL OR v_cohort.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Seule une cohorte annulée peut nettoyer ses événements Google.' USING ERRCODE = '22023';
  END IF;

  FOR v_session IN
    SELECT sessions.*
    FROM public.course_cohort_sessions AS sessions
    WHERE sessions.cohort_id = p_cohort_id
      AND sessions.google_event_id IS NOT NULL
    ORDER BY sessions.position
    FOR UPDATE
  LOOP
    v_claimed := false;
    IF v_session.google_sync_status <> 'deleted'
      AND (v_session.google_claim_token IS NULL
        OR v_session.google_claim_expires_at IS NULL
        OR v_session.google_claim_expires_at <= now()
        OR v_session.google_claim_token = p_claim_token) THEN
      UPDATE public.course_cohort_sessions AS sessions
      SET google_sync_status = 'deleting',
        google_claim_token = p_claim_token,
        google_claim_expires_at = now() + interval '10 minutes',
        updated_at = now()
      WHERE sessions.id = v_session.id;
      v_claimed := true;
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'session_id', v_session.id,
      'position', v_session.position,
      'google_calendar_id', v_session.google_calendar_id,
      'google_event_id', v_session.google_event_id,
      'google_sync_status', CASE WHEN v_claimed THEN 'deleting' ELSE v_session.google_sync_status END,
      'claim_acquired', v_claimed
    ));
  END LOOP;
  RETURN jsonb_build_object('cohort_id', p_cohort_id, 'sessions', v_results);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_finalize_course_cohort_meet_cleanup(
  p_session_id uuid,
  p_claim_token uuid,
  p_deleted boolean,
  p_error_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result uuid;
BEGIN
  IF NOT private.is_strict_admin() THEN
    RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.course_cohort_sessions AS sessions
  SET meeting_url = NULL,
    google_sync_status = CASE WHEN p_deleted THEN 'deleted' ELSE 'delete_error' END,
    google_sync_error_code = CASE WHEN p_deleted THEN NULL ELSE left(coalesce(p_error_code, 'google_delete_failed'), 100) END,
    google_claim_token = NULL,
    google_claim_expires_at = NULL,
    updated_at = now()
  FROM public.course_cohorts AS cohorts
  WHERE sessions.id = p_session_id
    AND sessions.cohort_id = cohorts.id
    AND cohorts.status = 'cancelled'
    AND sessions.google_claim_token = p_claim_token
  RETURNING sessions.id INTO v_result;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Le nettoyage Google Meet a expiré.' USING ERRCODE = '40001';
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_course_cohort(p_cohort_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result uuid;
BEGIN
  IF NOT private.is_strict_admin() THEN RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501'; END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Motif d annulation requis.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.course_cohorts AS cohorts SET status = 'cancelled', cancellation_reason = btrim(p_reason),
    cancelled_at = now(), updated_at = now()
  WHERE cohorts.id = p_cohort_id AND cohorts.status NOT IN ('cancelled', 'completed') RETURNING cohorts.id INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Cohorte non annulable.' USING ERRCODE = '22023'; END IF;
  UPDATE public.course_cohort_enrollments AS enrollments SET status = 'cohort_cancelled_refund_review',
    cancelled_at = now(), updated_at = now()
  WHERE enrollments.cohort_id = p_cohort_id AND enrollments.status = 'active';
  UPDATE public.training_availability_slots AS slots SET is_reserved = false
  WHERE slots.id IN (
    SELECT links.availability_slot_id FROM public.course_cohort_session_slots AS links
    JOIN public.course_cohort_sessions AS sessions ON sessions.id = links.cohort_session_id
    WHERE sessions.cohort_id = p_cohort_id
  ) AND slots.starts_at > now();
  DELETE FROM public.course_cohort_session_slots AS links
  USING public.course_cohort_sessions AS sessions
  WHERE links.cohort_session_id = sessions.id
    AND sessions.cohort_id = p_cohort_id
    AND sessions.starts_at > now();
  UPDATE public.course_cohort_sessions AS sessions
  SET meeting_url = NULL,
    google_sync_status = CASE WHEN sessions.google_event_id IS NULL THEN 'not_requested' ELSE 'delete_pending' END,
    google_sync_error_code = NULL,
    google_claim_token = CASE WHEN sessions.google_event_id IS NULL THEN NULL ELSE sessions.google_claim_token END,
    google_claim_expires_at = CASE WHEN sessions.google_event_id IS NULL THEN NULL ELSE sessions.google_claim_expires_at END,
    updated_at = now()
  WHERE sessions.cohort_id = p_cohort_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_course_cohort_meeting_url(
  p_cohort_id uuid, p_session_id uuid, p_meeting_url text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result uuid;
BEGIN
  IF NOT private.is_strict_admin() THEN RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501'; END IF;
  IF p_meeting_url IS NOT NULL AND (
    char_length(btrim(p_meeting_url)) > 2048 OR btrim(p_meeting_url) !~ '^https://'
  ) THEN RAISE EXCEPTION 'Lien de réunion HTTPS invalide.' USING ERRCODE = '22023'; END IF;
  UPDATE public.course_cohort_sessions AS sessions
  SET meeting_url = nullif(btrim(p_meeting_url), ''),
    google_sync_status = CASE WHEN nullif(btrim(p_meeting_url), '') IS NULL THEN 'not_requested' ELSE 'manual' END,
    google_sync_error_code = NULL,
    google_claim_token = NULL,
    google_claim_expires_at = NULL,
    updated_at = now()
  FROM public.course_cohorts AS cohorts
  WHERE sessions.id = p_session_id AND sessions.cohort_id = p_cohort_id
    AND cohorts.id = sessions.cohort_id
    AND cohorts.delivery_mode = 'remote'
    AND cohorts.status IN ('draft', 'published', 'confirmed')
    AND sessions.google_event_id IS NULL
  RETURNING sessions.id INTO v_result;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Ce lien est géré automatiquement par Google Meet ou la séance n est pas modifiable.' USING ERRCODE = '22023';
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_course_cohorts()
RETURNS TABLE (
  id uuid, course_id text, delivery_mode text, schedule_format text, status text,
  capacity integer, minimum_participants integer, enrolled_count bigint, sessions jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_strict_admin() THEN RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT cohorts.id, cohorts.course_id, cohorts.delivery_mode, cohorts.schedule_format,
    cohorts.status, cohorts.capacity, cohorts.minimum_participants,
    (SELECT count(*) FROM public.course_cohort_enrollments AS enrollments WHERE enrollments.cohort_id = cohorts.id AND enrollments.status = 'active'),
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', sessions.id, 'position', sessions.position, 'starts_at', sessions.starts_at, 'ends_at', sessions.ends_at,
      'duration_minutes', sessions.duration_minutes, 'meeting_url', sessions.meeting_url,
      'google_sync_status', sessions.google_sync_status,
      'google_sync_error_code', sessions.google_sync_error_code,
      'slot_ids', (
        SELECT coalesce(jsonb_agg(links.availability_slot_id ORDER BY slots.starts_at, links.availability_slot_id), '[]'::jsonb)
        FROM public.course_cohort_session_slots AS links
        JOIN public.training_availability_slots AS slots ON slots.id = links.availability_slot_id
        WHERE links.cohort_session_id = sessions.id
      )
    ) ORDER BY sessions.position), '[]'::jsonb)
      FROM public.course_cohort_sessions AS sessions WHERE sessions.cohort_id = cohorts.id)
  FROM public.course_cohorts AS cohorts ORDER BY cohorts.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_claim_course_cohort_meet_sessions(uuid, text, uuid, jsonb),
  public.admin_finalize_course_cohort_meet_session(uuid, uuid, text, text, integer, text),
  public.admin_claim_course_cohort_meet_cleanup(uuid, uuid),
  public.admin_finalize_course_cohort_meet_cleanup(uuid, uuid, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_claim_course_cohort_meet_sessions(uuid, text, uuid, jsonb),
  public.admin_finalize_course_cohort_meet_session(uuid, uuid, text, text, integer, text),
  public.admin_claim_course_cohort_meet_cleanup(uuid, uuid),
  public.admin_finalize_course_cohort_meet_cleanup(uuid, uuid, boolean, text)
  TO authenticated;

COMMIT;
