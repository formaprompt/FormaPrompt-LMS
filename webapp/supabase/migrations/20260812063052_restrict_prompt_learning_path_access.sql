-- Le slug pédagogique introduction-prompt-engineering appartient au produit
-- formation-prompt-level-1. course_access reste l'unique source de droit.
DROP POLICY IF EXISTS "Learners create their own accessible lesson progress"
ON public.course_lesson_progress;

CREATE POLICY "Learners create their own accessible lesson progress"
ON public.course_lesson_progress
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM public.course_access
    WHERE course_access.user_id = (SELECT auth.uid())
      AND course_access.course_id = CASE course_lesson_progress.course_id
        WHEN 'introduction-prompt-engineering' THEN 'formation-prompt-level-1'
        ELSE course_lesson_progress.course_id
      END
      AND course_access.status = 'active'
      AND (course_access.expires_at IS NULL OR course_access.expires_at > now())
  )
);

DROP POLICY IF EXISTS "Learners update their own accessible lesson progress"
ON public.course_lesson_progress;

CREATE POLICY "Learners update their own accessible lesson progress"
ON public.course_lesson_progress
FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM public.course_access
    WHERE course_access.user_id = (SELECT auth.uid())
      AND course_access.course_id = CASE course_lesson_progress.course_id
        WHEN 'introduction-prompt-engineering' THEN 'formation-prompt-level-1'
        ELSE course_lesson_progress.course_id
      END
      AND course_access.status = 'active'
      AND (course_access.expires_at IS NULL OR course_access.expires_at > now())
  )
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM public.course_access
    WHERE course_access.user_id = (SELECT auth.uid())
      AND course_access.course_id = CASE course_lesson_progress.course_id
        WHEN 'introduction-prompt-engineering' THEN 'formation-prompt-level-1'
        ELSE course_lesson_progress.course_id
      END
      AND course_access.status = 'active'
      AND (course_access.expires_at IS NULL OR course_access.expires_at > now())
  )
);
