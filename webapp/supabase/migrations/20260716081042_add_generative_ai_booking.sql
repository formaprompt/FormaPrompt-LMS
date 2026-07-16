-- Ajoute la formation IA générative au parcours d'achat et de réservation.
-- Cette migration élargit les contrôles existants sans modifier les achats,
-- disponibilités, réservations ou émargements déjà enregistrés.

BEGIN;

ALTER TABLE public.course_booking_requests
  DROP CONSTRAINT IF EXISTS course_booking_requests_course_id_check;
ALTER TABLE public.course_booking_requests
  ADD CONSTRAINT course_booking_requests_course_id_check CHECK (
    course_id IN ('formation-ia', 'formation-ia-act', 'formation-prompt-level-1')
  );

ALTER TABLE public.course_booking_requests
  DROP CONSTRAINT IF EXISTS course_booking_requests_schedule_format_check;
ALTER TABLE public.course_booking_requests
  ADD CONSTRAINT course_booking_requests_schedule_format_check CHECK (
    schedule_format IN (
      'one_4h', 'two_2h', 'four_1h', 'one_day_7h', 'two_3h30', 'two_5h', 'four_2h30'
    )
  );

ALTER TABLE public.course_booking_requests
  DROP CONSTRAINT IF EXISTS course_booking_requests_mode_format_check;
ALTER TABLE public.course_booking_requests
  ADD CONSTRAINT course_booking_requests_mode_format_check CHECK (
    (course_id = 'formation-ia' AND (
      (schedule_format = 'two_5h' AND delivery_mode = 'in_person')
      OR (schedule_format = 'four_2h30' AND delivery_mode = 'remote')
    ))
    OR
    (course_id = 'formation-ia-act' AND (
      schedule_format IN ('one_4h', 'two_2h')
      OR (schedule_format = 'four_1h' AND delivery_mode = 'remote')
    ))
    OR
    (course_id = 'formation-prompt-level-1' AND (
      schedule_format = 'two_3h30'
      OR (schedule_format = 'one_day_7h' AND delivery_mode = 'in_person')
    ))
  );

ALTER TABLE public.course_booking_requests
  DROP CONSTRAINT IF EXISTS course_booking_requests_fee_check;
ALTER TABLE public.course_booking_requests
  ADD CONSTRAINT course_booking_requests_fee_check CHECK (
    (
      delivery_mode = 'in_person'
      AND schedule_format IN ('two_2h', 'two_3h30', 'two_5h')
      AND travel_fee_amount = 3000
    )
    OR (
      NOT (delivery_mode = 'in_person' AND schedule_format IN ('two_2h', 'two_3h30', 'two_5h'))
      AND travel_fee_amount = 0
    )
  );

DROP POLICY IF EXISTS "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots;

CREATE POLICY "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
  OR (
    is_active
    AND NOT is_reserved
    AND starts_at > now()
    AND EXISTS (
      SELECT 1 FROM public.purchases
      WHERE purchases.user_id = (SELECT auth.uid())
        AND purchases.course_id IN (
          'formation-ia', 'formation-ia-act', 'formation-prompt-level-1'
        )
    )
  )
);

DROP FUNCTION IF EXISTS public.create_course_booking_request(text, text, uuid[], text, text);
DROP FUNCTION IF EXISTS public.create_course_booking_request(text, text, text, uuid[], text, text);
DROP FUNCTION IF EXISTS private.create_course_booking_request(text, text, uuid[], text, text);
DROP FUNCTION IF EXISTS private.create_course_booking_request(text, text, text, uuid[], text, text);

CREATE FUNCTION private.create_course_booking_request(
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
  v_expected_count integer;
  v_slot_count integer;
  v_grouping_valid boolean;
  v_initial_status text;
  v_distance_status text;
  v_fee_amount integer;
  v_fee_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501';
  END IF;

  IF p_course_id NOT IN ('formation-ia', 'formation-ia-act', 'formation-prompt-level-1') THEN
    RAISE EXCEPTION 'Formation non réservable.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchases
    WHERE user_id = v_user_id AND course_id = p_course_id
  ) THEN
    RAISE EXCEPTION 'Accès à la formation requis.' USING ERRCODE = '42501';
  END IF;

  IF p_delivery_mode NOT IN ('remote', 'in_person') THEN
    RAISE EXCEPTION 'Modalité de formation invalide.';
  END IF;

  IF p_course_id = 'formation-ia'
    AND (
      (p_schedule_format = 'two_5h' AND p_delivery_mode = 'in_person')
      OR (p_schedule_format = 'four_2h30' AND p_delivery_mode = 'remote')
    ) THEN
    v_expected_count := 20;
  ELSIF p_course_id = 'formation-ia-act'
    AND (
      p_schedule_format IN ('one_4h', 'two_2h')
      OR (p_schedule_format = 'four_1h' AND p_delivery_mode = 'remote')
    ) THEN
    v_expected_count := 8;
  ELSIF p_course_id = 'formation-prompt-level-1'
    AND (
      p_schedule_format = 'two_3h30'
      OR (p_schedule_format = 'one_day_7h' AND p_delivery_mode = 'in_person')
    ) THEN
    v_expected_count := 14;
  ELSE
    RAISE EXCEPTION 'Rythme incompatible avec la formation ou la modalité choisie.';
  END IF;

  IF cardinality(p_slot_ids) <> v_expected_count
    OR (SELECT count(DISTINCT selected.slot_id) FROM unnest(p_slot_ids) AS selected(slot_id)) <> v_expected_count THEN
    RAISE EXCEPTION 'Les horaires choisis sont incomplets ou en double.';
  END IF;

  IF p_delivery_mode = 'in_person'
    AND (trim(coalesce(p_city, '')) = '' OR coalesce(p_postal_code, '') !~ '^[0-9]{5}$') THEN
    RAISE EXCEPTION 'Commune et code postal valides requis pour le présentiel.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.course_booking_requests
    WHERE user_id = v_user_id AND course_id = p_course_id
  ) THEN
    RAISE EXCEPTION 'Une demande existe déjà pour cette formation.' USING ERRCODE = '23505';
  END IF;

  PERFORM id FROM public.training_availability_slots
  WHERE id = ANY(p_slot_ids)
  ORDER BY id FOR UPDATE;

  SELECT count(*) INTO v_slot_count
  FROM public.training_availability_slots
  WHERE id = ANY(p_slot_ids)
    AND is_active
    AND NOT is_reserved
    AND starts_at > now()
    AND p_delivery_mode = ANY(delivery_modes)
    AND extract(epoch FROM (ends_at - starts_at)) / 60 = 30;

  IF v_slot_count <> v_expected_count THEN
    RAISE EXCEPTION 'Une ou plusieurs demi-heures ne sont plus disponibles.' USING ERRCODE = '23505';
  END IF;

  WITH ordered_slots AS (
    SELECT
      starts_at,
      ends_at,
      lag(ends_at) OVER (ORDER BY starts_at, id) AS previous_end,
      row_number() OVER (ORDER BY starts_at, id) AS slot_position
    FROM public.training_availability_slots
    WHERE id = ANY(p_slot_ids)
  )
  SELECT bool_and(
    CASE
      WHEN p_schedule_format = 'one_4h' THEN slot_position = 1 OR previous_end = starts_at
      WHEN p_schedule_format = 'two_2h' THEN slot_position IN (1, 5) OR previous_end = starts_at
      WHEN p_schedule_format = 'four_1h' THEN slot_position IN (1, 3, 5, 7) OR previous_end = starts_at
      WHEN p_schedule_format = 'two_3h30' THEN slot_position IN (1, 8) OR previous_end = starts_at
      WHEN p_schedule_format = 'two_5h' THEN slot_position IN (1, 11) OR previous_end = starts_at
      WHEN p_schedule_format = 'four_2h30' THEN slot_position IN (1, 6, 11, 16) OR previous_end = starts_at
      WHEN p_schedule_format = 'one_day_7h' THEN
        slot_position = 1
        OR (slot_position = 9
          AND starts_at = previous_end + interval '1 hour'
          AND (starts_at AT TIME ZONE 'Europe/Paris')::date = (previous_end AT TIME ZONE 'Europe/Paris')::date)
        OR (slot_position <> 9 AND previous_end = starts_at)
      ELSE false
    END
  ) INTO v_grouping_valid
  FROM ordered_slots;

  IF NOT coalesce(v_grouping_valid, false) THEN
    RAISE EXCEPTION 'Les horaires choisis ne forment pas le rythme demandé.';
  END IF;

  v_initial_status := CASE WHEN p_delivery_mode = 'remote' THEN 'confirmed' ELSE 'pending_distance' END;
  v_distance_status := CASE WHEN p_delivery_mode = 'remote' THEN 'not_required' ELSE 'pending' END;
  v_fee_amount := CASE
    WHEN p_delivery_mode = 'in_person' AND p_schedule_format IN ('two_2h', 'two_3h30', 'two_5h') THEN 3000
    ELSE 0
  END;
  v_fee_status := CASE WHEN v_fee_amount = 3000 THEN 'pending' ELSE 'not_required' END;

  INSERT INTO public.course_booking_requests (
    user_id, course_id, delivery_mode, schedule_format, city, postal_code,
    status, distance_status, travel_fee_amount, travel_fee_status
  ) VALUES (
    v_user_id, p_course_id, p_delivery_mode, p_schedule_format,
    CASE WHEN p_delivery_mode = 'in_person' THEN trim(p_city) ELSE NULL END,
    CASE WHEN p_delivery_mode = 'in_person' THEN p_postal_code ELSE NULL END,
    v_initial_status, v_distance_status, v_fee_amount, v_fee_status
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.course_session_bookings (
    booking_request_id, user_id, availability_slot_id, starts_at, ends_at,
    duration_minutes, delivery_mode, status
  )
  SELECT
    v_request_id, v_user_id, slots.id, slots.starts_at, slots.ends_at,
    30, p_delivery_mode,
    CASE WHEN p_delivery_mode = 'remote' THEN 'confirmed' ELSE 'pending' END
  FROM public.training_availability_slots AS slots
  WHERE slots.id = ANY(p_slot_ids);

  UPDATE public.training_availability_slots SET is_reserved = true
  WHERE id = ANY(p_slot_ids);

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.create_course_booking_request(text, text, text, uuid[], text, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.create_course_booking_request(text, text, text, uuid[], text, text)
TO authenticated;

CREATE FUNCTION public.create_course_booking_request(
  p_course_id text,
  p_delivery_mode text,
  p_schedule_format text,
  p_slot_ids uuid[],
  p_city text DEFAULT NULL,
  p_postal_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.create_course_booking_request(
    p_course_id, p_delivery_mode, p_schedule_format, p_slot_ids, p_city, p_postal_code
  );
$$;

REVOKE ALL ON FUNCTION public.create_course_booking_request(text, text, text, uuid[], text, text)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_course_booking_request(text, text, text, uuid[], text, text)
TO authenticated;

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
    WHEN 'two_5h' THEN v_prior_minutes IN (0, 300) AND v_selected_minutes = 300
    WHEN 'four_2h30' THEN v_prior_minutes IN (0, 150, 300, 450) AND v_selected_minutes = 150
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

COMMENT ON COLUMN public.course_booking_requests.travel_fee_amount IS
  'Participation unique de 30 EUR pour un présentiel réparti sur deux déplacements.';

COMMIT;
