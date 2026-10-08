-- Créativité individuelle : moteur 14 h existant, droit exact payé/cadeau et présentiel Calais.
BEGIN;
ALTER TABLE public.course_booking_requests
  DROP CONSTRAINT IF EXISTS course_booking_requests_course_id_check;
ALTER TABLE public.course_booking_requests
  ADD CONSTRAINT course_booking_requests_course_id_check CHECK (course_id IN (
    'formation-ia', 'formation-ia-act', 'formation-prompt-level-1',
    'excel-initiation-individuel', 'excel-perfectionnement-individuel', 'excel-avance-individuel',
    'word-initiation-individuel', 'word-perfectionnement-individuel', 'powerpoint-initiation-individuel', 'ia-creativite-individuel'
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
      'word-initiation-individuel', 'word-perfectionnement-individuel', 'powerpoint-initiation-individuel', 'ia-creativite-individuel'
    ) AND schedule_format IN ('four_half_days_3h30', 'two_days_2x3h30'))
  );

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
          'word-initiation-individuel', 'word-perfectionnement-individuel', 'powerpoint-initiation-individuel', 'ia-creativite-individuel'
        )
        AND (course_access.course_id <> 'ia-creativite-individuel' OR (
          (course_access.access_source = 'gift' AND course_access.purchase_id IS NULL)
          OR EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = course_access.purchase_id
            AND p.user_id = course_access.user_id AND p.course_id = course_access.course_id
            AND p.payment_status IN ('paid', 'partially_refunded'))
        ))
        AND course_access.status = 'active'
        AND (course_access.expires_at IS NULL OR course_access.expires_at > now())
    )
  )
);

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
    'word-initiation-individuel', 'word-perfectionnement-individuel', 'powerpoint-initiation-individuel', 'ia-creativite-individuel'
  ) THEN RAISE EXCEPTION 'Formation non réservable.'; END IF;
  IF p_schedule_format NOT IN ('four_half_days_3h30', 'two_days_2x3h30')
    OR p_delivery_mode NOT IN ('remote', 'in_person') THEN
    RAISE EXCEPTION 'Rythme incompatible avec la formation ou la modalité choisie.';
  END IF;
  IF cardinality(p_slot_ids) <> 28
    OR (SELECT count(DISTINCT slot_id) FROM unnest(p_slot_ids) AS selected(slot_id)) <> 28 THEN
    RAISE EXCEPTION 'Les horaires choisis sont incomplets ou en double.';
  END IF;
  IF p_course_id = 'ia-creativite-individuel' THEN
    -- Même ordre de verrouillage que le cycle de remboursement : achat, puis droit.
    PERFORM p.id FROM public.purchases p JOIN public.course_access a ON a.purchase_id = p.id
      WHERE a.user_id = v_user_id AND a.course_id = p_course_id ORDER BY p.id FOR SHARE OF p;
    PERFORM a.id FROM public.course_access a WHERE a.user_id = v_user_id
      AND a.course_id = p_course_id ORDER BY a.id FOR SHARE;
    IF NOT EXISTS (SELECT 1 FROM public.course_access a WHERE a.user_id = v_user_id
      AND a.course_id = p_course_id AND a.status = 'active'
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND ((a.access_source = 'gift' AND a.purchase_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = a.purchase_id
          AND p.user_id = v_user_id AND p.course_id = p_course_id
          AND p.payment_status IN ('paid', 'partially_refunded')))) THEN
      RAISE EXCEPTION 'Achat payé ou cadeau actif requis.' USING ERRCODE = '42501';
    END IF;
    -- Le présentiel de ce service a lieu à Calais, sans déplacement facturé.
    IF p_delivery_mode = 'in_person' THEN p_city := 'Calais'; p_postal_code := '62100'; END IF;
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
    RAISE EXCEPTION 'Les horaires choisis ne forment pas le rythme de 14 heures demandé.';
  END IF;

  INSERT INTO public.course_booking_requests (
    user_id, course_id, delivery_mode, schedule_format, city, postal_code,
    status, distance_status, travel_fee_amount, travel_fee_status
  ) VALUES (
    v_user_id, p_course_id, p_delivery_mode, p_schedule_format,
    CASE WHEN p_delivery_mode = 'in_person' THEN btrim(p_city) ELSE NULL END,
    CASE WHEN p_delivery_mode = 'in_person' THEN p_postal_code ELSE NULL END,
    CASE WHEN p_delivery_mode = 'remote' OR p_course_id = 'ia-creativite-individuel' THEN 'confirmed' ELSE 'pending_distance' END,
    CASE WHEN p_delivery_mode = 'remote' OR p_course_id = 'ia-creativite-individuel' THEN 'not_required' ELSE 'pending' END,
    0, 'not_required'
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.course_session_bookings (
    booking_request_id, user_id, availability_slot_id, starts_at, ends_at,
    duration_minutes, delivery_mode, status
  )
  SELECT v_request_id, v_user_id, slots.id, slots.starts_at, slots.ends_at, 30,
    p_delivery_mode, CASE WHEN p_delivery_mode = 'remote' OR p_course_id = 'ia-creativite-individuel' THEN 'confirmed' ELSE 'pending' END
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


COMMIT;
