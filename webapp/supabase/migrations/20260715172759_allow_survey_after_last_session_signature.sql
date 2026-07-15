-- Le déclencheur métier est la signature de la dernière séance. La date de fin
-- peut être future dans un jeu de test ou après une ouverture anticipée de
-- l'émargement par le formateur ; elle reste néanmoins imposée par la réservation.

DROP POLICY IF EXISTS "Soumission authentifiée d'un questionnaire"
  ON public.satisfaction_surveys;

CREATE POLICY "Soumission authentifiée d'un questionnaire"
ON public.satisfaction_surveys
FOR INSERT
TO authenticated
WITH CHECK (
  char_length(btrim(student_name)) BETWEEN 2 AND 200
  AND char_length(btrim(student_email)) BETWEEN 3 AND 320
  AND student_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  AND char_length(btrim(course_name)) BETWEEN 2 AND 250
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
      AND training_date <= CURRENT_DATE
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
