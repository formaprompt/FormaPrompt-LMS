-- PROPOSITION NON APPLIQUEE. Relire contre le schema réel avant migration autorisée.
-- Nom de brouillon, pas une migration numérotée ni un script de déploiement.
BEGIN;

-- Même liste de blancs que String.prototype.trim(), pour éviter une remise
-- composée de retours/tabulations acceptée en SQL puis refusée par le lecteur.
CREATE SCHEMA IF NOT EXISTS private;
CREATE FUNCTION private.iag_trim(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;
REVOKE ALL ON FUNCTION private.iag_trim(text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.course_positioning_assessments ADD COLUMN questionnaire_version text;
-- Les anciens cours conservent obligatoirement leurs valeurs historiques.
-- Le questionnaire V7 ne stocke aucune note fictive 0/1 pour contourner le schéma.
ALTER TABLE public.course_positioning_assessments ALTER COLUMN score DROP NOT NULL;
ALTER TABLE public.course_positioning_assessments ALTER COLUMN maximum_score DROP NOT NULL;
ALTER TABLE public.course_positioning_assessments ALTER COLUMN level DROP NOT NULL;
ALTER TABLE public.course_positioning_assessments ADD CONSTRAINT positioning_iag_unscored CHECK (
  (course_id = 'formation-ia-generative-elearning' AND score IS NULL AND maximum_score IS NULL
    AND level IS NULL AND is_initial IS TRUE AND questionnaire_version IS NOT DISTINCT FROM 'iag-v7-six-questions')
  OR (course_id <> 'formation-ia-generative-elearning' AND score IS NOT NULL
    AND maximum_score IS NOT NULL AND level IS NOT NULL)
);

CREATE TABLE public.course_positioning_drafts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id text NOT NULL CHECK (course_id = 'formation-ia-generative-elearning'),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'array'),
  revision integer NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id, course_id)
);
ALTER TABLE public.course_positioning_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_positioning_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_positioning_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_positioning_drafts TO authenticated;
CREATE POLICY iag_positioning_draft_read_own ON public.course_positioning_drafts
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.course_access a WHERE a.user_id = (SELECT auth.uid())
  AND a.course_id = course_positioning_drafts.course_id AND a.status = 'active'
  AND (a.expires_at IS NULL OR a.expires_at > now())
));

-- Les anciennes policies permissives d'INSERT ne doivent pas permettre
-- de fabriquer une preuve de questionnaire V7 via l'API de table.
CREATE POLICY iag_positioning_completion_rpc_only ON public.course_positioning_assessments
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (course_id <> 'formation-ia-generative-elearning');

CREATE POLICY iag_positioning_completion_active_read ON public.course_positioning_assessments
AS RESTRICTIVE FOR SELECT TO authenticated USING (
  course_id <> 'formation-ia-generative-elearning'
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','employee'))
  OR (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.course_access a WHERE a.user_id = (SELECT auth.uid())
      AND a.course_id = course_positioning_assessments.course_id AND a.status = 'active'
      AND (a.expires_at IS NULL OR a.expires_at > now())
  ))
);

CREATE FUNCTION public.iag_positioning_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.course_id = 'formation-ia-generative-elearning' OR NEW.course_id = 'formation-ia-generative-elearning' THEN
    RAISE EXCEPTION 'Le questionnaire initial remis est conservé sans remplacement.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.iag_positioning_immutable() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER iag_positioning_no_rewrite BEFORE UPDATE ON public.course_positioning_assessments
FOR EACH ROW EXECUTE FUNCTION public.iag_positioning_immutable();

CREATE FUNCTION private.iag_positioning(
  p_action text DEFAULT 'status', p_answers jsonb DEFAULT NULL, p_expected_revision integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  course CONSTANT text := 'formation-ia-generative-elearning';
  draft public.course_positioning_drafts%ROWTYPE;
  completed public.course_positioning_assessments%ROWTYPE;
  canonical jsonb;
  revision_now integer;
BEGIN
  IF actor IS NULL OR p_action IS NULL OR p_action NOT IN ('status','save','submit') THEN
    RAISE EXCEPTION 'Connexion ou demande invalide.' USING ERRCODE = '42501';
  END IF;
  -- Pas de purchases ni de réactivation : acheté, cadeau ou promo passent
  -- par le même course_access actif. Le verrou empêche une révocation concurrente
  -- de se glisser au milieu de cette réception.
  PERFORM 1 FROM public.course_access a WHERE a.user_id = actor AND a.course_id = course
    AND a.status = 'active' AND (a.expires_at IS NULL OR a.expires_at > clock_timestamp()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Accès à la formation refusé.' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('iag-positioning:' || actor::text, 0));
  SELECT * INTO completed FROM public.course_positioning_assessments
    WHERE user_id = actor AND course_id = course AND is_initial IS TRUE;
  SELECT * INTO draft FROM public.course_positioning_drafts WHERE user_id = actor AND course_id = course;
  revision_now := coalesce(draft.revision, 0);
  IF completed.id IS NOT NULL THEN
    IF completed.questionnaire_version IS DISTINCT FROM 'iag-v7-six-questions' THEN
      RAISE EXCEPTION 'Le suivi du questionnaire nécessite un contrôle.' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('completed',true,'answers',completed.answers,
      'revision',revision_now,'submittedAt',completed.submitted_at,'version',completed.questionnaire_version);
  END IF;
  IF p_action = 'status' THEN
    RETURN jsonb_build_object('completed',false,'answers',coalesce(draft.answers,'[]'::jsonb),
      'revision',revision_now,'updatedAt',draft.updated_at,'version','iag-v7-six-questions');
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision <> revision_now THEN
    RAISE EXCEPTION 'Une autre fenêtre a enregistré ce questionnaire. Rechargez la version enregistrée avant de poursuivre.' USING ERRCODE = '40001';
  END IF;
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'array' OR jsonb_array_length(p_answers) <> 6 THEN
    RAISE EXCEPTION 'Les six réponses sont nécessaires.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_answers) answer
    WHERE jsonb_typeof(answer) IS DISTINCT FROM 'object'
      OR jsonb_typeof(answer->'id') IS DISTINCT FROM 'string'
      OR answer->>'id' NOT IN ('computer','experience','need','verification','learning','tools')
      OR jsonb_typeof(answer->'text') IS DISTINCT FROM 'string'
      OR char_length(answer->>'text') > 2000
      OR (p_action = 'submit' AND char_length(private.iag_trim(answer->>'text')) = 0))
    OR (SELECT count(DISTINCT a->>'id') FROM jsonb_array_elements(p_answers) a) <> 6 THEN
    RAISE EXCEPTION 'Vérifiez les six réponses ; « Je ne sais pas encore » convient aussi.' USING ERRCODE = '22023';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('id',question.id,'text',private.iag_trim(answer->>'text')) ORDER BY question.n)
    INTO canonical FROM unnest(ARRAY['computer','experience','need','verification','learning','tools']) WITH ORDINALITY question(id,n)
    JOIN jsonb_array_elements(p_answers) answer ON answer->>'id' = question.id;
  INSERT INTO public.course_positioning_drafts(user_id,course_id,answers,revision,updated_at)
    VALUES(actor,course,canonical,revision_now+1,clock_timestamp())
    ON CONFLICT(user_id,course_id) DO UPDATE SET answers=EXCLUDED.answers,revision=EXCLUDED.revision,updated_at=EXCLUDED.updated_at;
  IF p_action = 'submit' THEN
    INSERT INTO public.course_positioning_assessments(user_id,learner_name,course_id,course_title,answers,
      score,maximum_score,level,is_initial,questionnaire_version,submitted_at)
    VALUES(actor,'Apprenant',course,'IA générative - e-learning',canonical,
      NULL,NULL,NULL,true,'iag-v7-six-questions',clock_timestamp()) RETURNING * INTO completed;
  END IF;
  RETURN jsonb_build_object('completed',p_action='submit','answers',canonical,'revision',revision_now+1,
    'submittedAt',completed.submitted_at,'version','iag-v7-six-questions');
END;
$$;
REVOKE ALL ON FUNCTION private.iag_positioning(text,jsonb,integer) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.iag_positioning(
  p_action text DEFAULT 'status', p_answers jsonb DEFAULT NULL, p_expected_revision integer DEFAULT 0
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.iag_positioning(p_action,p_answers,p_expected_revision);
$$;
REVOKE ALL ON FUNCTION public.iag_positioning(text,jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.iag_positioning(text,jsonb,integer), public.iag_positioning(text,jsonb,integer) TO authenticated;
COMMENT ON FUNCTION public.iag_positioning(text,jsonb,integer) IS
  'Questionnaire initial IAG non noté : identité serveur, droit actif, brouillon versionné, remise unique. Aucun accès accordé par cette fonction.';
COMMIT;
