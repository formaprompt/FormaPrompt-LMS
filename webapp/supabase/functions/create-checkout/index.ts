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
      .from('commercial_checkout_intents')
      .insert({
        user_id: user.id,
        course_id: purchase.courseId,
        offer_classification: commercialRoute.offerClassification,
        sales_context: commercialRoute.salesContext,
        access_start_choice: checkoutContext.access_start_choice,
        access_activation_policy: commercialRoute.accessActivationPolicy,
        beneficiary_email: checkoutContext.beneficiary_email,
        buyer_organization_name: checkoutContext.buyer_organization_name,
        cgv_document_version_id: cgvDocument.id,
      })
      .select('id')
      .single();
    if (checkoutIntentError) throw checkoutIntentError;

    const { error: consentInsertError } = await supabaseAdmin
      .from('commercial_consents')
      .insert(consentDocuments.map(({ consentType, document }) => ({
        checkout_intent_id: checkoutIntent.id,
        user_id: user.id,
        course_id: purchase.courseId,
        consent_type: consentType,
        granted: true,
        legal_document_version_id: document!.id,
        source: 'web_checkout',
      })));
    if (consentInsertError) throw consentInsertError;

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
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: user.id,
        customer_email: user.email,
        customer_creation: 'always',
        phone_number_collection: { enabled: true },
        allow_promotion_codes: false,
        automatic_tax: { enabled: false },
        invoice_creation: { enabled: true },
        locale: 'fr',
        metadata: {
          checkout_intent_id: checkoutIntent.id,
          user_id: user.id,
          course_id: purchase.courseId,
          price_id: priceId,
          sales_context: commercialRoute.salesContext,
          access_activation_policy: commercialRoute.accessActivationPolicy,
        },
        payment_intent_data: {
          metadata: {
            checkout_intent_id: checkoutIntent.id,
            user_id: user.id,
            course_id: purchase.courseId,
            sales_context: commercialRoute.salesContext,
          },
        },
        success_url: `${siteUrl}/paiement-reussi?course=${encodeURIComponent(purchase.courseId)}&activation=${encodeURIComponent(commercialRoute.accessActivationPolicy)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}${purchase.landingPath}`,
      });
    } catch (stripeError) {
      await supabaseAdmin
        .from('commercial_checkout_intents')
        .update({ status: 'failed', failure_code: 'stripe_session_creation_failed', updated_at: new Date().toISOString() })
        .eq('id', checkoutIntent.id)
        .eq('status', 'created');
      throw stripeError;
    }

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

    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error('create-checkout:', error);
    return jsonResponse({ error: 'Impossible de préparer le paiement pour le moment.' }, 500);
  }
});
