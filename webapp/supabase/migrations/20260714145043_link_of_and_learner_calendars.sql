-- Lie le calendrier public des organismes de formation aux réservations
-- horaires des apprenants. Les périodes sont comparées en heure de Paris :
-- matin avant 13 h, après-midi à partir de 13 h.

CREATE OR REPLACE FUNCTION private.calendar_booking_overlaps(
  p_booking_date date,
  p_booking_slot text,
  p_period_start timestamp with time zone,
  p_period_end timestamp with time zone
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    p_period_start < pg_catalog.timezone(
      'Europe/Paris',
      CASE
        WHEN p_booking_slot = 'Matin'
          THEN p_booking_date::timestamp + interval '13 hours'
        ELSE (p_booking_date + 1)::timestamp
      END
    )
    AND p_period_end > pg_catalog.timezone(
      'Europe/Paris',
      CASE
        WHEN p_booking_slot = 'Après-midi'
          THEN p_booking_date::timestamp + interval '13 hours'
        ELSE p_booking_date::timestamp
      END
    );
$$;

REVOKE ALL ON FUNCTION private.calendar_booking_overlaps(
  date, text, timestamp with time zone, timestamp with time zone
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.calendar_booking_overlaps(
  date, text, timestamp with time zone, timestamp with time zone
) TO authenticated;

-- Vue matérialisée sous forme de table minimale : elle indique uniquement
-- qu'une demi-journée contient une réservation apprenant. Aucune identité,
-- adresse ou donnée pédagogique n'est rendue publique.
CREATE TABLE public.learner_calendar_blocks (
  booking_date date NOT NULL,
  slot text NOT NULL CHECK (slot IN ('Matin', 'Après-midi')),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (booking_date, slot)
);

ALTER TABLE public.learner_calendar_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learner_calendar_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.learner_calendar_blocks TO anon, authenticated;
GRANT ALL ON public.learner_calendar_blocks TO service_role;

CREATE POLICY "Lecture publique des indisponibilités apprenant"
ON public.learner_calendar_blocks
FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION private.refresh_learner_calendar_blocks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_date date;
BEGIN
  FOR v_date IN
    SELECT DISTINCT candidate_date
    FROM unnest(
      CASE
        WHEN TG_OP = 'INSERT' THEN ARRAY[(NEW.starts_at AT TIME ZONE 'Europe/Paris')::date]
        WHEN TG_OP = 'DELETE' THEN ARRAY[(OLD.starts_at AT TIME ZONE 'Europe/Paris')::date]
        ELSE ARRAY[
          (OLD.starts_at AT TIME ZONE 'Europe/Paris')::date,
          (NEW.starts_at AT TIME ZONE 'Europe/Paris')::date
        ]
      END
    ) AS dates(candidate_date)
    WHERE candidate_date IS NOT NULL
    ORDER BY candidate_date
  LOOP
    DELETE FROM public.learner_calendar_blocks
    WHERE booking_date = v_date;

    INSERT INTO public.learner_calendar_blocks (booking_date, slot)
    SELECT v_date, half_day.slot
    FROM (VALUES ('Matin'::text), ('Après-midi'::text)) AS half_day(slot)
    WHERE EXISTS (
      SELECT 1
      FROM public.training_availability_slots AS availability
      WHERE availability.is_reserved
        AND private.calendar_booking_overlaps(
          v_date,
          half_day.slot,
          availability.starts_at,
          availability.ends_at
        )
    )
    ON CONFLICT (booking_date, slot)
    DO UPDATE SET updated_at = timezone('utc'::text, now());
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.refresh_learner_calendar_blocks()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS training_availability_slots_refresh_calendar_blocks
ON public.training_availability_slots;

CREATE TRIGGER training_availability_slots_refresh_calendar_blocks
AFTER INSERT OR UPDATE OR DELETE
ON public.training_availability_slots
FOR EACH ROW EXECUTE FUNCTION private.refresh_learner_calendar_blocks();

-- Remplit les demi-journées déjà occupées avant cette migration.
INSERT INTO public.learner_calendar_blocks (booking_date, slot)
SELECT DISTINCT
  (availability.starts_at AT TIME ZONE 'Europe/Paris')::date,
  half_day.slot
FROM public.training_availability_slots AS availability
CROSS JOIN (VALUES ('Matin'::text), ('Après-midi'::text)) AS half_day(slot)
WHERE availability.is_reserved
  AND private.calendar_booking_overlaps(
    (availability.starts_at AT TIME ZONE 'Europe/Paris')::date,
    half_day.slot,
    availability.starts_at,
    availability.ends_at
  )
ON CONFLICT (booking_date, slot) DO NOTHING;

-- Empêche une réservation OF de recouvrir une heure apprenant déjà réservée.
-- Le verrou transactionnel par date ferme également la course entre deux
-- réservations simultanées provenant des deux calendriers.
CREATE OR REPLACE FUNCTION private.prevent_calendar_booking_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_date date;
BEGIN
  FOR v_date IN
    SELECT DISTINCT candidate_date
    FROM unnest(
      CASE
        WHEN TG_OP = 'INSERT' THEN ARRAY[NEW.date]
        ELSE ARRAY[OLD.date, NEW.date]
      END
    ) AS dates(candidate_date)
    WHERE candidate_date IS NOT NULL
    ORDER BY candidate_date
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('formaprompt-schedule:' || v_date::text, 0)
    );
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.training_availability_slots AS availability
    WHERE availability.is_reserved
      AND private.calendar_booking_overlaps(
        NEW.date,
        NEW.slot,
        availability.starts_at,
        availability.ends_at
      )
  ) THEN
    RAISE EXCEPTION
      'Cette période n''est plus disponible : une séance apprenant occupe déjà la demi-journée.'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.calendar_bookings AS existing
    WHERE existing.id <> NEW.id
      AND existing.date = NEW.date
      AND (
        existing.slot = 'Journée'
        OR NEW.slot = 'Journée'
        OR existing.slot = NEW.slot
      )
  ) THEN
    RAISE EXCEPTION
      'Cette période n''est plus disponible : une réservation OF existe déjà.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_calendar_booking_conflict()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS calendar_bookings_prevent_cross_conflict
ON public.calendar_bookings;

CREATE TRIGGER calendar_bookings_prevent_cross_conflict
BEFORE INSERT OR UPDATE OF date, slot
ON public.calendar_bookings
FOR EACH ROW EXECUTE FUNCTION private.prevent_calendar_booking_conflict();

-- Empêche le chemin inverse : une heure apprenant ne peut pas devenir réservée
-- lorsqu'une option ou réservation OF occupe déjà sa demi-journée.
CREATE OR REPLACE FUNCTION private.prevent_training_booking_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_date date;
BEGIN
  IF NOT NEW.is_reserved THEN
    RETURN NEW;
  END IF;

  v_date := (NEW.starts_at AT TIME ZONE 'Europe/Paris')::date;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('formaprompt-schedule:' || v_date::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.calendar_bookings AS booking
    WHERE private.calendar_booking_overlaps(
      booking.date,
      booking.slot,
      NEW.starts_at,
      NEW.ends_at
    )
  ) THEN
    RAISE EXCEPTION
      'Une ou plusieurs heures ne sont plus disponibles : une réservation OF occupe la demi-journée.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_training_booking_conflict()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS training_availability_slots_prevent_cross_conflict
ON public.training_availability_slots;

CREATE TRIGGER training_availability_slots_prevent_cross_conflict
BEFORE INSERT OR UPDATE OF starts_at, ends_at, is_reserved
ON public.training_availability_slots
FOR EACH ROW EXECUTE FUNCTION private.prevent_training_booking_conflict();

-- Les heures recouvertes par une réservation OF ne sont plus visibles par les
-- apprenants, même si elles avaient été publiées auparavant par l'administrateur.
DROP POLICY IF EXISTS "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots;

CREATE POLICY "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots
FOR SELECT
TO authenticated
USING (
  (SELECT private.is_admin())
  OR (
    is_active
    AND NOT is_reserved
    AND starts_at > now()
    AND NOT EXISTS (
      SELECT 1
      FROM public.calendar_bookings AS booking
      WHERE private.calendar_booking_overlaps(
        booking.date,
        booking.slot,
        training_availability_slots.starts_at,
        training_availability_slots.ends_at
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.purchases
      WHERE purchases.user_id = (SELECT auth.uid())
        AND purchases.course_id = 'formation-ia-act'
    )
  )
);

COMMENT ON TABLE public.learner_calendar_blocks IS
  'Demi-journées occupées par au moins une séance apprenant. Données publiques minimales sans identité.';
