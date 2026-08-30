BEGIN;

CREATE TABLE public.diagnostic_ia_preparation_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.diagnostic_ia_bookings(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  questionnaire_version text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  organization text NOT NULL,
  job_title text NOT NULL,
  sector text NOT NULL,
  organization_size text NOT NULL,
  tools_used text NOT NULL,
  ai_level text NOT NULL,
  repetitive_tasks text NOT NULL,
  documents_handled text NOT NULL,
  main_difficulty text NOT NULL,
  diagnostic_goal text NOT NULL,
  one_task_to_remove text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  retention_due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostic_ia_questionnaire_version_check CHECK (
    questionnaire_version = 'DIAGNOSTIC-IA-PREPARATION-2026-08-29'
  ),
  CONSTRAINT diagnostic_ia_questionnaire_size_check CHECK (
    organization_size IN ('independent', '1_9', '10_49', '50_249', '250_plus')
  ),
  CONSTRAINT diagnostic_ia_questionnaire_ai_level_check CHECK (
    ai_level IN ('discovery', 'beginner', 'intermediate', 'advanced')
  ),
  CONSTRAINT diagnostic_ia_questionnaire_text_bounds_check CHECK (
    char_length(btrim(first_name)) BETWEEN 1 AND 80
    AND char_length(btrim(last_name)) BETWEEN 1 AND 80
    AND char_length(btrim(organization)) BETWEEN 1 AND 160
    AND char_length(btrim(job_title)) BETWEEN 1 AND 120
    AND char_length(btrim(sector)) BETWEEN 1 AND 120
    AND char_length(btrim(tools_used)) BETWEEN 1 AND 1000
    AND char_length(btrim(repetitive_tasks)) BETWEEN 1 AND 2000
    AND char_length(btrim(documents_handled)) BETWEEN 1 AND 1000
    AND char_length(btrim(main_difficulty)) BETWEEN 1 AND 1000
    AND char_length(btrim(diagnostic_goal)) BETWEEN 1 AND 1000
    AND char_length(btrim(one_task_to_remove)) BETWEEN 1 AND 1000
  ),
  CONSTRAINT diagnostic_ia_questionnaire_retention_check CHECK (
    retention_due_at >= submitted_at
  )
);

CREATE INDEX diagnostic_ia_questionnaires_user_idx
  ON public.diagnostic_ia_preparation_questionnaires(user_id, submitted_at DESC);
CREATE INDEX diagnostic_ia_questionnaires_retention_idx
  ON public.diagnostic_ia_preparation_questionnaires(retention_due_at);

CREATE FUNCTION private.set_diagnostic_ia_questionnaire_retention_due_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_ends_at timestamptz;
BEGIN
  SELECT ends_at INTO v_ends_at
  FROM public.diagnostic_ia_bookings
  WHERE id = NEW.booking_id;
  IF v_ends_at IS NULL THEN
    RAISE EXCEPTION 'Réservation Diagnostic IA introuvable.' USING ERRCODE = '23503';
  END IF;
  NEW.retention_due_at := v_ends_at + interval '12 months';
  RETURN NEW;
END;
$$;

CREATE TRIGGER diagnostic_ia_questionnaires_set_retention_due_at
BEFORE INSERT ON public.diagnostic_ia_preparation_questionnaires
FOR EACH ROW EXECUTE FUNCTION private.set_diagnostic_ia_questionnaire_retention_due_at();

CREATE FUNCTION private.refresh_diagnostic_ia_questionnaire_retention_due_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    UPDATE public.diagnostic_ia_preparation_questionnaires
    SET retention_due_at = NEW.completed_at + interval '12 months'
    WHERE booking_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER diagnostic_ia_booking_refresh_questionnaire_retention
AFTER UPDATE OF status, completed_at ON public.diagnostic_ia_bookings
FOR EACH ROW EXECUTE FUNCTION private.refresh_diagnostic_ia_questionnaire_retention_due_at();

CREATE FUNCTION private.delete_expired_diagnostic_ia_questionnaires()
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.diagnostic_ia_preparation_questionnaires
  WHERE retention_due_at <= now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION private.set_diagnostic_ia_questionnaire_retention_due_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.refresh_diagnostic_ia_questionnaire_retention_due_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.delete_expired_diagnostic_ia_questionnaires() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.delete_expired_diagnostic_ia_questionnaires() TO service_role;

ALTER TABLE public.diagnostic_ia_preparation_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_ia_preparation_questionnaires FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture de son questionnaire Diagnostic IA"
ON public.diagnostic_ia_preparation_questionnaires FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Lecture administrative des questionnaires Diagnostic IA"
ON public.diagnostic_ia_preparation_questionnaires FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

REVOKE ALL ON public.diagnostic_ia_preparation_questionnaires FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.diagnostic_ia_preparation_questionnaires TO authenticated;
GRANT ALL ON public.diagnostic_ia_preparation_questionnaires TO service_role;

CREATE TRIGGER diagnostic_ia_questionnaires_set_updated_at
BEFORE UPDATE ON public.diagnostic_ia_preparation_questionnaires
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

COMMENT ON TABLE public.diagnostic_ia_preparation_questionnaires IS
  'Questionnaire préalable versionné du Diagnostic IA Express. Aucune réutilisation marketing ou de prospection sans base légale distincte.';
COMMENT ON COLUMN public.diagnostic_ia_preparation_questionnaires.retention_due_at IS
  'Suppression par routine service_role à échéance de douze mois après réalisation prévue, recalée sur completed_at si le diagnostic est clôturé.';

COMMIT;
