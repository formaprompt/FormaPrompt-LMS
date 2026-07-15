import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { IN_PERSON_TRAVEL_FEE } from '../_shared/purchaseConfig.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

function getSiteUrl() {
  const siteUrl = new URL(requiredEnv('SITE_URL'));
  if (!['http:', 'https:'].includes(siteUrl.protocol)) {
    throw new Error('SITE_URL doit être une URL HTTP ou HTTPS.');
  }
  return siteUrl.origin;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connexion requise.' }, 401);

    const { booking_request_id: bookingRequestId } = await request.json().catch(() => ({}));
    if (typeof bookingRequestId !== 'string') {
      return jsonResponse({ error: 'Demande de réservation invalide.' }, 400);
    }

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAuth = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    const user = authData.user;
    if (authError || !user?.id || !user.email) {
      return jsonResponse({ error: 'Session utilisateur invalide ou expirée.' }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('course_booking_requests')
      .select('id, user_id, course_id, delivery_mode, schedule_format, status, distance_status, travel_fee_amount, travel_fee_status')
      .eq('id', bookingRequestId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (bookingError) throw bookingError;
    if (!booking) return jsonResponse({ error: 'Demande de réservation introuvable.' }, 404);
    if (booking.travel_fee_status === 'paid') return jsonResponse({ alreadyPaid: true });
    if (
      booking.delivery_mode !== 'in_person'
      || !['two_2h', 'two_3h30'].includes(booking.schedule_format)
      || booking.status !== 'awaiting_travel_payment'
      || booking.distance_status !== 'approved'
      || booking.travel_fee_amount !== IN_PERSON_TRAVEL_FEE.amountTotal
    ) {
      return jsonResponse({ error: 'La participation ne peut pas encore être réglée.' }, 409);
    }

    const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'));
    const siteUrl = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: IN_PERSON_TRAVEL_FEE.currency,
          unit_amount: IN_PERSON_TRAVEL_FEE.amountTotal,
          product_data: {
            name: booking.schedule_format === 'two_3h30'
              ? 'Participation déplacement – Présentiel 2 × 3 h 30'
              : 'Participation déplacement – Présentiel 2 × 2 h',
            description: 'Participation unique aux deux déplacements du formateur dans un rayon validé de 100 km autour de Calais.',
          },
        },
      }],
      client_reference_id: user.id,
      customer_email: user.email,
      customer_creation: 'always',
      invoice_creation: { enabled: true },
      locale: 'fr',
      metadata: {
        payment_type: IN_PERSON_TRAVEL_FEE.paymentType,
        booking_request_id: booking.id,
        user_id: user.id,
      },
      payment_intent_data: {
        metadata: {
          payment_type: IN_PERSON_TRAVEL_FEE.paymentType,
          booking_request_id: booking.id,
          user_id: user.id,
        },
      },
      success_url: `${siteUrl}/reservation-formation?course=${encodeURIComponent(booking.course_id)}&paiement=succes&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/reservation-formation?course=${encodeURIComponent(booking.course_id)}&paiement=annule`,
    });

    if (!session.url) throw new Error('Stripe n’a pas retourné d’URL Checkout.');
    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error('create-travel-fee-checkout:', error);
    return jsonResponse({ error: 'Impossible de préparer la participation au déplacement.' }, 500);
  }
});
