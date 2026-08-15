-- Sprint 1.1C : registre qualité / Qualiopi.
-- Les constats, risques et actions sont séparés. Un incident disciplinaire est
-- référencé par identifiant sans recopier ses faits ni l identité de l apprenant.

BEGIN;

CREATE TABLE public.quality_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL,
  source_type text NOT NULL,
  title text NOT NULL,
  factual_description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  incident_id uuid REFERENCES public.disciplinary_incidents(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  occurred_at timestamptz,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quality_records_type_check CHECK (record_type IN (
    'finding', 'nonconformity', 'complaint', 'improvement_opportunity',
    'incident_followup', 'stakeholder_feedback', 'other'
  )),
  CONSTRAINT quality_records_source_check CHECK (source_type IN (
    'internal_audit', 'learner_feedback', 'complaint', 'disciplinary_incident',
    'quality_review', 'regulatory', 'other'
  )),
  CONSTRAINT quality_records_incident_link_check CHECK (
    (source_type = 'disciplinary_incident' AND incident_id IS NOT NULL AND record_type = 'incident_followup')
    OR (source_type <> 'disciplinary_incident' AND incident_id IS NULL)
  ),
  CONSTRAINT quality_records_title_check
    CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  CONSTRAINT quality_records_description_check
    CHECK (char_length(btrim(factual_description)) BETWEEN 10 AND 10000),
  CONSTRAINT quality_records_severity_check
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT quality_records_status_check
    CHECK (status IN ('open', 'under_review', 'action_plan', 'resolved', 'closed')),
  CONSTRAINT quality_records_dates_check
    CHECK (occurred_at IS NULL OR occurred_at <= detected_at + interval '5 minutes'),
  CONSTRAINT quality_records_closure_check CHECK (
    (status = 'closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL)
    OR (status <> 'closed' AND closed_at IS NULL AND closed_by IS NULL)
  )
);

CREATE UNIQUE INDEX quality_records_one_per_incident_uidx
  ON public.quality_records (incident_id)
  WHERE incident_id IS NOT NULL;
CREATE INDEX quality_records_status_detected_idx
  ON public.quality_records (status, severity, detected_at DESC);
CREATE INDEX quality_records_owner_status_idx
  ON public.quality_records (owner_user_id, status, detected_at DESC);

CREATE TABLE public.quality_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_record_id uuid NOT NULL REFERENCES public.quality_records(id) ON DELETE RESTRICT,
  title text NOT NULL,
  risk_description text NOT NULL,
  likelihood smallint NOT NULL,
  impact smallint NOT NULL,
  risk_score smallint GENERATED ALWAYS AS (likelihood * impact) STORED,
  treatment_strategy text NOT NULL DEFAULT 'mitigate',
  status text NOT NULL DEFAULT 'identified',
  owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  review_due_at timestamptz,
  last_reviewed_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quality_risks_title_check
    CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  CONSTRAINT quality_risks_description_check
    CHECK (char_length(btrim(risk_description)) BETWEEN 10 AND 10000),
  CONSTRAINT quality_risks_likelihood_check CHECK (likelihood BETWEEN 1 AND 5),
  CONSTRAINT quality_risks_impact_check CHECK (impact BETWEEN 1 AND 5),
  CONSTRAINT quality_risks_strategy_check
    CHECK (treatment_strategy IN ('mitigate', 'avoid', 'transfer', 'accept', 'monitor')),
  CONSTRAINT quality_risks_status_check
    CHECK (status IN ('identified', 'assessed', 'treatment_in_progress', 'accepted', 'closed')),
  CONSTRAINT quality_risks_id_record_key UNIQUE (id, quality_record_id)
);

CREATE INDEX quality_risks_record_status_idx
  ON public.quality_risks (quality_record_id, status, risk_score DESC);
CREATE INDEX quality_risks_owner_review_idx
  ON public.quality_risks (owner_user_id, review_due_at)
  WHERE status NOT IN ('accepted', 'closed');

CREATE TABLE public.quality_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_record_id uuid NOT NULL REFERENCES public.quality_records(id) ON DELETE RESTRICT,
  risk_id uuid,
  action_type text NOT NULL,
  title text NOT NULL,
  action_description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'planned',
  responsible_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  due_at timestamptz,
  completion_evidence text,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quality_actions_risk_record_fk
    FOREIGN KEY (risk_id, quality_record_id)
    REFERENCES public.quality_risks(id, quality_record_id) ON DELETE RESTRICT,
  CONSTRAINT quality_actions_type_check
    CHECK (action_type IN ('corrective', 'preventive', 'improvement')),
  CONSTRAINT quality_actions_title_check
    CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  CONSTRAINT quality_actions_description_check
    CHECK (char_length(btrim(action_description)) BETWEEN 10 AND 10000),
  CONSTRAINT quality_actions_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT quality_actions_status_check
    CHECK (status IN ('planned', 'in_progress', 'blocked', 'completed', 'cancelled')),
  CONSTRAINT quality_actions_evidence_check
    CHECK (completion_evidence IS NULL OR char_length(btrim(completion_evidence)) BETWEEN 10 AND 5000),
  CONSTRAINT quality_actions_completion_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND completed_by IS NOT NULL
      AND completion_evidence IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL AND completed_by IS NULL)
  )
);

CREATE INDEX quality_actions_record_status_idx
  ON public.quality_actions (quality_record_id, status, due_at);
CREATE INDEX quality_actions_risk_idx
  ON public.quality_actions (risk_id, status)
  WHERE risk_id IS NOT NULL;
CREATE INDEX quality_actions_responsible_due_idx
  ON public.quality_actions (responsible_user_id, due_at)
  WHERE status IN ('planned', 'in_progress', 'blocked');

COMMENT ON TABLE public.quality_records IS
  'Registre qualité : constats et non-conformités. Un lien incident ne recopie aucune donnée disciplinaire.';
COMMENT ON TABLE public.quality_risks IS
  'Risques évalués de 1 à 25 et rattachés à un constat qualité.';
COMMENT ON TABLE public.quality_actions IS
  'Actions correctives, préventives ou d amélioration avec responsable, échéance et preuve de réalisation.';

ALTER TABLE public.quality_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quality_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_risks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quality_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_actions FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture admin du registre qualité"
ON public.quality_records FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));
CREATE POLICY "Lecture admin des risques qualité"
ON public.quality_risks FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));
CREATE POLICY "Lecture admin des actions qualité"
ON public.quality_actions FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

REVOKE ALL ON public.quality_records, public.quality_risks, public.quality_actions
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.quality_records, public.quality_risks, public.quality_actions
TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.quality_records, public.quality_risks, public.quality_actions
TO service_role;
REVOKE DELETE, TRUNCATE ON public.quality_records, public.quality_risks, public.quality_actions
FROM service_role;

CREATE OR REPLACE FUNCTION private.audit_quality_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_reason text := nullif(current_setting('formaprompt.audit_reason', true), '');
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  v_action_type text;
  v_record_id text;
  v_previous_state jsonb;
  v_new_state jsonb;
BEGIN
  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Un motif d audit de 10 à 2000 caractères est requis.';
  END IF;

  v_record_id := coalesce(v_new ->> 'quality_record_id', v_old ->> 'quality_record_id', v_new ->> 'id', v_old ->> 'id');
  v_action_type := CASE
    WHEN TG_TABLE_NAME = 'quality_records' AND TG_OP = 'INSERT' THEN 'quality_record_created'
    WHEN TG_TABLE_NAME = 'quality_records' AND v_new ->> 'status' IS DISTINCT FROM v_old ->> 'status' THEN 'quality_record_status_changed'
    WHEN TG_TABLE_NAME = 'quality_risks' AND TG_OP = 'INSERT' THEN 'quality_risk_created'
    WHEN TG_TABLE_NAME = 'quality_risks' AND (
      v_new ->> 'likelihood' IS DISTINCT FROM v_old ->> 'likelihood'
      OR v_new ->> 'impact' IS DISTINCT FROM v_old ->> 'impact'
    ) THEN 'quality_risk_rating_changed'
    WHEN TG_TABLE_NAME = 'quality_risks' AND v_new ->> 'status' IS DISTINCT FROM v_old ->> 'status' THEN 'quality_risk_status_changed'
    WHEN TG_TABLE_NAME = 'quality_actions' AND TG_OP = 'INSERT' THEN 'quality_action_created'
    WHEN TG_TABLE_NAME = 'quality_actions' AND v_new ->> 'status' IS DISTINCT FROM v_old ->> 'status' THEN 'quality_action_status_changed'
    WHEN TG_TABLE_NAME = 'quality_actions' AND v_new ->> 'due_at' IS DISTINCT FROM v_old ->> 'due_at' THEN 'quality_action_deadline_changed'
    ELSE 'quality_assignment_changed'
  END;

  v_previous_state := jsonb_strip_nulls(jsonb_build_object(
    'status', v_old -> 'status',
    'severity', v_old -> 'severity',
    'owner_user_id', v_old -> 'owner_user_id',
    'responsible_user_id', v_old -> 'responsible_user_id',
    'likelihood', v_old -> 'likelihood',
    'impact', v_old -> 'impact',
    'treatment_strategy', v_old -> 'treatment_strategy',
    'due_at', v_old -> 'due_at',
    'review_due_at', v_old -> 'review_due_at',
    'completed_at', v_old -> 'completed_at'
  ));
  v_new_state := jsonb_strip_nulls(jsonb_build_object(
    'status', v_new -> 'status',
    'severity', v_new -> 'severity',
    'owner_user_id', v_new -> 'owner_user_id',
    'responsible_user_id', v_new -> 'responsible_user_id',
    'likelihood', v_new -> 'likelihood',
    'impact', v_new -> 'impact',
    'treatment_strategy', v_new -> 'treatment_strategy',
    'due_at', v_new -> 'due_at',
    'review_due_at', v_new -> 'review_due_at',
    'completed_at', v_new -> 'completed_at'
  ));

  INSERT INTO public.audit_log (
    actor_user_id, action_type, target_type, target_id,
    previous_state, new_state, reason, metadata
  ) VALUES (
    v_actor, v_action_type, TG_TABLE_NAME, coalesce(v_new ->> 'id', v_old ->> 'id'),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE v_previous_state END,
    v_new_state, v_reason,
    jsonb_build_object('quality_record_id', v_record_id)
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.audit_quality_change()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER audit_quality_records_changes
AFTER INSERT OR UPDATE ON public.quality_records
FOR EACH ROW EXECUTE FUNCTION private.audit_quality_change();
CREATE TRIGGER audit_quality_risks_changes
AFTER INSERT OR UPDATE ON public.quality_risks
FOR EACH ROW EXECUTE FUNCTION private.audit_quality_change();
CREATE TRIGGER audit_quality_actions_changes
AFTER INSERT OR UPDATE ON public.quality_actions
FOR EACH ROW EXECUTE FUNCTION private.audit_quality_change();

CREATE OR REPLACE FUNCTION private.require_quality_admin(p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Un motif administratif de 10 à 2000 caractères est requis.';
  END IF;
  PERFORM set_config('formaprompt.audit_reason', btrim(p_reason), true);
  RETURN v_actor;
END;
$$;

REVOKE ALL ON FUNCTION private.require_quality_admin(text)
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_create_quality_record(
  p_record_type text,
  p_source_type text,
  p_title text,
  p_factual_description text,
  p_severity text,
  p_owner_user_id uuid,
  p_reason text,
  p_occurred_at timestamptz DEFAULT NULL,
  p_incident_id uuid DEFAULT NULL
)
RETURNS public.quality_records
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_quality_admin(p_reason);
  v_result public.quality_records%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_owner_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Le responsable qualité doit être un administrateur.';
  END IF;
  INSERT INTO public.quality_records (
    record_type, source_type, title, factual_description, severity,
    incident_id, owner_user_id, occurred_at, created_by
  ) VALUES (
    p_record_type, p_source_type, btrim(p_title), btrim(p_factual_description), p_severity,
    p_incident_id, p_owner_user_id, p_occurred_at, v_actor
  ) RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_quality_record(
  p_record_id uuid,
  p_reason text,
  p_status text DEFAULT NULL,
  p_severity text DEFAULT NULL,
  p_owner_user_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_factual_description text DEFAULT NULL
)
RETURNS public.quality_records
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_quality_admin(p_reason);
  v_current public.quality_records%ROWTYPE;
  v_status text;
  v_result public.quality_records%ROWTYPE;
BEGIN
  SELECT * INTO v_current FROM public.quality_records WHERE id = p_record_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Constat qualité introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF v_current.status = 'closed' THEN RAISE EXCEPTION 'Un constat clôturé est immuable.'; END IF;
  IF p_owner_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_owner_user_id AND role = 'admin'
  ) THEN RAISE EXCEPTION 'Le responsable qualité doit être un administrateur.'; END IF;
  v_status := coalesce(p_status, v_current.status);
  IF v_status IN ('resolved', 'closed') AND EXISTS (
    SELECT 1 FROM public.quality_actions
    WHERE quality_record_id = p_record_id AND status NOT IN ('completed', 'cancelled')
  ) THEN RAISE EXCEPTION 'Les actions ouvertes empêchent la résolution du constat.'; END IF;
  UPDATE public.quality_records
  SET status = v_status,
      severity = coalesce(p_severity, severity),
      owner_user_id = coalesce(p_owner_user_id, owner_user_id),
      title = coalesce(nullif(btrim(p_title), ''), title),
      factual_description = coalesce(nullif(btrim(p_factual_description), ''), factual_description),
      closed_at = CASE WHEN v_status = 'closed' THEN now() ELSE NULL END,
      closed_by = CASE WHEN v_status = 'closed' THEN v_actor ELSE NULL END,
      updated_at = now()
  WHERE id = p_record_id RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_quality_risk(
  p_quality_record_id uuid,
  p_title text,
  p_risk_description text,
  p_likelihood smallint,
  p_impact smallint,
  p_treatment_strategy text,
  p_owner_user_id uuid,
  p_reason text,
  p_review_due_at timestamptz DEFAULT NULL
)
RETURNS public.quality_risks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_quality_admin(p_reason);
  v_result public.quality_risks%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quality_records WHERE id = p_quality_record_id AND status <> 'closed') THEN
    RAISE EXCEPTION 'Constat qualité ouvert introuvable.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_owner_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Le responsable du risque doit être un administrateur.';
  END IF;
  INSERT INTO public.quality_risks (
    quality_record_id, title, risk_description, likelihood, impact,
    treatment_strategy, owner_user_id, review_due_at, created_by
  ) VALUES (
    p_quality_record_id, btrim(p_title), btrim(p_risk_description), p_likelihood, p_impact,
    p_treatment_strategy, p_owner_user_id, p_review_due_at, v_actor
  ) RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_quality_risk(
  p_risk_id uuid,
  p_reason text,
  p_status text DEFAULT NULL,
  p_likelihood smallint DEFAULT NULL,
  p_impact smallint DEFAULT NULL,
  p_treatment_strategy text DEFAULT NULL,
  p_owner_user_id uuid DEFAULT NULL,
  p_review_due_at timestamptz DEFAULT NULL
)
RETURNS public.quality_risks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_quality_admin(p_reason);
  v_current public.quality_risks%ROWTYPE;
  v_result public.quality_risks%ROWTYPE;
BEGIN
  SELECT * INTO v_current FROM public.quality_risks WHERE id = p_risk_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Risque qualité introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF v_current.status = 'closed' THEN RAISE EXCEPTION 'Un risque clôturé est immuable.'; END IF;
  IF p_owner_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_owner_user_id AND role = 'admin'
  ) THEN RAISE EXCEPTION 'Le responsable du risque doit être un administrateur.'; END IF;
  UPDATE public.quality_risks
  SET status = coalesce(p_status, status),
      likelihood = coalesce(p_likelihood, likelihood),
      impact = coalesce(p_impact, impact),
      treatment_strategy = coalesce(p_treatment_strategy, treatment_strategy),
      owner_user_id = coalesce(p_owner_user_id, owner_user_id),
      review_due_at = coalesce(p_review_due_at, review_due_at),
      last_reviewed_at = now(),
      updated_at = now()
  WHERE id = p_risk_id RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_quality_action(
  p_quality_record_id uuid,
  p_risk_id uuid,
  p_action_type text,
  p_title text,
  p_action_description text,
  p_priority text,
  p_responsible_user_id uuid,
  p_reason text,
  p_due_at timestamptz DEFAULT NULL
)
RETURNS public.quality_actions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_quality_admin(p_reason);
  v_result public.quality_actions%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quality_records WHERE id = p_quality_record_id AND status <> 'closed') THEN
    RAISE EXCEPTION 'Constat qualité ouvert introuvable.';
  END IF;
  IF p_risk_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.quality_risks WHERE id = p_risk_id AND quality_record_id = p_quality_record_id
  ) THEN RAISE EXCEPTION 'Le risque ne dépend pas de ce constat.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_responsible_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Le responsable de l action doit être un administrateur.';
  END IF;
  INSERT INTO public.quality_actions (
    quality_record_id, risk_id, action_type, title, action_description,
    priority, responsible_user_id, due_at, created_by
  ) VALUES (
    p_quality_record_id, p_risk_id, p_action_type, btrim(p_title), btrim(p_action_description),
    p_priority, p_responsible_user_id, p_due_at, v_actor
  ) RETURNING * INTO v_result;
  UPDATE public.quality_records
  SET status = CASE WHEN status IN ('open', 'under_review') THEN 'action_plan' ELSE status END,
      updated_at = now()
  WHERE id = p_quality_record_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_quality_action(
  p_action_id uuid,
  p_reason text,
  p_status text DEFAULT NULL,
  p_responsible_user_id uuid DEFAULT NULL,
  p_due_at timestamptz DEFAULT NULL,
  p_completion_evidence text DEFAULT NULL
)
RETURNS public.quality_actions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := private.require_quality_admin(p_reason);
  v_current public.quality_actions%ROWTYPE;
  v_status text;
  v_evidence text;
  v_result public.quality_actions%ROWTYPE;
BEGIN
  SELECT * INTO v_current FROM public.quality_actions WHERE id = p_action_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Action qualité introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF v_current.status IN ('completed', 'cancelled') THEN RAISE EXCEPTION 'Une action terminée est immuable.'; END IF;
  IF p_responsible_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_responsible_user_id AND role = 'admin'
  ) THEN RAISE EXCEPTION 'Le responsable de l action doit être un administrateur.'; END IF;
  v_status := coalesce(p_status, v_current.status);
  v_evidence := coalesce(nullif(btrim(p_completion_evidence), ''), v_current.completion_evidence);
  IF v_status = 'completed' AND char_length(btrim(coalesce(v_evidence, ''))) < 10 THEN
    RAISE EXCEPTION 'Une preuve de réalisation est requise.';
  END IF;
  UPDATE public.quality_actions
  SET status = v_status,
      responsible_user_id = coalesce(p_responsible_user_id, responsible_user_id),
      due_at = coalesce(p_due_at, due_at),
      completion_evidence = CASE WHEN v_status = 'completed' THEN v_evidence ELSE completion_evidence END,
      completed_at = CASE WHEN v_status = 'completed' THEN now() ELSE NULL END,
      completed_by = CASE WHEN v_status = 'completed' THEN v_actor ELSE NULL END,
      updated_at = now()
  WHERE id = p_action_id RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_quality_record(text,text,text,text,text,uuid,text,timestamptz,uuid)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_update_quality_record(uuid,text,text,text,uuid,text,text)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_create_quality_risk(uuid,text,text,smallint,smallint,text,uuid,text,timestamptz)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_update_quality_risk(uuid,text,text,smallint,smallint,text,uuid,timestamptz)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_create_quality_action(uuid,uuid,text,text,text,text,uuid,text,timestamptz)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_update_quality_action(uuid,text,text,uuid,timestamptz,text)
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.admin_create_quality_record(text,text,text,text,text,uuid,text,timestamptz,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_quality_record(uuid,text,text,text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_quality_risk(uuid,text,text,smallint,smallint,text,uuid,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_quality_risk(uuid,text,text,smallint,smallint,text,uuid,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_quality_action(uuid,uuid,text,text,text,text,uuid,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_quality_action(uuid,text,text,uuid,timestamptz,text) TO authenticated;

COMMIT;
