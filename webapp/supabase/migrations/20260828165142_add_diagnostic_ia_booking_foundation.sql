-- LOT 1C : fondation de réservation du Diagnostic IA Express.
-- Supabase reste la source de vérité. Les créneaux réutilisent exclusivement
-- les disponibilités FormaPrompt de 30 minutes, sans créer de droit LMS.

BEGIN;

CREATE TABLE public.diagnostic_ia_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE
    REFERENCES public.diagnostic_ia_orders(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Paris',
  status text NOT NULL DEFAULT 'booking_pending',
  google_sync_status text NOT NULL DEFAULT 'not_started',
  google_meet_status text NOT NULL DEFAULT 'not_requested',
  google_calendar_id text,
  google_event_id text,
  google_meet_url text,
  google_sync_error_code text,
  organizer_email text NOT NULL DEFAULT 'formaprompt@gmail.com',
  claim_expires_at timestamptz,
  booked_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostic_ia_bookings_duration_check CHECK (
    ends_at = starts_at + interval '90 minutes'
  ),
  CONSTRAINT diagnostic_ia_bookings_paris_day_check CHECK (
    (starts_at AT TIME ZONE 'Europe/Paris')::date
      = (ends_at AT TIME ZONE 'Europe/Paris')::date
    AND (ends_at AT TIME ZONE 'Europe/Paris')::time <= time '21:00'
  ),
  CONSTRAINT diagnostic_ia_bookings_timezone_check CHECK (timezone = 'Europe/Paris'),
  CONSTRAINT diagnostic_ia_bookings_status_check CHECK (
    status IN ('booking_pending', 'booked', 'cancelled', 'completed')
  ),
  CONSTRAINT diagnostic_ia_bookings_google_sync_status_check CHECK (
    google_sync_status IN ('not_started', 'pending', 'synced', 'error')
  ),
  CONSTRAINT diagnostic_ia_bookings_google_meet_status_check CHECK (
    google_meet_status IN ('not_requested', 'pending', 'created', 'unavailable', 'error')
  ),
  CONSTRAINT diagnostic_ia_bookings_google_references_check CHECK (
    (google_sync_status <> 'synced'
      OR (google_calendar_id IS NOT NULL AND google_event_id IS NOT NULL))
    AND (google_meet_status <> 'created' OR google_meet_url IS NOT NULL)
    AND (google_meet_status = 'created' OR google_meet_url IS NULL)
    AND (google_calendar_id IS NULL OR char_length(btrim(google_calendar_id)) BETWEEN 3 AND 1024)
    AND (google_event_id IS NULL OR google_event_id ~ '^[a-v0-9]{5,1024}$')
    AND (google_meet_url IS NULL OR google_meet_url ~ '^https://meet[.]google[.]com/[A-Za-z0-9-]+$')
    AND (google_sync_error_code IS NULL OR char_length(google_sync_error_code) BETWEEN 2 AND 100)
  ),
  CONSTRAINT diagnostic_ia_bookings_organizer_check CHECK (
    organizer_email = 'formaprompt@gmail.com'
  ),
  CONSTRAINT diagnostic_ia_bookings_timestamps_check CHECK (
    (status = 'booking_pending' AND booked_at IS NULL AND cancelled_at IS NULL AND completed_at IS NULL)
    OR (status = 'booked' AND booked_at IS NOT NULL AND cancelled_at IS NULL AND completed_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL AND completed_at IS NULL)
    OR (status = 'completed' AND booked_at IS NOT NULL AND cancelled_at IS NULL AND completed_at IS NOT NULL)
  ),
  CONSTRAINT diagnostic_ia_bookings_claim_check CHECK (
    (status = 'booking_pending'
      AND claim_expires_at > created_at
      AND claim_expires_at <= created_at + interval '15 minutes')
    OR (status <> 'booking_pending' AND claim_expires_at IS NULL)
  )
);

CREATE UNIQUE INDEX diagnostic_ia_bookings_active_paris_day_uidx
  ON public.diagnostic_ia_bookings (
    ((starts_at AT TIME ZONE 'Europe/Paris')::date)
  )
  WHERE status IN ('booking_pending', 'booked');
CREATE UNIQUE INDEX diagnostic_ia_bookings_google_event_uidx
  ON public.diagnostic_ia_bookings(google_calendar_id, google_event_id)
  WHERE google_calendar_id IS NOT NULL AND google_event_id IS NOT NULL;
CREATE INDEX diagnostic_ia_bookings_user_start_idx
  ON public.diagnostic_ia_bookings(user_id, starts_at DESC);
CREATE INDEX diagnostic_ia_bookings_sync_idx
  ON public.diagnostic_ia_bookings(google_sync_status, starts_at)
  WHERE google_sync_status IN ('pending', 'error');
CREATE INDEX diagnostic_ia_bookings_expired_claim_idx
  ON public.diagnostic_ia_bookings(claim_expires_at)
  WHERE status = 'booking_pending';

CREATE TABLE public.diagnostic_ia_booking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL
    REFERENCES public.diagnostic_ia_bookings(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  availability_slot_id uuid NOT NULL
    REFERENCES public.training_availability_slots(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostic_ia_booking_slots_duration_check CHECK (
    ends_at = starts_at + interval '30 minutes'
  ),
  CONSTRAINT diagnostic_ia_booking_slots_booking_slot_unique
    UNIQUE (booking_id, availability_slot_id)
);

CREATE UNIQUE INDEX diagnostic_ia_booking_slots_active_slot_uidx
  ON public.diagnostic_ia_booking_slots(availability_slot_id)
  WHERE released_at IS NULL;
CREATE INDEX diagnostic_ia_booking_slots_booking_idx
  ON public.diagnostic_ia_booking_slots(booking_id, starts_at);

CREATE FUNCTION private.assert_diagnostic_ia_booking_slots(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_booking public.diagnostic_ia_bookings%ROWTYPE;
  v_count integer;
  v_matching_count integer;
  v_first_start timestamptz;
  v_last_end timestamptz;
  v_contiguous boolean;
BEGIN
  SELECT * INTO v_booking
  FROM public.diagnostic_ia_bookings
  WHERE id = p_booking_id;

  IF NOT FOUND OR v_booking.status NOT IN ('booking_pending', 'booked') THEN
    RETURN;
  END IF;

  WITH ordered_slots AS (
    SELECT
      slots.user_id,
      slots.starts_at,
      slots.ends_at,
      availability.starts_at AS availability_starts_at,
      availability.ends_at AS availability_ends_at,
      availability.delivery_modes,
      lag(slots.ends_at) OVER (ORDER BY slots.starts_at, slots.id) AS previous_end
    FROM public.diagnostic_ia_booking_slots AS slots
    JOIN public.training_availability_slots AS availability
      ON availability.id = slots.availability_slot_id
    WHERE slots.booking_id = p_booking_id
      AND slots.released_at IS NULL
  )
  SELECT
    count(*)::integer,
    count(*) FILTER (
      WHERE user_id = v_booking.user_id
        AND starts_at = availability_starts_at
        AND ends_at = availability_ends_at
        AND delivery_modes @> ARRAY['remote']::text[]
    )::integer,
    min(starts_at),
    max(ends_at),
    bool_and(previous_end IS NULL OR previous_end = starts_at)
  INTO v_count, v_matching_count, v_first_start, v_last_end, v_contiguous
  FROM ordered_slots;

  IF v_count <> 3
    OR v_matching_count <> 3
    OR v_first_start IS DISTINCT FROM v_booking.starts_at
    OR v_last_end IS DISTINCT FROM v_booking.ends_at
    OR NOT coalesce(v_contiguous, false)
  THEN
    RAISE EXCEPTION 'Une réservation Diagnostic IA exige trois demi-heures contiguës et cohérentes.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.assert_diagnostic_ia_booking_slots(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.assert_diagnostic_ia_booking_slots(uuid)
TO service_role;

CREATE FUNCTION private.validate_diagnostic_ia_booking_from_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM private.assert_diagnostic_ia_booking_slots(NEW.id);
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.validate_diagnostic_ia_booking_from_slot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.assert_diagnostic_ia_booking_slots(OLD.booking_id);
    RETURN OLD;
  END IF;
  PERFORM private.assert_diagnostic_ia_booking_slots(NEW.booking_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_diagnostic_ia_booking_from_booking()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.validate_diagnostic_ia_booking_from_slot()
FROM PUBLIC, anon, authenticated, service_role;

CREATE CONSTRAINT TRIGGER diagnostic_ia_booking_has_three_slots
AFTER INSERT OR UPDATE OF starts_at, ends_at, status, user_id
ON public.diagnostic_ia_bookings
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.validate_diagnostic_ia_booking_from_booking();

CREATE CONSTRAINT TRIGGER diagnostic_ia_booking_slot_set_is_valid
AFTER INSERT OR UPDATE OR DELETE
ON public.diagnostic_ia_booking_slots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.validate_diagnostic_ia_booking_from_slot();

ALTER TABLE public.diagnostic_ia_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_ia_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_ia_booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_ia_booking_slots FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture de sa réservation Diagnostic IA"
ON public.diagnostic_ia_bookings FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Lecture administrative des réservations Diagnostic IA"
ON public.diagnostic_ia_bookings FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));
CREATE POLICY "Lecture de ses créneaux Diagnostic IA"
ON public.diagnostic_ia_booking_slots FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Lecture administrative des créneaux Diagnostic IA"
ON public.diagnostic_ia_booking_slots FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

REVOKE ALL ON public.diagnostic_ia_bookings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.diagnostic_ia_booking_slots FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.diagnostic_ia_bookings TO authenticated;
GRANT SELECT ON public.diagnostic_ia_booking_slots TO authenticated;
GRANT ALL ON public.diagnostic_ia_bookings TO service_role;
GRANT ALL ON public.diagnostic_ia_booking_slots TO service_role;

CREATE TRIGGER diagnostic_ia_bookings_set_updated_at
BEFORE UPDATE ON public.diagnostic_ia_bookings
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

COMMENT ON TABLE public.diagnostic_ia_bookings IS
  'Réservations du Diagnostic IA Express. Supabase est la source de vérité ; Google Calendar est une synchronisation externe.';
COMMENT ON TABLE public.diagnostic_ia_booking_slots IS
  'Trois demi-heures FormaPrompt contiguës affectées à chaque réservation Diagnostic IA.';
COMMENT ON COLUMN public.diagnostic_ia_bookings.google_sync_error_code IS
  'Code technique non sensible permettant de signaler une synchronisation Google à reprendre.';
COMMENT ON COLUMN public.diagnostic_ia_bookings.google_meet_status IS
  'État distinct de la création Meet afin de conserver un événement Calendar même si Meet est indisponible.';
COMMENT ON COLUMN public.diagnostic_ia_bookings.claim_expires_at IS
  'Expiration courte de la prise SQL intermédiaire ; sa libération atomique sera gérée par la fonction de réservation.';

COMMIT;
