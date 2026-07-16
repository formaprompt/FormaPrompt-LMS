-- Chaque évaluation est liée à la version exacte remise par l'apprenant.
-- Une rectification crée une nouvelle ligne afin de préserver les preuves.
CREATE TABLE public.course_final_project_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id bigint NOT NULL REFERENCES public.course_final_project_submissions(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  need_and_audience_level text NOT NULL,
  prompt_and_success_criteria_level text NOT NULL,
  checks_and_risks_level text NOT NULL,
  choices_and_limits_level text NOT NULL,
  appreciation text NOT NULL,
  improvement_areas text NOT NULL,
  review_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_final_project_reviews_need_level_check
    CHECK (need_and_audience_level IN ('not_acquired', 'developing', 'acquired', 'mastered')),
  CONSTRAINT course_final_project_reviews_prompt_level_check
    CHECK (prompt_and_success_criteria_level IN ('not_acquired', 'developing', 'acquired', 'mastered')),
  CONSTRAINT course_final_project_reviews_checks_level_check
    CHECK (checks_and_risks_level IN ('not_acquired', 'developing', 'acquired', 'mastered')),
  CONSTRAINT course_final_project_reviews_choices_level_check
    CHECK (choices_and_limits_level IN ('not_acquired', 'developing', 'acquired', 'mastered')),
  CONSTRAINT course_final_project_reviews_appreciation_check
    CHECK (char_length(btrim(appreciation)) BETWEEN 1 AND 10000),
  CONSTRAINT course_final_project_reviews_improvement_areas_check
    CHECK (char_length(btrim(improvement_areas)) BETWEEN 1 AND 10000),
  CONSTRAINT course_final_project_reviews_status_check
    CHECK (review_status IN ('needs_revision', 'validated')),
  CONSTRAINT course_final_project_reviews_status_matches_levels_check
    CHECK (
      (
        review_status = 'validated'
        AND need_and_audience_level IN ('acquired', 'mastered')
        AND prompt_and_success_criteria_level IN ('acquired', 'mastered')
        AND checks_and_risks_level IN ('acquired', 'mastered')
        AND choices_and_limits_level IN ('acquired', 'mastered')
      )
      OR (
        review_status = 'needs_revision'
        AND NOT (
          need_and_audience_level IN ('acquired', 'mastered')
          AND prompt_and_success_criteria_level IN ('acquired', 'mastered')
          AND checks_and_risks_level IN ('acquired', 'mastered')
          AND choices_and_limits_level IN ('acquired', 'mastered')
        )
      )
    )
);

COMMENT ON TABLE public.course_final_project_reviews IS
  'Historique immuable des évaluations du cas pratique final.';
COMMENT ON COLUMN public.course_final_project_reviews.review_status IS
  'validated lorsque les quatre critères atteignent au minimum acquired ; needs_revision dans les autres cas.';

CREATE INDEX course_final_project_reviews_submission_history_idx
  ON public.course_final_project_reviews (submission_id, created_at DESC, id DESC);
CREATE INDEX course_final_project_reviews_reviewer_idx
  ON public.course_final_project_reviews (reviewer_id);

ALTER TABLE public.course_final_project_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_final_project_reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY "L'apprenant consulte son évaluation et le personnel assure le suivi"
ON public.course_final_project_reviews
FOR SELECT
TO authenticated
USING (
  (SELECT private.is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.course_final_project_submissions
    WHERE course_final_project_submissions.id = course_final_project_reviews.submission_id
      AND course_final_project_submissions.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Le personnel évalue une remise finale terminée"
ON public.course_final_project_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT private.is_admin())
  AND reviewer_id = (SELECT auth.uid())
  AND created_at BETWEEN (now() - INTERVAL '5 minutes') AND (now() + INTERVAL '5 minutes')
  AND EXISTS (
    SELECT 1
    FROM public.course_final_project_submissions
    WHERE course_final_project_submissions.id = course_final_project_reviews.submission_id
      AND course_final_project_submissions.status = 'submitted'
  )
);

-- Les comptes connectés peuvent uniquement consulter et ajouter une nouvelle
-- évaluation. Aucun droit UPDATE ou DELETE ne permet d'altérer l'historique.
REVOKE ALL ON public.course_final_project_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  submission_id,
  need_and_audience_level,
  prompt_and_success_criteria_level,
  checks_and_risks_level,
  choices_and_limits_level,
  appreciation,
  improvement_areas,
  review_status,
  created_at
) ON public.course_final_project_reviews TO authenticated;
GRANT INSERT (
  submission_id,
  reviewer_id,
  need_and_audience_level,
  prompt_and_success_criteria_level,
  checks_and_risks_level,
  choices_and_limits_level,
  appreciation,
  improvement_areas,
  review_status
) ON public.course_final_project_reviews TO authenticated;
GRANT ALL ON public.course_final_project_reviews TO service_role;
GRANT USAGE ON SEQUENCE public.course_final_project_reviews_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.course_final_project_reviews_id_seq TO service_role;

CREATE VIEW public.course_final_project_review_history
WITH (security_invoker = true)
AS
SELECT
  review.id,
  review.submission_id,
  submission.user_id,
  submission.course_id,
  submission.saved_at AS submission_saved_at,
  review.need_and_audience_level,
  review.prompt_and_success_criteria_level,
  review.checks_and_risks_level,
  review.choices_and_limits_level,
  review.appreciation,
  review.improvement_areas,
  review.review_status,
  review.created_at
FROM public.course_final_project_reviews AS review
JOIN public.course_final_project_submissions AS submission
  ON submission.id = review.submission_id;

COMMENT ON VIEW public.course_final_project_review_history IS
  'Historique des évaluations avec la remise évaluée, filtré par les règles RLS des tables sources.';

REVOKE ALL ON public.course_final_project_review_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_final_project_review_history TO authenticated;
GRANT ALL ON public.course_final_project_review_history TO service_role;

CREATE VIEW public.course_final_project_latest_reviews
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (submission.user_id, submission.course_id)
  review.id,
  review.submission_id,
  submission.user_id,
  submission.course_id,
  submission.saved_at AS submission_saved_at,
  review.need_and_audience_level,
  review.prompt_and_success_criteria_level,
  review.checks_and_risks_level,
  review.choices_and_limits_level,
  review.appreciation,
  review.improvement_areas,
  review.review_status,
  review.created_at
FROM public.course_final_project_reviews AS review
JOIN public.course_final_project_submissions AS submission
  ON submission.id = review.submission_id
ORDER BY submission.user_id, submission.course_id, review.created_at DESC, review.id DESC;

COMMENT ON VIEW public.course_final_project_latest_reviews IS
  'Dernière évaluation finale par apprenant et formation, filtrée par RLS.';

REVOKE ALL ON public.course_final_project_latest_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_final_project_latest_reviews TO authenticated;
GRANT ALL ON public.course_final_project_latest_reviews TO service_role;
