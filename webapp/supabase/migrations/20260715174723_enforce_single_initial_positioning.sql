-- Le positionnement Qualiopi doit représenter le niveau initial, avant l'accès
-- au contenu. Les répétitions historiques sont conservées pour ne perdre
-- aucune donnée, mais seule la première devient la preuve initiale active.

ALTER TABLE public.course_positioning_assessments
  ADD COLUMN is_initial boolean NOT NULL DEFAULT true;

WITH ranked_attempts AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, course_id
      ORDER BY submitted_at, id
    ) AS attempt_number
  FROM public.course_positioning_assessments
)
UPDATE public.course_positioning_assessments AS assessment
SET is_initial = (ranked_attempts.attempt_number = 1)
FROM ranked_attempts
WHERE ranked_attempts.id = assessment.id;

CREATE UNIQUE INDEX course_positioning_one_initial_per_course_idx
  ON public.course_positioning_assessments (user_id, course_id)
  WHERE is_initial IS TRUE;

DROP POLICY IF EXISTS "Les apprenants créent leur positionnement"
  ON public.course_positioning_assessments;

CREATE POLICY "Les apprenants créent leur positionnement initial"
ON public.course_positioning_assessments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND is_initial IS TRUE
);

COMMENT ON COLUMN public.course_positioning_assessments.is_initial IS
  'Vrai uniquement pour le premier positionnement du compte et de la formation. Les répétitions historiques restent conservées mais ne remplacent pas la preuve initiale.';
