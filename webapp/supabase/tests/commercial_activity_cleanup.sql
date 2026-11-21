BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(32);

INSERT INTO auth.users (id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
  ('84000000-0000-4000-8000-000000000001','authenticated','authenticated','cleanup-admin@example.test','','{}','{}',now(),now()),
  ('84000000-0000-4000-8000-000000000002','authenticated','authenticated','cleanup-staff@example.test','','{}','{}',now(),now());
INSERT INTO public.profiles (id,email,role) VALUES
  ('84000000-0000-4000-8000-000000000001','cleanup-admin@example.test','admin'),
  ('84000000-0000-4000-8000-000000000002','cleanup-staff@example.test','employee')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role;

INSERT INTO public.contact_requests (id,name,email,subject,message) VALUES
  ('84000000-0000-4000-8000-000000000011','Contact fictif','test@example.test','Demande fictive','Exemple local'),
  ('84000000-0000-4000-8000-000000000012','Contact fictif','spam@example.test','Demande fictive','Exemple local'),
  ('84000000-0000-4000-8000-000000000013','Contact fictif','devis@example.test','Demande fictive','Exemple local'),
  ('84000000-0000-4000-8000-000000000014','Contact fictif','in-flight@example.test','Demande fictive','Exemple local'),
  ('84000000-0000-4000-8000-000000000015','Contact fictif','active@example.test','Demande fictive','Exemple local');
INSERT INTO public.commercial_quotes (contact_request_id,client_name,client_email,course_id,course_title,unit_price_cents,valid_until,created_by)
VALUES ('84000000-0000-4000-8000-000000000013','Client fictif','devis@example.test','formation-ia','IA générative',49700,CURRENT_DATE+30,'84000000-0000-4000-8000-000000000001');
INSERT INTO public.commercial_follow_ups (id,contact_request_id,created_by,scheduled_for,status,subject,body,idempotency_key) VALUES
  ('84000000-0000-4000-8000-000000000021','84000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000001',now()+interval '1 day','scheduled','Relance fictive','Exemple de test','cleanup-followup-scheduled'),
  ('84000000-0000-4000-8000-000000000022','84000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000001',now()+interval '1 day','failed','Relance refusée','Exemple de test','cleanup-followup-failed'),
  ('84000000-0000-4000-8000-000000000023','84000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000001',now()+interval '1 day','scheduled','Relance à envoyer','Exemple de test','cleanup-followup-claim');
INSERT INTO public.commercial_communications (id,contact_request_id,prepared_by,communication_type,delivery_status,recipient_email,subject,body,idempotency_key,error_code,sent_at) VALUES
  ('84000000-0000-4000-8000-000000000031','84000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000001','quote','failed','mail@example.test','Communication fictive','Exemple de test','cleanup-mail-test-31','smtp_rejected_550',NULL),
  ('84000000-0000-4000-8000-000000000032','84000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000001','information','sent','mail@example.test','Communication fictive','Exemple de test','cleanup-mail-test-32',NULL,now()),
  ('84000000-0000-4000-8000-000000000033','84000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000001','information','failed','mail@example.test','Communication fictive','Exemple de test','cleanup-mail-test-33','smtp_delivery_uncertain',NULL),
  ('84000000-0000-4000-8000-000000000034','84000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000001','information','uncertain','mail@example.test','Communication fictive','Exemple de test','cleanup-mail-test-34',NULL,NULL),
  ('84000000-0000-4000-8000-000000000035','84000000-0000-4000-8000-000000000012','84000000-0000-4000-8000-000000000001','information','sent','mail@example.test','Communication fictive','Exemple de test','cleanup-mail-test-35',NULL,now()),
  ('84000000-0000-4000-8000-000000000036','84000000-0000-4000-8000-000000000012','84000000-0000-4000-8000-000000000001','information','prepared','mail@example.test','Communication fictive','Exemple de test','cleanup-mail-test-36',NULL,NULL),
  ('84000000-0000-4000-8000-000000000037','84000000-0000-4000-8000-000000000012','84000000-0000-4000-8000-000000000001','information','failed','mail@example.test','Communication fictive','Exemple de test','cleanup-mail-test-37','smtp_delivery_uncertain',NULL),
  ('84000000-0000-4000-8000-000000000038','84000000-0000-4000-8000-000000000014','84000000-0000-4000-8000-000000000001','information','sending','mail@example.test','Communication fictive','Exemple de test','cleanup-mail-test-38',NULL,NULL),
  ('84000000-0000-4000-8000-000000000039','84000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000001','note','cancelled','mail@example.test','Communication fictive','Exemple de test','cleanup-mail-test-39',NULL,NULL),
  ('84000000-0000-4000-8000-000000000040','84000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000001','follow_up','failed','mail@example.test','Communication fictive','Exemple de test','cleanup-followup-failed','smtp_rejected_550',NULL);

SELECT ok(NOT has_function_privilege('authenticated','public.cleanup_commercial_activity(uuid,uuid,text,uuid)','EXECUTE'),'aucun accès direct à la suppression');
SELECT ok(NOT has_function_privilege('anon','public.cleanup_commercial_activity(uuid,uuid,text,uuid)','EXECUTE'),'aucun accès anonyme');
SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000011','cancel_follow_up','84000000-0000-4000-8000-000000000021')$$,'42501',NULL,'un employé ne peut pas annuler');
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000012','cancel_follow_up','84000000-0000-4000-8000-000000000021')$$,'FP409',NULL,'une autre demande ne peut pas être modifiée');
SELECT lives_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000011','cancel_follow_up','84000000-0000-4000-8000-000000000021')$$,'la relance programmée est annulée');
SELECT is((SELECT status FROM public.commercial_follow_ups WHERE id='84000000-0000-4000-8000-000000000021'),'cancelled','le statut de la relance est annulé');
SELECT is((SELECT count(*) FROM public.commercial_request_history WHERE contact_request_id='84000000-0000-4000-8000-000000000011' AND event_type='follow_up_cancelled'),1::bigint,'l’annulation est visible dans l’historique');
SELECT throws_ok($$INSERT INTO public.commercial_communications (contact_request_id,prepared_by,communication_type,delivery_status,recipient_email,subject,body,idempotency_key) VALUES ('84000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000001','follow_up','sending','test@example.test','Dossier fictif','Envoi du test','cleanup-followup-scheduled')$$,'FP409',NULL,'une tentative ancienne ne peut plus envoyer la relance annulée');
SELECT lives_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000011','delete_test_follow_up','84000000-0000-4000-8000-000000000021')$$,'la relance de test annulée peut être supprimée');
SELECT lives_ok($$INSERT INTO public.commercial_communications (contact_request_id,prepared_by,communication_type,delivery_status,recipient_email,subject,body,idempotency_key) VALUES ('84000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000001','follow_up','sending','test@example.test','Dossier fictif','Envoi du test','cleanup-followup-claim')$$,'le démarrage d’une relance encore programmée reste possible');
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000011','cancel_follow_up','84000000-0000-4000-8000-000000000023')$$,'FP409',NULL,'une relance dont l’envoi a commencé ne peut plus être annulée');
SELECT lives_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000011','delete_test_communication','84000000-0000-4000-8000-000000000031')$$,'un test de devis refusé par le serveur mail peut être supprimé');
SELECT lives_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000011','delete_test_communication','84000000-0000-4000-8000-000000000039')$$,'une note de test annulée peut être supprimée');
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000011','delete_test_communication','84000000-0000-4000-8000-000000000032')$$,'FP409',NULL,'le mail envoyé est conservé');
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000011','delete_test_communication','84000000-0000-4000-8000-000000000033')$$,'FP409',NULL,'le statut historique ambigu est protégé');
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000011','delete_test_communication','84000000-0000-4000-8000-000000000034')$$,'FP409',NULL,'l’envoi au résultat incertain est protégé');
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000011','delete_test_follow_up','84000000-0000-4000-8000-000000000022')$$,'FP409',NULL,'la relance reste liée tant que sa communication existe');
SELECT lives_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000011','delete_test_communication','84000000-0000-4000-8000-000000000040')$$,'la communication de relance dont le mail a été rejeté est supprimable');
SELECT lives_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000011','delete_test_follow_up','84000000-0000-4000-8000-000000000022')$$,'la relance de test peut être retirée après sa communication');
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000015','purge_blocked_spam')$$,'FP409',NULL,'une demande active ne peut pas être supprimée comme spam');
SELECT public.moderate_commercial_request('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000012','spam',false);
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000012','purge_blocked_spam')$$,'FP409',NULL,'le blocage de l’adresse est requis');
INSERT INTO public.contact_email_blocks (email,expires_at) VALUES ('spam@example.test',now()-interval '1 day');
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000012','purge_blocked_spam')$$,'FP409',NULL,'un blocage expiré ne permet pas la suppression');
UPDATE public.contact_email_blocks SET expires_at=now()+interval '1 day' WHERE email='spam@example.test';
SELECT public.moderate_commercial_request('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000013','spam',true);
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000013','purge_blocked_spam')$$,'FP409',NULL,'un dossier avec un devis reste protégé');
SELECT public.moderate_commercial_request('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000014','spam',true);
SELECT throws_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000014','purge_blocked_spam')$$,'FP409',NULL,'une demande avec un envoi en cours reste protégée');
SELECT lives_ok($$SELECT public.cleanup_commercial_activity('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000012','purge_blocked_spam')$$,'un spam bloqué avec historique peut être supprimé');
SELECT is((SELECT count(*) FROM public.contact_requests WHERE id='84000000-0000-4000-8000-000000000012'),0::bigint,'la demande est supprimée');
SELECT is((SELECT count(*) FROM public.contact_email_blocks WHERE email='spam@example.test'),1::bigint,'l’adresse reste bloquée');
SELECT is((SELECT count(*) FROM public.commercial_communications WHERE id='84000000-0000-4000-8000-000000000035' AND contact_request_id IS NULL AND delivery_status='sent'),1::bigint,'le mail envoyé reste consultable');
SELECT is((SELECT count(*) FROM public.commercial_communications WHERE id='84000000-0000-4000-8000-000000000036'),0::bigint,'la communication de test disparait avec le spam');
SELECT is((SELECT count(*) FROM public.commercial_communications WHERE id='84000000-0000-4000-8000-000000000037' AND contact_request_id IS NULL AND delivery_status='uncertain'),1::bigint,'un envoi historique incertain est marqué à vérifier');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','84000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*) FROM public.commercial_communications WHERE id='84000000-0000-4000-8000-000000000035'),0::bigint,'l’historique détaché est réservé aux administrateurs');
SELECT set_config('request.jwt.claim.sub','84000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT count(*) FROM public.commercial_communications WHERE id='84000000-0000-4000-8000-000000000035'),1::bigint,'un administrateur voit le mail détaché');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
