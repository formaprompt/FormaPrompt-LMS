BEGIN;

ALTER TABLE public.commercial_communications ADD COLUMN removed_from_timeline_at timestamptz;

CREATE FUNCTION public.remove_commercial_message(
  p_actor_id uuid, p_request_id uuid, p_communication_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL, p_block_email boolean DEFAULT false
)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_request public.contact_requests%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT FROM public.profiles WHERE id = p_actor_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Action réservée aux administrateurs.' USING ERRCODE = '42501';
  END IF;
  IF (p_reason IS NOT NULL AND p_reason NOT IN ('spam', 'test'))
    OR (p_block_email IS TRUE AND p_reason IS DISTINCT FROM 'spam')
    OR (p_communication_id IS NOT NULL AND p_reason IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Motif ou action de suppression invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request FROM public.contact_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.' USING ERRCODE = 'FP404';
  END IF;

  IF p_communication_id IS NOT NULL THEN
    PERFORM 1 FROM public.commercial_communications
      WHERE id = p_communication_id AND contact_request_id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Communication introuvable pour cette demande.' USING ERRCODE = 'FP404';
    END IF;
    BEGIN
      PERFORM public.cleanup_commercial_activity(p_actor_id,p_request_id,'delete_test_communication',p_communication_id);
      RETURN 'deleted';
    EXCEPTION WHEN SQLSTATE 'FP409' THEN
      UPDATE public.commercial_communications
        SET removed_from_timeline_at = COALESCE(removed_from_timeline_at, now())
        WHERE id = p_communication_id;
      RETURN 'archived';
    END;
  END IF;

  IF v_request.discarded_at IS NULL AND p_reason IS NULL THEN
    RAISE EXCEPTION 'Choisissez Spam ou Test avant la suppression.' USING ERRCODE = '22023';
  END IF;
  IF v_request.status = 'won' OR v_request.converted_at IS NOT NULL
    OR v_request.converted_enrollment_id IS NOT NULL
    OR EXISTS (SELECT FROM public.commercial_quotes WHERE contact_request_id = p_request_id)
    OR EXISTS (SELECT FROM public.training_enrollments WHERE commercial_request_id = p_request_id)
    OR EXISTS (SELECT FROM public.quality_complaints WHERE contact_request_id = p_request_id)
  THEN
    RAISE EXCEPTION 'Cette demande est liée à un devis, une inscription ou un dossier qualité.' USING ERRCODE = 'FP409';
  END IF;
  PERFORM 1 FROM public.commercial_communications WHERE contact_request_id = p_request_id FOR UPDATE;
  IF EXISTS (SELECT FROM public.commercial_communications WHERE contact_request_id = p_request_id AND delivery_status = 'sending')
    OR EXISTS (
      SELECT FROM public.admin_email_notifications
      WHERE kind = 'contact_request' AND source_id = p_request_id AND status IN ('sending', 'uncertain')
    )
  THEN
    RAISE EXCEPTION 'Attendez la fin de l’envoi en cours ou vérifiez l’alerte e-mail de cette demande.' USING ERRCODE = 'FP409';
  END IF;

  IF p_reason IS NOT NULL THEN
    -- Reuse the existing moderation and address-block transaction. The
    -- address is only blocked when explicitly selected by the administrator.
    PERFORM public.moderate_commercial_request(p_actor_id,p_request_id,p_reason,p_block_email);
  END IF;
  UPDATE public.commercial_communications c SET contact_request_id = NULL,
    delivery_status = CASE WHEN c.delivery_status = 'sent' OR c.sent_at IS NOT NULL THEN 'sent' ELSE 'uncertain' END
  WHERE c.contact_request_id = p_request_id AND c.channel = 'email' AND c.direction = 'outbound'
    AND (c.delivery_status IN ('sent', 'uncertain', 'failed') OR c.sent_at IS NOT NULL OR c.provider_message_id IS NOT NULL)
    AND NOT private.is_removable_commercial_test(c);
  DELETE FROM public.contact_requests WHERE id = p_request_id;
  RETURN 'deleted';
END;
$$;
REVOKE ALL ON FUNCTION public.remove_commercial_message(uuid, uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_commercial_message(uuid, uuid, uuid, text, boolean) TO service_role;

COMMIT;
