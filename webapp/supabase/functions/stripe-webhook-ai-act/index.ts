import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import {
  getPurchaseConfig,
  IN_PERSON_TRAVEL_FEE,
  validateCompletedCourseSession,
  validateCompletedTravelFeeSession,
} from '../_shared/purchaseConfig.js';

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
      if (!['two_2h', 'two_3h30'].includes(booking.schedule_format)) {
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
  const validationError = validateCompletedCourseSession(session, purchase, priceId);

  if (validationError) {
    console.error(`Événement ${event.id} refusé : ${validationError}`);
    return new Response(validationError, { status: 400 });
  }

  try {
    const supabaseAdmin = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { error } = await supabaseAdmin
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
        purchased_at: new Date(event.created * 1000).toISOString(),
      }, { onConflict: 'user_id,course_id' });

    if (error) throw error;
  } catch (error) {
    console.error(`Enregistrement de l’achat ${event.id} impossible :`, error);
    return new Response('Enregistrement de l’achat impossible.', { status: 500 });
  }

  return Response.json({ received: true });
});
