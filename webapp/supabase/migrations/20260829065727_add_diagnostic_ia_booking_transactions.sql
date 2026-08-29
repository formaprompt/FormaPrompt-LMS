-- LOT 1C : transactions serveur pour réserver trois créneaux, finaliser la
-- synchronisation Google et conserver les consentements B2C conditionnels.
-- Ces fonctions restent inaccessibles aux clients et n'interagissent jamais
-- avec purchases ou course_access.

BEGIN;

CREATE FUNCTION public.claim_diagnostic_ia_booking(
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
  ON CONFLICT (booking_id, availability_slot_id) DO UPDATE
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

REVOKE ALL ON FUNCTION public.claim_diagnostic_ia_booking(uuid, uuid, uuid[])
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_diagnostic_ia_booking(uuid, uuid, uuid[])
TO service_role;

CREATE FUNCTION public.cancel_diagnostic_ia_booking_claim(
  p_booking_id uuid,
  p_user_id uuid,
  p_error_code text DEFAULT 'slot_conflict'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_booking public.diagnostic_ia_bookings%ROWTYPE;
  v_slot_ids uuid[];
BEGIN
  SELECT bookings.* INTO v_booking
  FROM public.diagnostic_ia_bookings AS bookings
  WHERE bookings.id = p_booking_id
    AND bookings.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking.status <> 'booking_pending' OR v_booking.google_event_id IS NOT NULL THEN
    RETURN false;
  END IF;

  SELECT array_agg(links.availability_slot_id) INTO v_slot_ids
  FROM public.diagnostic_ia_booking_slots AS links
  WHERE links.booking_id = p_booking_id
    AND links.released_at IS NULL;

  UPDATE public.diagnostic_ia_bookings AS bookings
  SET status = 'cancelled',
      claim_expires_at = NULL,
      cancelled_at = now(),
      google_sync_status = 'error',
      google_meet_status = 'error',
      google_sync_error_code = left(coalesce(nullif(btrim(p_error_code), ''), 'slot_conflict'), 100)
  WHERE bookings.id = p_booking_id;

  UPDATE public.diagnostic_ia_booking_slots AS links
  SET released_at = now()
  WHERE links.booking_id = p_booking_id
    AND links.released_at IS NULL;

  UPDATE public.training_availability_slots AS availability
  SET is_reserved = false
  WHERE availability.id = ANY(coalesce(v_slot_ids, ARRAY[]::uuid[]));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_diagnostic_ia_booking_claim(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_diagnostic_ia_booking_claim(uuid, uuid, text)
TO service_role;

CREATE FUNCTION public.finalize_diagnostic_ia_booking(
  p_booking_id uuid,
  p_user_id uuid,
  p_google_calendar_id text,
  p_google_event_id text,
  p_google_meet_url text,
  p_requires_early_consents boolean,
  p_withdrawal_period_ends_at timestamptz
)
RETURNS TABLE (
  booking_id uuid,
  booking_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  google_event_id text,
  google_meet_url text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_booking public.diagnostic_ia_bookings%ROWTYPE;
  v_order public.diagnostic_ia_orders%ROWTYPE;
  v_early_document_id uuid;
  v_full_document_id uuid;
BEGIN
  SELECT bookings.* INTO v_booking
  FROM public.diagnostic_ia_bookings AS bookings
  WHERE bookings.id = p_booking_id
    AND bookings.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation Diagnostic IA introuvable.' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status IN ('booked', 'completed') THEN
    RETURN QUERY SELECT
      v_booking.id, v_booking.status, v_booking.starts_at, v_booking.ends_at,
      v_booking.google_event_id, v_booking.google_meet_url;
    RETURN;
  END IF;

  IF v_booking.status <> 'booking_pending' OR v_booking.claim_expires_at <= now() THEN
    RAISE EXCEPTION 'La prise de réservation a expiré.' USING ERRCODE = '23505';
  END IF;

  SELECT orders.* INTO v_order
  FROM public.diagnostic_ia_orders AS orders
  WHERE orders.id = v_booking.order_id
    AND orders.user_id = p_user_id
    AND orders.status = 'paid'
    AND orders.paid_at IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paiement confirmé requis.' USING ERRCODE = '42501';
  END IF;

  IF p_requires_early_consents THEN
    IF v_order.sales_context <> 'personal'
      OR p_withdrawal_period_ends_at IS NULL
      OR v_booking.starts_at >= p_withdrawal_period_ends_at
    THEN
      RAISE EXCEPTION 'Consentements anticipés incohérents.' USING ERRCODE = '23514';
    END IF;

    SELECT versions.id INTO v_early_document_id
    FROM public.legal_document_versions AS versions
    WHERE versions.version = 'DIAGNOSTIC-EARLY-START-2026-08-26'
      AND versions.status = 'published';
    SELECT versions.id INTO v_full_document_id
    FROM public.legal_document_versions AS versions
    WHERE versions.version = 'DIAGNOSTIC-FULL-PERFORMANCE-ACK-2026-08-26'
      AND versions.status = 'published';

    IF v_early_document_id IS NULL OR v_full_document_id IS NULL THEN
      RAISE EXCEPTION 'Versions juridiques Diagnostic IA indisponibles.' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.diagnostic_ia_consents (
      order_id, user_id, consent_type, legal_document_version_id,
      granted, source, consent_context_id, appointment_starts_at,
      withdrawal_period_ends_at
    ) VALUES
      (
        v_booking.order_id, p_user_id, 'early_service_start', v_early_document_id,
        true, 'web_booking', v_booking.id, v_booking.starts_at,
        p_withdrawal_period_ends_at
      ),
      (
        v_booking.order_id, p_user_id, 'full_performance_withdrawal_acknowledgement', v_full_document_id,
        true, 'web_booking', v_booking.id, v_booking.starts_at,
        p_withdrawal_period_ends_at
      )
    ON CONFLICT DO NOTHING;
  ELSIF p_withdrawal_period_ends_at IS NOT NULL THEN
    RAISE EXCEPTION 'Date de rétractation inattendue.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.diagnostic_ia_bookings AS bookings
  SET status = 'booked',
      google_sync_status = 'synced',
      google_meet_status = CASE WHEN p_google_meet_url IS NULL THEN 'unavailable' ELSE 'created' END,
      google_calendar_id = p_google_calendar_id,
      google_event_id = p_google_event_id,
      google_meet_url = p_google_meet_url,
      google_sync_error_code = NULL,
      claim_expires_at = NULL,
      booked_at = now()
  WHERE bookings.id = v_booking.id
  RETURNING bookings.* INTO v_booking;

  RETURN QUERY SELECT
    v_booking.id, v_booking.status, v_booking.starts_at, v_booking.ends_at,
    v_booking.google_event_id, v_booking.google_meet_url;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_diagnostic_ia_booking(
  uuid, uuid, text, text, text, boolean, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_diagnostic_ia_booking(
  uuid, uuid, text, text, text, boolean, timestamptz
) TO service_role;

CREATE FUNCTION public.cleanup_expired_diagnostic_ia_booking_claims()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_expired_booking_ids uuid[];
  v_count integer := 0;
BEGIN
  SELECT array_agg(expired.id) INTO v_expired_booking_ids
  FROM (
    SELECT bookings.id
    FROM public.diagnostic_ia_bookings AS bookings
    WHERE bookings.status = 'booking_pending'
      AND bookings.claim_expires_at <= now()
      AND bookings.google_event_id IS NULL
    FOR UPDATE SKIP LOCKED
  ) AS expired;

  v_count := coalesce(array_length(v_expired_booking_ids, 1), 0);
  IF v_count = 0 THEN
    RETURN 0;
  END IF;

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

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_diagnostic_ia_booking_claims()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_diagnostic_ia_booking_claims()
TO service_role;

COMMENT ON FUNCTION public.claim_diagnostic_ia_booking(uuid, uuid, uuid[]) IS
  'Prend atomiquement trois disponibilités FormaPrompt pour une commande Diagnostic IA payée.';
COMMENT ON FUNCTION public.cancel_diagnostic_ia_booking_claim(uuid, uuid, text) IS
  'Libère atomiquement une prise sans événement Google après un conflit ou une expiration.';
COMMENT ON FUNCTION public.finalize_diagnostic_ia_booking(uuid, uuid, text, text, text, boolean, timestamptz) IS
  'Finalise la réservation après création Calendar et conserve les deux consentements B2C conditionnels.';
COMMENT ON FUNCTION public.cleanup_expired_diagnostic_ia_booking_claims() IS
  'Libère les prises expirées sans événement Google avant le calcul des disponibilités.';

COMMIT;
