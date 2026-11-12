BEGIN;

SELECT '1..17';

CREATE TEMP TABLE order_cases (
  scenario text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  financial_first boolean NOT NULL,
  event_type text NOT NULL,
  financial_status text NOT NULL,
  amount integer NOT NULL,
  expected_transaction text NOT NULL,
  expected_purchase text NOT NULL,
  expected_access text NOT NULL,
  use_charge boolean NOT NULL DEFAULT false
);

INSERT INTO order_cases (scenario, financial_first, event_type, financial_status, amount,
  expected_transaction, expected_purchase, expected_access, use_charge)
VALUES
  ('total_before', true, 'refund.created', 'succeeded', 10000, 'refunded', 'refunded', 'refunded', false),
  ('total_after', false, 'refund.created', 'succeeded', 10000, 'refunded', 'refunded', 'refunded', false),
  ('partial_before', true, 'refund.created', 'succeeded', 3000, 'partially_refunded', 'partially_refunded', 'active', false),
  ('partial_after', false, 'refund.created', 'succeeded', 3000, 'partially_refunded', 'partially_refunded', 'active', false),
  ('dispute_before', true, 'charge.dispute.created', 'needs_response', 10000, 'disputed', 'disputed', 'suspended', false),
  ('dispute_after', false, 'charge.dispute.created', 'needs_response', 10000, 'disputed', 'disputed', 'suspended', false),
  ('lost_before', true, 'charge.dispute.closed', 'lost', 10000, 'dispute_lost', 'chargeback', 'revoked', false),
  ('lost_after', false, 'charge.dispute.closed', 'lost', 10000, 'dispute_lost', 'chargeback', 'revoked', false),
  ('charge_only', true, 'refund.created', 'succeeded', 10000, 'refunded', 'refunded', 'refunded', true),
  ('refund_enriched', true, 'refund.created', 'succeeded', 10000, 'refunded', 'refunded', 'refunded', true),
  ('dispute_enriched', true, 'charge.dispute.created', 'needs_response', 10000, 'disputed', 'disputed', 'suspended', true),
  ('refund_tied', true, 'refund.updated', 'succeeded', 10000, 'refunded', 'refunded', 'refunded', false),
  ('dispute_tied', true, 'charge.dispute.closed', 'lost', 10000, 'dispute_lost', 'chargeback', 'revoked', false),
  ('ambiguous', true, 'refund.created', 'succeeded', 10000, 'paid', 'paid', 'suspended', false),
  ('duplicate', true, 'refund.created', 'succeeded', 10000, 'refunded', 'paid', 'active', false);

INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
SELECT user_id, 'authenticated', 'authenticated', scenario || '-payment-order@example.test', '{}', '{}'
FROM order_cases;

INSERT INTO public.profiles (id, email, role)
SELECT user_id, scenario || '-payment-order@example.test', 'user' FROM order_cases
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.commercial_checkout_intents (
  user_id, course_id, offer_classification, cgv_document_version_id,
  sales_context, access_start_choice, access_activation_policy,
  original_amount_cents, discount_amount_cents, final_amount_cents
)
SELECT user_id, 'formation-ia-act', 'B2C_STANDARD',
  (SELECT id FROM public.legal_document_versions WHERE document_type = 'cgv_b2c' AND status = 'published'),
  'personal', 'immediate', 'immediate_after_payment', 10000, 0, 10000
FROM order_cases WHERE scenario = 'total_before';

GRANT SELECT ON order_cases TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  scenario record;
  success jsonb;
  financial jsonb;
BEGIN
  FOR scenario IN SELECT * FROM order_cases LOOP
    success := jsonb_build_object(
      'event_id', 'evt_payment_order_success_' || scenario.scenario,
      'event_type', 'checkout.session.completed',
      'object_id', 'cs_payment_order_' || scenario.scenario,
      'created_at', '2026-10-01T10:00:00Z', 'livemode', false,
      'stripe_checkout_session_id', 'cs_payment_order_' || scenario.scenario,
      'stripe_payment_intent_id', 'pi_payment_order_' || scenario.scenario,
      'stripe_charge_id', 'ch_payment_order_' || scenario.scenario,
      'user_id', scenario.user_id, 'course_id', 'formation-ia-act', 'payment_type', 'course',
      'validation_status', 'validated', 'activation_policy', 'immediate_after_payment',
      'amount_total', 10000, 'currency', 'eur'
    );
    financial := jsonb_build_object(
      'event_id', 'evt_payment_order_financial_' || scenario.scenario, 'event_type', scenario.event_type,
      'object_id', (CASE WHEN scenario.event_type LIKE 'refund.%' THEN 're_' ELSE 'dp_' END)
        || 'payment_order_' || scenario.scenario,
      'created_at', '2026-10-01T10:01:00Z', 'livemode', false,
      'stripe_payment_intent_id', CASE WHEN NOT scenario.use_charge THEN success->>'stripe_payment_intent_id' END,
      'stripe_charge_id', CASE WHEN scenario.use_charge THEN success->>'stripe_charge_id'
        WHEN scenario.scenario = 'ambiguous' THEN 'ch_payment_order_wrong' END,
      'status', scenario.financial_status, 'amount', scenario.amount, 'currency', 'eur'
    );
    IF scenario.scenario = 'total_before' THEN
      success := success || jsonb_build_object('checkout_intent_id', (
        SELECT id FROM public.commercial_checkout_intents WHERE user_id = scenario.user_id
      ));
      PERFORM public.process_stripe_post_payment_event(financial);
      PERFORM public.process_course_stripe_event(success);
    ELSIF scenario.scenario = 'duplicate' THEN
      PERFORM public.process_stripe_post_payment_event(success || jsonb_build_object(
        'event_id', 'evt_payment_order_original', 'object_id', 'cs_payment_order_original',
        'stripe_checkout_session_id', 'cs_payment_order_original',
        'stripe_payment_intent_id', 'pi_payment_order_original', 'stripe_charge_id', 'ch_payment_order_original'
      ));
      PERFORM public.process_stripe_post_payment_event(financial);
      PERFORM public.process_stripe_post_payment_event(success);
      PERFORM public.process_stripe_post_payment_event(financial || jsonb_build_object(
        'event_id', 'evt_payment_order_updated_duplicate', 'event_type', 'refund.updated', 'created_at', '2026-10-01T10:02:00Z'
      ));
    ELSIF scenario.scenario IN ('refund_enriched', 'dispute_enriched') THEN
      PERFORM public.process_stripe_post_payment_event(financial);
      PERFORM public.process_stripe_post_payment_event(financial || jsonb_build_object(
        'event_id', 'evt_payment_order_enriched_' || scenario.scenario,
        'event_type', CASE WHEN scenario.scenario = 'refund_enriched' THEN 'refund.updated' ELSE 'charge.dispute.updated' END,
        'stripe_payment_intent_id', success->>'stripe_payment_intent_id', 'created_at', '2026-10-01T10:02:00Z'
      ));
      PERFORM public.process_stripe_post_payment_event(success - 'stripe_charge_id');
    ELSIF scenario.scenario IN ('refund_tied', 'dispute_tied') THEN
      PERFORM public.process_stripe_post_payment_event(financial);
      PERFORM public.process_stripe_post_payment_event(financial || jsonb_build_object(
        'event_id', 'evt_payment_order_delayed_created_' || scenario.scenario,
        'event_type', CASE WHEN scenario.scenario = 'refund_tied' THEN 'refund.created' ELSE 'charge.dispute.created' END,
        'status', CASE WHEN scenario.scenario = 'refund_tied' THEN 'pending' ELSE 'needs_response' END
      ));
      PERFORM public.process_stripe_post_payment_event(success);
    ELSIF scenario.financial_first THEN
      PERFORM public.process_stripe_post_payment_event(financial);
      PERFORM public.process_stripe_post_payment_event(success);
    ELSE
      PERFORM public.process_stripe_post_payment_event(success);
      PERFORM public.process_stripe_post_payment_event(financial);
    END IF;
    IF NOT (public.process_stripe_post_payment_event(financial)->>'already_processed')::boolean
      OR NOT (public.process_stripe_post_payment_event(success)->>'already_processed')::boolean
    THEN RAISE EXCEPTION 'Relivraison non dédupliquée pour %', scenario.scenario; END IF;
    IF scenario.scenario = 'dispute_before' THEN
      PERFORM public.process_stripe_post_payment_event(success || jsonb_build_object(
        'event_id', 'evt_payment_order_new_success', 'created_at', '2026-10-01T10:03:00Z'
      ));
    END IF;
  END LOOP;
END;
$$;
RESET ROLE;

WITH observed AS (
  SELECT c.*, t.id AS transaction_id, t.status AS transaction_status,
    p.payment_status AS purchase_status, a.status AS access_status,
    coalesce(r.transaction_id, d.transaction_id) AS financial_transaction,
    k.transaction_id AS case_transaction
  FROM order_cases c
  LEFT JOIN public.stripe_payment_transactions t ON t.stripe_payment_intent_id = 'pi_payment_order_' || c.scenario
  LEFT JOIN public.purchases p ON p.id = t.purchase_id
  LEFT JOIN public.course_access a ON a.purchase_id = p.id
  LEFT JOIN public.stripe_refunds r ON r.stripe_refund_id = 're_payment_order_' || c.scenario
  LEFT JOIN public.stripe_disputes d ON d.stripe_dispute_id = 'dp_payment_order_' || c.scenario
  LEFT JOIN public.stripe_reconciliation_cases k ON k.refund_id = r.id AND k.case_type = 'orphan_refund'
    OR k.dispute_id = d.id AND k.case_type = 'orphan_dispute'
)
SELECT CASE WHEN transaction_status = expected_transaction AND purchase_status = expected_purchase AND access_status = expected_access
    AND CASE WHEN scenario = 'ambiguous' THEN financial_transaction IS NULL AND case_transaction IS NULL
      ELSE financial_transaction = transaction_id AND (NOT financial_first OR case_transaction = transaction_id) END
  THEN 'ok' ELSE 'not ok' END
  || ' ' || row_number() OVER (ORDER BY scenario) || ' - ' || scenario
  || ' (' || concat_ws(', ', transaction_status, purchase_status, access_status) || ')'
FROM observed
ORDER BY scenario;

SELECT CASE WHEN EXISTS (
  SELECT 1 FROM public.stripe_reconciliation_cases
  WHERE case_type = 'early_financial_event_mismatch' AND status = 'pending'
) THEN 'ok' ELSE 'not ok' END || ' 16 - Les références contradictoires restent en revue';

SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM public.audit_log a JOIN order_cases c ON c.user_id = a.target_user_id
  WHERE c.scenario IN ('charge_only', 'total_before', 'dispute_before', 'lost_before', 'ambiguous', 'refund_tied', 'dispute_tied')
    AND a.action_type = 'access_granted'
) THEN 'ok' ELSE 'not ok' END || ' 17 - Aucun accès initialement bloqué n’est journalisé comme ouvert';

ROLLBACK;
