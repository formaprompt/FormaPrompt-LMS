-- Indexe les relations utilisées pour relier les dossiers aux droits, aux
-- réservations et aux acteurs administratifs.

BEGIN;

CREATE INDEX training_enrollments_course_access_idx
  ON public.training_enrollments (course_access_id)
  WHERE course_access_id IS NOT NULL;

CREATE INDEX training_enrollments_booking_request_idx
  ON public.training_enrollments (booking_request_id)
  WHERE booking_request_id IS NOT NULL;

CREATE INDEX training_enrollments_created_by_idx
  ON public.training_enrollments (created_by);

CREATE INDEX training_documents_generated_by_idx
  ON public.training_documents (generated_by)
  WHERE generated_by IS NOT NULL;

COMMIT;
