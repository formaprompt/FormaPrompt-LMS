BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(11);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
) VALUES
  ('51000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'positioning.active@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('51000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'positioning.suspended@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('51000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'positioning.revoked@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('51000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'positioning.refunded@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('51000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'positioning.expired@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('51000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'positioning.past@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('51000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'positioning.other@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('51000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'positioning.purchase-only@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now());

INSERT INTO public.profiles (id, email, role) VALUES
  ('51000000-0000-0000-0000-000000000001', 'positioning.active@example.test', 'user'),
  ('51000000-0000-0000-0000-000000000002', 'positioning.suspended@example.test', 'user'),
  ('51000000-0000-0000-0000-000000000003', 'positioning.revoked@example.test', 'user'),
  ('51000000-0000-0000-0000-000000000004', 'positioning.refunded@example.test', 'user'),
  ('51000000-0000-0000-0000-000000000005', 'positioning.expired@example.test', 'user'),
  ('51000000-0000-0000-0000-000000000006', 'positioning.past@example.test', 'user'),
  ('51000000-0000-0000-0000-000000000007', 'positioning.other@example.test', 'user'),
  ('51000000-0000-0000-0000-000000000008', 'positioning.purchase-only@example.test', 'user')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role;

INSERT INTO public.course_access (
  id, user_id, course_id, status, access_source, granted_at, expires_at
) VALUES
  ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'formation-prompt-level-1', 'active', 'admin', now(), now() + interval '30 days'),
  ('52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000002', 'formation-prompt-level-1', 'suspended', 'admin', now(), NULL),
  ('52000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000003', 'formation-prompt-level-1', 'revoked', 'admin', now(), NULL),
  ('52000000-0000-0000-0000-000000000004', '51000000-0000-0000-0000-000000000004', 'formation-prompt-level-1', 'refunded', 'admin', now(), NULL),
  ('52000000-0000-0000-0000-000000000005', '51000000-0000-0000-0000-000000000005', 'formation-prompt-level-1', 'expired', 'admin', now(), NULL),
  ('52000000-0000-0000-0000-000000000006', '51000000-0000-0000-0000-000000000006', 'formation-prompt-level-1', 'active', 'admin', '2019-01-01T00:00:00Z', '2020-01-01T00:00:00Z'),
  ('52000000-0000-0000-0000-000000000007', '51000000-0000-0000-0000-000000000007', 'formation-prompt-level-1', 'active', 'admin', now(), NULL);

-- Une preuve commerciale seule ne crée aucun droit pédagogique.
INSERT INTO public.purchases (
  id, user_id, course_id, payment_status, purchased_at
) VALUES (
  '53000000-0000-0000-0000-000000000008',
  '51000000-0000-0000-0000-000000000008',
  'formation-prompt-level-1', 'paid', now()
);

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
SELECT lives_ok(
  $$INSERT INTO public.course_positioning_assessments
    (user_id, learner_name, course_id, course_title, answers, score, maximum_score, level, is_initial)
    VALUES ('51000000-0000-0000-0000-000000000001', 'Apprenant Actif', 'formation-prompt-level-1', 'Prompt Engineering', '[]', 0, 1, 'Initial', true)$$,
  '1 - active avec echeance future autorise l INSERT direct'
);

SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000002', true);
SELECT throws_ok(
  $$INSERT INTO public.course_positioning_assessments
    (user_id, learner_name, course_id, course_title, answers, score, maximum_score, level, is_initial)
    VALUES ('51000000-0000-0000-0000-000000000002', 'Apprenant Suspendu', 'formation-prompt-level-1', 'Prompt Engineering', '[]', 0, 1, 'Initial', true)$$,
  '42501', 'new row violates row-level security policy for table "course_positioning_assessments"',
  '2 - suspended refuse l INSERT'
);

SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000003', true);
SELECT throws_ok(
  $$INSERT INTO public.course_positioning_assessments
    (user_id, learner_name, course_id, course_title, answers, score, maximum_score, level, is_initial)
    VALUES ('51000000-0000-0000-0000-000000000003', 'Apprenant Revoque', 'formation-prompt-level-1', 'Prompt Engineering', '[]', 0, 1, 'Initial', true)$$,
  '42501', 'new row violates row-level security policy for table "course_positioning_assessments"',
  '3 - revoked avec expires_at NULL refuse l INSERT'
);

SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000004', true);
SELECT throws_ok(
  $$INSERT INTO public.course_positioning_assessments
    (user_id, learner_name, course_id, course_title, answers, score, maximum_score, level, is_initial)
    VALUES ('51000000-0000-0000-0000-000000000004', 'Apprenant Rembourse', 'formation-prompt-level-1', 'Prompt Engineering', '[]', 0, 1, 'Initial', true)$$,
  '42501', 'new row violates row-level security policy for table "course_positioning_assessments"',
  '4 - refunded refuse l INSERT'
);

SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000005', true);
SELECT throws_ok(
  $$INSERT INTO public.course_positioning_assessments
    (user_id, learner_name, course_id, course_title, answers, score, maximum_score, level, is_initial)
    VALUES ('51000000-0000-0000-0000-000000000005', 'Apprenant Expire', 'formation-prompt-level-1', 'Prompt Engineering', '[]', 0, 1, 'Initial', true)$$,
  '42501', 'new row violates row-level security policy for table "course_positioning_assessments"',
  '5 - status expired refuse l INSERT'
);

SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000006', true);
SELECT throws_ok(
  $$INSERT INTO public.course_positioning_assessments
    (user_id, learner_name, course_id, course_title, answers, score, maximum_score, level, is_initial)
    VALUES ('51000000-0000-0000-0000-000000000006', 'Apprenant Echeance', 'formation-prompt-level-1', 'Prompt Engineering', '[]', 0, 1, 'Initial', true)$$,
  '42501', 'new row violates row-level security policy for table "course_positioning_assessments"',
  '6 - echeance depassee refuse l INSERT'
);

SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000007', true);
SELECT lives_ok(
  $$INSERT INTO public.course_positioning_assessments
    (user_id, learner_name, course_id, course_title, answers, score, maximum_score, level, is_initial)
    VALUES ('51000000-0000-0000-0000-000000000007', 'Autre Apprenant', 'formation-prompt-level-1', 'Prompt Engineering', '[]', 0, 1, 'Initial', true)$$,
  '7 - active avec expires_at NULL autorise l INSERT direct'
);

SELECT throws_ok(
  $$INSERT INTO public.course_positioning_assessments
    (user_id, learner_name, course_id, course_title, answers, score, maximum_score, level, is_initial)
    VALUES ('51000000-0000-0000-0000-000000000001', 'Usurpation Identite', 'formation-prompt-level-1', 'Prompt Engineering', '[]', 0, 1, 'Initial', true)$$,
  '42501', 'new row violates row-level security policy for table "course_positioning_assessments"',
  '8 - tentative pour un autre user_id refusee'
);

SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000008', true);
SELECT throws_ok(
  $$INSERT INTO public.course_positioning_assessments
    (user_id, learner_name, course_id, course_title, answers, score, maximum_score, level, is_initial)
    VALUES ('51000000-0000-0000-0000-000000000008', 'Achat Seulement', 'formation-prompt-level-1', 'Prompt Engineering', '[]', 0, 1, 'Initial', true)$$,
  '42501', 'new row violates row-level security policy for table "course_positioning_assessments"',
  '9 - purchases sans course_access ne donne aucun droit pedagogique'
);

SELECT throws_ok(
  $$INSERT INTO public.course_positioning_assessments
    (user_id, learner_name, course_id, course_title, answers, score, maximum_score, level, is_initial)
    VALUES ('51000000-0000-0000-0000-000000000001', 'Contournement Direct', 'formation-prompt-level-1', 'Prompt Engineering', '[]', 0, 1, 'Initial', true)$$,
  '42501', 'new row violates row-level security policy for table "course_positioning_assessments"',
  '10 - appel Supabase direct pour un autre user_id refuse'
);

SELECT is(
  (SELECT count(*) FROM public.course_positioning_assessments
    WHERE user_id IN (
      '51000000-0000-0000-0000-000000000002',
      '51000000-0000-0000-0000-000000000003',
      '51000000-0000-0000-0000-000000000004',
      '51000000-0000-0000-0000-000000000005',
      '51000000-0000-0000-0000-000000000006',
      '51000000-0000-0000-0000-000000000008'
    ))::bigint,
  0::bigint,
  '11 - les appels directs refuses ne creent aucune preuve'
);

SELECT * FROM finish();
ROLLBACK;
