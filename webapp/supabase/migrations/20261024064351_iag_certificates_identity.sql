-- PROPOSE SEULEMENT. Non execute, hors migrations. Revue PostgreSQL obligatoire.
-- Prerequis : registre historique + guard_attestation_objectives, drafts IAG 01/02
-- effectivement valides, et contrat C3 private.iag_completed_at(uuid,text).
-- Cette fonction C3 doit lire les 22 IDs canoniques, dates serveur et version exacte.
-- Les ecritures C3 doivent verrouiller la meme ligne course_access avant progression.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('private.iag_completed_at(uuid,text)') IS NULL THEN
   RAISE EXCEPTION 'Prerequis C3 absent : aucune emission possible';
 END IF;
 IF to_regclass('public.iag_submission_details') IS NULL
 OR to_regclass('private.iag_rubric_versions') IS NULL THEN
   RAISE EXCEPTION 'Prerequis evaluation V7 absent';
 END IF;
END $$;

-- Authenticated self-declaration, NOT official identity verification.
CREATE TABLE public.iag_certificate_identities (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 course_id text NOT NULL DEFAULT 'formation-ia-generative-elearning'
   CHECK(course_id='formation-ia-generative-elearning'),
 revision integer NOT NULL CHECK(revision>0),
 first_name text NOT NULL CHECK(char_length(first_name) BETWEEN 1 AND 100),
 last_name text NOT NULL CHECK(char_length(last_name) BETWEEN 1 AND 100),
 source text NOT NULL CHECK(source='self_declared'),
 declaration_version text NOT NULL CHECK(declaration_version='iag-identity-declaration-v1'),
 declared_at timestamptz NOT NULL,
 UNIQUE(user_id,course_id,revision),
 CHECK(char_length(first_name||' '||last_name) BETWEEN 3 AND 200)
);
ALTER TABLE public.iag_certificate_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iag_certificate_identities FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.iag_certificate_identities FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.iag_certificate_identities TO authenticated;
CREATE POLICY iag_identity_owner_read ON public.iag_certificate_identities
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE TRIGGER iag_certificate_identity_immutable BEFORE UPDATE OR DELETE
 ON public.iag_certificate_identities FOR EACH ROW EXECUTE FUNCTION private.iag_immutable();

CREATE FUNCTION private.iag_certificate_identity_json(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',d.id,'userId',d.user_id,'courseId',d.course_id,
 'revision',d.revision,'firstName',d.first_name,'lastName',d.last_name,
 'source',d.source,'declarationVersion',d.declaration_version,'declaredAt',d.declared_at,
 'locked',EXISTS(SELECT 1 FROM public.course_attestation_issuances i
 WHERE i.user_id=d.user_id AND i.course_id=d.course_id
 AND i.document_type IN ('iag_completion','iag_success')))
 FROM public.iag_certificate_identities d WHERE d.user_id=p_user
 AND d.course_id='formation-ia-generative-elearning' ORDER BY d.revision DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.iag_certificate_identity_json(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.iag_certificate_identity() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 RETURN private.iag_certificate_identity_json(auth.uid());
END $$;
REVOKE ALL ON FUNCTION private.iag_certificate_identity() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.iag_certificate_identity() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.iag_certificate_identity(); $$;
REVOKE ALL ON FUNCTION public.iag_certificate_identity() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iag_certificate_identity(),private.iag_certificate_identity() TO authenticated;

CREATE FUNCTION private.iag_declare_certificate_identity(p_first_name text,p_last_name text,p_expected_identity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); previous public.iag_certificate_identities%ROWTYPE;
 first_name text; last_name text; next_revision integer;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.course_access WHERE user_id=actor
 AND course_id='formation-ia-generative-elearning' FOR UPDATE;
 IF NOT coalesce(private.iag_owner_active(actor),false) OR NOT private.iag_has_positioning(actor) THEN
   RAISE EXCEPTION 'Active owner access and questionnaire required' USING ERRCODE='42501'; END IF;
 IF p_first_name ~ '[[:cntrl:]]' OR p_last_name ~ '[[:cntrl:]]' THEN
   RAISE EXCEPTION 'IAG_IDENTITY_INVALID' USING ERRCODE='22023'; END IF;
 first_name:=regexp_replace(private.iag_trim(p_first_name),'[[:space:]]+',' ','g');
 last_name:=regexp_replace(private.iag_trim(p_last_name),'[[:space:]]+',' ','g');
 IF first_name IS NULL OR last_name IS NULL OR char_length(first_name) NOT BETWEEN 1 AND 100
 OR char_length(last_name) NOT BETWEEN 1 AND 100 OR char_length(first_name||' '||last_name) NOT BETWEEN 3 AND 200
 OR (first_name||last_name) ~ '[@[:cntrl:]]' OR (first_name||last_name) LIKE '%://%'
 OR lower(first_name) IN ('apprenant','inconnu') OR lower(last_name) IN ('apprenant','inconnu') THEN
   RAISE EXCEPTION 'IAG_IDENTITY_INVALID' USING ERRCODE='22023'; END IF;
 -- Same order as issuer: entitlement first, account certificate lock second.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':iag:certificate',0));
 SELECT * INTO previous FROM public.iag_certificate_identities
 WHERE user_id=actor AND course_id='formation-ia-generative-elearning' ORDER BY revision DESC LIMIT 1;
 -- Safe replay after response loss, before optimistic comparison.
 IF FOUND AND previous.first_name=first_name AND previous.last_name=last_name THEN
   RETURN private.iag_certificate_identity_json(actor); END IF;
 IF EXISTS(SELECT 1 FROM public.course_attestation_issuances i WHERE i.user_id=actor
 AND i.course_id='formation-ia-generative-elearning' AND i.document_type IN ('iag_completion','iag_success')) THEN
   RAISE EXCEPTION 'IAG_IDENTITY_FROZEN' USING ERRCODE='P0001'; END IF;
 IF previous.id IS DISTINCT FROM p_expected_identity_id THEN
   RAISE EXCEPTION 'IAG_IDENTITY_CONFLICT' USING ERRCODE='P0001'; END IF;
 next_revision:=coalesce(previous.revision,0)+1;
 INSERT INTO public.iag_certificate_identities(user_id,course_id,revision,first_name,last_name,source,declaration_version,declared_at)
 VALUES(actor,'formation-ia-generative-elearning',next_revision,first_name,last_name,'self_declared','iag-identity-declaration-v1',clock_timestamp());
 RETURN private.iag_certificate_identity_json(actor);
END $$;
REVOKE ALL ON FUNCTION private.iag_declare_certificate_identity(text,text,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.iag_declare_certificate_identity(p_first_name text,p_last_name text,p_expected_identity_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.iag_declare_certificate_identity(p_first_name,p_last_name,p_expected_identity_id);
$$;
REVOKE ALL ON FUNCTION public.iag_declare_certificate_identity(text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iag_declare_certificate_identity(text,text,uuid),
 private.iag_declare_certificate_identity(text,text,uuid) TO authenticated;

ALTER TABLE public.course_attestation_issuances
 ALTER COLUMN submission_id DROP NOT NULL,
 ALTER COLUMN booking_request_id DROP NOT NULL,
 ADD COLUMN iag_content_version text,
 ADD COLUMN iag_identity_id uuid REFERENCES public.iag_certificate_identities(id) ON DELETE RESTRICT,
 ADD COLUMN iag_initial_issuance_id bigint REFERENCES public.course_attestation_issuances(id) ON DELETE RESTRICT;

-- Conserver EXACTEMENT chaque expression historique : seuls les deux nouveaux
-- types passent par une branche additionnelle, controlee plus bas. Aucun NOT VALID.
DO $$
DECLARE c record;
BEGIN
 FOR c IN SELECT conname, pg_get_expr(conbin, conrelid) AS expression
 FROM pg_constraint WHERE conrelid='public.course_attestation_issuances'::regclass
 AND conname IN ('course_attestation_issuances_reference_check',
 'course_attestation_issuances_document_type_check',
 'course_attestation_issuances_type_source_check',
 'course_attestation_issuances_snapshot_check') LOOP
   EXECUTE format('ALTER TABLE public.course_attestation_issuances DROP CONSTRAINT %I',c.conname);
   EXECUTE format('ALTER TABLE public.course_attestation_issuances ADD CONSTRAINT %I CHECK ((document_type IN (''iag_completion'',''iag_success'')) OR (%s))',c.conname,c.expression);
 END LOOP;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.course_attestation_issuances'::regclass
 AND conname IN ('course_attestation_issuances_reference_check',
 'course_attestation_issuances_document_type_check',
 'course_attestation_issuances_type_source_check',
 'course_attestation_issuances_snapshot_check')) <> 4 THEN
   RAISE EXCEPTION 'Contraintes historiques inattendues';
 END IF;
END $$;
ALTER TABLE public.course_attestation_issuances ADD CONSTRAINT iag_issuance_variant CHECK ((
 CASE WHEN document_type IN ('iag_completion','iag_success') THEN
   course_id='formation-ia-generative-elearning'
   AND submission_id IS NULL AND review_id IS NULL AND booking_request_id IS NULL
   AND iag_identity_id IS NOT NULL
   AND iag_content_version='iag-v7-2026-10-21-with-explicit-v8-media'
   AND reference ~ '^FP-IAG-(FIN|REUSSITE)-[0-9]{4}-[A-F0-9]{32}$'
   AND ((document_type='iag_completion' AND iag_initial_issuance_id IS NULL AND reference LIKE 'FP-IAG-FIN-%')
     OR (document_type='iag_success' AND iag_initial_issuance_id IS NOT NULL AND reference LIKE 'FP-IAG-REUSSITE-%'))
   AND jsonb_typeof(content_snapshot)='object'
   AND content_snapshot->>'version'='iag-1'
   AND content_snapshot ?& ARRAY['learnerName','courseTitle','objectives','organization','completedAt','contentVersion','traceability']
   AND content_snapshot->>'contentVersion'=iag_content_version
   AND char_length(btrim(content_snapshot->>'learnerName')) BETWEEN 3 AND 200
   AND char_length(btrim(content_snapshot->>'courseTitle')) BETWEEN 1 AND 250
   AND jsonb_typeof(content_snapshot->'organization')='object'
   AND jsonb_typeof(content_snapshot->'traceability')='object'
   AND content_snapshot->'traceability'->>'userId'=user_id::text
   AND content_snapshot->'traceability'->>'courseId'=course_id
   AND content_snapshot->'traceability'->>'identityId'=iag_identity_id::text
   AND jsonb_typeof(content_snapshot->'traceability'->'lessons')='array'
   AND jsonb_array_length(content_snapshot->'traceability'->'lessons')=22
   AND NOT (content_snapshot ?| ARRAY['attendedMinutes','plannedMinutes','attendanceIds','email'])
   AND octet_length(content_snapshot::text)<=65536
 ELSE submission_id IS NOT NULL AND booking_request_id IS NOT NULL
   AND iag_content_version IS NULL AND iag_initial_issuance_id IS NULL AND iag_identity_id IS NULL
 END) IS TRUE);
CREATE UNIQUE INDEX iag_issuance_durable_key ON public.course_attestation_issuances
 (user_id,course_id,iag_content_version,document_type)
 WHERE document_type IN ('iag_completion','iag_success');

-- Existing owner/admin SELECT policy remains intact, including archival reading.
-- Existing INSERT grants/policy cannot be used to forge either new variant.
CREATE POLICY iag_issuance_rpc_only ON public.course_attestation_issuances
 AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (document_type NOT IN ('iag_completion','iag_success'));
CREATE FUNCTION private.iag_guard_issuance() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN
   IF TG_OP='UPDATE' THEN
     IF NEW.document_type IN ('iag_completion','iag_success') THEN
       RAISE EXCEPTION 'Transformation en certificat IAG interdite';
     END IF;
   END IF;
   IF OLD.document_type IN ('iag_completion','iag_success') THEN
     RAISE EXCEPTION 'Certificat IAG immuable';
   END IF;
   RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 END IF;
 IF NEW.document_type IN ('iag_completion','iag_success') AND NOT EXISTS (
 SELECT 1 FROM public.iag_certificate_identities e
 WHERE e.id=NEW.iag_identity_id AND e.user_id=NEW.user_id
 AND e.course_id=NEW.course_id AND e.source='self_declared'
 AND e.declaration_version='iag-identity-declaration-v1') THEN
   RAISE EXCEPTION 'Identite nominale d''un autre compte';
 END IF;
 IF NEW.document_type='iag_success' AND NOT EXISTS (
 SELECT 1 FROM public.course_attestation_issuances b
 WHERE b.id=NEW.iag_initial_issuance_id AND b.user_id=NEW.user_id
 AND b.course_id=NEW.course_id AND b.iag_content_version=NEW.iag_content_version
 AND b.document_type='iag_completion' AND b.issued_at<=NEW.issued_at
 AND b.iag_identity_id=NEW.iag_identity_id
 AND NEW.content_snapshot->>'initialReference'=b.reference) THEN
   RAISE EXCEPTION 'Certificat initial incompatible';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER iag_issuance_immutable BEFORE UPDATE OR DELETE
 ON public.course_attestation_issuances FOR EACH ROW EXECUTE FUNCTION private.iag_guard_issuance();
CREATE TRIGGER iag_issuance_link BEFORE INSERT
 ON public.course_attestation_issuances FOR EACH ROW EXECUTE FUNCTION private.iag_guard_issuance();
REVOKE ALL ON FUNCTION private.iag_guard_issuance() FROM PUBLIC,anon,authenticated;

-- Source de la decision : tables immuables du draft02, jamais JSON du navigateur.
-- E1 du travail3, dans la grille source exacte, signifie humainement : DEUX
-- assistants reellement essayes. Les deux noms seuls ne sont jamais suffisants.
CREATE FUNCTION private.iag_success_sources(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE work text; s record; r record; rubric jsonb; result jsonb:='[]'; essential jsonb;
BEGIN
 SELECT v.rubric INTO rubric FROM private.iag_rubric_versions v
 WHERE v.version='v7-2026-10-21'
 AND v.source_sha256='94efa99040b792ea903075801265b31b390ff84950b926cda98c658e0877b353';
 IF rubric IS NULL THEN RETURN NULL; END IF;
 FOREACH work IN ARRAY ARRAY['1','2','3'] LOOP
   SELECT d.*, b.user_id AS response_user_id,b.course_id, b.status, b.exercise_id INTO s
   FROM public.iag_submission_details d JOIN public.course_exercise_responses b ON b.id=d.response_id
   WHERE d.user_id=p_user AND d.work_id=work
   ORDER BY d.ordinal DESC LIMIT 1;
   IF NOT FOUND THEN RETURN NULL; END IF;
   IF s.response_user_id<>p_user OR s.course_id<>'formation-ia-generative-elearning' OR s.status<>'submitted'
   OR s.exercise_id<>work OR s.rubric_version<>'v7-2026-10-21' THEN RETURN NULL; END IF;
   IF (SELECT count(*) FROM public.iag_submission_details WHERE user_id=p_user AND work_id=work)<>s.ordinal
   THEN RETURN NULL; END IF;
   SELECT d.*, b.reviewer_id,b.created_at,b.review_status INTO r
   FROM public.iag_review_details d JOIN public.course_exercise_reviews b ON b.id=d.review_id
   WHERE d.response_id=s.response_id AND b.response_id=s.response_id;
   IF NOT FOUND THEN RETURN NULL; END IF;
   IF r.rubric_version<>s.rubric_version OR r.review_status<>'validated'
   OR r.created_at<s.received_at OR length(private.iag_trim(r.real_trials_evidence))=0
   OR NOT EXISTS (SELECT 1 FROM public.iag_assessment_events e WHERE e.review_id=r.review_id
     AND e.response_id=s.response_id AND e.actor_id=r.reviewer_id
     AND e.occurred_at=r.created_at
     AND e.event_type=CASE s.ordinal WHEN 1 THEN 'initial_review_sent' ELSE 'targeted_review_sent' END)
   THEN RETURN NULL; END IF;
   IF jsonb_typeof(r.essentials) IS DISTINCT FROM 'object' THEN RETURN NULL; END IF;
   IF (SELECT count(*) FROM jsonb_object_keys(r.essentials))<>
      jsonb_array_length(rubric->'criteres_essentiels'->work) THEN RETURN NULL; END IF;
   FOR essential IN SELECT value FROM jsonb_array_elements(rubric->'criteres_essentiels'->work) LOOP
     IF (r.essentials->(essential->>0)->>'state') IS DISTINCT FROM 'attained'
     OR coalesce(length(private.iag_trim(r.essentials->(essential->>0)->>'evidence')),0)=0
     THEN RETURN NULL; END IF;
   END LOOP;
   IF work='3' AND (SELECT count(DISTINCT lower(private.iag_trim(value #>> '{}')))
     FROM jsonb_array_elements(s.assistants)
     WHERE jsonb_typeof(value)='string' AND length(private.iag_trim(value #>> '{}'))>0)<2 THEN RETURN NULL; END IF;
   result:=result||jsonb_build_array(jsonb_build_object('workId',work,'responseId',s.response_id,
     'reviewId',r.review_id,'reviewerId',r.reviewer_id,'returnedAt',r.created_at,
     'rubricVersion',r.rubric_version,'points',r.points,'denominator',20,
     'observed',r.observed,'complete',r.observed=20));
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.iag_success_sources(uuid) FROM PUBLIC,anon,authenticated;

-- Un parametre de variante seulement. Aucun userId, nom, note, date ou snapshot client.
CREATE FUNCTION private.iag_issue_certificate(p_type text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); existing_id bigint; initial_id bigint; initial_ref text;
 completed timestamptz; issued timestamptz; learner text; identity_id uuid; lessons jsonb; sources jsonb;
 snapshot jsonb; new_reference text; new_id bigint;
 version constant text:='iag-v7-2026-10-21-with-explicit-v8-media';
BEGIN
 IF actor IS NULL OR p_type IS NULL OR p_type NOT IN ('iag_completion','iag_success') THEN
   RAISE EXCEPTION 'Authentification et variante requises' USING ERRCODE='42501'; END IF;
 -- Same entitlement lock as submission and C3 writes; no entitlement mutation.
 PERFORM 1 FROM public.course_access WHERE user_id=actor
 AND course_id='formation-ia-generative-elearning' FOR UPDATE;
 IF NOT coalesce(private.iag_owner_active(actor),false) THEN
   RAISE EXCEPTION 'Acces proprietaire actif requis' USING ERRCODE='42501'; END IF;
 IF NOT private.iag_has_positioning(actor) THEN
   RAISE EXCEPTION 'Six reponses initiales V7 requises' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':iag:certificate',0));
 SELECT id INTO existing_id FROM public.course_attestation_issuances
 WHERE user_id=actor AND course_id='formation-ia-generative-elearning'
 AND iag_content_version=version AND document_type=p_type;
 -- Durable replay after lost response: return frozen issuance, even if a newer
 -- submission appeared afterwards. It remains an AS-OF document, not current status.
 IF FOUND THEN RETURN existing_id; END IF;
 -- Only an authenticated self declaration of this exact account/course.
 SELECT d.id,d.first_name||' '||d.last_name INTO identity_id,learner
 FROM public.iag_certificate_identities d
 WHERE d.user_id=actor AND d.course_id='formation-ia-generative-elearning'
 AND d.source='self_declared' AND d.declaration_version='iag-identity-declaration-v1'
 ORDER BY d.revision DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'IAG_IDENTITY_REQUIRED' USING ERRCODE='P0001'; END IF;
 completed:=private.iag_completed_at(actor,version);
 IF completed IS NULL THEN RAISE EXCEPTION '22 lecons canoniques non terminees'; END IF;
 SELECT jsonb_agg(jsonb_build_object('lessonId',lesson_id,'completedAt',completed_at) ORDER BY lesson_id)
 INTO lessons FROM public.course_lesson_progress WHERE user_id=actor
 AND course_id='formation-ia-generative-elearning' AND content_version=version;
 IF p_type='iag_success' THEN
   -- Same locks as the draft02 submit/review path, in stable work order.
   PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':iag:1',0));
   PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':iag:2',0));
   PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':iag:3',0));
   sources:=private.iag_success_sources(actor);
   IF sources IS NULL THEN RAISE EXCEPTION 'Trois validations humaines V7 et essais reels requis'; END IF;
   -- Atomic first completion + later/additional mention; no rewrite of initial.
   initial_id:=private.iag_issue_certificate('iag_completion');
   SELECT reference INTO initial_ref FROM public.course_attestation_issuances WHERE id=initial_id;
 ELSE sources:='[]'::jsonb; END IF;
 issued:=clock_timestamp();
 new_reference:='FP-IAG-'||CASE p_type WHEN 'iag_completion' THEN 'FIN' ELSE 'REUSSITE' END
   ||'-'||to_char(issued AT TIME ZONE 'UTC','YYYY')||'-'||upper(replace(pg_catalog.gen_random_uuid()::text,'-',''));
 snapshot:=jsonb_build_object('version','iag-1','learnerName',private.iag_trim(learner),
   'courseTitle','IA générative - apprendre, essayer et vérifier à votre rythme',
   'contentVersion',version,'completedAt',completed,
   'objectives',jsonb_build_array('Préparer un courriel professionnel.',
     'Rechercher, lire et vérifier un document.','Organiser des tâches avec l''IA et contrôler les résultats.'),
   'organization',jsonb_build_object('brandName','FormaPrompt','legalName','Thierry FREZARD EI'),
   'initialReference',initial_ref,
   'traceability',jsonb_build_object('userId',actor,'courseId','formation-ia-generative-elearning',
     'contentVersion',version,'lessons',lessons,'rubricVersion','v7-2026-10-21',
     'identityId',identity_id,'identitySource','self_declared','identityDeclarationVersion','iag-identity-declaration-v1',
     'rubricSha256','94efa99040b792ea903075801265b31b390ff84950b926cda98c658e0877b353',
     'workSources',sources));
 INSERT INTO public.course_attestation_issuances(reference,user_id,course_id,document_type,
 submission_id,review_id,booking_request_id,issued_by,content_snapshot,issued_at,
 iag_content_version,iag_initial_issuance_id,iag_identity_id)
 VALUES(new_reference,actor,'formation-ia-generative-elearning',p_type,NULL,NULL,NULL,actor,snapshot,issued,version,initial_id,identity_id)
 RETURNING id INTO new_id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION private.iag_issue_certificate(text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.iag_issue_certificate(p_type text) RETURNS text
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.iag_issue_certificate(p_type)::text;
$$;
REVOKE ALL ON FUNCTION public.iag_issue_certificate(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iag_issue_certificate(text),private.iag_issue_certificate(text) TO authenticated;
-- Do not change legacy SELECT/INSERT policies, grants, objective trigger or FKs.
-- FORCE RLS already enabled; definer owner must be the reviewed migration role.
-- Specific ID: existing owner/staff RLS. Default list: own documents only.
-- No new staff permission and no entitlement revival.
-- Text ids prevent loss of bigint precision in JSON/JavaScript.
CREATE FUNCTION public.iag_certificate_documents(p_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_id IS NOT NULL AND p_id !~ '^[1-9][0-9]{0,18}$' THEN
   RAISE EXCEPTION 'Invalid identifier' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id::text,'user_id',i.user_id,
 'course_id',i.course_id,'document_type',i.document_type,'reference',i.reference,
 'issued_at',i.issued_at,'content_snapshot',i.content_snapshot)
 ORDER BY i.issued_at,i.id),'[]'::jsonb) INTO result
 FROM public.course_attestation_issuances i WHERE i.course_id='formation-ia-generative-elearning'
 AND i.document_type IN ('iag_completion','iag_success')
 AND ((p_id IS NULL AND i.user_id=auth.uid()) OR (p_id IS NOT NULL AND i.id=p_id::bigint));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.iag_certificate_documents(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iag_certificate_documents(text) TO authenticated;

COMMIT;
