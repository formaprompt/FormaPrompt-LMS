-- Sépare la preuve de paiement Stripe du droit fonctionnel d'accéder à une
-- formation. Les achats historiques restent intacts et sont réconciliés vers
-- un droit actif afin de ne perdre aucun accès apprenant existant.

BEGIN;

CREATE TABLE public.course_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  access_source text NOT NULL,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_access_user_course_key UNIQUE (user_id, course_id),
  CONSTRAINT course_access_course_id_check
    CHECK (char_length(btrim(course_id)) BETWEEN 2 AND 100),
  CONSTRAINT course_access_status_check
    CHECK (status IN ('active', 'revoked', 'expired')),
  CONSTRAINT course_access_source_check
    CHECK (access_source IN ('stripe', 'admin', 'manual', 'gift', 'opco', 'legacy')),
  CONSTRAINT course_access_expiry_check
    CHECK (expires_at IS NULL OR expires_at > granted_at)
);

COMMENT ON TABLE public.course_access IS
  'Droits d accès aux formations, indépendants de la preuve de paiement Stripe.';
COMMENT ON COLUMN public.course_access.access_source IS
  'Origine du droit : paiement Stripe, attribution administrative, manuelle, cadeau, financement OPCO ou reprise historique.';

CREATE INDEX course_access_active_user_idx
  ON public.course_access (user_id, course_id)
  WHERE status = 'active';
CREATE UNIQUE INDEX course_access_purchase_uidx
  ON public.course_access (purchase_id)
  WHERE purchase_id IS NOT NULL;

ALTER TABLE public.course_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_access FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture des droits de formation selon le rôle"
ON public.course_access
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.is_admin())
);

REVOKE ALL ON public.course_access FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, user_id, course_id, status, access_source, purchase_id,
  granted_at, expires_at, created_at, updated_at
) ON public.course_access TO authenticated;
GRANT ALL ON public.course_access TO service_role;

INSERT INTO public.course_access (
  user_id,
  course_id,
  status,
  access_source,
  purchase_id,
  granted_at,
  created_at,
  updated_at
)
SELECT
  purchases.user_id,
  purchases.course_id,
  'active',
  CASE
    WHEN purchases.stripe_checkout_session_id IS NOT NULL THEN 'stripe'
    WHEN purchases.payment_status = 'granted_by_admin' THEN 'admin'
    ELSE 'legacy'
  END,
  purchases.id,
  purchases.purchased_at,
  purchases.purchased_at,
  now()
FROM public.purchases
ON CONFLICT (user_id, course_id) DO NOTHING;

DROP POLICY IF EXISTS "L'apprenant enregistre une version de sa réponse"
ON public.course_exercise_responses;
CREATE POLICY "L'apprenant enregistre une version de sa réponse"
ON public.course_exercise_responses
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.course_access
    WHERE course_access.user_id = (SELECT auth.uid())
      AND course_access.course_id = course_exercise_responses.course_id
      AND course_access.status = 'active'
      AND (course_access.expires_at IS NULL OR course_access.expires_at > now())
  )
  AND saved_at BETWEEN (now() - INTERVAL '5 minutes') AND (now() + INTERVAL '5 minutes')
);

DROP POLICY IF EXISTS "L'apprenant enregistre une nouvelle version de sa remise"
ON public.course_final_project_submissions;
CREATE POLICY "L'apprenant enregistre une nouvelle version de sa remise"
ON public.course_final_project_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.course_access
    WHERE course_access.user_id = (SELECT auth.uid())
      AND course_access.course_id = course_final_project_submissions.course_id
      AND course_access.status = 'active'
      AND (course_access.expires_at IS NULL OR course_access.expires_at > now())
  )
  AND saved_at BETWEEN (now() - INTERVAL '5 minutes') AND (now() + INTERVAL '5 minutes')
);

DROP POLICY IF EXISTS "Learners create their own accessible lesson progress"
ON public.course_lesson_progress;
CREATE POLICY "Learners create their own accessible lesson progress"
ON public.course_lesson_progress
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (
    course_id = 'introduction-prompt-engineering'
    OR EXISTS (
      SELECT 1
      FROM public.course_access
      WHERE course_access.user_id = (SELECT auth.uid())
        AND course_access.course_id = course_lesson_progress.course_id
        AND course_access.status = 'active'
        AND (course_access.expires_at IS NULL OR course_access.expires_at > now())
    )
  )
);

DROP POLICY IF EXISTS "Learners update their own accessible lesson progress"
ON public.course_lesson_progress;
CREATE POLICY "Learners update their own accessible lesson progress"
ON public.course_lesson_progress
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (
    course_id = 'introduction-prompt-engineering'
    OR EXISTS (
      SELECT 1
      FROM public.course_access
      WHERE course_access.user_id = (SELECT auth.uid())
        AND course_access.course_id = course_lesson_progress.course_id
        AND course_access.status = 'active'
        AND (course_access.expires_at IS NULL OR course_access.expires_at > now())
    )
  )
);

DROP POLICY IF EXISTS "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots;
CREATE POLICY "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'employee')
  )
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
      FROM public.course_access
      WHERE course_access.user_id = (SELECT auth.uid())
        AND course_access.course_id IN (
          'formation-ia',
          'formation-ia-act',
          'formation-prompt-level-1'
        )
        AND course_access.status = 'active'
        AND (course_access.expires_at IS NULL OR course_access.expires_at > now())
    )
  )
);

COMMENT ON POLICY "Lecture des disponibilités selon le rôle"
ON public.training_availability_slots IS
  'Le personnel voit tous les créneaux. Les apprenants voient les créneaux actifs, libres, futurs et disposent d un droit de formation actif.';

-- La réservation est une fonction SECURITY DEFINER : elle vérifie elle-même
-- le droit actif avant de verrouiller et réserver les créneaux demandés.
CREATE OR REPLACE FUNCTION private.create_course_booking_request(
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

  IF p_course_id NOT IN ('formation-ia', 'formation-ia-act', 'formation-prompt-level-1') THEN
    RAISE EXCEPTION 'Formation non réservable.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.course_access
    WHERE user_id = v_user_id
      AND course_id = p_course_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Accès à la formation requis.' USING ERRCODE = '42501';
  END IF;

  IF p_delivery_mode NOT IN ('remote', 'in_person') THEN
    RAISE EXCEPTION 'Modalité de formation invalide.';
  END IF;

  IF p_course_id = 'formation-ia'
    AND (
      (p_schedule_format = 'two_5h' AND p_delivery_mode = 'in_person')
      OR (p_schedule_format IN ('four_2h30', 'three_4h_4h_2h') AND p_delivery_mode = 'remote')
    ) THEN
    v_expected_count := 20;
  ELSIF p_course_id = 'formation-ia-act'
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
      WHEN p_schedule_format = 'two_5h' THEN slot_position IN (1, 11) OR previous_end = starts_at
      WHEN p_schedule_format = 'four_2h30' THEN slot_position IN (1, 6, 11, 16) OR previous_end = starts_at
      WHEN p_schedule_format = 'three_4h_4h_2h' THEN slot_position IN (1, 9, 17) OR previous_end = starts_at
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
    WHEN p_delivery_mode = 'in_person' AND p_schedule_format IN ('two_2h', 'two_3h30', 'two_5h') THEN 3000
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

COMMIT;
