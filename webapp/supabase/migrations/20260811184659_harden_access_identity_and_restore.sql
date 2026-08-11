-- Correctif Sprint 1 : cible d'accès non ambiguë et restauration d'une
-- révocation administrative. Aucune donnée existante n'est modifiée.

BEGIN;

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
      WHEN NEW.status IS DISTINCT FROM OLD.status AND OLD.status = 'suspended' AND NEW.status = 'active' THEN 'access_reactivated'
      WHEN NEW.status IS DISTINCT FROM OLD.status AND OLD.status = 'revoked' AND NEW.status = 'active' THEN 'access_restored'
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

DROP FUNCTION public.admin_change_course_access(uuid, text, text, timestamptz, uuid);

CREATE FUNCTION public.admin_change_course_access(
  p_access_id uuid,
  p_expected_user_id uuid,
  p_expected_course_id text,
  p_action text,
  p_reason text,
  p_suspension_ends_at timestamptz DEFAULT NULL,
  p_incident_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access public.course_access%ROWTYPE;
  v_result public.course_access%ROWTYPE;
  v_incident public.disciplinary_incidents%ROWTYPE;
  v_new_status text;
  v_target_count integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action réservée au rôle admin.' USING ERRCODE = '42501';
  END IF;

  IF char_length(btrim(coalesce(p_reason, ''))) < 5 OR char_length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'Un motif factuel de 5 à 2000 caractères est requis.';
  END IF;
  IF p_access_id IS NULL
    OR p_expected_user_id IS NULL
    OR char_length(btrim(coalesce(p_expected_course_id, ''))) < 2 THEN
    RAISE EXCEPTION 'Les identifiants du droit, de l apprenant et de la formation sont requis.';
  END IF;

  SELECT count(*) INTO v_target_count
  FROM public.course_access
  WHERE id = p_access_id;

  IF v_target_count <> 1 THEN
    INSERT INTO public.audit_log (
      actor_user_id, action_type, target_type, target_id,
      target_user_id, course_id, reason, metadata
    ) VALUES (
      (SELECT auth.uid()),
      'course_access_target_mismatch',
      'course_access',
      coalesce(p_access_id::text, '[identifiant absent]'),
      p_expected_user_id,
      p_expected_course_id,
      'Modification refusée : le nombre de droits correspondant à l identifiant est différent de un.',
      jsonb_build_object('target_count', v_target_count, 'requested_action', p_action, 'requested_reason', btrim(p_reason))
    );
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'target_count_mismatch',
      'message', 'La modification a été refusée car le droit ciblé est introuvable ou ambigu.'
    );
  END IF;

  SELECT * INTO v_access
  FROM public.course_access
  WHERE id = p_access_id
  FOR UPDATE;

  IF v_access.user_id <> p_expected_user_id OR v_access.course_id <> p_expected_course_id THEN
    INSERT INTO public.audit_log (
      actor_user_id, action_type, target_type, target_id,
      target_user_id, course_id, previous_state, reason, metadata
    ) VALUES (
      (SELECT auth.uid()),
      'course_access_target_mismatch',
      'course_access',
      p_access_id::text,
      v_access.user_id,
      v_access.course_id,
      to_jsonb(v_access),
      'Modification refusée : les identifiants attendus ne correspondent pas au droit ciblé.',
      jsonb_build_object(
        'actual_user_id', v_access.user_id,
        'actual_course_id', v_access.course_id,
        'expected_user_id', p_expected_user_id,
        'expected_course_id', p_expected_course_id,
        'requested_action', p_action,
        'requested_reason', btrim(p_reason)
      )
    );
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'target_identity_mismatch',
      'message', 'La modification a été refusée car l apprenant ou la formation ne correspond pas au droit ciblé.'
    );
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
    WHEN 'restore' THEN 'active'
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
  IF p_action = 'restore' AND v_access.status <> 'revoked' THEN
    RAISE EXCEPTION 'Seul un accès révoqué peut être restauré.';
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
    AND user_id = p_expected_user_id
    AND course_id = p_expected_course_id
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Le droit ciblé a changé pendant l opération.' USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object('ok', true, 'access', to_jsonb(v_result));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_change_course_access(
  uuid, uuid, text, text, text, timestamptz, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_change_course_access(
  uuid, uuid, text, text, text, timestamptz, uuid
) TO authenticated;

COMMIT;
