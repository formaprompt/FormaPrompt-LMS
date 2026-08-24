-- Sprint 6 - Administration minimale des demandes de retractation.
-- Cette migration ne cree aucune source de droits et ne declenche aucune
-- operation Stripe, aucun remboursement et aucune mutation de course_access.

BEGIN;

CREATE FUNCTION public.admin_list_withdrawal_requests()
RETURNS SETOF public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action reservee au role admin.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT w.*
  FROM public.withdrawal_requests w
  ORDER BY
    CASE w.status
      WHEN 'received' THEN 0
      WHEN 'under_review' THEN 1
      WHEN 'accepted' THEN 2
      WHEN 'rejected' THEN 3
      ELSE 4
    END,
    w.received_at ASC;
END;
$$;

CREATE FUNCTION public.admin_update_withdrawal_request(
  p_request_id uuid,
  p_status text,
  p_reason text
)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_current public.withdrawal_requests%ROWTYPE;
  v_result public.withdrawal_requests%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action reservee au role admin.' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Un motif administratif de 10 a 2000 caracteres est requis.';
  END IF;

  SELECT * INTO v_current
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande de retractation introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    (v_current.status = 'received' AND p_status = 'under_review')
    OR (v_current.status = 'under_review' AND p_status IN ('accepted', 'rejected'))
    OR (v_current.status IN ('accepted', 'rejected') AND p_status = 'closed')
  ) THEN
    RAISE EXCEPTION 'Transition de statut de retractation interdite.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.withdrawal_requests
  SET status = p_status,
      reviewed_at = coalesce(reviewed_at, now()),
      reviewed_by = v_actor,
      admin_note = v_reason
  WHERE id = p_request_id
  RETURNING * INTO v_result;

  INSERT INTO public.audit_log (
    actor_user_id, action_type, target_type, target_id,
    target_user_id, course_id, previous_state, new_state, reason, metadata
  ) VALUES (
    v_actor, 'withdrawal_request_status_updated', 'withdrawal_request', v_result.id::text,
    v_result.user_id, v_result.course_id,
    jsonb_build_object('status', v_current.status, 'reviewed_at', v_current.reviewed_at),
    jsonb_build_object('status', v_result.status, 'reviewed_at', v_result.reviewed_at),
    v_reason,
    jsonb_strip_nulls(jsonb_build_object(
      'purchase_id', v_result.purchase_id,
      'checkout_intent_id', v_result.checkout_intent_id
    ))
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_withdrawal_requests()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_update_withdrawal_request(uuid, text, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.admin_list_withdrawal_requests()
TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_withdrawal_request(uuid, text, text)
TO authenticated;

COMMENT ON FUNCTION public.admin_update_withdrawal_request(uuid, text, text) IS
  'Instruit une retractation sans modifier course_access, Stripe, un paiement ou un remboursement.';

COMMIT;
