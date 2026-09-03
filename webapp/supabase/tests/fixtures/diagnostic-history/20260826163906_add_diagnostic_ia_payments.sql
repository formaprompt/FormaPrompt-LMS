-- LOT 1B : paiement du Diagnostic IA Express.
-- Migration additive : aucune commande Diagnostic ne crée de purchase ou de
-- course_access. Les preuves Stripe existantes restent la source financière.

BEGIN;

CREATE TABLE public.diagnostic_ia_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  customer_email text NOT NULL,
  amount_total integer NOT NULL DEFAULT 14900,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL DEFAULT 'payment_pending',
  sales_context text NOT NULL,
  cgv_document_version_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
  cgv_accepted_at timestamptz NOT NULL DEFAULT now(),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_last_event_id text REFERENCES public.stripe_webhook_events(event_id) ON DELETE RESTRICT,
  source text NOT NULL DEFAULT 'diagnostic_ia_page',
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostic_ia_orders_email_check CHECK (
    char_length(btrim(customer_email)) BETWEEN 3 AND 254
    AND customer_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  CONSTRAINT diagnostic_ia_orders_amount_check CHECK (amount_total = 14900),
  CONSTRAINT diagnostic_ia_orders_currency_check CHECK (currency = 'eur'),
  CONSTRAINT diagnostic_ia_orders_status_check CHECK (
    status IN ('payment_pending', 'paid', 'cancelled', 'refunded', 'disputed', 'chargeback')
  ),
  CONSTRAINT diagnostic_ia_orders_sales_context_check CHECK (
    sales_context IN ('personal', 'professional')
  ),
  CONSTRAINT diagnostic_ia_orders_source_check CHECK (
    char_length(btrim(source)) BETWEEN 2 AND 100
  ),
  CONSTRAINT diagnostic_ia_orders_session_check CHECK (
    stripe_checkout_session_id IS NULL OR stripe_checkout_session_id ~ '^cs_(test|live)_[A-Za-z0-9_]+'
  ),
  CONSTRAINT diagnostic_ia_orders_payment_intent_check CHECK (
    stripe_payment_intent_id IS NULL OR stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+'
  ),
  CONSTRAINT diagnostic_ia_orders_customer_check CHECK (
    stripe_customer_id IS NULL OR stripe_customer_id ~ '^cus_[A-Za-z0-9_]+'
  ),
  CONSTRAINT diagnostic_ia_orders_timestamps_check CHECK (
    (status = 'payment_pending' AND paid_at IS NULL AND cancelled_at IS NULL AND refunded_at IS NULL)
    OR (status = 'cancelled' AND paid_at IS NULL AND cancelled_at IS NOT NULL AND refunded_at IS NULL)
    OR (status IN ('paid', 'disputed', 'chargeback') AND paid_at IS NOT NULL AND refunded_at IS NULL)
    OR (status = 'refunded' AND paid_at IS NOT NULL AND refunded_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX diagnostic_ia_orders_pending_user_uidx
  ON public.diagnostic_ia_orders(user_id)
  WHERE status = 'payment_pending';
CREATE UNIQUE INDEX diagnostic_ia_orders_session_uidx
  ON public.diagnostic_ia_orders(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX diagnostic_ia_orders_payment_intent_uidx
  ON public.diagnostic_ia_orders(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX diagnostic_ia_orders_user_created_idx
  ON public.diagnostic_ia_orders(user_id, created_at DESC);
CREATE INDEX diagnostic_ia_orders_status_created_idx
  ON public.diagnostic_ia_orders(status, created_at DESC);

COMMENT ON TABLE public.diagnostic_ia_orders IS
  'Commandes du Diagnostic IA Express, distinctes des achats de formations et de course_access.';
COMMENT ON COLUMN public.diagnostic_ia_orders.customer_email IS
  'Adresse du compte authentifie au moment du paiement, conservee comme preuve de commande.';

ALTER TABLE public.diagnostic_ia_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_ia_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture de ses commandes Diagnostic IA"
ON public.diagnostic_ia_orders FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Lecture administrative des commandes Diagnostic IA"
ON public.diagnostic_ia_orders FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

REVOKE ALL ON public.diagnostic_ia_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.diagnostic_ia_orders TO authenticated;
GRANT ALL ON public.diagnostic_ia_orders TO service_role;

CREATE TRIGGER diagnostic_ia_orders_set_updated_at
BEFORE UPDATE ON public.diagnostic_ia_orders
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.stripe_payment_transactions
  ADD COLUMN diagnostic_order_id uuid REFERENCES public.diagnostic_ia_orders(id) ON DELETE RESTRICT;

ALTER TABLE public.stripe_payment_transactions
  DROP CONSTRAINT stripe_payment_transactions_type_check,
  ADD CONSTRAINT stripe_payment_transactions_type_check CHECK (
    payment_type IN ('course', 'in_person_travel_fee', 'diagnostic_ia_express')
  ),
  ADD CONSTRAINT stripe_payment_transactions_diagnostic_check CHECK (
    (payment_type = 'diagnostic_ia_express' AND (
      diagnostic_order_id IS NOT NULL
      AND purchase_id IS NULL
      AND checkout_intent_id IS NULL
      AND booking_request_id IS NULL
      AND course_id IS NULL
    ))
    OR (payment_type <> 'diagnostic_ia_express' AND diagnostic_order_id IS NULL)
  );

CREATE INDEX stripe_payment_transactions_diagnostic_order_idx
  ON public.stripe_payment_transactions(diagnostic_order_id, created_at DESC)
  WHERE diagnostic_order_id IS NOT NULL;

ALTER TABLE public.stripe_reconciliation_cases
  ADD COLUMN diagnostic_order_id uuid REFERENCES public.diagnostic_ia_orders(id) ON DELETE SET NULL;

CREATE INDEX stripe_reconciliation_cases_diagnostic_order_idx
  ON public.stripe_reconciliation_cases(diagnostic_order_id, last_seen_at DESC)
  WHERE diagnostic_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.sync_diagnostic_order_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.payment_type <> 'diagnostic_ia_express' OR NEW.diagnostic_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'paid' THEN
    UPDATE public.diagnostic_ia_orders
    SET status = 'paid',
        stripe_payment_intent_id = coalesce(NEW.stripe_payment_intent_id, stripe_payment_intent_id),
        stripe_last_event_id = NEW.last_event_id,
        paid_at = coalesce(paid_at, NEW.last_event_created_at),
        cancelled_at = NULL
    WHERE id = NEW.diagnostic_order_id
      AND status IN ('payment_pending', 'paid', 'disputed');
  ELSIF NEW.status IN ('failed', 'expired') THEN
    UPDATE public.diagnostic_ia_orders
    SET status = 'cancelled', stripe_last_event_id = NEW.last_event_id,
        cancelled_at = coalesce(cancelled_at, NEW.last_event_created_at)
    WHERE id = NEW.diagnostic_order_id AND status = 'payment_pending';
  ELSIF NEW.status = 'refunded' THEN
    UPDATE public.diagnostic_ia_orders
    SET status = 'refunded', stripe_last_event_id = NEW.last_event_id,
        refunded_at = coalesce(refunded_at, NEW.last_event_created_at)
    WHERE id = NEW.diagnostic_order_id AND status <> 'chargeback';
  ELSIF NEW.status = 'disputed' THEN
    UPDATE public.diagnostic_ia_orders
    SET status = 'disputed', stripe_last_event_id = NEW.last_event_id
    WHERE id = NEW.diagnostic_order_id AND status IN ('paid', 'disputed');
  ELSIF NEW.status = 'dispute_lost' THEN
    UPDATE public.diagnostic_ia_orders
    SET status = 'chargeback', stripe_last_event_id = NEW.last_event_id
    WHERE id = NEW.diagnostic_order_id AND status <> 'refunded';
  ELSIF NEW.status = 'dispute_won' THEN
    UPDATE public.diagnostic_ia_orders
    SET status = 'paid', stripe_last_event_id = NEW.last_event_id
    WHERE id = NEW.diagnostic_order_id AND status = 'disputed';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_diagnostic_order_from_transaction()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER stripe_transaction_sync_diagnostic_order
AFTER INSERT OR UPDATE OF status, stripe_payment_intent_id, last_event_id
ON public.stripe_payment_transactions
FOR EACH ROW EXECUTE FUNCTION private.sync_diagnostic_order_from_transaction();

CREATE OR REPLACE FUNCTION public.process_diagnostic_ia_stripe_event(p_event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_event_id text := p_event->>'event_id';
  v_event_type text := p_event->>'event_type';
  v_event_created timestamptz := (p_event->>'created_at')::timestamptz;
  v_inserted_event text;
  v_order_id uuid := private.stripe_json_uuid(p_event->>'diagnostic_order_id');
  v_user_id uuid := private.stripe_json_uuid(p_event->>'user_id');
  v_session_id text := nullif(p_event->>'stripe_checkout_session_id', '');
  v_payment_intent_id text := nullif(p_event->>'stripe_payment_intent_id', '');
  v_charge_id text := nullif(p_event->>'stripe_charge_id', '');
  v_amount_total integer := CASE WHEN p_event ? 'amount_total' THEN (p_event->>'amount_total')::integer ELSE NULL END;
  v_currency text := lower(nullif(p_event->>'currency', ''));
  v_transaction public.stripe_payment_transactions%ROWTYPE;
  v_order public.diagnostic_ia_orders%ROWTYPE;
  v_processing_result text := 'processed';
BEGIN
  IF v_event_id IS NULL OR v_event_id !~ '^evt_[A-Za-z0-9_]+' THEN
    RAISE EXCEPTION 'Identifiant evenement Stripe invalide.';
  END IF;
  IF v_event_type NOT IN (
    'checkout.session.completed', 'checkout.session.async_payment_succeeded',
    'payment_intent.payment_failed', 'checkout.session.async_payment_failed',
    'checkout.session.expired'
  ) THEN
    RAISE EXCEPTION 'Type evenement Diagnostic IA non pris en charge.';
  END IF;
  IF p_event->>'payment_type' <> 'diagnostic_ia_express'
    OR p_event->>'validation_status' <> 'validated'
    OR v_order_id IS NULL OR v_user_id IS NULL
  THEN
    RAISE EXCEPTION 'Preuve de paiement Diagnostic IA invalide.';
  END IF;

  INSERT INTO public.stripe_webhook_events (
    event_id, event_type, stripe_object_id, livemode, api_version,
    payload_sha256, stripe_created_at, processing_result
  ) VALUES (
    v_event_id, v_event_type, nullif(p_event->>'object_id', ''),
    (p_event->>'livemode')::boolean, nullif(p_event->>'api_version', ''),
    nullif(p_event->>'payload_sha256', ''), v_event_created, 'processed'
  ) ON CONFLICT (event_id) DO NOTHING
  RETURNING event_id INTO v_inserted_event;

  IF v_inserted_event IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_order_id::text, 0));

  SELECT * INTO v_order
  FROM public.diagnostic_ia_orders
  WHERE id = v_order_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_order.user_id <> v_user_id
    OR v_order.amount_total <> 14900
    OR v_order.currency <> 'eur'
    OR v_amount_total IS DISTINCT FROM 14900
    OR v_currency IS DISTINCT FROM 'eur'
    OR (v_order.stripe_checkout_session_id IS NOT NULL
      AND v_order.stripe_checkout_session_id IS DISTINCT FROM v_session_id)
  THEN
    RAISE EXCEPTION 'Commande Diagnostic IA inconnue ou incoherente.';
  END IF;

  SELECT * INTO v_transaction
  FROM public.stripe_payment_transactions
  WHERE diagnostic_order_id = v_order_id
     OR (v_session_id IS NOT NULL AND stripe_checkout_session_id = v_session_id)
     OR (v_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = v_payment_intent_id)
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.stripe_payment_transactions (
      diagnostic_order_id, user_id, stripe_checkout_session_id,
      stripe_payment_intent_id, stripe_charge_id, payment_type, status,
      amount_total, currency, last_event_id, last_event_created_at
    ) VALUES (
      v_order_id, v_user_id, v_session_id, v_payment_intent_id, v_charge_id,
      'diagnostic_ia_express',
      CASE WHEN v_event_type IN ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
        THEN 'paid'
        WHEN v_event_type = 'checkout.session.expired' THEN 'expired'
        ELSE 'failed'
      END,
      v_amount_total, v_currency, v_event_id, v_event_created
    ) RETURNING * INTO v_transaction;
  ELSIF v_event_created >= v_transaction.last_event_created_at
    AND v_transaction.status NOT IN ('refunded', 'dispute_lost')
  THEN
    UPDATE public.stripe_payment_transactions
    SET status = CASE
          WHEN v_event_type IN ('checkout.session.completed', 'checkout.session.async_payment_succeeded') THEN 'paid'
          WHEN v_event_type = 'checkout.session.expired' THEN 'expired'
          ELSE 'failed'
        END,
        stripe_payment_intent_id = coalesce(v_payment_intent_id, stripe_payment_intent_id),
        stripe_charge_id = coalesce(v_charge_id, stripe_charge_id),
        last_event_id = v_event_id,
        last_event_created_at = v_event_created,
        updated_at = now()
    WHERE id = v_transaction.id
    RETURNING * INTO v_transaction;
  ELSE
    v_processing_result := 'stale';
  END IF;

  UPDATE public.diagnostic_ia_orders
  SET stripe_checkout_session_id = coalesce(v_session_id, stripe_checkout_session_id),
      stripe_payment_intent_id = coalesce(v_payment_intent_id, stripe_payment_intent_id),
      stripe_customer_id = coalesce(nullif(p_event->>'stripe_customer_id', ''), stripe_customer_id)
  WHERE id = v_order_id;

  PERFORM set_config('formaprompt.stripe_event_processing', v_event_id, true);
  UPDATE public.stripe_webhook_events
  SET processing_result = v_processing_result
  WHERE event_id = v_event_id;

  INSERT INTO public.audit_log (
    action_type, target_type, target_id, target_user_id, reason, metadata
  ) VALUES (
    'stripe_event_' || replace(v_processing_result, '-', '_'),
    'diagnostic_ia_order', v_order_id::text, v_user_id,
    'Evenement Stripe signe traite pour un Diagnostic IA Express.',
    jsonb_build_object(
      'event_type', v_event_type,
      'event_id', v_event_id,
      'processing_result', v_processing_result
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'processing_result', v_processing_result,
    'transaction_id', v_transaction.id,
    'diagnostic_order_id', v_order_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_diagnostic_ia_stripe_event(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_diagnostic_ia_stripe_event(jsonb)
  TO service_role;

COMMIT;
