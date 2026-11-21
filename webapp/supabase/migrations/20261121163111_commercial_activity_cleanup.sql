BEGIN;

-- Detach the mail records kept after a blocked spam request is removed.
ALTER TABLE public.commercial_communications ALTER COLUMN contact_request_id DROP NOT NULL;
CREATE POLICY commercial_detached_email_admin_only ON public.commercial_communications
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (contact_request_id IS NOT NULL OR (SELECT private.is_strict_admin()));

CREATE FUNCTION private.is_removable_commercial_test(p_row public.commercial_communications)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_row.direction = 'outbound'
    AND p_row.sent_at IS NULL AND p_row.provider_message_id IS NULL
    AND (
      p_row.delivery_status IN ('prepared', 'cancelled')
      OR (p_row.delivery_status = 'failed' AND p_row.error_code IS NOT NULL
          AND p_row.error_code <> 'smtp_delivery_uncertain')
    );
$$;
REVOKE ALL ON FUNCTION private.is_removable_commercial_test(public.commercial_communications) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_removable_commercial_test(public.commercial_communications) TO service_role;

-- A sender may have read the scheduled row before an admin cancelled it.
-- Lock the same rows as the cleanup before letting the send claim be inserted.
CREATE FUNCTION private.check_commercial_follow_up_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.contact_requests
  WHERE id = NEW.contact_request_id AND discarded_at IS NULL FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cette demande ne peut plus recevoir de relance.' USING ERRCODE = 'FP409';
  END IF;
  PERFORM 1 FROM public.commercial_follow_ups
  WHERE contact_request_id = NEW.contact_request_id AND idempotency_key = NEW.idempotency_key
    AND status = 'scheduled' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cette relance a déjà été traitée.' USING ERRCODE = 'FP409';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.check_commercial_follow_up_claim() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER commercial_follow_up_claim_is_scheduled
  BEFORE INSERT ON public.commercial_communications FOR EACH ROW
  WHEN (NEW.communication_type = 'follow_up' AND NEW.delivery_status = 'sending')
  EXECUTE FUNCTION private.check_commercial_follow_up_claim();

CREATE FUNCTION public.cleanup_commercial_activity(
  p_actor_id uuid, p_request_id uuid, p_action text, p_item_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_request public.contact_requests%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT FROM public.profiles WHERE id = p_actor_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Action réservée aux administrateurs.' USING ERRCODE = '42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('cancel_follow_up', 'delete_test_follow_up', 'delete_test_communication', 'purge_blocked_spam')
    OR (p_action = 'purge_blocked_spam') <> (p_item_id IS NULL) THEN
    RAISE EXCEPTION 'Action commerciale invalide.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_request FROM public.contact_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.' USING ERRCODE = 'FP404';
  END IF;

  IF p_action = 'cancel_follow_up' THEN
    UPDATE public.commercial_follow_ups f SET status = 'cancelled', cancelled_at = now()
    WHERE f.id = p_item_id AND f.contact_request_id = p_request_id AND f.status = 'scheduled'
      AND f.sent_at IS NULL AND f.communication_id IS NULL
      AND NOT EXISTS (SELECT FROM public.commercial_communications c WHERE c.idempotency_key = f.idempotency_key);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cette relance n’est plus annulable. Actualisez la demande.' USING ERRCODE = 'FP409';
    END IF;
    INSERT INTO public.commercial_request_history(contact_request_id, actor_user_id, event_type, details)
    VALUES (p_request_id, p_actor_id, 'follow_up_cancelled', jsonb_build_object('followUpId', p_item_id));
  ELSIF p_action = 'delete_test_follow_up' THEN
    DELETE FROM public.commercial_follow_ups f
    WHERE f.id = p_item_id AND f.contact_request_id = p_request_id AND f.status IN ('cancelled', 'failed')
      AND f.sent_at IS NULL AND f.communication_id IS NULL
      AND NOT EXISTS (SELECT FROM public.commercial_communications c WHERE c.idempotency_key = f.idempotency_key);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cette relance ne peut pas être supprimée. Vérifiez d’abord sa communication associée.' USING ERRCODE = 'FP409';
    END IF;
  ELSIF p_action = 'delete_test_communication' THEN
    DELETE FROM public.commercial_communications c
    WHERE c.id = p_item_id AND c.contact_request_id = p_request_id
      AND private.is_removable_commercial_test(c)
      AND NOT EXISTS (
        SELECT FROM public.commercial_follow_ups f
        WHERE (f.idempotency_key = c.idempotency_key OR f.communication_id = c.id)
          AND (f.status IN ('scheduled', 'sent') OR f.sent_at IS NOT NULL)
      );
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ce test ne peut pas être supprimé. L’envoi ou la relance associée doit être vérifié.' USING ERRCODE = 'FP409';
    END IF;
  ELSE
    IF v_request.discarded_at IS NULL OR v_request.discarded_reason IS DISTINCT FROM 'spam' THEN
      RAISE EXCEPTION 'Placez d’abord cette demande dans la corbeille comme spam.' USING ERRCODE = 'FP409';
    END IF;
    PERFORM 1 FROM public.contact_email_blocks
      WHERE email = lower(btrim(v_request.email)) AND expires_at > now() FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cette adresse doit être bloquée pour supprimer le spam avec son historique.' USING ERRCODE = 'FP409';
    END IF;
    IF v_request.status = 'won' OR v_request.converted_at IS NOT NULL
      OR v_request.converted_enrollment_id IS NOT NULL
      OR EXISTS (SELECT FROM public.commercial_quotes WHERE contact_request_id = p_request_id)
      OR EXISTS (SELECT FROM public.training_enrollments WHERE commercial_request_id = p_request_id)
      OR EXISTS (SELECT FROM public.quality_complaints WHERE contact_request_id = p_request_id)
    THEN
      RAISE EXCEPTION 'Ce spam reste lié à un dossier commercial ou qualité.' USING ERRCODE = 'FP409';
    END IF;

    -- The request lock excludes new communications. Lock existing rows before
    -- checking in-flight mail, including retries of existing client replies.
    PERFORM 1 FROM public.commercial_communications WHERE contact_request_id = p_request_id FOR UPDATE;
    IF EXISTS (SELECT FROM public.commercial_communications WHERE contact_request_id = p_request_id AND delivery_status = 'sending')
      OR EXISTS (
        SELECT FROM public.admin_email_notifications
        WHERE kind = 'contact_request' AND source_id = p_request_id AND status IN ('sending', 'uncertain')
      )
    THEN
      RAISE EXCEPTION 'Vérifiez d’abord l’envoi en cours ou l’alerte e-mail de cette demande.' USING ERRCODE = 'FP409';
    END IF;

    UPDATE public.commercial_communications c SET contact_request_id = NULL,
      delivery_status = CASE WHEN c.delivery_status = 'sent' OR c.sent_at IS NOT NULL THEN 'sent' ELSE 'uncertain' END
    WHERE c.contact_request_id = p_request_id AND c.channel = 'email' AND c.direction = 'outbound'
      AND (c.delivery_status IN ('sent', 'uncertain', 'failed') OR c.sent_at IS NOT NULL OR c.provider_message_id IS NOT NULL)
      AND NOT private.is_removable_commercial_test(c);

    DELETE FROM public.contact_requests WHERE id = p_request_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_commercial_activity(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_commercial_activity(uuid, uuid, text, uuid) TO service_role;

COMMIT;
