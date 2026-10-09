BEGIN;
-- Spécifique formation-ia-act. Aucun changement du workflow LMS/commercial.
CREATE TABLE private.challenge_training_declarations (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 declared_ended_at timestamptz NOT NULL, declared_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.challenge_training_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0), action text NOT NULL CHECK(action IN('declare','verify','reopen','review')),
 request_id uuid NOT NULL, request_fingerprint text NOT NULL,
 actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reason_code text NOT NULL CHECK(reason_code ~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$'),
 ended_at timestamptz, evidence_kind text, evidence_id text, evidence_reference text, evidence_sha256 text,
 evidence_fingerprint text, enrollment_fingerprint text,
 UNIQUE(user_id,revision), UNIQUE(user_id,request_id)
);
CREATE INDEX challenge_training_history_actor_idx ON private.challenge_training_history(actor_user_id);
ALTER TABLE private.challenge_training_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.challenge_training_declarations FORCE ROW LEVEL SECURITY;
ALTER TABLE private.challenge_training_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.challenge_training_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.challenge_training_declarations,private.challenge_training_history FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.challenge_training_history_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT FROM private.challenge_privacy_context WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current() AND
 (subject_user_id=OLD.user_id OR (TG_OP='UPDATE' AND subject_user_id=OLD.actor_user_id))) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.actor_user_id IS NULL AND (to_jsonb(NEW)-'actor_user_id')=(to_jsonb(OLD)-'actor_user_id') THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'PEDAGOGICAL_HISTORY_IMMUTABLE';
END $$;
CREATE TRIGGER challenge_training_history_immutable BEFORE UPDATE OR DELETE ON private.challenge_training_history FOR EACH ROW EXECUTE FUNCTION private.challenge_training_history_guard();

CREATE FUNCTION private.challenge_training_evidence(p_user uuid,p_kind text,p_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_kind='attestation' AND to_regclass('public.course_attestation_issuances') IS NOT NULL THEN
  EXECUTE 'SELECT to_jsonb(x) FROM public.course_attestation_issuances x WHERE id::text=$1 AND user_id=$2 AND course_id=''formation-ia-act'' AND document_type IN (''realisation'',''competences'')'
   INTO result USING p_id,p_user;
 ELSIF p_kind='document' AND to_regclass('public.training_documents') IS NOT NULL THEN
  -- Un certificat produit par le clic global n'est jamais une preuve suffisante.
  EXECUTE 'SELECT to_jsonb(x) FROM public.training_documents x WHERE id::text=$1 AND user_id=$2 AND course_id=''formation-ia-act'' AND document_type=''attendance_sheet'' AND status IN (''completed'',''archived'')'
   INTO result USING p_id,p_user;
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION private.challenge_training_verified(p_user uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE h private.challenge_training_history%ROWTYPE; proof jsonb;
BEGIN
 SELECT * INTO h FROM private.challenge_training_history WHERE user_id=p_user ORDER BY revision DESC LIMIT 1;
 IF h.action IS DISTINCT FROM 'verify' OR NOT EXISTS(SELECT FROM public.profiles WHERE id=h.actor_user_id AND role='admin') THEN RETURN false; END IF;
 IF h.evidence_kind='controlled_external' THEN proof:=jsonb_build_object('reference',h.evidence_reference,'sha256',h.evidence_sha256);
 ELSE proof:=private.challenge_training_evidence(p_user,h.evidence_kind,h.evidence_id); END IF;
 RETURN proof IS NOT NULL AND h.evidence_fingerprint=encode(sha256(convert_to(proof::text,'UTF8')),'hex')
 AND EXISTS(SELECT FROM private.challenge_training_closures c WHERE c.user_id=p_user AND c.state='finished' AND c.revision=h.revision
 AND c.ended_at=h.ended_at AND c.source_fingerprint=private.challenge_enrollment_proof(p_user)::text)
 AND NOT EXISTS(SELECT FROM public.training_enrollments WHERE user_id=p_user AND course_id='formation-ia-act' AND status IN('draft','pending','validated','in_progress'));
END $$;
CREATE FUNCTION private.challenge_training_state(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' SET timezone='UTC' AS $$
WITH h AS(SELECT * FROM private.challenge_training_history WHERE user_id=p_user ORDER BY revision DESC LIMIT 1),
d AS(SELECT * FROM private.challenge_training_declarations WHERE user_id=p_user),
c AS(SELECT * FROM private.challenge_training_closures WHERE user_id=p_user)
SELECT jsonb_build_object('revision',coalesce((SELECT revision FROM h),0),
 'state',CASE WHEN private.challenge_training_verified(p_user) THEN 'verified'
 WHEN (SELECT action FROM h) IN('review','verify') THEN 'review_required' WHEN (SELECT action FROM h)='declare' THEN 'declared' ELSE 'ongoing' END,
 'declared_ended_at',(SELECT declared_ended_at FROM d),
 'ended_at',(SELECT ended_at FROM c WHERE state='finished' AND (SELECT action FROM h)='verify'),
 'verified_at',(SELECT verified_at FROM c WHERE state='finished' AND (SELECT action FROM h)='verify'),
 'due_at',(SELECT private.challenge_retention_due(ended_at) FROM c WHERE private.challenge_training_verified(p_user)))
$$;
CREATE FUNCTION private.challenge_training_analysis(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE attestations jsonb:='[]'; documents jsonb:='[]';
BEGIN
 IF to_regclass('public.course_attestation_issuances') IS NOT NULL THEN
  EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY issued_at),''[]'') FROM public.course_attestation_issuances x WHERE user_id=$1 AND course_id=''formation-ia-act''' INTO attestations USING p_user;
 END IF;
 IF to_regclass('public.training_documents') IS NOT NULL THEN
  EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY generated_at),''[]'') FROM public.training_documents x WHERE user_id=$1 AND course_id=''formation-ia-act'' AND document_type=''attendance_sheet''' INTO documents USING p_user;
 END IF;
 RETURN jsonb_build_object('status',private.challenge_training_state(p_user),
  'declaration',(SELECT to_jsonb(d) FROM private.challenge_training_declarations d WHERE user_id=p_user),
  'closure',(SELECT to_jsonb(c) FROM private.challenge_training_closures c WHERE user_id=p_user),
  'history',(SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY revision),'[]') FROM private.challenge_training_history h WHERE user_id=p_user),
  'enrollments',private.challenge_enrollment_proof(p_user),
  'evidence_candidates',jsonb_build_object('attestations',attestations,'documents',documents));
END $$;
CREATE FUNCTION private.challenge_training_rpc(p_admin boolean,p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE actor uuid:=auth.uid(); subject uuid; last private.challenge_training_history%ROWTYPE;
 old private.challenge_training_history%ROWTYPE; rev int; req uuid; fp text; evidence jsonb; ended timestamptz; kind text; ref text;
BEGIN
 IF p_admin IS NULL OR actor IS NULL OR (p_admin AND NOT private.is_strict_admin()) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 subject:=CASE WHEN p_admin THEN (p_payload->>'subject_user_id')::uuid ELSE actor END;
 IF subject IS NULL OR NOT EXISTS(SELECT FROM public.profiles WHERE id=subject) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 -- Même ordre de verrouillage que jeu/purge, puis état pédagogique.
 PERFORM 1 FROM public.course_access WHERE user_id=subject AND course_id='formation-ia-act' FOR SHARE;
 IF NOT p_admin AND NOT EXISTS(SELECT FROM public.course_access WHERE user_id=subject AND course_id='formation-ia-act' AND status='active' AND (expires_at IS NULL OR expires_at>clock_timestamp())) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=subject FOR UPDATE;
 PERFORM 1 FROM public.training_enrollments WHERE user_id=subject AND course_id='formation-ia-act' ORDER BY id FOR SHARE;
 IF p_action='status' AND NOT p_admin THEN RETURN private.challenge_training_state(subject); END IF;
 IF p_action='analyse' AND p_admin THEN RETURN private.challenge_training_analysis(subject); END IF;
 IF (NOT p_admin AND p_action<>'declare') OR (p_admin AND p_action NOT IN('verify','reopen','review')) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 req:=(p_payload->>'request_id')::uuid;
 IF req IS NULL OR p_payload->'confirmed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 fp:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'payload',p_payload,'actor',actor)::text,'UTF8')),'hex');
 SELECT * INTO old FROM private.challenge_training_history WHERE user_id=subject AND request_id=req;
 IF old.id IS NOT NULL THEN
  IF old.request_fingerprint<>fp THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
  RETURN CASE WHEN p_admin THEN private.challenge_training_analysis(subject) ELSE private.challenge_training_state(subject) END;
 END IF;
 SELECT * INTO last FROM private.challenge_training_history WHERE user_id=subject ORDER BY revision DESC LIMIT 1;
 rev:=coalesce(last.revision,0);
 IF (p_payload->>'expected_revision')::int IS DISTINCT FROM rev THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
 ref:=CASE WHEN p_admin THEN p_payload->>'reason_code' ELSE 'LEARNER-DECLARATION' END;
 IF coalesce(ref,'') !~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF p_action='declare' THEN
  IF last.action='verify' THEN RAISE EXCEPTION 'ALREADY_VERIFIED'; END IF;
  ended:=(p_payload->>'declared_ended_at')::timestamptz;
  IF ended IS NULL OR ended>clock_timestamp() THEN RAISE EXCEPTION 'INVALID_TRAINING_END'; END IF;
  INSERT INTO private.challenge_training_declarations VALUES(subject,ended,clock_timestamp()) ON CONFLICT(user_id) DO UPDATE SET declared_ended_at=excluded.declared_ended_at,declared_at=excluded.declared_at;
 ELSIF p_action='verify' THEN
  IF last.action='verify' THEN RAISE EXCEPTION 'ALREADY_VERIFIED'; END IF;
  ended:=(p_payload->>'ended_at')::timestamptz;
  IF ended IS NULL OR ended>clock_timestamp() THEN RAISE EXCEPTION 'INVALID_TRAINING_END'; END IF;
  IF EXISTS(SELECT FROM public.training_enrollments WHERE user_id=subject AND course_id='formation-ia-act' AND status IN('draft','pending','validated','in_progress')) THEN RAISE EXCEPTION 'TRAINING_NOT_CLOSED'; END IF;
  kind:=p_payload->>'evidence_kind';
  IF p_payload->'evidence_reviewed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'EVIDENCE_REQUIRED'; END IF;
  IF kind='controlled_external' THEN
   IF coalesce(p_payload->>'evidence_reference','') !~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$' OR coalesce(p_payload->>'evidence_sha256','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'EVIDENCE_NOT_VALID'; END IF;
   evidence:=jsonb_build_object('reference',p_payload->>'evidence_reference','sha256',p_payload->>'evidence_sha256');
  ELSE
   evidence:=private.challenge_training_evidence(subject,kind,p_payload->>'evidence_id');
   IF evidence IS NULL THEN RAISE EXCEPTION 'EVIDENCE_NOT_VALID'; END IF;
  END IF;
 END IF;
 INSERT INTO private.challenge_training_history(user_id,revision,action,request_id,request_fingerprint,actor_user_id,reason_code,ended_at,evidence_kind,evidence_id,evidence_reference,evidence_sha256,evidence_fingerprint,enrollment_fingerprint)
 VALUES(subject,rev+1,p_action,req,fp,actor,ref,ended,kind,p_payload->>'evidence_id',p_payload->>'evidence_reference',p_payload->>'evidence_sha256',CASE WHEN evidence IS NOT NULL THEN encode(sha256(convert_to(evidence::text,'UTF8')),'hex') END,private.challenge_enrollment_proof(subject)::text);
 IF p_admin THEN
  INSERT INTO private.challenge_training_closures(user_id,state,ended_at,source_fingerprint,evidence_reference,verified_by,revision)
  VALUES(subject,CASE WHEN p_action='verify' THEN 'finished' ELSE 'ongoing' END,ended,private.challenge_enrollment_proof(subject)::text,coalesce(p_payload->>'evidence_reference',ref),actor,rev+1)
  ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,ended_at=excluded.ended_at,source_enrollment_id=NULL,source_fingerprint=excluded.source_fingerprint,evidence_reference=excluded.evidence_reference,verified_by=actor,verified_at=clock_timestamp(),revision=excluded.revision;
 END IF;
 RETURN CASE WHEN p_admin THEN private.challenge_training_analysis(subject) ELSE private.challenge_training_state(subject) END;
END $$;
CREATE FUNCTION public.challenge_training_status(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.challenge_training_rpc(false,p_action,p_payload) $$;
CREATE FUNCTION public.admin_challenge_training(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.challenge_training_rpc(true,p_action,p_payload) $$;

-- La conservation exige désormais une validation par la nouvelle voie ; anciens
-- completed_at/closures non historisés ne rendent jamais un sujet éligible.
CREATE OR REPLACE FUNCTION private.challenge_privacy_eligible(p_user uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE h private.challenge_training_history%ROWTYPE; proof jsonb;
BEGIN
 SELECT * INTO h FROM private.challenge_training_history WHERE user_id=p_user ORDER BY revision DESC LIMIT 1;
 IF NOT private.challenge_training_verified(p_user) THEN RETURN false; END IF;
 IF h.evidence_kind='controlled_external' THEN proof:=jsonb_build_object('reference',h.evidence_reference,'sha256',h.evidence_sha256);
 ELSE proof:=private.challenge_training_evidence(p_user,h.evidence_kind,h.evidence_id); END IF;
 RETURN proof IS NOT NULL AND h.evidence_fingerprint=encode(sha256(convert_to(proof::text,'UTF8')),'hex')
 AND EXISTS(SELECT FROM private.challenge_training_closures c WHERE c.user_id=p_user AND c.state='finished' AND c.revision=h.revision
  AND c.ended_at=h.ended_at AND private.challenge_retention_due(c.ended_at)<=clock_timestamp()
  AND c.source_fingerprint=private.challenge_enrollment_proof(p_user)::text)
 AND NOT EXISTS(SELECT FROM public.training_enrollments WHERE user_id=p_user AND course_id='formation-ia-act' AND status IN('draft','pending','validated','in_progress'));
END $$;
ALTER FUNCTION private.challenge_privacy_fingerprint(uuid) RENAME TO challenge_privacy_fingerprint_v1;
CREATE FUNCTION private.challenge_privacy_fingerprint(p_user uuid) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('base',private.challenge_privacy_fingerprint_v1(p_user),
 'declaration',(SELECT to_jsonb(d) FROM private.challenge_training_declarations d WHERE user_id=p_user),
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY revision),'[]') FROM private.challenge_training_history h WHERE user_id=p_user),
 'author_references',(SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY id),'[]') FROM private.challenge_training_history h WHERE actor_user_id=p_user AND user_id<>p_user))::text,'UTF8')),'hex')
$$;
ALTER FUNCTION private.challenge_privacy_rpc(text,jsonb) RENAME TO challenge_privacy_rpc_v1;
CREATE FUNCTION private.challenge_privacy_rpc(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; subject uuid; op text; unlinked int;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_strict_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 IF p_action='verify_training' THEN RAISE EXCEPTION 'PEDAGOGICAL_EVIDENCE_REQUIRED_USE_DEDICATED_RPC'; END IF;
 IF p_action='execute' THEN
  SELECT subject_user_id,operation INTO subject,op FROM private.challenge_privacy_plans WHERE id=(p_payload->>'plan_id')::uuid;
 ELSE subject:=(p_payload->>'subject_user_id')::uuid; END IF;
 result:=private.challenge_privacy_rpc_v1(p_action,p_payload);
 IF p_action='execute' THEN
  INSERT INTO private.challenge_privacy_context VALUES(pg_backend_pid(),txid_current(),subject,NULL);
  DELETE FROM private.challenge_training_declarations WHERE user_id=subject;
  DELETE FROM private.challenge_training_history WHERE user_id=subject;
  IF op='subject_erasure' THEN
   UPDATE private.challenge_training_history SET actor_user_id=NULL WHERE actor_user_id=subject;
   GET DIAGNOSTICS unlinked=ROW_COUNT;
   UPDATE private.challenge_privacy_audit SET administrative_references_unlinked=administrative_references_unlinked+unlinked
   WHERE xmin::text=txid_current()::text AND operation=op;
   result:=jsonb_set(result,'{administrative_references_unlinked}',to_jsonb(coalesce((result->>'administrative_references_unlinked')::int,0)+unlinked));
  END IF;
  DELETE FROM private.challenge_privacy_context WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current();
 ELSIF p_action='export' THEN result:=result||jsonb_build_object('pedagogical_end',private.challenge_training_analysis(subject),
 'pedagogical_administrative_actions',(SELECT coalesce(jsonb_agg(jsonb_build_object('recorded_at',recorded_at,'action',action,'reason_code',reason_code)),'[]') FROM private.challenge_training_history WHERE actor_user_id=subject AND user_id<>subject));
 ELSIF p_action='preview' THEN result:=result||jsonb_build_object('pedagogical_end',private.challenge_training_analysis(subject)); END IF;
 RETURN result;
END $$;
ALTER FUNCTION private.challenge_privacy_overview(uuid) RENAME TO challenge_privacy_overview_v1;
CREATE FUNCTION private.challenge_privacy_overview(p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
SELECT jsonb_set(private.challenge_privacy_overview_v1(p_user),'{counts}',
 (private.challenge_privacy_overview_v1(p_user)->'counts')||jsonb_build_object(
 'pedagogical_declarations',(SELECT count(*) FROM private.challenge_training_declarations WHERE user_id=p_user),
 'pedagogical_history',(SELECT count(*) FROM private.challenge_training_history WHERE user_id=p_user),
 'pedagogical_author_references',(SELECT count(*) FROM private.challenge_training_history WHERE actor_user_id=p_user AND user_id<>p_user)))
$$;
-- Les demandes de droits doivent traiter aussi la déclaration/historique.
DO $install$ BEGIN
IF to_regprocedure('public.admin_execute_privacy_request(uuid,text,text)') IS NOT NULL THEN
ALTER FUNCTION public.admin_execute_privacy_request(uuid,text,text) RENAME TO challenge_privacy_execution_v1;
EXECUTE $definition$ CREATE FUNCTION public.admin_execute_privacy_request(p_request_id uuid,p_confirmation text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE subject uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_strict_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 SELECT subject_user_id INTO subject FROM public.privacy_requests WHERE id=p_request_id;
 PERFORM 1 FROM public.course_access WHERE user_id=subject AND course_id='formation-ia-act' FOR SHARE;
 PERFORM 1 FROM public.profiles WHERE id=subject FOR UPDATE;
 IF EXISTS(SELECT FROM private.challenge_training_declarations WHERE user_id=subject) OR EXISTS(SELECT FROM private.challenge_training_history WHERE user_id=subject OR actor_user_id=subject)
 OR EXISTS(SELECT FROM private.challenge_processing_restrictions WHERE updated_by=subject) THEN RAISE EXCEPTION 'CHALLENGE_PRIVACY_STEP_REQUIRED'; END IF;
 RETURN public.challenge_privacy_execution_v1(p_request_id,p_confirmation,p_reason);
END $body$ $definition$;
REVOKE ALL ON FUNCTION public.challenge_privacy_execution_v1(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.admin_execute_privacy_request(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_execute_privacy_request(uuid,text,text) TO authenticated;
END IF;
END $install$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND (p.proname LIKE 'challenge_training_%' OR p.proname IN('challenge_privacy_rpc_v1','challenge_privacy_fingerprint_v1','challenge_privacy_overview_v1','challenge_privacy_overview','challenge_privacy_rpc','challenge_privacy_fingerprint','challenge_privacy_eligible')) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature); END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.challenge_training_status(text,jsonb),public.admin_challenge_training(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.challenge_training_rpc(boolean,text,jsonb),private.challenge_privacy_rpc(text,jsonb),public.challenge_training_status(text,jsonb),public.admin_challenge_training(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_challenge_privacy(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.challenge_privacy_rpc(p_action,p_payload) $$;
-- Opposition/limitation : finalité de respect du droit, distincte du jeu/quota.
-- Aucune expiration automatique. Revue humaine obligatoire, sans réactiver collecte.
CREATE TABLE private.challenge_processing_restrictions (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 active boolean NOT NULL, privacy_request_id uuid NOT NULL,
 review_due_at timestamptz NOT NULL, revision integer NOT NULL CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 decision_reference text NOT NULL CHECK(decision_reference ~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$'),
 request_id uuid NOT NULL, request_fingerprint text NOT NULL,
 lifting_evidence_reference text CHECK(lifting_evidence_reference IS NULL OR lifting_evidence_reference ~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$')
);
ALTER TABLE private.challenge_processing_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.challenge_processing_restrictions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.challenge_processing_restrictions FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.challenge_processing_restricted(p_user uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
SELECT coalesce((SELECT active FROM private.challenge_processing_restrictions WHERE user_id=p_user),false)
$$;
ALTER TABLE private.challenge_privacy_audit DROP CONSTRAINT challenge_privacy_audit_operation_check;
ALTER TABLE private.challenge_privacy_audit ADD CONSTRAINT challenge_privacy_audit_operation_check CHECK(operation IN('retention','subject_erasure','restrict','unrestrict'));
ALTER FUNCTION private.challenge_training_rpc(boolean,text,jsonb) RENAME TO challenge_training_rpc_v1;
CREATE FUNCTION private.challenge_training_rpc(p_admin boolean,p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); subject uuid; r private.challenge_processing_restrictions%ROWTYPE; request jsonb; result jsonb; fp text; due timestamptz;
BEGIN
 IF p_admin IS NULL OR actor IS NULL OR (p_admin AND NOT private.is_strict_admin()) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 subject:=CASE WHEN p_admin THEN (p_payload->>'subject_user_id')::uuid ELSE actor END;
 IF p_action IN('restrict','unrestrict') THEN
  IF NOT p_admin THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  PERFORM 1 FROM public.course_access WHERE user_id=subject AND course_id='formation-ia-act' FOR SHARE;
  PERFORM 1 FROM public.profiles WHERE id=subject FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  SELECT * INTO r FROM private.challenge_processing_restrictions WHERE user_id=subject FOR UPDATE;
  IF p_payload->'confirmed' IS DISTINCT FROM 'true'::jsonb OR p_payload->'decision_reviewed' IS DISTINCT FROM 'true'::jsonb
   OR (p_payload->>'request_id')::uuid IS NULL OR coalesce(p_payload->>'reason_code','') !~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  fp:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'payload',p_payload,'actor',actor)::text,'UTF8')),'hex');
  IF r.request_id=(p_payload->>'request_id')::uuid THEN
   IF r.request_fingerprint<>fp THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
  ELSE
   IF (p_payload->>'expected_restriction_revision')::int IS DISTINCT FROM coalesce(r.revision,0) THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
   IF p_action='unrestrict' AND (p_payload->'lifting_decision' IS DISTINCT FROM 'true'::jsonb OR coalesce(p_payload->>'lifting_evidence_reference','') !~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$') THEN RAISE EXCEPTION 'RESTRICTION_LIFTING_DECISION_REQUIRED'; END IF;
   IF to_regclass('public.privacy_requests') IS NULL THEN RAISE EXCEPTION 'PRIVACY_REQUEST_REQUIRED'; END IF;
   EXECUTE 'SELECT to_jsonb(x) FROM public.privacy_requests x WHERE id=$1 AND subject_user_id=$2 FOR SHARE' INTO request USING (p_payload->>'privacy_request_id')::uuid,subject;
   IF request IS NULL OR request->>'request_type' NOT IN('objection','restriction') OR request->>'identity_verification_status'<>'verified' THEN RAISE EXCEPTION 'PRIVACY_REQUEST_NOT_APPROVED'; END IF;
   due:=(p_payload->>'review_due_at')::timestamptz;
   IF due IS NULL OR due<=clock_timestamp() THEN RAISE EXCEPTION 'REVIEW_DATE_REQUIRED'; END IF;
   INSERT INTO private.challenge_processing_restrictions VALUES(subject,p_action='restrict',(p_payload->>'privacy_request_id')::uuid,due,coalesce(r.revision,0)+1,clock_timestamp(),actor,p_payload->>'reason_code',(p_payload->>'request_id')::uuid,fp,CASE WHEN p_action='unrestrict' THEN p_payload->>'lifting_evidence_reference' END)
   ON CONFLICT(user_id) DO UPDATE SET active=excluded.active,privacy_request_id=excluded.privacy_request_id,review_due_at=excluded.review_due_at,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=actor,decision_reference=excluded.decision_reference,request_id=excluded.request_id,request_fingerprint=excluded.request_fingerprint,lifting_evidence_reference=excluded.lifting_evidence_reference;
   INSERT INTO private.challenge_privacy_audit(actor_user_id,operation,paths_deleted,attempts_deleted,answers_deleted,request_logs_deleted,grants_deleted,actor_references_unlinked,administrative_references_unlinked)
   VALUES(actor,p_action,0,0,0,0,0,0,0);
  END IF;
  result:=private.challenge_training_analysis(subject);
 ELSE result:=private.challenge_training_rpc_v1(p_admin,p_action,p_payload); END IF;
 RETURN result||jsonb_build_object('restriction',CASE WHEN p_admin THEN (SELECT to_jsonb(x) FROM private.challenge_processing_restrictions x WHERE user_id=subject)
 ELSE jsonb_build_object('active',private.challenge_processing_restricted(subject)) END);
END $$;
CREATE OR REPLACE FUNCTION public.challenge_training_status(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.challenge_training_rpc(false,p_action,p_payload) $$;
CREATE OR REPLACE FUNCTION public.admin_challenge_training(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.challenge_training_rpc(true,p_action,p_payload) $$;
-- Modification ciblée de la logique RPC, aucune question/option/correction touchée.
DO $$ DECLARE source text; anchor text; BEGIN
 source:=replace(pg_get_functiondef('private.challenge_rpc(text,jsonb)'::regprocedure),chr(13),'');
 anchor:=E'WHERE id = u FOR\n  UPDATE;';
 IF strpos(source,anchor)=0 THEN RAISE EXCEPTION 'CHALLENGE_LOCK_ANCHOR_MISSING'; END IF;
 source:=replace(source,anchor,anchor||E'\n  IF private.challenge_processing_restricted(u) THEN RAISE EXCEPTION ''CHALLENGE_PROCESSING_RESTRICTED''; END IF;');
 source:=replace(source,'IF target IS NULL OR NOT EXISTS (','IF target IS NULL OR private.challenge_processing_restricted(target) OR NOT EXISTS (');
 anchor:=E'WHERE course_id = ''formation-ia-act''\n      ORDER BY user_id';
 IF strpos(source,anchor)=0 THEN RAISE EXCEPTION 'CHALLENGE_POPULATION_ANCHOR_MISSING'; END IF;
 source:=replace(source,anchor,E'WHERE course_id = ''formation-ia-act'' AND NOT private.challenge_processing_restricted(course_access.user_id)\n      ORDER BY user_id');
 anchor:='JOIN private.challenge_attempts a ON a.path_id = p.id AND a.finished_at IS NOT NULL';
 IF strpos(source,anchor)=0 THEN RAISE EXCEPTION 'CHALLENGE_ANALYSIS_ANCHOR_MISSING'; END IF;
 source:=replace(source,anchor,anchor||' AND NOT private.challenge_processing_restricted(p.user_id)');
 EXECUTE source;
END $$;
ALTER FUNCTION private.challenge_privacy_fingerprint(uuid) RENAME TO challenge_privacy_fingerprint_v2;
CREATE FUNCTION private.challenge_privacy_fingerprint(p_user uuid) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
SELECT encode(sha256(convert_to(jsonb_build_object('base',private.challenge_privacy_fingerprint_v2(p_user),'restriction',(SELECT to_jsonb(r) FROM private.challenge_processing_restrictions r WHERE user_id=p_user),
 'restriction_author_references',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY user_id),'[]') FROM private.challenge_processing_restrictions r WHERE updated_by=p_user AND user_id<>p_user))::text,'UTF8')),'hex')
$$;
ALTER FUNCTION private.challenge_privacy_rpc(text,jsonb) RENAME TO challenge_privacy_rpc_v2;
CREATE FUNCTION private.challenge_privacy_rpc(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; subject uuid; op text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_strict_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 IF p_action='execute' THEN SELECT subject_user_id,operation INTO subject,op FROM private.challenge_privacy_plans WHERE id=(p_payload->>'plan_id')::uuid;
 ELSE subject:=(p_payload->>'subject_user_id')::uuid; END IF;
 result:=private.challenge_privacy_rpc_v2(p_action,p_payload);
 IF p_action='execute' THEN
  -- Le marqueur actif de droits subsiste, pas les scores/quota ; suppression avec
  -- retrait humain documenté ou disparition effective du compte (FK cascade).
  DELETE FROM private.challenge_processing_restrictions WHERE user_id=subject AND NOT active;
  IF op='subject_erasure' THEN UPDATE private.challenge_processing_restrictions SET updated_by=NULL WHERE updated_by=subject; END IF;
 END IF;
 IF p_action IN('export','preview','plan','execute') THEN result:=result||jsonb_build_object('processing_restriction',(SELECT to_jsonb(r) FROM private.challenge_processing_restrictions r WHERE user_id=subject),'restriction_separate_purpose','Respect opposition/limitation : marqueur minimal actif conservé séparément, revue humaine, aucun quota ou score.'); END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.admin_challenge_privacy(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.challenge_privacy_rpc(p_action,p_payload) $$;
REVOKE ALL ON FUNCTION private.challenge_processing_restricted(uuid),private.challenge_training_rpc_v1(boolean,text,jsonb),private.challenge_training_rpc(boolean,text,jsonb),private.challenge_privacy_fingerprint_v2(uuid),private.challenge_privacy_fingerprint(uuid),private.challenge_privacy_rpc_v2(text,jsonb),private.challenge_privacy_rpc(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.challenge_training_rpc(boolean,text,jsonb),private.challenge_privacy_rpc(text,jsonb) TO authenticated;
ALTER FUNCTION private.challenge_privacy_overview(uuid) RENAME TO challenge_privacy_overview_v2;
CREATE FUNCTION private.challenge_privacy_overview(p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
SELECT jsonb_set(private.challenge_privacy_overview_v2(p_user),'{counts}',(private.challenge_privacy_overview_v2(p_user)->'counts')||jsonb_build_object(
 'processing_restrictions',(SELECT count(*) FROM private.challenge_processing_restrictions WHERE user_id=p_user),
 'restriction_author_references',(SELECT count(*) FROM private.challenge_processing_restrictions WHERE updated_by=p_user AND user_id<>p_user)))||jsonb_build_object('processing_restricted',private.challenge_processing_restricted(p_user))
$$;
REVOKE ALL ON FUNCTION private.challenge_privacy_overview_v2(uuid),private.challenge_privacy_overview(uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
