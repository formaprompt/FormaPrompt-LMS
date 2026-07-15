-- La réservation est exécutée avec le JWT de l'apprenant. La fonction déduit
-- l'identité depuis auth.uid() : aucun identifiant utilisateur n'est accepté
-- depuis le navigateur ou transmis comme argument privilégié.

DROP FUNCTION IF EXISTS public.create_course_booking_request(
  uuid, text, text, uuid[], text, text
);

DROP FUNCTION IF EXISTS public.create_course_booking_request(
  text, text, uuid[], text, text
);

CREATE FUNCTION public.create_course_booking_request(
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
  v_expected_duration integer;
  v_slot_count integer;
  v_initial_status text;
  v_distance_status text;
  v_fee_amount integer;
  v_fee_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchases
    WHERE user_id = v_user_id AND course_id = 'formation-ia-act'
  ) THEN
    RAISE EXCEPTION 'Accès à la formation requis.' USING ERRCODE = '42501';
  END IF;

  IF p_delivery_mode NOT IN ('remote', 'in_person') THEN
    RAISE EXCEPTION 'Modalité de formation invalide.';
  END IF;

  IF p_schedule_format = 'one_4h' THEN
    v_expected_count := 1;
    v_expected_duration := 240;
  ELSIF p_schedule_format = 'two_2h' THEN
    v_expected_count := 2;
    v_expected_duration := 120;
  ELSIF p_schedule_format = 'four_1h' AND p_delivery_mode = 'remote' THEN
    v_expected_count := 4;
    v_expected_duration := 60;
  ELSE
    RAISE EXCEPTION 'Rythme incompatible avec la modalité choisie.';
  END IF;

  IF cardinality(p_slot_ids) <> v_expected_count THEN
    RAISE EXCEPTION 'Nombre de créneaux incorrect pour le rythme choisi.';
  END IF;

  IF p_delivery_mode = 'in_person' THEN
    IF trim(coalesce(p_city, '')) = '' OR coalesce(p_postal_code, '') !~ '^[0-9]{5}$' THEN
      RAISE EXCEPTION 'Commune et code postal valides requis pour le présentiel.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.course_booking_requests
    WHERE user_id = v_user_id AND course_id = 'formation-ia-act'
  ) THEN
    RAISE EXCEPTION 'Une demande existe déjà pour cette formation.' USING ERRCODE = '23505';
  END IF;

  PERFORM id
  FROM public.training_availability_slots
  WHERE id = ANY(p_slot_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT count(*) INTO v_slot_count
  FROM public.training_availability_slots
  WHERE id = ANY(p_slot_ids)
    AND is_active
    AND NOT is_reserved
    AND starts_at > now()
    AND p_delivery_mode = ANY(delivery_modes)
    AND extract(epoch FROM (ends_at - starts_at)) / 60 = v_expected_duration;

  IF v_slot_count <> v_expected_count THEN
    RAISE EXCEPTION 'Un ou plusieurs créneaux ne sont plus disponibles.' USING ERRCODE = '23505';
  END IF;

  v_initial_status := CASE WHEN p_delivery_mode = 'remote' THEN 'confirmed' ELSE 'pending_distance' END;
  v_distance_status := CASE WHEN p_delivery_mode = 'remote' THEN 'not_required' ELSE 'pending' END;
  v_fee_amount := CASE WHEN p_delivery_mode = 'in_person' AND p_schedule_format = 'two_2h' THEN 3000 ELSE 0 END;
  v_fee_status := CASE WHEN v_fee_amount = 3000 THEN 'pending' ELSE 'not_required' END;

  INSERT INTO public.course_booking_requests (
    user_id, course_id, delivery_mode, schedule_format, city, postal_code,
    status, distance_status, travel_fee_amount, travel_fee_status
  ) VALUES (
    v_user_id,
    'formation-ia-act',
    p_delivery_mode,
    p_schedule_format,
    CASE WHEN p_delivery_mode = 'in_person' THEN trim(p_city) ELSE NULL END,
    CASE WHEN p_delivery_mode = 'in_person' THEN p_postal_code ELSE NULL END,
    v_initial_status,
    v_distance_status,
    v_fee_amount,
    v_fee_status
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.course_session_bookings (
    booking_request_id, user_id, availability_slot_id, starts_at, ends_at,
    duration_minutes, delivery_mode, status
  )
  SELECT
    v_request_id,
    v_user_id,
    slots.id,
    slots.starts_at,
    slots.ends_at,
    (extract(epoch FROM (slots.ends_at - slots.starts_at)) / 60)::integer,
    p_delivery_mode,
    CASE WHEN p_delivery_mode = 'remote' THEN 'confirmed' ELSE 'pending' END
  FROM public.training_availability_slots AS slots
  WHERE slots.id = ANY(p_slot_ids);

  UPDATE public.training_availability_slots
  SET is_reserved = true
  WHERE id = ANY(p_slot_ids);

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_course_booking_request(
  text, text, uuid[], text, text
) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.create_course_booking_request(
  text, text, uuid[], text, text
) TO authenticated;
