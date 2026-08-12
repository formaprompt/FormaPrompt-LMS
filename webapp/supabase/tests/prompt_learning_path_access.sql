BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(22);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
) VALUES
  ('31000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin.path@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('31000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'active.path@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('31000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'refunded.path@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('31000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'expired.path@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('31000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'past-expiry.path@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('31000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'other.path@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('31000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'wrong-mapping.path@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now());

INSERT INTO public.profiles (id, email, role) VALUES
  ('31000000-0000-0000-0000-000000000001', 'admin.path@example.test', 'admin'),
  ('31000000-0000-0000-0000-000000000002', 'active.path@example.test', 'user'),
  ('31000000-0000-0000-0000-000000000003', 'refunded.path@example.test', 'user'),
  ('31000000-0000-0000-0000-000000000004', 'expired.path@example.test', 'user'),
  ('31000000-0000-0000-0000-000000000005', 'past-expiry.path@example.test', 'user'),
  ('31000000-0000-0000-0000-000000000006', 'other.path@example.test', 'user'),
  ('31000000-0000-0000-0000-000000000007', 'wrong-mapping.path@example.test', 'user')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    role = EXCLUDED.role;

INSERT INTO public.course_access (
  id, user_id, course_id, status, access_source, granted_at, expires_at
) VALUES
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', 'formation-prompt-level-1', 'active', 'admin', now(), NULL),
  ('32000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000003', 'formation-prompt-level-1', 'refunded', 'admin', now(), NULL),
  ('32000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000004', 'formation-prompt-level-1', 'expired', 'admin', now(), NULL),
  ('32000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000005', 'formation-prompt-level-1', 'active', 'admin', '2019-01-01T00:00:00Z', '2020-01-01T00:00:00Z'),
  ('32000000-0000-0000-0000-000000000006', '31000000-0000-0000-0000-000000000006', 'formation-prompt-level-1', 'active', 'admin', now(), NULL),
  ('32000000-0000-0000-0000-000000000007', '31000000-0000-0000-0000-000000000007', 'introduction-prompt-engineering', 'active', 'admin', now(), NULL);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000002', true);

SELECT lives_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id, status, progress_percent)
    VALUES ('31000000-0000-0000-0000-000000000002', 'introduction-prompt-engineering', 'comprendre-un-prompt', 'in_progress', 20)$$,
  '1 - un accès commercial actif autorise la progression du parcours associé'
);

SELECT is(
  (SELECT count(*) FROM public.course_lesson_progress WHERE user_id = '31000000-0000-0000-0000-000000000002')::bigint,
  1::bigint,
  '2 - la progression initiale est enregistrée'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
SELECT lives_ok(
  $$SELECT public.admin_change_course_access(
    '32000000-0000-0000-0000-000000000002',
    '31000000-0000-0000-0000-000000000002', 'formation-prompt-level-1', 'suspend',
    'Suspension locale du parcours protégé', NULL, NULL
  )$$,
  '3 - la suspension administrative réussit'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000002', true);
SELECT throws_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id)
    VALUES ('31000000-0000-0000-0000-000000000002', 'introduction-prompt-engineering', 'donner-du-contexte')$$,
  '42501',
  'new row violates row-level security policy for table "course_lesson_progress"',
  '4 - suspended interdit toute nouvelle progression'
);

SELECT lives_ok(
  $$UPDATE public.course_lesson_progress SET progress_percent = 40
    WHERE user_id = '31000000-0000-0000-0000-000000000002'
      AND course_id = 'introduction-prompt-engineering'$$,
  '5 - la tentative UPDATE suspendue est traitée sans exposer la ligne à modifier'
);

SELECT is(
  (SELECT progress_percent FROM public.course_lesson_progress
    WHERE user_id = '31000000-0000-0000-0000-000000000002'
      AND course_id = 'introduction-prompt-engineering'),
  20::smallint,
  '6 - suspended laisse la progression historique strictement inchangée'
);

SELECT is(
  (SELECT count(*) FROM public.course_lesson_progress
    WHERE user_id = '31000000-0000-0000-0000-000000000002'
      AND lesson_id = 'comprendre-un-prompt')::bigint,
  1::bigint,
  '7 - la progression historique reste lisible et conservée pendant la suspension'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
SELECT lives_ok(
  $$SELECT public.admin_change_course_access(
    '32000000-0000-0000-0000-000000000002',
    '31000000-0000-0000-0000-000000000002', 'formation-prompt-level-1', 'reactivate',
    'Réactivation locale du parcours protégé', NULL, NULL
  )$$,
  '8 - suspended vers active rétablit le droit existant'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000002', true);
SELECT lives_ok(
  $$UPDATE public.course_lesson_progress SET progress_percent = 40
    WHERE user_id = '31000000-0000-0000-0000-000000000002'
      AND course_id = 'introduction-prompt-engineering'$$,
  '9 - la progression reprend après réactivation'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
SELECT lives_ok(
  $$SELECT public.admin_change_course_access(
    '32000000-0000-0000-0000-000000000002',
    '31000000-0000-0000-0000-000000000002', 'formation-prompt-level-1', 'revoke',
    'Révocation locale du parcours protégé', NULL, NULL
  )$$,
  '10 - active vers revoked réussit'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000002', true);
SELECT throws_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id)
    VALUES ('31000000-0000-0000-0000-000000000002', 'introduction-prompt-engineering', 'definir-un-role')$$,
  '42501',
  'new row violates row-level security policy for table "course_lesson_progress"',
  '11 - expires_at NULL avec revoked reste refusé'
);

SELECT lives_ok(
  $$UPDATE public.course_lesson_progress SET progress_percent = 60
    WHERE user_id = '31000000-0000-0000-0000-000000000002'
      AND course_id = 'introduction-prompt-engineering'$$,
  '12 - la tentative UPDATE révoquée est traitée sans exposer la ligne à modifier'
);

SELECT is(
  (SELECT progress_percent FROM public.course_lesson_progress
    WHERE user_id = '31000000-0000-0000-0000-000000000002'
      AND course_id = 'introduction-prompt-engineering'),
  40::smallint,
  '13 - revoked laisse la progression historique strictement inchangée'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
SELECT lives_ok(
  $$SELECT public.admin_change_course_access(
    '32000000-0000-0000-0000-000000000002',
    '31000000-0000-0000-0000-000000000002', 'formation-prompt-level-1', 'restore',
    'Restauration locale du parcours protégé', NULL, NULL
  )$$,
  '14 - revoked vers active restaure explicitement le droit existant'
);

SELECT is(
  (SELECT count(*) FROM public.course_access
    WHERE user_id = '31000000-0000-0000-0000-000000000002'
      AND course_id = 'formation-prompt-level-1')::bigint,
  1::bigint,
  '15 - les transitions ne créent aucun droit parallèle'
);

SELECT is(
  (SELECT count(*) FROM public.audit_log
    WHERE target_id = '32000000-0000-0000-0000-000000000002'
      AND action_type = 'access_restored')::bigint,
  1::bigint,
  '16 - la restauration est conservée dans audit_log'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000002', true);
SELECT lives_ok(
  $$UPDATE public.course_lesson_progress SET progress_percent = 80
    WHERE user_id = '31000000-0000-0000-0000-000000000002'
      AND course_id = 'introduction-prompt-engineering'$$,
  '17 - la progression historique redevient modifiable après restauration'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000003', true);
SELECT throws_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id)
    VALUES ('31000000-0000-0000-0000-000000000003', 'introduction-prompt-engineering', 'refunded')$$,
  '42501', 'new row violates row-level security policy for table "course_lesson_progress"',
  '18 - refunded est refusé côté RLS'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000004', true);
SELECT throws_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id)
    VALUES ('31000000-0000-0000-0000-000000000004', 'introduction-prompt-engineering', 'expired-status')$$,
  '42501', 'new row violates row-level security policy for table "course_lesson_progress"',
  '19 - expired est refusé côté RLS'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000005', true);
SELECT throws_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id)
    VALUES ('31000000-0000-0000-0000-000000000005', 'introduction-prompt-engineering', 'past-expiry')$$,
  '42501', 'new row violates row-level security policy for table "course_lesson_progress"',
  '20 - un accès active arrivé à échéance est refusé'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000006', true);
SELECT throws_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id)
    VALUES ('31000000-0000-0000-0000-000000000002', 'introduction-prompt-engineering', 'other-user')$$,
  '42501', 'new row violates row-level security policy for table "course_lesson_progress"',
  '21 - un autre apprenant ne peut pas contourner identité et RLS'
);

SELECT set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000007', true);
SELECT throws_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id)
    VALUES ('31000000-0000-0000-0000-000000000007', 'introduction-prompt-engineering', 'wrong-mapping')$$,
  '42501', 'new row violates row-level security policy for table "course_lesson_progress"',
  '22 - un droit portant seulement le slug pédagogique ne remplace pas le droit commercial attendu'
);

SELECT * FROM finish();
ROLLBACK;
