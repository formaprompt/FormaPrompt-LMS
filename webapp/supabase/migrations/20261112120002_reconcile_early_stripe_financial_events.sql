BEGIN;

CREATE INDEX stripe_orphan_refunds_intent_idx ON public.stripe_refunds (stripe_payment_intent_id)
WHERE transaction_id IS NULL AND stripe_payment_intent_id IS NOT NULL;
CREATE INDEX stripe_orphan_refunds_charge_idx ON public.stripe_refunds (stripe_charge_id)
WHERE transaction_id IS NULL AND stripe_charge_id IS NOT NULL;
CREATE INDEX stripe_orphan_disputes_intent_idx ON public.stripe_disputes (stripe_payment_intent_id)
WHERE transaction_id IS NULL AND stripe_payment_intent_id IS NOT NULL;
CREATE INDEX stripe_orphan_disputes_charge_idx ON public.stripe_disputes (stripe_charge_id)
WHERE transaction_id IS NULL AND stripe_charge_id IS NOT NULL;

CREATE FUNCTION private.reconcile_early_course_stripe_events(
  p_transaction public.stripe_payment_transactions,
  p_livemode boolean,
  p_new_purchase boolean,
  OUT access_status text,
  OUT needs_review boolean
)
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_evidence record;
  v_refunded bigint := 0;
  v_lost_dispute boolean := false;
  v_open_dispute boolean := false;
  v_won_dispute boolean := false;
  v_unmatched boolean := false;
  v_transaction_status text;
  v_purchase_status text;
  v_last_event text := p_transaction.last_event_id;
  v_last_created timestamptz := p_transaction.last_event_created_at;
BEGIN
  access_status := 'active';
  needs_review := false;

  FOR v_evidence IN
    WITH candidates AS (
      SELECT 'refund' AS kind, id, stripe_payment_intent_id, stripe_charge_id, status, amount, currency,
        last_event_id, last_event_created_at
      FROM public.stripe_refunds
      WHERE transaction_id IS NULL
        AND (stripe_payment_intent_id = p_transaction.stripe_payment_intent_id OR stripe_charge_id = p_transaction.stripe_charge_id)
      UNION ALL
      SELECT 'dispute', id, stripe_payment_intent_id, stripe_charge_id, status, amount, currency,
        last_event_id, last_event_created_at
      FROM public.stripe_disputes
      WHERE transaction_id IS NULL
        AND (stripe_payment_intent_id = p_transaction.stripe_payment_intent_id OR stripe_charge_id = p_transaction.stripe_charge_id)
    )
    SELECT c.*, e.event_type,
      e.livemode = p_livemode
      AND c.currency = p_transaction.currency
      AND (c.stripe_payment_intent_id IS NULL OR p_transaction.stripe_payment_intent_id IS NULL
        OR c.stripe_payment_intent_id = p_transaction.stripe_payment_intent_id)
      AND (c.stripe_charge_id IS NULL OR p_transaction.stripe_charge_id IS NULL
        OR c.stripe_charge_id = p_transaction.stripe_charge_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.stripe_payment_transactions other
        WHERE other.id <> p_transaction.id
          AND (other.stripe_payment_intent_id = c.stripe_payment_intent_id OR other.stripe_charge_id = c.stripe_charge_id)
      ) AS can_attach
    FROM candidates c JOIN public.stripe_webhook_events e ON e.event_id = c.last_event_id
    ORDER BY c.last_event_created_at, c.last_event_id
  LOOP
    needs_review := true;

    IF v_evidence.can_attach IS NOT TRUE THEN
      v_unmatched := true;
      PERFORM private.open_stripe_reconciliation_case(
        'conflicting-early-event:' || p_transaction.id || ':' || v_evidence.id,
        'early_financial_event_mismatch', 'critical',
        'Un événement financier antérieur partage une référence Stripe. Les autres preuves divergent ou sont incomplètes.',
        jsonb_build_object('event_id', v_evidence.last_event_id),
        p_transaction.id,
        CASE WHEN v_evidence.kind = 'refund' THEN v_evidence.id END,
        CASE WHEN v_evidence.kind = 'dispute' THEN v_evidence.id END,
        p_transaction.purchase_id, NULL, p_transaction.user_id, p_transaction.course_id
      );
      CONTINUE;
    END IF;

    IF v_evidence.kind = 'refund' THEN
      UPDATE public.stripe_refunds SET transaction_id = p_transaction.id, updated_at = now()
      WHERE id = v_evidence.id AND transaction_id IS NULL;
      IF v_evidence.status = 'succeeded' THEN v_refunded := v_refunded + v_evidence.amount; END IF;
    ELSE
      UPDATE public.stripe_disputes SET transaction_id = p_transaction.id, updated_at = now()
      WHERE id = v_evidence.id AND transaction_id IS NULL;
      IF v_evidence.status = 'lost' THEN
        v_lost_dispute := true;
      ELSIF v_evidence.status IN ('won', 'warning_closed') OR v_evidence.event_type = 'charge.dispute.funds_reinstated' THEN
        v_won_dispute := true;
      ELSE
        v_open_dispute := true;
      END IF;
    END IF;

    UPDATE public.stripe_reconciliation_cases
    SET transaction_id = p_transaction.id, purchase_id = p_transaction.purchase_id,
        user_id = p_transaction.user_id, course_id = p_transaction.course_id,
        summary = 'Événement financier reçu avant le paiement et rapproché. Vérifier le résultat du traitement.',
        details = details || jsonb_build_object('matched_by', 'stripe_payment_identifiers')
    WHERE transaction_id IS NULL
      AND ((v_evidence.kind = 'refund' AND case_type = 'orphan_refund' AND refund_id = v_evidence.id)
        OR (v_evidence.kind = 'dispute' AND case_type = 'orphan_dispute' AND dispute_id = v_evidence.id));

    IF v_evidence.last_event_created_at >= v_last_created THEN
      v_last_event := v_evidence.last_event_id;
      v_last_created := v_evidence.last_event_created_at;
    END IF;
  END LOOP;

  IF NOT needs_review THEN RETURN; END IF;

  v_transaction_status := CASE
    WHEN v_lost_dispute THEN 'dispute_lost'
    WHEN v_refunded >= p_transaction.amount_total THEN 'refunded'
    WHEN v_open_dispute THEN 'disputed'
    WHEN v_won_dispute THEN 'dispute_won'
    WHEN v_refunded > 0 THEN 'partially_refunded'
    ELSE p_transaction.status
  END;
  access_status := CASE
    WHEN v_transaction_status = 'dispute_lost' THEN 'revoked'
    WHEN v_transaction_status = 'refunded' THEN 'refunded'
    WHEN v_transaction_status IN ('disputed', 'dispute_won') OR v_unmatched THEN 'suspended'
    ELSE 'active'
  END;

  UPDATE public.stripe_payment_transactions
  SET status = v_transaction_status, amount_refunded = least(v_refunded, 2147483647)::integer,
      last_event_id = v_last_event, last_event_created_at = v_last_created, updated_at = now()
  WHERE id = p_transaction.id;

  v_purchase_status := CASE v_transaction_status
    WHEN 'dispute_lost' THEN 'chargeback'
    WHEN 'dispute_won' THEN 'disputed'
    ELSE v_transaction_status
  END;
  -- Une deuxième transaction peut référencer la première commande. Seule la
  -- commande créée par ce succès reçoit ici le nouvel état financier.
  IF p_new_purchase AND v_purchase_status <> 'paid' THEN
    UPDATE public.purchases SET payment_status = v_purchase_status WHERE id = p_transaction.purchase_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.reconcile_early_course_stripe_events(public.stripe_payment_transactions, boolean, boolean)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.reconcile_early_course_stripe_events(public.stripe_payment_transactions, boolean, boolean)
TO service_role;

-- Conserver le traitement signé existant. Les ancres vérifiées bornent la
-- modification aux verrous et à la branche de succès d'un paiement de cours.
DO $migration$
DECLARE
  v_source text := pg_get_functiondef('public.process_stripe_post_payment_event(jsonb)'::regprocedure);
  v_edit record;
  v_financial_match text := $old$    FROM public.stripe_payment_transactions
    WHERE (v_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = v_payment_intent_id)
       OR (v_charge_id IS NOT NULL AND stripe_charge_id = v_charge_id)
    FOR UPDATE;$old$;
BEGIN
  FOR v_edit IN SELECT * FROM (VALUES
    ($old$  v_existing_transaction_count integer := 0;$old$,
     $new$  v_existing_transaction_count integer := 0;
  v_financial_review boolean;
  v_initial_access_status text;
  v_payment_lock bigint;$new$),
    ($old$  PERFORM pg_advisory_xact_lock(hashtextextended(
    coalesce(v_payment_intent_id, v_session_id, v_charge_id, p_event->>'object_id', v_event_id), 0
  ));$old$,
     $new$  FOR v_payment_lock IN
    SELECT DISTINCT hashtextextended(key, 0)
    FROM unnest(ARRAY[v_payment_intent_id, v_session_id, v_charge_id,
      CASE WHEN v_payment_intent_id IS NULL AND v_session_id IS NULL AND v_charge_id IS NULL
        THEN coalesce(p_event->>'object_id', v_event_id) END]) AS payment_keys(key)
    WHERE key IS NOT NULL
    ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(v_payment_lock);
  END LOOP;$new$),
    ($old$        IF v_purchase_created
          AND p_event->>'activation_policy' = 'immediate_after_payment'$old$,
     $new$        SELECT access_status, needs_review INTO v_initial_access_status, v_financial_review
        FROM private.reconcile_early_course_stripe_events(v_transaction, (p_event->>'livemode')::boolean, v_purchase_created);
        IF v_financial_review THEN v_processing_result := 'review_required'; END IF;

        IF v_purchase_created
          AND p_event->>'activation_policy' = 'immediate_after_payment'$new$),
    ($old$              v_user_id, v_course_id, 'active', 'stripe', v_purchase.id,$old$,
     $new$              v_user_id, v_course_id, v_initial_access_status, 'stripe', v_purchase.id,$new$),
    ($old$          AND v_transaction.status NOT IN ('refunded', 'dispute_lost')$old$,
     $new$          AND v_transaction.status IN ('created', 'processing', 'paid', 'failed', 'expired')$new$),
    ($old$    SET transaction_id = coalesce(EXCLUDED.transaction_id, public.stripe_refunds.transaction_id),$old$,
     $new$    SET transaction_id = coalesce(public.stripe_refunds.transaction_id, EXCLUDED.transaction_id),
        stripe_payment_intent_id = coalesce(public.stripe_refunds.stripe_payment_intent_id, EXCLUDED.stripe_payment_intent_id),
        stripe_charge_id = coalesce(public.stripe_refunds.stripe_charge_id, EXCLUDED.stripe_charge_id),$new$),
    ($old$    WHERE EXCLUDED.last_event_created_at >= public.stripe_refunds.last_event_created_at$old$,
     $new$    WHERE EXCLUDED.last_event_created_at >= public.stripe_refunds.last_event_created_at
      -- Les horodatages Stripe ont une précision à la seconde. Un état en
      -- attente reçu ensuite à la même seconde ne réécrit pas un résultat.
      AND (EXCLUDED.last_event_created_at > public.stripe_refunds.last_event_created_at
        OR public.stripe_refunds.status NOT IN ('succeeded', 'failed', 'canceled')
        OR EXCLUDED.status = public.stripe_refunds.status OR EXCLUDED.status = 'succeeded')
      AND (public.stripe_refunds.transaction_id IS NULL OR EXCLUDED.transaction_id IS NULL
        OR public.stripe_refunds.transaction_id = EXCLUDED.transaction_id)
      AND (public.stripe_refunds.stripe_payment_intent_id IS NULL OR EXCLUDED.stripe_payment_intent_id IS NULL
        OR public.stripe_refunds.stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id)
      AND (public.stripe_refunds.stripe_charge_id IS NULL OR EXCLUDED.stripe_charge_id IS NULL
        OR public.stripe_refunds.stripe_charge_id = EXCLUDED.stripe_charge_id)$new$),
    ($old$    SET transaction_id = coalesce(EXCLUDED.transaction_id, public.stripe_disputes.transaction_id),$old$,
     $new$    SET transaction_id = coalesce(public.stripe_disputes.transaction_id, EXCLUDED.transaction_id),
        stripe_payment_intent_id = coalesce(public.stripe_disputes.stripe_payment_intent_id, EXCLUDED.stripe_payment_intent_id),
        stripe_charge_id = coalesce(public.stripe_disputes.stripe_charge_id, EXCLUDED.stripe_charge_id),$new$),
    ($old$    WHERE EXCLUDED.last_event_created_at >= public.stripe_disputes.last_event_created_at$old$,
     $new$    WHERE EXCLUDED.last_event_created_at >= public.stripe_disputes.last_event_created_at
      AND (EXCLUDED.last_event_created_at > public.stripe_disputes.last_event_created_at
        OR public.stripe_disputes.status NOT IN ('lost', 'won', 'warning_closed')
        OR EXCLUDED.status = public.stripe_disputes.status OR EXCLUDED.status = 'lost')
      AND (public.stripe_disputes.transaction_id IS NULL OR EXCLUDED.transaction_id IS NULL
        OR public.stripe_disputes.transaction_id = EXCLUDED.transaction_id)
      AND (public.stripe_disputes.stripe_payment_intent_id IS NULL OR EXCLUDED.stripe_payment_intent_id IS NULL
        OR public.stripe_disputes.stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id)
      AND (public.stripe_disputes.stripe_charge_id IS NULL OR EXCLUDED.stripe_charge_id IS NULL
        OR public.stripe_disputes.stripe_charge_id = EXCLUDED.stripe_charge_id)$new$)
  ) AS edits(anchor, replacement)
  LOOP
    IF (length(v_source) - length(replace(v_source, v_edit.anchor, ''))) <> length(v_edit.anchor) THEN
      RAISE EXCEPTION 'Ancre de rapprochement Stripe absente ou ambiguë : %', v_edit.anchor;
    END IF;
    v_source := replace(v_source, v_edit.anchor, v_edit.replacement);
  END LOOP;

  -- La même recherche est utilisée pour les remboursements et les litiges.
  IF (length(v_source) - length(replace(v_source, v_financial_match, ''))) <> 2 * length(v_financial_match) THEN
    RAISE EXCEPTION 'Ancres des deux traitements financiers Stripe absentes ou ambiguës.';
  END IF;
  v_source := replace(v_source, v_financial_match, $new$    FROM public.stripe_payment_transactions t
    WHERE (t.stripe_payment_intent_id = v_payment_intent_id OR t.stripe_charge_id = v_charge_id)
      AND (v_payment_intent_id IS NULL OR t.stripe_payment_intent_id IS NULL
        OR t.stripe_payment_intent_id = v_payment_intent_id)
      AND (v_charge_id IS NULL OR t.stripe_charge_id IS NULL OR t.stripe_charge_id = v_charge_id)
      AND (v_currency IS NULL OR t.currency IS NULL OR t.currency = v_currency)
      AND NOT EXISTS (
        SELECT 1 FROM public.stripe_webhook_events e WHERE e.event_id = t.last_event_id
          AND e.livemode <> (p_event->>'livemode')::boolean
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.stripe_payment_transactions other
        WHERE other.id <> t.id
          AND (other.stripe_payment_intent_id = v_payment_intent_id OR other.stripe_charge_id = v_charge_id)
      )
    FOR UPDATE;

    -- Le lien financier d'un paiement dupliqué reste disponible pour revue.
    -- Seule la transaction identifiée sur la commande peut toucher son droit.
    IF v_transaction.purchase_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.purchases p WHERE p.id = v_transaction.purchase_id
        AND (p.stripe_checkout_session_id = v_transaction.stripe_checkout_session_id
          OR p.stripe_payment_intent_id = v_transaction.stripe_payment_intent_id)
    ) THEN
      v_transaction.purchase_id := NULL;
    END IF;$new$);
  EXECUTE v_source;
END;
$migration$;

-- Un droit initialement suspendu, remboursé ou révoqué doit être journalisé
-- avec son état réel et sans événement d'ouverture d'accès.
DO $migration$
DECLARE
  v_source text := pg_get_functiondef('private.audit_sensitive_row_change()'::regprocedure);
  v_anchor text := $old$      WHEN TG_OP = 'INSERT' THEN 'access_granted'$old$;
BEGIN
  IF (length(v_source) - length(replace(v_source, v_anchor, ''))) <> length(v_anchor) THEN
    RAISE EXCEPTION 'Ancre de journalisation des droits absente ou ambiguë.';
  END IF;
  EXECUTE replace(v_source, v_anchor, $new$      WHEN TG_OP = 'INSERT' AND NEW.status = 'active' THEN 'access_granted'
      WHEN TG_OP = 'INSERT' AND NEW.status = 'suspended' THEN 'access_suspended'
      WHEN TG_OP = 'INSERT' AND NEW.status = 'revoked' THEN 'access_revoked'
      WHEN TG_OP = 'INSERT' AND NEW.status = 'refunded' THEN 'access_marked_refunded'
      WHEN TG_OP = 'INSERT' THEN 'course_access_updated'$new$);
END;
$migration$;

COMMIT;
