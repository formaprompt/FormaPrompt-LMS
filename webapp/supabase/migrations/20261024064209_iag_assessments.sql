-- PROPOSITION NON APPLIQUEE. Not a migration; execute nowhere without review/authorization.
-- Requires the existing responses, reviews, profiles and course_access schema.
BEGIN;
-- Apply only together with draft 01 after authorized database validation.
GRANT USAGE ON SCHEMA private TO authenticated;
CREATE FUNCTION private.iag_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','employee'));
$$;
CREATE FUNCTION private.iag_owner_active(p_user uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = '' AS $$
 SELECT auth.uid() = p_user AND EXISTS (
 SELECT 1 FROM public.course_access WHERE user_id = p_user
 AND course_id = 'formation-ia-generative-elearning' AND status = 'active'
 AND (expires_at IS NULL OR expires_at > clock_timestamp()));
$$;
REVOKE ALL ON FUNCTION private.iag_staff(), private.iag_owner_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.iag_staff(), private.iag_owner_active(uuid) TO authenticated;

CREATE TABLE private.iag_rubric_versions (
 version text PRIMARY KEY, source_sha256 text NOT NULL, rubric jsonb NOT NULL
);
-- Paid rubric seed intentionally omitted from this public repository.
-- Import the verified original seed privately before any IAG assessment use.
-- See docs/iag-public-private-boundary.md; schema, RLS and functions stay unchanged.

CREATE TABLE public.iag_submission_details (
 response_id bigint PRIMARY KEY REFERENCES public.course_exercise_responses(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 work_id text NOT NULL CHECK (work_id IN ('1','2','3')),
 ordinal smallint NOT NULL CHECK (ordinal IN (1,2)),
 rubric_version text NOT NULL REFERENCES private.iag_rubric_versions(version),
 assistants jsonb NOT NULL CHECK (jsonb_typeof(assistants) = 'array'),
 changes text NOT NULL, registration_conditions text NOT NULL,
 received_at timestamptz NOT NULL, due_at timestamptz NOT NULL,
 UNIQUE (user_id, work_id, ordinal)
);
CREATE TABLE public.iag_review_details (
 review_id bigint PRIMARY KEY REFERENCES public.course_exercise_reviews(id) ON DELETE RESTRICT,
 response_id bigint NOT NULL UNIQUE REFERENCES public.iag_submission_details(response_id) ON DELETE RESTRICT,
 rubric_version text NOT NULL REFERENCES private.iag_rubric_versions(version),
 observations jsonb NOT NULL, essentials jsonb NOT NULL,
 points smallint NOT NULL CHECK (points BETWEEN 0 AND 20),
 observed smallint NOT NULL CHECK (observed BETWEEN 0 AND 20),
 changes_required text NOT NULL, real_trials_evidence text NOT NULL
);
CREATE TABLE public.iag_assessment_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 response_id bigint NOT NULL REFERENCES public.iag_submission_details(response_id) ON DELETE RESTRICT,
 review_id bigint REFERENCES public.iag_review_details(review_id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 event_type text NOT NULL CHECK (event_type IN ('received','initial_review_sent','resubmission_received','targeted_review_sent')),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION private.iag_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Historique IAG immuable : ajout uniquement.'; END;
$$;
CREATE TRIGGER iag_submission_immutable BEFORE UPDATE OR DELETE ON public.iag_submission_details
 FOR EACH ROW EXECUTE FUNCTION private.iag_immutable();
CREATE TRIGGER iag_review_immutable BEFORE UPDATE OR DELETE ON public.iag_review_details
 FOR EACH ROW EXECUTE FUNCTION private.iag_immutable();
CREATE TRIGGER iag_event_immutable BEFORE UPDATE OR DELETE ON public.iag_assessment_events
 FOR EACH ROW EXECUTE FUNCTION private.iag_immutable();
CREATE TRIGGER iag_rubric_immutable BEFORE UPDATE OR DELETE ON private.iag_rubric_versions
 FOR EACH ROW EXECUTE FUNCTION private.iag_immutable();
CREATE FUNCTION private.iag_protect_base() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF TG_TABLE_NAME = 'course_exercise_responses' THEN
   IF OLD.course_id = 'formation-ia-generative-elearning' THEN
     RAISE EXCEPTION 'Version IAG immuable.';
   END IF;
 ELSE
   IF EXISTS (SELECT 1 FROM public.course_exercise_responses WHERE id = OLD.response_id
     AND course_id = 'formation-ia-generative-elearning') THEN
     RAISE EXCEPTION 'Retour IAG immuable.';
   END IF;
 END IF;
 RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER iag_response_immutable BEFORE UPDATE OR DELETE ON public.course_exercise_responses
 FOR EACH ROW EXECUTE FUNCTION private.iag_protect_base();
CREATE TRIGGER iag_base_review_immutable BEFORE UPDATE OR DELETE ON public.course_exercise_reviews
 FOR EACH ROW EXECUTE FUNCTION private.iag_protect_base();

ALTER TABLE private.iag_rubric_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iag_submission_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iag_submission_details FORCE ROW LEVEL SECURITY;
ALTER TABLE public.iag_review_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iag_review_details FORCE ROW LEVEL SECURITY;
ALTER TABLE public.iag_assessment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iag_assessment_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.iag_rubric_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.iag_submission_details, public.iag_review_details, public.iag_assessment_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.iag_submission_details, public.iag_review_details, public.iag_assessment_events TO authenticated;
CREATE POLICY iag_submission_read ON public.iag_submission_details FOR SELECT TO authenticated
 USING (private.iag_staff() OR private.iag_owner_active(user_id));
CREATE POLICY iag_review_read ON public.iag_review_details FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.iag_submission_details d WHERE d.response_id = iag_review_details.response_id));
CREATE POLICY iag_event_read ON public.iag_assessment_events FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.iag_submission_details d WHERE d.response_id = iag_assessment_events.response_id));

-- Restrictive guards combine with existing permissive policies: direct generic forms cannot bypass IAG RPC.
CREATE POLICY iag_response_rpc_only ON public.course_exercise_responses AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (course_id <> 'formation-ia-generative-elearning');
CREATE POLICY iag_response_active_read ON public.course_exercise_responses AS RESTRICTIVE FOR SELECT TO authenticated
 USING (course_id <> 'formation-ia-generative-elearning' OR private.iag_staff() OR private.iag_owner_active(user_id));
CREATE POLICY iag_response_staff_read ON public.course_exercise_responses FOR SELECT TO authenticated
 USING (course_id = 'formation-ia-generative-elearning' AND private.iag_staff());
CREATE POLICY iag_base_review_rpc_only ON public.course_exercise_reviews AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (NOT EXISTS (SELECT 1 FROM public.course_exercise_responses r WHERE r.id = response_id
 AND r.course_id = 'formation-ia-generative-elearning'));
CREATE POLICY iag_base_review_active_read ON public.course_exercise_reviews AS RESTRICTIVE FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.course_exercise_responses r WHERE r.id = response_id));
CREATE POLICY iag_base_review_staff_read ON public.course_exercise_reviews FOR SELECT TO authenticated
 USING (private.iag_staff() AND EXISTS (SELECT 1 FROM public.course_exercise_responses r
 WHERE r.id = response_id AND r.course_id = 'formation-ia-generative-elearning'));
-- reviewer_id was intentionally hidden by older column grants. The IAG history exposes authors separately.

-- F2 : le projet IAG V7 est le travail 3 du circuit ci-dessus. Les anciennes
-- tables de projet final restent réservées aux autres offres, même par appel
-- direct de l'API de table. Aucune capacité INSERT/UPDATE/DELETE n'est accordée.
CREATE POLICY iag_legacy_final_submission_no_insert ON public.course_final_project_submissions
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (course_id <> 'formation-ia-generative-elearning');
CREATE POLICY iag_legacy_final_submission_no_update ON public.course_final_project_submissions
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (course_id <> 'formation-ia-generative-elearning')
WITH CHECK (course_id <> 'formation-ia-generative-elearning');
CREATE POLICY iag_legacy_final_submission_no_delete ON public.course_final_project_submissions
AS RESTRICTIVE FOR DELETE TO authenticated
USING (course_id <> 'formation-ia-generative-elearning');
CREATE POLICY iag_legacy_final_submission_active_read ON public.course_final_project_submissions
AS RESTRICTIVE FOR SELECT TO authenticated
USING (course_id <> 'formation-ia-generative-elearning' OR private.iag_staff() OR private.iag_owner_active(user_id));
CREATE POLICY iag_legacy_final_submission_staff_read ON public.course_final_project_submissions
FOR SELECT TO authenticated
USING (course_id = 'formation-ia-generative-elearning' AND private.iag_staff());
CREATE POLICY iag_legacy_final_review_no_insert ON public.course_final_project_reviews
AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (EXISTS (
  SELECT 1 FROM public.course_final_project_submissions s
  WHERE s.id = submission_id AND s.course_id <> 'formation-ia-generative-elearning'
));
CREATE POLICY iag_legacy_final_review_no_update ON public.course_final_project_reviews
AS RESTRICTIVE FOR UPDATE TO authenticated USING (EXISTS (
  SELECT 1 FROM public.course_final_project_submissions s
  WHERE s.id = submission_id AND s.course_id <> 'formation-ia-generative-elearning'
)) WITH CHECK (EXISTS (
  SELECT 1 FROM public.course_final_project_submissions s
  WHERE s.id = submission_id AND s.course_id <> 'formation-ia-generative-elearning'
));
CREATE POLICY iag_legacy_final_review_no_delete ON public.course_final_project_reviews
AS RESTRICTIVE FOR DELETE TO authenticated USING (EXISTS (
  SELECT 1 FROM public.course_final_project_submissions s
  WHERE s.id = submission_id AND s.course_id <> 'formation-ia-generative-elearning'
));
-- Un EXISTS positif exige que le parent soit visible sous sa propre RLS.
-- Un NOT EXISTS sur un parent masqué pourrait laisser fuiter le retour.
CREATE POLICY iag_legacy_final_review_visible_parent ON public.course_final_project_reviews
AS RESTRICTIVE FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.course_final_project_submissions s WHERE s.id = submission_id
));

CREATE FUNCTION private.iag_submit_work(p_work_id text, p_response_text text, p_assistants jsonb,
 p_changes text, p_registration_conditions text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid(); v_count integer; v_id bigint; v_now timestamptz;
BEGIN
 IF NOT coalesce(private.iag_owner_active(v_user), false) THEN RAISE EXCEPTION 'Accès actif propriétaire requis.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.course_positioning_assessments
   WHERE user_id=v_user AND course_id='formation-ia-generative-elearning'
   AND is_initial IS TRUE AND questionnaire_version='iag-v7-six-questions'
   AND score IS NULL AND maximum_score IS NULL AND level IS NULL)
 THEN RAISE EXCEPTION 'Questionnaire de départ à compléter avant la remise.'; END IF;
 IF p_work_id IS NULL OR p_work_id NOT IN ('1','2','3') THEN RAISE EXCEPTION 'Travail inconnu.'; END IF;
 -- Lock the entitlement row as well: a simultaneous revocation cannot race a submission.
 PERFORM 1 FROM public.course_access WHERE user_id=v_user
 AND course_id='formation-ia-generative-elearning' FOR UPDATE;
 IF NOT coalesce(private.iag_owner_active(v_user), false) THEN RAISE EXCEPTION 'Accès inactif.'; END IF;
 -- Serializes the very first receipt too (there is no submission row to lock yet).
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':iag:' || p_work_id, 0));
 SELECT count(*) INTO v_count FROM public.iag_submission_details WHERE user_id=v_user AND work_id=p_work_id;
 IF v_count >= 2 THEN RAISE EXCEPTION 'Deux remises effectives maximum par travail.'; END IF;
 IF v_count = 1 AND NOT EXISTS (SELECT 1 FROM public.iag_submission_details d
 JOIN public.iag_review_details e USING(response_id) WHERE d.user_id=v_user AND d.work_id=p_work_id AND d.ordinal=1)
 THEN RAISE EXCEPTION 'Le retour initial doit précéder la nouvelle remise.'; END IF;
 IF p_assistants IS NULL OR jsonb_typeof(p_assistants) <> 'array' OR jsonb_array_length(p_assistants)>10
 OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_assistants) a WHERE jsonb_typeof(a)<>'string' OR length(a#>>'{}')>200)
 THEN RAISE EXCEPTION 'Liste des assistants invalide.'; END IF;
 IF p_response_text IS NULL OR length(private.iag_trim(p_response_text)) NOT BETWEEN 1 AND 20000
 OR p_changes IS NULL OR length(p_changes)>10000 OR p_registration_conditions IS NULL OR length(p_registration_conditions)>5000
 OR (v_count=1 AND length(private.iag_trim(p_changes))=0) THEN RAISE EXCEPTION 'Dossier ou changements à compléter.'; END IF;
 v_now := clock_timestamp();
 INSERT INTO public.course_exercise_responses(user_id,course_id,exercise_id,response_text,status,saved_at)
 VALUES(v_user,'formation-ia-generative-elearning',p_work_id,p_response_text,'submitted',v_now) RETURNING id INTO v_id;
 INSERT INTO public.iag_submission_details VALUES(v_id,v_user,p_work_id,v_count+1,'v7-2026-10-21',p_assistants,
 p_changes,p_registration_conditions,v_now,((v_now AT TIME ZONE 'Europe/Paris') + interval '2 days') AT TIME ZONE 'Europe/Paris');
 INSERT INTO public.iag_assessment_events(response_id,actor_id,event_type,occurred_at)
 VALUES(v_id,v_user,CASE WHEN v_count=0 THEN 'received' ELSE 'resubmission_received' END,v_now);
 RETURN v_id;
END;
$$;

CREATE FUNCTION private.iag_record_review(p_response_id bigint,p_observations jsonb,p_essentials jsonb,
 p_decision text,p_feedback text,p_changes_required text,p_real_trials_evidence text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.iag_submission_details%ROWTYPE; v_rubric jsonb; v_group jsonb; v_item jsonb;
 v_key text; v_g integer:=0; v_i integer; v_n integer:=0; v_points integer:=0; v_observed integer:=0;
 v_value jsonb; v_all boolean:=true; v_id bigint; v_now timestamptz;
BEGIN
 IF NOT private.iag_staff() THEN RAISE EXCEPTION 'Rôle formateur requis.' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.iag_submission_details WHERE response_id=p_response_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Réception IAG introuvable.'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(d.user_id::text || ':iag:' || d.work_id,0));
 IF EXISTS(SELECT 1 FROM public.iag_review_details WHERE response_id=p_response_id) THEN RAISE EXCEPTION 'Retour déjà transmis pour cette version.'; END IF;
 SELECT rubric INTO v_rubric FROM private.iag_rubric_versions WHERE version=d.rubric_version;
 IF jsonb_typeof(p_observations) IS DISTINCT FROM 'object' OR jsonb_typeof(p_essentials) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'Grille et critères requis.'; END IF;
 FOR v_group IN SELECT value FROM jsonb_array_elements(v_rubric->'grilles'->d.work_id) LOOP
   v_g:=v_g+1; v_i:=0;
   FOR v_item IN SELECT value FROM jsonb_array_elements(v_group->2) LOOP
     v_i:=v_i+1; v_n:=v_n+1; v_key:=d.work_id||'.'||v_g||'.'||v_i;
     v_value:=p_observations->v_key;
     IF v_value IS NULL OR jsonb_typeof(v_value) <> 'object' OR NOT (v_value ? 'value')
       OR v_value->'value' NOT IN ('0'::jsonb,'1'::jsonb,'null'::jsonb)
       THEN RAISE EXCEPTION 'Observable invalide : %',v_key; END IF;
     IF v_value->'value' <> 'null'::jsonb THEN
       IF jsonb_typeof(v_value->'evidence') IS DISTINCT FROM 'string' OR length(private.iag_trim(v_value->>'evidence'))=0
       THEN RAISE EXCEPTION 'Preuve requise : %',v_key; END IF;
       v_observed:=v_observed+1; v_points:=v_points+(v_value->>'value')::integer;
     END IF;
   END LOOP;
 END LOOP;
 IF v_n<>20 OR (SELECT count(*) FROM jsonb_object_keys(p_observations))<>20 THEN RAISE EXCEPTION '20 observables exacts requis.'; END IF;
 v_n:=0;
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_rubric->'criteres_essentiels'->d.work_id) LOOP
   v_n:=v_n+1; v_key:=v_item->>0; v_value:=p_essentials->v_key;
   IF v_value IS NULL OR jsonb_typeof(v_value) <> 'object' OR (v_value->>'state') IS NULL
     OR (v_value->>'state') NOT IN ('attained','not_attained','not_observed')
     THEN RAISE EXCEPTION 'Critère essentiel invalide : %',v_key; END IF;
   IF v_value->>'state'<>'not_observed' AND (jsonb_typeof(v_value->'evidence') IS DISTINCT FROM 'string'
     OR length(private.iag_trim(v_value->>'evidence'))=0) THEN RAISE EXCEPTION 'Preuve du critère requise : %',v_key; END IF;
   IF v_value->>'state'<>'attained' THEN v_all:=false; END IF;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_object_keys(p_essentials))<>v_n THEN RAISE EXCEPTION 'Clés de critères inconnues.'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('needs_revision','validated') OR p_feedback IS NULL
 OR length(private.iag_trim(p_feedback)) NOT BETWEEN 1 AND 10000 OR p_changes_required IS NULL
 OR length(p_changes_required)>10000 OR p_real_trials_evidence IS NULL OR length(p_real_trials_evidence)>10000
 OR length(p_observations::text)>100000 OR length(p_essentials::text)>50000 THEN RAISE EXCEPTION 'Décision et retour requis.'; END IF;
 IF p_decision='validated' AND (NOT v_all OR length(private.iag_trim(p_real_trials_evidence))=0)
 THEN RAISE EXCEPTION 'Validation sans critères essentiels et essais réels interdite.'; END IF;
 v_now := clock_timestamp();
 INSERT INTO public.course_exercise_reviews(response_id,reviewer_id,feedback_text,review_status,created_at)
 VALUES(p_response_id,auth.uid(),p_feedback,p_decision,v_now) RETURNING id INTO v_id;
 INSERT INTO public.iag_review_details VALUES(v_id,p_response_id,d.rubric_version,p_observations,p_essentials,
 v_points,v_observed,p_changes_required,p_real_trials_evidence);
 INSERT INTO public.iag_assessment_events(response_id,review_id,actor_id,event_type,occurred_at)
 VALUES(p_response_id,v_id,auth.uid(),CASE WHEN d.ordinal=1 THEN 'initial_review_sent' ELSE 'targeted_review_sent' END,v_now);
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION private.iag_submit_work(text,text,jsonb,text,text),
 private.iag_record_review(bigint,jsonb,jsonb,text,text,text,text) FROM PUBLIC,anon,authenticated;
-- Thin invoker endpoints delegate to non-exposed privileged functions with explicit authorization.
CREATE FUNCTION public.iag_submit_work(p_work_id text,p_response_text text,p_assistants jsonb,
 p_changes text,p_registration_conditions text) RETURNS bigint LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $$ SELECT private.iag_submit_work(p_work_id,p_response_text,p_assistants,p_changes,p_registration_conditions); $$;
CREATE FUNCTION public.iag_record_review(p_response_id bigint,p_observations jsonb,p_essentials jsonb,
 p_decision text,p_feedback text,p_changes_required text,p_real_trials_evidence text) RETURNS bigint
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.iag_record_review(p_response_id,
 p_observations,p_essentials,p_decision,p_feedback,p_changes_required,p_real_trials_evidence); $$;
REVOKE ALL ON FUNCTION public.iag_submit_work(text,text,jsonb,text,text),
 public.iag_record_review(bigint,jsonb,jsonb,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.iag_submit_work(text,text,jsonb,text,text),
 private.iag_record_review(bigint,jsonb,jsonb,text,text,text,text), public.iag_submit_work(text,text,jsonb,text,text),
 public.iag_record_review(bigint,jsonb,jsonb,text,text,text,text) TO authenticated;
CREATE VIEW public.iag_assessment_history WITH(security_invoker=true) AS
 SELECT d.*,r.response_text,e.review_id,e.observations,e.essentials,e.points,e.observed,
 (e.observed=20) AS complete,e.changes_required,e.real_trials_evidence,
 b.feedback_text,b.review_status AS decision,b.created_at AS returned_at,
 ev.actor_id AS reviewer_id,
 CASE WHEN e.review_id IS NULL THEN CASE WHEN d.ordinal=1 THEN 'received' ELSE 'resubmission_received' END
 ELSE CASE WHEN d.ordinal=1 THEN 'initial_review_sent' ELSE 'targeted_review_sent' END END AS workflow_state
 FROM public.iag_submission_details d JOIN public.course_exercise_responses r ON r.id=d.response_id
 LEFT JOIN public.iag_review_details e ON e.response_id=d.response_id
 LEFT JOIN public.course_exercise_reviews b ON b.id=e.review_id
 LEFT JOIN public.iag_assessment_events ev ON ev.review_id=e.review_id;
REVOKE ALL ON public.iag_assessment_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.iag_assessment_history TO authenticated;
REVOKE ALL ON FUNCTION private.iag_immutable(), private.iag_protect_base() FROM PUBLIC,anon,authenticated;
-- No certificate generation and no automatic validation/score threshold in this proposal.
COMMIT;
