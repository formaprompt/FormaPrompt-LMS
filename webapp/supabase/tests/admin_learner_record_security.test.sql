BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(11);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at) VALUES
  ('71000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin.fiche@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('71000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'employee.fiche@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('71000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'camille.fiche@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('71000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'alex.fiche@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now());

INSERT INTO public.profiles (id, email, role) VALUES
  ('71000000-0000-4000-8000-000000000001', 'admin.fiche@example.test', 'admin'),
  ('71000000-0000-4000-8000-000000000002', 'employee.fiche@example.test', 'employee'),
  ('71000000-0000-4000-8000-000000000003', 'camille.fiche@example.test', 'user'),
  ('71000000-0000-4000-8000-000000000004', 'alex.fiche@example.test', 'user')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    role = EXCLUDED.role;

INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id, status, progress_percent, completed_at) VALUES
  ('71000000-0000-4000-8000-000000000003', 'formation-ia', 'fiche-lesson-camille', 'completed', 100, now()),
  ('71000000-0000-4000-8000-000000000004', 'formation-ia', 'fiche-lesson-alex', 'in_progress', 25, NULL);

SELECT ok(NOT has_function_privilege('public', 'public.admin_get_learner_record(uuid)', 'EXECUTE'), 'PUBLIC ne peut pas executer la RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.admin_get_learner_record(uuid)', 'EXECUTE'), 'anon ne peut pas executer la RPC');
SELECT ok(has_function_privilege('authenticated', 'public.admin_get_learner_record(uuid)', 'EXECUTE'), 'authenticated recoit EXECUTE, la garde interne tranche le role');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', true);
SELECT throws_ok($$SELECT public.admin_get_learner_record('71000000-0000-4000-8000-000000000003')$$, '42501', 'Acces strictement reserve a un administrateur.', 'un apprenant est refuse');

SELECT set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
SELECT throws_ok($$SELECT public.admin_get_learner_record('71000000-0000-4000-8000-000000000003')$$, '42501', 'Acces strictement reserve a un administrateur.', 'un employe est refuse');

SELECT set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
SELECT lives_ok($$SELECT public.admin_get_learner_record('71000000-0000-4000-8000-000000000003')$$, 'un admin strict lit la fiche');
SELECT is((public.admin_get_learner_record('71000000-0000-4000-8000-000000000003')->'identity'->>'userId'), '71000000-0000-4000-8000-000000000003', 'la fiche conserve le UUID cible');
SELECT is(jsonb_array_length(public.admin_get_learner_record('71000000-0000-4000-8000-000000000003')->'progress'), 1, 'la progression cible est retournee');
SELECT is((public.admin_get_learner_record('71000000-0000-4000-8000-000000000003')->'progress'->0->>'lessonId'), 'fiche-lesson-camille', 'aucune progression d un autre apprenant ne fuit');
SELECT throws_ok($$SELECT public.admin_get_learner_record(NULL)$$, '22004', 'Identifiant apprenant requis.', 'un UUID absent est refuse');
SELECT throws_ok($$SELECT public.admin_get_learner_record('71000000-0000-4000-8000-000000000099')$$, 'P0002', 'Compte introuvable.', 'un UUID inconnu est refuse');

SELECT * FROM finish();
ROLLBACK;
