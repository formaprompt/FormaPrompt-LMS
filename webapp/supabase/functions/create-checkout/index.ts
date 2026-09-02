import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  CONSENT_TYPES,
  getCommercialRoute,
  getConsentDocumentVersion,
  getPurchaseConfig,
  getRequiredConsentTypes,
  validateCommercialCheckoutRequest,
} from '../_shared/purchaseConfig.js';
import {
  COURSE_PROMOTION,
  buildCourseStripeLineItem,
  coursePromotionCheckoutExpiresAt,
  hasCoursePromotionInput,
  isAmbiguousCourseStripeCreationError,
  normalizeCheckoutRequestId,
  normalizeCoursePromotionCode,
} from '../_shared/coursePromotion.js';

const CONSENT_DOCUMENT_TYPES = Object.freeze({
  [CONSENT_TYPES.EARLY_SERVICE_START]: 'early_service_start_statement',
  [CONSENT_TYPES.DIGITAL_CONTENT_START]: 'digital_content_start_statement',
  [CONSENT_TYPES.DIGITAL_CONTENT_WITHDRAWAL_ACKNOWLEDGEMENT]: 'digital_content_withdrawal_acknowledgement',
});
type ConsentType =
  | 'cgv_acceptance'
  | 'early_service_start'
  | 'digital_content_start'
  | 'digital_content_withdrawal_acknowledgement';

type CommercialRoute = {
  salesContext: string;
  offerClassification: string;
  accessActivationPolicy: string;
  cgvDocumentType: string;
  cgvVersion: string;
  requiredConsentTypes: ConsentType[];
};

type RequiredDocumentPair = {
  consentType: ConsentType;
  documentType: string;
  version: string;
};

type LegalDocument = { id: string; document_type: string; version: string };

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

  let promotionCleanup: {
    admin: ReturnType<typeof createClient>;
    checkoutIntentId: string;
    userId: string;
    redemptionId: string | null;
  } | null = null;
  let stripeSessionCreated = false;

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
    const checkoutRequestId = normalizeCheckoutRequestId(body.checkout_request_id);
    if (!checkoutRequestId) {
      return jsonResponse({ error: 'Référence de tentative de paiement invalide.' }, 400);
    }
    const hasPromotionCode = hasCoursePromotionInput(body.promo_code);
    const requestedPromotionCode = normalizeCoursePromotionCode(body.promo_code);
    if (hasPromotionCode && !requestedPromotionCode) {
      return jsonResponse({ error: COURSE_PROMOTION.genericInvalidMessage }, 400);
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

    const checkoutContext = body.checkout_context;
    const commercialRoute = getCommercialRoute(purchase, checkoutContext) as CommercialRoute | null;
    const commercialValidationError = validateCommercialCheckoutRequest(
      purchase,
      checkoutContext,
      body.consents,
    );
    if (commercialValidationError) {
      return jsonResponse({ error: commercialValidationError }, 400);
    }
    if (!commercialRoute) {
      return jsonResponse({ error: 'Le contexte commercial est absent ou invalide.' }, 400);
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
    const catalogProductId = typeof price.product === 'string' ? price.product : price.product?.id;
    if (typeof catalogProductId !== 'string' || !catalogProductId.startsWith('prod_')) {
      throw new Error('Le produit Stripe de la formation est invalide.');
    }

    const requiredConsentTypes = getRequiredConsentTypes(commercialRoute) as ConsentType[];
    const requiredDocumentPairs: RequiredDocumentPair[] = requiredConsentTypes.map((consentType: ConsentType) => ({
      consentType,
      documentType: consentType === CONSENT_TYPES.CGV_ACCEPTANCE
        ? commercialRoute.cgvDocumentType
        : CONSENT_DOCUMENT_TYPES[consentType as keyof typeof CONSENT_DOCUMENT_TYPES],
      version: getConsentDocumentVersion(purchase, commercialRoute, consentType),
    }));
    const { data: legalDocuments, error: legalDocumentsError } = await supabaseAdmin
      .from('legal_document_versions')
      .select('id, document_type, version')
      .eq('status', 'published')
      .in('document_type', requiredDocumentPairs.map(({ documentType }: RequiredDocumentPair) => documentType));
    if (legalDocumentsError) throw legalDocumentsError;

    const consentDocuments = requiredDocumentPairs.map((required: RequiredDocumentPair) => ({
      ...required,
      document: (legalDocuments as LegalDocument[] | null)?.find((document: LegalDocument) => (
        document.document_type === required.documentType && document.version === required.version
      )),
    }));
    if (consentDocuments.some(({ document }: { document?: LegalDocument }) => !document)) {
      return jsonResponse({ error: 'Une version juridique applicable est introuvable ou non publiée.' }, 409);
    }

    const cgvDocument = consentDocuments.find(({ consentType }: RequiredDocumentPair) => (
      consentType === CONSENT_TYPES.CGV_ACCEPTANCE
    ))!.document!;
    const { data: checkoutIntent, error: checkoutIntentError } = await supabaseAdmin
      .rpc('prepare_course_checkout_intent', {
        p_checkout_request_id: checkoutRequestId,
        p_user_id: user.id,
        p_course_id: purchase.courseId,
        p_offer_classification: commercialRoute.offerClassification,
        p_sales_context: commercialRoute.salesContext,
        p_access_start_choice: checkoutContext.access_start_choice,
        p_access_activation_policy: commercialRoute.accessActivationPolicy,
        p_beneficiary_email: checkoutContext.beneficiary_email,
        p_buyer_organization_name: checkoutContext.buyer_organization_name,
        p_cgv_document_version_id: cgvDocument.id,
        p_consent_documents: consentDocuments.map(({ consentType, document }) => ({
          consent_type: consentType,
          legal_document_version_id: document!.id,
        })),
        p_catalog_price_id: priceId,
        p_stripe_product_id: catalogProductId,
      })
      .single();
    if (checkoutIntentError) throw checkoutIntentError;

    if (checkoutIntent.stripe_checkout_session_id) {
      if ((checkoutIntent.normalized_code || null) !== requestedPromotionCode) {
        return jsonResponse({
          error: 'Une tentative de paiement existe déjà avec une autre configuration tarifaire.',
        }, 409);
      }
      const existingSession = await stripe.checkout.sessions.retrieve(checkoutIntent.stripe_checkout_session_id);
      if (existingSession.status === 'open' && existingSession.url) {
        return jsonResponse({
          url: existingSession.url,
          reused: true,
          catalog_amount_cents: checkoutIntent.original_amount_cents,
          discount_amount_cents: checkoutIntent.discount_amount_cents,
          final_amount_cents: checkoutIntent.final_amount_cents,
        });
      }
      if (existingSession.status === 'complete') {
        return jsonResponse({ confirmationPending: true, checkoutIntentId: checkoutIntent.id });
      }
      if (checkoutIntent.promo_redemption_id) {
        const { error: releaseError } = await supabaseAdmin.rpc('release_promo_redemption_for_checkout', {
          p_redemption_id: checkoutIntent.promo_redemption_id,
          p_order_context_type: COURSE_PROMOTION.orderContextType,
          p_order_context_id: checkoutIntent.id,
        });
        if (releaseError) throw releaseError;
      }
      const { error: expireError } = await supabaseAdmin
        .from('commercial_checkout_intents')
        .update({ status: 'expired', failure_code: 'stripe_checkout_expired', updated_at: new Date().toISOString() })
        .eq('id', checkoutIntent.id)
        .eq('status', 'stripe_session_created');
      if (expireError) throw expireError;
      return jsonResponse({
        error: 'Cette tentative de paiement a expiré. Vous pouvez en démarrer une nouvelle.',
        checkout_context_reset: true,
      }, 409);
    }

    const { data: checkoutConfiguration, error: configurationError } = await supabaseAdmin
      .rpc('prepare_course_promotion_checkout', {
        p_checkout_intent_id: checkoutIntent.id,
        p_user_id: user.id,
        p_email: user.email,
        p_course_id: purchase.courseId,
        p_original_amount_cents: purchase.amountTotal,
        p_promo_code: requestedPromotionCode,
      })
      .single();
    if (configurationError?.code === 'P0001') {
      await supabaseAdmin.rpc('reset_course_promotion_checkout', {
        p_checkout_intent_id: checkoutIntent.id,
        p_user_id: user.id,
      });
      return jsonResponse({
        promotion_invalid: true,
        message: COURSE_PROMOTION.genericInvalidMessage,
      });
    }
    if (configurationError) throw configurationError;
    if (!checkoutConfiguration) throw new Error('Configuration du checkout formation absente.');
    if ((checkoutConfiguration.normalized_code || null) !== requestedPromotionCode) {
      return jsonResponse({
        error: 'Une tentative de paiement existe déjà avec une autre configuration tarifaire.',
      }, 409);
    }

    promotionCleanup = {
      admin: supabaseAdmin,
      checkoutIntentId: checkoutIntent.id,
      userId: user.id,
      redemptionId: checkoutConfiguration.promo_redemption_id || null,
    };

    const siteUrl = getSiteUrl();
    const metadata = {
      checkout_intent_id: checkoutIntent.id,
      user_id: user.id,
      course_id: purchase.courseId,
      price_id: priceId,
      stripe_product_id: catalogProductId,
      expected_amount_cents: String(checkoutConfiguration.final_amount_cents),
      sales_context: commercialRoute.salesContext,
      access_activation_policy: commercialRoute.accessActivationPolicy,
      payment_type: 'course',
      ...(checkoutConfiguration.promo_redemption_id
        ? { promo_redemption_id: checkoutConfiguration.promo_redemption_id }
        : {}),
    };
    const lineItem = buildCourseStripeLineItem({
      purchase,
      catalogPriceId: priceId,
      catalogProductId,
      finalAmountCents: checkoutConfiguration.final_amount_cents,
      promotionApplied: Boolean(checkoutConfiguration.promo_redemption_id),
    });
    const stripeExpiresAt = coursePromotionCheckoutExpiresAt({
      promotionApplied: Boolean(checkoutConfiguration.promo_redemption_id),
      reservationExpiresAt: checkoutConfiguration.reservation_expires_at,
    });
    const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [lineItem],
        client_reference_id: user.id,
        customer_email: user.email,
        customer_creation: 'always',
        phone_number_collection: { enabled: true },
        allow_promotion_codes: false,
        automatic_tax: { enabled: false },
        invoice_creation: { enabled: true },
        locale: 'fr',
        metadata,
        payment_intent_data: { metadata },
        success_url: `${siteUrl}/paiement-reussi?course=${encodeURIComponent(purchase.courseId)}&activation=${encodeURIComponent(commercialRoute.accessActivationPolicy)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}${purchase.landingPath}`,
        ...(stripeExpiresAt ? { expires_at: stripeExpiresAt } : {}),
      }, {
        idempotencyKey: `course-checkout-${checkoutIntent.id}`,
      });
    stripeSessionCreated = true;

    if (!session.url) throw new Error('Stripe n’a pas retourné d’URL Checkout.');
    const { error: intentUpdateError } = await supabaseAdmin
      .from('commercial_checkout_intents')
      .update({
        status: 'stripe_session_created',
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkoutIntent.id)
      .eq('status', 'created');
    if (intentUpdateError) throw intentUpdateError;

    return jsonResponse({
      url: session.url,
      catalog_amount_cents: checkoutConfiguration.original_amount_cents,
      discount_amount_cents: checkoutConfiguration.discount_amount_cents,
      final_amount_cents: checkoutConfiguration.final_amount_cents,
    });
  } catch (error) {
    const ambiguous = isAmbiguousCourseStripeCreationError(error);
    if (promotionCleanup && !stripeSessionCreated && !ambiguous) {
      const { error: cleanupError } = await promotionCleanup.admin.rpc('reset_course_promotion_checkout', {
        p_checkout_intent_id: promotionCleanup.checkoutIntentId,
        p_user_id: promotionCleanup.userId,
      });
      if (cleanupError) {
        console.warn('course_promotion_cleanup_failed', {
          checkout_intent_id: promotionCleanup.checkoutIntentId,
          redemption_id: promotionCleanup.redemptionId,
          error_code: cleanupError.code || null,
        });
      }
    }
    console.error('create-checkout:', {
      checkout_intent_id: promotionCleanup?.checkoutIntentId || null,
      redemption_id: promotionCleanup?.redemptionId || null,
      error_type: error instanceof Error ? error.name : 'Erreur inconnue',
    });
    return jsonResponse({
      error: 'Impossible de préparer le paiement pour le moment.',
      retry_same_context: ambiguous,
      checkout_context_reset: Boolean(promotionCleanup && !stripeSessionCreated && !ambiguous),
    }, 500);
  }
});
