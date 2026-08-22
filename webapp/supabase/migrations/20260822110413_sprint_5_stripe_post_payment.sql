-- Sprint 5 : Stripe apres paiement.
-- Migration additive. purchases reste la commande metier unique et
-- course_access reste l unique source de droits pedagogiques.

BEGIN;

CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  stripe_object_id text,
  livemode boolean,
  api_version text,
  payload_sha256 text,
  stripe_created_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_result text NOT NULL DEFAULT 'processed',
  CONSTRAINT stripe_webhook_events_id_check CHECK (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  CONSTRAINT stripe_webhook_events_type_check CHECK (char_length(event_type) BETWEEN 3 AND 100),
  CONSTRAINT stripe_webhook_events_object_check CHECK (
    stripe_object_id IS NULL OR char_length(stripe_object_id) BETWEEN 3 AND 200
  ),
  CONSTRAINT stripe_webhook_events_hash_check CHECK (
    payload_sha256 IS NULL OR payload_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT stripe_webhook_events_result_check CHECK (
    processing_result IN ('processed', 'review_required', 'stale', 'ignored')
  )
);

CREATE TABLE public.stripe_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE RESTRICT,
  checkout_intent_id uuid REFERENCES public.commercial_checkout_intents(id) ON DELETE SET NULL,
  booking_request_id uuid REFERENCES public.course_booking_requests(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  payment_type text NOT NULL DEFAULT 'course',
  status text NOT NULL,
  amount_total integer,
  amount_refunded integer NOT NULL DEFAULT 0,
  currency text,
  activation_policy text,
  last_event_id text NOT NULL REFERENCES public.stripe_webhook_events(event_id) ON DELETE RESTRICT,
  last_event_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_payment_transactions_identity_check CHECK (
    stripe_checkout_session_id IS NOT NULL OR stripe_payment_intent_id IS NOT NULL
  ),
  CONSTRAINT stripe_payment_transactions_course_check CHECK (
    course_id IS NULL OR char_length(btrim(course_id)) BETWEEN 2 AND 100
  ),
  CONSTRAINT stripe_payment_transactions_type_check CHECK (
    payment_type IN ('course', 'in_person_travel_fee')
  ),
  CONSTRAINT stripe_payment_transactions_status_check CHECK (
    status IN (
      'created', 'processing', 'paid', 'failed', 'expired',
      'partially_refunded', 'refunded', 'disputed', 'dispute_won', 'dispute_lost'
    )
  ),
  CONSTRAINT stripe_payment_transactions_amount_check CHECK (
    (amount_total IS NULL OR amount_total > 0)
    AND amount_refunded >= 0
  ),
  CONSTRAINT stripe_payment_transactions_currency_check CHECK (
    currency IS NULL OR currency ~ '^[a-z]{3}$'
  )
);

CREATE UNIQUE INDEX stripe_payment_transactions_session_uidx
  ON public.stripe_payment_transactions (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX stripe_payment_transactions_intent_uidx
  ON public.stripe_payment_transactions (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX stripe_payment_transactions_charge_uidx
  ON public.stripe_payment_transactions (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;
CREATE INDEX stripe_payment_transactions_purchase_idx
  ON public.stripe_payment_transactions (purchase_id, created_at DESC);
CREATE INDEX stripe_payment_transactions_user_course_idx
  ON public.stripe_payment_transactions (user_id, course_id, created_at DESC);

CREATE TABLE public.stripe_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.stripe_payment_transactions(id) ON DELETE RESTRICT,
  stripe_refund_id text NOT NULL UNIQUE,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  status text NOT NULL,
  amount integer NOT NULL,
  currency text,
  reason text,
  failure_reason text,
  last_event_id text NOT NULL REFERENCES public.stripe_webhook_events(event_id) ON DELETE RESTRICT,
  last_event_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_refunds_id_check CHECK (stripe_refund_id ~ '^re_[A-Za-z0-9_]+$'),
  CONSTRAINT stripe_refunds_status_check CHECK (char_length(status) BETWEEN 2 AND 50),
  CONSTRAINT stripe_refunds_amount_check CHECK (amount > 0),
  CONSTRAINT stripe_refunds_currency_check CHECK (currency IS NULL OR currency ~ '^[a-z]{3}$'),
  CONSTRAINT stripe_refunds_text_check CHECK (
    (reason IS NULL OR char_length(reason) <= 200)
    AND (failure_reason IS NULL OR char_length(failure_reason) <= 500)
  )
);

CREATE INDEX stripe_refunds_transaction_idx
  ON public.stripe_refunds (transaction_id, last_event_created_at DESC);

CREATE TABLE public.stripe_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.stripe_payment_transactions(id) ON DELETE RESTRICT,
  stripe_dispute_id text NOT NULL UNIQUE,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  status text NOT NULL,
  reason text,
  amount integer NOT NULL,
  currency text,
  evidence_due_at timestamptz,
  last_event_id text NOT NULL REFERENCES public.stripe_webhook_events(event_id) ON DELETE RESTRICT,
  last_event_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_disputes_id_check CHECK (stripe_dispute_id ~ '^dp_[A-Za-z0-9_]+$'),
  CONSTRAINT stripe_disputes_status_check CHECK (char_length(status) BETWEEN 2 AND 80),
  CONSTRAINT stripe_disputes_reason_check CHECK (reason IS NULL OR char_length(reason) <= 200),
  CONSTRAINT stripe_disputes_amount_check CHECK (amount > 0),
  CONSTRAINT stripe_disputes_currency_check CHECK (currency IS NULL OR currency ~ '^[a-z]{3}$')
);

CREATE INDEX stripe_disputes_transaction_idx
  ON public.stripe_disputes (transaction_id, last_event_created_at DESC);
CREATE INDEX stripe_disputes_status_due_idx
  ON public.stripe_disputes (status, evidence_due_at);

CREATE TABLE public.stripe_reconciliation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deduplication_key text NOT NULL UNIQUE,
  case_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  transaction_id uuid REFERENCES public.stripe_payment_transactions(id) ON DELETE SET NULL,
  refund_id uuid REFERENCES public.stripe_refunds(id) ON DELETE SET NULL,
  dispute_id uuid REFERENCES public.stripe_disputes(id) ON DELETE SET NULL,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  course_access_id uuid REFERENCES public.course_access(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id text,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurrence_count integer NOT NULL DEFAULT 1,
  detected_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_reason text,
  CONSTRAINT stripe_reconciliation_cases_key_check CHECK (
    char_length(deduplication_key) BETWEEN 5 AND 300
  ),
  CONSTRAINT stripe_reconciliation_cases_type_check CHECK (
    char_length(case_type) BETWEEN 3 AND 100
  ),
  CONSTRAINT stripe_reconciliation_cases_severity_check CHECK (
    severity IN ('low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT stripe_reconciliation_cases_status_check CHECK (
    status IN ('pending', 'reviewed', 'resolved', 'dismissed')
  ),
  CONSTRAINT stripe_reconciliation_cases_course_check CHECK (
    course_id IS NULL OR char_length(btrim(course_id)) BETWEEN 2 AND 100
  ),
  CONSTRAINT stripe_reconciliation_cases_summary_check CHECK (
    char_length(btrim(summary)) BETWEEN 5 AND 500
  ),
  CONSTRAINT stripe_reconciliation_cases_details_check CHECK (
    jsonb_typeof(details) = 'object' AND octet_length(details::text) <= 32768
  ),
  CONSTRAINT stripe_reconciliation_cases_occurrence_check CHECK (occurrence_count > 0),
  CONSTRAINT stripe_reconciliation_cases_resolution_check CHECK (
    resolution_reason IS NULL OR char_length(btrim(resolution_reason)) BETWEEN 5 AND 2000
  )
);

CREATE INDEX stripe_reconciliation_cases_status_idx
  ON public.stripe_reconciliation_cases (status, severity, last_seen_at DESC);
CREATE INDEX stripe_reconciliation_cases_user_course_idx
  ON public.stripe_reconciliation_cases (user_id, course_id, last_seen_at DESC);

COMMENT ON TABLE public.stripe_payment_transactions IS
  'Occurrences financieres Stripe. Une seconde transaction ne cree jamais un second droit pedagogique.';
COMMENT ON TABLE public.stripe_webhook_events IS
  'Journal minimal et idempotent des evenements Stripe signes, sans payload brut ni secret.';
COMMENT ON TABLE public.stripe_reconciliation_cases IS
  'Anomalies Stripe, achats et droits a examiner humainement. Cette table ne constitue pas une source de droits.';

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_payment_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_refunds FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_disputes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_reconciliation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_reconciliation_cases FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lecture administrative des evenements Stripe"
ON public.stripe_webhook_events FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));
CREATE POLICY "Lecture administrative des transactions Stripe"
ON public.stripe_payment_transactions FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));
CREATE POLICY "Lecture administrative des remboursements Stripe"
ON public.stripe_refunds FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));
CREATE POLICY "Lecture administrative des litiges Stripe"
ON public.stripe_disputes FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));
CREATE POLICY "Lecture administrative des rapprochements Stripe"
ON public.stripe_reconciliation_cases FOR SELECT TO authenticated
USING ((SELECT private.is_strict_admin()));

REVOKE ALL ON public.stripe_webhook_events, public.stripe_payment_transactions,
  public.stripe_refunds, public.stripe_disputes, public.stripe_reconciliation_cases
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stripe_webhook_events, public.stripe_payment_transactions,
  public.stripe_refunds, public.stripe_disputes, public.stripe_reconciliation_cases
  TO authenticated;
GRANT ALL ON public.stripe_webhook_events, public.stripe_payment_transactions,
  public.stripe_refunds, public.stripe_disputes, public.stripe_reconciliation_cases
  TO service_role;

CREATE OR REPLACE FUNCTION private.reject_stripe_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND current_setting('formaprompt.stripe_event_processing', true) = OLD.event_id
    AND NEW.event_id = OLD.event_id
    AND NEW.event_type = OLD.event_type
    AND NEW.stripe_object_id IS NOT DISTINCT FROM OLD.stripe_object_id
    AND NEW.livemode IS NOT DISTINCT FROM OLD.livemode
    AND NEW.api_version IS NOT DISTINCT FROM OLD.api_version
    AND NEW.payload_sha256 IS NOT DISTINCT FROM OLD.payload_sha256
    AND NEW.stripe_created_at = OLD.stripe_created_at
    AND NEW.received_at = OLD.received_at
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Le journal des evenements Stripe est append-only.' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION private.reject_stripe_event_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER stripe_webhook_events_reject_update
BEFORE UPDATE ON public.stripe_webhook_events
FOR EACH ROW EXECUTE FUNCTION private.reject_stripe_event_mutation();
CREATE TRIGGER stripe_webhook_events_reject_delete
BEFORE DELETE ON public.stripe_webhook_events
FOR EACH ROW EXECUTE FUNCTION private.reject_stripe_event_mutation();

CREATE OR REPLACE FUNCTION private.stripe_json_uuid(p_value text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN p_value::uuid
    ELSE NULL
  END;
$$;
REVOKE ALL ON FUNCTION private.stripe_json_uuid(text) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.stripe_json_uuid(text) TO service_role;

CREATE OR REPLACE FUNCTION private.open_stripe_reconciliation_case(
  p_deduplication_key text,
  p_case_type text,
  p_severity text,
  p_summary text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_transaction_id uuid DEFAULT NULL,
  p_refund_id uuid DEFAULT NULL,
  p_dispute_id uuid DEFAULT NULL,
  p_purchase_id uuid DEFAULT NULL,
  p_course_access_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_course_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_case_id uuid;
BEGIN
  INSERT INTO public.stripe_reconciliation_cases (
    deduplication_key, case_type, severity, summary, details,
    transaction_id, refund_id, dispute_id, purchase_id, course_access_id,
    user_id, course_id
  ) VALUES (
    p_deduplication_key, p_case_type, p_severity, p_summary, coalesce(p_details, '{}'::jsonb),
    p_transaction_id, p_refund_id, p_dispute_id, p_purchase_id, p_course_access_id,
    p_user_id, p_course_id
  )
  ON CONFLICT (deduplication_key) DO UPDATE
  SET last_seen_at = now(),
      occurrence_count = public.stripe_reconciliation_cases.occurrence_count + 1,
      severity = EXCLUDED.severity,
      summary = EXCLUDED.summary,
      details = EXCLUDED.details,
      transaction_id = coalesce(EXCLUDED.transaction_id, public.stripe_reconciliation_cases.transaction_id),
      refund_id = coalesce(EXCLUDED.refund_id, public.stripe_reconciliation_cases.refund_id),
      dispute_id = coalesce(EXCLUDED.dispute_id, public.stripe_reconciliation_cases.dispute_id),
      purchase_id = coalesce(EXCLUDED.purchase_id, public.stripe_reconciliation_cases.purchase_id),
      course_access_id = coalesce(EXCLUDED.course_access_id, public.stripe_reconciliation_cases.course_access_id),
      user_id = coalesce(EXCLUDED.user_id, public.stripe_reconciliation_cases.user_id),
      course_id = coalesce(EXCLUDED.course_id, public.stripe_reconciliation_cases.course_id)
  RETURNING id INTO v_case_id;
  RETURN v_case_id;
END;
$$;
REVOKE ALL ON FUNCTION private.open_stripe_reconciliation_case(
  text, text, text, text, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.open_stripe_reconciliation_case(
  text, text, text, text, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, text
) TO service_role;

-- Reprise des preuves Stripe historiques sans modifier purchases.
INSERT INTO public.stripe_webhook_events (
  event_id, event_type, stripe_object_id, livemode, stripe_created_at,
  received_at, processing_result
)
SELECT
  p.stripe_event_id,
  'legacy_import',
  coalesce(p.stripe_payment_intent_id, p.stripe_checkout_session_id),
  NULL,
  p.purchased_at,
  now(),
  'processed'
FROM public.purchases p
WHERE p.stripe_event_id IS NOT NULL
ON CONFLICT (event_id) DO NOTHING;

INSERT INTO public.stripe_payment_transactions (
  purchase_id, user_id, course_id, stripe_checkout_session_id,
  stripe_payment_intent_id, payment_type, status, amount_total,
  currency, last_event_id, last_event_created_at, created_at, updated_at
)
SELECT
  p.id, p.user_id, p.course_id, p.stripe_checkout_session_id,
  p.stripe_payment_intent_id, 'course',
  CASE
    WHEN p.payment_status = 'refunded' THEN 'refunded'
    WHEN p.payment_status = 'partially_refunded' THEN 'partially_refunded'
    ELSE 'paid'
  END,
  p.amount_total, p.currency, p.stripe_event_id, p.purchased_at, p.purchased_at, now()
FROM public.purchases p
WHERE p.stripe_event_id IS NOT NULL
  AND (p.stripe_checkout_session_id IS NOT NULL OR p.stripe_payment_intent_id IS NOT NULL)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.process_stripe_post_payment_event(p_event jsonb)
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
  v_user_id uuid := private.stripe_json_uuid(p_event->>'user_id');
  v_checkout_intent_id uuid := private.stripe_json_uuid(p_event->>'checkout_intent_id');
  v_booking_request_id uuid := private.stripe_json_uuid(p_event->>'booking_request_id');
  v_course_id text := nullif(p_event->>'course_id', '');
  v_session_id text := nullif(p_event->>'stripe_checkout_session_id', '');
  v_payment_intent_id text := nullif(p_event->>'stripe_payment_intent_id', '');
  v_charge_id text := nullif(p_event->>'stripe_charge_id', '');
  v_payment_type text := coalesce(nullif(p_event->>'payment_type', ''), 'course');
  v_status text := nullif(p_event->>'status', '');
  v_amount integer := CASE WHEN p_event ? 'amount' THEN (p_event->>'amount')::integer ELSE NULL END;
  v_amount_total integer := CASE WHEN p_event ? 'amount_total' THEN (p_event->>'amount_total')::integer ELSE NULL END;
  v_currency text := lower(nullif(p_event->>'currency', ''));
  v_transaction public.stripe_payment_transactions%ROWTYPE;
  v_purchase public.purchases%ROWTYPE;
  v_access public.course_access%ROWTYPE;
  v_refund public.stripe_refunds%ROWTYPE;
  v_dispute public.stripe_disputes%ROWTYPE;
  v_purchase_created boolean := false;
  v_duplicate boolean := false;
  v_applied boolean := false;
  v_refunded_total integer := 0;
  v_processing_result text := 'processed';
  v_existing_transaction_count integer := 0;
BEGIN
  IF v_event_id IS NULL OR v_event_id !~ '^evt_[A-Za-z0-9_]+' THEN
    RAISE EXCEPTION 'Identifiant evenement Stripe invalide.';
  END IF;
  IF v_event_type NOT IN (
    'checkout.session.completed', 'checkout.session.async_payment_succeeded',
    'payment_intent.payment_failed', 'checkout.session.async_payment_failed',
    'checkout.session.expired', 'refund.created', 'refund.updated', 'refund.failed',
    'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed',
    'charge.dispute.funds_withdrawn', 'charge.dispute.funds_reinstated'
  ) THEN
    RAISE EXCEPTION 'Type evenement Stripe non pris en charge.';
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

  PERFORM pg_advisory_xact_lock(hashtextextended(
    coalesce(v_payment_intent_id, v_session_id, v_charge_id, p_event->>'object_id', v_event_id), 0
  ));

  IF v_event_type IN ('checkout.session.completed', 'checkout.session.async_payment_succeeded') THEN
    IF v_amount_total IS NULL OR v_amount_total <= 0 OR v_currency IS NULL THEN
      RAISE EXCEPTION 'Montant de paiement Stripe invalide.';
    END IF;

    IF v_payment_type = 'in_person_travel_fee' THEN
      IF v_booking_request_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'Reservation de deplacement invalide.';
      END IF;

      SELECT * INTO v_transaction
      FROM public.stripe_payment_transactions
      WHERE (v_session_id IS NOT NULL AND stripe_checkout_session_id = v_session_id)
         OR (v_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = v_payment_intent_id)
      FOR UPDATE;

      IF NOT FOUND THEN
        INSERT INTO public.stripe_payment_transactions (
          booking_request_id, user_id, stripe_checkout_session_id,
          stripe_payment_intent_id, stripe_charge_id, payment_type, status,
          amount_total, currency, last_event_id, last_event_created_at
        ) VALUES (
          v_booking_request_id, v_user_id, v_session_id,
          v_payment_intent_id, v_charge_id, v_payment_type, 'paid',
          v_amount_total, v_currency, v_event_id, v_event_created
        ) RETURNING * INTO v_transaction;
      END IF;

      UPDATE public.course_booking_requests
      SET status = 'confirmed', travel_fee_status = 'paid',
          stripe_checkout_session_id = v_session_id,
          stripe_payment_intent_id = v_payment_intent_id,
          stripe_event_id = v_event_id
      WHERE id = v_booking_request_id
        AND user_id = v_user_id
        AND delivery_mode = 'in_person'
        AND distance_status = 'approved'
        AND travel_fee_amount = v_amount_total
        AND status = 'awaiting_travel_payment'
        AND travel_fee_status = 'pending';

      IF NOT FOUND AND NOT EXISTS (
        SELECT 1 FROM public.course_booking_requests
        WHERE id = v_booking_request_id AND user_id = v_user_id
          AND travel_fee_status = 'paid' AND stripe_checkout_session_id = v_session_id
      ) THEN
        PERFORM private.open_stripe_reconciliation_case(
          'travel-fee:' || v_transaction.id, 'travel_fee_payment_mismatch', 'high',
          'Le paiement des frais de deplacement ne correspond pas a une reservation payable.',
          jsonb_build_object('event_id', v_event_id, 'booking_request_id', v_booking_request_id),
          v_transaction.id, NULL, NULL, NULL, NULL, v_user_id, NULL
        );
        v_processing_result := 'review_required';
      END IF;
    ELSE
      IF v_user_id IS NULL OR v_course_id IS NULL OR v_payment_type <> 'course' THEN
        RAISE EXCEPTION 'Identite de paiement formation invalide.';
      END IF;

      PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || v_course_id, 0));

      SELECT * INTO v_transaction
      FROM public.stripe_payment_transactions
      WHERE (v_session_id IS NOT NULL AND stripe_checkout_session_id = v_session_id)
         OR (v_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = v_payment_intent_id)
      FOR UPDATE;

      IF NOT FOUND THEN
        SELECT * INTO v_purchase
        FROM public.purchases
        WHERE user_id = v_user_id AND course_id = v_course_id
        FOR UPDATE;

        IF NOT FOUND AND p_event->>'validation_status' = 'validated' THEN
          INSERT INTO public.purchases (
            user_id, course_id, stripe_checkout_session_id, stripe_payment_intent_id,
            stripe_event_id, amount_total, currency, payment_status, customer_phone, purchased_at
          ) VALUES (
            v_user_id, v_course_id, v_session_id, v_payment_intent_id,
            v_event_id, v_amount_total, v_currency, 'paid',
            nullif(p_event->>'customer_phone', ''), v_event_created
          ) RETURNING * INTO v_purchase;
          v_purchase_created := true;
        ELSIF FOUND THEN
          SELECT count(*) INTO v_existing_transaction_count
          FROM public.stripe_payment_transactions
          WHERE purchase_id = v_purchase.id;

          v_duplicate := v_existing_transaction_count > 0
            OR NOT (
              v_purchase.stripe_checkout_session_id IS NOT DISTINCT FROM v_session_id
              OR v_purchase.stripe_payment_intent_id IS NOT DISTINCT FROM v_payment_intent_id
            );
        END IF;

        INSERT INTO public.stripe_payment_transactions (
          purchase_id, checkout_intent_id, user_id, course_id,
          stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id,
          payment_type, status, amount_total, currency, activation_policy,
          last_event_id, last_event_created_at
        ) VALUES (
          v_purchase.id, v_checkout_intent_id, v_user_id, v_course_id,
          v_session_id, v_payment_intent_id, v_charge_id,
          'course', 'paid', v_amount_total, v_currency, nullif(p_event->>'activation_policy', ''),
          v_event_id, v_event_created
        ) RETURNING * INTO v_transaction;

        IF p_event->>'validation_status' <> 'validated' OR v_purchase.id IS NULL THEN
          PERFORM private.open_stripe_reconciliation_case(
            'unvalidated-payment:' || v_transaction.id, 'unvalidated_payment', 'high',
            'Le paiement Stripe ne dispose pas de preuves commerciales suffisantes.',
            jsonb_build_object('event_id', v_event_id, 'validation_status', p_event->>'validation_status'),
            v_transaction.id, NULL, NULL, NULL, NULL, v_user_id, v_course_id
          );
          v_processing_result := 'review_required';
        ELSIF v_duplicate THEN
          PERFORM private.open_stripe_reconciliation_case(
            'duplicate-payment:' || v_transaction.id, 'duplicate_payment', 'critical',
            'Un second paiement Stripe a ete conserve sans recreer de droit.',
            jsonb_build_object('event_id', v_event_id, 'payment_intent_id', v_payment_intent_id),
            v_transaction.id, NULL, NULL, v_purchase.id, NULL, v_user_id, v_course_id
          );
          v_processing_result := 'review_required';
        END IF;

        IF v_purchase_created
          AND p_event->>'activation_policy' = 'immediate_after_payment'
        THEN
          SELECT * INTO v_access
          FROM public.course_access
          WHERE user_id = v_user_id AND course_id = v_course_id
          FOR UPDATE;

          IF NOT FOUND THEN
            INSERT INTO public.course_access (
              user_id, course_id, status, access_source, purchase_id,
              granted_at, expires_at, updated_at
            ) VALUES (
              v_user_id, v_course_id, 'active', 'stripe', v_purchase.id,
              v_event_created, NULL, now()
            );
          END IF;
        END IF;
      ELSE
        IF v_event_created >= v_transaction.last_event_created_at
          AND v_transaction.status NOT IN ('refunded', 'dispute_lost')
        THEN
          UPDATE public.stripe_payment_transactions
          SET status = 'paid', last_event_id = v_event_id,
              last_event_created_at = v_event_created, updated_at = now()
          WHERE id = v_transaction.id;
        ELSE
          v_processing_result := 'stale';
        END IF;
      END IF;

      IF v_checkout_intent_id IS NOT NULL THEN
        UPDATE public.commercial_checkout_intents
        SET status = 'paid', updated_at = now()
        WHERE id = v_checkout_intent_id
          AND status IN ('stripe_session_created', 'paid');
      END IF;
    END IF;

  ELSIF v_event_type IN (
    'payment_intent.payment_failed', 'checkout.session.async_payment_failed', 'checkout.session.expired'
  ) THEN
    SELECT * INTO v_transaction
    FROM public.stripe_payment_transactions
    WHERE (v_session_id IS NOT NULL AND stripe_checkout_session_id = v_session_id)
       OR (v_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = v_payment_intent_id)
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.stripe_payment_transactions (
        checkout_intent_id, booking_request_id, user_id, course_id,
        stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id,
        payment_type, status, amount_total, currency, activation_policy,
        last_event_id, last_event_created_at
      ) VALUES (
        v_checkout_intent_id, v_booking_request_id, v_user_id, v_course_id,
        v_session_id, v_payment_intent_id, v_charge_id,
        v_payment_type,
        CASE WHEN v_event_type = 'checkout.session.expired' THEN 'expired' ELSE 'failed' END,
        v_amount_total, v_currency, nullif(p_event->>'activation_policy', ''),
        v_event_id, v_event_created
      ) RETURNING * INTO v_transaction;
    ELSIF v_event_created >= v_transaction.last_event_created_at
      AND v_transaction.status NOT IN ('paid', 'partially_refunded', 'refunded', 'disputed', 'dispute_won', 'dispute_lost')
    THEN
      UPDATE public.stripe_payment_transactions
      SET status = CASE WHEN v_event_type = 'checkout.session.expired' THEN 'expired' ELSE 'failed' END,
          last_event_id = v_event_id, last_event_created_at = v_event_created, updated_at = now()
      WHERE id = v_transaction.id;
    ELSE
      v_processing_result := 'stale';
    END IF;

    IF v_checkout_intent_id IS NOT NULL THEN
      UPDATE public.commercial_checkout_intents
      SET status = CASE WHEN v_event_type = 'checkout.session.expired' THEN 'expired' ELSE 'failed' END,
          failure_code = CASE WHEN v_event_type = 'checkout.session.expired' THEN 'stripe_checkout_expired' ELSE 'stripe_payment_failed' END,
          updated_at = now()
      WHERE id = v_checkout_intent_id
        AND status NOT IN ('paid', 'cancelled', 'expired');
    END IF;

  ELSIF v_event_type IN ('refund.created', 'refund.updated', 'refund.failed') THEN
    SELECT * INTO v_transaction
    FROM public.stripe_payment_transactions
    WHERE (v_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = v_payment_intent_id)
       OR (v_charge_id IS NOT NULL AND stripe_charge_id = v_charge_id)
    FOR UPDATE;

    v_user_id := coalesce(v_user_id, v_transaction.user_id);
    v_course_id := coalesce(v_course_id, v_transaction.course_id);

    INSERT INTO public.stripe_refunds (
      transaction_id, stripe_refund_id, stripe_payment_intent_id, stripe_charge_id,
      status, amount, currency, reason, failure_reason,
      last_event_id, last_event_created_at
    ) VALUES (
      v_transaction.id, p_event->>'object_id', v_payment_intent_id, v_charge_id,
      coalesce(v_status, 'unknown'), v_amount, v_currency,
      nullif(p_event->>'reason', ''), nullif(p_event->>'failure_reason', ''),
      v_event_id, v_event_created
    )
    ON CONFLICT (stripe_refund_id) DO UPDATE
    SET transaction_id = coalesce(EXCLUDED.transaction_id, public.stripe_refunds.transaction_id),
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        reason = EXCLUDED.reason,
        failure_reason = EXCLUDED.failure_reason,
        last_event_id = EXCLUDED.last_event_id,
        last_event_created_at = EXCLUDED.last_event_created_at,
        updated_at = now()
    WHERE EXCLUDED.last_event_created_at >= public.stripe_refunds.last_event_created_at
    RETURNING * INTO v_refund;

    IF v_refund.id IS NULL THEN
      v_processing_result := 'stale';
    ELSIF v_transaction.id IS NULL THEN
      PERFORM private.open_stripe_reconciliation_case(
        'orphan-refund:' || v_refund.stripe_refund_id, 'orphan_refund', 'critical',
        'Le remboursement Stripe ne correspond a aucune transaction locale.',
        jsonb_build_object('event_id', v_event_id, 'payment_intent_id', v_payment_intent_id),
        NULL, v_refund.id, NULL, NULL, NULL, NULL, NULL
      );
      v_processing_result := 'review_required';
    ELSE
      SELECT coalesce(sum(amount), 0)::integer INTO v_refunded_total
      FROM public.stripe_refunds
      WHERE transaction_id = v_transaction.id AND status = 'succeeded';

      IF v_event_type = 'refund.failed' OR v_refund.status = 'failed' THEN
        PERFORM private.open_stripe_reconciliation_case(
          'failed-refund:' || v_refund.id, 'refund_failed', 'high',
          'Un remboursement Stripe a echoue et doit etre examine.',
          jsonb_build_object('event_id', v_event_id, 'failure_reason', v_refund.failure_reason),
          v_transaction.id, v_refund.id, NULL, v_transaction.purchase_id, NULL,
          v_transaction.user_id, v_transaction.course_id
        );
        v_processing_result := 'review_required';
      ELSIF v_refund.status = 'succeeded' AND v_refunded_total >= coalesce(v_transaction.amount_total, 2147483647) THEN
        UPDATE public.stripe_payment_transactions
        SET status = 'refunded', amount_refunded = v_refunded_total,
            last_event_id = v_event_id, last_event_created_at = v_event_created, updated_at = now()
        WHERE id = v_transaction.id
          AND v_event_created >= last_event_created_at
          AND status <> 'dispute_lost';

        IF v_transaction.purchase_id IS NOT NULL THEN
          UPDATE public.purchases SET payment_status = 'refunded'
          WHERE id = v_transaction.purchase_id;

          SELECT * INTO v_access
          FROM public.course_access
          WHERE purchase_id = v_transaction.purchase_id
            AND user_id IS NOT DISTINCT FROM v_transaction.user_id
            AND course_id IS NOT DISTINCT FROM v_transaction.course_id
          FOR UPDATE;

          IF FOUND AND v_access.status IN ('active', 'suspended') THEN
            PERFORM set_config('formaprompt.audit_reason', 'Remboursement Stripe total confirme par evenement signe ' || v_event_id, true);
            UPDATE public.course_access
            SET status = 'refunded', suspension_ends_at = NULL,
                status_changed_at = now(), updated_at = now()
            WHERE id = v_access.id;
          ELSIF NOT FOUND THEN
            PERFORM private.open_stripe_reconciliation_case(
              'refund-access-mismatch:' || v_transaction.id, 'refund_access_mismatch', 'high',
              'Le remboursement total ne correspond pas exactement a un droit pedagogique.',
              jsonb_build_object('event_id', v_event_id),
              v_transaction.id, v_refund.id, NULL, v_transaction.purchase_id, NULL,
              v_transaction.user_id, v_transaction.course_id
            );
            v_processing_result := 'review_required';
          END IF;
        END IF;
      ELSIF v_refund.status = 'succeeded' AND v_refunded_total > 0 THEN
        UPDATE public.stripe_payment_transactions
        SET status = 'partially_refunded', amount_refunded = v_refunded_total,
            last_event_id = v_event_id, last_event_created_at = v_event_created, updated_at = now()
        WHERE id = v_transaction.id
          AND v_event_created >= last_event_created_at
          AND status NOT IN ('refunded', 'disputed', 'dispute_lost');

        UPDATE public.purchases SET payment_status = 'partially_refunded'
        WHERE id = v_transaction.purchase_id;

        PERFORM private.open_stripe_reconciliation_case(
          'partial-refund:' || v_transaction.id, 'partial_refund', 'high',
          'Un remboursement partiel necessite une decision humaine sur la commande.',
          jsonb_build_object('event_id', v_event_id, 'amount_refunded', v_refunded_total),
          v_transaction.id, v_refund.id, NULL, v_transaction.purchase_id, NULL,
          v_transaction.user_id, v_transaction.course_id
        );
        v_processing_result := 'review_required';
      END IF;
    END IF;

  ELSE
    SELECT * INTO v_transaction
    FROM public.stripe_payment_transactions
    WHERE (v_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = v_payment_intent_id)
       OR (v_charge_id IS NOT NULL AND stripe_charge_id = v_charge_id)
    FOR UPDATE;

    v_user_id := coalesce(v_user_id, v_transaction.user_id);
    v_course_id := coalesce(v_course_id, v_transaction.course_id);

    INSERT INTO public.stripe_disputes (
      transaction_id, stripe_dispute_id, stripe_payment_intent_id, stripe_charge_id,
      status, reason, amount, currency, evidence_due_at,
      last_event_id, last_event_created_at
    ) VALUES (
      v_transaction.id, p_event->>'object_id', v_payment_intent_id, v_charge_id,
      coalesce(v_status, 'unknown'), nullif(p_event->>'reason', ''), v_amount, v_currency,
      CASE WHEN p_event ? 'evidence_due_at' THEN (p_event->>'evidence_due_at')::timestamptz ELSE NULL END,
      v_event_id, v_event_created
    )
    ON CONFLICT (stripe_dispute_id) DO UPDATE
    SET transaction_id = coalesce(EXCLUDED.transaction_id, public.stripe_disputes.transaction_id),
        status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        evidence_due_at = EXCLUDED.evidence_due_at,
        last_event_id = EXCLUDED.last_event_id,
        last_event_created_at = EXCLUDED.last_event_created_at,
        updated_at = now()
    WHERE EXCLUDED.last_event_created_at >= public.stripe_disputes.last_event_created_at
    RETURNING * INTO v_dispute;

    IF v_dispute.id IS NULL THEN
      v_processing_result := 'stale';
    ELSIF v_transaction.id IS NULL THEN
      PERFORM private.open_stripe_reconciliation_case(
        'orphan-dispute:' || v_dispute.stripe_dispute_id, 'orphan_dispute', 'critical',
        'Le litige Stripe ne correspond a aucune transaction locale.',
        jsonb_build_object('event_id', v_event_id, 'payment_intent_id', v_payment_intent_id),
        NULL, NULL, v_dispute.id, NULL, NULL, NULL, NULL
      );
      v_processing_result := 'review_required';
    ELSIF v_dispute.status = 'lost' THEN
      UPDATE public.stripe_payment_transactions
      SET status = 'dispute_lost', last_event_id = v_event_id,
          last_event_created_at = v_event_created, updated_at = now()
      WHERE id = v_transaction.id AND v_event_created >= last_event_created_at;
      UPDATE public.purchases SET payment_status = 'chargeback'
      WHERE id = v_transaction.purchase_id;

      SELECT * INTO v_access FROM public.course_access
      WHERE purchase_id = v_transaction.purchase_id
        AND user_id IS NOT DISTINCT FROM v_transaction.user_id
        AND course_id IS NOT DISTINCT FROM v_transaction.course_id
      FOR UPDATE;
      IF FOUND AND v_access.status IN ('active', 'suspended') THEN
        PERFORM set_config('formaprompt.audit_reason', 'Litige Stripe perdu confirme par evenement signe ' || v_event_id, true);
        UPDATE public.course_access
        SET status = 'revoked', suspension_ends_at = NULL,
            status_changed_at = now(), updated_at = now()
        WHERE id = v_access.id;
      END IF;
    ELSIF v_dispute.status IN ('won', 'warning_closed')
      OR v_event_type = 'charge.dispute.funds_reinstated'
    THEN
      UPDATE public.stripe_payment_transactions
      SET status = 'dispute_won', last_event_id = v_event_id,
          last_event_created_at = v_event_created, updated_at = now()
      WHERE id = v_transaction.id
        AND v_event_created >= last_event_created_at
        AND status <> 'refunded';

      PERFORM private.open_stripe_reconciliation_case(
        'won-dispute:' || v_dispute.id, 'dispute_won_review', 'high',
        'Le litige est gagne mais aucun droit n est reactive automatiquement.',
        jsonb_build_object('event_id', v_event_id, 'dispute_status', v_dispute.status),
        v_transaction.id, NULL, v_dispute.id, v_transaction.purchase_id, NULL,
        v_transaction.user_id, v_transaction.course_id
      );
      v_processing_result := 'review_required';
    ELSE
      UPDATE public.stripe_payment_transactions
      SET status = 'disputed', last_event_id = v_event_id,
          last_event_created_at = v_event_created, updated_at = now()
      WHERE id = v_transaction.id
        AND v_event_created >= last_event_created_at
        AND status NOT IN ('refunded', 'dispute_lost');
      UPDATE public.purchases SET payment_status = 'disputed'
      WHERE id = v_transaction.purchase_id
        AND payment_status NOT IN ('refunded', 'chargeback');

      SELECT * INTO v_access FROM public.course_access
      WHERE purchase_id = v_transaction.purchase_id
        AND user_id IS NOT DISTINCT FROM v_transaction.user_id
        AND course_id IS NOT DISTINCT FROM v_transaction.course_id
      FOR UPDATE;
      IF FOUND AND v_access.status = 'active' THEN
        PERFORM set_config('formaprompt.audit_reason', 'Suspension conservatoire pour litige Stripe ' || v_event_id, true);
        UPDATE public.course_access
        SET status = 'suspended', suspension_ends_at = NULL,
            status_changed_at = now(), updated_at = now()
        WHERE id = v_access.id;
      END IF;
    END IF;
  END IF;

  PERFORM set_config('formaprompt.stripe_event_processing', v_event_id, true);
  UPDATE public.stripe_webhook_events
  SET processing_result = v_processing_result
  WHERE event_id = v_event_id;

  INSERT INTO public.audit_log (
    action_type, target_type, target_id, target_user_id, course_id, reason, metadata
  ) VALUES (
    'stripe_event_' || replace(v_processing_result, '-', '_'),
    'stripe_webhook_event', v_event_id, v_user_id, v_course_id,
    'Evenement Stripe signe traite par le workflow apres paiement.',
    jsonb_build_object(
      'event_type', v_event_type,
      'object_id', p_event->>'object_id',
      'payment_intent_id', v_payment_intent_id,
      'processing_result', v_processing_result
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'processing_result', v_processing_result,
    'transaction_id', v_transaction.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_stripe_post_payment_event(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_stripe_post_payment_event(jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.admin_run_stripe_local_reconciliation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_row record;
  v_detected integer := 0;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action reservee au role admin.' USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT user_id, course_id, min(id::text)::uuid AS transaction_id, count(*) AS transaction_count
    FROM public.stripe_payment_transactions
    WHERE payment_type = 'course'
      AND status IN ('paid', 'partially_refunded', 'refunded', 'disputed', 'dispute_won', 'dispute_lost')
      AND user_id IS NOT NULL AND course_id IS NOT NULL
    GROUP BY user_id, course_id HAVING count(*) > 1
  LOOP
    PERFORM private.open_stripe_reconciliation_case(
      'local-duplicate:' || v_row.user_id || ':' || v_row.course_id,
      'duplicate_payment', 'critical',
      'Plusieurs transactions financieres existent pour le meme utilisateur et la meme formation.',
      jsonb_build_object('transaction_count', v_row.transaction_count),
      v_row.transaction_id, NULL, NULL, NULL, NULL, v_row.user_id, v_row.course_id
    );
    v_detected := v_detected + 1;
  END LOOP;

  FOR v_row IN
    SELECT * FROM public.stripe_payment_transactions
    WHERE payment_type = 'course' AND status IN ('paid', 'partially_refunded', 'refunded', 'disputed', 'dispute_won', 'dispute_lost')
      AND purchase_id IS NULL
  LOOP
    PERFORM private.open_stripe_reconciliation_case(
      'orphan-transaction:' || v_row.id, 'orphan_transaction', 'critical',
      'Une transaction Stripe payee ne correspond a aucun achat local.',
      jsonb_build_object('payment_intent_id', v_row.stripe_payment_intent_id),
      v_row.id, NULL, NULL, NULL, NULL, v_row.user_id, v_row.course_id
    );
    v_detected := v_detected + 1;
  END LOOP;

  FOR v_row IN
    SELECT p.* FROM public.purchases p
    WHERE (p.stripe_checkout_session_id IS NOT NULL OR p.stripe_payment_intent_id IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM public.stripe_payment_transactions t WHERE t.purchase_id = p.id
      )
  LOOP
    PERFORM private.open_stripe_reconciliation_case(
      'purchase-without-transaction:' || v_row.id, 'purchase_without_transaction', 'high',
      'Un achat Stripe historique ne correspond a aucune transaction financiere.',
      '{}'::jsonb, NULL, NULL, NULL, v_row.id, NULL, v_row.user_id, v_row.course_id
    );
    v_detected := v_detected + 1;
  END LOOP;

  FOR v_row IN
    SELECT t.*, p.amount_total AS purchase_amount, p.currency AS purchase_currency
    FROM public.stripe_payment_transactions t
    JOIN public.purchases p ON p.id = t.purchase_id
    WHERE t.amount_total IS DISTINCT FROM p.amount_total OR t.currency IS DISTINCT FROM p.currency
  LOOP
    PERFORM private.open_stripe_reconciliation_case(
      'amount-mismatch:' || v_row.id, 'amount_mismatch', 'critical',
      'Le montant ou la devise Stripe differe de la commande locale.',
      jsonb_build_object(
        'stripe_amount', v_row.amount_total, 'purchase_amount', v_row.purchase_amount,
        'stripe_currency', v_row.currency, 'purchase_currency', v_row.purchase_currency
      ),
      v_row.id, NULL, NULL, v_row.purchase_id, NULL, v_row.user_id, v_row.course_id
    );
    v_detected := v_detected + 1;
  END LOOP;

  FOR v_row IN
    SELECT t.*, i.access_activation_policy
    FROM public.stripe_payment_transactions t
    LEFT JOIN public.commercial_checkout_intents i ON i.id = t.checkout_intent_id
    WHERE t.status = 'paid'
      AND t.payment_type = 'course'
      AND coalesce(t.activation_policy, i.access_activation_policy) = 'immediate_after_payment'
      AND NOT EXISTS (
        SELECT 1 FROM public.course_access a
        WHERE a.purchase_id = t.purchase_id
          AND a.user_id IS NOT DISTINCT FROM t.user_id
          AND a.course_id IS NOT DISTINCT FROM t.course_id
      )
  LOOP
    PERFORM private.open_stripe_reconciliation_case(
      'missing-access:' || v_row.id, 'missing_course_access', 'critical',
      'Un paiement a activation immediate ne correspond a aucun droit pedagogique.',
      '{}'::jsonb, v_row.id, NULL, NULL, v_row.purchase_id, NULL, v_row.user_id, v_row.course_id
    );
    v_detected := v_detected + 1;
  END LOOP;

  FOR v_row IN
    SELECT t.id AS transaction_id, t.purchase_id, t.user_id, t.course_id, a.id AS access_id
    FROM public.stripe_payment_transactions t
    JOIN public.course_access a ON a.purchase_id = t.purchase_id
    WHERE t.status = 'refunded' AND a.status = 'active'
  LOOP
    PERFORM private.open_stripe_reconciliation_case(
      'active-after-refund:' || v_row.transaction_id, 'active_after_total_refund', 'critical',
      'Un droit actif subsiste apres un remboursement total.',
      '{}'::jsonb, v_row.transaction_id, NULL, NULL, v_row.purchase_id,
      v_row.access_id, v_row.user_id, v_row.course_id
    );
    v_detected := v_detected + 1;
  END LOOP;

  FOR v_row IN
    SELECT t.id AS transaction_id, t.purchase_id, t.user_id, t.course_id,
           t.status AS transaction_status, p.payment_status AS purchase_status
    FROM public.stripe_payment_transactions t
    JOIN public.purchases p ON p.id = t.purchase_id
    WHERE (t.status = 'refunded' AND p.payment_status <> 'refunded')
       OR (t.status = 'dispute_lost' AND p.payment_status <> 'chargeback')
       OR (t.status = 'paid' AND p.payment_status NOT IN ('paid', 'granted_by_admin'))
  LOOP
    PERFORM private.open_stripe_reconciliation_case(
      'status-mismatch:' || v_row.transaction_id, 'status_mismatch', 'high',
      'Les statuts Stripe et purchase sont incoherents.',
      jsonb_build_object('transaction_status', v_row.transaction_status, 'purchase_status', v_row.purchase_status),
      v_row.transaction_id, NULL, NULL, v_row.purchase_id, NULL, v_row.user_id, v_row.course_id
    );
    v_detected := v_detected + 1;
  END LOOP;

  INSERT INTO public.audit_log (
    actor_user_id, action_type, target_type, target_id, reason, metadata
  ) VALUES (
    v_actor, 'stripe_local_reconciliation_run', 'stripe_reconciliation', gen_random_uuid()::text,
    'Rapprochement local Stripe, achats et droits lance par un administrateur.',
    jsonb_build_object('detected_count', v_detected)
  );

  RETURN jsonb_build_object('ok', true, 'detected_count', v_detected);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_run_stripe_local_reconciliation()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_run_stripe_local_reconciliation()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_stripe_reconciliation_case(
  p_case_id uuid,
  p_status text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_previous public.stripe_reconciliation_cases%ROWTYPE;
  v_updated public.stripe_reconciliation_cases%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action reservee au role admin.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('reviewed', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Statut de rapprochement invalide.';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) < 5 OR char_length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'Un motif administratif de 5 a 2000 caracteres est requis.';
  END IF;

  SELECT * INTO v_previous FROM public.stripe_reconciliation_cases
  WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cas de rapprochement introuvable.'; END IF;

  UPDATE public.stripe_reconciliation_cases
  SET status = p_status,
      reviewed_at = coalesce(reviewed_at, now()),
      reviewed_by = v_actor,
      resolved_at = CASE WHEN p_status IN ('resolved', 'dismissed') THEN now() ELSE NULL END,
      resolution_reason = btrim(p_reason)
  WHERE id = p_case_id
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_log (
    actor_user_id, action_type, target_type, target_id,
    target_user_id, course_id, previous_state, new_state, reason
  ) VALUES (
    v_actor, 'stripe_reconciliation_case_' || p_status,
    'stripe_reconciliation_case', p_case_id::text,
    v_updated.user_id, v_updated.course_id,
    to_jsonb(v_previous), to_jsonb(v_updated), btrim(p_reason)
  );

  RETURN jsonb_build_object('ok', true, 'case', to_jsonb(v_updated));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_stripe_reconciliation_case(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_stripe_reconciliation_case(uuid, text, text)
  TO authenticated;

-- Le diagnostic RGPD existant est enrichi sans rendre les preuves financieres
-- supprimables automatiquement. Leur resolution par defaut reste retain.
ALTER FUNCTION public.admin_analyze_privacy_request(uuid) SET SCHEMA private;
ALTER FUNCTION private.admin_analyze_privacy_request(uuid)
  RENAME TO admin_analyze_privacy_request_pre_sprint_5;
REVOKE ALL ON FUNCTION private.admin_analyze_privacy_request_pre_sprint_5(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_analyze_privacy_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_request public.privacy_requests%ROWTYPE;
  v_run_id uuid;
  v_count integer;
  v_financial_count integer := 0;
  v_category_count integer;
  v_dependency_count integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT (SELECT private.is_strict_admin()) THEN
    RAISE EXCEPTION 'Action reservee au role admin.' USING ERRCODE = '42501';
  END IF;

  v_result := private.admin_analyze_privacy_request_pre_sprint_5(p_request_id);
  v_run_id := (v_result->>'analysis_run_id')::uuid;
  SELECT * INTO v_request FROM public.privacy_requests WHERE id = p_request_id;

  SELECT count(*)::integer INTO v_count
  FROM public.stripe_payment_transactions
  WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(
    v_request.id, v_run_id, v_request.subject_user_id,
    'stripe_financial_records', 'supabase_database',
    'stripe_payment_transactions', 'direct_user_id', v_count,
    'critical', 'legal_review_required', true, true,
    'payment_and_accounting_evidence'
  ) THEN v_financial_count := v_financial_count + v_count; END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.stripe_refunds r
  JOIN public.stripe_payment_transactions t ON t.id = r.transaction_id
  WHERE t.user_id = v_request.subject_user_id;
  v_count := v_count + (
    SELECT count(*)::integer
    FROM public.stripe_disputes d
    JOIN public.stripe_payment_transactions t ON t.id = d.transaction_id
    WHERE t.user_id = v_request.subject_user_id
  );
  IF private.record_privacy_assessment(
    v_request.id, v_run_id, v_request.subject_user_id,
    'stripe_refunds_disputes', 'supabase_database',
    'stripe_refunds,stripe_disputes', 'indirect_transaction_relation', v_count,
    'critical', 'legal_review_required', true, true,
    'refund_dispute_defence_evidence'
  ) THEN v_financial_count := v_financial_count + v_count; END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.stripe_reconciliation_cases
  WHERE user_id = v_request.subject_user_id;
  IF private.record_privacy_assessment(
    v_request.id, v_run_id, v_request.subject_user_id,
    'stripe_reconciliation_cases', 'supabase_database',
    'stripe_reconciliation_cases', 'direct_user_id', v_count,
    'high', 'potential_retention_to_review', true, true,
    'financial_reconciliation_evidence'
  ) THEN v_financial_count := v_financial_count + v_count; END IF;

  INSERT INTO public.privacy_processing_actions (
    request_id, assessment_id, action_type, suggested_resolution, actor_user_id
  )
  SELECT v_request.id, assessment.id, 'legal_review', 'retain', (SELECT auth.uid())
  FROM public.privacy_dependency_assessments assessment
  WHERE assessment.analysis_run_id = v_run_id
    AND assessment.category IN (
      'stripe_financial_records', 'stripe_refunds_disputes', 'stripe_reconciliation_cases'
    )
  ON CONFLICT DO NOTHING;

  SELECT count(*)::integer,
         coalesce(sum(CASE WHEN category IN ('profile', 'auth_identity') THEN 0 ELSE record_count END), 0)::integer
  INTO v_category_count, v_dependency_count
  FROM public.privacy_dependency_assessments
  WHERE analysis_run_id = v_run_id;

  IF v_financial_count > 0 THEN
    UPDATE public.privacy_requests
    SET analysis_conclusion = 'manual_legal_review_required',
        status = 'under_review', last_analyzed_at = now()
    WHERE id = v_request.id;
  END IF;

  INSERT INTO public.privacy_request_events (
    request_id, actor_user_id, event_type, event_details
  ) VALUES (
    v_request.id, (SELECT auth.uid()), 'analysis_stripe_evidence_added',
    jsonb_build_object(
      'analysis_run_id', v_run_id,
      'financial_evidence_count', v_financial_count,
      'dependency_count', v_dependency_count,
      'category_count', v_category_count
    )
  );

  RETURN v_result || jsonb_build_object(
    'analysis_conclusion', CASE WHEN v_financial_count > 0 THEN 'manual_legal_review_required' ELSE v_result->>'analysis_conclusion' END,
    'financial_evidence_count', v_financial_count,
    'dependency_count', v_dependency_count,
    'category_count', v_category_count
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_analyze_privacy_request(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_analyze_privacy_request(uuid)
  TO authenticated;

COMMIT;
