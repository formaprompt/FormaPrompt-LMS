-- Étend l'attribution administrative aux offres commerciales bureautiques.
-- Un cadeau reste un course_access exact, audité et sans achat fictif.

BEGIN;

ALTER TABLE public.course_cohort_enrollments
  ALTER COLUMN purchase_id DROP NOT NULL;

COMMENT ON COLUMN public.course_cohort_enrollments.purchase_id IS
  'Achat payé ayant autorisé l inscription, ou NULL pour un droit cadeau attribué par un administrateur strict.';

CREATE OR REPLACE FUNCTION public.admin_grant_course_access(
  p_target_user_id uuid,
  p_course_id text,
  p_reason text DEFAULT 'Attribution administrative explicite'
)
RETURNS public.course_access
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course_id text := btrim(coalesce(p_course_id, ''));
  v_existing public.course_access%ROWTYPE;
  v_result public.course_access%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) < 5 OR char_length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'Un motif de 5 à 2000 caractères est requis.';
  END IF;
  IF v_course_id NOT IN (
    'formation-ia', 'formation-ia-act', 'formation-prompt-level-1',
    'excel-initiation-inter', 'excel-initiation-individuel',
    'excel-perfectionnement-inter', 'excel-perfectionnement-individuel',
    'excel-avance-inter', 'excel-avance-individuel',
    'word-initiation-inter', 'word-initiation-individuel',
    'word-perfectionnement-inter', 'word-perfectionnement-individuel',
    'powerpoint-initiation-inter', 'powerpoint-initiation-individuel'
  ) THEN
    RAISE EXCEPTION 'Formation non autorisée pour une attribution administrative.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Compte apprenant introuvable.' USING ERRCODE = 'P0002';
  END IF;

  SELECT access.* INTO v_existing
  FROM public.course_access AS access
  WHERE access.user_id = p_target_user_id AND access.course_id = v_course_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'active'
      AND (v_existing.expires_at IS NULL OR v_existing.expires_at > now()) THEN
      RETURN v_existing;
    END IF;
    RAISE EXCEPTION 'Un droit existe déjà. Utilisez une décision explicite de cycle de vie.';
  END IF;

  PERFORM set_config('formaprompt.audit_reason', btrim(p_reason), true);
  INSERT INTO public.course_access (
    user_id, course_id, status, access_source, granted_at,
    expires_at, status_changed_at, updated_at
  ) VALUES (
    p_target_user_id, v_course_id, 'active', 'gift', now(),
    NULL, now(), now()
  )
  ON CONFLICT (user_id, course_id) DO NOTHING
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    SELECT access.* INTO v_existing
    FROM public.course_access AS access
    WHERE access.user_id = p_target_user_id AND access.course_id = v_course_id
    FOR UPDATE;
    IF v_existing.id IS NOT NULL
      AND v_existing.status = 'active'
      AND (v_existing.expires_at IS NULL OR v_existing.expires_at > now()) THEN
      RETURN v_existing;
    END IF;
    RAISE EXCEPTION 'Un droit existe déjà. Utilisez une décision explicite de cycle de vie.';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_course_access(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_course_access(uuid, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.join_course_cohort(p_cohort_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
  IF EXISTS (
    SELECT 1 FROM public.course_cohort_enrollments AS enrollments
    WHERE enrollments.user_id = v_user AND enrollments.course_id = v_cohort.course_id AND enrollments.status = 'active'
  ) THEN RAISE EXCEPTION 'Une inscription inter existe déjà pour cette formation.' USING ERRCODE = '23505'; END IF;
  SELECT count(*) INTO v_count FROM public.course_cohort_enrollments AS enrollments
  WHERE enrollments.cohort_id = v_cohort.id AND enrollments.status = 'active';
  IF v_count >= v_cohort.capacity THEN RAISE EXCEPTION 'Cette cohorte est complète.' USING ERRCODE = '40001'; END IF;
  INSERT INTO public.course_cohort_enrollments (
    cohort_id, course_id, user_id, course_access_id, purchase_id
  ) VALUES (v_cohort.id, v_cohort.course_id, v_user, v_access.id, v_access.purchase_id)
  RETURNING * INTO v_enrollment;
  RETURN jsonb_build_object('id', v_enrollment.id, 'cohort_id', v_enrollment.cohort_id,
    'status', v_enrollment.status, 'joined_at', v_enrollment.joined_at);
END;
$$;

REVOKE ALL ON FUNCTION public.join_course_cohort(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_course_cohort(uuid)
  TO authenticated;

COMMIT;
