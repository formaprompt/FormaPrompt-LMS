import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getPurchaseConfig } from '../_shared/purchaseConfig.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

function getStripeMode(secretKey: string) {
  if (secretKey.startsWith('sk_live_')) return 'live';
  if (secretKey.startsWith('sk_test_')) return 'test';
  throw new Error('STRIPE_SECRET_KEY n’est pas une clé Stripe valide.');
}

function getSiteUrl() {
  const siteUrl = new URL(requiredEnv('SITE_URL'));
  if (!['http:', 'https:'].includes(siteUrl.protocol)) {
    throw new Error('SITE_URL doit être une URL HTTP ou HTTPS.');
  }
  return siteUrl.origin;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée.' }, 405);
  }

  try {
    const stripeSecretKey = requiredEnv('STRIPE_SECRET_KEY');
    const stripeMode = getStripeMode(stripeSecretKey);

    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return jsonResponse({ error: 'Connexion requise avant le paiement.' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const purchase = getPurchaseConfig(body.course_id);
    if (!purchase) {
      return jsonResponse({ error: 'Formation non disponible au paiement.' }, 400);
    }

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAnonKey = requiredEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    const user = authData.user;

    if (authError || !user?.id || !user.email) {
      return jsonResponse({ error: 'Session utilisateur invalide ou expirée.' }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: existingAccess, error: accessError } = await supabaseAdmin
      .from('course_access')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', purchase.courseId)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();

    if (accessError) throw accessError;
    if (existingAccess) {
      return jsonResponse({ alreadyPurchased: true });
    }

    // Une preuve de paiement existante bloque également un second débit, même
    // si un administrateur a ensuite suspendu le droit fonctionnel.
    const { data: existingPurchase, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', purchase.courseId)
      .maybeSingle();
    if (purchaseError) throw purchaseError;
    if (existingPurchase) return jsonResponse({ alreadyPurchased: true });

    const priceId = requiredEnv(purchase.priceEnvName);
    const stripe = new Stripe(stripeSecretKey);
    const price = await stripe.prices.retrieve(priceId);

    if (
      price.livemode !== (stripeMode === 'live')
      || !price.active
      || price.currency !== purchase.currency
      || price.unit_amount !== purchase.amountTotal
      || price.recurring !== null
    ) {
      throw new Error(`Le tarif Stripe doit être un prix ${stripeMode}, ponctuel, actif et égal à ${purchase.amountTotal / 100} EUR.`);
    }

    const siteUrl = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email,
      customer_creation: 'always',
      phone_number_collection: { enabled: true },
      allow_promotion_codes: false,
      automatic_tax: { enabled: false },
      consent_collection: { terms_of_service: 'required' },
      invoice_creation: { enabled: true },
      locale: 'fr',
      metadata: {
        user_id: user.id,
        course_id: purchase.courseId,
        price_id: priceId,
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          course_id: purchase.courseId,
        },
      },
      success_url: `${siteUrl}/paiement-reussi?course=${encodeURIComponent(purchase.courseId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}${purchase.landingPath}`,
    });

    if (!session.url) throw new Error('Stripe n’a pas retourné d’URL Checkout.');
    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error('create-checkout:', error);
    return jsonResponse({ error: 'Impossible de préparer le paiement pour le moment.' }, 500);
  }
});
