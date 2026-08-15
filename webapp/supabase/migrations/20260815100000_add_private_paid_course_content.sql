-- Sprint 1.1D : contenus pédagogiques payants servis uniquement après contrôle
-- serveur de course_access. Aucun droit parallèle n'est créé.

BEGIN;

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) VALUES (
  'paid-course-content',
  'paid-course-content',
  false,
  104857600,
  ARRAY[
    'application/pdf',
    'video/mp4',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Défense en profondeur : même si une policy Storage plus large est ajoutée,
-- anon et authenticated ne peuvent ni lire ni modifier ce bucket. Seule
-- l'Edge Function avec service_role génère des URL signées temporaires après
-- vérification de l'identité et du course_access.
CREATE POLICY "Blocage accès direct contenus pédagogiques payants"
ON storage.objects
AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id <> 'paid-course-content')
WITH CHECK (bucket_id <> 'paid-course-content');

COMMIT;
