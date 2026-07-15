-- Réservation des 4 heures synchrones de la formation AI Act.
-- Les disponibilités ne contiennent aucune donnée apprenant ; les demandes
-- nominatives restent privées grâce aux politiques RLS.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE public.training_availability_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  delivery_modes text[] NOT NULL DEFAULT ARRAY['remote']::text[],
  is_active boolean NOT NULL DEFAULT true,
  is_reserved boolean NOT NULL DEFAULT false,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT training_availability_slots_dates_check CHECK (ends_at > starts_at),
  CONSTRAINT training_availability_slots_duration_check CHECK (
    extract(epoch FROM (ends_at - starts_at)) / 60 IN (60, 120, 240)
  ),
  CONSTRAINT training_availability_slots_modes_check CHECK (
    cardinality(delivery_modes) > 0
    AND delivery_modes <@ ARRAY['remote', 'in_person']::text[]
  ),
  CONSTRAINT training_availability_slots_unique_period UNIQUE (starts_at, ends_at)
);

CREATE TABLE public.course_booking_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL
    CONSTRAINT course_booking_requests_user_id_fkey
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id text NOT NULL DEFAULT 'formation-ia-act'
    CHECK (course_id = 'formation-ia-act'),
  delivery_mode text NOT NULL CHECK (delivery_mode IN ('remote', 'in_person')),
  schedule_format text NOT NULL CHECK (schedule_format IN ('one_4h', 'two_2h', 'four_1h')),
  city text CHECK (city IS NULL OR char_length(city) BETWEEN 2 AND 120),
  postal_code text CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{5}$'),
  status text NOT NULL CHECK (
    status IN ('pending_distance', 'awaiting_travel_payment', 'confirmed', 'rejected', 'cancelled', 'completed')
  ),
  distance_status text NOT NULL CHECK (distance_status IN ('not_required', 'pending', 'approved', 'rejected')),
  travel_fee_amount integer NOT NULL DEFAULT 0 CHECK (travel_fee_amount IN (0, 3000)),
  travel_fee_status text NOT NULL CHECK (travel_fee_status IN ('not_required', 'pending', 'paid')),
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  stripe_event_id text UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT course_booking_requests_unique_course UNIQUE (user_id, course_id),
  CONSTRAINT course_booking_requests_mode_format_check CHECK (
    delivery_mode = 'remote' OR schedule_format IN ('one_4h', 'two_2h')
  ),
  CONSTRAINT course_booking_requests_location_check CHECK (
    delivery_mode = 'remote' OR (city IS NOT NULL AND postal_code IS NOT NULL)
  ),
  CONSTRAINT course_booking_requests_fee_check CHECK (
    (delivery_mode = 'in_person' AND schedule_format = 'two_2h' AND travel_fee_amount = 3000)
    OR (NOT (delivery_mode = 'in_person' AND schedule_format = 'two_2h') AND travel_fee_amount = 0)
  )
);

CREATE TABLE public.course_session_bookings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id uuid NOT NULL
    CONSTRAINT course_session_bookings_request_id_fkey
    REFERENCES public.course_booking_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    CONSTRAINT course_session_bookings_user_id_fkey
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  availability_slot_id uuid NOT NULL
    CONSTRAINT course_session_bookings_slot_id_fkey
    REFERENCES public.training_availability_slots(id) ON DELETE RESTRICT,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (60, 120, 240)),
  delivery_mode text NOT NULL CHECK (delivery_mode IN ('remote', 'in_person')),
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  meeting_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT course_session_bookings_unique_request_slot UNIQUE (booking_request_id, availability_slot_id)
);

CREATE UNIQUE INDEX course_session_bookings_active_slot_idx
  ON public.course_session_bookings (availability_slot_id)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX course_booking_requests_status_idx
  ON public.course_booking_requests (status, created_at DESC);

CREATE INDEX course_session_bookings_user_start_idx
  ON public.course_session_bookings (user_id, starts_at);

CREATE INDEX training_availability_slots_created_by_idx
  ON public.training_availability_slots (created_by);

ALTER TABLE public.training_availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_session_bookings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.training_availability_slots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.course_booking_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.course_session_bookings FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_availability_slots TO authenticated;
GRANT SELECT, UPDATE ON public.course_booking_requests TO authenticated;
GRANT SELECT, UPDATE ON public.course_session_bookings TO authenticated;
GRANT ALL ON public.training_availability_slots, public.course_booking_requests, public.course_session_bookings TO service_role;

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
        AND purchases.course_id = 'formation-ia-act'
    )
  )
);

CREATE POLICY "Le personnel crée les disponibilités"
ON public.training_availability_slots FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
);

CREATE POLICY "Le personnel modifie les disponibilités"
ON public.training_availability_slots FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
);

CREATE POLICY "Lecture des demandes selon le rôle"
ON public.course_booking_requests FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
);

CREATE POLICY "Le personnel modifie les demandes de réservation"
ON public.course_booking_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
);

CREATE POLICY "Lecture des séances selon le rôle"
ON public.course_session_bookings FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
);

CREATE POLICY "Le personnel modifie les séances"
ON public.course_session_bookings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
);

CREATE POLICY "Le personnel supprime les disponibilités"
ON public.training_availability_slots FOR DELETE
TO authenticated
USING (
  NOT is_reserved
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
);

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER training_availability_slots_set_updated_at
BEFORE UPDATE ON public.training_availability_slots
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER course_booking_requests_set_updated_at
BEFORE UPDATE ON public.course_booking_requests
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER course_session_bookings_set_updated_at
BEFORE UPDATE ON public.course_session_bookings
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

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
      SET is_reserved = false
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

CREATE TRIGGER course_booking_requests_sync_sessions
AFTER UPDATE OF status ON public.course_booking_requests
FOR EACH ROW EXECUTE FUNCTION private.sync_booking_request_sessions();

CREATE OR REPLACE FUNCTION public.create_course_booking_request(
  p_user_id uuid,
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
  v_user_id uuid := p_user_id;
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

  -- Verrouille les créneaux afin d'empêcher deux réservations simultanées.
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

REVOKE ALL ON FUNCTION public.create_course_booking_request(uuid, text, text, uuid[], text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_course_booking_request(uuid, text, text, uuid[], text, text)
TO service_role;

COMMENT ON TABLE public.course_booking_requests IS
  'Demandes nominatives de réservation. Commune et code postal servent uniquement à valider le rayon présentiel.';
COMMENT ON COLUMN public.course_booking_requests.travel_fee_amount IS
  'Participation unique de 30 EUR pour le présentiel en deux séances de deux heures.';
