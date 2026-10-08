-- Éligibilité cohérente des dossiers administratifs, cadeaux et achats pour la créativité.
BEGIN;
ALTER TABLE public.training_enrollments DROP CONSTRAINT training_enrollments_course_id_check;
ALTER TABLE public.training_enrollments ADD CONSTRAINT training_enrollments_course_id_check
  CHECK (course_id IN ('formation-ia','formation-ia-act','formation-prompt-level-1',
    'ia-creativite-groupe','ia-creativite-individuel','ia-creativite-ecole-association'));
ALTER TABLE public.training_documents DROP CONSTRAINT training_documents_course_id_check;
ALTER TABLE public.training_documents ADD CONSTRAINT training_documents_course_id_check
  CHECK (course_id IN ('formation-ia','formation-ia-act','formation-prompt-level-1',
    'ia-creativite-groupe','ia-creativite-individuel','ia-creativite-ecole-association'));

CREATE OR REPLACE FUNCTION private.creativity_course_access_is_eligible(p_access_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.course_access access
    WHERE access.id = p_access_id AND access.status = 'active'
      AND (access.expires_at IS NULL OR access.expires_at > now())
      AND access.course_id IN ('ia-creativite-groupe','ia-creativite-individuel','ia-creativite-ecole-association')
      AND (
        (access.access_source = 'gift' AND access.purchase_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.purchases purchase
          WHERE purchase.id = access.purchase_id AND purchase.user_id = access.user_id
            AND purchase.course_id = access.course_id
            AND purchase.payment_status IN ('paid','partially_refunded'))
        OR (access.access_source IN ('manual','opco') AND access.purchase_id IS NULL
          AND EXISTS (SELECT 1 FROM public.training_enrollments enrollment
            WHERE enrollment.course_access_id = access.id AND enrollment.user_id = access.user_id
              AND enrollment.course_id = access.course_id
              AND enrollment.status IN ('validated','in_progress','completed')))
      )
  );
$function$;
REVOKE ALL ON FUNCTION private.creativity_course_access_is_eligible(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_creativity_booking_access(p_course_id text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE='42501'; END IF;
  IF p_course_id NOT IN ('ia-creativite-groupe','ia-creativite-individuel') THEN
    RAISE EXCEPTION 'Formule non admissible.' USING ERRCODE='22023';
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.course_access access
    WHERE access.user_id = v_user AND access.course_id = p_course_id
      AND private.creativity_course_access_is_eligible(access.id));
END;
$function$;
REVOKE ALL ON FUNCTION public.has_creativity_booking_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_creativity_booking_access(text) TO authenticated;

DROP POLICY IF EXISTS "Lecture des disponibilités selon le rôle" ON public.training_availability_slots;
CREATE POLICY "Lecture des disponibilités selon le rôle" ON public.training_availability_slots FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('admin','employee')) OR
  (is_active AND NOT is_reserved AND starts_at > now()
   AND NOT EXISTS (SELECT 1 FROM public.calendar_bookings booking WHERE private.calendar_booking_overlaps(booking.date,booking.slot,training_availability_slots.starts_at,training_availability_slots.ends_at))
   AND EXISTS (SELECT 1 FROM public.course_access access WHERE access.user_id=auth.uid()
     AND access.course_id IN ('formation-ia','formation-ia-act','formation-prompt-level-1','excel-initiation-individuel','excel-perfectionnement-individuel','excel-avance-individuel','word-initiation-individuel','word-perfectionnement-individuel','powerpoint-initiation-individuel','ia-creativite-individuel')
     AND access.status='active' AND (access.expires_at IS NULL OR access.expires_at>now())
     AND (access.course_id <> 'ia-creativite-individuel' OR public.has_creativity_booking_access('ia-creativite-individuel')))));

CREATE OR REPLACE FUNCTION private.creativity_cohort_enrollment_is_eligible(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_cohort_enrollments e
    JOIN public.course_access a ON a.id=e.course_access_id AND a.user_id=e.user_id AND a.course_id=e.course_id
    LEFT JOIN public.purchases p ON p.id=a.purchase_id AND p.user_id=e.user_id AND p.course_id=e.course_id
    WHERE e.id=p_id AND e.status='active' AND a.status='active'
      AND (a.expires_at IS NULL OR a.expires_at>now())
      AND e.purchase_id IS NOT DISTINCT FROM a.purchase_id
      AND private.creativity_course_access_is_eligible(a.id)
  );
$$;

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
      AND (p_course_id <> 'ia-creativite-groupe' OR private.creativity_course_access_is_eligible(access.id))
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
  IF v_cohort.course_id = 'ia-creativite-groupe' AND NOT private.creativity_course_access_is_eligible(v_access.id) THEN
    RAISE EXCEPTION 'Droit actif associé à une formule admissible requis.' USING ERRCODE = '42501';
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
    'is_paid', e.purchase_id IS NOT NULL, 'access_source', access.access_source, 'is_administrative', (access.access_source IN ('manual','opco') AND private.creativity_course_access_is_eligible(access.id)), 'cohort_status', c.status, 'delivery_mode', c.delivery_mode, 'schedule_format', c.schedule_format,
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
    'payment_status',p.payment_status,'eligible',private.creativity_cohort_enrollment_is_eligible(e.id),'access_source',a.access_source,'has_purchase',e.purchase_id IS NOT NULL,'is_administrative',(a.access_source IN ('manual','opco') AND private.creativity_course_access_is_eligible(a.id))
  ) ORDER BY e.joined_at),'[]'::jsonb)
  FROM public.course_cohort_enrollments e JOIN public.course_access a ON a.id=e.course_access_id
  JOIN auth.users u ON u.id=e.user_id LEFT JOIN public.purchases p ON p.id=e.purchase_id
  WHERE e.cohort_id=p_cohort_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_creativity_cohort_candidates(p_cohort_id uuid)
RETURNS TABLE(user_id uuid, name text, email text, access_source text, already_enrolled boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_strict_admin() THEN
    RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.course_cohorts AS cohorts
    WHERE cohorts.id = p_cohort_id AND cohorts.course_id = 'ia-creativite-groupe'
  ) THEN
    RAISE EXCEPTION 'Groupe créativité requis.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH eligible_access AS (
    SELECT DISTINCT ON (access.user_id)
      access.user_id, access.access_source::text AS access_source
    FROM public.course_access AS access
    WHERE access.course_id = 'ia-creativite-groupe'
      AND access.status = 'active'
      AND (access.expires_at IS NULL OR access.expires_at > now())
      AND private.creativity_course_access_is_eligible(access.id)
    ORDER BY access.user_id, access.access_source::text
  )
  SELECT eligible.user_id,
    coalesce(nullif(btrim(users.raw_user_meta_data->>'full_name'), ''), 'Apprenant')::text,
    coalesce(users.email, '')::text,
    eligible.access_source,
    EXISTS (
      SELECT 1 FROM public.course_cohort_enrollments AS enrollments
      WHERE enrollments.user_id = eligible.user_id
        AND enrollments.course_id = 'ia-creativite-groupe'
        AND enrollments.status = 'active'
        AND private.creativity_cohort_enrollment_is_eligible(enrollments.id)
    )
  FROM eligible_access AS eligible
  JOIN auth.users AS users ON users.id = eligible.user_id
  ORDER BY 2, 3, eligible.user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_enroll_creativity_cohort(p_cohort_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_cohort public.course_cohorts%ROWTYPE;
  v_access public.course_access%ROWTYPE;
  v_enrollment public.course_cohort_enrollments%ROWTYPE;
  v_count integer := 0;
  v_released_rows integer := 0;
  v_target_released_rows integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_strict_admin() THEN
    RAISE EXCEPTION 'Action réservée à l administrateur.' USING ERRCODE = '42501';
  END IF;

  SELECT cohorts.* INTO v_cohort
  FROM public.course_cohorts AS cohorts
  WHERE cohorts.id = p_cohort_id
  FOR UPDATE;
  IF v_cohort.id IS NULL OR v_cohort.course_id <> 'ia-creativite-groupe'
    OR v_cohort.status NOT IN ('published', 'confirmed') THEN
    RAISE EXCEPTION 'Cohorte créativité non disponible.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.course_cohort_sessions AS sessions
      WHERE sessions.cohort_id = v_cohort.id) <> 4
    OR EXISTS (
      SELECT 1 FROM public.course_cohort_sessions AS sessions
      WHERE sessions.cohort_id = v_cohort.id AND sessions.starts_at <= now()
    ) THEN
    RAISE EXCEPTION 'Toutes les séances doivent être futures.' USING ERRCODE = '22023';
  END IF;

  -- Same lock order as join_course_cohort: cohort, purchases, then access.
  PERFORM purchases.id
  FROM public.purchases AS purchases
  JOIN public.course_access AS access ON access.purchase_id = purchases.id
  WHERE access.user_id = p_user_id
    AND access.course_id = 'ia-creativite-groupe'
  ORDER BY purchases.id
  FOR SHARE OF purchases;

  SELECT access.* INTO v_access
  FROM public.course_access AS access
  WHERE access.user_id = p_user_id
    AND access.course_id = 'ia-creativite-groupe'
    AND access.status = 'active'
    AND (access.expires_at IS NULL OR access.expires_at > now())
  FOR UPDATE;
  IF v_access.id IS NULL THEN
    RAISE EXCEPTION 'Un droit actif à la formule groupe est requis.' USING ERRCODE = '42501';
  END IF;
  IF NOT private.creativity_course_access_is_eligible(v_access.id) THEN
    RAISE EXCEPTION 'Un droit actif associé à un dossier, cadeau ou achat admissible est requis.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_target_released_rows
  FROM public.course_cohort_enrollments AS enrollments
  WHERE enrollments.user_id = p_user_id
    AND enrollments.course_id = 'ia-creativite-groupe'
    AND enrollments.cohort_id = v_cohort.id
    AND enrollments.status = 'active'
    AND NOT private.creativity_cohort_enrollment_is_eligible(enrollments.id);

  -- Match learner join: release only this user's obsolete active creativity rows.
  UPDATE public.course_cohort_enrollments AS enrollments
  SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE enrollments.user_id = p_user_id
    AND enrollments.course_id = 'ia-creativite-groupe'
    AND enrollments.status = 'active'
    AND NOT private.creativity_cohort_enrollment_is_eligible(enrollments.id);
  GET DIAGNOSTICS v_released_rows = ROW_COUNT;
  IF v_released_rows < v_target_released_rows THEN
    RAISE EXCEPTION 'Une inscription a changé pendant la vérification.' USING ERRCODE = '40001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.course_cohort_enrollments AS enrollments
    WHERE enrollments.user_id = p_user_id
      AND enrollments.course_id = 'ia-creativite-groupe'
      AND enrollments.status = 'active'
      AND enrollments.cohort_id <> v_cohort.id
  ) THEN
    RAISE EXCEPTION 'Cette personne est déjà inscrite à un autre groupe créativité.' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.course_cohort_enrollments AS enrollments
    WHERE enrollments.user_id = p_user_id
      AND enrollments.course_id = 'ia-creativite-groupe'
      AND enrollments.cohort_id = v_cohort.id
      AND enrollments.status = 'active'
      AND private.creativity_cohort_enrollment_is_eligible(enrollments.id)
  ) THEN
    SELECT enrollments.* INTO v_enrollment
    FROM public.course_cohort_enrollments AS enrollments
    WHERE enrollments.user_id = p_user_id
      AND enrollments.course_id = 'ia-creativite-groupe'
      AND enrollments.cohort_id = v_cohort.id
      AND enrollments.status = 'active'
      AND private.creativity_cohort_enrollment_is_eligible(enrollments.id)
    LIMIT 1;
    RETURN jsonb_build_object('id', v_enrollment.id, 'cohort_id', v_enrollment.cohort_id,
      'status', v_enrollment.status, 'joined_at', v_enrollment.joined_at);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.course_cohort_enrollments AS enrollments
    WHERE enrollments.user_id = p_user_id
      AND enrollments.course_id = 'ia-creativite-groupe'
      AND enrollments.cohort_id = v_cohort.id
      AND enrollments.status IN ('cancelled', 'completed', 'cohort_cancelled_refund_review')
  ) AND v_target_released_rows = 0 THEN
    RAISE EXCEPTION 'Une inscription historique existe déjà sur ce groupe.' USING ERRCODE = '23505';
  END IF;

  PERFORM purchases.id
  FROM public.purchases AS purchases
  JOIN public.course_cohort_enrollments AS enrollments ON enrollments.purchase_id = purchases.id
  WHERE enrollments.cohort_id = v_cohort.id AND enrollments.status = 'active'
  ORDER BY purchases.id
  FOR SHARE OF purchases;
  PERFORM access.id
  FROM public.course_access AS access
  JOIN public.course_cohort_enrollments AS enrollments ON enrollments.course_access_id = access.id
  WHERE enrollments.cohort_id = v_cohort.id AND enrollments.status = 'active'
  ORDER BY access.id
  FOR SHARE OF access;

  SELECT count(*) INTO v_count
  FROM public.course_cohort_enrollments AS enrollments
  WHERE enrollments.cohort_id = v_cohort.id
    AND enrollments.status = 'active'
    AND private.creativity_cohort_enrollment_is_eligible(enrollments.id);
  IF v_count >= v_cohort.capacity THEN
    RAISE EXCEPTION 'Cette cohorte est complète.' USING ERRCODE = '40001';
  END IF;

  IF v_target_released_rows > 0 THEN
    UPDATE public.course_cohort_enrollments AS enrollments
    SET course_access_id = v_access.id,
        purchase_id = v_access.purchase_id,
        status = 'active',
        cancelled_at = NULL,
        updated_at = now()
    WHERE enrollments.user_id = p_user_id
      AND enrollments.course_id = 'ia-creativite-groupe'
      AND enrollments.cohort_id = v_cohort.id
      AND enrollments.status = 'cancelled';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'L inscription historique ne peut pas être réactivée.' USING ERRCODE = '23505';
    END IF;
    SELECT enrollments.* INTO v_enrollment
    FROM public.course_cohort_enrollments AS enrollments
    WHERE enrollments.user_id = p_user_id
      AND enrollments.course_id = 'ia-creativite-groupe'
      AND enrollments.cohort_id = v_cohort.id
      AND enrollments.status = 'active';
    RETURN jsonb_build_object('id', v_enrollment.id, 'cohort_id', v_enrollment.cohort_id,
      'status', v_enrollment.status, 'joined_at', v_enrollment.joined_at);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.course_cohort_enrollments AS enrollments
    WHERE enrollments.user_id = p_user_id
      AND enrollments.course_id = 'ia-creativite-groupe'
      AND enrollments.cohort_id = v_cohort.id
  ) THEN
    RAISE EXCEPTION 'Une inscription historique existe déjà sur ce groupe.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.course_cohort_enrollments (
    cohort_id, course_id, user_id, course_access_id, purchase_id
  ) VALUES (
    v_cohort.id, v_cohort.course_id, p_user_id, v_access.id, v_access.purchase_id
  ) RETURNING * INTO v_enrollment;
  RETURN jsonb_build_object('id', v_enrollment.id, 'cohort_id', v_enrollment.cohort_id,
    'status', v_enrollment.status, 'joined_at', v_enrollment.joined_at);
END;
$function$;

CREATE OR REPLACE FUNCTION private.create_bureautique_booking_request(
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
  v_slot_count integer;
  v_groups_valid boolean;
  v_dates_valid boolean;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  IF p_course_id NOT IN (
    'excel-initiation-individuel', 'excel-perfectionnement-individuel', 'excel-avance-individuel',
    'word-initiation-individuel', 'word-perfectionnement-individuel', 'powerpoint-initiation-individuel', 'ia-creativite-individuel'
  ) THEN RAISE EXCEPTION 'Formation non réservable.'; END IF;
  IF p_schedule_format NOT IN ('four_half_days_3h30', 'two_days_2x3h30')
    OR p_delivery_mode NOT IN ('remote', 'in_person') THEN
    RAISE EXCEPTION 'Rythme incompatible avec la formation ou la modalité choisie.';
  END IF;
  IF cardinality(p_slot_ids) <> 28
    OR (SELECT count(DISTINCT slot_id) FROM unnest(p_slot_ids) AS selected(slot_id)) <> 28 THEN
    RAISE EXCEPTION 'Les horaires choisis sont incomplets ou en double.';
  END IF;
  IF p_course_id = 'ia-creativite-individuel' THEN
    -- Même ordre de verrouillage que le cycle de remboursement : achat, puis droit.
    PERFORM p.id FROM public.purchases p JOIN public.course_access a ON a.purchase_id = p.id
      WHERE a.user_id = v_user_id AND a.course_id = p_course_id ORDER BY p.id FOR SHARE OF p;
    PERFORM a.id FROM public.course_access a WHERE a.user_id = v_user_id
      AND a.course_id = p_course_id ORDER BY a.id FOR SHARE;
    IF NOT EXISTS (SELECT 1 FROM public.course_access a WHERE a.user_id = v_user_id
      AND a.course_id = p_course_id AND private.creativity_course_access_is_eligible(a.id)) THEN
      RAISE EXCEPTION 'Droit actif associé à un dossier, cadeau ou achat admissible requis.' USING ERRCODE = '42501';
    END IF;
    -- Le présentiel de ce service a lieu à Calais, sans déplacement facturé.
    IF p_delivery_mode = 'in_person' THEN p_city := 'Calais'; p_postal_code := '62100'; END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.course_access
    WHERE user_id = v_user_id AND course_id = p_course_id AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN RAISE EXCEPTION 'Accès à la formation requis.' USING ERRCODE = '42501'; END IF;
  IF p_delivery_mode = 'in_person'
    AND (btrim(coalesce(p_city, '')) = '' OR coalesce(p_postal_code, '') !~ '^[0-9]{5}$') THEN
    RAISE EXCEPTION 'Commune et code postal valides requis pour le présentiel.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.course_booking_requests WHERE user_id = v_user_id AND course_id = p_course_id
  ) THEN RAISE EXCEPTION 'Une demande existe déjà pour cette formation.' USING ERRCODE = '23505'; END IF;

  PERFORM candidate.id
  FROM public.training_availability_slots AS candidate
  WHERE EXISTS (
    SELECT 1 FROM public.training_availability_slots AS selected
    WHERE selected.id = ANY(p_slot_ids)
      AND candidate.starts_at < selected.ends_at
      AND selected.starts_at < candidate.ends_at
  )
  ORDER BY candidate.id FOR UPDATE;
  SELECT count(*) INTO v_slot_count
  FROM public.training_availability_slots AS slots
  WHERE slots.id = ANY(p_slot_ids)
    AND slots.is_active AND NOT slots.is_reserved AND slots.starts_at > now()
    AND p_delivery_mode = ANY(slots.delivery_modes)
    AND extract(epoch FROM (slots.ends_at - slots.starts_at)) / 60 = 30
    AND NOT EXISTS (
      SELECT 1 FROM public.training_availability_slots AS occupied
      WHERE occupied.is_reserved AND occupied.id <> slots.id
        AND occupied.starts_at < slots.ends_at AND slots.starts_at < occupied.ends_at
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.calendar_bookings AS booking
      WHERE private.calendar_booking_overlaps(booking.date, booking.slot, slots.starts_at, slots.ends_at)
    );
  IF v_slot_count <> 28 THEN
    RAISE EXCEPTION 'Une ou plusieurs demi-heures ne sont plus disponibles.' USING ERRCODE = '23505';
  END IF;

  WITH ordered AS (
    SELECT starts_at, ends_at, row_number() OVER (ORDER BY starts_at, id) AS n,
      lag(ends_at) OVER (ORDER BY starts_at, id) AS previous_end
    FROM public.training_availability_slots WHERE id = ANY(p_slot_ids)
  ), grouped AS (
    SELECT ((n - 1) / 7)::integer AS group_no,
      count(*) AS slots_count, min(starts_at) AS starts_at, max(ends_at) AS ends_at,
      bool_and(n % 7 = 1 OR previous_end = starts_at) AS contiguous
    FROM ordered GROUP BY ((n - 1) / 7)::integer
  )
  SELECT count(*) = 4 AND bool_and(slots_count = 7 AND contiguous) INTO v_groups_valid FROM grouped;

  WITH ordered AS (
    SELECT starts_at, ends_at, row_number() OVER (ORDER BY starts_at, id) AS n
    FROM public.training_availability_slots WHERE id = ANY(p_slot_ids)
  ), grouped AS (
    SELECT ((n - 1) / 7)::integer AS group_no,
      min(starts_at) AS starts_at, max(ends_at) AS ends_at,
      (min(starts_at) AT TIME ZONE 'Europe/Paris')::date AS local_date
    FROM ordered GROUP BY ((n - 1) / 7)::integer
  ), per_day AS (
    SELECT local_date, count(*) AS group_count,
      bool_and(next_start IS NULL OR next_start > ends_at) AS separated
    FROM (
      SELECT *, lead(starts_at) OVER (PARTITION BY local_date ORDER BY starts_at) AS next_start
      FROM grouped
    ) AS sequenced GROUP BY local_date
  )
  SELECT CASE p_schedule_format
    WHEN 'four_half_days_3h30' THEN count(*) = 4 AND bool_and(group_count = 1)
    WHEN 'two_days_2x3h30' THEN count(*) = 2 AND bool_and(group_count = 2 AND separated)
    ELSE false END
  INTO v_dates_valid FROM per_day;
  IF NOT coalesce(v_groups_valid, false) OR NOT coalesce(v_dates_valid, false) THEN
    RAISE EXCEPTION 'Les horaires choisis ne forment pas le rythme de 14 heures demandé.';
  END IF;

  INSERT INTO public.course_booking_requests (
    user_id, course_id, delivery_mode, schedule_format, city, postal_code,
    status, distance_status, travel_fee_amount, travel_fee_status
  ) VALUES (
    v_user_id, p_course_id, p_delivery_mode, p_schedule_format,
    CASE WHEN p_delivery_mode = 'in_person' THEN btrim(p_city) ELSE NULL END,
    CASE WHEN p_delivery_mode = 'in_person' THEN p_postal_code ELSE NULL END,
    CASE WHEN p_delivery_mode = 'remote' OR p_course_id = 'ia-creativite-individuel' THEN 'confirmed' ELSE 'pending_distance' END,
    CASE WHEN p_delivery_mode = 'remote' OR p_course_id = 'ia-creativite-individuel' THEN 'not_required' ELSE 'pending' END,
    0, 'not_required'
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.course_session_bookings (
    booking_request_id, user_id, availability_slot_id, starts_at, ends_at,
    duration_minutes, delivery_mode, status
  )
  SELECT v_request_id, v_user_id, slots.id, slots.starts_at, slots.ends_at, 30,
    p_delivery_mode, CASE WHEN p_delivery_mode = 'remote' OR p_course_id = 'ia-creativite-individuel' THEN 'confirmed' ELSE 'pending' END
  FROM public.training_availability_slots AS slots WHERE slots.id = ANY(p_slot_ids);
  UPDATE public.training_availability_slots SET is_reserved = true WHERE id = ANY(p_slot_ids);
  RETURN v_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_creativity_cohort_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_creativity_cohort_candidates(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_enroll_creativity_cohort(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_enroll_creativity_cohort(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_get_creativity_cohort_participants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_creativity_cohort_participants(uuid) TO authenticated;
COMMIT;
