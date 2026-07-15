-- Migration à exécuter une seule fois dans l'éditeur SQL Supabase du projet FormaPrompt.
-- Elle n'altère pas les tables existantes.

CREATE TABLE IF NOT EXISTS public.course_positioning_assessments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL
    CONSTRAINT course_positioning_assessments_user_id_fkey
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  learner_name text NOT NULL CHECK (char_length(learner_name) BETWEEN 2 AND 150),
  course_id text NOT NULL CHECK (char_length(course_id) BETWEEN 2 AND 100),
  course_title text NOT NULL CHECK (char_length(course_title) BETWEEN 2 AND 250),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'array'),
  score integer NOT NULL CHECK (score >= 0),
  maximum_score integer NOT NULL CHECK (maximum_score > 0 AND score <= maximum_score),
  level text NOT NULL CHECK (char_length(level) BETWEEN 2 AND 100),
  submitted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS course_positioning_assessments_user_course_idx
  ON public.course_positioning_assessments (user_id, course_id, submitted_at DESC);

ALTER TABLE public.course_positioning_assessments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.course_positioning_assessments TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_positioning_assessments'
      AND policyname = 'Les apprenants créent leur propre positionnement'
  ) THEN
    CREATE POLICY "Les apprenants créent leur propre positionnement"
    ON public.course_positioning_assessments FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_positioning_assessments'
      AND policyname = 'Les apprenants lisent leur propre positionnement'
  ) THEN
    CREATE POLICY "Les apprenants lisent leur propre positionnement"
    ON public.course_positioning_assessments FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_positioning_assessments'
      AND policyname = 'Les administrateurs consultent les positionnements'
  ) THEN
    CREATE POLICY "Les administrateurs consultent les positionnements"
    ON public.course_positioning_assessments FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'employee')
      )
    );
  END IF;
END
$$;

COMMENT ON TABLE public.course_positioning_assessments IS
  'Positionnements nominatifs réalisés avant le début des formations. Définir et documenter une durée de conservation RGPD.';
