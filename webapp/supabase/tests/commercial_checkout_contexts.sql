BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(35);

SELECT has_column('public', 'commercial_checkout_intents', 'sales_context', 'contexte commercial présent');
SELECT has_column('public', 'commercial_checkout_intents', 'access_start_choice', 'choix de commencement présent');
SELECT has_column('public', 'commercial_checkout_intents', 'access_activation_policy', 'politique d activation présente');
SELECT has_column('public', 'commercial_checkout_intents', 'beneficiary_email', 'bénéficiaire identifiable');
SELECT has_column('public', 'commercial_checkout_intents', 'buyer_organization_name', 'organisation acheteuse identifiable');

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.commercial_checkout_intents'::regclass),
  true,
  'RLS active sur les intentions commerciales'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.commercial_consents'::regclass),
  true,
  'RLS active sur les consentements commerciaux'
);

SELECT is(
  (SELECT content_sha256 FROM public.legal_document_versions WHERE version = 'CGV-B2C-2026-08-12'),
  '2638f1ae962efb81a8f8b7f1ed96a4ba673fd3300b6dd507ba39e53979a7d459',
  'hash CGV B2C conforme au texte rendu'
);
SELECT is(
  (SELECT content_sha256 FROM public.legal_document_versions WHERE version = 'CGV-B2B-2026-08-12'),
  '5ef0c09d8c454ad72f089aad6fc332c007011830aeb972e791eff9c0e80d3702',
  'hash CGV B2B conforme au texte rendu'
);
SELECT ok(
  (SELECT content_text LIKE '%TVA non applicable - article 293 B du CGI%'
   FROM public.legal_document_versions WHERE version = 'CGV-B2C-2026-08-12'),
  'la CGV B2C conserve la franchise en base'
);
SELECT ok(
  (SELECT content_text LIKE '%CM2C — Centre de la Médiation de la Consommation%'
   FROM public.legal_document_versions WHERE version = 'CGV-B2C-2026-08-12'),
  'la CGV B2C contient CM2C'
);
SELECT ok(
  (SELECT content_text !~* 'document préparatoire|publication après validation|TVA applicable'
   FROM public.legal_document_versions WHERE version = 'CGV-B2C-2026-08-12'),
  'la CGV B2C ne contient aucun avertissement ou TVA contradictoire'
);
SELECT ok(
  (SELECT content_text !~* 'document préparatoire|publication après validation|TVA applicable'
   FROM public.legal_document_versions WHERE version = 'CGV-B2B-2026-08-12'),
  'la CGV B2B ne contient aucun avertissement ou TVA contradictoire'
);
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
  'les deux CGV et les trois formulations sont publiées localement'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
) VALUES
  ('71000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'commerce-a@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now()),
  ('71000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'commerce-b@example.test', '', '{"provider":"email","providers":["email"]}', '{}', false, now(), now());

INSERT INTO public.profiles (id, email, role) VALUES
  ('71000000-0000-0000-0000-000000000001', 'commerce-a@example.test', 'user'),
  ('71000000-0000-0000-0000-000000000002', 'commerce-b@example.test', 'user')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role;

SELECT lives_ok($$
  INSERT INTO public.commercial_checkout_intents (
    id, user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id
  ) VALUES (
    '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001',
    'formation-ia', 'B2C_STANDARD', 'personal', 'immediate', 'immediate_after_payment',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2C-2026-08-26')
  )$$,
  'contexte B2C immédiat valide'
);

SELECT lives_ok($$
  INSERT INTO public.commercial_checkout_intents (
    id, user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id
  ) VALUES (
    '72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001',
    'formation-prompt-level-1', 'B2C_STANDARD', 'personal', 'deferred', 'deferred_after_withdrawal_period',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2C-2026-08-26')
  )$$,
  'contexte B2C différé valide'
);

SELECT lives_ok($$
  INSERT INTO public.commercial_checkout_intents (
    id, user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id
  ) VALUES (
    '72000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000001',
    'formation-ia-act', 'B2B', 'professional_self', NULL, 'immediate_after_payment',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2B-2026-08-26')
  )$$,
  'contexte B2B valide'
);

SELECT lives_ok($$
  INSERT INTO public.commercial_checkout_intents (
    id, user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, beneficiary_email,
    buyer_organization_name, cgv_document_version_id
  ) VALUES (
    '72000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000001',
    'formation-beneficiaire', 'B2B', 'beneficiary', NULL, 'deferred_beneficiary_assignment',
    'beneficiaire@example.test', 'Entreprise Test',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2B-2026-08-26')
  )$$,
  'achat pour bénéficiaire valide'
);

SELECT lives_ok($$
  INSERT INTO public.commercial_checkout_intents (
    id, user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id
  ) VALUES (
    '72000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000001',
    'formation-opco', 'OF_OPCO', 'of_opco', NULL, 'of_opco_administrative',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2B-2026-08-26')
  )$$,
  'contexte OPCO valide'
);

SELECT throws_ok($$
  INSERT INTO public.commercial_checkout_intents (
    user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id
  ) VALUES (
    '71000000-0000-0000-0000-000000000001', 'formation-invalid-context',
    'B2C_STANDARD', 'intruder', 'immediate', 'immediate_after_payment',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2C-2026-08-26')
  )$$,
  '23514', NULL, 'un contexte inconnu est refusé'
);

SELECT throws_ok($$
  INSERT INTO public.commercial_checkout_intents (
    user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id
  ) VALUES (
    '71000000-0000-0000-0000-000000000001', 'formation-manipulated-type',
    'B2B', 'personal', 'immediate', 'immediate_after_payment',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2B-2026-08-26')
  )$$,
  '23514', NULL, 'un type de parcours manipulé est refusé'
);

SELECT throws_ok($$
  INSERT INTO public.commercial_checkout_intents (
    user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id
  ) VALUES (
    '71000000-0000-0000-0000-000000000001', 'formation-manipulated-activation',
    'B2C_STANDARD', 'personal', 'immediate', 'deferred_after_withdrawal_period',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2C-2026-08-26')
  )$$,
  '23514', NULL, 'une politique d activation manipulée est refusée'
);

SELECT throws_ok($$
  INSERT INTO public.commercial_checkout_intents (
    user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id
  ) VALUES (
    '71000000-0000-0000-0000-000000000001', 'formation-beneficiary-incomplete',
    'B2B', 'beneficiary', NULL, 'deferred_beneficiary_assignment',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2B-2026-08-26')
  )$$,
  '23514', NULL, 'un bénéficiaire incomplet est refusé'
);

SELECT throws_ok($$
  INSERT INTO public.commercial_checkout_intents (
    user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id
  ) VALUES (
    '71000000-0000-0000-0000-000000000001', 'formation-wrong-cgv',
    'B2C_STANDARD', 'personal', 'immediate', 'immediate_after_payment',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2B-2026-08-26')
  )$$,
  '23514', 'Le parcours B2C doit référencer les CGV B2C publiées.',
  'une mauvaise famille de CGV est refusée'
);

INSERT INTO public.legal_document_versions (
  document_type, version, status, content_text, content_sha256
) VALUES (
  'cgv_b2c', 'CGV-B2C-DRAFT-TEST', 'draft', 'Projet de test non publiable.', repeat('d', 64)
);

SELECT throws_ok($$
  INSERT INTO public.commercial_checkout_intents (
    user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id
  ) VALUES (
    '71000000-0000-0000-0000-000000000001', 'formation-draft-cgv',
    'B2C_STANDARD', 'personal', 'immediate', 'immediate_after_payment',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2C-DRAFT-TEST')
  )$$,
  '23514', 'La version CGV liée doit être publiée.',
  'une version CGV non publiée est refusée'
);

INSERT INTO public.commercial_checkout_intents (
  id, user_id, course_id, offer_classification, sales_context,
  access_start_choice, access_activation_policy, cgv_document_version_id
) VALUES (
  '72000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000002',
  'formation-ia', 'B2B', 'professional_self', NULL, 'immediate_after_payment',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2B-2026-08-26')
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
SELECT is((SELECT count(*) FROM public.commercial_checkout_intents)::bigint, 5::bigint, 'A ne lit que ses cinq parcours');
SELECT is(
  (SELECT beneficiary_email FROM public.commercial_checkout_intents WHERE sales_context = 'beneficiary'),
  'beneficiaire@example.test',
  'A lit le bénéficiaire de sa propre commande'
);

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
SELECT is((SELECT count(*) FROM public.commercial_checkout_intents)::bigint, 1::bigint, 'B ne lit que son parcours');

SELECT throws_ok($$
  INSERT INTO public.commercial_checkout_intents (
    user_id, course_id, offer_classification, sales_context,
    access_start_choice, access_activation_policy, cgv_document_version_id
  ) VALUES (
    '71000000-0000-0000-0000-000000000002', 'formation-browser-forged',
    'B2B', 'professional_self', NULL, 'immediate_after_payment',
    (SELECT id FROM public.legal_document_versions WHERE version = 'CGV-B2B-2026-08-26')
  )$$,
  '42501', 'permission denied for table commercial_checkout_intents',
  'le navigateur ne peut pas créer une intention'
);
SELECT throws_ok(
  $$UPDATE public.commercial_checkout_intents SET sales_context = 'beneficiary' WHERE true$$,
  '42501', 'permission denied for table commercial_checkout_intents',
  'le navigateur ne peut pas manipuler un parcours'
);

RESET ROLE;

INSERT INTO public.course_access (
  user_id, course_id, status, access_source
) VALUES
  ('71000000-0000-0000-0000-000000000001', 'formation-suspended-test', 'suspended', 'admin'),
  ('71000000-0000-0000-0000-000000000001', 'formation-revoked-test', 'revoked', 'admin');

INSERT INTO public.purchases (
  user_id, course_id, amount_total, currency, payment_status, purchased_at
) VALUES
  ('71000000-0000-0000-0000-000000000001', 'formation-deferred-test', 18700, 'eur', 'paid', now()),
  ('71000000-0000-0000-0000-000000000001', 'formation-suspended-test', 18700, 'eur', 'paid', now()),
  ('71000000-0000-0000-0000-000000000001', 'formation-revoked-test', 18700, 'eur', 'paid', now());

SELECT is(
  (SELECT count(*) FROM public.course_access
   WHERE user_id = '71000000-0000-0000-0000-000000000001'
     AND status = 'active')::bigint,
  0::bigint,
  'un achat seul ne crée aucun système parallèle de droits'
);
SELECT is(
  (SELECT status FROM public.course_access WHERE course_id = 'formation-suspended-test'),
  'suspended',
  'un droit suspendu n est pas réactivé par un achat'
);
SELECT is(
  (SELECT status FROM public.course_access WHERE course_id = 'formation-revoked-test'),
  'revoked',
  'un droit révoqué n est pas réactivé par un achat'
);
SELECT is(
  (SELECT count(*) FROM public.course_access WHERE user_id = '71000000-0000-0000-0000-000000000001')::bigint,
  2::bigint,
  'course_access reste l unique table de droits et ne reçoit aucun doublon'
);
SELECT throws_ok($$
  INSERT INTO public.course_access (user_id, course_id, status, access_source)
  VALUES ('71000000-0000-0000-0000-000000000001', 'formation-revoked-test', 'active', 'stripe')$$,
  '23505', NULL, 'la contrainte empêche un second droit parallèle'
);

SELECT * FROM finish();
ROLLBACK;
