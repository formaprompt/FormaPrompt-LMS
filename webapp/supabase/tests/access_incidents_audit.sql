BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(26);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
) VALUES
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin.sprint1@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'marie.sprint1@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'paul.sprint1@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'employee.sprint1@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now());

INSERT INTO public.profiles (id, email, role) VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin.sprint1@example.test', 'admin'),
  ('10000000-0000-0000-0000-000000000002', 'marie.sprint1@example.test', 'user'),
  ('10000000-0000-0000-0000-000000000003', 'paul.sprint1@example.test', 'user'),
  ('10000000-0000-0000-0000-000000000004', 'employee.sprint1@example.test', 'employee');

INSERT INTO public.course_access (
  id, user_id, course_id, status, access_source, expires_at
) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'formation-ia-act', 'active', 'admin', NULL),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'formation-ia-act', 'active', 'admin', NULL);

CREATE TEMP TABLE sprint1_test_context (
  incident_id uuid
) ON COMMIT DROP;
GRANT SELECT, INSERT ON sprint1_test_context TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

SELECT lives_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id)
    VALUES ('10000000-0000-0000-0000-000000000002', 'formation-ia-act', 'lesson-active')$$,
  'A - Marie accède avec un droit actif sans expiration'
);

SELECT is(
  (SELECT count(*) FROM public.course_access WHERE user_id = '10000000-0000-0000-0000-000000000002')::bigint,
  1::bigint,
  'Marie lit son propre droit'
);

SELECT is(
  (SELECT count(*) FROM public.course_access WHERE user_id = '10000000-0000-0000-0000-000000000003')::bigint,
  0::bigint,
  'E - Marie ne lit pas le droit d un autre apprenant'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT lives_ok(
  $$SELECT public.admin_change_course_access(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002', 'formation-ia-act', 'suspend',
    'Mesure temporaire testée côté serveur', NULL, NULL
  )$$,
  'B - un admin suspend le droit'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
SELECT throws_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id)
    VALUES ('10000000-0000-0000-0000-000000000002', 'formation-ia-act', 'lesson-suspended')$$,
  '42501',
  'new row violates row-level security policy for table "course_lesson_progress"',
  'J - expires_at NULL et status suspended refuse l accès au niveau RLS'
);

SELECT is(
  (SELECT count(*) FROM public.course_lesson_progress
    WHERE user_id = '10000000-0000-0000-0000-000000000002'
      AND lesson_id = 'lesson-active')::bigint,
  1::bigint,
  'B - la progression existante est conservée pendant la suspension'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT lives_ok(
  $$SELECT public.admin_change_course_access(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002', 'formation-ia-act', 'reactivate',
    'Réactivation explicite après vérification', NULL, NULL
  )$$,
  'C - un admin réactive le droit suspendu'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
SELECT lives_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id)
    VALUES ('10000000-0000-0000-0000-000000000002', 'formation-ia-act', 'lesson-reactivated')$$,
  'C - l accès et la progression reprennent après réactivation'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT lives_ok(
  $$SELECT public.admin_change_course_access(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002', 'formation-ia-act', 'suspend',
    'Nouvelle suspension conservée dans l historique', NULL, NULL
  )$$,
  'Une nouvelle suspension est historisée sans effacer la précédente'
);

SELECT lives_ok(
  $$SELECT public.admin_change_course_access(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002', 'formation-ia-act', 'revoke',
    'Décision technique explicite de révocation', NULL, NULL
  )$$,
  'D - la révocation peut suivre une suspension'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
SELECT throws_ok(
  $$INSERT INTO public.course_lesson_progress (user_id, course_id, lesson_id)
    VALUES ('10000000-0000-0000-0000-000000000002', 'formation-ia-act', 'lesson-revoked')$$,
  '42501',
  'new row violates row-level security policy for table "course_lesson_progress"',
  'D - un droit révoqué refuse l accès au niveau RLS'
);

RESET ROLE;
SELECT throws_ok(
  $$UPDATE public.course_access SET status = 'completed'
    WHERE id = '20000000-0000-0000-0000-000000000001'$$,
  '23514',
  'new row for relation "course_access" violates check constraint "course_access_status_check"',
  'completed ne peut pas devenir un statut de droit d accès'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
INSERT INTO sprint1_test_context (incident_id)
SELECT id FROM public.admin_create_disciplinary_incident(
  '10000000-0000-0000-0000-000000000003',
  'formation-ia-act',
  now() - interval '1 hour',
  'session_disruption',
  'L apprenant a interrompu à plusieurs reprises la classe virtuelle pendant le test.',
  'high',
  NULL,
  '10000000-0000-0000-0000-000000000001'
);

SELECT ok(
  (SELECT incident_id IS NOT NULL FROM sprint1_test_context),
  'G - un administrateur crée un incident structuré'
);

SELECT is(
  (SELECT count(*) FROM public.audit_log
    WHERE action_type = 'incident_created'
      AND target_id = (SELECT incident_id::text FROM sprint1_test_context))::bigint,
  1::bigint,
  'G - la création de l incident est journalisée'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
SELECT is(
  (SELECT count(*) FROM public.disciplinary_incidents)::bigint,
  0::bigint,
  'F - un apprenant ne peut consulter aucun incident disciplinaire'
);

SELECT is(
  (SELECT count(*) FROM public.audit_log)::bigint,
  0::bigint,
  'Un apprenant ne peut consulter aucune entrée d audit'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
SELECT throws_ok(
  $$SELECT public.admin_change_course_access(
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003', 'formation-ia-act', 'suspend',
    'Tentative employé devant être refusée', NULL, NULL
  )$$,
  '42501',
  'Action réservée au rôle admin.',
  'Le rôle employee ne peut pas suspendre un accès'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT lives_ok(
  format(
    $$SELECT public.admin_update_disciplinary_incident(
      %L, 'Décision humaine motivée après instruction',
      'decision_pending', NULL, 'permanent_exclusion',
      'Décision humaine prise après examen contradictoire du dossier.', NULL
    )$$,
    (SELECT incident_id FROM sprint1_test_context)
  ),
  'Une décision disciplinaire est enregistrée séparément du droit technique'
);

SELECT is(
  (SELECT status FROM public.course_access WHERE id = '20000000-0000-0000-0000-000000000002'),
  'active',
  'Une exclusion décidée ne révoque pas automatiquement course_access'
);

SELECT lives_ok(
  format(
    $$SELECT public.admin_change_course_access(
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003', 'formation-ia-act', 'suspend',
      'Mesure conservatoire distincte de la décision finale', NULL, %L
    )$$,
    (SELECT incident_id FROM sprint1_test_context)
  ),
  'La mesure conservatoire affectant l accès exige un incident associé'
);

SELECT is(
  (SELECT count(*) FROM public.audit_log
    WHERE action_type = 'access_suspended'
      AND metadata ->> 'incident_id' = (SELECT incident_id::text FROM sprint1_test_context))::bigint,
  1::bigint,
  'La mesure conservatoire conserve le lien vers l incident dans l audit'
);

SELECT lives_ok(
  format(
    $$SELECT public.admin_update_disciplinary_incident(
      %L, 'Clôture administrative après décision humaine',
      'closed', 'Accès suspendu à titre conservatoire.', NULL, NULL, 'AC-À-CRÉER-1.1'
    )$$,
    (SELECT incident_id FROM sprint1_test_context)
  ),
  'La clôture disciplinaire reste une action admin explicite'
);

RESET ROLE;
SELECT throws_ok(
  $$UPDATE public.audit_log SET reason = 'altération silencieuse' WHERE true$$,
  '42501',
  'Le journal d audit est append-only.',
  'H - même une mise à jour privilégiée du journal est bloquée par le trigger append-only'
);

SELECT throws_ok(
  $$DELETE FROM public.audit_log WHERE true$$,
  '42501',
  'Le journal d audit est append-only.',
  'La suppression normale du journal est bloquée par le trigger append-only'
);

SELECT ok(
  (SELECT count(*) >= 5 FROM public.audit_log
    WHERE target_type = 'course_access'
      AND target_id = '20000000-0000-0000-0000-000000000001'),
  'L historique complet suspension, réactivation et révocation est conservé'
);

SELECT is(
  (SELECT status FROM public.course_access WHERE id = '20000000-0000-0000-0000-000000000002'),
  'suspended',
  'I/J - expires_at NULL ne contourne jamais une suspension'
);

SELECT * FROM finish();
ROLLBACK;
