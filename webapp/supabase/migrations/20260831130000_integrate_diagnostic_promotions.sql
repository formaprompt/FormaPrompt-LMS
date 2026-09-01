-- LOT 1G-B : integration du moteur promotionnel au Diagnostic IA Express.
-- Le prix catalogue reste 14900 centimes. La commande conserve separement le
-- prix catalogue, la remise et le montant final effectivement attendu de Stripe.

BEGIN;

ALTER TABLE public.diagnostic_ia_orders
  DROP CONSTRAINT diagnostic_ia_orders_amount_check,
  ADD COLUMN original_amount_cents integer NOT NULL DEFAULT 14900,
  ADD COLUMN discount_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN final_amount_cents integer NOT NULL DEFAULT 14900,
  ADD COLUMN promo_redemption_id uuid REFERENCES public.promo_redemptions(id) ON DELETE RESTRICT,
  ADD COLUMN checkout_configuration_locked_at timestamptz,
  ADD CONSTRAINT diagnostic_ia_orders_catalog_amount_check CHECK (original_amount_cents = 14900),
  ADD CONSTRAINT diagnostic_ia_orders_promotion_amounts_check CHECK (
    discount_amount_cents >= 0
    AND discount_amount_cents <= original_amount_cents
    AND final_amount_cents = original_amount_cents - discount_amount_cents
    AND amount_total = final_amount_cents
  ),
  ADD CONSTRAINT diagnostic_ia_orders_promotion_reference_check CHECK (
    promo_redemption_id IS NOT NULL
    OR (discount_amount_cents = 0 AND final_amount_cents = 14900)
  );

CREATE UNIQUE INDEX diagnostic_ia_orders_promo_redemption_uidx
  ON public.diagnostic_ia_orders(promo_redemption_id)
  WHERE promo_redemption_id IS NOT NULL;

ALTER TABLE public.stripe_payment_transactions
  DROP CONSTRAINT stripe_payment_transactions_amount_check,
  ADD CONSTRAINT stripe_payment_transactions_amount_check CHECK (
    (amount_total IS NULL OR amount_total > 0
      OR (payment_type = 'diagnostic_ia_express' AND amount_total = 0))
    AND amount_refunded >= 0
  );

COMMENT ON COLUMN public.diagnostic_ia_orders.original_amount_cents IS
  'Prix catalogue serveur du Diagnostic IA Express, toujours egal a 14900 centimes.';
COMMENT ON COLUMN public.diagnostic_ia_orders.promo_redemption_id IS
  'Reservation promotionnelle commune, liee de maniere unique a cette commande Diagnostic.';
COMMENT ON COLUMN public.diagnostic_ia_orders.checkout_configuration_locked_at IS
  'Fige le montant et la promotion pendant la creation idempotente de la session Stripe.';

-- Un echec de PaymentIntent n est pas terminal pour une Checkout Session : le
-- client peut encore retenter son paiement jusqu a checkout.session.expired.
-- Les echecs asynchrones et l expiration restent, eux, terminaux.
CREATE OR REPLACE FUNCTION private.sync_diagnostic_order_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_event_type text;
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
    SELECT events.event_type INTO v_event_type
    FROM public.stripe_webhook_events AS events
    WHERE events.event_id = NEW.last_event_id;

    IF v_event_type IS DISTINCT FROM 'payment_intent.payment_failed' THEN
      UPDATE public.diagnostic_ia_orders
      SET status = 'cancelled', stripe_last_event_id = NEW.last_event_id,
          cancelled_at = coalesce(cancelled_at, NEW.last_event_created_at)
      WHERE id = NEW.diagnostic_order_id AND status = 'payment_pending';
    END IF;
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

CREATE OR REPLACE FUNCTION private.prepare_diagnostic_promotion_checkout(
  p_order_id uuid,
  p_user_id uuid,
  p_email text,
  p_promo_code text DEFAULT NULL
)
RETURNS TABLE (
  order_id uuid,
  promo_redemption_id uuid,
  normalized_code text,
  original_amount_cents integer,
  discount_amount_cents integer,
  final_amount_cents integer,
  reservation_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order public.diagnostic_ia_orders%ROWTYPE;
  v_reservation record;
  v_extended_reservation_expires_at timestamptz;
  v_normalized_code text := nullif(upper(btrim(coalesce(p_promo_code, ''))), '');
  v_redemption_status text;
BEGIN
  IF p_order_id IS NULL OR p_user_id IS NULL OR p_email IS NULL THEN
    PERFORM private.promo_invalid();
  END IF;

  SELECT * INTO v_order
  FROM public.diagnostic_ia_orders AS orders
  WHERE orders.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_order.user_id IS DISTINCT FROM p_user_id
    OR lower(btrim(v_order.customer_email)) IS DISTINCT FROM lower(btrim(p_email))
    OR v_order.status <> 'payment_pending'
  THEN
    PERFORM private.promo_invalid();
  END IF;

  IF v_order.checkout_configuration_locked_at IS NULL THEN
    IF v_normalized_code IS NOT NULL THEN
      SELECT * INTO v_reservation
      FROM private.reserve_promo_code(
        v_normalized_code,
        p_user_id,
        p_email,
        'diagnostic',
        'diagnostic-ia-express',
        14900,
        'diagnostic_ia_order',
        p_order_id
      );

      -- Checkout est configure pour 31 minutes. Cette extension propre au
      -- Diagnostic laisse au webhook un tampon avant liberation du quota.
      UPDATE public.promo_redemptions AS redemptions
      SET reservation_expires_at = greatest(
        redemptions.reservation_expires_at,
        now() + interval '35 minutes'
      )
      WHERE redemptions.id = v_reservation.redemption_id
        AND redemptions.status = 'reserved'
      RETURNING redemptions.reservation_expires_at
      INTO v_extended_reservation_expires_at;
      IF NOT FOUND THEN
        PERFORM private.promo_invalid();
      END IF;

      UPDATE public.diagnostic_ia_orders AS orders
      SET promo_redemption_id = v_reservation.redemption_id,
          original_amount_cents = v_reservation.original_amount_cents,
          discount_amount_cents = v_reservation.discount_amount_cents,
          final_amount_cents = v_reservation.final_amount_cents,
          amount_total = v_reservation.final_amount_cents,
          checkout_configuration_locked_at = now()
      WHERE orders.id = p_order_id
      RETURNING * INTO v_order;
    ELSE
      UPDATE public.diagnostic_ia_orders AS orders
      SET original_amount_cents = 14900,
          discount_amount_cents = 0,
          final_amount_cents = 14900,
          amount_total = 14900,
          checkout_configuration_locked_at = now()
      WHERE orders.id = p_order_id
      RETURNING * INTO v_order;
    END IF;
  END IF;

  IF v_order.promo_redemption_id IS NOT NULL THEN
    SELECT redemptions.reservation_expires_at, codes.code, redemptions.status
    INTO reservation_expires_at, normalized_code, v_redemption_status
    FROM public.promo_redemptions AS redemptions
    JOIN public.promo_codes AS codes ON codes.id = redemptions.promo_code_id
    WHERE redemptions.id = v_order.promo_redemption_id;
    IF v_redemption_status <> 'reserved' OR reservation_expires_at <= now() THEN
      PERFORM private.promo_invalid();
    END IF;
  ELSE
    reservation_expires_at := NULL;
    normalized_code := NULL;
  END IF;

  order_id := v_order.id;
  promo_redemption_id := v_order.promo_redemption_id;
  original_amount_cents := v_order.original_amount_cents;
  discount_amount_cents := v_order.discount_amount_cents;
  final_amount_cents := v_order.final_amount_cents;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION private.reset_diagnostic_promotion_checkout(
  p_order_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order public.diagnostic_ia_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order
  FROM public.diagnostic_ia_orders AS orders
  WHERE orders.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_order.user_id IS DISTINCT FROM p_user_id
    OR v_order.status <> 'payment_pending'
    OR v_order.stripe_checkout_session_id IS NOT NULL
    OR v_order.checkout_configuration_locked_at IS NULL
  THEN
    RETURN false;
  END IF;

  IF v_order.promo_redemption_id IS NOT NULL THEN
    PERFORM * FROM private.release_promo_redemption(
      v_order.promo_redemption_id,
      'diagnostic_ia_order',
      v_order.id
    );
  END IF;

  UPDATE public.diagnostic_ia_orders AS orders
  SET status = 'cancelled',
      cancelled_at = now()
  WHERE orders.id = v_order.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_diagnostic_promotion_checkout(
  p_order_id uuid,
  p_user_id uuid,
  p_email text,
  p_promo_code text DEFAULT NULL
)
RETURNS TABLE (
  order_id uuid,
  promo_redemption_id uuid,
  normalized_code text,
  original_amount_cents integer,
  discount_amount_cents integer,
  final_amount_cents integer,
  reservation_expires_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.prepare_diagnostic_promotion_checkout(
    p_order_id, p_user_id, p_email, p_promo_code
  );
$$;

CREATE OR REPLACE FUNCTION public.reset_diagnostic_promotion_checkout(
  p_order_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.reset_diagnostic_promotion_checkout(p_order_id, p_user_id);
$$;

REVOKE ALL ON FUNCTION private.prepare_diagnostic_promotion_checkout(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reset_diagnostic_promotion_checkout(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_diagnostic_promotion_checkout(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_diagnostic_promotion_checkout(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.prepare_diagnostic_promotion_checkout(uuid, uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION private.reset_diagnostic_promotion_checkout(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_diagnostic_promotion_checkout(uuid, uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_diagnostic_promotion_checkout(uuid, uuid)
  TO service_role;

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
  v_promo_status text;
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
  FROM public.diagnostic_ia_orders AS orders
  WHERE orders.id = v_order_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_order.user_id IS DISTINCT FROM v_user_id
    OR v_order.original_amount_cents <> 14900
    OR v_order.amount_total IS DISTINCT FROM v_order.final_amount_cents
    OR v_order.currency <> 'eur'
    OR v_amount_total IS DISTINCT FROM v_order.final_amount_cents
    OR v_currency IS DISTINCT FROM 'eur'
    OR (v_session_id IS NOT NULL AND v_order.stripe_checkout_session_id IS NOT NULL
      AND v_order.stripe_checkout_session_id IS DISTINCT FROM v_session_id)
  THEN
    RAISE EXCEPTION 'Commande Diagnostic IA inconnue ou incoherente.';
  END IF;

  IF v_order.promo_redemption_id IS NOT NULL THEN
    IF v_event_type IN ('checkout.session.completed', 'checkout.session.async_payment_succeeded') THEN
      SELECT redemption.status INTO v_promo_status
      FROM private.consume_promo_redemption(
        v_order.promo_redemption_id, 'diagnostic_ia_order', v_order.id
      ) AS redemption;
      IF v_promo_status IS DISTINCT FROM 'consumed' THEN
        RAISE EXCEPTION 'Reservation promotionnelle Diagnostic IA indisponible.';
      END IF;
    ELSIF v_event_type IN ('checkout.session.async_payment_failed', 'checkout.session.expired') THEN
      SELECT redemption.status INTO v_promo_status
      FROM private.release_promo_redemption(
        v_order.promo_redemption_id, 'diagnostic_ia_order', v_order.id
      ) AS redemption;
    END IF;
  END IF;

  SELECT * INTO v_transaction
  FROM public.stripe_payment_transactions AS transactions
  WHERE transactions.diagnostic_order_id = v_order_id
     OR (v_session_id IS NOT NULL AND transactions.stripe_checkout_session_id = v_session_id)
     OR (v_payment_intent_id IS NOT NULL AND transactions.stripe_payment_intent_id = v_payment_intent_id)
  ORDER BY transactions.created_at DESC
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
    UPDATE public.stripe_payment_transactions AS transactions
    SET status = CASE
          WHEN v_event_type IN ('checkout.session.completed', 'checkout.session.async_payment_succeeded') THEN 'paid'
          WHEN v_event_type = 'checkout.session.expired' THEN 'expired'
          ELSE 'failed'
        END,
        stripe_payment_intent_id = coalesce(v_payment_intent_id, transactions.stripe_payment_intent_id),
        stripe_charge_id = coalesce(v_charge_id, transactions.stripe_charge_id),
        last_event_id = v_event_id,
        last_event_created_at = v_event_created,
        updated_at = now()
    WHERE transactions.id = v_transaction.id
    RETURNING * INTO v_transaction;
  ELSE
    v_processing_result := 'stale';
  END IF;

  UPDATE public.diagnostic_ia_orders AS orders
  SET stripe_checkout_session_id = coalesce(v_session_id, orders.stripe_checkout_session_id),
      stripe_payment_intent_id = coalesce(v_payment_intent_id, orders.stripe_payment_intent_id),
      stripe_customer_id = coalesce(nullif(p_event->>'stripe_customer_id', ''), orders.stripe_customer_id)
  WHERE orders.id = v_order_id;

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
      'processing_result', v_processing_result,
      'promo_redemption_id', v_order.promo_redemption_id
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
