-- Sécurise les fonctions privilégiées et remplace les politiques RLS historiques
-- trop larges. Les formulaires publics restent utilisables, mais uniquement avec
-- des données bornées et des valeurs cohérentes.

-- ---------------------------------------------------------------------------
-- Fonctions privilégiées
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'user');
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'employee')
  );
$$;

REVOKE ALL ON FUNCTION private.is_admin()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- Contraintes de cohérence des formulaires publics
-- ---------------------------------------------------------------------------

ALTER TABLE public.calendar_bookings
  ADD CONSTRAINT calendar_bookings_slot_check
    CHECK (slot IN ('Matin', 'Après-midi', 'Journée')),
  ADD CONSTRAINT calendar_bookings_type_check
    CHECK (type IN ('option', 'confirmé')),
  ADD CONSTRAINT calendar_bookings_of_name_length_check
    CHECK (char_length(btrim(of_name)) BETWEEN 2 AND 150),
  ADD CONSTRAINT calendar_bookings_comments_length_check
    CHECK (char_length(COALESCE(comments, '')) <= 2000);

ALTER TABLE public.contact_requests
  ADD CONSTRAINT contact_requests_name_length_check
    CHECK (char_length(btrim(name)) BETWEEN 2 AND 150),
  ADD CONSTRAINT contact_requests_email_format_check
    CHECK (
      char_length(btrim(email)) BETWEEN 3 AND 320
      AND email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ),
  ADD CONSTRAINT contact_requests_subject_length_check
    CHECK (char_length(btrim(subject)) BETWEEN 2 AND 200),
  ADD CONSTRAINT contact_requests_message_length_check
    CHECK (char_length(btrim(message)) BETWEEN 10 AND 5000);

ALTER TABLE public.satisfaction_surveys
  ADD CONSTRAINT satisfaction_surveys_student_name_length_check
    CHECK (char_length(btrim(student_name)) BETWEEN 2 AND 200),
  ADD CONSTRAINT satisfaction_surveys_student_email_format_check
    CHECK (
      char_length(btrim(student_email)) BETWEEN 3 AND 320
      AND student_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ),
  ADD CONSTRAINT satisfaction_surveys_course_name_length_check
    CHECK (char_length(btrim(course_name)) BETWEEN 2 AND 250),
  ADD CONSTRAINT satisfaction_surveys_public_testimonial_length_check
    CHECK (char_length(COALESCE(public_testimonial, '')) <= 5000),
  ADD CONSTRAINT satisfaction_surveys_private_feedback_length_check
    CHECK (char_length(COALESCE(private_feedback, '')) <= 5000);

-- ---------------------------------------------------------------------------
-- Profils : une seule politique de lecture, réservée aux comptes connectés
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Lecture de son propre profil" ON public.profiles;
DROP POLICY IF EXISTS "Lecture totale pour admin" ON public.profiles;
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir leur propre profil" ON public.profiles;
DROP POLICY IF EXISTS "Les administrateurs peuvent tout voir" ON public.profiles;

CREATE POLICY "Lecture des profils selon le rôle"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT private.is_admin())
);

REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Les anciennes politiques ont été remplacées : la fonction exposée n'est plus
-- nécessaire et ne doit plus être accessible comme RPC publique.
DROP FUNCTION IF EXISTS public.is_admin();

-- ---------------------------------------------------------------------------
-- Calendrier historique des organismes de formation
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Seuls les admins peuvent supprimer" ON public.calendar_bookings;
DROP POLICY IF EXISTS "Tout le monde peut ajouter une reservation" ON public.calendar_bookings;
DROP POLICY IF EXISTS "Tout le monde peut lire les reservations" ON public.calendar_bookings;
DROP POLICY IF EXISTS "Seuls les admins peuvent modifier" ON public.calendar_bookings;

CREATE POLICY "Lecture publique du calendrier"
ON public.calendar_bookings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Les visiteurs demandent une option"
ON public.calendar_bookings
FOR INSERT
TO anon
WITH CHECK (
  date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 730)
  AND slot IN ('Matin', 'Après-midi', 'Journée')
  AND type = 'option'
  AND char_length(btrim(of_name)) BETWEEN 2 AND 150
  AND char_length(COALESCE(comments, '')) <= 2000
  AND created_at BETWEEN (now() - INTERVAL '5 minutes') AND (now() + INTERVAL '5 minutes')
);

CREATE POLICY "Les comptes connectés ajoutent une réservation autorisée"
ON public.calendar_bookings
FOR INSERT
TO authenticated
WITH CHECK (
  date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 730)
  AND slot IN ('Matin', 'Après-midi', 'Journée')
  AND (type = 'option' OR (SELECT private.is_admin()))
  AND char_length(btrim(of_name)) BETWEEN 2 AND 150
  AND char_length(COALESCE(comments, '')) <= 2000
  AND created_at BETWEEN (now() - INTERVAL '5 minutes') AND (now() + INTERVAL '5 minutes')
);

CREATE POLICY "Le personnel modifie le calendrier"
ON public.calendar_bookings
FOR UPDATE
TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY "Le personnel supprime dans le calendrier"
ON public.calendar_bookings
FOR DELETE
TO authenticated
USING ((SELECT private.is_admin()));

REVOKE ALL ON public.calendar_bookings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.calendar_bookings TO anon, authenticated;
GRANT UPDATE, DELETE ON public.calendar_bookings TO authenticated;
GRANT ALL ON public.calendar_bookings TO service_role;

-- ---------------------------------------------------------------------------
-- Demandes de contact
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Les administrateurs peuvent tout voir et modifier" ON public.contact_requests;
DROP POLICY IF EXISTS "Tout le monde peut insérer une demande de contact" ON public.contact_requests;

CREATE POLICY "Soumission publique d'une demande de contact"
ON public.contact_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(btrim(name)) BETWEEN 2 AND 150
  AND char_length(btrim(email)) BETWEEN 3 AND 320
  AND email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  AND char_length(btrim(subject)) BETWEEN 2 AND 200
  AND char_length(btrim(message)) BETWEEN 10 AND 5000
  AND status = 'pending'
  AND created_at BETWEEN (now() - INTERVAL '5 minutes') AND (now() + INTERVAL '5 minutes')
);

CREATE POLICY "Le personnel consulte les demandes de contact"
ON public.contact_requests
FOR SELECT
TO authenticated
USING ((SELECT private.is_admin()));

CREATE POLICY "Le personnel modifie les demandes de contact"
ON public.contact_requests
FOR UPDATE
TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY "Le personnel supprime les demandes de contact"
ON public.contact_requests
FOR DELETE
TO authenticated
USING ((SELECT private.is_admin()));

REVOKE ALL ON public.contact_requests FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.contact_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_requests TO authenticated;
GRANT ALL ON public.contact_requests TO service_role;

-- ---------------------------------------------------------------------------
-- Questionnaires de satisfaction
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Les administrateurs gèrent les avis" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Tout le monde peut soumettre un questionnaire" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Lecture des avis publiés par tous" ON public.satisfaction_surveys;

CREATE POLICY "Soumission publique d'un questionnaire"
ON public.satisfaction_surveys
FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(btrim(student_name)) BETWEEN 2 AND 200
  AND char_length(btrim(student_email)) BETWEEN 3 AND 320
  AND student_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  AND char_length(btrim(course_name)) BETWEEN 2 AND 250
  AND training_date <= CURRENT_DATE
  AND rating_overall BETWEEN 1 AND 5
  AND rating_pedagogy BETWEEN 1 AND 5
  AND rating_objectives BETWEEN 1 AND 5
  AND rating_logistics BETWEEN 1 AND 5
  AND char_length(COALESCE(public_testimonial, '')) <= 5000
  AND char_length(COALESCE(private_feedback, '')) <= 5000
  AND is_published IS FALSE
  AND created_at BETWEEN (now() - INTERVAL '5 minutes') AND (now() + INTERVAL '5 minutes')
);

CREATE POLICY "Lecture anonyme des avis publiés"
ON public.satisfaction_surveys
FOR SELECT
TO anon
USING (is_published IS TRUE AND consent_marketing IS TRUE);

CREATE POLICY "Lecture des avis selon le rôle"
ON public.satisfaction_surveys
FOR SELECT
TO authenticated
USING (
  (is_published IS TRUE AND consent_marketing IS TRUE)
  OR (SELECT private.is_admin())
);

CREATE POLICY "Le personnel modifie les questionnaires"
ON public.satisfaction_surveys
FOR UPDATE
TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY "Le personnel supprime les questionnaires"
ON public.satisfaction_surveys
FOR DELETE
TO authenticated
USING ((SELECT private.is_admin()));

REVOKE ALL ON public.satisfaction_surveys FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.satisfaction_surveys TO anon, authenticated;
GRANT UPDATE, DELETE ON public.satisfaction_surveys TO authenticated;
GRANT ALL ON public.satisfaction_surveys TO service_role;

-- ---------------------------------------------------------------------------
-- Positionnements préalables nominatifs
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Les apprenants créent leur propre positionnement"
  ON public.course_positioning_assessments;
DROP POLICY IF EXISTS "Les administrateurs consultent les positionnements"
  ON public.course_positioning_assessments;
DROP POLICY IF EXISTS "Les apprenants lisent leur propre positionnement"
  ON public.course_positioning_assessments;

CREATE POLICY "Les apprenants créent leur positionnement"
ON public.course_positioning_assessments
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Lecture des positionnements selon le rôle"
ON public.course_positioning_assessments
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.is_admin())
);

REVOKE ALL ON public.course_positioning_assessments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.course_positioning_assessments TO authenticated;
GRANT ALL ON public.course_positioning_assessments TO service_role;

COMMENT ON FUNCTION private.is_admin() IS
  'Vérifie le rôle du compte courant pour les politiques RLS sans exposer une RPC publique.';
