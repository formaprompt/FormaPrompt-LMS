-- Une disponibilité publiée représente désormais une heure élémentaire.
-- L'interface apprenant regroupe ces heures en séances de 1 h, 2 h ou 4 h.
-- Les anciens créneaux longs non réservés sont convertis puis masqués afin
-- d'éviter qu'ils chevauchent les nouvelles disponibilités horaires.

INSERT INTO public.training_availability_slots (
  starts_at,
  ends_at,
  delivery_modes,
  notes,
  is_active,
  is_reserved,
  created_by
)
SELECT
  generated.starts_at,
  generated.starts_at + interval '1 hour',
  source.delivery_modes,
  source.notes,
  true,
  false,
  source.created_by
FROM public.training_availability_slots AS source
CROSS JOIN LATERAL generate_series(
  source.starts_at,
  source.ends_at - interval '1 hour',
  interval '1 hour'
) AS generated(starts_at)
WHERE source.is_active
  AND NOT source.is_reserved
  AND extract(epoch FROM (source.ends_at - source.starts_at)) / 60 > 60
  AND NOT EXISTS (
    SELECT 1
    FROM public.training_availability_slots AS reserved
    WHERE reserved.is_reserved
      AND generated.starts_at < reserved.ends_at
      AND generated.starts_at + interval '1 hour' > reserved.starts_at
  )
ON CONFLICT (starts_at, ends_at) DO NOTHING;

UPDATE public.training_availability_slots
SET is_active = false
WHERE is_active
  AND NOT is_reserved
  AND extract(epoch FROM (ends_at - starts_at)) / 60 > 60;

CREATE OR REPLACE FUNCTION private.skip_availability_overlapping_reservation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_active
    AND NOT NEW.is_reserved
    AND EXISTS (
      SELECT 1
      FROM public.training_availability_slots AS reserved
      WHERE reserved.id <> NEW.id
        AND reserved.is_reserved
        AND NEW.starts_at < reserved.ends_at
        AND NEW.ends_at > reserved.starts_at
    ) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS training_availability_slots_avoid_reserved_overlap
ON public.training_availability_slots;

CREATE TRIGGER training_availability_slots_avoid_reserved_overlap
BEFORE INSERT OR UPDATE OF starts_at, ends_at, is_active, is_reserved
ON public.training_availability_slots
FOR EACH ROW EXECUTE FUNCTION private.skip_availability_overlapping_reservation();

REVOKE ALL ON FUNCTION private.skip_availability_overlapping_reservation()
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.sync_booking_request_sessions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'confirmed' THEN
      UPDATE public.course_session_bookings
      SET status = 'confirmed'
      WHERE booking_request_id = NEW.id AND status <> 'completed';
    ELSIF NEW.status = 'awaiting_travel_payment' THEN
      UPDATE public.course_session_bookings
      SET status = 'pending'
      WHERE booking_request_id = NEW.id AND status <> 'completed';
    ELSIF NEW.status IN ('rejected', 'cancelled') THEN
      UPDATE public.course_session_bookings
      SET status = 'cancelled'
      WHERE booking_request_id = NEW.id AND status <> 'completed';

      UPDATE public.training_availability_slots
      SET
        is_reserved = false,
        is_active = CASE
          WHEN extract(epoch FROM (ends_at - starts_at)) / 60 = 60 THEN is_active
          ELSE false
        END
      WHERE id IN (
        SELECT availability_slot_id
        FROM public.course_session_bookings
        WHERE booking_request_id = NEW.id
      );
    ELSIF NEW.status = 'completed' THEN
      UPDATE public.course_session_bookings
      SET status = 'completed'
      WHERE booking_request_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.create_course_booking_request(
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
  v_grouping_valid boolean;
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

  IF p_schedule_format NOT IN ('one_4h', 'two_2h')
    AND NOT (p_schedule_format = 'four_1h' AND p_delivery_mode = 'remote') THEN
    RAISE EXCEPTION 'Rythme incompatible avec la modalité choisie.';
  END IF;

  -- Les trois rythmes représentent toujours quatre heures élémentaires.
  IF cardinality(p_slot_ids) <> 4
    OR (
      SELECT count(DISTINCT selected.slot_id)
      FROM unnest(p_slot_ids) AS selected(slot_id)
    ) <> 4 THEN
    RAISE EXCEPTION 'Les quatre heures choisies doivent être différentes.';
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

  -- Le verrou empêche deux apprenants de réserver la même heure simultanément.
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
    AND extract(epoch FROM (ends_at - starts_at)) / 60 = 60;

  IF v_slot_count <> 4 THEN
    RAISE EXCEPTION 'Une ou plusieurs heures ne sont plus disponibles.' USING ERRCODE = '23505';
  END IF;

  WITH ordered_slots AS (
    SELECT
      starts_at,
      lag(ends_at) OVER (ORDER BY starts_at, id) AS previous_end,
      row_number() OVER (ORDER BY starts_at, id) AS slot_position
    FROM public.training_availability_slots
    WHERE id = ANY(p_slot_ids)
  )
  SELECT bool_and(
    CASE
      WHEN p_schedule_format = 'one_4h' THEN slot_position = 1 OR previous_end = starts_at
      WHEN p_schedule_format = 'two_2h' THEN slot_position IN (1, 3) OR previous_end = starts_at
      ELSE true
    END
  )
  INTO v_grouping_valid
  FROM ordered_slots;

  IF NOT coalesce(v_grouping_valid, false) THEN
    RAISE EXCEPTION 'Les heures choisies ne forment pas le rythme demandé.';
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

  -- Chaque heure est enregistrée afin qu'une annulation les libère toutes.
  -- L'interface les regroupe ensuite selon le rythme choisi par l'apprenant.
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
    60,
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

REVOKE ALL ON FUNCTION private.create_course_booking_request(
  text, text, uuid[], text, text
) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION private.create_course_booking_request(
  text, text, uuid[], text, text
) TO authenticated;

COMMENT ON TABLE public.training_availability_slots IS
  'Disponibilités horaires. Les heures actives sont regroupées par le site en séances de 1 h, 2 h ou 4 h.';
