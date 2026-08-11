-- Sprint 1 : cycle de vie des droits, incidents disciplinaires et audit.
-- Les durées de conservation ne sont volontairement pas automatisées : elles
-- restent configurables après validation juridique.

BEGIN;

-- "completed" demeure un état pédagogique porté par les tables de suivi. Il
-- n'est jamais un statut de droit d'accès.
ALTER TABLE public.course_access
  DROP CONSTRAINT IF EXISTS course_access_status_check;

ALTER TABLE public.course_access
  ADD CONSTRAINT course_access_status_check
  CHECK (status IN ('active', 'suspended', 'revoked', 'refunded', 'expired'));

ALTER TABLE public.course_access
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS suspension_ends_at timestamptz;

ALTER TABLE public.course_access
  DROP CONSTRAINT IF EXISTS course_access_suspension_end_check;

ALTER TABLE public.course_access
  ADD CONSTRAINT course_access_suspension_end_check
  CHECK (suspension_ends_at IS NULL OR status = 'suspended');

COMMENT ON COLUMN public.course_access.status IS
  'Droit technique : active, suspended, revoked, refunded ou expired. La fin pédagogique est gérée séparément.';
COMMENT ON COLUMN public.course_access.expires_at IS
  'NULL signifie absence d échéance prédéfinie, jamais absence de contrôle du statut.';
COMMENT ON COLUMN public.course_access.suspension_ends_at IS
  'Échéance administrative indicative. Une suspension ne se réactive jamais automatiquement.';

DROP INDEX IF EXISTS public.course_access_active_user_idx;
CREATE INDEX course_access_active_user_idx
  ON public.course_access (user_id, course_id)
  WHERE status = 'active';
CREATE INDEX course_access_status_admin_idx
  ON public.course_access (status, status_changed_at DESC);

CREATE OR REPLACE FUNCTION private.is_strict_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.is_strict_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_strict_admin() TO authenticated;

CREATE TABLE public.incident_categories (
  id text PRIMARY KEY,
  label text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  display_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_categories_id_check
    CHECK (id ~ '^[a-z0-9_]{2,60}$'),
  CONSTRAINT incident_categories_label_check
    CHECK (char_length(btrim(label)) BETWEEN 2 AND 120)
);

INSERT INTO public.incident_categories (id, label, display_order) VALUES
  ('inappropriate_behavior', 'Comportement inapproprié', 10),
  ('discrimination', 'Discrimination', 20),
  ('racism_xenophobia', 'Racisme ou xénophobie', 30),
  ('harassment', 'Harcèlement', 40),
  ('violence', 'Violence', 50),
  ('alcohol', 'Alcool', 60),
  ('drugs', 'Stupéfiants', 70),
  ('endangerment', 'Mise en danger', 80),
  ('session_disruption', 'Perturbation d’une session', 90),
  ('fraud', 'Fraude', 100),
  ('equipment_damage', 'Atteinte aux équipements', 110),
  ('other', 'Autre', 120)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.disciplinary_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  course_id text NOT NULL,
  booking_request_id uuid REFERENCES public.course_booking_requests(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  category_id text NOT NULL REFERENCES public.incident_categories(id),
  factual_description text NOT NULL,
  incident_status text NOT NULL DEFAULT 'reported',
  severity text NOT NULL DEFAULT 'medium',
  measures_taken text,
  disciplinary_outcome text NOT NULL DEFAULT 'none',
  decision_summary text,
  decided_at timestamptz,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responsible_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  corrective_action_reference text,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disciplinary_incidents_course_check
    CHECK (char_length(btrim(course_id)) BETWEEN 2 AND 100),
  CONSTRAINT disciplinary_incidents_description_check
    CHECK (char_length(btrim(factual_description)) BETWEEN 10 AND 10000),
  CONSTRAINT disciplinary_incidents_status_check
    CHECK (incident_status IN (
      'reported', 'under_review', 'conservatory_measure',
      'hearing_pending', 'decision_pending', 'closed'
    )),
  CONSTRAINT disciplinary_incidents_severity_check
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT disciplinary_incidents_outcome_check
    CHECK (disciplinary_outcome IN (
      'none', 'no_action', 'warning', 'reprimand',
      'temporary_exclusion', 'permanent_exclusion', 'other'
    )),
  CONSTRAINT disciplinary_incidents_measures_check
    CHECK (measures_taken IS NULL OR char_length(measures_taken) <= 5000),
  CONSTRAINT disciplinary_incidents_decision_check
    CHECK (decision_summary IS NULL OR char_length(decision_summary) <= 10000),
  CONSTRAINT disciplinary_incidents_corrective_ref_check
    CHECK (corrective_action_reference IS NULL OR char_length(corrective_action_reference) <= 200),
  CONSTRAINT disciplinary_incidents_decision_consistency_check
    CHECK (
      (disciplinary_outcome = 'none' AND decided_at IS NULL AND decided_by IS NULL)
      OR
      (disciplinary_outcome <> 'none' AND decided_at IS NOT NULL AND decided_by IS NOT NULL)
    ),
  CONSTRAINT disciplinary_incidents_closure_consistency_check
    CHECK (
      (incident_status <> 'closed' AND closed_at IS NULL AND closed_by IS NULL)
      OR
      (incident_status = 'closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL)
    )
);

COMMENT ON TABLE public.disciplinary_incidents IS
  'Registre administratif privé. Les faits, l état du dossier et la décision humaine sont séparés.';
COMMENT ON COLUMN public.disciplinary_incidents.factual_description IS
  'Description factuelle et minimisée. Ne pas saisir de diagnostic, opinion ou donnée sensible inutile.';
COMMENT ON COLUMN public.disciplinary_incidents.disciplinary_outcome IS
  'Décision humaine. Aucune catégorie ou gravité ne déclenche automatiquement une sanction.';
COMMENT ON COLUMN public.disciplinary_incidents.corrective_action_reference IS
  'Lien textuel préparatoire vers une action corrective ; registre complet reporté au Sprint 1.1.';

CREATE INDEX disciplinary_incidents_learner_idx
  ON public.disciplinary_incidents (learner_user_id, reported_at DESC);
CREATE INDEX disciplinary_incidents_course_idx
  ON public.disciplinary_incidents (course_id, reported_at DESC);
CREATE INDEX disciplinary_incidents_status_idx
  ON public.disciplinary_incidents (incident_status, severity, reported_at DESC);

CREATE TABLE public.disciplinary_hearings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.disciplinary_incidents(id) ON DELETE RESTRICT,
  convocation_sent_at timestamptz,
  scheduled_at timestamptz NOT NULL,
  meeting_mode text NOT NULL,
  meeting_provider text,
  external_meeting_url text,
  learner_observations text,
  assistance_details text,
  meeting_minutes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disciplinary_hearings_mode_check
    CHECK (meeting_mode IN ('in_person', 'remote')),
  CONSTRAINT disciplinary_hearings_provider_check
    CHECK (meeting_provider IS NULL OR meeting_provider IN ('google_meet', 'microsoft_teams', 'other')),
  CONSTRAINT disciplinary_hearings_url_check
    CHECK (
      external_meeting_url IS NULL
      OR (char_length(external_meeting_url) <= 2000 AND external_meeting_url ~ '^https://')
    ),
  CONSTRAINT disciplinary_hearings_observations_check
    CHECK (learner_observations IS NULL OR char_length(learner_observations) <= 10000),
  CONSTRAINT disciplinary_hearings_assistance_check
    CHECK (assistance_details IS NULL OR char_length(assistance_details) <= 3000),
  CONSTRAINT disciplinary_hearings_minutes_check
    CHECK (meeting_minutes IS NULL OR char_length(meeting_minutes) <= 15000)
);

CREATE INDEX disciplinary_hearings_incident_idx
  ON public.disciplinary_hearings (incident_id, scheduled_at DESC);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id text,
  previous_state jsonb,
  new_state jsonb,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_action_check
    CHECK (char_length(btrim(action_type)) BETWEEN 2 AND 100),
  CONSTRAINT audit_log_target_type_check
    CHECK (char_length(btrim(target_type)) BETWEEN 2 AND 100),
  CONSTRAINT audit_log_target_id_check
    CHECK (char_length(btrim(target_id)) BETWEEN 1 AND 200),
  CONSTRAINT audit_log_reason_check
    CHECK (reason IS NULL OR char_length(reason) <= 2000),
  CONSTRAINT audit_log_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.audit_log IS
  'Journal transverse append-only raisonnablement protégé. Il ne constitue pas un système infalsifiable.';

CREATE INDEX audit_log_target_idx
  ON public.audit_log (target_type, target_id, created_at DESC);
CREATE INDEX audit_log_actor_idx
  ON public.audit_log (actor_user_id, created_at DESC);
CREATE INDEX audit_log_learner_course_idx
  ON public.audit_log (target_user_id, course_id, created_at DESC);

ALTER TABLE public.incident_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_incidents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_hearings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture des catégories d incident authentifiée"
ON public.incident_categories
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Gestion des catégories par l administrateur"
ON public.incident_categories
FOR ALL TO authenticated
USING ((SELECT private.is_strict_admin()))
WITH CHECK ((SELECT private.is_strict_admin()));

CREATE POLICY "Lecture administrative des incidents"
ON public.disciplinary_incidents
FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

CREATE POLICY "Lecture administrative des entretiens disciplinaires"
ON public.disciplinary_hearings
FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

CREATE POLICY "Lecture administrative du journal d audit"
ON public.audit_log
FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

REVOKE ALL ON public.incident_categories, public.disciplinary_incidents,
  public.disciplinary_hearings, public.audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.incident_categories, public.disciplinary_incidents,
  public.disciplinary_hearings, public.audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.incident_categories TO authenticated;
GRANT ALL ON public.incident_categories, public.disciplinary_incidents,
  public.disciplinary_hearings TO service_role;
GRANT SELECT, INSERT ON public.audit_log TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM service_role;

CREATE OR REPLACE FUNCTION private.reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Le journal d audit est append-only.' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION private.reject_audit_log_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER audit_log_reject_update
BEFORE UPDATE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION private.reject_audit_log_mutation();

CREATE TRIGGER audit_log_reject_delete
BEFORE DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION private.reject_audit_log_mutation();

CREATE OR REPLACE FUNCTION private.audit_sensitive_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action_type text;
  v_reason text := nullif(current_setting('formaprompt.audit_reason', true), '');
  v_incident_id text := nullif(current_setting('formaprompt.incident_id', true), '');
  v_actor uuid := (SELECT auth.uid());
  v_target_user_id uuid;
  v_course_id text;
BEGIN
  IF TG_TABLE_NAME = 'course_access' THEN
    IF v_reason IS NULL THEN
      v_reason := CASE COALESCE(NEW.access_source, OLD.access_source)
        WHEN 'stripe' THEN 'Attribution après paiement Stripe confirmé'
        WHEN 'opco' THEN 'Attribution liée à un dossier OPCO'
        WHEN 'admin' THEN 'Attribution administrative'
        WHEN 'manual' THEN 'Attribution manuelle'
        WHEN 'gift' THEN 'Attribution offerte'
        ELSE 'Mise à jour technique du droit d accès'
      END;
    END IF;
    v_target_user_id := COALESCE(NEW.user_id, OLD.user_id);
    v_course_id := COALESCE(NEW.course_id, OLD.course_id);
    v_action_type := CASE
      WHEN TG_OP = 'INSERT' THEN 'access_granted'
      WHEN NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'suspended' THEN 'access_suspended'
      WHEN NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'active' THEN 'access_reactivated'
      WHEN NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'revoked' THEN 'access_revoked'
      WHEN NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'refunded' THEN 'access_marked_refunded'
      ELSE 'course_access_updated'
    END;
  ELSE
    v_target_user_id := COALESCE(NEW.learner_user_id, OLD.learner_user_id);
    v_course_id := COALESCE(NEW.course_id, OLD.course_id);
    v_action_type := CASE
      WHEN TG_OP = 'INSERT' THEN 'incident_created'
      WHEN NEW.disciplinary_outcome IS DISTINCT FROM OLD.disciplinary_outcome THEN 'disciplinary_outcome_recorded'
      WHEN NEW.incident_status IS DISTINCT FROM OLD.incident_status AND NEW.incident_status = 'closed' THEN 'incident_closed'
      WHEN NEW.incident_status IS DISTINCT FROM OLD.incident_status THEN 'incident_status_changed'
      ELSE 'incident_updated'
    END;
  END IF;

  INSERT INTO public.audit_log (
    actor_user_id, action_type, target_type, target_id,
    target_user_id, course_id, previous_state, new_state, reason, metadata
  ) VALUES (
    v_actor,
    v_action_type,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    v_target_user_id,
    v_course_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    v_reason,
    CASE WHEN v_incident_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('incident_id', v_incident_id) END
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.audit_sensitive_row_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER audit_course_access_changes
AFTER INSERT OR UPDATE ON public.course_access
FOR EACH ROW EXECUTE FUNCTION private.audit_sensitive_row_change();

CREATE TRIGGER audit_disciplinary_incident_changes
AFTER INSERT OR UPDATE ON public.disciplinary_incidents
FOR EACH ROW EXECUTE FUNCTION private.audit_sensitive_row_change();

CREATE OR REPLACE FUNCTION private.audit_disciplinary_hearing_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_incident public.disciplinary_incidents%ROWTYPE;
BEGIN
  SELECT * INTO v_incident
  FROM public.disciplinary_incidents
  WHERE id = NEW.incident_id;

  INSERT INTO public.audit_log (
    actor_user_id, action_type, target_type, target_id,
    target_user_id, course_id, previous_state, new_state, reason, metadata
  ) VALUES (
    (SELECT auth.uid()),
    CASE WHEN TG_OP = 'INSERT' THEN 'disciplinary_hearing_created' ELSE 'disciplinary_hearing_updated' END,
    TG_TABLE_NAME,
    NEW.id::text,
    v_incident.learner_user_id,
    v_incident.course_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    to_jsonb(NEW),
    nullif(current_setting('formaprompt.audit_reason', true), ''),
    jsonb_build_object('incident_id', NEW.incident_id)
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.audit_disciplinary_hearing_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER audit_disciplinary_hearing_changes
AFTER INSERT OR UPDATE ON public.disciplinary_hearings
FOR EACH ROW EXECUTE FUNCTION private.audit_disciplinary_hearing_change();

CREATE OR REPLACE FUNCTION public.admin_change_course_access(
  p_access_id uuid,
  p_action text,
  p_reason text,
  p_suspension_ends_at timestamptz DEFAULT NULL,
  p_incident_id uuid DEFAULT NULL
)
RETURNS public.course_access
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access public.course_access%ROWTYPE;
  v_result public.course_access%ROWTYPE;
  v_incident public.disciplinary_incidents%ROWTYPE;
  v_new_status text;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;

  IF char_length(btrim(coalesce(p_reason, ''))) < 5 OR char_length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'Un motif factuel de 5 à 2000 caractères est requis.';
  END IF;

  SELECT * INTO v_access
  FROM public.course_access
  WHERE id = p_access_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Droit d accès introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF p_incident_id IS NOT NULL THEN
    SELECT * INTO v_incident
    FROM public.disciplinary_incidents
    WHERE id = p_incident_id;
    IF NOT FOUND
      OR v_incident.learner_user_id <> v_access.user_id
      OR v_incident.course_id <> v_access.course_id THEN
      RAISE EXCEPTION 'Incident incompatible avec ce droit d accès.';
    END IF;
  END IF;

  v_new_status := CASE p_action
    WHEN 'suspend' THEN 'suspended'
    WHEN 'reactivate' THEN 'active'
    WHEN 'revoke' THEN 'revoked'
    WHEN 'mark_refunded' THEN 'refunded'
    ELSE NULL
  END;

  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'Action de cycle de vie invalide.';
  END IF;
  IF p_action = 'suspend' AND v_access.status <> 'active' THEN
    RAISE EXCEPTION 'Seul un accès actif peut être suspendu.';
  END IF;
  IF p_action = 'reactivate' AND v_access.status <> 'suspended' THEN
    RAISE EXCEPTION 'Seul un accès suspendu peut être réactivé.';
  END IF;
  IF p_action IN ('revoke', 'mark_refunded') AND v_access.status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Cet accès ne peut plus recevoir cette décision.';
  END IF;
  IF p_action <> 'suspend' AND p_suspension_ends_at IS NOT NULL THEN
    RAISE EXCEPTION 'Une fin prévue ne concerne que la suspension.';
  END IF;

  PERFORM set_config('formaprompt.audit_reason', btrim(p_reason), true);
  PERFORM set_config('formaprompt.incident_id', coalesce(p_incident_id::text, ''), true);

  UPDATE public.course_access
  SET status = v_new_status,
      suspension_ends_at = CASE WHEN p_action = 'suspend' THEN p_suspension_ends_at ELSE NULL END,
      status_changed_at = now(),
      updated_at = now()
  WHERE id = p_access_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_change_course_access(uuid, text, text, timestamptz, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_change_course_access(uuid, text, text, timestamptz, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_course_access(
  p_target_user_id uuid,
  p_course_id text,
  p_reason text DEFAULT 'Attribution administrative explicite'
)
RETURNS public.course_access
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.course_access%ROWTYPE;
  v_result public.course_access%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) < 5 OR char_length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'Un motif de 5 à 2000 caractères est requis.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Compte apprenant introuvable.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_existing
  FROM public.course_access
  WHERE user_id = p_target_user_id AND course_id = btrim(p_course_id)
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'active'
      AND (v_existing.expires_at IS NULL OR v_existing.expires_at > now()) THEN
      RETURN v_existing;
    END IF;
    RAISE EXCEPTION 'Un droit existe déjà. Utilisez une décision explicite de cycle de vie.';
  END IF;

  PERFORM set_config('formaprompt.audit_reason', btrim(p_reason), true);
  INSERT INTO public.course_access (
    user_id, course_id, status, access_source, granted_at,
    expires_at, status_changed_at, updated_at
  ) VALUES (
    p_target_user_id, btrim(p_course_id), 'active', 'admin', now(),
    NULL, now(), now()
  ) RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_course_access(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_course_access(uuid, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_disciplinary_incident(
  p_learner_user_id uuid,
  p_course_id text,
  p_occurred_at timestamptz,
  p_category_id text,
  p_factual_description text,
  p_severity text DEFAULT 'medium',
  p_booking_request_id uuid DEFAULT NULL,
  p_responsible_admin_id uuid DEFAULT NULL
)
RETURNS public.disciplinary_incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_result public.disciplinary_incidents%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_learner_user_id) THEN
    RAISE EXCEPTION 'Compte apprenant introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.incident_categories WHERE id = p_category_id AND is_active) THEN
    RAISE EXCEPTION 'Catégorie d incident invalide.';
  END IF;
  IF p_occurred_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'La date des faits ne peut pas être future.';
  END IF;

  PERFORM set_config('formaprompt.audit_reason', 'Création d un signalement administratif', true);
  INSERT INTO public.disciplinary_incidents (
    learner_user_id, course_id, booking_request_id, occurred_at,
    reported_by, category_id, factual_description, severity,
    responsible_admin_id
  ) VALUES (
    p_learner_user_id, btrim(p_course_id), p_booking_request_id, p_occurred_at,
    v_actor, p_category_id, btrim(p_factual_description), p_severity,
    coalesce(p_responsible_admin_id, v_actor)
  ) RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_disciplinary_incident(
  uuid, text, timestamptz, text, text, text, uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_disciplinary_incident(
  uuid, text, timestamptz, text, text, text, uuid, uuid
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_disciplinary_incident(
  p_incident_id uuid,
  p_reason text,
  p_incident_status text DEFAULT NULL,
  p_measures_taken text DEFAULT NULL,
  p_disciplinary_outcome text DEFAULT NULL,
  p_decision_summary text DEFAULT NULL,
  p_corrective_action_reference text DEFAULT NULL
)
RETURNS public.disciplinary_incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_current public.disciplinary_incidents%ROWTYPE;
  v_result public.disciplinary_incidents%ROWTYPE;
  v_status text;
  v_outcome text;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) < 5 OR char_length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'Un motif factuel de 5 à 2000 caractères est requis.';
  END IF;

  SELECT * INTO v_current
  FROM public.disciplinary_incidents
  WHERE id = p_incident_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident introuvable.' USING ERRCODE = 'P0002';
  END IF;

  v_status := coalesce(p_incident_status, v_current.incident_status);
  v_outcome := coalesce(p_disciplinary_outcome, v_current.disciplinary_outcome);
  IF v_status NOT IN ('reported', 'under_review', 'conservatory_measure', 'hearing_pending', 'decision_pending', 'closed') THEN
    RAISE EXCEPTION 'Statut d incident invalide.';
  END IF;
  IF v_outcome NOT IN ('none', 'no_action', 'warning', 'reprimand', 'temporary_exclusion', 'permanent_exclusion', 'other') THEN
    RAISE EXCEPTION 'Décision disciplinaire invalide.';
  END IF;
  IF v_current.disciplinary_outcome <> 'none' AND v_outcome = 'none' THEN
    RAISE EXCEPTION 'Une décision enregistrée ne peut pas être effacée.';
  END IF;
  IF v_outcome <> 'none' AND char_length(btrim(coalesce(p_decision_summary, v_current.decision_summary, ''))) < 10 THEN
    RAISE EXCEPTION 'Une décision motivée est requise.';
  END IF;
  IF v_status = 'closed' AND v_outcome = 'none' THEN
    RAISE EXCEPTION 'Une clôture exige une décision, y compris sans suite.';
  END IF;

  PERFORM set_config('formaprompt.audit_reason', btrim(p_reason), true);
  UPDATE public.disciplinary_incidents
  SET incident_status = v_status,
      measures_taken = coalesce(p_measures_taken, measures_taken),
      disciplinary_outcome = v_outcome,
      decision_summary = coalesce(p_decision_summary, decision_summary),
      corrective_action_reference = coalesce(p_corrective_action_reference, corrective_action_reference),
      decided_at = CASE
        WHEN v_outcome <> 'none' AND disciplinary_outcome = 'none' THEN now()
        ELSE decided_at
      END,
      decided_by = CASE
        WHEN v_outcome <> 'none' AND disciplinary_outcome = 'none' THEN v_actor
        ELSE decided_by
      END,
      closed_at = CASE WHEN v_status = 'closed' THEN coalesce(closed_at, now()) ELSE NULL END,
      closed_by = CASE WHEN v_status = 'closed' THEN coalesce(closed_by, v_actor) ELSE NULL END,
      updated_at = now()
  WHERE id = p_incident_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_disciplinary_incident(
  uuid, text, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_disciplinary_incident(
  uuid, text, text, text, text, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_disciplinary_hearing(
  p_incident_id uuid,
  p_reason text,
  p_scheduled_at timestamptz,
  p_meeting_mode text,
  p_convocation_sent_at timestamptz DEFAULT NULL,
  p_meeting_provider text DEFAULT NULL,
  p_external_meeting_url text DEFAULT NULL,
  p_learner_observations text DEFAULT NULL,
  p_assistance_details text DEFAULT NULL,
  p_meeting_minutes text DEFAULT NULL,
  p_hearing_id uuid DEFAULT NULL
)
RETURNS public.disciplinary_hearings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_result public.disciplinary_hearings%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) < 5 OR char_length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'Un motif de 5 à 2000 caractères est requis.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.disciplinary_incidents WHERE id = p_incident_id) THEN
    RAISE EXCEPTION 'Incident introuvable.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('formaprompt.audit_reason', btrim(p_reason), true);
  IF p_hearing_id IS NULL THEN
    INSERT INTO public.disciplinary_hearings (
      incident_id, convocation_sent_at, scheduled_at, meeting_mode,
      meeting_provider, external_meeting_url, learner_observations,
      assistance_details, meeting_minutes, created_by
    ) VALUES (
      p_incident_id, p_convocation_sent_at, p_scheduled_at, p_meeting_mode,
      p_meeting_provider, nullif(btrim(p_external_meeting_url), ''),
      nullif(btrim(p_learner_observations), ''), nullif(btrim(p_assistance_details), ''),
      nullif(btrim(p_meeting_minutes), ''), v_actor
    ) RETURNING * INTO v_result;
  ELSE
    UPDATE public.disciplinary_hearings
    SET convocation_sent_at = p_convocation_sent_at,
        scheduled_at = p_scheduled_at,
        meeting_mode = p_meeting_mode,
        meeting_provider = p_meeting_provider,
        external_meeting_url = nullif(btrim(p_external_meeting_url), ''),
        learner_observations = nullif(btrim(p_learner_observations), ''),
        assistance_details = nullif(btrim(p_assistance_details), ''),
        meeting_minutes = nullif(btrim(p_meeting_minutes), ''),
        updated_at = now()
    WHERE id = p_hearing_id AND incident_id = p_incident_id
    RETURNING * INTO v_result;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entretien disciplinaire introuvable.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_disciplinary_hearing(
  uuid, text, timestamptz, text, timestamptz, text, text, text, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_disciplinary_hearing(
  uuid, text, timestamptz, text, timestamptz, text, text, text, text, text, uuid
) TO authenticated;

-- Les colonnes ajoutées sont neutres et peuvent être affichées à l'apprenant.
-- Les motifs, décisions et pièces restent dans les tables administratives.
GRANT SELECT (
  id, user_id, course_id, status, access_source, purchase_id,
  granted_at, expires_at, created_at, updated_at,
  status_changed_at, suspension_ends_at
) ON public.course_access TO authenticated;

COMMIT;
