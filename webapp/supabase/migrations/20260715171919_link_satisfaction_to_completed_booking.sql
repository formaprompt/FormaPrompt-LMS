-- Relie le questionnaire Qualiopi à l'apprenant et à sa réservation.
-- Les anciennes soumissions publiques restent possibles, mais une réponse
-- déclenchée depuis l'espace apprenant n'est acceptée qu'après la signature
-- de la dernière séance réservée.

ALTER TABLE public.satisfaction_surveys
  ADD COLUMN user_id uuid
    CONSTRAINT satisfaction_surveys_user_fkey
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN booking_request_id uuid
    CONSTRAINT satisfaction_surveys_booking_fkey
    REFERENCES public.course_booking_requests(id) ON DELETE SET NULL,
  ADD COLUMN course_id text
    CONSTRAINT satisfaction_surveys_course_id_check
    CHECK (course_id IS NULL OR char_length(course_id) BETWEEN 2 AND 100),
  ADD COLUMN submission_source text NOT NULL DEFAULT 'public'
    CONSTRAINT satisfaction_surveys_submission_source_check
    CHECK (submission_source IN ('public', 'learner_dashboard'));

CREATE UNIQUE INDEX satisfaction_surveys_booking_unique_idx
  ON public.satisfaction_surveys (booking_request_id)
  WHERE booking_request_id IS NOT NULL;

CREATE INDEX satisfaction_surveys_user_created_idx
  ON public.satisfaction_surveys (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "Soumission publique d'un questionnaire"
  ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Lecture anonyme des avis publiés"
  ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Lecture des avis selon le rôle"
  ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Le personnel modifie les questionnaires"
  ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Le personnel supprime les questionnaires"
  ON public.satisfaction_surveys;

CREATE POLICY "Soumission publique non liée d'un questionnaire"
ON public.satisfaction_surveys
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND booking_request_id IS NULL
  AND course_id IS NULL
  AND submission_source = 'public'
  AND char_length(btrim(student_name)) BETWEEN 2 AND 200
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

CREATE POLICY "Soumission authentifiée d'un questionnaire"
ON public.satisfaction_surveys
FOR INSERT
TO authenticated
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
  AND (
    (
      user_id IS NULL
      AND booking_request_id IS NULL
      AND course_id IS NULL
      AND submission_source = 'public'
    )
    OR (
      user_id = (SELECT auth.uid())
      AND booking_request_id IS NOT NULL
      AND course_id IS NOT NULL
      AND submission_source = 'learner_dashboard'
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS learner_profile
        WHERE learner_profile.id = (SELECT auth.uid())
          AND lower(btrim(learner_profile.email)) = lower(btrim(student_email))
      )
      AND EXISTS (
        SELECT 1
        FROM public.course_booking_requests AS booking
        WHERE booking.id = satisfaction_surveys.booking_request_id
          AND booking.user_id = (SELECT auth.uid())
          AND booking.course_id = satisfaction_surveys.course_id
          AND booking.status IN ('confirmed', 'completed')
          AND training_date = (
            SELECT (max(reserved_session.ends_at) AT TIME ZONE 'Europe/Paris')::date
            FROM public.course_session_bookings AS reserved_session
            WHERE reserved_session.booking_request_id = booking.id
              AND reserved_session.status IN ('confirmed', 'completed')
          )
          AND EXISTS (
            SELECT 1
            FROM public.course_session_attendance AS attendance
            WHERE attendance.booking_request_id = booking.id
              AND attendance.user_id = (SELECT auth.uid())
              AND attendance.learner_signature_sha256 IS NOT NULL
              AND attendance.session_ends_at = (
                SELECT max(last_reserved_session.ends_at)
                FROM public.course_session_bookings AS last_reserved_session
                WHERE last_reserved_session.booking_request_id = booking.id
                  AND last_reserved_session.status IN ('confirmed', 'completed')
              )
          )
      )
    )
  )
);

CREATE POLICY "Lecture anonyme des avis publiés"
ON public.satisfaction_surveys
FOR SELECT
TO anon
USING (is_published IS TRUE AND consent_marketing IS TRUE);

CREATE POLICY "Lecture des questionnaires selon le rôle"
ON public.satisfaction_surveys
FOR SELECT
TO authenticated
USING (
  (is_published IS TRUE AND consent_marketing IS TRUE)
  OR user_id = (SELECT auth.uid())
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

COMMENT ON COLUMN public.satisfaction_surveys.user_id IS
  'Compte apprenant associé au questionnaire nominatif. Donnée limitée au suivi qualité et pédagogique.';
COMMENT ON COLUMN public.satisfaction_surveys.booking_request_id IS
  'Réservation dont la dernière séance signée a déclenché le questionnaire Qualiopi.';
COMMENT ON COLUMN public.satisfaction_surveys.submission_source IS
  'Origine de la réponse : formulaire public ou espace apprenant après fin de formation.';
COMMENT ON TABLE public.satisfaction_surveys IS
  'Questionnaires de satisfaction Qualiopi et avis. Définir une durée de conservation RGPD documentée ; la publication reste soumise à un consentement distinct.';
