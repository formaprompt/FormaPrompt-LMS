BEGIN;
SELECT plan(12);

SELECT has_table('public', 'commercial_quotes', 'La table des devis existe');
SELECT has_table('public', 'commercial_request_history', 'L historique commercial existe');
SELECT has_table('public', 'commercial_communications', 'Le journal des communications existe');
SELECT has_table('public', 'commercial_follow_ups', 'La table des relances existe');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.commercial_quotes'::regclass), 'RLS active sur les devis');
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.commercial_quotes'::regclass), 'RLS forcée sur les devis');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.commercial_communications'::regclass), 'RLS active sur les communications');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.commercial_follow_ups'::regclass), 'RLS active sur les relances');

SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'public' AND tablename = 'commercial_quotes'), 1, 'Un seul droit de lecture personnel sur les devis');
SELECT is((SELECT count(*)::integer FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'commercial_quotes' AND grantee = 'authenticated' AND privilege_type <> 'SELECT'), 0, 'Aucune mutation directe des devis par authenticated');
SELECT ok(NOT has_function_privilege('authenticated', 'private.next_commercial_quote_number()', 'EXECUTE'), 'La numérotation ne peut pas être appelée depuis le frontend');
SELECT col_is_unique('public', 'training_enrollments', 'commercial_request_id', 'Une demande ne produit qu une inscription administrative');

SELECT * FROM finish();
ROLLBACK;
