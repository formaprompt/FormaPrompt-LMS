BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(29);

SELECT has_table('public', 'legal_document_versions', 'versions juridiques présentes');
SELECT has_table('public', 'commercial_checkout_intents', 'intentions commerciales présentes');
SELECT has_table('public', 'commercial_consents', 'consentements commerciaux présents');
SELECT has_table('public', 'withdrawal_requests', 'demandes de rétractation présentes');
SELECT has_table('public', 'commercial_payment_reviews', 'revue des anciens paiements présente');
SELECT has_column('public', 'withdrawal_requests', 'acknowledgement_delivery_attempted_at', 'la tentative email est horodatée');
SELECT has_column('public', 'withdrawal_requests', 'acknowledgement_delivery_attempts', 'les tentatives email sont comptées');
SELECT has_column('public', 'withdrawal_requests', 'acknowledgement_delivery_error_code', 'un échec email est tracé sans message sensible');
SELECT has_column('public', 'commercial_checkout_intents', 'sales_context', 'le contexte commercial est conservé');
SELECT has_column('public', 'commercial_checkout_intents', 'access_activation_policy', 'la politique d activation est conservée');
SELECT has_column('public', 'commercial_checkout_intents', 'beneficiary_email', 'le bénéficiaire peut être identifié sans créer un accès parallèle');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
) VALUES
  ('61000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'consent-a@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('61000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'consent-b@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now());

INSERT INTO public.profiles (id, email, role) VALUES
  ('61000000-0000-0000-0000-000000000001', 'consent-a@example.test', 'user'),
  ('61000000-0000-0000-0000-000000000002', 'consent-b@example.test', 'user')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role;

INSERT INTO public.legal_document_versions (
  id, document_type, version, status, public_path,
  content_text, content_sha256, effective_at
) VALUES
  (
    '62000000-0000-0000-0000-000000000002', 'early_service_start_statement',
    'EARLY-TEST-1', 'draft', NULL, 'Formulation préparatoire.', repeat('b', 64), NULL
  );

INSERT INTO public.purchases (
  id, user_id, course_id, amount_total, currency, payment_status, purchased_at
) VALUES (
  '63000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001',
  'formation-ia-act', 18700, 'eur', 'paid', now()
);

INSERT INTO public.commercial_checkout_intents (
  id, user_id, course_id, offer_classification, sales_context,
  access_start_choice, access_activation_policy, status,
  cgv_document_version_id, stripe_checkout_session_id
) VALUES (
  '64000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001',
  'formation-ia-act', 'B2C_STANDARD', 'personal', 'immediate',
  'immediate_after_payment', 'stripe_session_created',
  (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2C-2026-08-26'),
  'cs_test_consent'
);

INSERT INTO public.commercial_consents (
  id, checkout_intent_id, user_id, course_id, consent_type,
  granted, legal_document_version_id, source
) VALUES (
  '65000000-0000-0000-0000-000000000001',
  '64000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001',
  'formation-ia-act', 'cgv_acceptance', true,
  (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2C-2026-08-26'),
  'web_checkout'
);

INSERT INTO public.withdrawal_requests (
  id, user_id, purchase_id, checkout_intent_id, course_id,
  claimant_first_name, claimant_last_name, acknowledgement_email, declaration
) VALUES (
  '66000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000001',
  '64000000-0000-0000-0000-000000000001',
  'formation-ia-act', 'Marie', 'Test', 'marie@example.test',
  'Je vous informe clairement de ma décision de me rétracter de ce contrat.'
);

SET LOCAL ROLE anon;
SELECT is(
  (
    SELECT count(*)
    FROM (VALUES
      ('cgv_b2c', 'CGV-B2C-2026-08-26'),
      ('cgv_b2b', 'CGV-B2B-2026-08-26'),
      ('early_service_start_statement', 'EARLY-SERVICE-2026-08-12'),
      ('digital_content_start_statement', 'DIGITAL-START-2026-08-12'),
      ('digital_content_withdrawal_acknowledgement', 'DIGITAL-ACK-2026-08-12')
    ) AS expected(document_type, version)
    WHERE EXISTS (
      SELECT 1
      FROM public.legal_document_versions AS document
      WHERE document.document_type = expected.document_type
        AND document.version = expected.version
        AND document.status = 'published'
    )
  )::bigint,
  5::bigint,
  'le public voit uniquement les cinq versions publiées'
);

RESET ROLE;
SELECT throws_ok(
  $$UPDATE public.legal_document_versions
    SET content_text = 'Modification silencieuse interdite'
    WHERE version = 'CGV-B2C-2026-08-12'$$,
  '42501',
  'Une version juridique publiée est figée ; créez une nouvelle version.',
  'une version publiée ne peut pas être modifiée'
);
SELECT throws_ok(
  $$DELETE FROM public.legal_document_versions
    WHERE version = 'CGV-B2C-2026-08-12'$$,
  '42501',
  'Une version juridique publiée est figée ; créez une nouvelle version.',
  'une version publiée ne peut pas être supprimée'
);
SELECT lives_ok(
  $$UPDATE public.legal_document_versions
    SET status = 'retired', retired_at = now()
    WHERE version = 'CGV-B2C-2026-08-26'$$,
  'une version peut être retirée sans altérer son texte figé'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);

SELECT is((SELECT count(*) FROM public.commercial_checkout_intents)::bigint, 1::bigint, 'A lit sa propre intention');
SELECT is((SELECT count(*) FROM public.commercial_consents)::bigint, 1::bigint, 'A lit sa propre preuve');
SELECT is((SELECT count(*) FROM public.withdrawal_requests)::bigint, 1::bigint, 'A lit sa propre demande');

SELECT set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
SELECT is((SELECT count(*) FROM public.commercial_checkout_intents)::bigint, 0::bigint, 'B ne lit pas l intention de A');
SELECT is((SELECT count(*) FROM public.commercial_consents)::bigint, 0::bigint, 'B ne lit pas le consentement de A');
SELECT is((SELECT count(*) FROM public.withdrawal_requests)::bigint, 0::bigint, 'B ne lit pas la rétractation de A');

SELECT throws_ok(
  $$INSERT INTO public.commercial_consents (
      checkout_intent_id, user_id, course_id, consent_type, granted,
      legal_document_version_id, source
    ) VALUES (
      '64000000-0000-0000-0000-000000000001',
      '61000000-0000-0000-0000-000000000002', 'formation-ia-act',
      'early_service_start', true,
      (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2C-2026-08-26'),
      'web_checkout'
    )$$,
  '42501',
  'permission denied for table commercial_consents',
  'le navigateur ne peut pas fabriquer une preuve'
);

SELECT throws_ok(
  $$UPDATE public.commercial_consents SET source = 'admin_recorded' WHERE true$$,
  '42501',
  'permission denied for table commercial_consents',
  'le navigateur ne peut pas modifier une preuve'
);

SELECT throws_ok(
  $$DELETE FROM public.commercial_consents WHERE true$$,
  '42501',
  'permission denied for table commercial_consents',
  'le navigateur ne peut pas supprimer une preuve'
);

RESET ROLE;
SELECT ok(
  (SELECT created_at BETWEEN now() - interval '1 minute' AND now() + interval '1 minute'
   FROM public.commercial_consents WHERE id = '65000000-0000-0000-0000-000000000001'),
  'le consentement reçoit un horodatage base de données'
);
SELECT ok(
  (SELECT received_at BETWEEN now() - interval '1 minute' AND now() + interval '1 minute'
   FROM public.withdrawal_requests WHERE id = '66000000-0000-0000-0000-000000000001'),
  'la rétractation reçoit un horodatage base de données'
);
SELECT is(
  (SELECT count(*) FROM public.course_access
    WHERE user_id = '61000000-0000-0000-0000-000000000001')::bigint,
  0::bigint,
  'une demande de rétractation ne crée ni ne modifie course_access'
);
SELECT is(
  (SELECT acknowledgement_delivery_status FROM public.withdrawal_requests
   WHERE id = '66000000-0000-0000-0000-000000000001'),
  'pending',
  'l envoi électronique reste en attente tant que le transport ne l a pas traité'
);
SELECT throws_ok(
  $$INSERT INTO public.withdrawal_requests (
      user_id, purchase_id, course_id, claimant_first_name, claimant_last_name,
      acknowledgement_email, declaration
    ) VALUES (
      '61000000-0000-0000-0000-000000000001',
      '63000000-0000-0000-0000-000000000001',
      'formation-ia-act', 'Marie', 'Test', 'marie@example.test',
      'Je confirme une seconde demande concurrente pour la même commande.'
    )$$,
  '23505',
  NULL,
  'une double soumission concurrente ne crée pas une seconde demande active'
);

SELECT * FROM finish();
ROLLBACK;
