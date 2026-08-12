import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import {
  getPurchaseConfig,
  IN_PERSON_TRAVEL_FEE,
  validateCommercialConsentEvidence,
  validateCompletedCourseSession,
  validateCompletedCourseSessionBase,
  requiresLegacyPaymentReview,
  shouldActivateCourseAccess,
  validateCompletedTravelFeeSession,
} from '../_shared/purchaseConfig.js';
import {
  buildStripeCourseAccess,
  shouldCreateStripeCourseAccess,
} from '../_shared/courseAccess.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

function isLiveStripeKey(secretKey: string) {
  if (secretKey.startsWith('sk_live_')) return true;
  if (secretKey.startsWith('sk_test_')) return false;
  throw new Error('STRIPE_SECRET_KEY n’est pas une clé Stripe valide.');
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
  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
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

  if (event.type !== 'checkout.session.completed') {
    return Response.json({ received: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.metadata?.payment_type === IN_PERSON_TRAVEL_FEE.paymentType) {
    const validationError = validateCompletedTravelFeeSession(session);
    if (validationError) {
      console.error(`Événement déplacement ${event.id} refusé : ${validationError}`);
      return new Response(validationError, { status: 400 });
    }

    try {
      const supabaseAdmin = createClient(
        requiredEnv('SUPABASE_URL'),
        requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const bookingRequestId = session.metadata!.booking_request_id;
      const userId = session.metadata!.user_id;
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('course_booking_requests')
        .select('id, status, schedule_format, travel_fee_status, stripe_checkout_session_id')
        .eq('id', bookingRequestId)
        .eq('user_id', userId)
        .eq('delivery_mode', 'in_person')
        .eq('distance_status', 'approved')
        .eq('travel_fee_amount', IN_PERSON_TRAVEL_FEE.amountTotal)
        .maybeSingle();

      if (bookingError) throw bookingError;
      if (!booking) return new Response('Réservation présentielle introuvable.', { status: 400 });
      if (!['two_2h', 'two_3h30', 'two_5h'].includes(booking.schedule_format)) {
        return new Response('Format de réservation incompatible avec cette participation.', { status: 400 });
      }

      if (booking.travel_fee_status === 'paid') {
        if (booking.stripe_checkout_session_id === session.id) {
          return Response.json({ received: true, alreadyProcessed: true });
        }
        return new Response('Cette participation a déjà été réglée.', { status: 409 });
      }

      if (booking.status !== 'awaiting_travel_payment') {
        return new Response('La réservation n’attend pas ce paiement.', { status: 409 });
      }

      const { error: updateError } = await supabaseAdmin
        .from('course_booking_requests')
        .update({
          status: 'confirmed',
          travel_fee_status: 'paid',
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
          stripe_event_id: event.id,
        })
        .eq('id', bookingRequestId)
        .eq('user_id', userId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error(`Enregistrement de la participation ${event.id} impossible :`, error);
      return new Response('Enregistrement de la participation impossible.', { status: 500 });
    }

    return Response.json({ received: true, paymentType: IN_PERSON_TRAVEL_FEE.paymentType });
  }

  const purchase = getPurchaseConfig(session.metadata?.course_id);
  if (!purchase) return new Response('Formation Stripe inconnue.', { status: 400 });
  const priceId = requiredEnv(purchase.priceEnvName);
  const supabaseAdmin = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  if (requiresLegacyPaymentReview(session)) {
    const legacyValidationError = validateCompletedCourseSessionBase(session, purchase, priceId);
    if (legacyValidationError) {
      console.error(`Ancienne session ${event.id} refusée : ${legacyValidationError}`);
      return new Response(legacyValidationError, { status: 400 });
    }

    try {
      const { data: historicalPurchase, error: historicalError } = await supabaseAdmin
        .from('purchases')
        .select('id')
        .eq('stripe_checkout_session_id', session.id)
        .maybeSingle();
      if (historicalError) throw historicalError;
      if (historicalPurchase) {
        return Response.json({ received: true, alreadyProcessed: true });
      }

      const { error: reviewError } = await supabaseAdmin
        .from('commercial_payment_reviews')
        .upsert({
          stripe_event_id: event.id,
          stripe_checkout_session_id: session.id,
          user_id: session.metadata!.user_id,
          course_id: purchase.courseId,
          reason: 'legacy_session_without_commercial_checkout_intent',
        }, { onConflict: 'stripe_checkout_session_id', ignoreDuplicates: true });
      if (reviewError) throw reviewError;
      return Response.json({ received: true, administrativeReviewRequired: true });
    } catch (error) {
      console.error(`Mise en revue du paiement ${event.id} impossible :`, error);
      return new Response('Mise en revue administrative impossible.', { status: 500 });
    }
  }

  const validationError = validateCompletedCourseSession(session, purchase, priceId);

  if (validationError) {
    console.error(`Événement ${event.id} refusé : ${validationError}`);
    return new Response(validationError, { status: 400 });
  }

  try {
    const checkoutIntentId = session.metadata!.checkout_intent_id;
    const { data: checkoutIntent, error: checkoutIntentError } = await supabaseAdmin
      .from('commercial_checkout_intents')
      .select('id, user_id, course_id, offer_classification, sales_context, access_start_choice, access_activation_policy, status, stripe_checkout_session_id')
      .eq('id', checkoutIntentId)
      .maybeSingle();
    if (checkoutIntentError) throw checkoutIntentError;

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
    if (consentRowsError) throw consentRowsError;

    const consentValidationError = validateCommercialConsentEvidence(
      session,
      purchase,
      checkoutIntent,
      consentRows,
    );
    if (consentValidationError) {
      console.error(`Événement ${event.id} sans preuve commerciale valide : ${consentValidationError}`);
      return new Response(consentValidationError, { status: 400 });
    }

    const purchasedAt = new Date(event.created * 1000).toISOString();
    const { data: savedPurchase, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .upsert({
        user_id: session.metadata!.user_id,
        course_id: purchase.courseId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
        stripe_event_id: event.id,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
        customer_phone: session.customer_details?.phone ?? null,
        purchased_at: purchasedAt,
      }, { onConflict: 'user_id,course_id' })
      .select('id')
      .single();

    if (purchaseError) throw purchaseError;

    if (shouldActivateCourseAccess(checkoutIntent)) {
      const { data: existingAccess, error: existingAccessError } = await supabaseAdmin
        .from('course_access')
        .select('id')
        .eq('user_id', session.metadata!.user_id)
        .eq('course_id', purchase.courseId)
        .maybeSingle();
      if (existingAccessError) throw existingAccessError;

      if (shouldCreateStripeCourseAccess(existingAccess)) {
        const { error: accessError } = await supabaseAdmin
          .from('course_access')
          .insert(buildStripeCourseAccess({
            userId: session.metadata!.user_id,
            courseId: purchase.courseId,
            purchaseId: savedPurchase.id,
            grantedAt: purchasedAt,
            updatedAt: new Date().toISOString(),
          }));

        // Une livraison concurrente peut avoir créé le même droit entre la
        // lecture et l'insert. Elle reste idempotente sans réactiver un droit.
        if (accessError && accessError.code !== '23505') throw accessError;
      }
    }

    const { error: intentPaidError } = await supabaseAdmin
      .from('commercial_checkout_intents')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', checkoutIntentId)
      .in('status', ['stripe_session_created', 'paid']);
    if (intentPaidError) throw intentPaidError;
  } catch (error) {
    console.error(`Enregistrement de l’achat ${event.id} impossible :`, error);
    return new Response('Enregistrement de l’achat impossible.', { status: 500 });
  }

  return Response.json({ received: true });
});
