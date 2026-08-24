BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT no_plan();

SELECT has_table('public', 'quality_complaints', 'Le complement reclamation existe');
SELECT has_table('public', 'external_training_activities', 'Le registre des activites externes existe');
SELECT col_is_pk('public', 'quality_complaints', 'quality_record_id', 'La reclamation est un complement un-a-un');
SELECT col_is_fk('public', 'quality_complaints', 'quality_record_id', 'La reclamation depend du registre qualite');
SELECT col_is_fk('public', 'quality_complaints', 'training_enrollment_id', 'Le lien inscription est controle');
SELECT col_is_fk('public', 'quality_complaints', 'contact_request_id', 'Le lien commercial est controle');

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
   WHERE oid = 'public.quality_complaints'::regclass),
  'RLS forcee sur les reclamations'
);
SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
   WHERE oid = 'public.external_training_activities'::regclass),
  'RLS forcee sur les activites externes'
);
SELECT ok(NOT has_table_privilege('anon', 'public.quality_complaints', 'SELECT'),
  'Anon ne lit pas les reclamations');
SELECT ok(NOT has_table_privilege('anon', 'public.external_training_activities', 'SELECT'),
  'Anon ne lit pas les activites externes');
SELECT ok(NOT has_table_privilege('authenticated', 'public.quality_complaints', 'INSERT'),
  'Authenticated ne cree pas directement une reclamation');
SELECT ok(NOT has_table_privilege('authenticated', 'public.external_training_activities', 'UPDATE'),
  'Authenticated ne modifie pas directement une activite externe');
SELECT ok(NOT has_table_privilege('service_role', 'public.quality_complaints', 'DELETE'),
  'Aucune suppression de reclamation n est accordee');
SELECT ok(NOT has_table_privilege('service_role', 'public.external_training_activities', 'DELETE'),
  'Aucune suppression d activite externe n est accordee');

SELECT has_function('public', 'admin_create_quality_complaint',
  ARRAY['uuid','timestamp with time zone','text','text','text','text','text','uuid','uuid',
    'timestamp with time zone','timestamp with time zone','timestamp with time zone','text','text'],
  'RPC de creation de reclamation presente');
SELECT has_function('public', 'admin_update_quality_complaint',
  ARRAY['uuid','text','text','text','text','text','uuid','uuid','timestamp with time zone',
    'timestamp with time zone','timestamp with time zone','text','text'],
  'RPC de mise a jour de reclamation presente');
SELECT has_function('public', 'admin_create_external_training_activity',
  ARRAY['text','text','text','text','text','date','date','text','integer','numeric','numeric',
    'integer','text','text','text','integer','text','text'],
  'RPC de creation d activite externe presente');
SELECT has_function('public', 'admin_update_external_training_activity',
  ARRAY['uuid','text','text','text','text','text','text','text','date','date','text','integer',
    'numeric','numeric','integer','integer','text','text','text'],
  'RPC de mise a jour d activite externe presente');
SELECT has_function('public', 'admin_get_cockpit_summary', ARRAY['date','date','text'],
  'RPC de synthese du cockpit presente');

SELECT has_view('public', 'admin_cockpit_action_items', 'La file d actions est une projection');
SELECT has_view('public', 'admin_internal_training_activity', 'L activite interne est projetee');
SELECT has_view('public', 'admin_training_activity_all_sources', 'Les deux origines sont reunies');
SELECT has_view('public', 'admin_stripe_financial_summary', 'La synthese financiere est projetee');
SELECT has_view('public', 'admin_bpf_preparation_rows', 'Les lignes BPF preparatoires existent');

SELECT ok(
  (SELECT reloptions @> ARRAY['security_invoker=true']
   FROM pg_class WHERE oid = 'public.admin_cockpit_action_items'::regclass),
  'La file d actions respecte les droits de l appelant'
);
SELECT ok(
  (SELECT reloptions @> ARRAY['security_invoker=true']
   FROM pg_class WHERE oid = 'public.admin_training_activity_all_sources'::regclass),
  'L union d activite respecte les droits de l appelant'
);

SELECT has_trigger('public', 'quality_complaints', 'audit_quality_complaints_changes',
  'Les reclamations sont auditees');
SELECT has_trigger('public', 'external_training_activities', 'audit_external_training_activities_changes',
  'Les activites externes sont auditees');
SELECT has_trigger('public', 'quality_complaints', 'validate_quality_complaint_parent',
  'Le type du dossier parent est controle');

SELECT is(
  (SELECT count(*)::integer
   FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('cockpit_kpis', 'operational_alerts', 'cockpit_snapshots')),
  0,
  'Aucune table de KPI, alerte ou snapshot n est creee'
);
SELECT is(
  (SELECT count(*)::integer
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'external_training_activities'
     AND column_name IN ('purchase_id', 'course_access_id', 'training_enrollment_id',
       'stripe_payment_intent_id', 'stripe_checkout_session_id')),
  0,
  'L activite externe ne porte aucun lien LMS ou Stripe'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('86000000-0000-4000-8000-000000000001','authenticated','authenticated',
    'admin-s6@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('86000000-0000-4000-8000-000000000002','authenticated','authenticated',
    'learner-s6@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now());

INSERT INTO public.profiles (id, email, role) VALUES
  ('86000000-0000-4000-8000-000000000001','admin-s6@example.test','admin'),
  ('86000000-0000-4000-8000-000000000002','learner-s6@example.test','user')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role;

INSERT INTO public.training_enrollments (
  id, user_id, course_id, status, enrollment_source, organization_name,
  learner_first_name, learner_last_name, funding_mode, delivery_mode,
  starts_at, ends_at, duration_minutes, price_amount_cents,
  created_by, completed_at
) VALUES (
  '86000000-0000-4000-8000-000000000010',
  '86000000-0000-4000-8000-000000000002',
  'formation-ia', 'completed', 'manual', 'Client test Sprint 6',
  'Camille', 'Test', 'company', 'remote',
  '2026-06-10T07:00:00Z', '2026-06-10T14:00:00Z', 420, 80000,
  '86000000-0000-4000-8000-000000000001', '2026-06-10T14:00:00Z'
);

CREATE TEMP TABLE sprint6_test_context (
  complaint_record_id uuid,
  other_record_id uuid,
  direct_activity_id uuid,
  subcontracted_to_us_id uuid,
  subcontracted_by_us_id uuid,
  course_access_before integer
) ON COMMIT DROP;
GRANT SELECT, INSERT, UPDATE ON sprint6_test_context TO authenticated;
INSERT INTO sprint6_test_context (course_access_before)
VALUES ((SELECT count(*)::integer FROM public.course_access));

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000002', true);

SELECT is((SELECT count(*)::integer FROM public.quality_complaints), 0,
  'Un non-admin ne lit aucune reclamation');
SELECT is((SELECT count(*)::integer FROM public.external_training_activities), 0,
  'Un non-admin ne lit aucune activite externe');
SELECT is((SELECT count(*)::integer FROM public.admin_cockpit_action_items), 0,
  'Un non-admin ne lit pas la file d actions');
SELECT is((SELECT count(*)::integer FROM public.admin_training_activity_all_sources), 0,
  'Un non-admin ne lit pas la projection d activite');
SELECT throws_ok(
  $$SELECT public.admin_get_cockpit_summary('2026-01-01','2026-12-31',NULL)$$,
  '42501', 'Action reservee au role admin.',
  'Un non-admin ne peut pas appeler la synthese cockpit'
);
SELECT throws_ok(
  $$SELECT public.admin_create_external_training_activity(
    'Tentative interdite', 'direct', 'individual', 'self_funded', 'remote',
    '2026-01-01', '2026-01-01', 'completed', 1, 1, 1, 0,
    'not_invoiced', 'Motif non admin suffisamment long.'
  )$$,
  '42501', 'Action réservée au rôle admin.',
  'Un non-admin ne peut pas creer d activite par RPC'
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000001', true);

UPDATE sprint6_test_context
SET complaint_record_id = (
  SELECT id FROM public.admin_create_quality_record(
    'complaint', 'complaint', 'Reclamation test Sprint 6',
    'Description factuelle de la reclamation de test Sprint 6.',
    'high', '86000000-0000-4000-8000-000000000001',
    'Creation du dossier de reclamation pour le test Sprint 6.',
    '2026-08-20T08:00:00Z', NULL
  )
), other_record_id = (
  SELECT id FROM public.admin_create_quality_record(
    'finding', 'internal_audit', 'Constat non reclamation',
    'Description factuelle du constat qui ne doit pas accepter de complement.',
    'medium', '86000000-0000-4000-8000-000000000001',
    'Creation du constat temoin pour le test Sprint 6.',
    '2026-08-20T08:00:00Z', NULL
  )
);

SELECT lives_ok(
  $$SELECT public.admin_create_quality_complaint(
    (SELECT complaint_record_id FROM sprint6_test_context),
    '2026-08-20T08:00:00Z', 'email', 'customer',
    'Enregistrement controle de la reclamation de test.',
    'Client Test', 'client.s6@example.test', NULL, NULL,
    '2026-08-20T09:00:00Z', '2026-08-27T08:00:00Z'
  )$$,
  'Un admin strict cree le complement reclamation'
);
SELECT is((SELECT count(*)::integer FROM public.quality_complaints), 1,
  'L admin strict lit la reclamation creee');
SELECT is(
  (SELECT count(*)::integer FROM public.audit_log
   WHERE action_type = 'quality_complaint_created'
     AND target_id = (SELECT complaint_record_id::text FROM sprint6_test_context)),
  1,
  'La creation de reclamation est auditee'
);
SELECT throws_ok(
  $$SELECT public.admin_create_quality_complaint(
    (SELECT complaint_record_id FROM sprint6_test_context),
    '2026-08-20T08:00:00Z', 'email', 'customer',
    'Tentative de doublon de reclamation pour le test.'
  )$$,
  '23505',
  'duplicate key value violates unique constraint "quality_complaints_pkey"',
  'La relation un-a-un refuse un second complement'
);
SELECT throws_ok(
  $$SELECT public.admin_create_quality_complaint(
    (SELECT other_record_id FROM sprint6_test_context),
    '2026-08-20T08:00:00Z', 'email', 'customer',
    'Tentative sur un constat qui n est pas une reclamation.'
  )$$,
  'P0001', 'Constat de reclamation ouvert introuvable.',
  'Un constat hors complaint est refuse'
);
SELECT lives_ok(
  $$SELECT public.admin_update_quality_complaint(
    (SELECT complaint_record_id FROM sprint6_test_context),
    'Cloture documentee de la reclamation de test Sprint 6.',
    p_final_response_at => '2026-08-22T10:00:00Z',
    p_outcome => 'substantiated',
    p_resolution_summary => 'La reclamation est fondee et une reponse finale documentee a ete apportee.'
  )$$,
  'Un admin strict documente le resultat de la reclamation'
);
SELECT is(
  (SELECT outcome FROM public.quality_complaints
   WHERE quality_record_id = (SELECT complaint_record_id FROM sprint6_test_context)),
  'substantiated',
  'Le resultat de reclamation est conserve'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_log
   WHERE action_type = 'quality_complaint_updated'
     AND target_id = (SELECT complaint_record_id::text FROM sprint6_test_context)),
  1,
  'La mise a jour de reclamation est auditee'
);

SELECT throws_ok(
  $$SELECT public.admin_create_external_training_activity(
    'Activite terminee invalide', 'direct', 'company', 'company', 'remote',
    '2026-05-01', '2026-05-01', 'completed', 0, 0, 0, 0,
    'not_invoiced', 'Verification des volumes obligatoires pour une activite terminee.'
  )$$,
  '23514',
  'new row for relation "external_training_activities" violates check constraint "external_training_activities_completed_check"',
  'Une activite terminee sans stagiaire ni heure est refusee'
);
SELECT throws_ok(
  $$SELECT public.admin_create_external_training_activity(
    'Activite avec montant invalide', 'direct', 'company', 'company', 'remote',
    '2026-05-01', '2026-05-01', 'completed', 1, 2, 2, 1000,
    'paid', 'Verification de la coherence entre facture et encaissement.',
    p_collected_amount_cents => 1200
  )$$,
  '23514',
  'new row for relation "external_training_activities" violates check constraint "external_training_activities_amounts_check"',
  'Un encaissement superieur au facture est refuse'
);
SELECT throws_ok(
  $$SELECT public.admin_create_external_training_activity(
    'Activite avec dates invalides', 'direct', 'company', 'company', 'remote',
    '2026-05-02', '2026-05-01', 'planned', 0, 0, 0, 0,
    'not_invoiced', 'Verification de la chronologie de l activite externe.'
  )$$,
  '23514',
  'new row for relation "external_training_activities" violates check constraint "external_training_activities_dates_check"',
  'Une periode externe inversee est refusee'
);

UPDATE sprint6_test_context SET direct_activity_id = (
  SELECT id FROM public.admin_create_external_training_activity(
    'Formation externe directe', 'direct', 'company', 'company', 'remote',
    '2026-04-01', '2026-04-01', 'completed', 3, 7, 18.5, 100000,
    'partially_paid', 'Creation de l activite directe de test Sprint 6.',
    NULL, 60000, 'FACT-S6-001', 'Les heures stagiaires sont saisies selon les presences reelles.'
  )
), subcontracted_to_us_id = (
  SELECT id FROM public.admin_create_external_training_activity(
    'Formation confiee a FormaPrompt', 'subcontracted_to_us',
    'training_organization', 'company', 'in_person',
    '2026-04-10', '2026-04-11', 'completed', 5, 14, 65, 140000,
    'paid', 'Creation de la sous-traitance confiee a FormaPrompt.',
    'Organisme donneur ordre test', 140000, 'FACT-S6-002', NULL
  )
), subcontracted_by_us_id = (
  SELECT id FROM public.admin_create_external_training_activity(
    'Formation confiee par FormaPrompt', 'subcontracted_by_us',
    'company', 'company', 'hybrid',
    '2026-04-20', '2026-04-20', 'completed', 4, 7, 26, 90000,
    'invoiced', 'Creation de la sous-traitance confiee par FormaPrompt.',
    'Intervenant ou organisme test', 0, 'FACT-S6-003', NULL
  )
);

SELECT is((SELECT count(*)::integer FROM public.external_training_activities), 3,
  'Les trois relations d activite externe sont conservees');
SELECT is(
  (SELECT trainee_hours FROM public.external_training_activities
   WHERE id = (SELECT direct_activity_id FROM sprint6_test_context)),
  18.50::numeric,
  'Les heures stagiaires restent distinctes de stagiaires multiplie par duree'
);
SELECT isnt(
  (SELECT invoiced_amount_cents FROM public.external_training_activities
   WHERE id = (SELECT direct_activity_id FROM sprint6_test_context)),
  (SELECT collected_amount_cents FROM public.external_training_activities
   WHERE id = (SELECT direct_activity_id FROM sprint6_test_context)),
  'Le facture et l encaisse restent distincts'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_log
   WHERE action_type = 'external_training_activity_created'),
  3,
  'Chaque creation d activite externe est auditee'
);
SELECT is(
  (SELECT count(*)::integer FROM public.admin_training_activity_all_sources
   WHERE activity_id IN (
     '86000000-0000-4000-8000-000000000010',
     (SELECT direct_activity_id FROM sprint6_test_context),
     (SELECT subcontracted_to_us_id FROM sprint6_test_context),
     (SELECT subcontracted_by_us_id FROM sprint6_test_context)
   )),
  4,
  'L union contient une activite interne et trois externes'
);
SELECT is(
  (SELECT count(DISTINCT source_kind || ':' || activity_id::text)::integer
   FROM public.admin_training_activity_all_sources
   WHERE activity_id IN (
     '86000000-0000-4000-8000-000000000010',
     (SELECT direct_activity_id FROM sprint6_test_context),
     (SELECT subcontracted_to_us_id FROM sprint6_test_context),
     (SELECT subcontracted_by_us_id FROM sprint6_test_context)
   )),
  4,
  'L union ne duplique aucune origine'
);
SELECT is(
  (SELECT training_hours FROM public.admin_bpf_preparation_rows
   WHERE activity_id = '86000000-0000-4000-8000-000000000010'),
  NULL::numeric,
  'Les heures internes non verifiables restent NULL'
);

RESET ROLE;

INSERT INTO public.stripe_webhook_events (
  event_id, event_type, stripe_object_id, livemode, stripe_created_at
) VALUES
  ('evt_s6_fin_1','checkout.session.completed','pi_s6_fin_1',false,'2026-07-01T08:00:00Z'),
  ('evt_s6_fin_2','refund.created','re_s6_fin_1',false,'2026-07-02T08:00:00Z'),
  ('evt_s6_fin_3','refund.created','re_s6_fin_2',false,'2026-07-03T08:00:00Z'),
  ('evt_s6_fin_4','charge.dispute.created','dp_s6_open',false,'2026-07-04T08:00:00Z'),
  ('evt_s6_fin_5','charge.dispute.closed','dp_s6_lost',false,'2026-07-05T08:00:00Z'),
  ('evt_s6_fin_6','checkout.session.completed','pi_s6_fin_6',false,'2026-07-06T08:00:00Z');

INSERT INTO public.stripe_payment_transactions (
  id, course_id, stripe_payment_intent_id, payment_type, status,
  amount_total, amount_refunded, currency, last_event_id, last_event_created_at, created_at
) VALUES
  ('86000000-0000-4000-8000-000000000101','formation-ia','pi_s6_fin_1','course','disputed',10000,2000,'eur','evt_s6_fin_1','2026-07-01T08:00:00Z','2026-07-01T08:00:00Z'),
  ('86000000-0000-4000-8000-000000000102','formation-ia','pi_s6_fin_2','course','refunded',12000,12000,'eur','evt_s6_fin_2','2026-07-02T08:00:00Z','2026-07-02T08:00:00Z'),
  ('86000000-0000-4000-8000-000000000103','formation-ia','pi_s6_fin_3','course','dispute_lost',15000,0,'eur','evt_s6_fin_3','2026-07-03T08:00:00Z','2026-07-03T08:00:00Z'),
  ('86000000-0000-4000-8000-000000000104',NULL,'pi_s6_fin_4','in_person_travel_fee','paid',3000,0,'eur','evt_s6_fin_4','2026-07-04T08:00:00Z','2026-07-04T08:00:00Z'),
  ('86000000-0000-4000-8000-000000000105','formation-ia','pi_s6_fin_5','course','dispute_lost',10000,4000,'eur','evt_s6_fin_5','2026-07-05T08:00:00Z','2026-07-05T08:00:00Z');

INSERT INTO public.stripe_refunds (
  transaction_id, stripe_refund_id, status, amount, currency,
  last_event_id, last_event_created_at
) VALUES
  ('86000000-0000-4000-8000-000000000101','re_s6_fin_partial','succeeded',2000,'eur','evt_s6_fin_2','2026-07-02T08:00:00Z'),
  ('86000000-0000-4000-8000-000000000102','re_s6_fin_total','succeeded',12000,'eur','evt_s6_fin_3','2026-07-03T08:00:00Z'),
  ('86000000-0000-4000-8000-000000000105','re_s6_fin_overlap','succeeded',4000,'eur','evt_s6_fin_2','2026-07-02T08:00:00Z');

INSERT INTO public.stripe_disputes (
  transaction_id, stripe_dispute_id, status, amount, currency,
  last_event_id, last_event_created_at
) VALUES
  ('86000000-0000-4000-8000-000000000101','dp_s6_fin_open','needs_response',1000,'eur','evt_s6_fin_4','2026-07-04T08:00:00Z'),
  ('86000000-0000-4000-8000-000000000103','dp_s6_fin_lost','lost',15000,'eur','evt_s6_fin_5','2026-07-05T08:00:00Z'),
  ('86000000-0000-4000-8000-000000000105','dp_s6_fin_overlap','lost',10000,'eur','evt_s6_fin_5','2026-07-05T08:00:00Z');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000001', true);

SELECT is(
  (SELECT sum(gross_training_cents) FROM public.admin_stripe_financial_summary
   WHERE transaction_id::text LIKE '86000000-0000-4000-8000-00000000010%'),
  47000::numeric,
  'Les encaissements bruts de formation incluent les paiements arrives a succes'
);
SELECT is(
  (SELECT sum(successful_refund_cents) FROM public.admin_stripe_financial_summary
   WHERE transaction_id::text LIKE '86000000-0000-4000-8000-00000000010%'),
  18000::numeric,
  'Les remboursements partiel et total sont distingues'
);
SELECT is(
  (SELECT sum(open_dispute_cents) FROM public.admin_stripe_financial_summary
   WHERE transaction_id::text LIKE '86000000-0000-4000-8000-00000000010%'),
  1000::numeric,
  'Le litige ouvert reste un montant a risque'
);
SELECT is(
  (SELECT sum(lost_dispute_cents) FROM public.admin_stripe_financial_summary
   WHERE transaction_id::text LIKE '86000000-0000-4000-8000-00000000010%'),
  21000::numeric,
  'Le litige perdu ne recoupe pas les montants deja rembourses'
);
SELECT is(
  (SELECT sum(travel_fee_cents) FROM public.admin_stripe_financial_summary
   WHERE transaction_id::text LIKE '86000000-0000-4000-8000-00000000010%'),
  3000::numeric,
  'Les frais de deplacement restent separes du produit de formation'
);
SELECT is(
  (SELECT sum(estimated_net_stripe_cents) FROM public.admin_stripe_financial_summary
   WHERE transaction_id::text LIKE '86000000-0000-4000-8000-00000000010%'),
  11000::numeric,
  'Le net estime ne soustrait aucun montant deux fois'
);

SELECT is(
  (SELECT count(*)::integer FROM public.course_access),
  (SELECT course_access_before FROM sprint6_test_context),
  'Les reclamations et activites externes ne modifient aucun droit pedagogique'
);
SELECT lives_ok(
  $$SELECT public.admin_get_cockpit_summary('2026-01-01','2026-12-31',NULL)$$,
  'L admin strict lit le contrat global du cockpit'
);
SELECT ok(
  (public.admin_get_cockpit_summary('2026-01-01','2026-12-31',NULL) ? 'kpis')
  AND (public.admin_get_cockpit_summary('2026-01-01','2026-12-31',NULL) ? 'priority_actions')
  AND (public.admin_get_cockpit_summary('2026-01-01','2026-12-31',NULL) ? 'stripe_financial_by_currency'),
  'La RPC retourne un contrat frontend explicite'
);

SELECT * FROM finish();
ROLLBACK;
