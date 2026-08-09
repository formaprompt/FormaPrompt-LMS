CREATE TABLE public.course_lesson_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL CHECK (char_length(btrim(course_id)) BETWEEN 2 AND 100),
  lesson_id text NOT NULL CHECK (char_length(btrim(lesson_id)) BETWEEN 2 AND 100),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  progress_percent smallint NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (user_id, course_id, lesson_id),
  CONSTRAINT course_lesson_progress_completion_check CHECK (
    (status = 'completed' AND progress_percent = 100 AND completed_at IS NOT NULL)
    OR (status = 'in_progress' AND progress_percent < 100 AND completed_at IS NULL)
  )
);
COMMENT ON TABLE public.course_lesson_progress IS
  'Dernier état de consultation de chaque module. Source de vérité de la reprise du parcours apprenant.';
COMMENT ON COLUMN public.course_lesson_progress.last_viewed_at IS
  'Horodatage utilisé pour reprendre le module consulté le plus récemment.';

CREATE INDEX course_lesson_progress_resume_idx
  ON public.course_lesson_progress (user_id, course_id, last_viewed_at DESC);

ALTER TABLE public.course_lesson_progress ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.course_lesson_progress TO authenticated;

CREATE POLICY "Learners read their own lesson progress"
ON public.course_lesson_progress
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Learners create their own accessible lesson progress"
ON public.course_lesson_progress
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (
    course_id = 'introduction-prompt-engineering'
    OR EXISTS (
      SELECT 1
      FROM public.purchases
      WHERE purchases.user_id = (SELECT auth.uid())
        AND purchases.course_id = course_lesson_progress.course_id
    )
  )
);

CREATE POLICY "Learners update their own accessible lesson progress"
ON public.course_lesson_progress
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (
    course_id = 'introduction-prompt-engineering'
    OR EXISTS (
      SELECT 1
      FROM public.purchases
      WHERE purchases.user_id = (SELECT auth.uid())
        AND purchases.course_id = course_lesson_progress.course_id
    )
  )
);
