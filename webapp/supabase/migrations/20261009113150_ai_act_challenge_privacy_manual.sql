BEGIN;

-- Procédure MANUELLE uniquement. Aucun cron, aucun changement de droit commercial.
-- Règle décidée : pendant la formation puis 12 mois calendaires UTC après fin
-- effective certifiée. Une activité du jeu ne prolonge jamais cette échéance.
CREATE TABLE private.challenge_training_closures (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  state text NOT NULL CHECK(state IN ('ongoing','finished')),
  ended_at timestamptz,
  source_enrollment_id uuid REFERENCES public.training_enrollments(id) ON DELETE RESTRICT,
  source_fingerprint text,
  evidence_reference text NOT NULL CHECK(evidence_reference ~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$'),
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  CHECK((state='finished' AND ended_at IS NOT NULL) OR (state='ongoing' AND ended_at IS NULL))
);
CREATE TABLE private.challenge_privacy_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path_id uuid,
  request_id uuid,
  operation text NOT NULL CHECK(operation IN ('retention','subject_erasure')),
  fingerprint text NOT NULL,
  subject_authorization_fingerprint text,
  decision_reference text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes'
);
CREATE TABLE private.challenge_privacy_context (
  backend_pid integer NOT NULL,
  transaction_id bigint NOT NULL,
  subject_user_id uuid NOT NULL,
  path_id uuid,
  PRIMARY KEY(backend_pid,transaction_id)
);
-- Ce journal reste personnel pour l'administrateur, pas « anonyme ».
-- Aucun sujet, plan nominatif, empreinte de parcours, score ou choix n'y survit.
-- Durée propre du journal : validation juridique nécessaire avant publication.
CREATE TABLE private.challenge_privacy_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  executed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  operation text NOT NULL CHECK(operation IN ('retention','subject_erasure')),
  procedure_version text NOT NULL DEFAULT 'training-end-12m-v1',
  paths_deleted integer NOT NULL,
  attempts_deleted integer NOT NULL,
  answers_deleted integer NOT NULL,
  request_logs_deleted integer NOT NULL,
  grants_deleted integer NOT NULL,
  actor_references_unlinked integer NOT NULL,
  administrative_references_unlinked integer NOT NULL
);
COMMENT ON TABLE private.challenge_paths IS 'Conservation du jeu et de son quota pendant la formation puis 12 mois calendaires UTC après fin effective certifiée. Procédure manuelle strictadmin ; aucune purge automatique ni échéance calculée depuis activité du jeu ou droit commercial.';
ALTER TABLE private.challenge_trainer_grants ALTER COLUMN updated_by DROP NOT NULL;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['training_closures','privacy_plans','privacy_context','privacy_audit'] LOOP
    EXECUTE format('ALTER TABLE private.challenge_%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE private.challenge_%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON private.challenge_%I FROM PUBLIC,anon,authenticated,service_role',t);
  END LOOP;
END $$;

CREATE FUNCTION private.challenge_retention_due(p_ended_at timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path='' SET timezone='UTC' AS $$
SELECT ((p_ended_at AT TIME ZONE 'UTC')+interval '12 months') AT TIME ZONE 'UTC'
$$;

CREATE FUNCTION private.challenge_enrollment_proof(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' SET timezone='UTC' AS $$
SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,
  'completed_at',to_jsonb(e)->'completed_at','ends_at',to_jsonb(e)->'ends_at',
  'updated_at',to_jsonb(e)->'updated_at') ORDER BY e.id),'[]'::jsonb)
FROM public.training_enrollments e WHERE user_id=p_user AND course_id='formation-ia-act'
$$;
CREATE FUNCTION private.challenge_privacy_fingerprint(p_user uuid) RETURNS text
LANGUAGE sql STABLE SET search_path='' SET timezone='UTC' AS $$
SELECT encode(sha256(convert_to(jsonb_build_object(
  'path',(SELECT to_jsonb(p) FROM private.challenge_paths p WHERE user_id=p_user),
  'attempts',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM private.challenge_attempts a JOIN private.challenge_paths p ON p.id=a.path_id WHERE p.user_id=p_user),
  'answers',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.attempt_id,a.question_code),'[]') FROM private.challenge_answers a JOIN private.challenge_attempts t ON t.id=a.attempt_id JOIN private.challenge_paths p ON p.id=t.path_id WHERE p.user_id=p_user),
  'start_requests',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.request_id),'[]') FROM private.challenge_start_requests r WHERE user_id=p_user),
  'save_requests',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.attempt_id,r.request_id),'[]') FROM private.challenge_save_requests r JOIN private.challenge_attempts t ON t.id=r.attempt_id JOIN private.challenge_paths p ON p.id=t.path_id WHERE p.user_id=p_user),
  'grants',(SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.user_id),'[]') FROM private.challenge_trainer_grants g WHERE user_id=p_user OR updated_by=p_user),
  'closure',(SELECT to_jsonb(c) FROM private.challenge_training_closures c WHERE user_id=p_user),
  'verified_others',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY user_id),'[]') FROM private.challenge_training_closures c WHERE verified_by=p_user AND user_id<>p_user),
  'audit_actions',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]') FROM private.challenge_privacy_audit a WHERE actor_user_id=p_user),
  'created_other_plans',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'subject_user_id',subject_user_id,'created_at',created_at,'expires_at',expires_at) ORDER BY id),'[]') FROM private.challenge_privacy_plans WHERE created_by=p_user AND subject_user_id<>p_user),
  'enrollments',private.challenge_enrollment_proof(p_user)
)::text,'UTF8')),'hex')
$$;

CREATE FUNCTION private.challenge_privacy_overview(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' SET timezone='UTC' AS $$
WITH c AS(SELECT * FROM private.challenge_training_closures WHERE user_id=p_user),
p AS(SELECT * FROM private.challenge_paths WHERE user_id=p_user)
SELECT jsonb_build_object('subject_user_id',p_user,'closure',(SELECT to_jsonb(c) FROM c),
  'due_at',(SELECT private.challenge_retention_due(ended_at) FROM c WHERE state='finished'),
  'has_active_enrollment',EXISTS(SELECT FROM public.training_enrollments WHERE user_id=p_user AND course_id='formation-ia-act' AND status IN ('draft','pending','validated','in_progress')),
  'source_matches',(SELECT source_fingerprint=private.challenge_enrollment_proof(p_user)::text FROM c),
  'counts',jsonb_build_object('paths',(SELECT count(*) FROM p),
    'attempts',(SELECT count(*) FROM private.challenge_attempts WHERE path_id IN(SELECT id FROM p)),
    'answers',(SELECT count(*) FROM private.challenge_answers WHERE attempt_id IN(SELECT id FROM private.challenge_attempts WHERE path_id IN(SELECT id FROM p))),
    'start_requests',(SELECT count(*) FROM private.challenge_start_requests WHERE user_id=p_user),
    'save_requests',(SELECT count(*) FROM private.challenge_save_requests WHERE attempt_id IN(SELECT id FROM private.challenge_attempts WHERE path_id IN(SELECT id FROM p))),
    'received_grants',(SELECT count(*) FROM private.challenge_trainer_grants WHERE user_id=p_user),
    'actor_references',(SELECT count(*) FROM private.challenge_trainer_grants WHERE updated_by=p_user AND user_id<>p_user),
    'verified_training_references',(SELECT count(*) FROM private.challenge_training_closures WHERE verified_by=p_user AND user_id<>p_user),
    'audit_actor_references',(SELECT count(*) FROM private.challenge_privacy_audit WHERE actor_user_id=p_user),
    'plan_creator_references',(SELECT count(*) FROM private.challenge_privacy_plans WHERE created_by=p_user AND subject_user_id<>p_user)),
  'quota_after_erasure','Deux nouveaux passages possibles si le droit formation reste actif ; aucun droit commercial modifié.')
$$;

CREATE FUNCTION private.challenge_privacy_eligible(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' SET timezone='UTC' AS $$
SELECT EXISTS(SELECT FROM private.challenge_training_closures c WHERE user_id=p_user
 AND state='finished' AND private.challenge_retention_due(ended_at)<=clock_timestamp()
 AND (source_fingerprint=private.challenge_enrollment_proof(p_user)::text))
 AND NOT EXISTS(SELECT FROM public.training_enrollments WHERE user_id=p_user AND course_id='formation-ia-act' AND status IN ('draft','pending','validated','in_progress'))
$$;

CREATE FUNCTION private.challenge_privacy_delete_allowed(p_table text,p_subject uuid,p_path uuid,p_attempt uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' SET timezone='UTC' AS $$
SELECT EXISTS(SELECT FROM private.challenge_privacy_context c
 WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current()
 AND CASE WHEN p_table IN ('challenge_paths','challenge_start_requests') THEN c.subject_user_id=p_subject
 WHEN p_table IN ('challenge_attempts','challenge_answers','challenge_save_requests') THEN
   c.path_id=coalesce(p_path,(SELECT path_id FROM private.challenge_attempts WHERE id=p_attempt))
 ELSE false END)
$$;
-- Garde spécifique sur les objets auparavant sans garde DELETE.
CREATE FUNCTION private.challenge_privacy_delete_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' SET timezone='UTC' AS $$ BEGIN
 IF NOT private.challenge_privacy_delete_allowed(TG_TABLE_NAME,
   (to_jsonb(OLD)->>'user_id')::uuid,(to_jsonb(OLD)->>'id')::uuid,(to_jsonb(OLD)->>'attempt_id')::uuid)
 THEN RAISE EXCEPTION 'PRIVACY_DEDICATED_EXECUTION_REQUIRED'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER challenge_path_privacy_delete BEFORE DELETE ON private.challenge_paths
FOR EACH ROW EXECUTE FUNCTION private.challenge_privacy_delete_guard();
CREATE TRIGGER challenge_start_privacy_delete BEFORE DELETE ON private.challenge_start_requests
FOR EACH ROW EXECUTE FUNCTION private.challenge_privacy_delete_guard();
CREATE TRIGGER challenge_save_privacy_delete BEFORE DELETE ON private.challenge_save_requests
FOR EACH ROW EXECUTE FUNCTION private.challenge_privacy_delete_guard();

CREATE OR REPLACE FUNCTION private.challenge_guard () RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS
$$
BEGIN
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME IN ('challenge_attempts','challenge_answers') THEN
    IF private.challenge_privacy_delete_allowed(TG_TABLE_NAME, NULL,
      (to_jsonb(OLD)->>'path_id')::uuid,(to_jsonb(OLD)->>'attempt_id')::uuid) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'PRIVACY_DEDICATED_EXECUTION_REQUIRED';
  END IF;
  IF TG_TABLE_NAME = 'challenge_questions' THEN
    IF TG_OP <> 'DELETE' AND (
      jsonb_typeof (NEW.options) IS DISTINCT FROM 'array' OR jsonb_array_length (NEW.options) <> 3 OR NOT NEW.options @> '[{"code":"A"},{"code":"B"},{"code":"C"}]' :: jsonb OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements (NEW.options) x
        WHERE jsonb_typeof (x -> 'text') IS DISTINCT FROM 'string' OR nullif (btrim (x ->> 'text'), '') IS NULL
      )
    ) THEN
      RAISE EXCEPTION 'INVALID_OPTIONS';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM private.challenge_paths
      WHERE (version_id = OLD.version_id OR version_id = NEW.version_id)
    ) THEN
      RAISE EXCEPTION 'IMMUTABLE_VERSION';
    END IF;
  ELSIF TG_TABLE_NAME = 'challenge_versions' THEN
    IF EXISTS (
    SELECT 1
    FROM private.challenge_paths
    WHERE version_id = OLD.id) AND (TG_OP = 'DELETE' OR NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at) THEN
      RAISE EXCEPTION 'IMMUTABLE_VERSION';
    END IF;
  ELSIF TG_TABLE_NAME = 'challenge_paths' THEN
    IF NEW.user_id <> OLD.user_id OR NEW.version_id <> OLD.version_id OR NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'IMMUTABLE_PATH';
    END IF;
  ELSIF TG_TABLE_NAME = 'challenge_attempts' THEN
    IF OLD.finished_at IS NOT NULL OR NEW.path_id <> OLD.path_id OR NEW.number <> OLD.number OR NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'IMMUTABLE_ATTEMPT';
    END IF;
  ELSIF TG_TABLE_NAME = 'challenge_answers' THEN
    IF TG_OP = 'UPDATE' AND (NEW.attempt_id <> OLD.attempt_id OR NEW.question_code <> OLD.question_code) THEN
      RAISE EXCEPTION 'IMMUTABLE_ANSWER_KEY';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM private.challenge_attempts
      WHERE (id = OLD.attempt_id OR id = NEW.attempt_id) AND finished_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'IMMUTABLE_ATTEMPT';
    END IF;
    IF TG_OP <> 'DELETE' AND NOT EXISTS (
      SELECT 1
      FROM private.challenge_attempts a
      JOIN private.challenge_paths p ON p.id = a.path_id
      JOIN private.challenge_questions q ON q.version_id = p.version_id
      WHERE a.id = NEW.attempt_id AND q.code = NEW.question_code AND q.options @> jsonb_build_array (jsonb_build_object ('code', NEW.option_code))
    ) THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION private.challenge_subject_authorization(p_request uuid,p_subject uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' SET timezone='UTC' AS $$
DECLARE request jsonb; decisions jsonb:='[]';
BEGIN
 IF to_regclass('public.privacy_requests') IS NULL THEN RETURN NULL; END IF;
 EXECUTE 'SELECT to_jsonb(r) FROM public.privacy_requests r WHERE id=$1 AND subject_user_id=$2' INTO request USING p_request,p_subject;
 IF to_regclass('public.privacy_processing_actions') IS NOT NULL AND to_regclass('public.privacy_dependency_assessments') IS NOT NULL THEN
  EXECUTE $query$ SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'category',d.category,'resolution',a.resolution,'status',a.status) ORDER BY a.id),'[]')
  FROM public.privacy_processing_actions a JOIN public.privacy_dependency_assessments d ON d.id=a.assessment_id
  WHERE a.request_id=$1 AND d.category IN ('challenge','challenge_progress','lesson_progress')
  AND d.analysis_run_id=(SELECT analysis_run_id FROM public.privacy_dependency_assessments WHERE request_id=$1 ORDER BY assessed_at DESC,id DESC LIMIT 1)
  $query$ INTO decisions USING p_request;
 END IF;
 RETURN jsonb_build_object('request',request,'category_decisions',decisions);
END $$;

CREATE FUNCTION private.challenge_privacy_rpc(p_action text,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE u uuid:=auth.uid(); subject uuid; operation text; plan private.challenge_privacy_plans%ROWTYPE;
 c private.challenge_training_closures%ROWTYPE; p private.challenge_paths%ROWTYPE;
 source public.training_enrollments%ROWTYPE; subject_auth jsonb; request jsonb;
 n_paths int; n_attempts int; n_answers int; n_starts int; n_saves int; n_grants int; n_refs int; n_plans int; n_adminrefs int:=0; n_temp int;
BEGIN
 IF u IS NULL OR NOT private.is_strict_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 -- Nettoyage MANUEL des plans éphémères, sans toucher les données métier.
 DELETE FROM private.challenge_privacy_plans WHERE expires_at<=clock_timestamp();
 GET DIAGNOSTICS n_plans=ROW_COUNT;
 IF p_action='cleanup_plans' THEN RETURN jsonb_build_object('expired_plans_deleted',n_plans); END IF;
 IF p_action='audit' THEN
   RETURN coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY executed_at DESC) FROM private.challenge_privacy_audit a),'[]');
 END IF;
 IF p_action='execute' THEN
   SELECT * INTO plan FROM private.challenge_privacy_plans WHERE id=(p_payload->>'plan_id')::uuid;
   IF plan.id IS NULL THEN RAISE EXCEPTION 'PLAN_MISSING_OR_EXPIRED'; END IF;
   subject:=plan.subject_user_id;
 ELSE subject:=(p_payload->>'subject_user_id')::uuid; END IF;
 IF subject IS NULL OR NOT EXISTS(SELECT FROM public.profiles WHERE id=subject) THEN RAISE EXCEPTION 'SUBJECT_NOT_FOUND'; END IF;
 -- Même ordre que le jeu : droit, profil, parcours, tentatives.
 PERFORM 1 FROM public.course_access WHERE user_id=subject AND course_id='formation-ia-act' FOR SHARE;
 PERFORM 1 FROM public.profiles WHERE id=subject FOR UPDATE;
 PERFORM 1 FROM public.training_enrollments WHERE user_id=subject AND course_id='formation-ia-act' ORDER BY id FOR SHARE;
 SELECT * INTO p FROM private.challenge_paths WHERE user_id=subject FOR UPDATE;
 PERFORM 1 FROM private.challenge_attempts WHERE path_id=p.id ORDER BY id FOR UPDATE;
 PERFORM 1 FROM private.challenge_trainer_grants WHERE user_id=subject OR updated_by=subject ORDER BY user_id FOR UPDATE;
 SELECT * INTO c FROM private.challenge_training_closures WHERE user_id=subject FOR UPDATE;
 IF p_action='execute' THEN
   SELECT * INTO plan FROM private.challenge_privacy_plans WHERE id=(p_payload->>'plan_id')::uuid FOR UPDATE;
   IF plan.id IS NULL OR plan.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'PLAN_MISSING_OR_EXPIRED'; END IF;
 END IF;
 IF p_action='verify_training' THEN
   IF coalesce((p_payload->>'expected_revision')::int,0)<>coalesce(c.revision,0) THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
   IF p_payload->>'state' NOT IN ('ongoing','finished') OR p_payload->'confirmed' IS DISTINCT FROM 'true'::jsonb
     OR coalesce(p_payload->>'evidence_reference','') !~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
   IF p_payload->>'state'='finished' THEN
     IF (p_payload->>'ended_at')::timestamptz IS NULL OR (p_payload->>'ended_at')::timestamptz>clock_timestamp() THEN RAISE EXCEPTION 'INVALID_TRAINING_END'; END IF;
     IF p_payload->>'source_enrollment_id' IS NOT NULL THEN
       SELECT * INTO source FROM public.training_enrollments WHERE id=(p_payload->>'source_enrollment_id')::uuid AND user_id=subject AND course_id='formation-ia-act';
       IF source.id IS NULL OR source.status NOT IN ('completed','archived') OR (to_jsonb(source)->>'completed_at')::timestamptz IS DISTINCT FROM (p_payload->>'ended_at')::timestamptz THEN RAISE EXCEPTION 'INVALID_TRAINING_SOURCE'; END IF;
     END IF;
     IF EXISTS(SELECT FROM public.training_enrollments WHERE user_id=subject AND course_id='formation-ia-act' AND status IN ('draft','pending','validated','in_progress')) THEN RAISE EXCEPTION 'TRAINING_NOT_CLOSED'; END IF;
   END IF;
   INSERT INTO private.challenge_training_closures(user_id,state,ended_at,source_enrollment_id,source_fingerprint,evidence_reference,verified_by)
   VALUES(subject,p_payload->>'state',CASE WHEN p_payload->>'state'='finished' THEN (p_payload->>'ended_at')::timestamptz END,
     CASE WHEN p_payload->>'state'='finished' THEN (p_payload->>'source_enrollment_id')::uuid END,
     private.challenge_enrollment_proof(subject)::text,p_payload->>'evidence_reference',u)
   ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,ended_at=excluded.ended_at,
     source_enrollment_id=excluded.source_enrollment_id,source_fingerprint=excluded.source_fingerprint,
     evidence_reference=excluded.evidence_reference,verified_by=u,verified_at=clock_timestamp(),revision=private.challenge_training_closures.revision+1;
   RETURN private.challenge_privacy_overview(subject);
 ELSIF p_action='export' THEN
   RETURN jsonb_build_object('overview',private.challenge_privacy_overview(subject),
    'paths',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM private.challenge_paths x WHERE user_id=subject),
    'attempts',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY number),'[]') FROM private.challenge_attempts x WHERE path_id=p.id),
    'answers',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY attempt_id,question_code),'[]') FROM private.challenge_answers x WHERE attempt_id IN(SELECT id FROM private.challenge_attempts WHERE path_id=p.id)),
    'readable_responses',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'attempt_number',a.number,'version',p.version_id,'question_number',q.position,
      'question_code',q.code,'scenario',q.scenario,'selected_code',r.option_code,
      'selected_text',(SELECT option_item->>'text' FROM jsonb_array_elements(q.options) option_item WHERE option_item->>'code'=r.option_code),
      'saved_at',r.saved_at,'score_out_of_12',a.score,'finished_at',a.finished_at
    ) ORDER BY a.number,q.position),'[]') FROM private.challenge_answers r
      JOIN private.challenge_attempts a ON a.id=r.attempt_id
      JOIN private.challenge_questions q ON q.version_id=p.version_id AND q.code=r.question_code
      WHERE a.path_id=p.id),
    'start_requests',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM private.challenge_start_requests x WHERE user_id=subject),
    'save_requests',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM private.challenge_save_requests x WHERE attempt_id IN(SELECT id FROM private.challenge_attempts WHERE path_id=p.id)),
    'received_grants',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM private.challenge_trainer_grants x WHERE user_id=subject),
    'decisions_on_others',(SELECT coalesce(jsonb_agg(jsonb_build_object('course_id',course_id,'updated_at',updated_at,'active',active)),'[]') FROM private.challenge_trainer_grants WHERE updated_by=subject AND user_id<>subject),
    'verified_training_events',(SELECT coalesce(jsonb_agg(jsonb_build_object('verified_at',verified_at,'evidence_reference',evidence_reference)),'[]') FROM private.challenge_training_closures WHERE verified_by=subject AND user_id<>subject),
    'administrative_actions',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM private.challenge_privacy_audit a WHERE actor_user_id=subject),
    'created_plan_events',(SELECT coalesce(jsonb_agg(jsonb_build_object('created_at',p2.created_at,'expires_at',p2.expires_at,'operation',p2.operation)),'[]') FROM private.challenge_privacy_plans p2 WHERE p2.created_by=subject AND p2.subject_user_id<>subject));
 ELSIF p_action='preview' THEN RETURN private.challenge_privacy_overview(subject)||jsonb_build_object('eligible',private.challenge_privacy_eligible(subject));
 ELSIF p_action IN ('plan','execute') THEN
   operation:=CASE WHEN p_action='execute' THEN plan.operation ELSE p_payload->>'operation' END;
   IF operation NOT IN ('retention','subject_erasure') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
   IF p_action='plan' AND (p_payload->'exceptions_reviewed' IS DISTINCT FROM 'true'::jsonb
     OR coalesce(p_payload->>'decision_reference','') !~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$') THEN RAISE EXCEPTION 'EXCEPTION_REVIEW_REQUIRED'; END IF;
   IF operation='retention' AND NOT private.challenge_privacy_eligible(subject) THEN RAISE EXCEPTION 'RETENTION_NOT_DUE_OR_TRAINING_UNVERIFIED'; END IF;
   IF operation='subject_erasure' THEN
     IF to_regclass('public.privacy_requests') IS NULL THEN RAISE EXCEPTION 'PRIVACY_REQUEST_REQUIRED'; END IF;
     EXECUTE 'SELECT to_jsonb(r) FROM public.privacy_requests r WHERE id=$1 AND subject_user_id=$2 FOR UPDATE' INTO request
       USING CASE WHEN p_action='execute' THEN plan.request_id ELSE (p_payload->>'request_id')::uuid END,subject;
     IF request IS NULL OR coalesce(request->>'request_type','')<>'erasure' OR coalesce(request->>'identity_verification_status','')<>'verified'
       OR coalesce(request->>'administrative_decision','') NOT IN ('full_erasure_possible','partial_erasure_or_anonymization_required')
       OR coalesce(request->>'status','') NOT IN ('ready_for_execution','external_action_required') THEN RAISE EXCEPTION 'PRIVACY_REQUEST_NOT_APPROVED'; END IF;
     IF to_regclass('public.privacy_dependency_assessments') IS NOT NULL AND to_regclass('public.privacy_processing_actions') IS NOT NULL THEN
       EXECUTE 'SELECT id FROM public.privacy_dependency_assessments WHERE request_id=$1 ORDER BY id FOR SHARE' USING (request->>'id')::uuid;
       EXECUTE 'SELECT id FROM public.privacy_processing_actions WHERE request_id=$1 ORDER BY id FOR SHARE' USING (request->>'id')::uuid;
     END IF;
     subject_auth:=private.challenge_subject_authorization((request->>'id')::uuid,subject);
     IF EXISTS(SELECT FROM jsonb_array_elements(subject_auth->'category_decisions') d
       WHERE d->>'resolution'='retain' AND d->>'status' IN ('approved','executed')) THEN RAISE EXCEPTION 'CHALLENGE_RETENTION_EXCEPTION_REQUIRES_REVIEW'; END IF;
     IF p_action='plan' AND (p_payload->>'challenge_decision' IS DISTINCT FROM 'erase'
       OR p_payload->'challenge_exceptions_reviewed' IS DISTINCT FROM 'true'::jsonb
       OR coalesce(p_payload->>'decision_reference','') !~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$') THEN RAISE EXCEPTION 'CHALLENGE_CATEGORY_DECISION_REQUIRED'; END IF;
     IF p_action='execute' AND plan.subject_authorization_fingerprint IS DISTINCT FROM encode(sha256(convert_to(subject_auth::text,'UTF8')),'hex') THEN RAISE EXCEPTION 'STALE_PRIVACY_DECISION'; END IF;
   END IF;
   IF p_action='plan' THEN
     INSERT INTO private.challenge_privacy_plans(subject_user_id,path_id,request_id,operation,fingerprint,subject_authorization_fingerprint,decision_reference,created_by)
     VALUES(subject,p.id,(p_payload->>'request_id')::uuid,operation,private.challenge_privacy_fingerprint(subject),CASE WHEN operation='subject_erasure' THEN encode(sha256(convert_to(subject_auth::text,'UTF8')),'hex') END,p_payload->>'decision_reference',u) RETURNING * INTO plan;
     RETURN to_jsonb(plan)||jsonb_build_object('overview',private.challenge_privacy_overview(subject),'confirmation','EFFACER CHALLENGE '||plan.id::text);
   END IF;
   IF p_payload->>'confirmation' IS DISTINCT FROM 'EFFACER CHALLENGE '||plan.id::text THEN RAISE EXCEPTION 'CONFIRMATION_REQUIRED'; END IF;
   IF plan.fingerprint<>private.challenge_privacy_fingerprint(subject) OR p.id IS DISTINCT FROM plan.path_id THEN RAISE EXCEPTION 'STALE_PLAN'; END IF;
   INSERT INTO private.challenge_privacy_context VALUES(pg_backend_pid(),txid_current(),subject,p.id);
   DELETE FROM private.challenge_save_requests WHERE attempt_id IN(SELECT id FROM private.challenge_attempts WHERE path_id=p.id); GET DIAGNOSTICS n_saves=ROW_COUNT;
   DELETE FROM private.challenge_start_requests WHERE user_id=subject; GET DIAGNOSTICS n_starts=ROW_COUNT;
   DELETE FROM private.challenge_answers WHERE attempt_id IN(SELECT id FROM private.challenge_attempts WHERE path_id=p.id); GET DIAGNOSTICS n_answers=ROW_COUNT;
   DELETE FROM private.challenge_attempts WHERE path_id=p.id; GET DIAGNOSTICS n_attempts=ROW_COUNT;
   DELETE FROM private.challenge_paths WHERE user_id=subject; GET DIAGNOSTICS n_paths=ROW_COUNT;
   n_grants:=0; n_refs:=0;
   IF operation='subject_erasure' THEN
     DELETE FROM private.challenge_trainer_grants WHERE user_id=subject; GET DIAGNOSTICS n_grants=ROW_COUNT;
     UPDATE private.challenge_trainer_grants SET updated_by=NULL WHERE updated_by=subject; GET DIAGNOSTICS n_refs=ROW_COUNT;
   END IF;
   DELETE FROM private.challenge_training_closures WHERE user_id=subject;
   IF operation='subject_erasure' THEN
     UPDATE private.challenge_training_closures SET verified_by=NULL WHERE verified_by=subject; GET DIAGNOSTICS n_temp=ROW_COUNT; n_adminrefs:=n_adminrefs+n_temp;
     UPDATE private.challenge_privacy_audit SET actor_user_id=NULL WHERE actor_user_id=subject; GET DIAGNOSTICS n_temp=ROW_COUNT; n_adminrefs:=n_adminrefs+n_temp;
     UPDATE private.challenge_privacy_plans SET created_by=NULL WHERE created_by=subject AND subject_user_id<>subject; GET DIAGNOSTICS n_temp=ROW_COUNT; n_adminrefs:=n_adminrefs+n_temp;
   END IF;
   DELETE FROM private.challenge_privacy_plans WHERE subject_user_id=subject;
   DELETE FROM private.challenge_privacy_context WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current();
   INSERT INTO private.challenge_privacy_audit(actor_user_id,operation,paths_deleted,attempts_deleted,answers_deleted,request_logs_deleted,grants_deleted,actor_references_unlinked,administrative_references_unlinked)
   VALUES(CASE WHEN operation='subject_erasure' AND u=subject THEN NULL ELSE u END,operation,n_paths,n_attempts,n_answers,n_starts+n_saves,n_grants,n_refs,n_adminrefs);
   RETURN jsonb_build_object('executed',true,'paths_deleted',n_paths,'attempts_deleted',n_attempts,'answers_deleted',n_answers,'request_logs_deleted',n_starts+n_saves,'grants_deleted',n_grants,'actor_references_unlinked',n_refs,'administrative_references_unlinked',n_adminrefs);
 ELSIF p_action='cancel_plan' THEN
   DELETE FROM private.challenge_privacy_plans WHERE id=(p_payload->>'plan_id')::uuid AND subject_user_id=subject;
   RETURN jsonb_build_object('cancelled',true);
 END IF;
 RAISE EXCEPTION 'INVALID_INPUT';
END $$;
CREATE FUNCTION public.admin_challenge_privacy(p_action text,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' SET timezone='UTC' AS $$
SELECT private.challenge_privacy_rpc(p_action,p_payload)
$$;

-- Aucun helper interne accessible depuis les clients ; seule la RPC admin vérifie
-- auth.uid() et private.is_strict_admin() à CHAQUE appel.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND (p.proname LIKE 'challenge_privacy_%' OR p.proname IN ('challenge_retention_due','challenge_enrollment_proof','challenge_subject_authorization')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.admin_challenge_privacy(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.challenge_privacy_rpc(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_challenge_privacy(text,jsonb) TO authenticated;

-- L'assistant historique reste inchangé dans ses catégories commerciales.
-- Sa vue d'analyse annonce l'étape Challenge ; son exécution refuse de passer
-- silencieusement à une anonymisation du profil tant que cette étape reste due.
DO $$ BEGIN
 IF to_regprocedure('public.admin_analyze_privacy_request(uuid)') IS NOT NULL THEN
   ALTER FUNCTION public.admin_analyze_privacy_request(uuid) SET SCHEMA private;
   ALTER FUNCTION private.admin_analyze_privacy_request(uuid) RENAME TO challenge_privacy_original_analysis;
   REVOKE ALL ON FUNCTION private.challenge_privacy_original_analysis(uuid) FROM PUBLIC,anon,authenticated,service_role;
   EXECUTE $def$ CREATE FUNCTION public.admin_analyze_privacy_request(p_request_id uuid)
   RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $fn$
   DECLARE result jsonb; subject uuid;
   BEGIN
    IF auth.uid() IS NULL OR NOT private.is_strict_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
    result:=private.challenge_privacy_original_analysis(p_request_id);
    SELECT subject_user_id INTO subject FROM public.privacy_requests WHERE id=p_request_id;
    IF subject IS NOT NULL THEN result:=result||jsonb_build_object('challenge_manual_step',private.challenge_privacy_overview(subject)); END IF;
    RETURN result;
   END $fn$ $def$;
   REVOKE ALL ON FUNCTION public.admin_analyze_privacy_request(uuid) FROM PUBLIC,anon,authenticated,service_role;
   GRANT EXECUTE ON FUNCTION public.admin_analyze_privacy_request(uuid) TO authenticated;
 END IF;
 IF to_regprocedure('public.admin_execute_privacy_request(uuid,text,text)') IS NOT NULL THEN
   ALTER FUNCTION public.admin_execute_privacy_request(uuid,text,text) SET SCHEMA private;
   ALTER FUNCTION private.admin_execute_privacy_request(uuid,text,text) RENAME TO challenge_privacy_original_execution;
   REVOKE ALL ON FUNCTION private.challenge_privacy_original_execution(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
   EXECUTE $def$ CREATE FUNCTION public.admin_execute_privacy_request(p_request_id uuid,p_confirmation text,p_reason text)
   RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $fn$
   DECLARE subject uuid;
   BEGIN
    IF auth.uid() IS NULL OR NOT private.is_strict_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
    SELECT subject_user_id INTO subject FROM public.privacy_requests WHERE id=p_request_id;
    PERFORM 1 FROM public.course_access WHERE user_id=subject AND course_id='formation-ia-act' FOR SHARE;
    PERFORM 1 FROM public.profiles WHERE id=subject FOR UPDATE;
    PERFORM 1 FROM public.privacy_requests WHERE id=p_request_id FOR SHARE;
    IF EXISTS(SELECT FROM private.challenge_paths WHERE user_id=subject)
      OR EXISTS(SELECT FROM private.challenge_training_closures WHERE user_id=subject)
      OR EXISTS(SELECT FROM private.challenge_trainer_grants WHERE user_id=subject OR updated_by=subject)
      OR EXISTS(SELECT FROM private.challenge_privacy_plans WHERE subject_user_id=subject) THEN
      RAISE EXCEPTION 'CHALLENGE_PRIVACY_STEP_REQUIRED';
    END IF;
    IF EXISTS(SELECT FROM private.challenge_training_closures WHERE verified_by=subject)
      OR EXISTS(SELECT FROM private.challenge_privacy_audit WHERE actor_user_id=subject)
      OR EXISTS(SELECT FROM private.challenge_privacy_plans WHERE created_by=subject) THEN
      RAISE EXCEPTION 'CHALLENGE_PRIVACY_STEP_REQUIRED';
    END IF;
    RETURN private.challenge_privacy_original_execution(p_request_id,p_confirmation,p_reason);
   END $fn$ $def$;
   REVOKE ALL ON FUNCTION public.admin_execute_privacy_request(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
   GRANT EXECUTE ON FUNCTION public.admin_execute_privacy_request(uuid,text,text) TO authenticated;
 END IF;
END $$;

COMMIT;
