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
import {
  DIAGNOSTIC_PROMOTION,
  buildDiagnosticStripeLineItem,
  diagnosticPromotionCheckoutExpiresAt,
  hasDiagnosticPromotionInput,
  isAmbiguousStripeCreationError,
  normalizeDiagnosticPromotionCode,
} from '../_shared/diagnosticPromotion.js';
import { buildDiagnosticPromoEvidence, DIAGNOSTIC_PROMO_ACCEPTANCE_VERSION } from '../_shared/diagnosticContractEvidence.js';

type DiagnosticOrder = {
  id: string;
  status: string;
  sales_context: string;
  cgv_document_version_id: string;
  cgv_acceptance_statement_version_id: string;
  stripe_checkout_session_id: string | null;
  promo_redemption_id: string | null;
  original_amount_cents: number;
  discount_amount_cents: number;
  final_amount_cents: number;
  checkout_configuration_locked_at: string | null;
};

const ORDER_SELECT = 'id, status, sales_context, cgv_document_version_id, cgv_acceptance_statement_version_id, stripe_checkout_session_id, promo_redemption_id, original_amount_cents, discount_amount_cents, final_amount_cents, checkout_configuration_locked_at';

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

  let promotionCleanup: {
    admin: ReturnType<typeof createClient>;
    orderId: string;
    userId: string;
    redemptionId: string | null;
    mayReset: boolean;
  } | null = null;
  let stripeSessionCreated = false;

  try {
    const stripeSecretKey = requiredEnv('STRIPE_SECRET_KEY');
    const stripeMode = getDiagnosticStripeMode(stripeSecretKey);

    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connexion requise avant le paiement.' }, 401);

    const body = await request.json().catch(() => ({}));
    const checkoutValidationError = validateDiagnosticCheckoutRequest(body);
    if (checkoutValidationError) return jsonResponse({ error: checkoutValidationError }, 400);
    const hasPromotionCode = hasDiagnosticPromotionInput(body?.promo_code);
    const requestedPromotionCode = normalizeDiagnosticPromotionCode(body?.promo_code);
    if (hasPromotionCode && !requestedPromotionCode) {
      return jsonResponse({ error: DIAGNOSTIC_PROMOTION.genericInvalidMessage }, 400);
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

    const priceId = requiredEnv(DIAGNOSTIC_IA_PAYMENT.priceEnvName);
    const stripe = new Stripe(stripeSecretKey);
    const price = await stripe.prices.retrieve(priceId);
    const priceValidationError = validateDiagnosticStripePrice(price, stripeMode);
    if (priceValidationError) throw new Error(priceValidationError);
    const catalogProductId = typeof price.product === 'string' ? price.product : price.product?.id;

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
      .eq('document_type', hasPromotionCode ? 'diagnostic_promo_cgv_acceptance_statement' : DIAGNOSTIC_LEGAL_STATEMENTS.cgvAcceptance.documentType)
      .eq('version', hasPromotionCode ? DIAGNOSTIC_PROMO_ACCEPTANCE_VERSION : DIAGNOSTIC_LEGAL_STATEMENTS.cgvAcceptance.version)
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
      .select(ORDER_SELECT)
      .eq('user_id', user.id)
      .eq('status', 'payment_pending')
      .maybeSingle<DiagnosticOrder>();
    if (pendingOrderError) throw pendingOrderError;

    if (order?.stripe_checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
      if (existingSession.status === 'open' && existingSession.url) {
        let frozenCode = null;
        if (order.promo_redemption_id) {
          const { data: redemption, error: redemptionError } = await supabaseAdmin
            .from('promo_redemptions')
            .select('promo_codes!inner(code)')
            .eq('id', order.promo_redemption_id)
            .single();
          if (redemptionError) throw redemptionError;
          frozenCode = redemption?.promo_codes?.code;
        }
        if (frozenCode !== requestedPromotionCode) {
          return jsonResponse({ error: DIAGNOSTIC_PROMOTION.genericInvalidMessage }, 400);
        }
        return jsonResponse({
          url: existingSession.url,
          orderId: order.id,
          reused: true,
          catalog_amount_cents: order.original_amount_cents,
          discount_amount_cents: order.discount_amount_cents,
          final_amount_cents: order.final_amount_cents,
        });
      }
      if (existingSession.status === 'complete') {
        return jsonResponse({ confirmationPending: true, orderId: order.id });
      }
      if (order.promo_redemption_id) {
        const { error: releaseError } = await supabaseAdmin.rpc('release_promo_redemption_for_checkout', {
          p_redemption_id: order.promo_redemption_id,
          p_order_context_type: DIAGNOSTIC_PROMOTION.orderContextType,
          p_order_context_id: order.id,
        });
        if (releaseError) throw releaseError;
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
        .select(ORDER_SELECT)
        .single<DiagnosticOrder>();

      if (created.error?.code === '23505') {
        const concurrent = await supabaseAdmin
          .from('diagnostic_ia_orders')
          .select(ORDER_SELECT)
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

    // Le parcours sans promotion garde sa preuve historique. La preuve remisee
    // n'est inseree qu'apres reservation et comparaison avec le texte accepte.
    if (!hasPromotionCode) {
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
    }

    const metadata = {
      purchase_type: DIAGNOSTIC_IA_PAYMENT.purchaseType,
      diagnostic_order_id: order.id,
      user_id: user.id,
      price_id: priceId,
    };
    const { data: checkoutConfiguration, error: configurationError } = await supabaseAdmin
      .rpc('prepare_diagnostic_promotion_checkout', {
        p_order_id: order.id,
        p_user_id: user.id,
        p_email: user.email,
        p_promo_code: requestedPromotionCode,
      })
      .single();
    if (configurationError?.code === 'P0001') {
      // La transaction refusee est annulee, sans liberer un retry concurrent valide.
      return jsonResponse({ error: DIAGNOSTIC_PROMOTION.genericInvalidMessage }, 400);
    }
    if (configurationError) throw configurationError;
    if (!checkoutConfiguration) throw new Error('Configuration du checkout Diagnostic IA absente.');

    const configuredPromotionCode = checkoutConfiguration.normalized_code || null;
    if (configuredPromotionCode !== requestedPromotionCode) {
      return jsonResponse({ error: DIAGNOSTIC_PROMOTION.genericInvalidMessage }, 400);
    }

    promotionCleanup = {
      admin: supabaseAdmin,
      orderId: order.id,
      userId: user.id,
      redemptionId: checkoutConfiguration.promo_redemption_id || null,
      mayReset: !order.checkout_configuration_locked_at,
    };
    if (checkoutConfiguration.promo_redemption_id) {
      Object.assign(metadata, { promo_redemption_id: checkoutConfiguration.promo_redemption_id });
      const evidence = buildDiagnosticPromoEvidence(checkoutConfiguration);
      if (body.promo_acceptance_version !== evidence.version || body.promo_acceptance_text !== evidence.text) {
        return jsonResponse({ error: 'Le montant a changé. Vérifiez le code et acceptez de nouveau le montant de votre commande.' }, 409);
      }
      const { error: consentError } = await supabaseAdmin.from('diagnostic_ia_consents').insert({
        order_id: order.id, user_id: user.id, consent_type: 'cgv_acceptance',
        legal_document_version_id: acceptanceStatement.id, granted: true, source: 'web_checkout',
      });
      if (consentError && consentError.code !== '23505') throw consentError;
    }

    const lineItem = buildDiagnosticStripeLineItem({
      catalogPriceId: priceId,
      catalogProductId,
      finalAmountCents: checkoutConfiguration.final_amount_cents,
      promotionApplied: Boolean(checkoutConfiguration.promo_redemption_id),
    });
    const stripeExpiresAt = diagnosticPromotionCheckoutExpiresAt({
      promotionApplied: Boolean(checkoutConfiguration.promo_redemption_id),
      reservationExpiresAt: checkoutConfiguration.reservation_expires_at,
      retry: Boolean(order.checkout_configuration_locked_at),
    });
    const siteUrl = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [lineItem],
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
      ...(stripeExpiresAt ? { expires_at: stripeExpiresAt } : {}),
    }, {
      idempotencyKey: `diagnostic-ia-checkout-${order.id}`,
    });
    stripeSessionCreated = true;

    if (!session.url) throw new Error('Stripe n’a pas retourné d’URL de paiement.');

    const { data: updatedOrder, error: orderUpdateError } = await supabaseAdmin
      .from('diagnostic_ia_orders')
      .update({
        stripe_checkout_session_id: session.id,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
      })
      .eq('id', order.id)
      .eq('status', 'payment_pending')
      .select('id')
      .maybeSingle();
    if (orderUpdateError) throw orderUpdateError;
    if (!updatedOrder) throw new Error('La commande Diagnostic IA n’est plus disponible.');

    return jsonResponse({
      url: session.url,
      orderId: order.id,
      catalog_amount_cents: checkoutConfiguration.original_amount_cents,
      discount_amount_cents: checkoutConfiguration.discount_amount_cents,
      final_amount_cents: checkoutConfiguration.final_amount_cents,
    });
  } catch (error) {
    if (promotionCleanup?.mayReset && !stripeSessionCreated && !isAmbiguousStripeCreationError(error)) {
      const { error: cleanupError } = await promotionCleanup.admin.rpc('reset_diagnostic_promotion_checkout', {
        p_order_id: promotionCleanup.orderId,
        p_user_id: promotionCleanup.userId,
      });
      if (cleanupError) {
        console.warn('diagnostic_promotion_cleanup_failed', {
          order_id: promotionCleanup.orderId,
          redemption_id: promotionCleanup.redemptionId,
          error_code: cleanupError.code || null,
        });
      }
    }
    console.error('Création du Checkout Diagnostic IA impossible :', {
      order_id: promotionCleanup?.orderId || null,
      redemption_id: promotionCleanup?.redemptionId || null,
      error_type: error instanceof Error ? error.name : 'Erreur inconnue',
    });
    return jsonResponse({ error: 'Le paiement est temporairement indisponible. Aucun débit n’a été effectué par cette tentative.' }, 500);
  }
});
