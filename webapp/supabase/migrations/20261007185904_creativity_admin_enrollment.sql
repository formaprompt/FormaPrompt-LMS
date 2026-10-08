BEGIN;

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
      AND (
        (access.access_source = 'gift' AND access.purchase_id IS NULL)
        OR EXISTS (
          SELECT 1 FROM public.purchases AS purchases
          WHERE purchases.id = access.purchase_id
            AND purchases.user_id = access.user_id
            AND purchases.course_id = access.course_id
            AND purchases.payment_status IN ('paid', 'partially_refunded')
        )
      )
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
REVOKE ALL ON FUNCTION public.admin_list_creativity_cohort_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_creativity_cohort_candidates(uuid) TO authenticated;

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
  v_is_gift boolean := false;
  v_has_paid_purchase boolean := false;
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
  v_is_gift := coalesce(v_access.access_source = 'gift' AND v_access.purchase_id IS NULL, false);
  v_has_paid_purchase := v_access.purchase_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.purchases AS purchases
    WHERE purchases.id = v_access.purchase_id
      AND purchases.user_id = p_user_id
      AND purchases.course_id = 'ia-creativite-groupe'
      AND purchases.payment_status IN ('paid', 'partially_refunded')
  );
  IF NOT v_is_gift AND NOT v_has_paid_purchase THEN
    RAISE EXCEPTION 'Un droit actif à la formule groupe est requis.' USING ERRCODE = '42501';
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
REVOKE ALL ON FUNCTION public.admin_enroll_creativity_cohort(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_enroll_creativity_cohort(uuid, uuid) TO authenticated;

COMMIT;
