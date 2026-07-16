-- Les corrections sont ajoutées comme des événements immuables. Une nouvelle
-- appréciation conserve donc la précédente pour la traçabilité pédagogique.
CREATE TABLE public.course_exercise_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  response_id bigint NOT NULL REFERENCES public.course_exercise_responses(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  feedback_text text NOT NULL,
  review_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_exercise_reviews_feedback_text_check
    CHECK (char_length(btrim(feedback_text)) BETWEEN 1 AND 10000),
  CONSTRAINT course_exercise_reviews_status_check
    CHECK (review_status IN ('needs_revision', 'validated'))
);

COMMENT ON TABLE public.course_exercise_reviews IS
  'Historique immuable des corrections et appréciations du formateur sur les réponses terminées.';
COMMENT ON COLUMN public.course_exercise_reviews.review_status IS
  'needs_revision : réponse à reprendre ; validated : exercice validé par le formateur.';

CREATE INDEX course_exercise_reviews_response_history_idx
  ON public.course_exercise_reviews (response_id, created_at DESC, id DESC);
CREATE INDEX course_exercise_reviews_reviewer_idx
  ON public.course_exercise_reviews (reviewer_id);

ALTER TABLE public.course_exercise_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_exercise_reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY "L'apprenant consulte ses retours et le personnel assure le suivi"
ON public.course_exercise_reviews
FOR SELECT
TO authenticated
USING (
  (SELECT private.is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.course_exercise_responses
    WHERE course_exercise_responses.id = course_exercise_reviews.response_id
      AND course_exercise_responses.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Le personnel ajoute une correction sur une réponse terminée"
ON public.course_exercise_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT private.is_admin())
  AND reviewer_id = (SELECT auth.uid())
  AND created_at BETWEEN (now() - INTERVAL '5 minutes') AND (now() + INTERVAL '5 minutes')
  AND EXISTS (
    SELECT 1
    FROM public.course_exercise_responses
    WHERE course_exercise_responses.id = course_exercise_reviews.response_id
      AND course_exercise_responses.status = 'submitted'
  )
);

-- Aucun droit UPDATE ou DELETE n'est accordé aux comptes connectés : une
-- correction rectifiée est enregistrée dans une nouvelle ligne.
REVOKE ALL ON public.course_exercise_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, response_id, feedback_text, review_status, created_at)
  ON public.course_exercise_reviews TO authenticated;
GRANT INSERT (response_id, reviewer_id, feedback_text, review_status)
  ON public.course_exercise_reviews TO authenticated;
GRANT ALL ON public.course_exercise_reviews TO service_role;
GRANT USAGE ON SEQUENCE public.course_exercise_reviews_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.course_exercise_reviews_id_seq TO service_role;

-- Le formateur corrige la dernière version que l'apprenant a explicitement
-- déclarée terminée, même si un brouillon plus récent existe.
CREATE VIEW public.course_exercise_latest_submissions
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (user_id, course_id, exercise_id)
  id,
  user_id,
  course_id,
  exercise_id,
  response_text,
  saved_at
FROM public.course_exercise_responses
WHERE status = 'submitted'
ORDER BY user_id, course_id, exercise_id, saved_at DESC, id DESC;

COMMENT ON VIEW public.course_exercise_latest_submissions IS
  'Dernière réponse terminée de chaque exercice, filtrée par les règles RLS de la table source.';

REVOKE ALL ON public.course_exercise_latest_submissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_exercise_latest_submissions TO authenticated;
GRANT ALL ON public.course_exercise_latest_submissions TO service_role;

CREATE VIEW public.course_exercise_review_history
WITH (security_invoker = true)
AS
SELECT
  review.id,
  review.response_id,
  response.user_id,
  response.course_id,
  response.exercise_id,
  response.saved_at AS response_saved_at,
  review.feedback_text,
  review.review_status,
  review.created_at
FROM public.course_exercise_reviews AS review
JOIN public.course_exercise_responses AS response
  ON response.id = review.response_id;

COMMENT ON VIEW public.course_exercise_review_history IS
  'Historique des corrections avec leur exercice et la version évaluée, sans exposer l''identifiant interne du formateur.';

REVOKE ALL ON public.course_exercise_review_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_exercise_review_history TO authenticated;
GRANT ALL ON public.course_exercise_review_history TO service_role;

-- La réponse liée est exposée avec la correction pour permettre à l'apprenant
-- de comprendre précisément quelle version a été évaluée.
CREATE VIEW public.course_exercise_latest_reviews
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (response.user_id, response.course_id, response.exercise_id)
  review.id,
  review.response_id,
  response.user_id,
  response.course_id,
  response.exercise_id,
  response.saved_at AS response_saved_at,
  review.feedback_text,
  review.review_status,
  review.created_at
FROM public.course_exercise_reviews AS review
JOIN public.course_exercise_responses AS response
  ON response.id = review.response_id
ORDER BY
  response.user_id,
  response.course_id,
  response.exercise_id,
  review.created_at DESC,
  review.id DESC;

COMMENT ON VIEW public.course_exercise_latest_reviews IS
  'Dernière correction par apprenant et exercice, avec la version terminée évaluée et les règles RLS des tables sources.';

REVOKE ALL ON public.course_exercise_latest_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_exercise_latest_reviews TO authenticated;
GRANT ALL ON public.course_exercise_latest_reviews TO service_role;
