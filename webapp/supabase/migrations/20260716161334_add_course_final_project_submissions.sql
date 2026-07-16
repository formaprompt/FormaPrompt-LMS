-- Chaque brouillon ou remise crée une nouvelle version. Les anciennes versions
-- restent intactes pour le suivi pédagogique et les preuves Qualiopi.
CREATE TABLE public.course_final_project_submissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  course_id text NOT NULL,
  prompt_and_iterations text NOT NULL DEFAULT '',
  final_output text NOT NULL DEFAULT '',
  verification_grid_reference text NOT NULL DEFAULT '',
  action_plan text NOT NULL DEFAULT '',
  learner_note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  saved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_final_project_submissions_course_id_check
    CHECK (char_length(btrim(course_id)) BETWEEN 1 AND 100),
  CONSTRAINT course_final_project_submissions_prompt_check
    CHECK (char_length(prompt_and_iterations) <= 5000),
  CONSTRAINT course_final_project_submissions_output_check
    CHECK (char_length(final_output) <= 5000),
  CONSTRAINT course_final_project_submissions_grid_check
    CHECK (char_length(verification_grid_reference) <= 5000),
  CONSTRAINT course_final_project_submissions_action_plan_check
    CHECK (char_length(action_plan) <= 5000),
  CONSTRAINT course_final_project_submissions_learner_note_check
    CHECK (char_length(learner_note) <= 2000),
  CONSTRAINT course_final_project_submissions_status_check
    CHECK (status IN ('draft', 'submitted')),
  CONSTRAINT course_final_project_submissions_content_check
    CHECK (
      (
        status = 'draft'
        AND GREATEST(
          char_length(btrim(prompt_and_iterations)),
          char_length(btrim(final_output)),
          char_length(btrim(verification_grid_reference)),
          char_length(btrim(action_plan))
        ) > 0
      )
      OR (
        status = 'submitted'
        AND LEAST(
          char_length(btrim(prompt_and_iterations)),
          char_length(btrim(final_output)),
          char_length(btrim(verification_grid_reference)),
          char_length(btrim(action_plan))
        ) > 0
      )
    )
);

COMMENT ON TABLE public.course_final_project_submissions IS
  'Versions immuables des brouillons et remises du cas pratique final.';
COMMENT ON COLUMN public.course_final_project_submissions.status IS
  'draft : remise incomplète ; submitted : les quatre livrables sont identifiés et remis au formateur.';
COMMENT ON COLUMN public.course_final_project_submissions.verification_grid_reference IS
  'Description, nom ou lien sécurisé permettant d''identifier la grille de vérification complétée.';

CREATE INDEX course_final_project_submissions_learner_history_idx
  ON public.course_final_project_submissions (user_id, course_id, saved_at DESC, id DESC);
CREATE INDEX course_final_project_submissions_submitted_idx
  ON public.course_final_project_submissions (course_id, saved_at DESC, id DESC)
  WHERE status = 'submitted';

ALTER TABLE public.course_final_project_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_final_project_submissions FORCE ROW LEVEL SECURITY;

CREATE POLICY "L'apprenant consulte ses remises et le personnel assure le suivi"
ON public.course_final_project_submissions
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.is_admin())
);

CREATE POLICY "L'apprenant enregistre une nouvelle version de sa remise"
ON public.course_final_project_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.purchases
    WHERE purchases.user_id = (SELECT auth.uid())
      AND purchases.course_id = course_final_project_submissions.course_id
  )
  AND saved_at BETWEEN (now() - INTERVAL '5 minutes') AND (now() + INTERVAL '5 minutes')
);

-- Aucun droit UPDATE ou DELETE n'est accordé aux comptes connectés. Une
-- nouvelle sauvegarde ajoute une version et préserve l'historique.
REVOKE ALL ON public.course_final_project_submissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_final_project_submissions TO authenticated;
GRANT INSERT (
  user_id,
  course_id,
  prompt_and_iterations,
  final_output,
  verification_grid_reference,
  action_plan,
  learner_note,
  status
) ON public.course_final_project_submissions TO authenticated;
GRANT ALL ON public.course_final_project_submissions TO service_role;
GRANT USAGE ON SEQUENCE public.course_final_project_submissions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.course_final_project_submissions_id_seq TO service_role;

-- La vue charge la dernière sauvegarde, qu'il s'agisse d'un brouillon ou d'une
-- remise. SECURITY INVOKER conserve les règles RLS de la table source.
CREATE VIEW public.course_final_project_latest_versions
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (user_id, course_id)
  id,
  user_id,
  course_id,
  prompt_and_iterations,
  final_output,
  verification_grid_reference,
  action_plan,
  learner_note,
  status,
  saved_at
FROM public.course_final_project_submissions
ORDER BY user_id, course_id, saved_at DESC, id DESC;

COMMENT ON VIEW public.course_final_project_latest_versions IS
  'Dernière version du cas final par apprenant et formation, filtrée par RLS.';

REVOKE ALL ON public.course_final_project_latest_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_final_project_latest_versions TO authenticated;
GRANT ALL ON public.course_final_project_latest_versions TO service_role;

-- Cette vue servira au poste d'évaluation du formateur : un brouillon plus
-- récent ne masque pas la dernière version explicitement remise.
CREATE VIEW public.course_final_project_latest_submissions
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (user_id, course_id)
  id,
  user_id,
  course_id,
  prompt_and_iterations,
  final_output,
  verification_grid_reference,
  action_plan,
  learner_note,
  saved_at
FROM public.course_final_project_submissions
WHERE status = 'submitted'
ORDER BY user_id, course_id, saved_at DESC, id DESC;

COMMENT ON VIEW public.course_final_project_latest_submissions IS
  'Dernière remise terminée du cas final par apprenant et formation, filtrée par RLS.';

REVOKE ALL ON public.course_final_project_latest_submissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_final_project_latest_submissions TO authenticated;
GRANT ALL ON public.course_final_project_latest_submissions TO service_role;
