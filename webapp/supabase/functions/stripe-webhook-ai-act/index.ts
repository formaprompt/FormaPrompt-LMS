import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import {
  getPurchaseConfig,
  IN_PERSON_TRAVEL_FEE,
  requiresLegacyPaymentReview,
  validateCommercialConsentEvidence,
  validateCompletedCourseSession,
  validateCompletedCourseSessionBase,
  validateCompletedTravelFeeSession,
} from '../_shared/purchaseConfig.js';
import {
  validateCompletedCoursePromotionSession,
  validateCoursePromotionEventIdentity,
} from '../_shared/coursePromotion.js';
import {
  buildStripePostPaymentPayload,
  isStripePostPaymentEvent,
} from '../_shared/stripePostPayment.js';
import {
  DIAGNOSTIC_IA_PAYMENT,
  DIAGNOSTIC_LEGAL_STATEMENTS,
  isDiagnosticPaymentObject,
  validateCompletedDiagnosticSession,
  validateDiagnosticEventIdentity,
} from '../_shared/diagnosticPayment.js';
import {
  attemptDiagnosticContractConfirmationDelivery,
  diagnosticContractDeliveryClaimFilter,
  DIAGNOSTIC_CONTRACT_DELIVERY_MAX_ATTEMPTS,
  DIAGNOSTIC_CONTRACT_DELIVERY_RETRY_PENDING,
  isDiagnosticContractDeliveryRetryable,
} from '../_shared/diagnosticContractConfirmation.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

function isLiveStripeKey(secretKey: string) {
  if (secretKey.startsWith('sk_live_') || secretKey.startsWith('rk_live_')) return true;
  if (secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_')) return false;
  throw new Error('STRIPE_SECRET_KEY n’est pas une clé Stripe valide.');
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Méthode non autorisée.', { status: 405 });
  }

  const stripeSecretKey = requiredEnv('STRIPE_SECRET_KEY');
  const liveMode = isLiveStripeKey(stripeSecretKey);
  const signature = request.headers.get('Stripe-Signature');
  if (!signature) return new Response('Signature Stripe absente.', { status: 400 });

  const stripe = new Stripe(stripeSecretKey);
  const cryptoProvider = Stripe.createSubtleCryptoProvider();
  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      requiredEnv('STRIPE_WEBHOOK_SIGNING_SECRET'),
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error('Signature Stripe invalide :', error);
    return new Response('Signature Stripe invalide.', { status: 400 });
  }

  if (event.livemode !== liveMode) {
    return new Response('Le mode de l’événement Stripe ne correspond pas à la clé configurée.', { status: 400 });
  }
  if (!isStripePostPaymentEvent(event.type)) {
    return Response.json({ received: true, ignored: true });
  }

  const supabaseAdmin = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let validationStatus: 'not_required' | 'validated' | 'legacy_review' = 'not_required';
  const object = event.data.object as Stripe.Checkout.Session;
  let diagnosticEvent = false;
  let courseEvent = false;

  if (
    event.type === 'checkout.session.completed'
    || event.type === 'checkout.session.async_payment_succeeded'
  ) {
    if (isDiagnosticPaymentObject(object)) {
      const priceId = requiredEnv(DIAGNOSTIC_IA_PAYMENT.priceEnvName);
      const validationError = validateCompletedDiagnosticSession(object, priceId);
      if (validationError) return new Response(validationError, { status: 400 });
      validationStatus = 'validated';
      diagnosticEvent = true;
    } else if (object.metadata?.payment_type === IN_PERSON_TRAVEL_FEE.paymentType) {
      const validationError = validateCompletedTravelFeeSession(object);
      if (validationError) return new Response(validationError, { status: 400 });
      validationStatus = 'validated';
    } else {
      const purchase = getPurchaseConfig(object.metadata?.course_id);
      if (!purchase) return new Response('Formation Stripe inconnue.', { status: 400 });
      const priceId = requiredEnv(purchase.priceEnvName);

      if (requiresLegacyPaymentReview(object)) {
        const legacyValidationError = validateCompletedCourseSessionBase(object, purchase, priceId);
        if (legacyValidationError) return new Response(legacyValidationError, { status: 400 });
        validationStatus = 'legacy_review';
      } else {
        if (!object.metadata?.promo_redemption_id) {
          const validationError = validateCompletedCourseSession(object, purchase, priceId);
          if (validationError) return new Response(validationError, { status: 400 });
        }

        const checkoutIntentId = object.metadata!.checkout_intent_id;
        const { data: checkoutIntent, error: checkoutIntentError } = await supabaseAdmin
          .from('commercial_checkout_intents')
          .select('id, user_id, course_id, offer_classification, sales_context, access_start_choice, access_activation_policy, status, stripe_checkout_session_id, cgv_document_version_id, original_amount_cents, discount_amount_cents, final_amount_cents, promo_redemption_id, catalog_price_id, stripe_product_id')
          .eq('id', checkoutIntentId)
          .maybeSingle();
        if (checkoutIntentError) {
          console.error(`Intention commerciale ${event.id} inaccessible :`, checkoutIntentError);
          return new Response('Vérification commerciale impossible.', { status: 500 });
        }

        const currentPromotionCheckout = checkoutIntent?.original_amount_cents != null;
        const validationError = currentPromotionCheckout
          ? validateCompletedCoursePromotionSession(object, purchase, priceId, checkoutIntent)
          : validateCompletedCourseSession(object, purchase, priceId);
        if (validationError) return new Response(validationError, { status: 400 });

        const { data: consentRows, error: consentRowsError } = await supabaseAdmin
          .from('commercial_consents')
          .select(`
            checkout_intent_id,
            user_id,
            course_id,
            consent_type,
            granted,
            legal_document_version_id,
            legal_document_versions!inner(id, version)
          `)
          .eq('checkout_intent_id', checkoutIntentId);
        if (consentRowsError) {
          console.error(`Consentements commerciaux ${event.id} inaccessibles :`, consentRowsError);
          return new Response('Vérification commerciale impossible.', { status: 500 });
        }

        const consentValidationError = validateCommercialConsentEvidence(
          object,
          purchase,
          checkoutIntent,
          consentRows,
        );
        if (consentValidationError) return new Response(consentValidationError, { status: 400 });
        validationStatus = 'validated';
        courseEvent = currentPromotionCheckout;
      }
    }
  } else if (
    isDiagnosticPaymentObject(object)
    && [
      'payment_intent.payment_failed',
      'checkout.session.async_payment_failed',
      'checkout.session.expired',
    ].includes(event.type)
  ) {
    const validationError = validateDiagnosticEventIdentity(
      object,
      requiredEnv(DIAGNOSTIC_IA_PAYMENT.priceEnvName),
    );
    if (validationError) return new Response(validationError, { status: 400 });
    validationStatus = 'validated';
    diagnosticEvent = true;
  } else if (
    ['payment_intent.payment_failed', 'checkout.session.async_payment_failed', 'checkout.session.expired']
      .includes(event.type)
    && object.metadata?.payment_type === 'course'
    && object.metadata?.checkout_intent_id
  ) {
    const checkoutIntentId = object.metadata?.checkout_intent_id;
    const { data: checkoutIntent, error: checkoutIntentError } = await supabaseAdmin
      .from('commercial_checkout_intents')
      .select('id, user_id, course_id, status, stripe_checkout_session_id, original_amount_cents, discount_amount_cents, final_amount_cents, promo_redemption_id, catalog_price_id, stripe_product_id')
      .eq('id', checkoutIntentId)
      .maybeSingle();
    if (checkoutIntentError) {
      console.error(`Intention commerciale terminale ${event.id} inaccessible.`);
      return new Response('Vérification commerciale impossible.', { status: 500 });
    }
    if (checkoutIntent?.original_amount_cents != null) {
      const purchase = getPurchaseConfig(object.metadata?.course_id);
      if (!purchase) return new Response('Formation Stripe inconnue.', { status: 400 });
      const validationError = validateCoursePromotionEventIdentity(
        object,
        purchase,
        requiredEnv(purchase.priceEnvName),
        checkoutIntent,
      );
      if (validationError) return new Response(validationError, { status: 400 });
      validationStatus = 'validated';
      courseEvent = true;
    }
  }

  try {
    const payload = buildStripePostPaymentPayload(event, await sha256(rawBody), {
      validation_status: validationStatus,
    });
    const processor = diagnosticEvent
      ? 'process_diagnostic_ia_stripe_event'
      : courseEvent
        ? 'process_course_stripe_event'
        : 'process_stripe_post_payment_event';
    const { data, error } = await supabaseAdmin.rpc(processor, {
      p_event: payload,
    });
    if (error) throw error;

    if (
      diagnosticEvent
      && ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)
    ) {
      try {
        const orderId = object.metadata?.diagnostic_order_id;
        const claimNow = new Date();
        const claimTime = claimNow.toISOString();
        const { data: order, error: orderError } = await supabaseAdmin
          .from('diagnostic_ia_orders')
          .update({
            contract_confirmation_delivery_status: 'sending',
            contract_confirmation_delivery_attempted_at: claimTime,
          })
          .eq('id', orderId)
          .in('status', ['paid', 'disputed'])
          .lt('contract_confirmation_delivery_attempts', DIAGNOSTIC_CONTRACT_DELIVERY_MAX_ATTEMPTS)
          .or(diagnosticContractDeliveryClaimFilter(claimNow))
          .select('id, customer_email, sales_context, paid_at, cgv_document_version_id, contract_confirmation_delivery_attempts')
          .maybeSingle();
        if (orderError) throw orderError;

        if (order) {
          const { data: cgv, error: cgvError } = await supabaseAdmin
            .from('legal_document_versions')
            .select('version, content_text')
            .eq('id', order.cgv_document_version_id)
            .single();
          if (cgvError) throw cgvError;

          let withdrawalForm = null;
          if (order.sales_context === 'personal') {
            const { data: form, error: formError } = await supabaseAdmin
              .from('legal_document_versions')
              .select('version, content_text')
              .eq('document_type', DIAGNOSTIC_LEGAL_STATEMENTS.withdrawalForm.documentType)
              .eq('version', DIAGNOSTIC_LEGAL_STATEMENTS.withdrawalForm.version)
              .eq('status', 'published')
              .single();
            if (formError) throw formError;
            withdrawalForm = form;
          }

          const deliveryUpdate = await attemptDiagnosticContractConfirmationDelivery({ order, cgv, withdrawalForm });
          const { error: deliveryError } = await supabaseAdmin
            .from('diagnostic_ia_orders')
            .update(deliveryUpdate)
            .eq('id', order.id)
            .eq('contract_confirmation_delivery_status', 'sending');
          if (deliveryError) throw deliveryError;
          if (deliveryUpdate.contract_confirmation_delivery_status === 'failed'
            && deliveryUpdate.contract_confirmation_delivery_attempts < DIAGNOSTIC_CONTRACT_DELIVERY_MAX_ATTEMPTS) {
            throw new Error(DIAGNOSTIC_CONTRACT_DELIVERY_RETRY_PENDING);
          }
        } else {
          const { data: deliveryState, error: deliveryStateError } = await supabaseAdmin
            .from('diagnostic_ia_orders')
            .select('contract_confirmation_delivery_status, contract_confirmation_delivery_attempts')
            .eq('id', orderId)
            .maybeSingle();
          if (deliveryStateError) throw deliveryStateError;
          if (isDiagnosticContractDeliveryRetryable(deliveryState)) {
            throw new Error(DIAGNOSTIC_CONTRACT_DELIVERY_RETRY_PENDING);
          }
        }
      } catch (error) {
        console.warn('diagnostic_contract_confirmation_delivery_failed');
        if (error instanceof Error && error.message === DIAGNOSTIC_CONTRACT_DELIVERY_RETRY_PENDING) {
          throw error;
        }
      }
    }
    return Response.json({ received: true, ...data });
  } catch (error) {
    console.error(`Traitement Stripe ${event.id} impossible :`, error);
    return new Response('Traitement Stripe après paiement impossible.', { status: 500 });
  }
});
