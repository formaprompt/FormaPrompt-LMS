CREATE OR REPLACE FUNCTION public.claim_diagnostic_ia_booking(
  p_order_id uuid,
  p_user_id uuid,
  p_slot_ids uuid[]
)
RETURNS TABLE (
  booking_id uuid,
  booking_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  google_calendar_id text,
  google_event_id text,
  google_meet_url text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order public.diagnostic_ia_orders%ROWTYPE;
  v_booking public.diagnostic_ia_bookings%ROWTYPE;
  v_booking_id uuid;
  v_count integer;
  v_valid_count integer;
  v_first_start timestamptz;
  v_last_end timestamptz;
  v_contiguous boolean;
  v_selected_slot_ids uuid[];
  v_existing_slot_ids uuid[];
  v_expired_booking_ids uuid[];
BEGIN
  IF p_order_id IS NULL OR p_user_id IS NULL
    OR coalesce(array_length(p_slot_ids, 1), 0) <> 3
    OR (SELECT count(DISTINCT slot_id) FROM unnest(p_slot_ids) AS slot_id) <> 3
  THEN
    RAISE EXCEPTION 'Créneaux Diagnostic IA invalides.' USING ERRCODE = '22023';
  END IF;

  SELECT orders.* INTO v_order
  FROM public.diagnostic_ia_orders AS orders
  WHERE orders.id = p_order_id
    AND orders.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.status <> 'paid' OR v_order.paid_at IS NULL THEN
    RAISE EXCEPTION 'Paiement confirmé requis.' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(expired.id) INTO v_expired_booking_ids
  FROM (
    SELECT bookings.id
    FROM public.diagnostic_ia_bookings AS bookings
    WHERE bookings.status = 'booking_pending'
      AND bookings.claim_expires_at <= now()
      AND bookings.google_event_id IS NULL
    FOR UPDATE SKIP LOCKED
  ) AS expired;

  IF coalesce(array_length(v_expired_booking_ids, 1), 0) > 0 THEN
    UPDATE public.diagnostic_ia_bookings AS bookings
    SET status = 'cancelled',
        claim_expires_at = NULL,
        cancelled_at = now(),
        google_sync_status = 'error',
        google_meet_status = CASE
          WHEN bookings.google_meet_status = 'created' THEN 'created'
          ELSE 'error'
        END,
        google_sync_error_code = 'claim_expired'
    WHERE bookings.id = ANY(v_expired_booking_ids);

    UPDATE public.training_availability_slots AS availability
    SET is_reserved = false
    WHERE availability.id IN (
      SELECT links.availability_slot_id
      FROM public.diagnostic_ia_booking_slots AS links
      WHERE links.booking_id = ANY(v_expired_booking_ids)
        AND links.released_at IS NULL
    );

    UPDATE public.diagnostic_ia_booking_slots AS links
    SET released_at = now()
    WHERE links.booking_id = ANY(v_expired_booking_ids)
      AND links.released_at IS NULL;
  END IF;

  SELECT bookings.* INTO v_booking
  FROM public.diagnostic_ia_bookings AS bookings
  WHERE bookings.order_id = p_order_id
  FOR UPDATE;

  IF FOUND THEN
    SELECT array_agg(links.availability_slot_id ORDER BY links.starts_at)
    INTO v_existing_slot_ids
    FROM public.diagnostic_ia_booking_slots AS links
    WHERE links.booking_id = v_booking.id
      AND links.released_at IS NULL;

    IF v_booking.status IN ('booked', 'completed') THEN
      IF coalesce(v_existing_slot_ids, ARRAY[]::uuid[]) <@ p_slot_ids
        AND p_slot_ids <@ coalesce(v_existing_slot_ids, ARRAY[]::uuid[])
      THEN
        RETURN QUERY SELECT
          v_booking.id, v_booking.status, v_booking.starts_at, v_booking.ends_at,
          v_booking.google_calendar_id, v_booking.google_event_id, v_booking.google_meet_url;
        RETURN;
      END IF;
      RAISE EXCEPTION 'Cette commande possède déjà une réservation.' USING ERRCODE = '23505';
    END IF;

    IF v_booking.status = 'booking_pending' AND v_booking.claim_expires_at > now() THEN
      IF coalesce(v_existing_slot_ids, ARRAY[]::uuid[]) <@ p_slot_ids
        AND p_slot_ids <@ coalesce(v_existing_slot_ids, ARRAY[]::uuid[])
      THEN
        RETURN QUERY SELECT
          v_booking.id, v_booking.status, v_booking.starts_at, v_booking.ends_at,
          v_booking.google_calendar_id, v_booking.google_event_id, v_booking.google_meet_url;
        RETURN;
      END IF;
      RAISE EXCEPTION 'Une réservation est déjà en cours pour cette commande.' USING ERRCODE = '23505';
    END IF;

    IF v_booking.status <> 'cancelled' OR v_booking.google_sync_error_code <> 'claim_expired' THEN
      RAISE EXCEPTION 'Cette commande ne peut pas être réservée automatiquement.' USING ERRCODE = '23505';
    END IF;
  END IF;

  PERFORM availability.id
  FROM public.training_availability_slots AS availability
  WHERE availability.id = ANY(p_slot_ids)
  ORDER BY availability.starts_at
  FOR UPDATE;

  WITH ordered_slots AS (
    SELECT
      availability.id,
      availability.starts_at,
      availability.ends_at,
      availability.delivery_modes,
      availability.is_active,
      availability.is_reserved,
      lag(availability.ends_at) OVER (ORDER BY availability.starts_at, availability.id) AS previous_end
    FROM public.training_availability_slots AS availability
    WHERE availability.id = ANY(p_slot_ids)
  )
  SELECT
    count(*)::integer,
    count(*) FILTER (
      WHERE ordered_slots.is_active
        AND NOT ordered_slots.is_reserved
        AND ordered_slots.delivery_modes @> ARRAY['remote']::text[]
        AND ordered_slots.starts_at > now()
        AND ordered_slots.ends_at = ordered_slots.starts_at + interval '30 minutes'
    )::integer,
    min(ordered_slots.starts_at),
    max(ordered_slots.ends_at),
    bool_and(ordered_slots.previous_end IS NULL OR ordered_slots.previous_end = ordered_slots.starts_at),
    array_agg(ordered_slots.id ORDER BY ordered_slots.starts_at)
  INTO v_count, v_valid_count, v_first_start, v_last_end, v_contiguous, v_selected_slot_ids
  FROM ordered_slots;

  IF v_count <> 3 OR v_valid_count <> 3 OR NOT coalesce(v_contiguous, false)
    OR v_last_end <> v_first_start + interval '90 minutes'
    OR (v_first_start AT TIME ZONE 'Europe/Paris')::date
      <> (v_last_end AT TIME ZONE 'Europe/Paris')::date
    OR (v_last_end AT TIME ZONE 'Europe/Paris')::time > time '21:00'
  THEN
    RAISE EXCEPTION 'Le créneau Diagnostic IA n’est plus disponible.' USING ERRCODE = '23505';
  END IF;

  IF v_booking.id IS NULL THEN
    INSERT INTO public.diagnostic_ia_bookings (
      order_id, user_id, starts_at, ends_at, status,
      google_sync_status, google_meet_status, claim_expires_at
    ) VALUES (
      p_order_id, p_user_id, v_first_start, v_last_end, 'booking_pending',
      'pending', 'pending', now() + interval '15 minutes'
    )
    RETURNING id INTO v_booking_id;
  ELSE
    v_booking_id := v_booking.id;
    UPDATE public.diagnostic_ia_bookings AS bookings
    SET starts_at = v_first_start,
        ends_at = v_last_end,
        status = 'booking_pending',
        google_sync_status = 'pending',
        google_meet_status = 'pending',
        google_calendar_id = NULL,
        google_event_id = NULL,
        google_meet_url = NULL,
        google_sync_error_code = NULL,
        claim_expires_at = now() + interval '15 minutes',
        booked_at = NULL,
        cancelled_at = NULL,
        completed_at = NULL
    WHERE bookings.id = v_booking_id;
  END IF;

  INSERT INTO public.diagnostic_ia_booking_slots (
    booking_id, user_id, availability_slot_id, starts_at, ends_at, released_at
  )
  SELECT
    v_booking_id, p_user_id, availability.id,
    availability.starts_at, availability.ends_at, NULL
  FROM public.training_availability_slots AS availability
  WHERE availability.id = ANY(v_selected_slot_ids)
  ON CONFLICT ON CONSTRAINT diagnostic_ia_booking_slots_booking_slot_unique DO UPDATE
  SET user_id = EXCLUDED.user_id,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      released_at = NULL;

  UPDATE public.training_availability_slots AS availability
  SET is_reserved = true
  WHERE availability.id = ANY(v_selected_slot_ids);

  SELECT bookings.* INTO v_booking
  FROM public.diagnostic_ia_bookings AS bookings
  WHERE bookings.id = v_booking_id;

  RETURN QUERY SELECT
    v_booking.id, v_booking.status, v_booking.starts_at, v_booking.ends_at,
    v_booking.google_calendar_id, v_booking.google_event_id, v_booking.google_meet_url;
END;
$$;
