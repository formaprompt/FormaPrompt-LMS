-- LOT 1F-A : déplacement administratif d'un rendez-vous Diagnostic IA.
-- La prise des nouveaux créneaux est atomique et conserve les anciens jusqu'à
-- ce que Google Calendar ait confirmé la modification de l'événement existant.

BEGIN;

ALTER TABLE public.diagnostic_ia_bookings
  ADD COLUMN reschedule_claim_token uuid,
  ADD COLUMN reschedule_slot_ids uuid[],
  ADD COLUMN reschedule_starts_at timestamptz,
  ADD COLUMN reschedule_ends_at timestamptz,
  ADD COLUMN reschedule_claim_expires_at timestamptz,
  ADD COLUMN reschedule_requested_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT diagnostic_ia_bookings_reschedule_claim_check CHECK (
    (
      reschedule_claim_token IS NULL
      AND reschedule_slot_ids IS NULL
      AND reschedule_starts_at IS NULL
      AND reschedule_ends_at IS NULL
      AND reschedule_claim_expires_at IS NULL
      AND reschedule_requested_by IS NULL
    )
    OR (
      status = 'booked'
      AND reschedule_claim_token IS NOT NULL
      AND reschedule_slot_ids IS NOT NULL
      AND cardinality(reschedule_slot_ids) = 3
      AND reschedule_slot_ids[1] IS NOT NULL
      AND reschedule_slot_ids[2] IS NOT NULL
      AND reschedule_slot_ids[3] IS NOT NULL
      AND reschedule_slot_ids[1] <> reschedule_slot_ids[2]
      AND reschedule_slot_ids[1] <> reschedule_slot_ids[3]
      AND reschedule_slot_ids[2] <> reschedule_slot_ids[3]
      AND reschedule_starts_at IS NOT NULL
      AND reschedule_ends_at IS NOT NULL
      AND reschedule_ends_at = reschedule_starts_at + interval '90 minutes'
      AND reschedule_claim_expires_at IS NOT NULL
      AND reschedule_claim_expires_at > updated_at
      AND reschedule_claim_expires_at <= updated_at + interval '15 minutes'
      AND reschedule_requested_by IS NOT NULL
    )
  );

CREATE INDEX diagnostic_ia_bookings_reschedule_claim_idx
  ON public.diagnostic_ia_bookings(reschedule_claim_expires_at)
  WHERE reschedule_claim_token IS NOT NULL;

CREATE FUNCTION public.admin_get_diagnostic_ia_reschedule_context(p_booking_id uuid)
RETURNS TABLE (
  booking_id uuid,
  order_id uuid,
  user_id uuid,
  booking_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  google_calendar_id text,
  google_event_id text,
  google_meet_url text,
  current_slot_ids uuid[],
  reschedule_claim_token uuid,
  reschedule_slot_ids uuid[],
  reschedule_starts_at timestamptz,
  reschedule_ends_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Accès administrateur strict requis.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    bookings.id,
    bookings.order_id,
    bookings.user_id,
    bookings.status,
    bookings.starts_at,
    bookings.ends_at,
    bookings.google_calendar_id,
    bookings.google_event_id,
    bookings.google_meet_url,
    coalesce(array_agg(links.availability_slot_id ORDER BY links.starts_at)
      FILTER (WHERE links.id IS NOT NULL), ARRAY[]::uuid[]),
    bookings.reschedule_claim_token,
    bookings.reschedule_slot_ids,
    bookings.reschedule_starts_at,
    bookings.reschedule_ends_at
  FROM public.diagnostic_ia_bookings AS bookings
  LEFT JOIN public.diagnostic_ia_booking_slots AS links
    ON links.booking_id = bookings.id
   AND links.released_at IS NULL
  WHERE bookings.id = p_booking_id
  GROUP BY bookings.id;
END;
$$;

CREATE FUNCTION public.admin_claim_diagnostic_ia_booking_reschedule(
  p_booking_id uuid,
  p_slot_ids uuid[]
)
RETURNS TABLE (
  booking_id uuid,
  order_id uuid,
  user_id uuid,
  claim_token uuid,
  old_starts_at timestamptz,
  old_ends_at timestamptz,
  new_starts_at timestamptz,
  new_ends_at timestamptz,
  google_calendar_id text,
  google_event_id text,
  google_meet_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_booking public.diagnostic_ia_bookings%ROWTYPE;
  v_current_slot_ids uuid[];
  v_selected_slot_ids uuid[];
  v_count integer;
  v_valid_count integer;
  v_first_start timestamptz;
  v_last_end timestamptz;
  v_contiguous boolean;
  v_claim_token uuid;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Accès administrateur strict requis.' USING ERRCODE = '42501';
  END IF;
  IF p_booking_id IS NULL
    OR coalesce(array_length(p_slot_ids, 1), 0) <> 3
    OR (SELECT count(DISTINCT slot_id) FROM unnest(p_slot_ids) AS slot_id) <> 3
  THEN
    RAISE EXCEPTION 'Créneaux Diagnostic IA invalides.' USING ERRCODE = '22023';
  END IF;

  SELECT bookings.* INTO v_booking
  FROM public.diagnostic_ia_bookings AS bookings
  WHERE bookings.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation Diagnostic IA introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_booking.status <> 'booked' THEN
    RAISE EXCEPTION 'Seul un rendez-vous réservé peut être déplacé.' USING ERRCODE = 'P0001';
  END IF;
  IF v_booking.google_sync_status <> 'synced'
    OR v_booking.google_calendar_id IS NULL
    OR v_booking.google_event_id IS NULL
  THEN
    RAISE EXCEPTION 'La référence Calendar du rendez-vous est incomplète.' USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(links.availability_slot_id ORDER BY links.starts_at)
  INTO v_current_slot_ids
  FROM public.diagnostic_ia_booking_slots AS links
  WHERE links.booking_id = p_booking_id
    AND links.released_at IS NULL;

  IF cardinality(coalesce(v_current_slot_ids, ARRAY[]::uuid[])) <> 3 THEN
    RAISE EXCEPTION 'Les créneaux actuels du rendez-vous sont incohérents.' USING ERRCODE = '23514';
  END IF;

  IF v_booking.reschedule_claim_token IS NOT NULL THEN
    IF coalesce(v_booking.reschedule_slot_ids, ARRAY[]::uuid[]) <@ p_slot_ids
      AND p_slot_ids <@ coalesce(v_booking.reschedule_slot_ids, ARRAY[]::uuid[])
    THEN
      UPDATE public.diagnostic_ia_bookings
      SET reschedule_claim_expires_at = now() + interval '15 minutes'
      WHERE id = v_booking.id
      RETURNING * INTO v_booking;

      RETURN QUERY SELECT
        v_booking.id, v_booking.order_id, v_booking.user_id,
        v_booking.reschedule_claim_token, v_booking.starts_at, v_booking.ends_at,
        v_booking.reschedule_starts_at, v_booking.reschedule_ends_at,
        v_booking.google_calendar_id, v_booking.google_event_id, v_booking.google_meet_url;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Un déplacement est déjà en cours pour ce rendez-vous.' USING ERRCODE = '40001';
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
        AND (NOT ordered_slots.is_reserved OR ordered_slots.id = ANY(v_current_slot_ids))
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
    RAISE EXCEPTION 'Le nouveau créneau vient de devenir indisponible.' USING ERRCODE = '23505';
  END IF;
  IF v_first_start = v_booking.starts_at AND v_last_end = v_booking.ends_at THEN
    RAISE EXCEPTION 'Choisissez un créneau différent du rendez-vous actuel.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.calendar_bookings AS blocks
  WHERE blocks.date = (v_first_start AT TIME ZONE 'Europe/Paris')::date
    AND (
      blocks.slot = 'Journée'
      OR (blocks.slot = 'Matin'
        AND (v_first_start AT TIME ZONE 'Europe/Paris')::time < time '13:00')
      OR (blocks.slot = 'Après-midi'
        AND (v_last_end AT TIME ZONE 'Europe/Paris')::time > time '13:00')
    )
  FOR SHARE;
  IF FOUND THEN
    RAISE EXCEPTION 'Le nouveau créneau vient de devenir indisponible.' USING ERRCODE = '23505';
  END IF;

  -- La règle métier existante autorise un seul Diagnostic IA actif par jour.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'diagnostic_ia_day:' || ((v_first_start AT TIME ZONE 'Europe/Paris')::date)::text,
      0
    )
  );
  IF EXISTS (
    SELECT 1
    FROM public.diagnostic_ia_bookings AS other_booking
    WHERE other_booking.id <> v_booking.id
      AND other_booking.status IN ('booking_pending', 'booked')
      AND (other_booking.starts_at AT TIME ZONE 'Europe/Paris')::date
        = (v_first_start AT TIME ZONE 'Europe/Paris')::date
  ) OR EXISTS (
    SELECT 1
    FROM public.diagnostic_ia_bookings AS other_claim
    WHERE other_claim.id <> v_booking.id
      AND other_claim.reschedule_claim_token IS NOT NULL
      AND (other_claim.reschedule_starts_at AT TIME ZONE 'Europe/Paris')::date
        = (v_first_start AT TIME ZONE 'Europe/Paris')::date
  ) THEN
    RAISE EXCEPTION 'Le nouveau créneau vient de devenir indisponible.' USING ERRCODE = '23505';
  END IF;

  v_claim_token := gen_random_uuid();
  UPDATE public.training_availability_slots AS availability
  SET is_reserved = true
  WHERE availability.id = ANY(v_selected_slot_ids);

  UPDATE public.diagnostic_ia_bookings
  SET reschedule_claim_token = v_claim_token,
      reschedule_slot_ids = v_selected_slot_ids,
      reschedule_starts_at = v_first_start,
      reschedule_ends_at = v_last_end,
      reschedule_claim_expires_at = now() + interval '15 minutes',
      reschedule_requested_by = v_actor
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  RETURN QUERY SELECT
    v_booking.id, v_booking.order_id, v_booking.user_id,
    v_booking.reschedule_claim_token, v_booking.starts_at, v_booking.ends_at,
    v_booking.reschedule_starts_at, v_booking.reschedule_ends_at,
    v_booking.google_calendar_id, v_booking.google_event_id, v_booking.google_meet_url;
END;
$$;

CREATE FUNCTION public.cancel_diagnostic_ia_booking_reschedule_claim(
  p_booking_id uuid,
  p_claim_token uuid,
  p_calendar_result text DEFAULT 'not_updated'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_booking public.diagnostic_ia_bookings%ROWTYPE;
BEGIN
  SELECT bookings.* INTO v_booking
  FROM public.diagnostic_ia_bookings AS bookings
  WHERE bookings.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking.reschedule_claim_token IS DISTINCT FROM p_claim_token THEN
    RETURN false;
  END IF;

  UPDATE public.training_availability_slots AS availability
  SET is_reserved = false
  WHERE availability.id = ANY(v_booking.reschedule_slot_ids)
    AND NOT EXISTS (
      SELECT 1
      FROM public.diagnostic_ia_booking_slots AS active_link
      WHERE active_link.availability_slot_id = availability.id
        AND active_link.released_at IS NULL
    );

  UPDATE public.diagnostic_ia_bookings
  SET reschedule_claim_token = NULL,
      reschedule_slot_ids = NULL,
      reschedule_starts_at = NULL,
      reschedule_ends_at = NULL,
      reschedule_claim_expires_at = NULL,
      reschedule_requested_by = NULL
  WHERE id = v_booking.id;

  INSERT INTO public.audit_log(
    actor_user_id, action_type, target_type, target_id, target_user_id,
    previous_state, new_state, metadata
  ) VALUES (
    v_booking.reschedule_requested_by,
    'diagnostic_ia_booking_reschedule_cancelled',
    'diagnostic_ia_booking', v_booking.id::text, v_booking.user_id,
    jsonb_build_object('starts_at', v_booking.starts_at, 'ends_at', v_booking.ends_at),
    jsonb_build_object('starts_at', v_booking.starts_at, 'ends_at', v_booking.ends_at),
    jsonb_build_object(
      'requested_starts_at', v_booking.reschedule_starts_at,
      'requested_ends_at', v_booking.reschedule_ends_at,
      'calendar_result', left(coalesce(nullif(btrim(p_calendar_result), ''), 'not_updated'), 100)
    )
  );

  RETURN true;
END;
$$;

CREATE FUNCTION public.finalize_diagnostic_ia_booking_reschedule(
  p_booking_id uuid,
  p_claim_token uuid,
  p_calendar_result text DEFAULT 'updated'
)
RETURNS public.diagnostic_ia_bookings
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_booking public.diagnostic_ia_bookings%ROWTYPE;
  v_result public.diagnostic_ia_bookings%ROWTYPE;
  v_old_slot_ids uuid[];
BEGIN
  SELECT bookings.* INTO v_booking
  FROM public.diagnostic_ia_bookings AS bookings
  WHERE bookings.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_booking.status <> 'booked'
    OR v_booking.reschedule_claim_token IS DISTINCT FROM p_claim_token
  THEN
    RAISE EXCEPTION 'Prise de déplacement invalide.' USING ERRCODE = '40001';
  END IF;

  SELECT array_agg(links.availability_slot_id ORDER BY links.starts_at)
  INTO v_old_slot_ids
  FROM public.diagnostic_ia_booking_slots AS links
  WHERE links.booking_id = v_booking.id
    AND links.released_at IS NULL;

  UPDATE public.diagnostic_ia_booking_slots AS links
  SET released_at = now()
  WHERE links.booking_id = v_booking.id
    AND links.released_at IS NULL
    AND NOT (links.availability_slot_id = ANY(v_booking.reschedule_slot_ids));

  UPDATE public.training_availability_slots AS availability
  SET is_reserved = false
  WHERE availability.id = ANY(coalesce(v_old_slot_ids, ARRAY[]::uuid[]))
    AND NOT (availability.id = ANY(v_booking.reschedule_slot_ids));

  INSERT INTO public.diagnostic_ia_booking_slots(
    booking_id, user_id, availability_slot_id, starts_at, ends_at, released_at
  )
  SELECT
    v_booking.id, v_booking.user_id, availability.id,
    availability.starts_at, availability.ends_at, NULL
  FROM public.training_availability_slots AS availability
  WHERE availability.id = ANY(v_booking.reschedule_slot_ids)
  ON CONFLICT ON CONSTRAINT diagnostic_ia_booking_slots_booking_slot_unique DO UPDATE
  SET user_id = EXCLUDED.user_id,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      released_at = NULL;

  UPDATE public.diagnostic_ia_bookings
  SET starts_at = v_booking.reschedule_starts_at,
      ends_at = v_booking.reschedule_ends_at,
      google_sync_status = 'synced',
      google_sync_error_code = NULL,
      reschedule_claim_token = NULL,
      reschedule_slot_ids = NULL,
      reschedule_starts_at = NULL,
      reschedule_ends_at = NULL,
      reschedule_claim_expires_at = NULL,
      reschedule_requested_by = NULL
  WHERE id = v_booking.id
  RETURNING * INTO v_result;

  INSERT INTO public.audit_log(
    actor_user_id, action_type, target_type, target_id, target_user_id,
    previous_state, new_state, metadata
  ) VALUES (
    v_booking.reschedule_requested_by,
    'diagnostic_ia_booking_rescheduled',
    'diagnostic_ia_booking', v_booking.id::text, v_booking.user_id,
    jsonb_build_object('starts_at', v_booking.starts_at, 'ends_at', v_booking.ends_at),
    jsonb_build_object('starts_at', v_result.starts_at, 'ends_at', v_result.ends_at),
    jsonb_build_object(
      'calendar_result', left(coalesce(nullif(btrim(p_calendar_result), ''), 'updated'), 100)
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_diagnostic_ia_reschedule_context(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_diagnostic_ia_reschedule_context(uuid)
TO authenticated;

REVOKE ALL ON FUNCTION public.admin_claim_diagnostic_ia_booking_reschedule(uuid, uuid[])
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_claim_diagnostic_ia_booking_reschedule(uuid, uuid[])
TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_diagnostic_ia_booking_reschedule_claim(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_diagnostic_ia_booking_reschedule_claim(uuid, uuid, text)
TO service_role;

REVOKE ALL ON FUNCTION public.finalize_diagnostic_ia_booking_reschedule(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_diagnostic_ia_booking_reschedule(uuid, uuid, text)
TO service_role;

COMMENT ON FUNCTION public.admin_claim_diagnostic_ia_booking_reschedule(uuid, uuid[]) IS
  'Réclame atomiquement trois nouveaux créneaux pour un booking Diagnostic réservé, sans libérer les anciens.';
COMMENT ON FUNCTION public.finalize_diagnostic_ia_booking_reschedule(uuid, uuid, text) IS
  'Bascule atomiquement le booking et ses trois liens de créneaux après confirmation Calendar.';

COMMIT;
