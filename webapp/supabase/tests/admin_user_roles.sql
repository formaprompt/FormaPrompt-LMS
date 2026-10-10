BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

-- Entirely fictitious identities; the canonical owner email only exercises the guard.
INSERT INTO auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
('72000000-0000-4000-8000-000000000001','authenticated','authenticated','roles-admin@example.test','','{}','{}',now(),now()),
('72000000-0000-4000-8000-000000000002','authenticated','authenticated','roles-trainer@example.test','','{}','{}',now(),now()),
('72000000-0000-4000-8000-000000000003','authenticated','authenticated','roles-user@example.test','','{}','{"role":"admin","email":"thierry227@gmail.com"}',now(),now()),
('72000000-0000-4000-8000-000000000004','authenticated','authenticated','thierry227@gmail.com','','{}','{}',now(),now());
INSERT INTO public.profiles(id,email,role) VALUES
('72000000-0000-4000-8000-000000000001','roles-admin@example.test','admin'),
('72000000-0000-4000-8000-000000000002','roles-trainer@example.test','employee'),
('72000000-0000-4000-8000-000000000003','roles-user@example.test','user'),
('72000000-0000-4000-8000-000000000004','thierry227@gmail.com','admin')
ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role,email=EXCLUDED.email;

SELECT ok(NOT has_function_privilege('anon','public.admin_set_user_role(uuid,text,text)','EXECUTE'),'anon has no RPC grant');
SELECT ok(NOT has_function_privilege('public','public.admin_set_user_role(uuid,text,text)','EXECUTE'),'PUBLIC has no RPC grant');
SELECT ok(has_function_privilege('authenticated','public.admin_set_user_role(uuid,text,text)','EXECUTE'),'authenticated can call guarded RPC');
SELECT ok(NOT has_table_privilege('authenticated','private.admin_role_owner','SELECT'),'anchor is private');
SELECT is((SELECT user_id::text FROM private.admin_role_owner WHERE singleton),'72000000-0000-4000-8000-000000000004','canonical Auth email binds stable UUID');

SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT public.admin_set_user_role('72000000-0000-4000-8000-000000000003','admin','user')$$,'42501',NULL,'anon cannot call RPC');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT throws_ok($$SELECT public.admin_set_user_role('72000000-0000-4000-8000-000000000003','admin','user')$$,'42501','Acces strictement reserve a un administrateur.','missing session rejected');
SELECT set_config('request.jwt.claim.sub','72000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"user_metadata":{"role":"admin"},"app_metadata":{"role":"admin"}}',true);
SELECT throws_ok($$SELECT public.admin_set_user_role('72000000-0000-4000-8000-000000000003','admin','user')$$,'42501','Acces strictement reserve a un administrateur.','metadata cannot grant admin');
SELECT set_config('request.jwt.claim.sub','72000000-0000-4000-8000-000000000002',true);
SELECT throws_ok($$SELECT public.admin_set_user_role('72000000-0000-4000-8000-000000000003','employee','user')$$,'42501','Acces strictement reserve a un administrateur.','employee cannot manage roles');
SELECT set_config('request.jwt.claim.sub','72000000-0000-4000-8000-000000000001',true);
SELECT is(public.admin_set_user_role('72000000-0000-4000-8000-000000000003','employee','user'),'{"userId":"72000000-0000-4000-8000-000000000003","role":"employee","protected":false,"changed":true}'::jsonb,'user promoted to existing employee role');
SELECT is(public.admin_set_user_role('72000000-0000-4000-8000-000000000003','admin','employee')->>'role','admin','employee promoted to admin');
SELECT is(public.admin_set_user_role('72000000-0000-4000-8000-000000000003','admin','admin')->>'changed','false','same role is idempotent');
SELECT throws_ok($$SELECT public.admin_set_user_role('72000000-0000-4000-8000-000000000003','user','employee')$$,'PT409','Le role a change. Actualisez la liste.','stale expected role rejected');
SELECT is(public.admin_set_user_role('72000000-0000-4000-8000-000000000003','user','admin')->>'role','user','another admin can be demoted');
SELECT throws_ok($$SELECT public.admin_set_user_role('72000000-0000-4000-8000-000000000003','trainer','user')$$,'22023','Parametres de role invalides.','invented role rejected');
SELECT throws_ok($$SELECT public.admin_set_user_role(NULL,'admin','user')$$,'22023','Parametres de role invalides.','null UUID rejected');
SELECT throws_ok($$SELECT public.admin_set_user_role('72000000-0000-4000-8000-000000000003',NULL,'user')$$,'22023','Parametres de role invalides.','null role rejected');
SELECT throws_ok($$SELECT public.admin_set_user_role('72000000-0000-4000-8000-000000000099','admin','user')$$,'P0002','Compte introuvable.','unknown UUID rejected');
SELECT throws_ok($$SELECT public.admin_set_user_role('72000000-0000-4000-8000-000000000004','employee','admin')$$,'42501','Le compte proprietaire est protege.','owner cannot become employee');
SELECT throws_ok($$SELECT public.admin_set_user_role('72000000-0000-4000-8000-000000000004','user','admin')$$,'42501','Le compte proprietaire est protege.','owner cannot become user');
SELECT is(public.admin_set_user_role('72000000-0000-4000-8000-000000000004','admin','admin')->>'protected','true','protected same role returned');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE action_type='profile_role_changed' AND target_user_id='72000000-0000-4000-8000-000000000003'),3,'exactly three real changes audited');
SELECT is((SELECT new_state->>'role' FROM public.audit_log WHERE action_type='profile_role_changed' AND target_user_id='72000000-0000-4000-8000-000000000003' AND previous_state->>'role'='admin'),'user','audit captures old and new role');
SELECT is((SELECT email FROM public.profiles WHERE id='72000000-0000-4000-8000-000000000003'),'roles-user@example.test','unrelated profile email preserved');
SELECT is((SELECT role FROM public.profiles WHERE id='72000000-0000-4000-8000-000000000002'),'employee','other profile role preserved');
UPDATE public.profiles SET email='changed-owner-profile@example.test' WHERE id='72000000-0000-4000-8000-000000000004';
UPDATE auth.users SET email='changed-owner-auth@example.test' WHERE id='72000000-0000-4000-8000-000000000004';
UPDATE public.profiles SET email='thierry227@gmail.com' WHERE id='72000000-0000-4000-8000-000000000003';
SELECT ok(private.is_admin_role_owner('72000000-0000-4000-8000-000000000004'),'owner stays protected after Auth and profile email change');
SELECT ok(NOT private.is_admin_role_owner('72000000-0000-4000-8000-000000000003'),'spoofed profile email does not acquire protection');

SET LOCAL ROLE service_role;
SELECT throws_ok($$UPDATE public.profiles SET role='user' WHERE id='72000000-0000-4000-8000-000000000004'$$,'42501','Le compte proprietaire est protege.','service direct owner downgrade rejected');
SELECT throws_ok($$DELETE FROM public.profiles WHERE id='72000000-0000-4000-8000-000000000004'$$,'42501','Le compte proprietaire est protege.','service cannot delete owner profile');
SELECT lives_ok($$UPDATE public.profiles SET role='employee' WHERE id='72000000-0000-4000-8000-000000000003'$$,'non-owner service maintenance preserved');
RESET ROLE;
SELECT throws_ok($$DELETE FROM auth.users WHERE id='72000000-0000-4000-8000-000000000004'$$,'42501','Le compte proprietaire est protege.','Auth owner deletion cannot clear anchor');
SELECT throws_ok($$UPDATE auth.users SET email='thierry227@gmail.com' WHERE id='72000000-0000-4000-8000-000000000003'$$,'42501','L identite proprietaire est deja liee.','canonical email cannot rebind owner');

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','72000000-0000-4000-8000-000000000003',true);
SELECT throws_ok($$UPDATE public.profiles SET id='72000000-0000-4000-8000-000000000099' WHERE id='72000000-0000-4000-8000-000000000001'$$,'42501','L identite du profil est immuable.','service session cannot move another admin identity');
SELECT throws_ok($$DELETE FROM public.profiles WHERE id='72000000-0000-4000-8000-000000000001'$$,'42501','Acces strictement reserve a un administrateur.','service carrying employee session cannot delete admin');
SELECT set_config('request.jwt.claim.sub','',true);
RESET ROLE;
-- Artificial permission broadening confined to this rolled-back test challenges the trigger itself.
GRANT UPDATE ON public.profiles TO authenticated;
CREATE POLICY role_test_write ON public.profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','72000000-0000-4000-8000-000000000003',true);
SELECT throws_ok($$UPDATE public.profiles SET role='admin' WHERE id='72000000-0000-4000-8000-000000000003'$$,'42501','Acces strictement reserve a un administrateur.','direct authenticated escalation rejected even if UPDATE is granted');
SELECT set_config('request.jwt.claim.sub','72000000-0000-4000-8000-000000000001',true);
SELECT throws_ok($$UPDATE public.profiles SET role='user' WHERE id='72000000-0000-4000-8000-000000000004'$$,'42501','Le compte proprietaire est protege.','direct authenticated owner downgrade rejected');
SELECT is(public.admin_set_user_role('72000000-0000-4000-8000-000000000003','user','employee')->>'protected','false','spoofed profile email does not prevent role management');
SELECT is(public.admin_set_user_role('72000000-0000-4000-8000-000000000001','employee','admin')->>'role','employee','ordinary admin can demote self');
SELECT throws_ok($$SELECT public.admin_set_user_role('72000000-0000-4000-8000-000000000003','admin','user')$$,'42501','Acces strictement reserve a un administrateur.','old JWT no longer authorizes demoted admin');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
