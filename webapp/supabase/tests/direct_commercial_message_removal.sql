BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(22);

INSERT INTO auth.users (id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
  ('85000000-0000-4000-8000-000000000001','authenticated','authenticated','removal-admin@example.test','','{}','{}',now(),now()),
  ('85000000-0000-4000-8000-000000000002','authenticated','authenticated','removal-staff@example.test','','{}','{}',now(),now());
INSERT INTO public.profiles (id,email,role) VALUES
  ('85000000-0000-4000-8000-000000000001','removal-admin@example.test','admin'),
  ('85000000-0000-4000-8000-000000000002','removal-staff@example.test','employee')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role;

INSERT INTO public.contact_requests (id,name,email,subject,message) VALUES
  ('85000000-0000-4000-8000-000000000011','Fictif','spam-with-history@example.test','Sujet fictif','Message fictif'),
  ('85000000-0000-4000-8000-000000000012','Fictif','spam-empty@example.test','Sujet fictif','Message fictif'),
  ('85000000-0000-4000-8000-000000000013','Fictif','sensitive-quote@example.test','Sujet fictif','Message fictif'),
  ('85000000-0000-4000-8000-000000000014','Fictif','sent-history@example.test','Sujet fictif','Message fictif'),
  ('85000000-0000-4000-8000-000000000015','Fictif','test-trash@example.test','Sujet fictif','Message fictif'),
  ('85000000-0000-4000-8000-000000000016','Fictif','sending@example.test','Sujet fictif','Message fictif');
INSERT INTO public.commercial_quotes (contact_request_id,client_name,client_email,course_id,course_title,unit_price_cents,valid_until,created_by)
  VALUES ('85000000-0000-4000-8000-000000000013','Fictif','sensitive-quote@example.test','formation-ia','IA générative',49700,CURRENT_DATE+30,'85000000-0000-4000-8000-000000000001');
INSERT INTO public.commercial_communications (id,contact_request_id,prepared_by,communication_type,delivery_status,recipient_email,subject,body,idempotency_key,error_code,sent_at) VALUES
  ('85000000-0000-4000-8000-000000000031','85000000-0000-4000-8000-000000000011','85000000-0000-4000-8000-000000000001','information','failed','test@example.test','Sujet fictif','Message fictif','remove-commercial-31','smtp_rejected_550',NULL),
  ('85000000-0000-4000-8000-000000000032','85000000-0000-4000-8000-000000000011','85000000-0000-4000-8000-000000000001','information','failed','test@example.test','Sujet fictif','Message fictif','remove-commercial-32','smtp_rejected_550',NULL),
  ('85000000-0000-4000-8000-000000000035','85000000-0000-4000-8000-000000000014','85000000-0000-4000-8000-000000000001','information','sent','test@example.test','Sujet fictif','Message fictif','remove-commercial-35',NULL,now()),
  ('85000000-0000-4000-8000-000000000036','85000000-0000-4000-8000-000000000014','85000000-0000-4000-8000-000000000001','information','prepared','test@example.test','Sujet fictif','Message fictif','remove-commercial-36',NULL,NULL),
  ('85000000-0000-4000-8000-000000000037','85000000-0000-4000-8000-000000000016','85000000-0000-4000-8000-000000000001','information','sending','test@example.test','Sujet fictif','Message fictif','remove-commercial-37',NULL,NULL);
INSERT INTO public.commercial_request_history (contact_request_id,actor_user_id,event_type)
  VALUES ('85000000-0000-4000-8000-000000000011','85000000-0000-4000-8000-000000000001','email_failed'),('85000000-0000-4000-8000-000000000012','85000000-0000-4000-8000-000000000001','status_changed');

SELECT ok(NOT has_function_privilege('authenticated','public.remove_commercial_message(uuid,uuid,uuid,text,boolean)','EXECUTE'),'suppression réservée à la fonction serveur');
SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT public.remove_commercial_message('85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000011',NULL,'spam',false)$$,'42501',NULL,'un employé ne peut supprimer une demande');
SELECT throws_ok($$SELECT public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000011',NULL,NULL,false)$$,'22023',NULL,'une demande active exige un motif');
SELECT throws_ok($$SELECT public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000011',NULL,'test',true)$$,'22023',NULL,'un test ne bloque pas l’adresse');
SELECT is(public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000011',NULL,'spam',false),'deleted','spam avec deux tentatives échouées supprimé en une action');
SELECT is((SELECT count(*) FROM public.contact_requests WHERE id='85000000-0000-4000-8000-000000000011'),0::bigint,'le spam quitte la liste active');
SELECT is((SELECT count(*) FROM public.commercial_communications WHERE id IN ('85000000-0000-4000-8000-000000000031','85000000-0000-4000-8000-000000000032')),0::bigint,'les tentatives rejetées sont supprimées');
SELECT is((SELECT count(*) FROM public.contact_email_blocks WHERE email='spam-with-history@example.test'),0::bigint,'le blocage reste facultatif');
SELECT is(public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000012',NULL,'spam',true),'deleted','spam sans communication supprimé avec blocage en une action');
SELECT is((SELECT count(*) FROM public.contact_email_blocks WHERE email='spam-empty@example.test'),1::bigint,'adresse bloquée en même temps que la suppression');
SELECT throws_ok($$SELECT public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000013','85000000-0000-4000-8000-000000000035',NULL,false)$$,'FP404',NULL,'impossible de retirer la communication d’une autre demande');
SELECT is(public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000014','85000000-0000-4000-8000-000000000035',NULL,false),'archived','un mail envoyé peut être retiré de la liste');
SELECT ok((SELECT removed_from_timeline_at IS NOT NULL AND contact_request_id='85000000-0000-4000-8000-000000000014' AND delivery_status='sent' FROM public.commercial_communications WHERE id='85000000-0000-4000-8000-000000000035'),'le contenu et le statut envoyé restent associés à la demande');
SELECT is(public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000014','85000000-0000-4000-8000-000000000036',NULL,false),'deleted','une communication de test non envoyée est supprimée');
SELECT is(public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000014','85000000-0000-4000-8000-000000000035',NULL,false),'archived','une répétition ne supprime pas l’archive');
SELECT is(public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000014',NULL,'spam',false),'deleted','une demande avec un mail envoyé peut être retirée');
SELECT ok((SELECT contact_request_id IS NULL AND delivery_status='sent' FROM public.commercial_communications WHERE id='85000000-0000-4000-8000-000000000035'),'le mail survit à la suppression de la demande');
SELECT throws_ok($$SELECT public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000013',NULL,'spam',true)$$,'FP409',NULL,'un devis reste protégé');
SELECT is((SELECT count(*) FROM public.contact_email_blocks WHERE email='sensitive-quote@example.test'),0::bigint,'aucun effet partiel si la suppression échoue');
SELECT public.moderate_commercial_request('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000015','test');
SELECT is(public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000015',NULL,NULL,false),'deleted','suppression depuis la corbeille avec le motif existant');
SELECT throws_ok($$SELECT public.remove_commercial_message('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000016',NULL,'spam',false)$$,'FP409',NULL,'un envoi en cours protège sa demande');
SELECT ok((SELECT discarded_at IS NULL FROM public.contact_requests WHERE id='85000000-0000-4000-8000-000000000016'),'la demande reste active après le refus');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
