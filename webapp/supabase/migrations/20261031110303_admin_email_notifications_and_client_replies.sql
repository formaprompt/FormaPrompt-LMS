-- Prepared locally only. No historical backfill and no network call in a trigger.
BEGIN;

CREATE TABLE public.admin_email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('contact_request', 'payment_confirmed')),
  source_id uuid NOT NULL,
  deduplication_key text NOT NULL UNIQUE CHECK (char_length(deduplication_key) BETWEEN 16 AND 240),
  recipient_email text NOT NULL DEFAULT 'formaprompt@gmail.com' CHECK (recipient_email = 'formaprompt@gmail.com'),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','uncertain')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 100),
  attempted_at timestamptz,
  sent_at timestamptz,
  error_code text CHECK (error_code IS NULL OR error_code ~ '^[a-z0-9_]{2,100}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, source_id)
);
CREATE INDEX admin_email_notifications_pending_idx ON public.admin_email_notifications(status, created_at);
ALTER TABLE public.admin_email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_notifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_email_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_email_notifications TO service_role;
COMMENT ON TABLE public.admin_email_notifications IS 'Private-to-service outbox. No client message, name or customer email. Admin access is verified by the Edge endpoint.';

-- Trigger-only function in the unexposed private schema. The definer is needed
-- because the existing public contact INSERT cannot access the protected outbox.
-- No caller-supplied destination, network request, SQL command or elevated RPC.
CREATE FUNCTION private.enqueue_contact_admin_email() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.admin_email_notifications(kind,source_id,deduplication_key)
  VALUES ('contact_request', NEW.id, 'contact:' || NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enqueue_contact_admin_email() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER contact_request_admin_email AFTER INSERT ON public.contact_requests
FOR EACH ROW EXECUTE FUNCTION private.enqueue_contact_admin_email();

CREATE FUNCTION private.enqueue_payment_admin_email() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_event public.stripe_webhook_events%ROWTYPE;
BEGIN
  IF NEW.status <> 'paid' OR (TG_OP = 'UPDATE' AND OLD.status = 'paid') THEN RETURN NEW; END IF;
  SELECT * INTO v_event FROM public.stripe_webhook_events WHERE event_id=NEW.last_event_id;
  IF NOT FOUND OR v_event.livemode IS DISTINCT FROM true
    OR v_event.event_type NOT IN ('checkout.session.completed','checkout.session.async_payment_succeeded')
    OR v_event.stripe_created_at < TG_ARGV[0]::timestamptz
    OR NEW.amount_total IS NULL OR NEW.amount_total <= 0
  THEN RETURN NEW; END IF;
  INSERT INTO public.admin_email_notifications(kind,source_id,deduplication_key,payload)
  VALUES ('payment_confirmed', NEW.id,
    'payment:' || coalesce(NEW.stripe_payment_intent_id,NEW.stripe_checkout_session_id),
    jsonb_build_object('amount_cents',NEW.amount_total,'currency',NEW.currency,'payment_type',NEW.payment_type))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enqueue_payment_admin_email() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.enqueue_payment_admin_email() TO service_role;
DO $$ BEGIN
  EXECUTE format('CREATE TRIGGER payment_admin_email AFTER INSERT OR UPDATE ON public.stripe_payment_transactions FOR EACH ROW EXECUTE FUNCTION private.enqueue_payment_admin_email(%L)', clock_timestamp()::text);
END $$;

ALTER TABLE public.commercial_communications
  ADD COLUMN attachment_metadata jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(attachment_metadata)='array' AND jsonb_array_length(attachment_metadata)<=3),
  ADD COLUMN reply_fingerprint text CHECK (reply_fingerprint IS NULL OR reply_fingerprint ~ '^[a-f0-9]{64}$'),
  ADD COLUMN delivery_attempts integer NOT NULL DEFAULT 0 CHECK (delivery_attempts BETWEEN 0 AND 100);
ALTER TABLE public.commercial_communications DROP CONSTRAINT commercial_communications_delivery_check;
ALTER TABLE public.commercial_communications ADD CONSTRAINT commercial_communications_delivery_check
  CHECK (delivery_status IN ('prepared','sending','sent','failed','cancelled','uncertain'));

COMMIT;

