-- Conserve chaque enregistrement comme une version distincte afin de préserver
-- l'historique pédagogique des brouillons et des réponses terminées.
CREATE TABLE public.course_exercise_responses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  course_id text NOT NULL,
  exercise_id text NOT NULL,
  response_text text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  saved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_exercise_responses_course_id_check
    CHECK (char_length(btrim(course_id)) BETWEEN 1 AND 100),
  CONSTRAINT course_exercise_responses_exercise_id_check
    CHECK (char_length(btrim(exercise_id)) BETWEEN 1 AND 100),
  CONSTRAINT course_exercise_responses_text_check
    CHECK (char_length(btrim(response_text)) BETWEEN 1 AND 20000),
  CONSTRAINT course_exercise_responses_status_check
    CHECK (status IN ('draft', 'submitted'))
);

COMMENT ON TABLE public.course_exercise_responses IS
  'Versions successives des brouillons et réponses aux exercices, conservées pour le suivi pédagogique.';
COMMENT ON COLUMN public.course_exercise_responses.status IS
  'draft : travail en cours ; submitted : réponse déclarée terminée par l''apprenant.';

CREATE INDEX course_exercise_responses_learner_history_idx
  ON public.course_exercise_responses (user_id, course_id, exercise_id, saved_at DESC, id DESC);

ALTER TABLE public.course_exercise_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_exercise_responses FORCE ROW LEVEL SECURITY;

CREATE POLICY "L'apprenant consulte ses réponses et le personnel assure le suivi"
ON public.course_exercise_responses
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.is_admin())
);

CREATE POLICY "L'apprenant enregistre une version de sa réponse"
ON public.course_exercise_responses
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.purchases
    WHERE purchases.user_id = (SELECT auth.uid())
      AND purchases.course_id = course_exercise_responses.course_id
  )
  AND saved_at BETWEEN (now() - INTERVAL '5 minutes') AND (now() + INTERVAL '5 minutes')
);

-- Aucun droit UPDATE ou DELETE n'est accordé aux comptes connectés :
-- une nouvelle sauvegarde ajoute une version et l'historique reste intact.
REVOKE ALL ON public.course_exercise_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.course_exercise_responses TO authenticated;
GRANT ALL ON public.course_exercise_responses TO service_role;
GRANT USAGE ON SEQUENCE public.course_exercise_responses_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.course_exercise_responses_id_seq TO service_role;

-- La vue évite une requête par exercice. SECURITY INVOKER conserve les règles RLS
-- de la table source pour l'apprenant comme pour le personnel autorisé.
CREATE VIEW public.course_exercise_latest_responses
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (user_id, course_id, exercise_id)
  id,
  user_id,
  course_id,
  exercise_id,
  response_text,
  status,
  saved_at
FROM public.course_exercise_responses
ORDER BY user_id, course_id, exercise_id, saved_at DESC, id DESC;

COMMENT ON VIEW public.course_exercise_latest_responses IS
  'Dernière version enregistrée pour chaque exercice, filtrée par les règles RLS de la table source.';

REVOKE ALL ON public.course_exercise_latest_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_exercise_latest_responses TO authenticated;
GRANT ALL ON public.course_exercise_latest_responses TO service_role;
