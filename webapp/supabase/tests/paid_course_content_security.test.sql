BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(12);

SELECT ok(
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'paid-course-content' AND public = false),
  'Le bucket des contenus payants est privé'
);

SELECT is(
  (SELECT file_size_limit FROM storage.buckets WHERE id = 'paid-course-content'),
  10485760::bigint,
  'La limite couvre les documents privés sans inclure les gros médias IONOS'
);

SELECT ok(
  (SELECT allowed_mime_types = ARRAY[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[]
   FROM storage.buckets WHERE id = 'paid-course-content'),
  'Seuls PDF et DOCX sont prévus dans le bucket'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Blocage accès direct contenus pédagogiques payants'
      AND permissive = 'RESTRICTIVE'
  ),
  'Une policy restrictive protège le bucket même face à une policy plus large'
);

SELECT ok(
  (SELECT coalesce(qual, '') LIKE '%paid-course-content%'
     AND coalesce(with_check, '') LIKE '%paid-course-content%'
   FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname = 'Blocage accès direct contenus pédagogiques payants'),
  'La lecture et l écriture directes du bucket sont exclues'
);

SELECT is(
  (SELECT count(*) FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('paid_course_access','content_entitlements','course_content_rights'))::bigint,
  0::bigint,
  'Aucune seconde table de droits pédagogiques n est créée'
);

SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'course_access'),
  'course_access reste la source de droits existante'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.course_access'::regclass
      AND conname = 'course_access_status_check'
      AND pg_get_constraintdef(oid) LIKE '%suspended%'
      AND pg_get_constraintdef(oid) LIKE '%revoked%'
      AND pg_get_constraintdef(oid) LIKE '%refunded%'
      AND pg_get_constraintdef(oid) LIKE '%expired%'
  ),
  'Tous les statuts de refus existants restent portés par course_access'
);

SELECT is(
  col_description('public.course_access'::regclass, (
    SELECT ordinal_position FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'course_access' AND column_name = 'expires_at'
  )),
  'NULL signifie absence d échéance prédéfinie, jamais absence de contrôle du statut.',
  'La sémantique de expires_at NULL reste explicite'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND permissive = 'PERMISSIVE'
      AND roles && ARRAY['anon'::name, 'authenticated'::name]
      AND coalesce(qual, '') ~ $$bucket_id\s*=\s*'paid-course-content'$$
  ),
  'Aucune policy permissive ne donne un accès direct au bucket'
);

SELECT ok(
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'disciplinary-evidence' AND public = false),
  'Le lot ne fragilise pas le bucket disciplinaire privé'
);

SELECT ok(
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'blog-images'),
  'Le bucket public du blog reste indépendant'
);

SELECT * FROM finish();
ROLLBACK;
