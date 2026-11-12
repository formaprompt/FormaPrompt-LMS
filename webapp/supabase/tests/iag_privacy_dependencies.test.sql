BEGIN;

SELECT '1..9';

CREATE TEMP TABLE iag_privacy_people (kind text PRIMARY KEY, user_id uuid DEFAULT gen_random_uuid(), request_id uuid DEFAULT gen_random_uuid());
INSERT INTO iag_privacy_people (kind) VALUES ('admin'), ('draft'), ('identity'), ('certificate'), ('reviewer');
INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
SELECT user_id, 'authenticated', 'authenticated', kind || '-iag-privacy@example.test', '{}', '{}'
FROM iag_privacy_people;
INSERT INTO public.profiles (id, email, role)
SELECT user_id, kind || '-iag-privacy@example.test', CASE WHEN kind = 'admin' THEN 'admin' ELSE 'user' END
FROM iag_privacy_people ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.privacy_requests (id, subject_user_id, request_origin)
SELECT request_id, user_id, 'other' FROM iag_privacy_people WHERE kind <> 'admin';

INSERT INTO public.course_positioning_drafts (user_id, course_id, answers, revision)
SELECT user_id, 'formation-ia-generative-elearning', '[]', 1 FROM iag_privacy_people WHERE kind = 'draft';

INSERT INTO public.iag_certificate_identities
  (user_id, revision, first_name, last_name, source, declaration_version, declared_at)
SELECT user_id, 1, 'Camille', 'Exemple', 'self_declared', 'iag-identity-declaration-v1', now()
FROM iag_privacy_people WHERE kind IN ('identity', 'certificate');

INSERT INTO public.course_attestation_issuances (
  reference, user_id, course_id, document_type, issued_by, content_snapshot, issued_at, iag_content_version, iag_identity_id
)
SELECT 'FP-IAG-FIN-2026-' || upper(replace(i.id::text, '-', '')), i.user_id, i.course_id, 'iag_completion', i.user_id,
  jsonb_build_object('version', 'iag-1', 'learnerName', 'Camille Exemple', 'courseTitle', 'Formation IAG',
    'objectives', '["Analyser un résultat fictif"]'::jsonb, 'organization', '{}'::jsonb, 'completedAt', now(),
    'contentVersion', 'iag-v7-2026-10-21-with-explicit-v8-media', 'traceability',
    jsonb_build_object('userId', i.user_id, 'courseId', i.course_id, 'identityId', i.id,
      'lessons', (SELECT jsonb_agg(lesson) FROM generate_series(1, 22) AS lesson))),
  now(), 'iag-v7-2026-10-21-with-explicit-v8-media', i.id
FROM public.iag_certificate_identities i JOIN iag_privacy_people p USING (user_id) WHERE p.kind = 'certificate';

INSERT INTO private.iag_rubric_versions (version, source_sha256, rubric)
VALUES ('test-iag-privacy', repeat('0', 64), '{}');

WITH response AS (
  INSERT INTO public.course_exercise_responses (user_id, course_id, exercise_id, response_text, status, saved_at)
  SELECT user_id, 'formation-ia-generative-elearning', '1', 'Remise fictive', 'submitted', now()
  FROM iag_privacy_people WHERE kind = 'certificate' RETURNING id, user_id
)
INSERT INTO public.iag_submission_details
SELECT id, user_id, '1', 1, 'test-iag-privacy', '[]', '', '', now(), now() + interval '2 days' FROM response;

WITH review AS (
  INSERT INTO public.course_exercise_reviews (response_id, reviewer_id, feedback_text, review_status, created_at)
  SELECT d.response_id, p.user_id, 'Retour fictif', 'validated', now()
  FROM public.iag_submission_details d CROSS JOIN iag_privacy_people p
  WHERE p.kind = 'reviewer' AND d.user_id = (SELECT user_id FROM iag_privacy_people WHERE kind = 'certificate')
  RETURNING id, response_id
)
INSERT INTO public.iag_review_details
SELECT id, response_id, 'test-iag-privacy', '{}', '{}', 20, 20, '', '' FROM review;

INSERT INTO public.iag_assessment_events (response_id, review_id, actor_id, event_type)
SELECT d.response_id, d.review_id, p.user_id, 'initial_review_sent'
FROM public.iag_review_details d JOIN public.course_exercise_reviews r ON r.id = d.review_id
JOIN iag_privacy_people p ON p.user_id = r.reviewer_id WHERE p.kind = 'reviewer';

WITH intent AS (
  INSERT INTO public.commercial_checkout_intents (user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id)
  SELECT user_id, 'formation-ia-generative-elearning', 'B2C_STANDARD', 'personal', 'immediate', 'immediate_after_payment',
    (SELECT id FROM public.legal_document_versions WHERE document_type = 'cgv_b2c' AND status = 'published')
  FROM iag_privacy_people WHERE kind = 'certificate' RETURNING id
)
INSERT INTO private.iag_stripe_attempts (checkout_intent_id, state) SELECT id, 'ready' FROM intent;

DO $$
DECLARE admin_id uuid := (SELECT user_id FROM iag_privacy_people WHERE kind = 'admin');
BEGIN
  PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
END;
$$;
GRANT SELECT ON iag_privacy_people TO authenticated;

CREATE TEMP TABLE iag_privacy_results (id integer PRIMARY KEY, passed boolean, description text);
GRANT INSERT ON iag_privacy_results TO authenticated;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  draft_request uuid := (SELECT request_id FROM iag_privacy_people WHERE kind = 'draft');
  full_request uuid := (SELECT request_id FROM iag_privacy_people WHERE kind = 'certificate');
  ref text;
  analysis jsonb;
  action record;
  blocked boolean;
BEGIN
  SELECT 'EFFACER ' || subject_reference INTO ref FROM public.privacy_requests WHERE id = full_request;
  blocked := false;
  BEGIN
    PERFORM public.admin_execute_privacy_request(full_request, ref, 'Motif fictif de test uniquement');
  EXCEPTION WHEN OTHERS THEN blocked := SQLSTATE = '55000';
  END;
  INSERT INTO iag_privacy_results VALUES (1, blocked, 'Un dossier sans inventaire IAG est bloqué');

  analysis := public.admin_analyze_privacy_request(draft_request);
  INSERT INTO iag_privacy_results SELECT 2, (analysis->>'iag_dependency_count')::integer = 1 AND EXISTS (
    SELECT 1 FROM public.privacy_dependency_assessments WHERE analysis_run_id = (analysis->>'analysis_run_id')::uuid
      AND category = 'iag_positioning_drafts' AND record_count = 1
  ), 'Un brouillon seul est inventorié';

  analysis := public.admin_analyze_privacy_request((SELECT request_id FROM iag_privacy_people WHERE kind = 'identity'));
  INSERT INTO iag_privacy_results SELECT 3, (analysis->>'iag_dependency_count')::integer = 1 AND EXISTS (
    SELECT 1 FROM public.privacy_dependency_assessments WHERE analysis_run_id = (analysis->>'analysis_run_id')::uuid
      AND category = 'iag_certificate_identities' AND record_count = 1
  ), 'Une identité seule est inventoriée';

  analysis := public.admin_analyze_privacy_request((SELECT request_id FROM iag_privacy_people WHERE kind = 'reviewer'));
  INSERT INTO iag_privacy_results VALUES (4, (analysis->>'iag_dependency_count')::integer = 2,
    'La correction et son événement sont retrouvés par leur auteur');

  analysis := public.admin_analyze_privacy_request(full_request);
  INSERT INTO iag_privacy_results SELECT 5, (analysis->>'iag_dependency_count')::integer = 5 AND EXISTS (
    SELECT 1 FROM public.privacy_dependency_assessments WHERE analysis_run_id = (analysis->>'analysis_run_id')::uuid
      AND category = 'attestations' AND record_count = 1
  ), 'Les compléments du dossier et le certificat sont recensés';

  blocked := false;
  BEGIN
    PERFORM public.admin_execute_privacy_request(full_request, ref, 'Motif fictif de test uniquement');
  EXCEPTION WHEN OTHERS THEN blocked := SQLSTATE = '55000';
  END;
  INSERT INTO iag_privacy_results VALUES (6, blocked, 'L’analyse seule ne permet pas l’exécution');

  FOR action IN
    SELECT p.id, a.category FROM public.privacy_processing_actions p
    JOIN public.privacy_dependency_assessments a ON a.id = p.assessment_id
    WHERE a.analysis_run_id = (analysis->>'analysis_run_id')::uuid
  LOOP
    PERFORM public.admin_set_privacy_action_decision(action.id,
      CASE WHEN action.category IN ('auth_identity', 'profile') THEN 'external_action' ELSE 'retain' END,
      'Motif fictif de test uniquement');
  END LOOP;

  PERFORM public.admin_review_privacy_request(full_request, 'under_review', 'verified',
    'full_erasure_possible', 'Motif fictif de test uniquement');
  blocked := false;
  BEGIN
    PERFORM public.admin_execute_privacy_request(full_request, ref, 'Motif fictif de test uniquement');
  EXCEPTION WHEN SQLSTATE '55000' THEN blocked := true;
  END;
  INSERT INTO iag_privacy_results VALUES (7, blocked, 'La conservation interdit de présenter le résultat comme complet');

  PERFORM public.admin_review_privacy_request(full_request, 'under_review', 'verified',
    'partial_erasure_or_anonymization_required', 'Motif fictif de test uniquement');
  analysis := public.admin_execute_privacy_request(
    p_request_id => full_request, p_confirmation => ref, p_reason => 'Motif fictif de test uniquement'
  );
  PERFORM public.admin_prepare_privacy_auth_action(full_request, ref);
  INSERT INTO iag_privacy_results VALUES (8, analysis->>'status' = 'external_action_required',
    'Les décisions motivées permettent de passer à la désactivation Auth');
END;
$$;
RESET ROLE;

UPDATE auth.users SET deleted_at = now()
WHERE id = (SELECT user_id FROM iag_privacy_people WHERE kind = 'certificate');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.admin_complete_privacy_auth_action(p.id, 'EFFACER ' || p.subject_reference, 'Motif fictif de test uniquement')
  FROM public.privacy_requests p JOIN iag_privacy_people f ON f.request_id = p.id WHERE f.kind = 'certificate';
END;
$$;
RESET ROLE;

INSERT INTO iag_privacy_results
SELECT 9, EXISTS (
  SELECT 1 FROM iag_privacy_people f JOIN public.profiles p ON p.id = f.user_id
  JOIN public.privacy_requests q ON q.id = f.request_id
  JOIN public.iag_certificate_identities i ON i.user_id = f.user_id
  JOIN public.course_attestation_issuances c ON c.iag_identity_id = i.id
  WHERE f.kind = 'certificate' AND q.status = 'closed' AND p.email LIKE 'anonymous+%@privacy.invalid'
    AND c.content_snapshot->'traceability'->>'identityId' = i.id::text
    AND c.content_snapshot->>'learnerName' = 'Camille Exemple'
), 'L’anonymisation préserve le certificat et sa référence d’identité immuable';

SELECT CASE WHEN passed THEN 'ok' ELSE 'not ok' END || ' ' || id || ' - ' || description
FROM iag_privacy_results ORDER BY id;

ROLLBACK;
