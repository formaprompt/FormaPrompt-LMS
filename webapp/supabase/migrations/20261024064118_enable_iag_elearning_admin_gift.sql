-- PROPOSITION NON APPLIQUEE : cadeau IAG seulement, aucune activation de cours.
-- Reprise integrale de la derniere fonction du 20261007164124 ; seul l'ID IAG est ajoute.
-- Les ACL existantes, l'audit et les refus des droits inactifs sont conserves.
BEGIN;

-- Stopper une divergence de fonction en base plutot que remplacer une evolution inconnue.
-- MD5 sert uniquement de temoin de contenu normalise CRLF/LF, pas de preuve de securite.
DO $iag_gift_preflight$
DECLARE
  v_function pg_catalog.pg_proc%ROWTYPE;
BEGIN
  SELECT * INTO v_function FROM pg_catalog.pg_proc
  WHERE oid = pg_catalog.to_regprocedure('public.admin_grant_course_access(uuid,text,text)');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Precondition IAG cadeau : fonction existante absente.';
  END IF;
  IF v_function.prorettype IS DISTINCT FROM pg_catalog.to_regtype('public.course_access')
    OR NOT v_function.prosecdef
    OR v_function.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
    OR NOT ('search_path=""' = ANY(coalesce(v_function.proconfig, ARRAY[]::text[])))
    OR pg_catalog.md5(pg_catalog.replace(v_function.prosrc, E'\r\n', E'\n')) NOT IN (
      '6d8419ff3f93138d42f42719fb286da8', -- fonction historique attendue
      '6835a2a5c5ee97c796f6bcc699107176'  -- meme migration deja executee, sans evolution ulterieure
    )
  THEN
    RAISE EXCEPTION 'Precondition IAG cadeau : fonction divergente, revue requise.';
  END IF;
END;
$iag_gift_preflight$;

CREATE OR REPLACE FUNCTION public.admin_grant_course_access(p_target_user_id uuid, p_course_id text, p_reason text DEFAULT 'Attribution administrative explicite'::text)
 RETURNS course_access
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'formation-ia-generative-elearning', 'formation-ia', 'formation-ia-act', 'formation-prompt-level-1',
    'excel-initiation-inter', 'excel-initiation-individuel',
    'excel-perfectionnement-inter', 'excel-perfectionnement-individuel',
    'excel-avance-inter', 'excel-avance-individuel',
    'word-initiation-inter', 'word-initiation-individuel',
    'word-perfectionnement-inter', 'word-perfectionnement-individuel',
    'powerpoint-initiation-inter', 'powerpoint-initiation-individuel',
    'ia-creativite-groupe', 'ia-creativite-individuel', 'ia-creativite-ecole-association'
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
$function$;

REVOKE ALL ON FUNCTION public.admin_grant_course_access(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_course_access(uuid, text, text)
  TO authenticated;

COMMIT;
