BEGIN;

ALTER TABLE public.contact_requests
  ADD COLUMN discarded_at timestamptz,
  ADD COLUMN discarded_reason text,
  ADD CONSTRAINT contact_request_discard_check CHECK (
    (discarded_at IS NULL AND discarded_reason IS NULL)
    OR (discarded_at IS NOT NULL AND discarded_reason IS NOT NULL AND discarded_reason IN ('spam', 'test'))
  );

CREATE TABLE public.contact_email_blocks (
  email text PRIMARY KEY CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 320),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '180 days')
);
ALTER TABLE public.contact_email_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_email_blocks FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON public.contact_email_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_email_blocks TO service_role;
CREATE POLICY contact_email_blocks_admin_read ON public.contact_email_blocks
  FOR SELECT TO authenticated USING ((SELECT private.is_strict_admin()));
CREATE POLICY contact_email_blocks_admin_unblock ON public.contact_email_blocks
  FOR DELETE TO authenticated USING ((SELECT private.is_strict_admin()));

-- Protect legacy direct inserts as well as the public contact endpoint. An
-- ignored input never reaches AFTER INSERT, so it creates no admin alert.
CREATE FUNCTION private.filter_blocked_contact_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT FROM public.contact_email_blocks
    WHERE email = lower(btrim(NEW.email)) AND expires_at > now()
  ) THEN
    RETURN NULL;
  END IF;
  NEW.discarded_at := NULL;
  NEW.discarded_reason := NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.filter_blocked_contact_request() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER contact_request_filter_blocked_email BEFORE INSERT ON public.contact_requests
  FOR EACH ROW EXECUTE FUNCTION private.filter_blocked_contact_request();

-- A discarded alert is not a sent alert and must not be offered for retry.
ALTER TABLE public.admin_email_notifications
  DROP CONSTRAINT admin_email_notifications_status_check,
  ADD CONSTRAINT admin_email_notifications_status_check
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'uncertain', 'dismissed'));

CREATE FUNCTION public.moderate_commercial_request(
  p_actor_id uuid, p_request_id uuid, p_action text, p_block_email boolean DEFAULT false
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_request public.contact_requests%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT FROM public.profiles WHERE id = p_actor_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Action réservée aux administrateurs.' USING ERRCODE = '42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('spam', 'test', 'restore', 'delete')
     OR (p_block_email IS TRUE AND p_action <> 'spam') THEN
    RAISE EXCEPTION 'Action de modération invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request FROM public.contact_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.' USING ERRCODE = 'FP404';
  END IF;

  IF p_action = 'restore' THEN
    UPDATE public.contact_requests SET discarded_at = NULL, discarded_reason = NULL, updated_at = now()
    WHERE id = p_request_id AND discarded_at IS NOT NULL;
    RETURN;
  END IF;

  IF p_action = 'delete' THEN
    IF v_request.discarded_at IS NULL THEN
      RAISE EXCEPTION 'Placez d’abord la demande dans la corbeille.' USING ERRCODE = 'FP409';
    END IF;
    IF v_request.status = 'won' OR v_request.converted_at IS NOT NULL
      OR EXISTS (SELECT FROM public.commercial_quotes WHERE contact_request_id = p_request_id)
      OR EXISTS (SELECT FROM public.commercial_communications WHERE contact_request_id = p_request_id)
      OR EXISTS (SELECT FROM public.commercial_follow_ups WHERE contact_request_id = p_request_id)
      OR EXISTS (SELECT FROM public.training_enrollments WHERE commercial_request_id = p_request_id)
      OR EXISTS (SELECT FROM public.quality_complaints WHERE contact_request_id = p_request_id)
    THEN
      RAISE EXCEPTION 'Cette demande est liée à un dossier commercial ou qualité. Elle peut rester dans la corbeille ou être restaurée.' USING ERRCODE = 'FP409';
    END IF;
    IF EXISTS (
      SELECT FROM public.admin_email_notifications
      WHERE kind = 'contact_request' AND source_id = p_request_id AND status IN ('sending', 'uncertain')
    ) THEN
      RAISE EXCEPTION 'Vérifiez d’abord le résultat de l’alerte e-mail de cette demande.' USING ERRCODE = 'FP409';
    END IF;
    DELETE FROM public.contact_requests WHERE id = p_request_id;
    RETURN;
  END IF;

  IF v_request.status = 'won' THEN
    RAISE EXCEPTION 'Une demande convertie en inscription ne peut pas être mise à la corbeille.' USING ERRCODE = 'FP409';
  END IF;
  IF v_request.discarded_at IS NOT NULL AND v_request.discarded_reason <> p_action THEN
    RAISE EXCEPTION 'Restaurez cette demande avant de changer le motif.' USING ERRCODE = 'FP409';
  END IF;

  IF p_block_email IS TRUE THEN
    DELETE FROM public.contact_email_blocks WHERE expires_at <= now();
    INSERT INTO public.contact_email_blocks (email) VALUES (lower(btrim(v_request.email)))
    ON CONFLICT (email) DO NOTHING;
  END IF;
  UPDATE public.contact_requests
  SET discarded_at = now(), discarded_reason = p_action, updated_at = now()
  WHERE id = p_request_id AND discarded_at IS NULL;
  UPDATE public.admin_email_notifications SET status = 'dismissed', updated_at = now()
  WHERE kind = 'contact_request' AND source_id = p_request_id AND status IN ('pending', 'failed');
END;
$$;
REVOKE ALL ON FUNCTION public.moderate_commercial_request(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_commercial_request(uuid, uuid, text, boolean) TO service_role;

COMMIT;
