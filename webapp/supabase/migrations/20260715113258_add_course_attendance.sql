-- Émargement électronique des séances synchrones.
-- Les apprenants confirment leur présence au début de chaque séance depuis
-- leur compte authentifié. Le formateur valide ensuite la présence réelle.

CREATE TABLE public.course_session_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id uuid NOT NULL
    CONSTRAINT course_session_attendance_booking_fkey
    REFERENCES public.course_booking_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    CONSTRAINT course_session_attendance_user_fkey
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  session_starts_at timestamptz NOT NULL,
  session_ends_at timestamptz NOT NULL,
  delivery_mode text NOT NULL
    CONSTRAINT course_session_attendance_mode_check
    CHECK (delivery_mode IN ('remote', 'in_person')),
  meeting_url text,
  check_in_opened_at timestamptz,
  check_in_closed_at timestamptz,
  learner_confirmed_at timestamptz,
  learner_confirmation_version text,
  trainer_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT course_session_attendance_status_check
    CHECK (trainer_status IN ('pending', 'present', 'partial', 'absent', 'technical_issue')),
  actual_ends_at timestamptz,
  trainer_note text,
  trainer_validated_by uuid
    CONSTRAINT course_session_attendance_trainer_validated_by_fkey
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  trainer_validated_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT course_session_attendance_dates_check CHECK (session_ends_at > session_starts_at),
  CONSTRAINT course_session_attendance_meeting_url_check CHECK (
    meeting_url IS NULL OR (length(meeting_url) <= 1000 AND meeting_url ~ '^https://[^[:space:]]+$')
  ),
  CONSTRAINT course_session_attendance_note_check CHECK (
    trainer_note IS NULL OR length(trainer_note) <= 1500
  ),
  CONSTRAINT course_session_attendance_unique_session
    UNIQUE (booking_request_id, session_starts_at, session_ends_at)
);

CREATE TABLE public.course_attendance_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attendance_id uuid NOT NULL
    CONSTRAINT course_attendance_audit_attendance_fkey
    REFERENCES public.course_session_attendance(id) ON DELETE RESTRICT,
  booking_request_id uuid NOT NULL
    CONSTRAINT course_attendance_audit_booking_fkey
    REFERENCES public.course_booking_requests(id) ON DELETE RESTRICT,
  actor_id uuid
    CONSTRAINT course_attendance_audit_actor_fkey
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_type text NOT NULL
    CONSTRAINT course_attendance_audit_event_check
    CHECK (event_type IN (
      'learner_confirmed', 'meeting_url_saved', 'check_in_opened',
      'check_in_closed', 'trainer_validated', 'trainer_corrected'
    )),
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX course_session_attendance_user_start_idx
  ON public.course_session_attendance (user_id, session_starts_at);
CREATE INDEX course_session_attendance_booking_idx
  ON public.course_session_attendance (booking_request_id);
CREATE INDEX course_attendance_audit_booking_event_idx
  ON public.course_attendance_audit_log (booking_request_id, event_at);

ALTER TABLE public.course_session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_attendance_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.course_session_attendance FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.course_attendance_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_session_attendance TO authenticated;
GRANT SELECT ON public.course_attendance_audit_log TO authenticated;
GRANT ALL ON public.course_session_attendance, public.course_attendance_audit_log TO service_role;

CREATE POLICY "Lecture de ses émargements ou gestion pédagogique"
ON public.course_session_attendance FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (user_id = (SELECT auth.uid()) OR (SELECT private.is_admin()))
);

CREATE POLICY "Lecture administrative de l'historique des émargements"
ON public.course_attendance_audit_log FOR SELECT
TO authenticated
USING ((SELECT private.is_admin()));

CREATE OR REPLACE FUNCTION private.set_course_attendance_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_course_attendance_updated_at()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER course_session_attendance_set_updated_at
BEFORE UPDATE ON public.course_session_attendance
FOR EACH ROW EXECUTE FUNCTION private.set_course_attendance_updated_at();

CREATE OR REPLACE FUNCTION private.validate_attendance_session(
  p_booking_request_id uuid,
  p_session_starts_at timestamptz,
  p_session_ends_at timestamptz
)
RETURNS TABLE (
  validated_user_id uuid,
  validated_course_id text,
  validated_delivery_mode text,
  validated_schedule_format text,
  validated_booking_status text
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_booking public.course_booking_requests%ROWTYPE;
  v_prior_minutes integer;
  v_selected_minutes integer;
  v_selected_start timestamptz;
  v_selected_end timestamptz;
  v_is_contiguous boolean;
  v_format_valid boolean := false;
BEGIN
  IF p_session_starts_at IS NULL OR p_session_ends_at IS NULL
    OR p_session_ends_at <= p_session_starts_at THEN
    RAISE EXCEPTION 'Séance invalide.';
  END IF;

  SELECT * INTO v_booking
  FROM public.course_booking_requests
  WHERE id = p_booking_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable.';
  END IF;

  SELECT
    coalesce(sum(duration_minutes) FILTER (WHERE ends_at <= p_session_starts_at), 0)::integer,
    coalesce(sum(duration_minutes) FILTER (
      WHERE starts_at >= p_session_starts_at AND ends_at <= p_session_ends_at
    ), 0)::integer,
    min(starts_at) FILTER (
      WHERE starts_at >= p_session_starts_at AND ends_at <= p_session_ends_at
    ),
    max(ends_at) FILTER (
      WHERE starts_at >= p_session_starts_at AND ends_at <= p_session_ends_at
    )
  INTO v_prior_minutes, v_selected_minutes, v_selected_start, v_selected_end
  FROM public.course_session_bookings
  WHERE booking_request_id = p_booking_request_id;

  SELECT coalesce(bool_and(previous_end IS NULL OR previous_end = starts_at), false)
  INTO v_is_contiguous
  FROM (
    SELECT
      starts_at,
      lag(ends_at) OVER (ORDER BY starts_at, id) AS previous_end
    FROM public.course_session_bookings
    WHERE booking_request_id = p_booking_request_id
      AND starts_at >= p_session_starts_at
      AND ends_at <= p_session_ends_at
  ) AS ordered_session_slots;

  IF v_selected_minutes <= 0
    OR v_selected_start IS DISTINCT FROM p_session_starts_at
    OR v_selected_end IS DISTINCT FROM p_session_ends_at
    OR NOT v_is_contiguous
    OR extract(epoch FROM (p_session_ends_at - p_session_starts_at)) / 60 <> v_selected_minutes THEN
    RAISE EXCEPTION 'Les horaires ne correspondent pas à une séance réservée.';
  END IF;

  v_format_valid := CASE v_booking.schedule_format
    WHEN 'one_4h' THEN v_prior_minutes = 0 AND v_selected_minutes = 240
    WHEN 'two_2h' THEN v_prior_minutes IN (0, 120) AND v_selected_minutes = 120
    WHEN 'four_1h' THEN v_prior_minutes IN (0, 60, 120, 180) AND v_selected_minutes = 60
    WHEN 'two_3h30' THEN v_prior_minutes IN (0, 210) AND v_selected_minutes = 210
    WHEN 'one_day_7h' THEN
      (v_prior_minutes = 0 AND v_selected_minutes = 240)
      OR (v_prior_minutes = 240 AND v_selected_minutes = 180)
    ELSE false
  END;

  IF NOT v_format_valid THEN
    RAISE EXCEPTION 'Cette période ne correspond pas au rythme réservé.';
  END IF;

  RETURN QUERY SELECT
    v_booking.user_id,
    v_booking.course_id,
    v_booking.delivery_mode,
    v_booking.schedule_format,
    v_booking.status;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_attendance_session(uuid, timestamptz, timestamptz)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirm_course_attendance(
  p_booking_request_id uuid,
  p_session_starts_at timestamptz,
  p_session_ends_at timestamptz
)
RETURNS public.course_session_attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_session record;
  v_attendance public.course_session_attendance%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_automatic_window boolean;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session
  FROM private.validate_attendance_session(
    p_booking_request_id, p_session_starts_at, p_session_ends_at
  );

  IF v_session.validated_user_id <> v_actor_id THEN
    RAISE EXCEPTION 'Vous ne pouvez émarger que pour votre propre séance.' USING ERRCODE = '42501';
  END IF;

  IF v_session.validated_booking_status NOT IN ('confirmed', 'completed') THEN
    RAISE EXCEPTION 'La réservation doit être confirmée avant l’émargement.';
  END IF;

  SELECT * INTO v_attendance
  FROM public.course_session_attendance
  WHERE booking_request_id = p_booking_request_id
    AND session_starts_at = p_session_starts_at
    AND session_ends_at = p_session_ends_at
  FOR UPDATE;

  IF v_attendance.learner_confirmed_at IS NOT NULL THEN
    RETURN v_attendance;
  END IF;

  v_automatic_window :=
    v_now >= p_session_starts_at - interval '2 hours'
    AND v_now <= p_session_ends_at + interval '2 hours'
    AND (v_now AT TIME ZONE 'Europe/Paris')::date
      = (p_session_starts_at AT TIME ZONE 'Europe/Paris')::date;

  IF NOT v_automatic_window AND NOT (
    v_attendance.check_in_opened_at IS NOT NULL
    AND v_attendance.check_in_closed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'L’émargement ouvrira le jour de la séance ou lorsque le formateur l’ouvrira.';
  END IF;

  INSERT INTO public.course_session_attendance (
    booking_request_id, user_id, session_starts_at, session_ends_at, delivery_mode,
    learner_confirmed_at, learner_confirmation_version
  ) VALUES (
    p_booking_request_id, v_actor_id, p_session_starts_at, p_session_ends_at,
    v_session.validated_delivery_mode, v_now, 'confirmation-presence-v1-2026-07-15'
  )
  ON CONFLICT (booking_request_id, session_starts_at, session_ends_at)
  DO UPDATE SET
    learner_confirmed_at = EXCLUDED.learner_confirmed_at,
    learner_confirmation_version = EXCLUDED.learner_confirmation_version
  WHERE public.course_session_attendance.learner_confirmed_at IS NULL
  RETURNING * INTO v_attendance;

  INSERT INTO public.course_attendance_audit_log (
    attendance_id, booking_request_id, actor_id, event_type, event_details
  ) VALUES (
    v_attendance.id, p_booking_request_id, v_actor_id, 'learner_confirmed',
    jsonb_build_object(
      'confirmation_version', v_attendance.learner_confirmation_version,
      'session_starts_at', p_session_starts_at,
      'session_ends_at', p_session_ends_at
    )
  );

  RETURN v_attendance;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_course_attendance(uuid, timestamptz, timestamptz)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_course_attendance(uuid, timestamptz, timestamptz)
TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_manage_course_attendance(
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_session record;
  v_attendance public.course_session_attendance%ROWTYPE;
  v_previous_status text;
  v_clean_url text := nullif(trim(p_meeting_url), '');
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_actor_id IS NULL OR NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'Accès administrateur ou formateur requis.' USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('save_meeting_url', 'open_check_in', 'close_check_in', 'validate') THEN
    RAISE EXCEPTION 'Action d’émargement invalide.';
  END IF;

  SELECT * INTO v_session
  FROM private.validate_attendance_session(
    p_booking_request_id, p_session_starts_at, p_session_ends_at
  );

  INSERT INTO public.course_session_attendance (
    booking_request_id, user_id, session_starts_at, session_ends_at, delivery_mode
  ) VALUES (
    p_booking_request_id, v_session.validated_user_id,
    p_session_starts_at, p_session_ends_at, v_session.validated_delivery_mode
  )
  ON CONFLICT (booking_request_id, session_starts_at, session_ends_at)
  DO UPDATE SET delivery_mode = EXCLUDED.delivery_mode
  RETURNING * INTO v_attendance;

  v_previous_status := v_attendance.trainer_status;

  IF p_action = 'save_meeting_url' THEN
    IF v_session.validated_delivery_mode <> 'remote' THEN
      RAISE EXCEPTION 'Un lien de visioconférence ne concerne que les séances à distance.';
    END IF;
    IF v_clean_url IS NOT NULL AND (
      length(v_clean_url) > 1000 OR v_clean_url !~ '^https://[^[:space:]]+$'
    ) THEN
      RAISE EXCEPTION 'Le lien doit commencer par https:// et ne contenir aucun espace.';
    END IF;

    UPDATE public.course_session_attendance
    SET meeting_url = v_clean_url
    WHERE id = v_attendance.id
    RETURNING * INTO v_attendance;

    UPDATE public.course_session_bookings
    SET meeting_url = v_clean_url
    WHERE booking_request_id = p_booking_request_id
      AND starts_at >= p_session_starts_at
      AND ends_at <= p_session_ends_at;

    INSERT INTO public.course_attendance_audit_log (
      attendance_id, booking_request_id, actor_id, event_type, event_details
    ) VALUES (
      v_attendance.id, p_booking_request_id, v_actor_id, 'meeting_url_saved',
      jsonb_build_object('link_present', v_clean_url IS NOT NULL)
    );

  ELSIF p_action = 'open_check_in' THEN
    UPDATE public.course_session_attendance
    SET check_in_opened_at = v_now, check_in_closed_at = NULL
    WHERE id = v_attendance.id
    RETURNING * INTO v_attendance;

    INSERT INTO public.course_attendance_audit_log (
      attendance_id, booking_request_id, actor_id, event_type
    ) VALUES (v_attendance.id, p_booking_request_id, v_actor_id, 'check_in_opened');

  ELSIF p_action = 'close_check_in' THEN
    UPDATE public.course_session_attendance
    SET check_in_closed_at = v_now
    WHERE id = v_attendance.id
    RETURNING * INTO v_attendance;

    INSERT INTO public.course_attendance_audit_log (
      attendance_id, booking_request_id, actor_id, event_type
    ) VALUES (v_attendance.id, p_booking_request_id, v_actor_id, 'check_in_closed');

  ELSE
    IF p_trainer_status NOT IN ('present', 'partial', 'absent', 'technical_issue') THEN
      RAISE EXCEPTION 'Choisissez un état de présence valide.';
    END IF;
    IF p_trainer_note IS NOT NULL AND length(p_trainer_note) > 1500 THEN
      RAISE EXCEPTION 'La note est limitée à 1 500 caractères.';
    END IF;
    IF p_trainer_status = 'partial' AND (
      p_actual_ends_at IS NULL
      OR p_actual_ends_at <= p_session_starts_at
      OR p_actual_ends_at >= p_session_ends_at
    ) THEN
      RAISE EXCEPTION 'Indiquez l’heure réelle de départ, comprise dans la séance.';
    END IF;
    IF p_trainer_status = 'present' AND p_actual_ends_at IS NOT NULL
      AND p_actual_ends_at < p_session_ends_at THEN
      RAISE EXCEPTION 'Utilisez « départ anticipé » si la séance n’a pas été suivie jusqu’au bout.';
    END IF;

    UPDATE public.course_session_attendance
    SET
      trainer_status = p_trainer_status,
      actual_ends_at = CASE
        WHEN p_trainer_status = 'present' THEN coalesce(p_actual_ends_at, p_session_ends_at)
        WHEN p_trainer_status = 'absent' THEN NULL
        ELSE p_actual_ends_at
      END,
      trainer_note = nullif(trim(p_trainer_note), ''),
      trainer_validated_by = v_actor_id,
      trainer_validated_at = v_now,
      locked_at = v_now,
      check_in_closed_at = coalesce(check_in_closed_at, v_now)
    WHERE id = v_attendance.id
    RETURNING * INTO v_attendance;

    INSERT INTO public.course_attendance_audit_log (
      attendance_id, booking_request_id, actor_id, event_type, event_details
    ) VALUES (
      v_attendance.id,
      p_booking_request_id,
      v_actor_id,
      CASE WHEN v_previous_status = 'pending' THEN 'trainer_validated' ELSE 'trainer_corrected' END,
      jsonb_build_object(
        'previous_status', v_previous_status,
        'new_status', v_attendance.trainer_status,
        'actual_ends_at', v_attendance.actual_ends_at,
        'note_present', v_attendance.trainer_note IS NOT NULL
      )
    );
  END IF;

  RETURN v_attendance;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_manage_course_attendance(
  uuid, timestamptz, timestamptz, text, text, text, timestamptz, text
) TO authenticated;

COMMENT ON TABLE public.course_session_attendance IS
  'Preuves nominatives d’émargement électronique et validation formateur pour les séances synchrones.';
COMMENT ON TABLE public.course_attendance_audit_log IS
  'Historique append-only des confirmations, validations et corrections d’émargement.';
COMMENT ON COLUMN public.course_session_attendance.learner_confirmed_at IS
  'Horodatage serveur de la confirmation de présence depuis le compte authentifié de l’apprenant.';
COMMENT ON COLUMN public.course_session_attendance.trainer_note IS
  'Note pédagogique ou motif d’écart. Ne pas y stocker de donnée de santé non nécessaire.';
