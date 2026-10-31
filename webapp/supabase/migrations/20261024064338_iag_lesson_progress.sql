-- PROPOSITION NON APPLIQUEE, non numerotee : revue et recette PostgreSQL requises.
-- Depend du draft questionnaire 01 revu ; jamais appliquer en sautant ses garde-fous.
-- Ne pas executer sur une base existante sans preflight proprietaires/ACL/policies.
BEGIN;

ALTER TABLE public.course_lesson_progress ADD COLUMN content_version text;
COMMENT ON COLUMN public.course_lesson_progress.content_version IS
  'Version canonique IAG ecrite par RPC uniquement ; NULL historique. Avancement declare, pas preuve de presence.';

CREATE FUNCTION private.iag_lesson_ids() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT ARRAY['l11','l12','l13','l21','l22','l23','l24','l25','l26','l27',
 'l31','l32','l33','l41','l42','l43','l51','l52','l61','l62','l71','l72']::text[];
$$;
REVOKE ALL ON FUNCTION private.iag_lesson_ids() FROM PUBLIC, anon, authenticated;

-- La politique restrictive complete les policies historiques permissives.
-- Elle interdit aussi de transformer une ancienne ligne d'un autre cours en IAG.
CREATE POLICY iag_progress_rpc_insert_only ON public.course_lesson_progress
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (course_id <> 'formation-ia-generative-elearning');
CREATE POLICY iag_progress_rpc_update_only ON public.course_lesson_progress
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (course_id <> 'formation-ia-generative-elearning')
WITH CHECK (course_id <> 'formation-ia-generative-elearning');

CREATE FUNCTION private.iag_has_positioning(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.course_positioning_assessments q
   WHERE q.user_id=p_user_id AND q.course_id='formation-ia-generative-elearning'
     AND q.is_initial IS TRUE AND q.questionnaire_version='iag-v7-six-questions'
     AND q.submitted_at IS NOT NULL AND q.score IS NULL AND q.maximum_score IS NULL AND q.level IS NULL
     AND CASE WHEN jsonb_typeof(q.answers)='array' THEN
       jsonb_array_length(q.answers)=6
       AND (SELECT count(DISTINCT a->>'id') FROM jsonb_array_elements(q.answers) a)=6
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q.answers) a
         WHERE jsonb_typeof(a) IS DISTINCT FROM 'object'
           OR jsonb_typeof(a->'id') IS DISTINCT FROM 'string'
           OR a->>'id' NOT IN ('computer','experience','need','verification','learning','tools')
           OR jsonb_typeof(a->'text') IS DISTINCT FROM 'string'
           OR char_length(a->>'text')>2000
           OR char_length(private.iag_trim(a->>'text'))=0)
     ELSE false END
 );
$$;
REVOKE ALL ON FUNCTION private.iag_has_positioning(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.iag_completed_at(p_user_id uuid,p_content_version text) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT CASE WHEN p_content_version='iag-v7-2026-10-21-with-explicit-v8-media'
     AND count(*)=22
     AND count(DISTINCT p.lesson_id)=22
     AND bool_and(p.lesson_id=ANY(private.iag_lesson_ids()) AND p.status='completed'
       AND p.progress_percent=100 AND p.completed_at IS NOT NULL)
   THEN max(p.completed_at) ELSE NULL END
 FROM public.course_lesson_progress p
 WHERE p.user_id=p_user_id AND p.course_id='formation-ia-generative-elearning'
   AND p.content_version=p_content_version;
$$;
REVOKE ALL ON FUNCTION private.iag_completed_at(uuid,text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.iag_lesson_progress(p_action text,p_lesson_id text,p_content_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 actor uuid := auth.uid();
 course CONSTANT text := 'formation-ia-generative-elearning';
 version CONSTANT text := 'iag-v7-2026-10-21-with-explicit-v8-media';
 stamp timestamptz;
 result jsonb;
BEGIN
 IF actor IS NULL OR p_action IS NULL OR p_action NOT IN ('status','view','complete')
   OR p_content_version IS DISTINCT FROM version
   OR (p_action<>'status' AND (p_lesson_id IS NULL OR NOT p_lesson_id=ANY(private.iag_lesson_ids())))
   OR (p_action='status' AND p_lesson_id IS NOT NULL) THEN
   RAISE EXCEPTION 'Demande de progression invalide.' USING ERRCODE='22023';
 END IF;
 -- Meme droit quelle que soit origine achat/cadeau/promo ; aucun upsert de droit.
 PERFORM 1 FROM public.course_access a WHERE a.user_id=actor AND a.course_id=course
   AND a.status='active' AND (a.expires_at IS NULL OR a.expires_at>clock_timestamp()) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Acces refuse.' USING ERRCODE='42501'; END IF;
 IF NOT private.iag_has_positioning(actor) THEN
   RAISE EXCEPTION 'Questionnaire initial requis.' USING ERRCODE='42501';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('iag-progress:'||actor::text,0));
 stamp := clock_timestamp();
 IF p_action<>'status' THEN
   INSERT INTO public.course_lesson_progress(user_id,course_id,lesson_id,status,progress_percent,last_viewed_at,completed_at,content_version)
   VALUES(actor,course,p_lesson_id,CASE WHEN p_action='complete' THEN 'completed' ELSE 'in_progress' END,
     CASE WHEN p_action='complete' THEN 100 ELSE 0 END,stamp,
     CASE WHEN p_action='complete' THEN stamp ELSE NULL END,version)
   ON CONFLICT(user_id,course_id,lesson_id) DO UPDATE SET
     content_version=EXCLUDED.content_version,
     last_viewed_at=EXCLUDED.last_viewed_at,
     status=CASE WHEN course_lesson_progress.content_version IS NOT DISTINCT FROM version
       AND course_lesson_progress.status='completed' THEN 'completed' ELSE EXCLUDED.status END,
     progress_percent=CASE WHEN course_lesson_progress.content_version IS NOT DISTINCT FROM version
       AND course_lesson_progress.status='completed' THEN 100 ELSE EXCLUDED.progress_percent END,
     completed_at=CASE WHEN course_lesson_progress.content_version IS NOT DISTINCT FROM version
       AND course_lesson_progress.status='completed' THEN course_lesson_progress.completed_at ELSE EXCLUDED.completed_at END;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('lessonId',p.lesson_id,'status',p.status,
   'lastViewedAt',p.last_viewed_at,'completedAt',p.completed_at) ORDER BY array_position(private.iag_lesson_ids(),p.lesson_id)),'[]'::jsonb)
 INTO result FROM public.course_lesson_progress p
 WHERE p.user_id=actor AND p.course_id=course AND p.content_version=version
   AND p.lesson_id=ANY(private.iag_lesson_ids());
 RETURN jsonb_build_object('courseId',course,'contentVersion',version,'lessons',result,
   'completedAt',private.iag_completed_at(actor,version),'meaning','learner-declared-progress-not-attendance');
END;
$$;
REVOKE ALL ON FUNCTION private.iag_lesson_progress(text,text,text) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.iag_lesson_progress(p_action text,p_lesson_id text,p_content_version text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT private.iag_lesson_progress(p_action,p_lesson_id,p_content_version);
$$;
REVOKE ALL ON FUNCTION public.iag_lesson_progress(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.iag_lesson_progress(text,text,text), public.iag_lesson_progress(text,text,text) TO authenticated;
-- Preflight obligatoire : owners des SECURITY DEFINER doivent etre le role de migration
-- approuve et hors role expose. RLS historique reste active ; aucune policy historique remplacee.
COMMIT;
