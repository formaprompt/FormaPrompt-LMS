-- Réservation bureautique 14 h : individuel sur créneaux exclusifs et inter en cohortes partagées.
-- Migration additive, sans création de cohorte, créneau, droit, achat, paiement ou email.
BEGIN;

ALTER TABLE public.course_booking_requests
  DROP CONSTRAINT IF EXISTS course_booking_requests_course_id_check;
ALTER TABLE public.course_booking_requests
  ADD CONSTRAINT course_booking_requests_course_id_check CHECK (course_id IN (
    'formation-ia', 'formation-ia-act', 'formation-prompt-level-1',
    'excel-initiation-individuel', 'excel-perfectionnement-individuel', 'excel-avance-individuel',
    'word-initiation-individuel', 'word-perfectionnement-individuel', 'powerpoint-initiation-individuel'
  ));

ALTER TABLE public.course_booking_requests
  DROP CONSTRAINT IF EXISTS course_booking_requests_schedule_format_check;
ALTER TABLE public.course_booking_requests
  ADD CONSTRAINT course_booking_requests_schedule_format_check CHECK (schedule_format IN (
    'one_4h', 'two_2h', 'four_1h', 'one_day_7h', 'two_3h30',
    'two_5h', 'four_2h30', 'three_4h_4h_2h',
    'four_half_days_3h30', 'two_days_2x3h30'
  ));

ALTER TABLE public.course_booking_requests
  DROP CONSTRAINT IF EXISTS course_booking_requests_mode_format_check;
ALTER TABLE public.course_booking_requests
  ADD CONSTRAINT course_booking_requests_mode_format_check CHECK (
    (course_id = 'formation-ia' AND (
      (schedule_format = 'two_5h' AND delivery_mode = 'in_person')
      OR (schedule_format IN ('four_2h30', 'three_4h_4h_2h') AND delivery_mode = 'remote')
    ))
    OR (course_id = 'formation-ia-act' AND (
      schedule_format IN ('one_4h', 'two_2h')
      OR (schedule_format = 'four_1h' AND delivery_mode = 'remote')
    ))
    OR (course_id = 'formation-prompt-level-1' AND (
      schedule_format = 'two_3h30'
      OR (schedule_format = 'one_day_7h' AND delivery_mode = 'in_person')
    ))
    OR (course_id IN (
      'excel-initiation-individuel', 'excel-perfectionnement-individuel', 'excel-avance-individuel',
      'word-initiation-individuel', 'word-perfectionnement-individuel', 'powerpoint-initiation-individuel'
    ) AND schedule_format IN ('four_half_days_3h30', 'two_days_2x3h30'))
  );

ALTER TABLE public.training_availability_slots
  ADD CONSTRAINT training_availability_slots_reserved_no_overlap
  EXCLUDE USING gist (
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (is_reserved)
  DEFERRABLE INITIALLY IMMEDIATE;

DROP POLICY IF EXISTS "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots;
CREATE POLICY "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
  OR (
    is_active AND NOT is_reserved AND starts_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.calendar_bookings AS booking
      WHERE private.calendar_booking_overlaps(
        booking.date, booking.slot,
        training_availability_slots.starts_at,
        training_availability_slots.ends_at
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.course_access
      WHERE course_access.user_id = (SELECT auth.uid())
        AND course_access.course_id IN (
          'formation-ia', 'formation-ia-act', 'formation-prompt-level-1',
          'excel-initiation-individuel', 'excel-perfectionnement-individuel', 'excel-avance-individuel',
          'word-initiation-individuel', 'word-perfectionnement-individuel', 'powerpoint-initiation-individuel'
        )
        AND course_access.status = 'active'
        AND (course_access.expires_at IS NULL OR course_access.expires_at > now())
    )
  )
);

CREATE TABLE public.course_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL CHECK (course_id IN (
    'excel-initiation-inter', 'excel-perfectionnement-inter', 'excel-avance-inter',
    'word-initiation-inter', 'word-perfectionnement-inter', 'powerpoint-initiation-inter'
  )),
  modality text NOT NULL DEFAULT 'inter' CHECK (modality = 'inter'),
  delivery_mode text NOT NULL CHECK (delivery_mode IN ('remote', 'in_person')),
  schedule_format text NOT NULL CHECK (schedule_format IN ('four_half_days_3h30', 'two_days_2x3h30')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'confirmed', 'cancelled', 'completed')),
  capacity integer NOT NULL CHECK (capacity > 0),
  minimum_participants integer NOT NULL CHECK (minimum_participants > 0 AND minimum_participants <= capacity),
  published_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text CHECK (cancellation_reason IS NULL OR char_length(btrim(cancellation_reason)) BETWEEN 10 AND 500),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.course_cohort_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.course_cohorts(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 4),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes = 210),
  meeting_url text CHECK (
    meeting_url IS NULL OR (
      char_length(meeting_url) <= 2048
      AND meeting_url ~ '^https://'
    )
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, position),
  CHECK (ends_at > starts_at)
);

CREATE TABLE public.course_cohort_session_slots (
  cohort_session_id uuid NOT NULL REFERENCES public.course_cohort_sessions(id) ON DELETE CASCADE,
  availability_slot_id uuid NOT NULL REFERENCES public.training_availability_slots(id) ON DELETE RESTRICT,
  PRIMARY KEY (cohort_session_id, availability_slot_id),
  UNIQUE (availability_slot_id)
);

CREATE TABLE public.course_cohort_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.course_cohorts(id) ON DELETE RESTRICT,
  course_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  course_access_id uuid NOT NULL REFERENCES public.course_access(id) ON DELETE RESTRICT,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE RESTRICT,
  modality text NOT NULL DEFAULT 'inter' CHECK (modality = 'inter'),
  status text NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'cancelled', 'cohort_cancelled_refund_review', 'completed')
  ),
  joined_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, user_id)
);

CREATE UNIQUE INDEX course_cohort_enrollments_active_course_idx
  ON public.course_cohort_enrollments (user_id, course_id)
  WHERE status = 'active';
CREATE INDEX course_cohorts_catalog_idx
  ON public.course_cohorts (course_id, status, published_at);
CREATE INDEX course_cohort_sessions_start_idx
  ON public.course_cohort_sessions (cohort_id, starts_at);

ALTER TABLE public.course_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_cohorts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.course_cohort_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_cohort_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.course_cohort_session_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_cohort_session_slots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.course_cohort_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_cohort_enrollments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.course_cohorts, public.course_cohort_sessions,
  public.course_cohort_session_slots, public.course_cohort_enrollments
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.course_cohorts, public.course_cohort_sessions,
  public.course_cohort_session_slots, public.course_cohort_enrollments TO service_role;

CREATE OR REPLACE FUNCTION private.create_bureautique_booking_request(
  p_course_id text,
  p_delivery_mode text,
  p_schedule_format text,
  p_slot_ids uuid[],
  p_city text DEFAULT NULL,
  p_postal_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_request_id uuid;
  v_slot_count integer;
  v_groups_valid boolean;
  v_dates_valid boolean;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  IF p_course_id NOT IN (
    'excel-initiation-individuel', 'excel-perfectionnement-individuel', 'excel-avance-individuel',
    'word-initiation-individuel', 'word-perfectionnement-individuel', 'powerpoint-initiation-individuel'
  ) THEN RAISE EXCEPTION 'Formation non réservable.'; END IF;
  IF p_schedule_format NOT IN ('four_half_days_3h30', 'two_days_2x3h30')
    OR p_delivery_mode NOT IN ('remote', 'in_person') THEN
    RAISE EXCEPTION 'Rythme incompatible avec la formation ou la modalité choisie.';
  END IF;
  IF cardinality(p_slot_ids) <> 28
    OR (SELECT count(DISTINCT slot_id) FROM unnest(p_slot_ids) AS selected(slot_id)) <> 28 THEN
    RAISE EXCEPTION 'Les horaires choisis sont incomplets ou en double.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.course_access
    WHERE user_id = v_user_id AND course_id = p_course_id AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN RAISE EXCEPTION 'Accès à la formation requis.' USING ERRCODE = '42501'; END IF;
  IF p_delivery_mode = 'in_person'
    AND (btrim(coalesce(p_city, '')) = '' OR coalesce(p_postal_code, '') !~ '^[0-9]{5}$') THEN
    RAISE EXCEPTION 'Commune et code postal valides requis pour le présentiel.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.course_booking_requests WHERE user_id = v_user_id AND course_id = p_course_id
  ) THEN RAISE EXCEPTION 'Une demande existe déjà pour cette formation.' USING ERRCODE = '23505'; END IF;

  PERFORM candidate.id
  FROM public.training_availability_slots AS candidate
  WHERE EXISTS (
    SELECT 1 FROM public.training_availability_slots AS selected
    WHERE selected.id = ANY(p_slot_ids)
      AND candidate.starts_at < selected.ends_at
      AND selected.starts_at < candidate.ends_at
  )
  ORDER BY candidate.id FOR UPDATE;
  SELECT count(*) INTO v_slot_count
  FROM public.training_availability_slots AS slots
  WHERE slots.id = ANY(p_slot_ids)
    AND slots.is_active AND NOT slots.is_reserved AND slots.starts_at > now()
    AND p_delivery_mode = ANY(slots.delivery_modes)
    AND extract(epoch FROM (slots.ends_at - slots.starts_at)) / 60 = 30
    AND NOT EXISTS (
      SELECT 1 FROM public.training_availability_slots AS occupied
      WHERE occupied.is_reserved AND occupied.id <> slots.id
        AND occupied.starts_at < slots.ends_at AND slots.starts_at < occupied.ends_at
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.calendar_bookings AS booking
      WHERE private.calendar_booking_overlaps(booking.date, booking.slot, slots.starts_at, slots.ends_at)
    );
  IF v_slot_count <> 28 THEN
    RAISE EXCEPTION 'Une ou plusieurs demi-heures ne sont plus disponibles.' USING ERRCODE = '23505';
  END IF;

  WITH ordered AS (
    SELECT starts_at, ends_at, row_number() OVER (ORDER BY starts_at, id) AS n,
      lag(ends_at) OVER (ORDER BY starts_at, id) AS previous_end
    FROM public.training_availability_slots WHERE id = ANY(p_slot_ids)
  ), grouped AS (
    SELECT ((n - 1) / 7)::integer AS group_no,
      count(*) AS slots_count, min(starts_at) AS starts_at, max(ends_at) AS ends_at,
      bool_and(n % 7 = 1 OR previous_end = starts_at) AS contiguous
    FROM ordered GROUP BY ((n - 1) / 7)::integer
  )
  SELECT count(*) = 4 AND bool_and(slots_count = 7 AND contiguous) INTO v_groups_valid FROM grouped;

  WITH ordered AS (
    SELECT starts_at, ends_at, row_number() OVER (ORDER BY starts_at, id) AS n
    FROM public.training_availability_slots WHERE id = ANY(p_slot_ids)
  ), grouped AS (
    SELECT ((n - 1) / 7)::integer AS group_no,
      min(starts_at) AS starts_at, max(ends_at) AS ends_at,
      (min(starts_at) AT TIME ZONE 'Europe/Paris')::date AS local_date
    FROM ordered GROUP BY ((n - 1) / 7)::integer
  ), per_day AS (
    SELECT local_date, count(*) AS group_count,
      bool_and(next_start IS NULL OR next_start > ends_at) AS separated
    FROM (
      SELECT *, lead(starts_at) OVER (PARTITION BY local_date ORDER BY starts_at) AS next_start
      FROM grouped
    ) AS sequenced GROUP BY local_date
  )
  SELECT CASE p_schedule_format
    WHEN 'four_half_days_3h30' THEN count(*) = 4 AND bool_and(group_count = 1)
    WHEN 'two_days_2x3h30' THEN count(*) = 2 AND bool_and(group_count = 2 AND separated)
    ELSE false END
  INTO v_dates_valid FROM per_day;
  IF NOT coalesce(v_groups_valid, false) OR NOT coalesce(v_dates_valid, false) THEN
    RAISE EXCEPTION 'Les horaires choisis ne forment pas le rythme bureautique demandé.';
  END IF;

  INSERT INTO public.course_booking_requests (
    user_id, course_id, delivery_mode, schedule_format, city, postal_code,
    status, distance_status, travel_fee_amount, travel_fee_status
  ) VALUES (
    v_user_id, p_course_id, p_delivery_mode, p_schedule_format,
    CASE WHEN p_delivery_mode = 'in_person' THEN btrim(p_city) ELSE NULL END,
    CASE WHEN p_delivery_mode = 'in_person' THEN p_postal_code ELSE NULL END,
    CASE WHEN p_delivery_mode = 'remote' THEN 'confirmed' ELSE 'pending_distance' END,
    CASE WHEN p_delivery_mode = 'remote' THEN 'not_required' ELSE 'pending' END,
    0, 'not_required'
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.course_session_bookings (
    booking_request_id, user_id, availability_slot_id, starts_at, ends_at,
    duration_minutes, delivery_mode, status
  )
  SELECT v_request_id, v_user_id, slots.id, slots.starts_at, slots.ends_at, 30,
    p_delivery_mode, CASE WHEN p_delivery_mode = 'remote' THEN 'confirmed' ELSE 'pending' END
  FROM public.training_availability_slots AS slots WHERE slots.id = ANY(p_slot_ids);
  UPDATE public.training_availability_slots SET is_reserved = true WHERE id = ANY(p_slot_ids);
  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_bureautique_booking_request(
  p_course_id text, p_delivery_mode text, p_schedule_format text, p_slot_ids uuid[],
  p_city text DEFAULT NULL, p_postal_code text DEFAULT NULL
)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.create_bureautique_booking_request(
    p_course_id, p_delivery_mode, p_schedule_format, p_slot_ids, p_city, p_postal_code
  );
$$;
REVOKE ALL ON FUNCTION private.create_bureautique_booking_request(text, text, text, uuid[], text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.create_bureautique_booking_request(text, text, text, uuid[], text, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.create_bureautique_booking_request(text, text, text, uuid[], text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_bureautique_booking_request(text, text, text, uuid[], text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_course_cohort(
  p_cohort_id uuid, p_course_id text, p_delivery_mode text, p_schedule_format text,
  p_capacity integer, p_minimum_participants integer, p_sessions jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
    'word-initiation-inter', 'word-perfectionnement-inter', 'powerpoint-initiation-inter'
  ) OR p_delivery_mode NOT IN ('remote', 'in_person')
    OR p_schedule_format NOT IN ('four_half_days_3h30', 'two_days_2x3h30') THEN
    RAISE EXCEPTION 'Configuration de cohorte invalide.' USING ERRCODE = '22023';
  END IF;
  IF p_capacity IS NULL OR p_capacity <= 0 OR p_minimum_participants IS NULL
    OR p_minimum_participants <= 0 OR p_minimum_participants > p_capacity THEN
    RAISE EXCEPTION 'Capacité et seuil minimum explicites requis.' USING ERRCODE = '22023';
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
$$;

CREATE OR REPLACE FUNCTION public.admin_publish_course_cohort(p_cohort_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result uuid;
BEGIN
  IF NOT private.is_strict_admin() THEN RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501'; END IF;
  UPDATE public.course_cohorts AS cohorts SET status = 'published', published_at = now(), updated_at = now()
  WHERE cohorts.id = p_cohort_id AND cohorts.status = 'draft'
    AND (SELECT count(*) FROM public.course_cohort_sessions s WHERE s.cohort_id = cohorts.id AND s.starts_at > now()) = 4
    AND (SELECT coalesce(sum(duration_minutes), 0) FROM public.course_cohort_sessions s WHERE s.cohort_id = cohorts.id) = 840
  RETURNING id INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Brouillon incomplet ou dates non futures.' USING ERRCODE = '22023'; END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_confirm_course_cohort(p_cohort_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result uuid;
BEGIN
  IF NOT private.is_strict_admin() THEN RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501'; END IF;
  UPDATE public.course_cohorts AS cohorts SET status = 'confirmed', confirmed_at = now(), updated_at = now()
  WHERE cohorts.id = p_cohort_id AND cohorts.status = 'published'
    AND (SELECT count(*) FROM public.course_cohort_enrollments e WHERE e.cohort_id = cohorts.id AND e.status = 'active') >= cohorts.minimum_participants
  RETURNING id INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Le seuil minimum n est pas atteint ou la cohorte n est pas publiable.' USING ERRCODE = '22023'; END IF;
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
  UPDATE public.course_cohorts SET status = 'cancelled', cancellation_reason = btrim(p_reason),
    cancelled_at = now(), updated_at = now()
  WHERE id = p_cohort_id AND status NOT IN ('cancelled', 'completed') RETURNING id INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Cohorte non annulable.' USING ERRCODE = '22023'; END IF;
  UPDATE public.course_cohort_enrollments SET status = 'cohort_cancelled_refund_review',
    cancelled_at = now(), updated_at = now()
  WHERE cohort_id = p_cohort_id AND status = 'active';
  UPDATE public.training_availability_slots SET is_reserved = false
  WHERE id IN (
    SELECT links.availability_slot_id FROM public.course_cohort_session_slots AS links
    JOIN public.course_cohort_sessions AS sessions ON sessions.id = links.cohort_session_id
    WHERE sessions.cohort_id = p_cohort_id
  ) AND starts_at > now();
  DELETE FROM public.course_cohort_session_slots AS links
  USING public.course_cohort_sessions AS sessions
  WHERE links.cohort_session_id = sessions.id
    AND sessions.cohort_id = p_cohort_id
    AND sessions.starts_at > now();
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
  SET meeting_url = nullif(btrim(p_meeting_url), ''), updated_at = now()
  FROM public.course_cohorts AS cohorts
  WHERE sessions.id = p_session_id AND sessions.cohort_id = p_cohort_id
    AND cohorts.id = sessions.cohort_id
    AND cohorts.delivery_mode = 'remote'
    AND cohorts.status IN ('draft', 'published', 'confirmed')
  RETURNING sessions.id INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Séance distante non modifiable.' USING ERRCODE = '22023'; END IF;
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
    (SELECT count(*) FROM public.course_cohort_enrollments e WHERE e.cohort_id = cohorts.id AND e.status = 'active'),
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'position', s.position, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'duration_minutes', s.duration_minutes, 'meeting_url', s.meeting_url,
      'slot_ids', (
        SELECT coalesce(jsonb_agg(links.availability_slot_id ORDER BY slots.starts_at, links.availability_slot_id), '[]'::jsonb)
        FROM public.course_cohort_session_slots AS links
        JOIN public.training_availability_slots AS slots ON slots.id = links.availability_slot_id
        WHERE links.cohort_session_id = s.id
      )
    ) ORDER BY s.position), '[]'::jsonb) FROM public.course_cohort_sessions s WHERE s.cohort_id = cohorts.id)
  FROM public.course_cohorts cohorts ORDER BY cohorts.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_available_course_cohorts(p_course_id text)
RETURNS TABLE (
  id uuid, course_id text, delivery_mode text, schedule_format text, status text,
  capacity integer, enrolled_count bigint, available_places bigint, sessions jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.course_access AS access
    WHERE access.user_id = v_user AND access.course_id = p_course_id AND access.status = 'active'
      AND (access.expires_at IS NULL OR access.expires_at > now())
  ) THEN RAISE EXCEPTION 'Accès actif requis.' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT cohorts.id, cohorts.course_id, cohorts.delivery_mode, cohorts.schedule_format,
    cohorts.status, cohorts.capacity, counts.enrolled_count,
    greatest(cohorts.capacity - counts.enrolled_count, 0),
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'position', s.position, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'duration_minutes', s.duration_minutes
    ) ORDER BY s.position), '[]'::jsonb) FROM public.course_cohort_sessions s WHERE s.cohort_id = cohorts.id)
  FROM public.course_cohorts cohorts
  CROSS JOIN LATERAL (
    SELECT count(*) AS enrolled_count FROM public.course_cohort_enrollments e
    WHERE e.cohort_id = cohorts.id AND e.status = 'active'
  ) counts
  WHERE cohorts.course_id = p_course_id AND cohorts.status IN ('published', 'confirmed')
    AND EXISTS (SELECT 1 FROM public.course_cohort_sessions s WHERE s.cohort_id = cohorts.id AND s.starts_at > now())
  ORDER BY (SELECT min(s.starts_at) FROM public.course_cohort_sessions s WHERE s.cohort_id = cohorts.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_course_cohort(p_cohort_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_cohort public.course_cohorts%ROWTYPE;
  v_access public.course_access%ROWTYPE;
  v_count integer;
  v_enrollment public.course_cohort_enrollments%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_cohort FROM public.course_cohorts WHERE id = p_cohort_id FOR UPDATE;
  IF v_cohort.id IS NULL OR v_cohort.status NOT IN ('published', 'confirmed')
    OR NOT EXISTS (SELECT 1 FROM public.course_cohort_sessions s WHERE s.cohort_id = v_cohort.id AND s.starts_at > now()) THEN
    RAISE EXCEPTION 'Cohorte non disponible.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_access FROM public.course_access
  WHERE user_id = v_user AND course_id = v_cohort.course_id AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now()) AND purchase_id IS NOT NULL
  FOR UPDATE;
  IF v_access.id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.purchases p WHERE p.id = v_access.purchase_id
      AND p.user_id = v_user AND p.course_id = v_cohort.course_id
      AND p.payment_status IN ('paid', 'partially_refunded')
  ) THEN RAISE EXCEPTION 'Droit commercial actif requis.' USING ERRCODE = '42501'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.course_cohort_enrollments
    WHERE user_id = v_user AND course_id = v_cohort.course_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'Une inscription inter existe déjà pour cette formation.' USING ERRCODE = '23505'; END IF;
  SELECT count(*) INTO v_count FROM public.course_cohort_enrollments
  WHERE cohort_id = v_cohort.id AND status = 'active';
  IF v_count >= v_cohort.capacity THEN RAISE EXCEPTION 'Cette cohorte est complète.' USING ERRCODE = '40001'; END IF;
  INSERT INTO public.course_cohort_enrollments (
    cohort_id, course_id, user_id, course_access_id, purchase_id
  ) VALUES (v_cohort.id, v_cohort.course_id, v_user, v_access.id, v_access.purchase_id)
  RETURNING * INTO v_enrollment;
  RETURN jsonb_build_object('id', v_enrollment.id, 'cohort_id', v_enrollment.cohort_id,
    'status', v_enrollment.status, 'joined_at', v_enrollment.joined_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_my_course_cohort_enrollment(p_enrollment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_enrollment public.course_cohort_enrollments%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  SELECT enrollments.* INTO v_enrollment
  FROM public.course_cohort_enrollments AS enrollments
  JOIN public.course_cohorts AS cohorts ON cohorts.id = enrollments.cohort_id
  WHERE enrollments.id = p_enrollment_id AND enrollments.user_id = v_user
    AND enrollments.status = 'active'
    AND cohorts.status IN ('published', 'confirmed')
    AND now() < (SELECT min(sessions.starts_at) FROM public.course_cohort_sessions AS sessions WHERE sessions.cohort_id = cohorts.id)
  FOR UPDATE OF enrollments;
  IF v_enrollment.id IS NULL THEN
    RAISE EXCEPTION 'Inscription non annulable.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.course_cohort_enrollments
  SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE id = v_enrollment.id;
  RETURN jsonb_build_object('id', v_enrollment.id, 'cohort_id', v_enrollment.cohort_id, 'status', 'cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_course_cohort_enrollment(p_course_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid()); v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'id', e.id, 'cohort_id', e.cohort_id, 'course_id', e.course_id, 'status', e.status, 'joined_at', e.joined_at,
    'cohort_status', c.status, 'delivery_mode', c.delivery_mode, 'schedule_format', c.schedule_format,
    'sessions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'position', s.position, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'duration_minutes', s.duration_minutes, 'meeting_url', s.meeting_url
    ) ORDER BY s.position), '[]'::jsonb) FROM public.course_cohort_sessions s WHERE s.cohort_id = c.id)
  ) INTO v_result
  FROM public.course_cohort_enrollments e
  JOIN public.course_cohorts c ON c.id = e.cohort_id
  JOIN public.course_access AS access
    ON access.id = e.course_access_id
    AND access.user_id = e.user_id
    AND access.course_id = e.course_id
    AND access.status = 'active'
    AND (access.expires_at IS NULL OR access.expires_at > now())
  WHERE e.user_id = v_user AND e.course_id = p_course_id AND e.status IN ('active', 'completed')
  ORDER BY e.joined_at DESC LIMIT 1;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_course_cohort(uuid, text, text, text, integer, integer, jsonb),
  public.admin_publish_course_cohort(uuid), public.admin_confirm_course_cohort(uuid),
  public.admin_cancel_course_cohort(uuid, text), public.admin_set_course_cohort_meeting_url(uuid, uuid, text),
  public.admin_list_course_cohorts(),
  public.list_available_course_cohorts(text), public.join_course_cohort(uuid),
  public.get_my_course_cohort_enrollment(text), public.cancel_my_course_cohort_enrollment(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_course_cohort(uuid, text, text, text, integer, integer, jsonb),
  public.admin_publish_course_cohort(uuid), public.admin_confirm_course_cohort(uuid),
  public.admin_cancel_course_cohort(uuid, text), public.admin_set_course_cohort_meeting_url(uuid, uuid, text),
  public.admin_list_course_cohorts(),
  public.list_available_course_cohorts(text), public.join_course_cohort(uuid),
  public.get_my_course_cohort_enrollment(text), public.cancel_my_course_cohort_enrollment(uuid)
  TO authenticated;

COMMIT;
