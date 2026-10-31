import { IAG_ELEARNING_COURSE_ID, resolveIagIntentPurchase, validateIagStripeCatalog } from '../_shared/iagOffer.js';
import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  BUREAUTIQUE_PURCHASES,
  CREATIVITY_PURCHASES,
  CONSENT_TYPES,
  getCommercialRoute,
  getCourseCheckoutAccessDecision,
  getConsentDocumentVersion,
  getPurchaseConfig,
  getRequiredConsentTypes,
  validateCommercialCheckoutRequest,
  validateCreativityStripeCatalog,
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

function iagPending(checkoutIntentId: string) {
  return jsonResponse({ confirmationPending: true, pending: true,
    reconciliation_required: true, checkoutIntentId, checkout_context_reset: false,
    retry_same_context: false,
  }, 202);
}

async function safelyResetIagCheckout(context: { admin: ReturnType<typeof createClient>; intentId: string; userId: string }) {
  try {
    const { data, error } = await context.admin.rpc('reset_iag_course_promotion_checkout', {
      p_checkout_intent_id: context.intentId, p_user_id: context.userId,
    });
    return !error && data === true;
  } catch { return false; }
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
  let iagCheckout: { admin: ReturnType<typeof createClient>; intentId: string; userId: string } | null = null;
  let iagClaimId: string | null = null;

  try {
    const stripeSecretKey = requiredEnv('STRIPE_SECRET_KEY');
    const stripeMode = getStripeMode(stripeSecretKey);

    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return jsonResponse({ error: 'Connexion requise avant le paiement.' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    let purchase = getPurchaseConfig(body.course_id, new Date());
    if (!purchase || !purchase.checkoutEnabled) {
      return jsonResponse({ error: purchase?.checkoutUnavailableMessage || 'Formation non disponible au paiement.', checkout_unavailable: Boolean(purchase) }, 400);
    }
    const checkoutRequestId = normalizeCheckoutRequestId(body.checkout_request_id);
    if (!checkoutRequestId) {
      return jsonResponse({ error: 'Référence de tentative de paiement invalide.' }, 400);
    }
    const hasPromotionCode = hasCoursePromotionInput(body.promo_code);
    const requestedPromotionCode = normalizeCoursePromotionCode(body.promo_code);
    if (purchase.promotionEnabled === false && hasPromotionCode) {
      return jsonResponse({ error: 'Cette formation est à prix fixe, sans code promotionnel.' }, 400);
    }
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
      .select('id, status, expires_at')
      .eq('user_id', user.id)
      .eq('course_id', purchase.courseId)
      .maybeSingle();

    if (accessError) throw accessError;
    const accessDecision = getCourseCheckoutAccessDecision(existingAccess);
    if (accessDecision === 'already_purchased') {
      return jsonResponse({ alreadyPurchased: true });
    }
    if (purchase.courseId === IAG_ELEARNING_COURSE_ID && accessDecision === 'lifecycle_review') {
      return jsonResponse({ error: 'Un droit existe déjà. Une décision administrative explicite est nécessaire.' }, 409);
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

    if (purchase.courseId === IAG_ELEARNING_COURSE_ID) {
      // Même intention que la RPC existante : conserver une session déjà figée.
      const { data: savedIntent, error: savedIntentError } = await supabaseAdmin
        .from('commercial_checkout_intents')
        .select('course_id, original_amount_cents, catalog_price_id, checkout_configuration_locked_at')
        .eq('user_id', user.id).eq('course_id', purchase.courseId)
        .not('checkout_request_id', 'is', null).in('status', ['created', 'stripe_session_created'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (savedIntentError) throw savedIntentError;
      if (savedIntent?.checkout_configuration_locked_at) {
        purchase = resolveIagIntentPurchase(purchase, savedIntent, (name: string) => Deno.env.get(name));
      }
    }
    const priceId = Deno.env.get(purchase.priceEnvName)?.trim();
    if (!priceId) {
      return jsonResponse({ error: 'Le paiement de cette offre n’est pas encore ouvert. Aucun montant n’a été débité.', checkout_unavailable: true }, 503);
    }
    if (purchase.courseId === IAG_ELEARNING_COURSE_ID
      && (!Deno.env.get('STRIPE_IAG_ELEARNING_INTRO_PRICE_ID')?.trim()
        || !Deno.env.get('STRIPE_IAG_ELEARNING_STANDARD_PRICE_ID')?.trim())) {
      return jsonResponse({ error: 'Le catalogue tarifaire IAG est incomplet. Aucun montant n’a été débité.', checkout_unavailable: true }, 503);
    }
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
    const bureautiqueOffer = Object.hasOwn(BUREAUTIQUE_PURCHASES, purchase.courseId)
      ? BUREAUTIQUE_PURCHASES[purchase.courseId]
      : null;
    if (purchase.courseId === IAG_ELEARNING_COURSE_ID) {
      const product = await stripe.products.retrieve(catalogProductId);
      const catalogError = validateIagStripeCatalog(purchase, price, product, stripeMode === 'live');
      if (catalogError) throw new Error(catalogError);
    }
    const creativityOffer = CREATIVITY_PURCHASES[purchase.courseId];
    if (creativityOffer) {
      const product = await stripe.products.retrieve(catalogProductId);
      const catalogError = validateCreativityStripeCatalog(purchase, price, product, stripeMode === 'live');
      if (catalogError) throw new Error(catalogError);
    }
    if (bureautiqueOffer) {
      const product = await stripe.products.retrieve(catalogProductId);
      if ('deleted' in product && product.deleted) throw new Error('Le produit Stripe bureautique a été supprimé.');
      if (price.metadata?.course_id !== purchase.courseId || price.metadata?.modality !== bureautiqueOffer.modality
        || !product.active || product.livemode !== (stripeMode === 'live')
        || product.metadata?.pedagogical_level !== bureautiqueOffer.pedagogicalLevel
        || product.metadata?.duration_hours !== String(bureautiqueOffer.durationHours)) {
        throw new Error('Le produit ou la modalité du tarif Stripe bureautique ne correspond pas à l’offre choisie.');
      }
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
    const preparationRpc = purchase.courseId === IAG_ELEARNING_COURSE_ID
      ? 'prepare_iag_course_checkout_intent'
      : 'prepare_course_checkout_intent';
    const { data: checkoutIntent, error: checkoutIntentError } = await supabaseAdmin
      .rpc(preparationRpc, {
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
        ...(purchase.courseId === IAG_ELEARNING_COURSE_ID ? {
          p_intro_price_id: requiredEnv('STRIPE_IAG_ELEARNING_INTRO_PRICE_ID'),
          p_standard_price_id: requiredEnv('STRIPE_IAG_ELEARNING_STANDARD_PRICE_ID'),
        } : {}),
      })
      .single();
    // Un worker concurrent peut avoir verrouillé 79 après notre lecture à 99.
    // Ne jamais nettoyer ce snapshot : la reprise relira le prix autoritaire.
    if (purchase.courseId === IAG_ELEARNING_COURSE_ID && checkoutIntentError?.code === '23505') {
      return jsonResponse({
        error: 'La configuration de cette tentative a changé. Relancez le paiement pour la relire.',
        retry_same_context: true,
        checkout_context_reset: false,
      }, 409);
    }
    if (checkoutIntentError) throw checkoutIntentError;

    if (purchase.courseId === IAG_ELEARNING_COURSE_ID) {
      iagCheckout = { admin: supabaseAdmin, intentId: checkoutIntent.id, userId: user.id };
      // Le code est figé même sans identifiant de session enregistré.
      if (checkoutIntent.checkout_configuration_locked_at
        && (checkoutIntent.normalized_code || null) !== requestedPromotionCode) {
        return jsonResponse({ error: 'Cette tentative conserve son code promotionnel et son tarif. Sa configuration ne peut pas être remplacée.', checkout_context_reset: false }, 409);
      }
    }

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
      // Aucun statut inconnu n'est assimilé à une expiration. Même une session
      // expirée connue reste à réconcilier ici ; aucun release/expiry IAG.
      if (purchase.courseId === IAG_ELEARNING_COURSE_ID) return iagPending(checkoutIntent.id);
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
      .rpc(purchase.courseId === IAG_ELEARNING_COURSE_ID
        ? 'prepare_iag_course_promotion_checkout' : 'prepare_course_promotion_checkout', {
        p_checkout_intent_id: checkoutIntent.id,
        p_user_id: user.id,
        p_email: user.email,
        p_course_id: purchase.courseId,
        p_original_amount_cents: purchase.amountTotal,
        p_promo_code: requestedPromotionCode,
      })
      .single();
    if (configurationError?.code === 'P0001') {
      if (purchase.courseId === IAG_ELEARNING_COURSE_ID) {
        if (!await safelyResetIagCheckout({ admin: supabaseAdmin, intentId: checkoutIntent.id, userId: user.id })) return iagPending(checkoutIntent.id);
        return jsonResponse({ promotion_invalid: true, message: COURSE_PROMOTION.genericInvalidMessage });
      }
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

    if (purchase.courseId === IAG_ELEARNING_COURSE_ID) {
      const { data: claim, error: claimError } = await supabaseAdmin.rpc('claim_iag_stripe_attempt', {
        p_checkout_intent_id: checkoutIntent.id, p_user_id: user.id,
      }).single();
      if (claimError || !claim?.claimed || !claim.claim_id) return iagPending(checkoutIntent.id);
      iagClaimId = claim.claim_id;
    }
    promotionCleanup = purchase.courseId === IAG_ELEARNING_COURSE_ID ? null : {
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
      ...(creativityOffer ? { modality: creativityOffer.modality, duration_hours: '14', delivery_kind: 'instructor_led_service' } : {}),
      ...(bureautiqueOffer ? {
        pedagogical_level: bureautiqueOffer.pedagogicalLevel,
        modality: bureautiqueOffer.modality,
      } : {}),
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
        ...(!creativityOffer ? { payment_method_types: ['card'] } : {}),
        line_items: [lineItem],
        client_reference_id: user.id,
        customer_email: user.email,
        customer_creation: 'always',
        ...(!creativityOffer ? { phone_number_collection: { enabled: true } } : {}),
        allow_promotion_codes: false,
        automatic_tax: { enabled: false },
        invoice_creation: {
          enabled: true,
          ...(bureautiqueOffer ? { invoice_data: {
            description: `${bureautiqueOffer.label} — ${bureautiqueOffer.durationHours} heures`,
            custom_fields: [{ name: 'Modalité', value: bureautiqueOffer.modalityLabel }],
            metadata: {
              course_id: bureautiqueOffer.courseId,
              pedagogical_level: bureautiqueOffer.pedagogicalLevel,
              modality: bureautiqueOffer.modality,
            },
          } } : {}),
        },
        ...(bureautiqueOffer ? { custom_text: { submit: {
          message: `${bureautiqueOffer.label} — ${bureautiqueOffer.durationHours} heures.`,
        } } } : {}),
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
    if (purchase.courseId === IAG_ELEARNING_COURSE_ID) {
      const { data: recorded, error: recordError } = await supabaseAdmin.rpc('record_iag_stripe_session', {
        p_checkout_intent_id: checkoutIntent.id, p_user_id: user.id,
        p_claim_id: iagClaimId, p_session_id: session.id,
      });
      if (recordError || !recorded) return iagPending(checkoutIntent.id);
      return jsonResponse({ url: session.url,
        catalog_amount_cents: checkoutConfiguration.original_amount_cents,
        discount_amount_cents: checkoutConfiguration.discount_amount_cents,
        final_amount_cents: checkoutConfiguration.final_amount_cents,
      });
    }
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
    if (iagCheckout) {
      // Une erreur Stripe quelconque après claim ne prouve jamais l'absence de session.
      if (iagClaimId || stripeSessionCreated) return iagPending(iagCheckout.intentId);
      if (!await safelyResetIagCheckout(iagCheckout)) return iagPending(iagCheckout.intentId);
      return jsonResponse({ error: 'Préparation IAG interrompue avant toute tentative Stripe.', checkout_context_reset: true }, 500);
    }
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
