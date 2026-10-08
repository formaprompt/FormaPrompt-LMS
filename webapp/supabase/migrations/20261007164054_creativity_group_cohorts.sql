-- Groupes créativité uniquement : service accompagné, sans accès LMS fictif.
-- Les achats différés attendent leur activation ; les cadeaux actifs sont admis.
-- Aucun remboursement ni confirmation automatique.
BEGIN;
ALTER TABLE public.course_cohorts DROP CONSTRAINT course_cohorts_course_id_check;
ALTER TABLE public.course_cohorts ADD CONSTRAINT course_cohorts_course_id_check CHECK (course_id IN (
 'excel-initiation-inter','excel-perfectionnement-inter','excel-avance-inter',
 'word-initiation-inter','word-perfectionnement-inter','powerpoint-initiation-inter','ia-creativite-groupe'));
ALTER TABLE public.course_cohorts ADD CONSTRAINT course_cohorts_creativity_group_limits CHECK (
 course_id <> 'ia-creativite-groupe' OR (schedule_format='four_half_days_3h30' AND minimum_participants=4 AND capacity BETWEEN 4 AND 6));

CREATE OR REPLACE FUNCTION private.creativity_cohort_enrollment_is_eligible(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_cohort_enrollments e
    JOIN public.course_access a ON a.id=e.course_access_id AND a.user_id=e.user_id AND a.course_id=e.course_id
    LEFT JOIN public.purchases p ON p.id=a.purchase_id AND p.user_id=e.user_id AND p.course_id=e.course_id
    WHERE e.id=p_id AND e.status='active' AND a.status='active'
      AND (a.expires_at IS NULL OR a.expires_at>now())
      AND ((a.access_source='gift' AND a.purchase_id IS NULL AND e.purchase_id IS NULL)
        OR (e.purchase_id=a.purchase_id AND p.payment_status IN ('paid','partially_refunded')))
  );
$$;
REVOKE ALL ON FUNCTION private.creativity_cohort_enrollment_is_eligible(uuid) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.admin_save_course_cohort(p_cohort_id uuid, p_course_id text, p_delivery_mode text, p_schedule_format text, p_capacity integer, p_minimum_participants integer, p_sessions jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_cohort_id uuid;
  v_session jsonb;
  v_position integer;
  v_session_slot_ids uuid[];
  v_old_slot_ids uuid[] := ARRAY[]::uuid[];
  v_all_slot_ids uuid[] := ARRAY[]::uuid[];
  v_session_dates date[] := ARRAY[]::date[];
  v_session_starts timestamptz[] := ARRAY[]::timestamptz[];
  v_session_ends timestamptz[] := ARRAY[]::timestamptz[];
  v_cohort_session_id uuid;
  v_slot_count integer;
  v_contiguous boolean;
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_current_date date;
BEGIN
  IF NOT private.is_strict_admin() THEN RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501'; END IF;
  IF p_course_id NOT IN (
    'excel-initiation-inter', 'excel-perfectionnement-inter', 'excel-avance-inter',
    'word-initiation-inter', 'word-perfectionnement-inter', 'powerpoint-initiation-inter', 'ia-creativite-groupe'
  ) OR p_delivery_mode NOT IN ('remote', 'in_person')
    OR p_schedule_format NOT IN ('four_half_days_3h30', 'two_days_2x3h30') THEN
    RAISE EXCEPTION 'Configuration de cohorte invalide.' USING ERRCODE = '22023';
  END IF;
  IF p_capacity IS NULL OR p_capacity <= 0 OR p_minimum_participants IS NULL
    OR p_minimum_participants <= 0 OR p_minimum_participants > p_capacity THEN
    RAISE EXCEPTION 'Capacité et seuil minimum explicites requis.' USING ERRCODE = '22023';
  END IF;
  IF p_course_id = 'ia-creativite-groupe' AND (p_schedule_format <> 'four_half_days_3h30' OR p_minimum_participants <> 4 OR p_capacity NOT BETWEEN 4 AND 6) THEN
    RAISE EXCEPTION 'Créativité : quatre demi-journées, seuil 4, capacité 4 à 6.' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_sessions) <> 'array' OR jsonb_array_length(p_sessions) <> 4 THEN
    RAISE EXCEPTION 'Quatre demi-journées sont requises.' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(slot_id::uuid ORDER BY slot_id::uuid) INTO v_all_slot_ids
  FROM jsonb_array_elements(p_sessions) AS session(value)
  CROSS JOIN LATERAL jsonb_array_elements_text(session.value->'slot_ids') AS slots(slot_id);
  IF cardinality(v_all_slot_ids) <> 28
    OR (SELECT count(DISTINCT id) FROM unnest(v_all_slot_ids) AS selected(id)) <> 28 THEN
    RAISE EXCEPTION 'Vingt-huit demi-heures distinctes sont requises.' USING ERRCODE = '22023';
  END IF;

  PERFORM candidate.id
  FROM public.training_availability_slots AS candidate
  WHERE EXISTS (
    SELECT 1 FROM public.training_availability_slots AS selected
    WHERE selected.id = ANY(v_all_slot_ids)
      AND candidate.starts_at < selected.ends_at
      AND selected.starts_at < candidate.ends_at
  )
  ORDER BY candidate.id FOR UPDATE;

  IF p_cohort_id IS NULL THEN
    INSERT INTO public.course_cohorts (
      course_id, delivery_mode, schedule_format, capacity, minimum_participants, created_by
    ) VALUES (p_course_id, p_delivery_mode, p_schedule_format, p_capacity, p_minimum_participants, v_actor)
    RETURNING id INTO v_cohort_id;
  ELSE
    SELECT id INTO v_cohort_id FROM public.course_cohorts
    WHERE id = p_cohort_id AND status = 'draft' FOR UPDATE;
    IF v_cohort_id IS NULL THEN RAISE EXCEPTION 'Seul un brouillon peut être modifié.' USING ERRCODE = '22023'; END IF;
    SELECT coalesce(array_agg(links.availability_slot_id), ARRAY[]::uuid[]) INTO v_old_slot_ids
    FROM public.course_cohort_session_slots AS links
    JOIN public.course_cohort_sessions AS sessions ON sessions.id = links.cohort_session_id
    WHERE sessions.cohort_id = v_cohort_id;
    UPDATE public.course_cohorts SET
      course_id = p_course_id, delivery_mode = p_delivery_mode, schedule_format = p_schedule_format,
      capacity = p_capacity, minimum_participants = p_minimum_participants, updated_at = now()
    WHERE id = v_cohort_id;
  END IF;

  FOR v_session IN SELECT value FROM jsonb_array_elements(p_sessions) LOOP
    v_position := (v_session->>'position')::integer;
    IF v_position NOT BETWEEN 1 AND 4 OR v_session_dates[v_position] IS NOT NULL
      OR jsonb_typeof(v_session->'slot_ids') <> 'array' OR jsonb_array_length(v_session->'slot_ids') <> 7 THEN
      RAISE EXCEPTION 'Chaque demi-journée doit contenir sept demi-heures et une position unique.' USING ERRCODE = '22023';
    END IF;
    SELECT array_agg(value::uuid ORDER BY value::uuid) INTO v_session_slot_ids
    FROM jsonb_array_elements_text(v_session->'slot_ids');
    IF (SELECT count(DISTINCT id) FROM unnest(v_session_slot_ids) AS selected(id)) <> 7 THEN
      RAISE EXCEPTION 'Un créneau est répété dans une demi-journée.' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_slot_count FROM public.training_availability_slots AS slots
    WHERE slots.id = ANY(v_session_slot_ids) AND slots.is_active AND slots.starts_at > now()
      AND p_delivery_mode = ANY(slots.delivery_modes)
      AND extract(epoch FROM (slots.ends_at - slots.starts_at)) / 60 = 30
      AND (NOT slots.is_reserved OR slots.id = ANY(v_old_slot_ids))
      AND NOT EXISTS (
        SELECT 1 FROM public.calendar_bookings AS booking
        WHERE private.calendar_booking_overlaps(booking.date, booking.slot, slots.starts_at, slots.ends_at)
      );
    IF EXISTS (
      SELECT 1
      FROM public.training_availability_slots AS selected
      JOIN public.training_availability_slots AS occupied
        ON occupied.is_reserved
        AND NOT (occupied.id = ANY(v_old_slot_ids))
        AND occupied.id <> selected.id
        AND occupied.starts_at < selected.ends_at
        AND selected.starts_at < occupied.ends_at
      WHERE selected.id = ANY(v_session_slot_ids)
    ) THEN
      RAISE EXCEPTION 'Un autre créneau chevauchant est déjà réservé.' USING ERRCODE = '23P01';
    END IF;
    WITH ordered AS (
      SELECT starts_at, ends_at, lag(ends_at) OVER (ORDER BY starts_at, id) AS previous_end
      FROM public.training_availability_slots WHERE id = ANY(v_session_slot_ids)
    )
    SELECT count(*) = 7 AND bool_and(previous_end IS NULL OR previous_end = starts_at),
      min(starts_at), max(ends_at), (min(starts_at) AT TIME ZONE 'Europe/Paris')::date
    INTO v_contiguous, v_current_start, v_current_end, v_current_date
    FROM ordered;
    IF v_slot_count <> 7 OR NOT coalesce(v_contiguous, false) THEN
      RAISE EXCEPTION 'Chaque demi-journée doit former exactement 7 demi-heures contiguës.' USING ERRCODE = '22023';
    END IF;
    v_session_starts[v_position] := v_current_start;
    v_session_ends[v_position] := v_current_end;
    v_session_dates[v_position] := v_current_date;
  END LOOP;
  IF EXISTS (SELECT 1 FROM generate_series(2, 4) AS n WHERE v_session_starts[n] <= v_session_starts[n - 1]) THEN
    RAISE EXCEPTION 'Les demi-journées doivent être ordonnées chronologiquement.' USING ERRCODE = '22023';
  END IF;
  IF p_schedule_format = 'four_half_days_3h30'
    AND (SELECT count(DISTINCT value) FROM unnest(v_session_dates) AS dates(value)) <> 4 THEN
    RAISE EXCEPTION 'Quatre dates distinctes sont requises.' USING ERRCODE = '22023';
  END IF;
  IF p_schedule_format = 'two_days_2x3h30' AND (
    (SELECT count(DISTINCT value) FROM unnest(v_session_dates) AS dates(value)) <> 2
    OR v_session_dates[1] <> v_session_dates[2]
    OR v_session_dates[3] <> v_session_dates[4]
    OR v_session_dates[1] = v_session_dates[3]
    OR v_session_starts[2] <= v_session_ends[1]
    OR v_session_starts[4] <= v_session_ends[3]
  ) THEN RAISE EXCEPTION 'Deux journées de deux demi-journées séparées par une pause sont requises.' USING ERRCODE = '22023'; END IF;

  UPDATE public.training_availability_slots SET is_reserved = false
  WHERE id = ANY(v_old_slot_ids) AND NOT (id = ANY(v_all_slot_ids));
  DELETE FROM public.course_cohort_sessions WHERE cohort_id = v_cohort_id;
  FOR v_position IN 1..4 LOOP
    INSERT INTO public.course_cohort_sessions (cohort_id, position, starts_at, ends_at, duration_minutes)
    VALUES (v_cohort_id, v_position, v_session_starts[v_position], v_session_ends[v_position], 210)
    RETURNING id INTO v_cohort_session_id;
    SELECT array_agg(slot_id::uuid) INTO v_session_slot_ids
    FROM jsonb_array_elements(p_sessions) AS session(value)
    CROSS JOIN LATERAL jsonb_array_elements_text(session.value->'slot_ids') AS slots(slot_id)
    WHERE (session.value->>'position')::integer = v_position;
    INSERT INTO public.course_cohort_session_slots (cohort_session_id, availability_slot_id)
    SELECT v_cohort_session_id, id FROM unnest(v_session_slot_ids) AS selected(id);
  END LOOP;
  UPDATE public.training_availability_slots SET is_reserved = true WHERE id = ANY(v_all_slot_ids);
  RETURN v_cohort_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.admin_confirm_course_cohort(p_cohort_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_result uuid;
BEGIN
  IF NOT private.is_strict_admin() THEN RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501'; END IF;
  PERFORM id FROM public.course_cohorts WHERE id=p_cohort_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.course_cohorts WHERE id=p_cohort_id AND course_id='ia-creativite-groupe') THEN
    -- Cohort lock serializes joins/confirmation. Purchases first, then access:
    -- a webhook or gift revocation cannot change eligibility during confirmation.
    PERFORM p.id FROM public.purchases p JOIN public.course_cohort_enrollments e ON e.purchase_id=p.id
      WHERE e.cohort_id=p_cohort_id AND e.status='active' ORDER BY p.id FOR SHARE OF p;
    PERFORM a.id FROM public.course_access a JOIN public.course_cohort_enrollments e ON e.course_access_id=a.id
      WHERE e.cohort_id=p_cohort_id AND e.status='active' ORDER BY a.id FOR SHARE OF a;
  END IF;
  UPDATE public.course_cohorts AS cohorts SET status = 'confirmed', confirmed_at = now(), updated_at = now()
  WHERE cohorts.id = p_cohort_id AND cohorts.status = 'published'
    AND (SELECT count(*) FROM public.course_cohort_enrollments e WHERE e.cohort_id = cohorts.id AND e.status = 'active' AND (cohorts.course_id <> 'ia-creativite-groupe' OR private.creativity_cohort_enrollment_is_eligible(e.id))) >= cohorts.minimum_participants
    AND (cohorts.course_id <> 'ia-creativite-groupe' OR (SELECT count(*) FROM public.course_cohort_enrollments e WHERE e.cohort_id=cohorts.id AND e.status='active' AND private.creativity_cohort_enrollment_is_eligible(e.id)) <= cohorts.capacity)
  RETURNING id INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Le seuil minimum n est pas atteint ou la cohorte n est pas publiable.' USING ERRCODE = '22023'; END IF;
  RETURN v_result;
END;
$function$;
CREATE OR REPLACE FUNCTION public.admin_list_course_cohorts()
 RETURNS TABLE(id uuid, course_id text, delivery_mode text, schedule_format text, status text, capacity integer, minimum_participants integer, enrolled_count bigint, sessions jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.is_strict_admin() THEN RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT cohorts.id, cohorts.course_id, cohorts.delivery_mode, cohorts.schedule_format,
    cohorts.status, cohorts.capacity, cohorts.minimum_participants,
    (SELECT count(*) FROM public.course_cohort_enrollments AS enrollments WHERE enrollments.cohort_id = cohorts.id AND enrollments.status = 'active' AND (cohorts.course_id <> 'ia-creativite-groupe' OR private.creativity_cohort_enrollment_is_eligible(enrollments.id))),
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', sessions.id, 'position', sessions.position, 'starts_at', sessions.starts_at, 'ends_at', sessions.ends_at,
      'duration_minutes', sessions.duration_minutes, 'meeting_url', sessions.meeting_url,
      'google_sync_status', sessions.google_sync_status,
      'google_sync_error_code', sessions.google_sync_error_code,
      'slot_ids', (
        SELECT coalesce(jsonb_agg(links.availability_slot_id ORDER BY slots.starts_at, links.availability_slot_id), '[]'::jsonb)
        FROM public.course_cohort_session_slots AS links
        JOIN public.training_availability_slots AS slots ON slots.id = links.availability_slot_id
        WHERE links.cohort_session_id = sessions.id
      )
    ) ORDER BY sessions.position), '[]'::jsonb)
      FROM public.course_cohort_sessions AS sessions WHERE sessions.cohort_id = cohorts.id)
  FROM public.course_cohorts AS cohorts ORDER BY cohorts.created_at DESC;
END;
$function$;
CREATE OR REPLACE FUNCTION public.list_available_course_cohorts(p_course_id text)
 RETURNS TABLE(id uuid, course_id text, delivery_mode text, schedule_format text, status text, capacity integer, enrolled_count bigint, available_places bigint, sessions jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.course_access AS access
    WHERE access.user_id = v_user AND access.course_id = p_course_id AND access.status = 'active'
      AND (access.expires_at IS NULL OR access.expires_at > now())
      AND (p_course_id <> 'ia-creativite-groupe' OR (access.access_source='gift' AND access.purchase_id IS NULL) OR EXISTS (SELECT 1 FROM public.purchases p WHERE p.id=access.purchase_id AND p.user_id=v_user AND p.course_id=p_course_id AND p.payment_status IN ('paid','partially_refunded')))
  ) THEN RAISE EXCEPTION 'Accès actif requis.' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT cohorts.id, cohorts.course_id, cohorts.delivery_mode, cohorts.schedule_format,
    cohorts.status, cohorts.capacity, counts.enrolled_count,
    greatest(cohorts.capacity - counts.enrolled_count, 0),
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'position', s.position, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'duration_minutes', s.duration_minutes
    ) ORDER BY s.position), '[]'::jsonb) FROM public.course_cohort_sessions s WHERE s.cohort_id = cohorts.id)
  FROM public.course_cohorts cohorts
  CROSS JOIN LATERAL (
    SELECT count(*) AS enrolled_count FROM public.course_cohort_enrollments e
    WHERE e.cohort_id = cohorts.id AND e.status = 'active' AND (cohorts.course_id <> 'ia-creativite-groupe' OR private.creativity_cohort_enrollment_is_eligible(e.id))
  ) counts
  WHERE cohorts.course_id = p_course_id AND cohorts.status IN ('published', 'confirmed')
    AND EXISTS (SELECT 1 FROM public.course_cohort_sessions s WHERE s.cohort_id = cohorts.id AND s.starts_at > now())
    AND (cohorts.course_id <> 'ia-creativite-groupe' OR NOT EXISTS (SELECT 1 FROM public.course_cohort_sessions s WHERE s.cohort_id=cohorts.id AND s.starts_at <= now()))
  ORDER BY (SELECT min(s.starts_at) FROM public.course_cohort_sessions s WHERE s.cohort_id = cohorts.id);
END;
$function$;
CREATE OR REPLACE FUNCTION public.join_course_cohort(p_cohort_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_cohort public.course_cohorts%ROWTYPE;
  v_access public.course_access%ROWTYPE;
  v_count integer;
  v_enrollment public.course_cohort_enrollments%ROWTYPE;
  v_has_paid_purchase boolean := false;
  v_is_gift boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  SELECT cohorts.* INTO v_cohort FROM public.course_cohorts AS cohorts
  WHERE cohorts.id = p_cohort_id FOR UPDATE;
  IF v_cohort.id IS NULL OR v_cohort.status NOT IN ('published', 'confirmed')
    OR NOT EXISTS (SELECT 1 FROM public.course_cohort_sessions AS sessions WHERE sessions.cohort_id = v_cohort.id AND sessions.starts_at > now()) THEN
    RAISE EXCEPTION 'Cohorte non disponible.' USING ERRCODE = '22023';
  END IF;
  IF v_cohort.course_id='ia-creativite-groupe' THEN
    IF EXISTS (SELECT 1 FROM public.course_cohort_sessions s WHERE s.cohort_id=v_cohort.id AND s.starts_at<=now()) THEN RAISE EXCEPTION 'Cette session a déjà commencé.' USING ERRCODE='22023'; END IF;
    PERFORM p.id FROM public.purchases p JOIN public.course_access a ON a.purchase_id=p.id WHERE a.user_id=v_user AND a.course_id=v_cohort.course_id ORDER BY p.id FOR SHARE OF p;
  END IF;
  SELECT access.* INTO v_access FROM public.course_access AS access
  WHERE access.user_id = v_user AND access.course_id = v_cohort.course_id AND access.status = 'active'
    AND (access.expires_at IS NULL OR access.expires_at > now())
  FOR UPDATE;
  IF v_access.id IS NULL THEN
    RAISE EXCEPTION 'Droit commercial actif requis.' USING ERRCODE = '42501';
  END IF;
  v_is_gift := coalesce(v_access.access_source = 'gift' AND v_access.purchase_id IS NULL, false);
  v_has_paid_purchase := v_access.purchase_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.purchases AS purchases WHERE purchases.id = v_access.purchase_id
      AND purchases.user_id = v_user AND purchases.course_id = v_cohort.course_id
      AND purchases.payment_status IN ('paid', 'partially_refunded')
  );
  IF NOT v_is_gift AND NOT v_has_paid_purchase THEN
    RAISE EXCEPTION 'Droit commercial actif requis.' USING ERRCODE = '42501';
  END IF;
  IF v_cohort.course_id='ia-creativite-groupe' THEN
    UPDATE public.course_cohort_enrollments e SET status='cancelled', cancelled_at=now(), updated_at=now() WHERE e.user_id=v_user AND e.course_id=v_cohort.course_id AND e.status='active' AND NOT private.creativity_cohort_enrollment_is_eligible(e.id);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.course_cohort_enrollments AS enrollments
    WHERE enrollments.user_id = v_user AND enrollments.course_id = v_cohort.course_id AND enrollments.status = 'active'
  ) THEN RAISE EXCEPTION 'Une inscription inter existe déjà pour cette formation.' USING ERRCODE = '23505'; END IF;

  IF EXISTS (SELECT 1 FROM public.course_cohorts WHERE id=p_cohort_id AND course_id='ia-creativite-groupe') THEN
    -- Cohort lock serializes joins/confirmation. Purchases first, then access:
    -- a webhook or gift revocation cannot change eligibility during confirmation.
    PERFORM p.id FROM public.purchases p JOIN public.course_cohort_enrollments e ON e.purchase_id=p.id
      WHERE e.cohort_id=p_cohort_id AND e.status='active' ORDER BY p.id FOR SHARE OF p;
    PERFORM a.id FROM public.course_access a JOIN public.course_cohort_enrollments e ON e.course_access_id=a.id
      WHERE e.cohort_id=p_cohort_id AND e.status='active' ORDER BY a.id FOR SHARE OF a;
  END IF;
  IF v_cohort.course_id='ia-creativite-groupe' THEN
    -- Permanently release invalid seats before admitting a replacement. A later
    -- reactivation of the old entitlement cannot silently overbook this group.
    UPDATE public.course_cohort_enrollments e SET status='cancelled', cancelled_at=now(), updated_at=now() WHERE e.cohort_id=v_cohort.id AND e.status='active' AND NOT private.creativity_cohort_enrollment_is_eligible(e.id);
  END IF;
  SELECT count(*) INTO v_count FROM public.course_cohort_enrollments AS enrollments
  WHERE enrollments.cohort_id = v_cohort.id AND enrollments.status = 'active' AND (v_cohort.course_id <> 'ia-creativite-groupe' OR private.creativity_cohort_enrollment_is_eligible(enrollments.id));
  IF v_count >= v_cohort.capacity THEN RAISE EXCEPTION 'Cette cohorte est complète.' USING ERRCODE = '40001'; END IF;
  INSERT INTO public.course_cohort_enrollments (
    cohort_id, course_id, user_id, course_access_id, purchase_id
  ) VALUES (v_cohort.id, v_cohort.course_id, v_user, v_access.id, v_access.purchase_id)
  RETURNING * INTO v_enrollment;
  RETURN jsonb_build_object('id', v_enrollment.id, 'cohort_id', v_enrollment.cohort_id,
    'status', v_enrollment.status, 'joined_at', v_enrollment.joined_at);
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_my_course_cohort_enrollment(p_course_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_user uuid := (SELECT auth.uid()); v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'id', e.id, 'cohort_id', e.cohort_id, 'course_id', e.course_id, 'status', e.status, 'joined_at', e.joined_at,
    'is_paid', e.purchase_id IS NOT NULL, 'cohort_status', c.status, 'delivery_mode', c.delivery_mode, 'schedule_format', c.schedule_format,
    'sessions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'position', s.position, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'duration_minutes', s.duration_minutes, 'meeting_url', CASE WHEN c.course_id <> 'ia-creativite-groupe' OR (c.status='confirmed' AND private.creativity_cohort_enrollment_is_eligible(e.id)) THEN s.meeting_url ELSE NULL END
    ) ORDER BY s.position), '[]'::jsonb) FROM public.course_cohort_sessions s WHERE s.cohort_id = c.id)
  ) INTO v_result
  FROM public.course_cohort_enrollments e
  JOIN public.course_cohorts c ON c.id = e.cohort_id
  JOIN public.course_access AS access
    ON access.id = e.course_access_id
    AND access.user_id = e.user_id
    AND access.course_id = e.course_id
    AND ((access.status = 'active' AND (access.expires_at IS NULL OR access.expires_at > now())) OR (e.course_id='ia-creativite-groupe' AND e.status='cohort_cancelled_refund_review'))
  WHERE e.user_id = v_user AND e.course_id = p_course_id AND (e.status IN ('active', 'completed') OR (e.course_id='ia-creativite-groupe' AND e.status='cohort_cancelled_refund_review'))
    AND (e.course_id <> 'ia-creativite-groupe' OR e.status='cohort_cancelled_refund_review' OR private.creativity_cohort_enrollment_is_eligible(e.id))
  ORDER BY e.joined_at DESC LIMIT 1;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_creativity_cohort_participants(p_cohort_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT private.is_strict_admin() THEN RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.course_cohorts WHERE id=p_cohort_id AND course_id='ia-creativite-groupe') THEN RAISE EXCEPTION 'Groupe créativité requis.' USING ERRCODE='22023'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'user_id',e.user_id,'name',coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),'Apprenant'),
    'status',e.status,'is_gift',a.access_source='gift' AND a.purchase_id IS NULL,
    'payment_status',p.payment_status,'eligible',private.creativity_cohort_enrollment_is_eligible(e.id)
  ) ORDER BY e.joined_at),'[]'::jsonb)
  FROM public.course_cohort_enrollments e JOIN public.course_access a ON a.id=e.course_access_id
  JOIN auth.users u ON u.id=e.user_id LEFT JOIN public.purchases p ON p.id=e.purchase_id
  WHERE e.cohort_id=p_cohort_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_creativity_cohort_participants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_creativity_cohort_participants(uuid) TO authenticated;
COMMIT;
