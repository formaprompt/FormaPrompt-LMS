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
  buildStripePostPaymentPayload,
  isStripePostPaymentEvent,
} from '../_shared/stripePostPayment.js';
import {
  DIAGNOSTIC_IA_PAYMENT,
  isDiagnosticPaymentObject,
  validateCompletedDiagnosticSession,
  validateDiagnosticEventIdentity,
} from '../_shared/diagnosticPayment.js';

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
        const validationError = validateCompletedCourseSession(object, purchase, priceId);
        if (validationError) return new Response(validationError, { status: 400 });

        const checkoutIntentId = object.metadata!.checkout_intent_id;
        const { data: checkoutIntent, error: checkoutIntentError } = await supabaseAdmin
          .from('commercial_checkout_intents')
          .select('id, user_id, course_id, offer_classification, sales_context, access_start_choice, access_activation_policy, status, stripe_checkout_session_id')
          .eq('id', checkoutIntentId)
          .maybeSingle();
        if (checkoutIntentError) {
          console.error(`Intention commerciale ${event.id} inaccessible :`, checkoutIntentError);
          return new Response('Vérification commerciale impossible.', { status: 500 });
        }

        const { data: consentRows, error: consentRowsError } = await supabaseAdmin
          .from('commercial_consents')
          .select(`
            checkout_intent_id,
            user_id,
            course_id,
            consent_type,
            granted,
            legal_document_versions!inner(version)
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
  }

  try {
    const payload = buildStripePostPaymentPayload(event, await sha256(rawBody), {
      validation_status: validationStatus,
    });
    const processor = diagnosticEvent
      ? 'process_diagnostic_ia_stripe_event'
      : 'process_stripe_post_payment_event';
    const { data, error } = await supabaseAdmin.rpc(processor, {
      p_event: payload,
    });
    if (error) throw error;
    return Response.json({ received: true, ...data });
  } catch (error) {
    console.error(`Traitement Stripe ${event.id} impossible :`, error);
    return new Response('Traitement Stripe après paiement impossible.', { status: 500 });
  }
});
