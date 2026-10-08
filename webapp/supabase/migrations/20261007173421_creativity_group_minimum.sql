-- Permettre une confirmation à partir de deux participants pour les cohortes créativité.
-- La capacité reste limitée à 4..6 et le format à quatre demi-journées.
BEGIN;

ALTER TABLE public.course_cohorts
  DROP CONSTRAINT course_cohorts_creativity_group_limits;
ALTER TABLE public.course_cohorts
  ADD CONSTRAINT course_cohorts_creativity_group_limits CHECK (
    course_id <> 'ia-creativite-groupe'
    OR (schedule_format = 'four_half_days_3h30'
      AND minimum_participants BETWEEN 2 AND capacity
      AND capacity BETWEEN 4 AND 6)
  );

CREATE OR REPLACE FUNCTION public.admin_save_course_cohort(p_cohort_id uuid, p_course_id text, p_delivery_mode text, p_schedule_format text, p_capacity integer, p_minimum_participants integer, p_sessions jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_cohort_id uuid;
  v_session jsonb;
  v_position integer;
  v_session_slot_ids uuid[];
  v_old_slot_ids uuid[] := ARRAY[]::uuid[];
  v_all_slot_ids uuid[] := ARRAY[]::uuid[];
  v_session_dates date[] := ARRAY[]::date[];
  v_session_starts timestamptz[] := ARRAY[]::timestamptz[];
  v_session_ends timestamptz[] := ARRAY[]::timestamptz[];
  v_cohort_session_id uuid;
  v_slot_count integer;
  v_contiguous boolean;
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_current_date date;
BEGIN
  IF NOT private.is_strict_admin() THEN RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501'; END IF;
  IF p_course_id NOT IN (
    'excel-initiation-inter', 'excel-perfectionnement-inter', 'excel-avance-inter',
    'word-initiation-inter', 'word-perfectionnement-inter', 'powerpoint-initiation-inter', 'ia-creativite-groupe'
  ) OR p_delivery_mode NOT IN ('remote', 'in_person')
    OR p_schedule_format NOT IN ('four_half_days_3h30', 'two_days_2x3h30') THEN
    RAISE EXCEPTION 'Configuration de cohorte invalide.' USING ERRCODE = '22023';
  END IF;
  IF p_capacity IS NULL OR p_capacity <= 0 OR p_minimum_participants IS NULL
    OR p_minimum_participants <= 0 OR p_minimum_participants > p_capacity THEN
    RAISE EXCEPTION 'Capacité et seuil minimum explicites requis.' USING ERRCODE = '22023';
  END IF;
  IF p_course_id = 'ia-creativite-groupe' AND (p_schedule_format <> 'four_half_days_3h30' OR p_minimum_participants NOT BETWEEN 2 AND p_capacity OR p_capacity NOT BETWEEN 4 AND 6) THEN
    RAISE EXCEPTION 'Créativité : quatre demi-journées, seuil 2 à capacité, capacité 4 à 6.' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_sessions) <> 'array' OR jsonb_array_length(p_sessions) <> 4 THEN
    RAISE EXCEPTION 'Quatre demi-journées sont requises.' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(slot_id::uuid ORDER BY slot_id::uuid) INTO v_all_slot_ids
  FROM jsonb_array_elements(p_sessions) AS session(value)
  CROSS JOIN LATERAL jsonb_array_elements_text(session.value->'slot_ids') AS slots(slot_id);
  IF cardinality(v_all_slot_ids) <> 28
    OR (SELECT count(DISTINCT id) FROM unnest(v_all_slot_ids) AS selected(id)) <> 28 THEN
    RAISE EXCEPTION 'Vingt-huit demi-heures distinctes sont requises.' USING ERRCODE = '22023';
  END IF;

  PERFORM candidate.id
  FROM public.training_availability_slots AS candidate
  WHERE EXISTS (
    SELECT 1 FROM public.training_availability_slots AS selected
    WHERE selected.id = ANY(v_all_slot_ids)
      AND candidate.starts_at < selected.ends_at
      AND selected.starts_at < candidate.ends_at
  )
  ORDER BY candidate.id FOR UPDATE;

  IF p_cohort_id IS NULL THEN
    INSERT INTO public.course_cohorts (
      course_id, delivery_mode, schedule_format, capacity, minimum_participants, created_by
    ) VALUES (p_course_id, p_delivery_mode, p_schedule_format, p_capacity, p_minimum_participants, v_actor)
    RETURNING id INTO v_cohort_id;
  ELSE
    SELECT id INTO v_cohort_id FROM public.course_cohorts
    WHERE id = p_cohort_id AND status = 'draft' FOR UPDATE;
    IF v_cohort_id IS NULL THEN RAISE EXCEPTION 'Seul un brouillon peut être modifié.' USING ERRCODE = '22023'; END IF;
    SELECT coalesce(array_agg(links.availability_slot_id), ARRAY[]::uuid[]) INTO v_old_slot_ids
    FROM public.course_cohort_session_slots AS links
    JOIN public.course_cohort_sessions AS sessions ON sessions.id = links.cohort_session_id
    WHERE sessions.cohort_id = v_cohort_id;
    UPDATE public.course_cohorts SET
      course_id = p_course_id, delivery_mode = p_delivery_mode, schedule_format = p_schedule_format,
      capacity = p_capacity, minimum_participants = p_minimum_participants, updated_at = now()
    WHERE id = v_cohort_id;
  END IF;

  FOR v_session IN SELECT value FROM jsonb_array_elements(p_sessions) LOOP
    v_position := (v_session->>'position')::integer;
    IF v_position NOT BETWEEN 1 AND 4 OR v_session_dates[v_position] IS NOT NULL
      OR jsonb_typeof(v_session->'slot_ids') <> 'array' OR jsonb_array_length(v_session->'slot_ids') <> 7 THEN
      RAISE EXCEPTION 'Chaque demi-journée doit contenir sept demi-heures et une position unique.' USING ERRCODE = '22023';
    END IF;
    SELECT array_agg(value::uuid ORDER BY value::uuid) INTO v_session_slot_ids
    FROM jsonb_array_elements_text(v_session->'slot_ids');
    IF (SELECT count(DISTINCT id) FROM unnest(v_session_slot_ids) AS selected(id)) <> 7 THEN
      RAISE EXCEPTION 'Un créneau est répété dans une demi-journée.' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_slot_count FROM public.training_availability_slots AS slots
    WHERE slots.id = ANY(v_session_slot_ids) AND slots.is_active AND slots.starts_at > now()
      AND p_delivery_mode = ANY(slots.delivery_modes)
      AND extract(epoch FROM (slots.ends_at - slots.starts_at)) / 60 = 30
      AND (NOT slots.is_reserved OR slots.id = ANY(v_old_slot_ids))
      AND NOT EXISTS (
        SELECT 1 FROM public.calendar_bookings AS booking
        WHERE private.calendar_booking_overlaps(booking.date, booking.slot, slots.starts_at, slots.ends_at)
      );
    IF EXISTS (
      SELECT 1
      FROM public.training_availability_slots AS selected
      JOIN public.training_availability_slots AS occupied
        ON occupied.is_reserved
        AND NOT (occupied.id = ANY(v_old_slot_ids))
        AND occupied.id <> selected.id
        AND occupied.starts_at < selected.ends_at
        AND selected.starts_at < occupied.ends_at
      WHERE selected.id = ANY(v_session_slot_ids)
    ) THEN
      RAISE EXCEPTION 'Un autre créneau chevauchant est déjà réservé.' USING ERRCODE = '23P01';
    END IF;
    WITH ordered AS (
      SELECT starts_at, ends_at, lag(ends_at) OVER (ORDER BY starts_at, id) AS previous_end
      FROM public.training_availability_slots WHERE id = ANY(v_session_slot_ids)
    )
    SELECT count(*) = 7 AND bool_and(previous_end IS NULL OR previous_end = starts_at),
      min(starts_at), max(ends_at), (min(starts_at) AT TIME ZONE 'Europe/Paris')::date
    INTO v_contiguous, v_current_start, v_current_end, v_current_date
    FROM ordered;
    IF v_slot_count <> 7 OR NOT coalesce(v_contiguous, false) THEN
      RAISE EXCEPTION 'Chaque demi-journée doit former exactement 7 demi-heures contiguës.' USING ERRCODE = '22023';
    END IF;
    v_session_starts[v_position] := v_current_start;
    v_session_ends[v_position] := v_current_end;
    v_session_dates[v_position] := v_current_date;
  END LOOP;
  IF EXISTS (SELECT 1 FROM generate_series(2, 4) AS n WHERE v_session_starts[n] <= v_session_starts[n - 1]) THEN
    RAISE EXCEPTION 'Les demi-journées doivent être ordonnées chronologiquement.' USING ERRCODE = '22023';
  END IF;
  IF p_schedule_format = 'four_half_days_3h30'
    AND (SELECT count(DISTINCT value) FROM unnest(v_session_dates) AS dates(value)) <> 4 THEN
    RAISE EXCEPTION 'Quatre dates distinctes sont requises.' USING ERRCODE = '22023';
  END IF;
  IF p_schedule_format = 'two_days_2x3h30' AND (
    (SELECT count(DISTINCT value) FROM unnest(v_session_dates) AS dates(value)) <> 2
    OR v_session_dates[1] <> v_session_dates[2]
    OR v_session_dates[3] <> v_session_dates[4]
    OR v_session_dates[1] = v_session_dates[3]
    OR v_session_starts[2] <= v_session_ends[1]
    OR v_session_starts[4] <= v_session_ends[3]
  ) THEN RAISE EXCEPTION 'Deux journées de deux demi-journées séparées par une pause sont requises.' USING ERRCODE = '22023'; END IF;

  UPDATE public.training_availability_slots SET is_reserved = false
  WHERE id = ANY(v_old_slot_ids) AND NOT (id = ANY(v_all_slot_ids));
  DELETE FROM public.course_cohort_sessions WHERE cohort_id = v_cohort_id;
  FOR v_position IN 1..4 LOOP
    INSERT INTO public.course_cohort_sessions (cohort_id, position, starts_at, ends_at, duration_minutes)
    VALUES (v_cohort_id, v_position, v_session_starts[v_position], v_session_ends[v_position], 210)
    RETURNING id INTO v_cohort_session_id;
    SELECT array_agg(slot_id::uuid) INTO v_session_slot_ids
    FROM jsonb_array_elements(p_sessions) AS session(value)
    CROSS JOIN LATERAL jsonb_array_elements_text(session.value->'slot_ids') AS slots(slot_id)
    WHERE (session.value->>'position')::integer = v_position;
    INSERT INTO public.course_cohort_session_slots (cohort_session_id, availability_slot_id)
    SELECT v_cohort_session_id, id FROM unnest(v_session_slot_ids) AS selected(id);
  END LOOP;
  UPDATE public.training_availability_slots SET is_reserved = true WHERE id = ANY(v_all_slot_ids);
  RETURN v_cohort_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_creativity_cohort_minimum(
  p_cohort_id uuid, p_minimum_participants integer
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_cohort public.course_cohorts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_strict_admin() THEN
    RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_cohort FROM public.course_cohorts WHERE id = p_cohort_id FOR UPDATE;
  IF v_cohort.id IS NULL OR v_cohort.course_id <> 'ia-creativite-groupe'
    OR v_cohort.status NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'Seuil modifiable uniquement sur un groupe créativité en brouillon ou publié.' USING ERRCODE = '22023';
  END IF;
  IF p_minimum_participants IS NULL OR p_minimum_participants NOT BETWEEN 2 AND v_cohort.capacity THEN
    RAISE EXCEPTION 'Le seuil doit être compris entre 2 et la capacité.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.course_cohorts SET minimum_participants = p_minimum_participants, updated_at = now()
  WHERE id = p_cohort_id;
  RETURN p_cohort_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_set_creativity_cohort_minimum(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_creativity_cohort_minimum(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_available_creativity_group_cohorts(p_course_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_result jsonb;
BEGIN
  IF p_course_id IS DISTINCT FROM 'ia-creativite-groupe' THEN
    RAISE EXCEPTION 'Formation créativité requise.' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(available) || jsonb_build_object(
    'minimum_participants', cohorts.minimum_participants
  ) ORDER BY (SELECT min(s.starts_at) FROM public.course_cohort_sessions AS s WHERE s.cohort_id = available.id), available.id), '[]'::jsonb)
  INTO v_result
  FROM public.list_available_course_cohorts(p_course_id) AS available
  JOIN public.course_cohorts AS cohorts ON cohorts.id = available.id;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.list_available_creativity_group_cohorts(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_available_creativity_group_cohorts(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_course_cohort_enrollment(p_course_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_user uuid := (SELECT auth.uid()); v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'id', e.id, 'cohort_id', e.cohort_id, 'course_id', e.course_id, 'status', e.status, 'joined_at', e.joined_at,
    'is_paid', e.purchase_id IS NOT NULL, 'cohort_status', c.status, 'delivery_mode', c.delivery_mode, 'schedule_format', c.schedule_format,
    'minimum_participants', c.minimum_participants, 'capacity', c.capacity,
    'sessions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'position', s.position, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'duration_minutes', s.duration_minutes, 'meeting_url', CASE WHEN c.course_id <> 'ia-creativite-groupe' OR (c.status='confirmed' AND private.creativity_cohort_enrollment_is_eligible(e.id)) THEN s.meeting_url ELSE NULL END
    ) ORDER BY s.position), '[]'::jsonb) FROM public.course_cohort_sessions s WHERE s.cohort_id = c.id)
  ) INTO v_result
  FROM public.course_cohort_enrollments e
  JOIN public.course_cohorts c ON c.id = e.cohort_id
  JOIN public.course_access AS access
    ON access.id = e.course_access_id
    AND access.user_id = e.user_id
    AND access.course_id = e.course_id
    AND ((access.status = 'active' AND (access.expires_at IS NULL OR access.expires_at > now())) OR (e.course_id='ia-creativite-groupe' AND e.status='cohort_cancelled_refund_review'))
  WHERE e.user_id = v_user AND e.course_id = p_course_id AND (e.status IN ('active', 'completed') OR (e.course_id='ia-creativite-groupe' AND e.status='cohort_cancelled_refund_review'))
    AND (e.course_id <> 'ia-creativite-groupe' OR e.status='cohort_cancelled_refund_review' OR private.creativity_cohort_enrollment_is_eligible(e.id))
  ORDER BY e.joined_at DESC LIMIT 1;
  RETURN v_result;
END;
$function$;

COMMIT;
