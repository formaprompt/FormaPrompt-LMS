BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT no_plan();

SELECT has_function('public', 'admin_list_withdrawal_requests', ARRAY[]::text[],
  'La RPC de consultation administrative existe');
SELECT has_function('public', 'admin_update_withdrawal_request', ARRAY['uuid','text','text'],
  'La RPC d instruction administrative existe');
SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid = 'public.admin_list_withdrawal_requests()'::regprocedure),
  'La consultation est SECURITY DEFINER avec search_path vide'
);
SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid = 'public.admin_update_withdrawal_request(uuid,text,text)'::regprocedure),
  'La mutation est SECURITY DEFINER avec search_path vide'
);
SELECT ok(NOT has_function_privilege('anon', 'public.admin_list_withdrawal_requests()', 'EXECUTE'),
  'Anon ne peut pas consulter les retractations');
SELECT ok(NOT has_function_privilege('service_role', 'public.admin_update_withdrawal_request(uuid,text,text)', 'EXECUTE'),
  'Le role de service ne contourne pas la RPC utilisateur');
SELECT ok(has_function_privilege('authenticated', 'public.admin_update_withdrawal_request(uuid,text,text)', 'EXECUTE'),
  'Authenticated peut atteindre la RPC qui verifie ensuite le role strict');
SELECT ok(NOT has_table_privilege('authenticated', 'public.withdrawal_requests', 'UPDATE'),
  'Aucune mise a jour directe de la table n est accordee');
SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
   WHERE oid = 'public.withdrawal_requests'::regclass),
  'La RLS reste active et forcee sur withdrawal_requests'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('87000000-0000-4000-8000-000000000001','authenticated','authenticated',
    'admin-withdrawal@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('87000000-0000-4000-8000-000000000002','authenticated','authenticated',
    'learner-withdrawal@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now());

INSERT INTO public.profiles (id, email, role) VALUES
  ('87000000-0000-4000-8000-000000000001','admin-withdrawal@example.test','admin'),
  ('87000000-0000-4000-8000-000000000002','learner-withdrawal@example.test','user')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role;

INSERT INTO public.withdrawal_requests (
  id, user_id, course_id, claimant_first_name, claimant_last_name,
  acknowledgement_email, declaration, acknowledgement_delivery_status,
  acknowledgement_delivered_at
) VALUES (
  '87000000-0000-4000-8000-000000000010',
  '87000000-0000-4000-8000-000000000002',
  'formation-ia', 'Camille', 'Test', 'learner-withdrawal@example.test',
  'Je confirme la demande de retractation utilisee pour le test dynamique.',
  'sent', now()
);

CREATE TEMP TABLE withdrawal_test_context (course_access_before integer) ON COMMIT DROP;
GRANT SELECT ON withdrawal_test_context TO authenticated;
INSERT INTO withdrawal_test_context
VALUES ((SELECT count(*)::integer FROM public.course_access));

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '87000000-0000-4000-8000-000000000002', true);

SELECT throws_ok(
  $$SELECT count(*) FROM public.admin_list_withdrawal_requests()$$,
  '42501', 'Action reservee au role admin.',
  'Un non-admin ne consulte pas la liste administrative'
);
SELECT throws_ok(
  $$SELECT public.admin_update_withdrawal_request(
    '87000000-0000-4000-8000-000000000010', 'under_review',
    'Tentative non autorisee avec un motif suffisamment long.'
  )$$,
  '42501', 'Action reservee au role admin.',
  'Un non-admin ne peut pas instruire une demande'
);

SELECT set_config('request.jwt.claim.sub', '87000000-0000-4000-8000-000000000001', true);

SELECT is(
  (SELECT count(*)::integer FROM public.admin_list_withdrawal_requests()
   WHERE id = '87000000-0000-4000-8000-000000000010'),
  1,
  'L admin strict consulte la demande'
);
SELECT throws_ok(
  $$SELECT public.admin_update_withdrawal_request(
    '87000000-0000-4000-8000-000000000010', 'accepted',
    'Tentative de decision sans instruction prealable documentee.'
  )$$,
  '22023', 'Transition de statut de retractation interdite.',
  'Une transition desordonnee est refusee'
);
SELECT lives_ok(
  $$SELECT public.admin_update_withdrawal_request(
    '87000000-0000-4000-8000-000000000010', 'under_review',
    'Ouverture documentee de l instruction administrative.'
  )$$,
  'L admin ouvre l instruction'
);
SELECT lives_ok(
  $$SELECT public.admin_update_withdrawal_request(
    '87000000-0000-4000-8000-000000000010', 'accepted',
    'Decision acceptee apres verification du dossier et des delais.'
  )$$,
  'L admin enregistre la decision'
);
SELECT lives_ok(
  $$SELECT public.admin_update_withdrawal_request(
    '87000000-0000-4000-8000-000000000010', 'closed',
    'Cloture administrative apres enregistrement de la decision.'
  )$$,
  'L admin cloture la demande'
);
SELECT is(
  (SELECT status FROM public.withdrawal_requests
   WHERE id = '87000000-0000-4000-8000-000000000010'),
  'closed',
  'Le statut final est conserve'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_log
   WHERE action_type = 'withdrawal_request_status_updated'
     AND target_id = '87000000-0000-4000-8000-000000000010'),
  3,
  'Chaque changement de statut est audite'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE action_type = 'withdrawal_request_status_updated'
      AND target_id = '87000000-0000-4000-8000-000000000010'
      AND concat(previous_state, new_state, metadata) ~* 'learner-withdrawal|Camille|Je confirme'
  ),
  'L audit ne recopie aucune donnee personnelle inutile'
);
SELECT is(
  (SELECT count(*)::integer FROM public.course_access),
  (SELECT course_access_before FROM withdrawal_test_context),
  'L instruction ne modifie aucun droit pedagogique'
);

SELECT * FROM finish();
ROLLBACK;
