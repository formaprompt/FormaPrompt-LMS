BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(16);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
) VALUES
  ('11000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin.correctif@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('11000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'thierry227.correctif@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('11000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'thierry270363.correctif@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now());

INSERT INTO public.profiles (id, email, role) VALUES
  ('11000000-0000-0000-0000-000000000001', 'admin.correctif@example.test', 'admin'),
  ('11000000-0000-0000-0000-000000000002', 'thierry227.correctif@example.test', 'user'),
  ('11000000-0000-0000-0000-000000000003', 'thierry270363.correctif@example.test', 'user')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    role = EXCLUDED.role;

INSERT INTO public.course_access (id, user_id, course_id, status, access_source, expires_at) VALUES
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'formation-ia', 'active', 'admin', NULL),
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000003', 'formation-ia', 'active', 'admin', NULL);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);

SELECT is(
  (public.admin_change_course_access(
    '21000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000003',
    'formation-ia', 'revoke', 'Révocation ciblée du compte B', NULL, NULL
  ) ->> 'ok')::boolean,
  true,
  'Révoquer B réussit avec les trois identifiants concordants'
);

SELECT is((SELECT status FROM public.course_access WHERE id='21000000-0000-0000-0000-000000000002'), 'revoked', 'B est révoqué');
SELECT is((SELECT status FROM public.course_access WHERE id='21000000-0000-0000-0000-000000000001'), 'active', 'A reste inchangé');
SELECT is((SELECT count(*) FROM public.audit_log WHERE target_id='21000000-0000-0000-0000-000000000002' AND action_type='access_revoked')::bigint, 1::bigint, 'L historique B contient la révocation');
SELECT is((SELECT count(*) FROM public.audit_log WHERE target_id='21000000-0000-0000-0000-000000000001' AND action_type='access_revoked')::bigint, 0::bigint, 'L historique A ne contient aucun événement de B');

SELECT is(
  (public.admin_change_course_access(
    '21000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000003',
    'formation-ia', 'restore', 'Révocation effectuée par erreur sur le mauvais compte', NULL, NULL
  ) ->> 'ok')::boolean,
  true,
  'Restaurer B réussit avec un motif explicite'
);

SELECT is((SELECT status FROM public.course_access WHERE id='21000000-0000-0000-0000-000000000002'), 'active', 'B retrouve son accès');
SELECT is((SELECT count(*) FROM public.audit_log WHERE target_id='21000000-0000-0000-0000-000000000002' AND action_type='access_restored')::bigint, 1::bigint, 'L historique B contient la restauration');

SELECT is(
  (public.admin_change_course_access(
    '21000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    'formation-ia', 'revoke', 'Cible utilisateur volontairement incohérente', NULL, NULL
  ) ->> 'ok')::boolean,
  false,
  'Une incohérence access id et user id est refusée'
);
SELECT is((SELECT status FROM public.course_access WHERE id='21000000-0000-0000-0000-000000000002'), 'active', 'Le refus ne modifie pas B');
SELECT is((SELECT count(*) FROM public.audit_log WHERE target_id='21000000-0000-0000-0000-000000000002' AND action_type='course_access_target_mismatch')::bigint, 1::bigint, 'L anomalie de cible est journalisée');

SELECT is(
  (public.admin_change_course_access(
    '21000000-0000-0000-0000-000000000099',
    '11000000-0000-0000-0000-000000000003',
    'formation-ia', 'revoke', 'Identifiant de droit inexistant', NULL, NULL
  ) ->> 'ok')::boolean,
  false,
  'Un identifiant de droit absent est refusé'
);
SELECT is((SELECT count(*) FROM public.audit_log WHERE action_type='course_access_target_mismatch')::bigint, 2::bigint, 'Les deux anomalies de cible sont conservées');

SELECT is(
  (public.admin_change_course_access(
    '21000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000003',
    'formation-ia', 'suspend', 'Suspension temporaire du compte B', NULL, NULL
  ) ->> 'ok')::boolean,
  true,
  'La suspension active vers suspended reste disponible'
);
SELECT is(
  (public.admin_change_course_access(
    '21000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000003',
    'formation-ia', 'reactivate', 'Réactivation après suspension du compte B', NULL, NULL
  ) ->> 'ok')::boolean,
  true,
  'La réactivation suspended vers active reste disponible'
);
SELECT is((SELECT status FROM public.course_access WHERE id='21000000-0000-0000-0000-000000000002'), 'active', 'B termine actif après réactivation');

SELECT * FROM finish();
ROLLBACK;
