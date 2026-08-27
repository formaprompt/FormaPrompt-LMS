import Stripe from 'npm:stripe@22.4.0';
import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  DIAGNOSTIC_IA_PAYMENT,
  DIAGNOSTIC_LEGAL_STATEMENTS,
  getDiagnosticStripeMode,
  getDiagnosticCgv,
  validateDiagnosticCheckoutRequest,
  validateDiagnosticStripePrice,
} from '../_shared/diagnosticPayment.js';

type DiagnosticOrder = {
  id: string;
  status: string;
  sales_context: string;
  cgv_document_version_id: string;
  cgv_acceptance_statement_version_id: string;
  stripe_checkout_session_id: string | null;
};

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
    const stripeSecretKey = requiredEnv('STRIPE_SECRET_KEY');
    const stripeMode = getDiagnosticStripeMode(stripeSecretKey);

    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connexion requise avant le paiement.' }, 401);

    const body = await request.json().catch(() => ({}));
    const checkoutValidationError = validateDiagnosticCheckoutRequest(body);
    if (checkoutValidationError) return jsonResponse({ error: checkoutValidationError }, 400);

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

    const priceId = requiredEnv(DIAGNOSTIC_IA_PAYMENT.priceEnvName);
    const stripe = new Stripe(stripeSecretKey);
    const price = await stripe.prices.retrieve(priceId);
    const priceValidationError = validateDiagnosticStripePrice(price, stripeMode);
    if (priceValidationError) throw new Error(priceValidationError);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const cgv = getDiagnosticCgv(body.sales_context)!;
    const { data: legalDocument, error: legalDocumentError } = await supabaseAdmin
      .from('legal_document_versions')
      .select('id')
      .eq('document_type', cgv.documentType)
      .eq('version', cgv.version)
      .eq('status', 'published')
      .maybeSingle();
    if (legalDocumentError) throw legalDocumentError;
    if (!legalDocument) {
      return jsonResponse({ error: 'La version des CGV applicable est introuvable ou non publiée.' }, 409);
    }
    const { data: acceptanceStatement, error: acceptanceStatementError } = await supabaseAdmin
      .from('legal_document_versions')
      .select('id')
      .eq('document_type', DIAGNOSTIC_LEGAL_STATEMENTS.cgvAcceptance.documentType)
      .eq('version', DIAGNOSTIC_LEGAL_STATEMENTS.cgvAcceptance.version)
      .eq('status', 'published')
      .maybeSingle();
    if (acceptanceStatementError) throw acceptanceStatementError;
    if (!acceptanceStatement) {
      return jsonResponse({ error: 'La formulation d’acceptation contractuelle est introuvable ou non publiée.' }, 409);
    }

    const { data: paidOrder, error: paidOrderError } = await supabaseAdmin
      .from('diagnostic_ia_orders')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['paid', 'disputed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (paidOrderError) throw paidOrderError;
    if (paidOrder) {
      return jsonResponse({ alreadyPaid: true, orderId: paidOrder.id });
    }

    let { data: order, error: pendingOrderError } = await supabaseAdmin
      .from('diagnostic_ia_orders')
      .select('id, status, sales_context, cgv_document_version_id, cgv_acceptance_statement_version_id, stripe_checkout_session_id')
      .eq('user_id', user.id)
      .eq('status', 'payment_pending')
      .maybeSingle<DiagnosticOrder>();
    if (pendingOrderError) throw pendingOrderError;

    if (order?.stripe_checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
      if (existingSession.status === 'open' && existingSession.url) {
        return jsonResponse({ url: existingSession.url, orderId: order.id, reused: true });
      }
      if (existingSession.status === 'complete') {
        return jsonResponse({ confirmationPending: true, orderId: order.id });
      }
      const { error: cancelError } = await supabaseAdmin
        .from('diagnostic_ia_orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('status', 'payment_pending');
      if (cancelError) throw cancelError;
      order = null;
    }

    if (!order) {
      const insertPayload = {
        user_id: user.id,
        customer_email: user.email,
        amount_total: DIAGNOSTIC_IA_PAYMENT.amountTotal,
        currency: DIAGNOSTIC_IA_PAYMENT.currency,
        status: 'payment_pending',
        sales_context: body.sales_context,
        cgv_document_version_id: legalDocument.id,
        cgv_acceptance_statement_version_id: acceptanceStatement.id,
        source: DIAGNOSTIC_IA_PAYMENT.source,
      };
      const created = await supabaseAdmin
        .from('diagnostic_ia_orders')
        .insert(insertPayload)
        .select('id, status, sales_context, cgv_document_version_id, cgv_acceptance_statement_version_id, stripe_checkout_session_id')
        .single<DiagnosticOrder>();

      if (created.error?.code === '23505') {
        const concurrent = await supabaseAdmin
          .from('diagnostic_ia_orders')
          .select('id, status, sales_context, cgv_document_version_id, cgv_acceptance_statement_version_id, stripe_checkout_session_id')
          .eq('user_id', user.id)
          .eq('status', 'payment_pending')
          .single<DiagnosticOrder>();
        if (concurrent.error) throw concurrent.error;
        order = concurrent.data;
      } else if (created.error) {
        throw created.error;
      } else {
        order = created.data;
      }
    }

    if (!order) throw new Error('La commande Diagnostic IA n’a pas pu être créée.');
    if (
      order.sales_context !== body.sales_context
      || order.cgv_document_version_id !== legalDocument.id
      || order.cgv_acceptance_statement_version_id !== acceptanceStatement.id
    ) {
      return jsonResponse({ error: 'Une commande en attente existe déjà avec un autre contexte contractuel.' }, 409);
    }

    const { error: consentEvidenceError } = await supabaseAdmin
      .from('diagnostic_ia_consents')
      .insert({
        order_id: order.id,
        user_id: user.id,
        consent_type: 'cgv_acceptance',
        legal_document_version_id: acceptanceStatement.id,
        granted: true,
        source: 'web_checkout',
      });
    if (consentEvidenceError && consentEvidenceError.code !== '23505') throw consentEvidenceError;

    const metadata = {
      purchase_type: DIAGNOSTIC_IA_PAYMENT.purchaseType,
      diagnostic_order_id: order.id,
      user_id: user.id,
      price_id: priceId,
    };
    const siteUrl = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email,
      customer_creation: 'always',
      allow_promotion_codes: false,
      automatic_tax: { enabled: false },
      invoice_creation: { enabled: true },
      locale: 'fr',
      metadata,
      payment_intent_data: { metadata },
      success_url: `${siteUrl}/diagnostic-ia/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/diagnostic-ia#reserver`,
    }, {
      idempotencyKey: `diagnostic-ia-checkout-${order.id}`,
    });

    if (!session.url) throw new Error('Stripe n’a pas retourné d’URL de paiement.');

    const { error: orderUpdateError } = await supabaseAdmin
      .from('diagnostic_ia_orders')
      .update({
        stripe_checkout_session_id: session.id,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
      })
      .eq('id', order.id)
      .eq('status', 'payment_pending');
    if (orderUpdateError) throw orderUpdateError;

    return jsonResponse({ url: session.url, orderId: order.id });
  } catch (error) {
    console.error('Création du Checkout Diagnostic IA impossible :', error instanceof Error ? error.name : 'Erreur inconnue');
    return jsonResponse({ error: 'Le paiement est temporairement indisponible. Aucun débit n’a été effectué par cette tentative.' }, 500);
  }
});
