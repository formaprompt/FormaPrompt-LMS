BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(22);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('83000000-0000-4000-8000-000000000001','authenticated','authenticated','moderation-admin@example.test','','{}','{}',now(),now()),
  ('83000000-0000-4000-8000-000000000002','authenticated','authenticated','moderation-staff@example.test','','{}','{}',now(),now());
INSERT INTO public.profiles (id, email, role) VALUES
  ('83000000-0000-4000-8000-000000000001','moderation-admin@example.test','admin'),
  ('83000000-0000-4000-8000-000000000002','moderation-staff@example.test','employee')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role;

INSERT INTO public.contact_requests (id,name,email,subject,message) VALUES
  ('83000000-0000-4000-8000-000000000011','Spam fictif','Spam@example.test','Demande fictive','Message de test local.'),
  ('83000000-0000-4000-8000-000000000012','Essai fictif','sample@example.test','Demande fictive','Message de test local.'),
  ('83000000-0000-4000-8000-000000000013','Client fictif','quote@example.test','Demande fictive','Message de test local.');
INSERT INTO public.commercial_quotes (contact_request_id,client_name,client_email,course_id,course_title,unit_price_cents,valid_until,created_by)
VALUES ('83000000-0000-4000-8000-000000000013','Client fictif','quote@example.test','formation-ia','IA générative',49700,CURRENT_DATE+30,'83000000-0000-4000-8000-000000000001');

SELECT ok(NOT has_function_privilege('anon','public.moderate_commercial_request(uuid,uuid,text,boolean)','EXECUTE'),'pas de modération anonyme');
SELECT ok(NOT has_function_privilege('authenticated','public.moderate_commercial_request(uuid,uuid,text,boolean)','EXECUTE'),'pas de modération directe via le navigateur');
SELECT ok(NOT has_table_privilege('anon','public.contact_email_blocks','SELECT'),'la liste reste privée');

SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT public.moderate_commercial_request('83000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000011','spam',true)$$,'42501',NULL,'le personnel non administrateur ne modère pas');
SELECT throws_ok($$SELECT public.moderate_commercial_request('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000012','delete')$$,'FP409',NULL,'suppression directe d une demande active refusée');
SELECT throws_ok($$SELECT public.moderate_commercial_request('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000012','test',true)$$,'22023',NULL,'aucun blocage pour un test');
SELECT lives_ok($$SELECT public.moderate_commercial_request('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000011','spam',true)$$,'spam mis à la corbeille et blocage choisi');
SELECT is((SELECT discarded_reason FROM public.contact_requests WHERE id='83000000-0000-4000-8000-000000000011'),'spam','motif de corbeille enregistré');
SELECT is((SELECT status FROM public.admin_email_notifications WHERE kind='contact_request' AND source_id='83000000-0000-4000-8000-000000000011'),'dismissed','alerte en attente écartée');
SELECT is((SELECT email FROM public.contact_email_blocks WHERE email='spam@example.test'),'spam@example.test','adresse exacte normalisée');
RESET ROLE;

SET LOCAL ROLE anon;
INSERT INTO public.contact_requests (id,name,email,subject,message) VALUES
  ('83000000-0000-4000-8000-000000000021','Spam fictif','SPAM@EXAMPLE.TEST','Demande fictive','Message de test local.'),
  ('83000000-0000-4000-8000-000000000022','Voisin fictif','neighbor@example.test','Demande fictive','Message de test local.');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.contact_requests WHERE id='83000000-0000-4000-8000-000000000021'),0,'les insertions publiques directes sont aussi filtrées');
SELECT is((SELECT count(*)::integer FROM public.admin_email_notifications WHERE source_id='83000000-0000-4000-8000-000000000021'),0,'aucune alerte pour une demande filtrée');
SELECT is((SELECT count(*)::integer FROM public.contact_requests WHERE id='83000000-0000-4000-8000-000000000022'),1,'les autres adresses du domaine sont acceptées');

SET LOCAL ROLE service_role;
SELECT public.moderate_commercial_request('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000012','test');
SELECT public.moderate_commercial_request('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000012','delete');
SELECT is((SELECT count(*)::integer FROM public.contact_requests WHERE id='83000000-0000-4000-8000-000000000012'),0,'un test sans dossier peut être supprimé');
SELECT public.moderate_commercial_request('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000013','test');
SELECT throws_ok($$SELECT public.moderate_commercial_request('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000013','delete')$$,'FP409',NULL,'un devis empêche toute suppression définitive');
SELECT is((SELECT count(*)::integer FROM public.commercial_quotes WHERE contact_request_id='83000000-0000-4000-8000-000000000013'),1,'le devis et sa référence sont conservés');
SELECT public.moderate_commercial_request('83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000011','restore');
SELECT ok((SELECT discarded_at IS NULL FROM public.contact_requests WHERE id='83000000-0000-4000-8000-000000000011'),'la restauration ramène la demande');
SELECT is((SELECT count(*)::integer FROM public.contact_email_blocks WHERE email='spam@example.test'),1,'la restauration ne lève pas le blocage');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','83000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*)::integer FROM public.contact_email_blocks WHERE email='spam@example.test'),0,'la liste n est pas visible pour le personnel non administrateur');
DELETE FROM public.contact_email_blocks WHERE email='spam@example.test';
SELECT set_config('request.jwt.claim.sub','83000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT count(*)::integer FROM public.contact_email_blocks WHERE email='spam@example.test'),1,'le personnel non administrateur ne peut pas lever un blocage');
DELETE FROM public.contact_email_blocks WHERE email='spam@example.test';
RESET ROLE;
INSERT INTO public.contact_email_blocks(email,expires_at) VALUES ('expired@example.test',now() - interval '1 day');
SET LOCAL ROLE anon;
INSERT INTO public.contact_requests (id,name,email,subject,message) VALUES
  ('83000000-0000-4000-8000-000000000023','Contact fictif','spam@example.test','Demande fictive','Message de test local.'),
  ('83000000-0000-4000-8000-000000000024','Contact fictif','expired@example.test','Demande fictive','Message de test local.');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.contact_requests WHERE id='83000000-0000-4000-8000-000000000023'),1,'une soumission est acceptée après déblocage');
SELECT is((SELECT count(*)::integer FROM public.contact_requests WHERE id='83000000-0000-4000-8000-000000000024'),1,'le blocage cesse à expiration');

SELECT * FROM finish();
ROLLBACK;
