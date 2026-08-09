-- RLS protège les lignes, mais les rôles exposés ne doivent conserver que les
-- opérations nécessaires au parcours apprenant. TRUNCATE contourne RLS.
REVOKE ALL PRIVILEGES ON TABLE public.course_lesson_progress FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.course_lesson_progress
TO authenticated;
