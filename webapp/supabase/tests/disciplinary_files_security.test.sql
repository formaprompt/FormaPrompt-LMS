BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(26);

SELECT has_table('public', 'disciplinary_files', 'La table de métadonnées existe');
SELECT has_column('public', 'disciplinary_files', 'incident_id', 'Chaque pièce dépend d un incident');
SELECT has_column('public', 'disciplinary_files', 'hearing_id', 'Une pièce peut dépendre d une audition');
SELECT has_column('public', 'disciplinary_files', 'object_path', 'Le chemin Storage interne est conservé');
SELECT has_column('public', 'disciplinary_files', 'sha256_hex', 'L empreinte d intégrité est conservée');
SELECT hasnt_column('public', 'disciplinary_files', 'public_url', 'Aucune URL publique n est stockée');
SELECT hasnt_column('public', 'disciplinary_files', 'signed_url', 'Aucune URL signée n est persistée');
SELECT col_is_fk('public', 'disciplinary_files', 'incident_id', 'La pièce référence un incident existant');
SELECT col_is_fk('public', 'disciplinary_files', 'hearing_id', 'La pièce référence une audition existante');

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.disciplinary_files'::regclass),
  'RLS est activée et forcée sur les métadonnées'
);
SELECT ok(NOT has_table_privilege('anon', 'public.disciplinary_files', 'SELECT'), 'Anon ne peut pas lire les métadonnées');
SELECT ok(NOT has_table_privilege('authenticated', 'public.disciplinary_files', 'SELECT'), 'Authenticated ne peut pas lire directement les métadonnées');
SELECT ok(NOT has_table_privilege('authenticated', 'public.disciplinary_files', 'INSERT'), 'Authenticated ne peut pas déposer directement une métadonnée');
SELECT ok(NOT has_table_privilege('service_role', 'public.disciplinary_files', 'UPDATE'), 'Les métadonnées ne sont pas modifiables par la service role');
SELECT ok(NOT has_table_privilege('service_role', 'public.disciplinary_files', 'DELETE'), 'Les métadonnées ne sont pas supprimables par la service role');

SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'disciplinary-evidence'),
  false,
  'Le bucket disciplinaire est privé'
);
SELECT is(
  (SELECT file_size_limit FROM storage.buckets WHERE id = 'disciplinary-evidence'),
  10485760::bigint,
  'Le bucket limite les fichiers à dix mégaoctets'
);
SELECT ok(
  (SELECT allowed_mime_types <@ ARRAY['application/pdf','image/jpeg','image/png','image/webp','text/plain']::text[]
   FROM storage.buckets WHERE id = 'disciplinary-evidence'),
  'Le bucket refuse les formats actifs ou exécutables'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Blocage accès direct pièces disciplinaires'
      AND permissive = 'RESTRICTIVE'
      AND roles @> ARRAY['anon','authenticated']::name[]
  ),
  'Une policy restrictive bloque les accès directs au bucket'
);
SELECT has_trigger('public', 'disciplinary_files', 'disciplinary_files_reject_update', 'Les mises à jour sont bloquées');
SELECT has_trigger('public', 'disciplinary_files', 'disciplinary_files_reject_delete', 'Les suppressions sont bloquées');
SELECT has_function(
  'public', 'register_disciplinary_file',
  ARRAY['uuid','uuid','uuid','uuid','text','text','text','bigint','text','text'],
  'L enregistrement atomique serveur existe'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.register_disciplinary_file(uuid,uuid,uuid,uuid,text,text,text,bigint,text,text)', 'EXECUTE'),
  'Anon ne peut pas enregistrer une pièce'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.register_disciplinary_file(uuid,uuid,uuid,uuid,text,text,text,bigint,text,text)', 'EXECUTE'),
  'Authenticated ne peut pas appeler l enregistrement serveur'
);
SELECT ok(
  has_function_privilege('service_role', 'public.register_disciplinary_file(uuid,uuid,uuid,uuid,text,text,text,bigint,text,text)', 'EXECUTE'),
  'Seule la service role peut enregistrer la pièce et son audit'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'disciplinary_files'
      AND column_name IN ('course_access_id', 'access_status', 'learner_can_access')
  ),
  'Aucun système parallèle de droits pédagogiques n est créé'
);

SELECT * FROM finish();
ROLLBACK;
