-- Ajoute la réservation de Prompt Engineering – Niveau 1 et passe les
-- disponibilités élémentaires à 30 minutes afin de composer 3 h 30 sans
-- affaiblir les contrôles d'achat, de concurrence ou de confidentialité.

ALTER TABLE public.training_availability_slots
  DROP CONSTRAINT IF EXISTS training_availability_slots_duration_check;
ALTER TABLE public.training_availability_slots
  ADD CONSTRAINT training_availability_slots_duration_check CHECK (
    extract(epoch FROM (ends_at - starts_at)) / 60 IN (30, 60, 120, 240)
  );

ALTER TABLE public.course_session_bookings
  DROP CONSTRAINT IF EXISTS course_session_bookings_duration_minutes_check;
ALTER TABLE public.course_session_bookings
  ADD CONSTRAINT course_session_bookings_duration_minutes_check
  CHECK (duration_minutes IN (30, 60, 120, 240));

ALTER TABLE public.course_booking_requests
  DROP CONSTRAINT IF EXISTS course_booking_requests_course_id_check;
ALTER TABLE public.course_booking_requests
  ADD CONSTRAINT course_booking_requests_course_id_check CHECK (
    course_id IN ('formation-ia-act', 'formation-prompt-level-1')
  );

ALTER TABLE public.course_booking_requests
  DROP CONSTRAINT IF EXISTS course_booking_requests_schedule_format_check;
ALTER TABLE public.course_booking_requests
  ADD CONSTRAINT course_booking_requests_schedule_format_check CHECK (
    schedule_format IN ('one_4h', 'two_2h', 'four_1h', 'one_day_7h', 'two_3h30')
  );

ALTER TABLE public.course_booking_requests
  DROP CONSTRAINT IF EXISTS course_booking_requests_mode_format_check;
ALTER TABLE public.course_booking_requests
  ADD CONSTRAINT course_booking_requests_mode_format_check CHECK (
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
      AND schedule_format IN ('two_2h', 'two_3h30')
      AND travel_fee_amount = 3000
    )
    OR (
      NOT (delivery_mode = 'in_person' AND schedule_format IN ('two_2h', 'two_3h30'))
      AND travel_fee_amount = 0
    )
  );

-- Transforme uniquement les disponibilités de test ou futures non réservées.
-- Les anciennes réservations d'une heure restent intactes et affichables.
INSERT INTO public.training_availability_slots (
  starts_at, ends_at, delivery_modes, notes, is_active, is_reserved, created_by
)
SELECT
  generated.starts_at,
  generated.starts_at + interval '30 minutes',
  source.delivery_modes,
  source.notes,
  true,
  false,
  source.created_by
FROM public.training_availability_slots AS source
CROSS JOIN LATERAL generate_series(
  source.starts_at,
  source.ends_at - interval '30 minutes',
  interval '30 minutes'
) AS generated(starts_at)
WHERE source.is_active
  AND NOT source.is_reserved
  AND extract(epoch FROM (source.ends_at - source.starts_at)) / 60 >= 60
  AND NOT EXISTS (
    SELECT 1
    FROM public.training_availability_slots AS reserved
    WHERE reserved.is_reserved
      AND generated.starts_at < reserved.ends_at
      AND generated.starts_at + interval '30 minutes' > reserved.starts_at
  )
ON CONFLICT (starts_at, ends_at) DO NOTHING;

UPDATE public.training_availability_slots
SET is_active = false
WHERE is_active
  AND NOT is_reserved
  AND extract(epoch FROM (ends_at - starts_at)) / 60 > 30;

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
        AND purchases.course_id IN ('formation-ia-act', 'formation-prompt-level-1')
    )
  )
);

CREATE OR REPLACE FUNCTION private.sync_booking_request_sessions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'confirmed' THEN
      UPDATE public.course_session_bookings SET status = 'confirmed'
      WHERE booking_request_id = NEW.id AND status <> 'completed';
    ELSIF NEW.status = 'awaiting_travel_payment' THEN
      UPDATE public.course_session_bookings SET status = 'pending'
      WHERE booking_request_id = NEW.id AND status <> 'completed';
    ELSIF NEW.status IN ('rejected', 'cancelled') THEN
      UPDATE public.course_session_bookings SET status = 'cancelled'
      WHERE booking_request_id = NEW.id AND status <> 'completed';

      UPDATE public.training_availability_slots
      SET
        is_reserved = false,
        is_active = CASE
          WHEN extract(epoch FROM (ends_at - starts_at)) / 60 IN (30, 60) THEN is_active
          ELSE false
        END
      WHERE id IN (
        SELECT availability_slot_id FROM public.course_session_bookings
        WHERE booking_request_id = NEW.id
      );
    ELSIF NEW.status = 'completed' THEN
      UPDATE public.course_session_bookings SET status = 'completed'
      WHERE booking_request_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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

  IF p_course_id NOT IN ('formation-ia-act', 'formation-prompt-level-1') THEN
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

  IF p_course_id = 'formation-ia-act'
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
    WHEN p_delivery_mode = 'in_person' AND p_schedule_format IN ('two_2h', 'two_3h30') THEN 3000
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

COMMENT ON TABLE public.training_availability_slots IS
  'Disponibilités en unités de 30 minutes, composées en séances par le site.';
COMMENT ON COLUMN public.course_booking_requests.travel_fee_amount IS
  'Participation unique de 30 EUR pour un présentiel réparti sur deux déplacements.';
