-- Sprint 1.1B : pièces disciplinaires privées.
-- Le bucket ne possède aucun accès client direct. Toute consultation passe par
-- une Edge Function qui vérifie le rôle admin et journalise l URL signée.

BEGIN;

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) VALUES (
  'disciplinary-evidence',
  'disciplinary-evidence',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE public.disciplinary_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.disciplinary_incidents(id) ON DELETE RESTRICT,
  hearing_id uuid
    REFERENCES public.disciplinary_hearings(id) ON DELETE RESTRICT,
  bucket_id text NOT NULL DEFAULT 'disciplinary-evidence',
  object_path text NOT NULL UNIQUE,
  original_file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  sha256_hex text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disciplinary_files_bucket_check
    CHECK (bucket_id = 'disciplinary-evidence'),
  CONSTRAINT disciplinary_files_path_check
    CHECK (
      object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.][a-z0-9]{2,5}$'
      AND object_path LIKE incident_id::text || '/%'
    ),
  CONSTRAINT disciplinary_files_name_check
    CHECK (
      char_length(btrim(original_file_name)) BETWEEN 1 AND 180
      AND original_file_name !~ '[\\/\x00-\x1F\x7F]'
    ),
  CONSTRAINT disciplinary_files_mime_check
    CHECK (mime_type IN (
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'
    )),
  CONSTRAINT disciplinary_files_size_check
    CHECK (size_bytes BETWEEN 1 AND 10485760),
  CONSTRAINT disciplinary_files_hash_check
    CHECK (sha256_hex ~ '^[0-9a-f]{64}$')
);

CREATE INDEX disciplinary_files_incident_created_idx
  ON public.disciplinary_files (incident_id, created_at DESC);
CREATE INDEX disciplinary_files_hearing_created_idx
  ON public.disciplinary_files (hearing_id, created_at DESC)
  WHERE hearing_id IS NOT NULL;
CREATE INDEX disciplinary_files_created_by_idx
  ON public.disciplinary_files (created_by, created_at DESC);

COMMENT ON TABLE public.disciplinary_files IS
  'Métadonnées immuables des pièces disciplinaires. Aucun contenu ni URL permanente n est stocké dans cette table.';
COMMENT ON COLUMN public.disciplinary_files.object_path IS
  'Chemin interne opaque du bucket privé. Il ne constitue pas une URL de consultation.';
COMMENT ON COLUMN public.disciplinary_files.sha256_hex IS
  'Empreinte d intégrité calculée côté serveur avant le dépôt Storage.';

ALTER TABLE public.disciplinary_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_files FORCE ROW LEVEL SECURITY;

-- Défense en profondeur : la table n est pas accordée aux rôles Data API.
-- Cette policy resterait restrictive même si un GRANT était ajouté par erreur.
CREATE POLICY "Métadonnées disciplinaires réservées aux admins"
ON public.disciplinary_files
AS RESTRICTIVE
FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

REVOKE ALL ON public.disciplinary_files FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.disciplinary_files TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.disciplinary_files FROM service_role;

-- Une policy restrictive empêche tout accès direct au bucket depuis une clé
-- publique ou un JWT utilisateur, y compris si une autre policy Storage est
-- plus large. La service_role de l Edge Function n est pas ciblée.
CREATE POLICY "Blocage accès direct pièces disciplinaires"
ON storage.objects
AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id <> 'disciplinary-evidence')
WITH CHECK (bucket_id <> 'disciplinary-evidence');

CREATE OR REPLACE FUNCTION private.reject_disciplinary_file_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Les métadonnées des pièces disciplinaires sont immuables.'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION private.reject_disciplinary_file_mutation()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER disciplinary_files_reject_update
BEFORE UPDATE ON public.disciplinary_files
FOR EACH ROW EXECUTE FUNCTION private.reject_disciplinary_file_mutation();

CREATE TRIGGER disciplinary_files_reject_delete
BEFORE DELETE ON public.disciplinary_files
FOR EACH ROW EXECUTE FUNCTION private.reject_disciplinary_file_mutation();

CREATE OR REPLACE FUNCTION public.register_disciplinary_file(
  p_actor_user_id uuid,
  p_file_id uuid,
  p_incident_id uuid,
  p_hearing_id uuid,
  p_object_path text,
  p_original_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_sha256_hex text,
  p_reason text
)
RETURNS public.disciplinary_files
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_incident public.disciplinary_incidents%ROWTYPE;
  v_result public.disciplinary_files%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Un motif administratif de 10 à 2000 caractères est requis.';
  END IF;

  SELECT * INTO v_incident
  FROM public.disciplinary_incidents
  WHERE id = p_incident_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF p_hearing_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.disciplinary_hearings
    WHERE id = p_hearing_id AND incident_id = p_incident_id
  ) THEN
    RAISE EXCEPTION 'Audition incompatible avec l incident.';
  END IF;

  INSERT INTO public.disciplinary_files (
    id, incident_id, hearing_id, bucket_id, object_path,
    original_file_name, mime_type, size_bytes, sha256_hex, created_by
  ) VALUES (
    p_file_id, p_incident_id, p_hearing_id, 'disciplinary-evidence', p_object_path,
    btrim(p_original_file_name), p_mime_type, p_size_bytes, p_sha256_hex, p_actor_user_id
  ) RETURNING * INTO v_result;

  INSERT INTO public.audit_log (
    actor_user_id, action_type, target_type, target_id,
    target_user_id, course_id, reason, metadata
  ) VALUES (
    p_actor_user_id,
    'disciplinary_file_uploaded',
    'disciplinary_file',
    p_file_id::text,
    v_incident.learner_user_id,
    v_incident.course_id,
    btrim(p_reason),
    jsonb_build_object(
      'incident_id', p_incident_id,
      'hearing_id', p_hearing_id,
      'mime_type', p_mime_type,
      'size_bytes', p_size_bytes
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.register_disciplinary_file(
  uuid, uuid, uuid, uuid, text, text, text, bigint, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_disciplinary_file(
  uuid, uuid, uuid, uuid, text, text, text, bigint, text, text
) TO service_role;

COMMIT;
