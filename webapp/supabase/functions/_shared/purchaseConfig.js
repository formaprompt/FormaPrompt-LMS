export const OFFER_CLASSIFICATIONS = Object.freeze({
  B2C_STANDARD: 'B2C_STANDARD',
  B2C_INDIVIDUAL_TRAINING_CONTRACT: 'B2C_INDIVIDUAL_TRAINING_CONTRACT',
  B2B: 'B2B',
  OF_OPCO: 'OF_OPCO',
  MANUAL_LEGAL_REVIEW_REQUIRED: 'MANUAL_LEGAL_REVIEW_REQUIRED',
});

export const SALES_CONTEXTS = Object.freeze({
  PERSONAL: 'personal',
  PROFESSIONAL_SELF: 'professional_self',
  BENEFICIARY: 'beneficiary',
  OF_OPCO: 'of_opco',
});

export const ACCESS_START_CHOICES = Object.freeze({
  IMMEDIATE: 'immediate',
  DEFERRED: 'deferred',
});

export const ACCESS_ACTIVATION_POLICIES = Object.freeze({
  IMMEDIATE_AFTER_PAYMENT: 'immediate_after_payment',
  DEFERRED_AFTER_WITHDRAWAL_PERIOD: 'deferred_after_withdrawal_period',
  DEFERRED_BENEFICIARY_ASSIGNMENT: 'deferred_beneficiary_assignment',
  OF_OPCO_ADMINISTRATIVE: 'of_opco_administrative',
});

export const CONSENT_TYPES = Object.freeze({
  CGV_ACCEPTANCE: 'cgv_acceptance',
  EARLY_SERVICE_START: 'early_service_start',
  DIGITAL_CONTENT_START: 'digital_content_start',
  DIGITAL_CONTENT_WITHDRAWAL_ACKNOWLEDGEMENT: 'digital_content_withdrawal_acknowledgement',
});

const LEGAL_VERSIONS = Object.freeze({
  cgvB2c: 'CGV-B2C-2026-08-12',
  cgvB2b: 'CGV-B2B-2026-08-12',
  earlyService: 'EARLY-SERVICE-2026-08-12',
  digitalStart: 'DIGITAL-START-2026-08-12',
  digitalWithdrawalAcknowledgement: 'DIGITAL-ACK-2026-08-12',
});

const MIXED_DIRECT_PURCHASE = Object.freeze({
  checkoutEnabled: true,
  components: Object.freeze({ service: true, digitalContent: true }),
  availableStartChoices: Object.freeze([
    ACCESS_START_CHOICES.IMMEDIATE,
    ACCESS_START_CHOICES.DEFERRED,
  ]),
  legalVersions: LEGAL_VERSIONS,
  legalQualification: 'mixed_components_configurable',
  individualTrainingContractApplicability: 'case_by_case_legal_validation',
});

export const AI_ACT_PURCHASE = Object.freeze({
  courseId: 'formation-ia-act',
  amountTotal: 18_700,
  currency: 'eur',
  priceEnvName: 'STRIPE_AI_ACT_PRICE_ID',
  landingPath: '/formation-ia-act-conformite#inscription',
  label: 'formation AI Act',
  ...MIXED_DIRECT_PURCHASE,
});

export const PROMPT_LEVEL_ONE_PURCHASE = Object.freeze({
  courseId: 'formation-prompt-level-1',
  amountTotal: 34_300,
  currency: 'eur',
  priceEnvName: 'STRIPE_PROMPT_LEVEL1_PRICE_ID',
  landingPath: '/formation-prompt-engineering#inscription',
  label: 'formation Prompt Engineering – Niveau 1',
  ...MIXED_DIRECT_PURCHASE,
});

export const GENERATIVE_AI_PURCHASE = Object.freeze({
  courseId: 'formation-ia',
  amountTotal: 49_700,
  currency: 'eur',
  priceEnvName: 'STRIPE_GENERATIVE_AI_PRICE_ID',
  landingPath: '/formation-ia-generative#inscription',
  label: 'formation IA générative',
  ...MIXED_DIRECT_PURCHASE,
});

export const COURSE_PURCHASES = Object.freeze({
  [AI_ACT_PURCHASE.courseId]: AI_ACT_PURCHASE,
  [PROMPT_LEVEL_ONE_PURCHASE.courseId]: PROMPT_LEVEL_ONE_PURCHASE,
  [GENERATIVE_AI_PURCHASE.courseId]: GENERATIVE_AI_PURCHASE,
});

export function getPurchaseConfig(courseId) {
  return COURSE_PURCHASES[courseId] || null;
}

export function getCommercialRoute(purchase, checkoutContext) {
  if (!purchase || !checkoutContext || !Object.values(SALES_CONTEXTS).includes(checkoutContext.sales_context)) {
    return null;
  }

  if (checkoutContext.sales_context === SALES_CONTEXTS.OF_OPCO) {
    return {
      salesContext: SALES_CONTEXTS.OF_OPCO,
      directCheckoutEnabled: false,
      offerClassification: OFFER_CLASSIFICATIONS.OF_OPCO,
      accessActivationPolicy: ACCESS_ACTIVATION_POLICIES.OF_OPCO_ADMINISTRATIVE,
      cgvDocumentType: null,
      cgvVersion: null,
      requiredConsentTypes: [],
    };
  }

  if (!purchase.checkoutEnabled) return null;

  if (checkoutContext.sales_context === SALES_CONTEXTS.PERSONAL) {
    const startChoice = checkoutContext.access_start_choice;
    if (!purchase.availableStartChoices.includes(startChoice)) return null;
    const immediate = startChoice === ACCESS_START_CHOICES.IMMEDIATE;
    return {
      salesContext: SALES_CONTEXTS.PERSONAL,
      directCheckoutEnabled: true,
      offerClassification: OFFER_CLASSIFICATIONS.B2C_STANDARD,
      accessActivationPolicy: immediate
        ? ACCESS_ACTIVATION_POLICIES.IMMEDIATE_AFTER_PAYMENT
        : ACCESS_ACTIVATION_POLICIES.DEFERRED_AFTER_WITHDRAWAL_PERIOD,
      cgvDocumentType: 'cgv_b2c',
      cgvVersion: purchase.legalVersions.cgvB2c,
      requiredConsentTypes: [
        CONSENT_TYPES.CGV_ACCEPTANCE,
        ...(immediate && purchase.components.service ? [CONSENT_TYPES.EARLY_SERVICE_START] : []),
        ...(immediate && purchase.components.digitalContent ? [
          CONSENT_TYPES.DIGITAL_CONTENT_START,
          CONSENT_TYPES.DIGITAL_CONTENT_WITHDRAWAL_ACKNOWLEDGEMENT,
        ] : []),
      ],
    };
  }

  if (checkoutContext.sales_context === SALES_CONTEXTS.PROFESSIONAL_SELF) {
    return {
      salesContext: SALES_CONTEXTS.PROFESSIONAL_SELF,
      directCheckoutEnabled: true,
      offerClassification: OFFER_CLASSIFICATIONS.B2B,
      accessActivationPolicy: ACCESS_ACTIVATION_POLICIES.IMMEDIATE_AFTER_PAYMENT,
      cgvDocumentType: 'cgv_b2b',
      cgvVersion: purchase.legalVersions.cgvB2b,
      requiredConsentTypes: [CONSENT_TYPES.CGV_ACCEPTANCE],
    };
  }

  return {
    salesContext: SALES_CONTEXTS.BENEFICIARY,
    directCheckoutEnabled: true,
    offerClassification: OFFER_CLASSIFICATIONS.B2B,
    accessActivationPolicy: ACCESS_ACTIVATION_POLICIES.DEFERRED_BENEFICIARY_ASSIGNMENT,
    cgvDocumentType: 'cgv_b2b',
    cgvVersion: purchase.legalVersions.cgvB2b,
    requiredConsentTypes: [CONSENT_TYPES.CGV_ACCEPTANCE],
  };
}

export function getRequiredConsentTypes(route) {
  return route?.requiredConsentTypes || [];
}

export function getConsentDocumentVersion(purchase, route, consentType) {
  if (consentType === CONSENT_TYPES.CGV_ACCEPTANCE) return route?.cgvVersion || null;
  const versions = purchase?.legalVersions;
  if (consentType === CONSENT_TYPES.EARLY_SERVICE_START) return versions?.earlyService || null;
  if (consentType === CONSENT_TYPES.DIGITAL_CONTENT_START) return versions?.digitalStart || null;
  if (consentType === CONSENT_TYPES.DIGITAL_CONTENT_WITHDRAWAL_ACKNOWLEDGEMENT) {
    return versions?.digitalWithdrawalAcknowledgement || null;
  }
  return null;
}

function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateCommercialCheckoutRequest(purchase, checkoutContext, consentPayload) {
  if (!purchase) return 'Formation non disponible au paiement.';
  const route = getCommercialRoute(purchase, checkoutContext);
  if (!route) return 'Le contexte commercial est absent ou invalide.';
  if (!route.directCheckoutEnabled) return 'Ce parcours nécessite une demande de financement ou un devis.';

  if (route.salesContext === SALES_CONTEXTS.BENEFICIARY) {
    if (!isValidEmail(checkoutContext.beneficiary_email)) {
      return 'L’adresse e-mail du bénéficiaire est requise.';
    }
    if (
      typeof checkoutContext.buyer_organization_name !== 'string'
      || checkoutContext.buyer_organization_name.trim().length < 2
      || checkoutContext.buyer_organization_name.trim().length > 200
    ) {
      return 'Le nom de l’organisation acheteuse est requis.';
    }
  }

  if (consentPayload?.cgv_version !== route.cgvVersion) {
    return 'La version des CGV présentée ne correspond pas à la version applicable.';
  }

  for (const consentType of getRequiredConsentTypes(route)) {
    if (consentPayload?.[consentType] !== true) {
      return `Le consentement requis « ${consentType} » est absent.`;
    }
    if (!getConsentDocumentVersion(purchase, route, consentType)) {
      return `La formulation versionnée du consentement « ${consentType} » n’est pas publiée.`;
    }
  }

  const allowedKeys = new Set(['cgv_version', ...Object.values(CONSENT_TYPES)]);
  if (Object.keys(consentPayload || {}).some((key) => !allowedKeys.has(key))) {
    return 'La combinaison de consentements contient une valeur inconnue.';
  }
  for (const consentType of Object.values(CONSENT_TYPES)) {
    if (!route.requiredConsentTypes.includes(consentType) && consentPayload?.[consentType] === true) {
      return `Le consentement « ${consentType} » ne s’applique pas à ce parcours.`;
    }
  }

  return null;
}

export function validateCommercialConsentEvidence(session, purchase, intent, consentRows) {
  if (!isUuid(session?.metadata?.checkout_intent_id)) {
    return 'La référence de preuve commerciale Stripe est absente ou invalide.';
  }
  const route = getCommercialRoute(purchase, {
    sales_context: intent?.sales_context,
    access_start_choice: intent?.access_start_choice,
  });
  const sessionBindingIsValid = (
    intent?.stripe_checkout_session_id === session?.id
    && ['stripe_session_created', 'paid'].includes(intent?.status)
  ) || (
    intent?.original_amount_cents != null
    && intent?.stripe_checkout_session_id == null
    && intent?.status === 'created'
  );
  if (
    !route
    || !intent
    || intent.id !== session.metadata.checkout_intent_id
    || intent.user_id !== session.metadata.user_id
    || intent.course_id !== purchase.courseId
    || intent.offer_classification !== route.offerClassification
    || intent.access_activation_policy !== route.accessActivationPolicy
    || session.metadata?.sales_context !== intent.sales_context
    || session.metadata?.access_activation_policy !== intent.access_activation_policy
    || !sessionBindingIsValid
  ) {
    return 'L’intention commerciale ne correspond pas à la session Stripe.';
  }

  for (const consentType of getRequiredConsentTypes(route)) {
    const expectedVersion = consentType === CONSENT_TYPES.CGV_ACCEPTANCE
      ? null
      : getConsentDocumentVersion(purchase, route, consentType);
    const matchingRows = (consentRows || []).filter((row) => (
      row.checkout_intent_id === intent.id
      && row.user_id === intent.user_id
      && row.course_id === intent.course_id
      && row.consent_type === consentType
      && row.granted === true
      && (
        consentType === CONSENT_TYPES.CGV_ACCEPTANCE
          ? row.legal_document_version_id === intent.cgv_document_version_id
            && row.legal_document_versions?.id === intent.cgv_document_version_id
          : row.legal_document_versions?.version === expectedVersion
      )
    ));
    if (matchingRows.length !== 1) {
      return `La preuve du consentement « ${consentType} » est absente ou ambiguë.`;
    }
  }

  return null;
}

export function shouldActivateCourseAccess(intent) {
  return intent?.access_activation_policy === ACCESS_ACTIVATION_POLICIES.IMMEDIATE_AFTER_PAYMENT;
}

export const IN_PERSON_TRAVEL_FEE = Object.freeze({
  amountTotal: 3_000,
  currency: 'eur',
  paymentType: 'in_person_travel_fee',
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function validateCompletedCourseSession(session, purchase, expectedPriceId) {
  const baseError = validateCompletedCourseSessionBase(session, purchase, expectedPriceId);
  if (baseError) return baseError;
  if (!isUuid(session.metadata?.checkout_intent_id)) return 'La preuve commerciale Stripe est absente ou invalide.';
  return null;
}

export function validateCompletedCourseSessionBase(session, purchase, expectedPriceId) {
  if (session?.mode !== 'payment' || session?.status !== 'complete') return 'La session Stripe n’est pas un paiement terminé.';
  if (session.payment_status !== 'paid') return 'Le paiement Stripe n’est pas confirmé.';
  if (session.amount_total !== purchase.amountTotal || session.currency !== purchase.currency) {
    return `Le montant ou la devise ne correspond pas à la ${purchase.label}.`;
  }
  const userId = session.metadata?.user_id;
  if (!isUuid(userId) || userId !== session.client_reference_id) return 'L’identifiant utilisateur Stripe est absent ou incohérent.';
  if (session.metadata?.course_id !== purchase.courseId || session.metadata?.price_id !== expectedPriceId) {
    return 'La formation, le tarif ou la preuve commerciale Stripe ne correspond pas à la configuration attendue.';
  }
  return null;
}

export function requiresLegacyPaymentReview(session) {
  return !isUuid(session?.metadata?.checkout_intent_id);
}

export function validateCompletedAiActSession(session, expectedPriceId) {
  return validateCompletedCourseSession(session, AI_ACT_PURCHASE, expectedPriceId);
}

export function validateCompletedTravelFeeSession(session) {
  if (session?.mode !== 'payment' || session?.status !== 'complete') return 'La session Stripe n’est pas un paiement terminé.';
  if (session.payment_status !== 'paid') return 'La participation au déplacement n’est pas confirmée.';
  if (session.amount_total !== IN_PERSON_TRAVEL_FEE.amountTotal || session.currency !== IN_PERSON_TRAVEL_FEE.currency) {
    return 'Le montant ou la devise ne correspond pas à la participation au déplacement.';
  }
  if (
    session.metadata?.payment_type !== IN_PERSON_TRAVEL_FEE.paymentType
    || !isUuid(session.metadata?.booking_request_id)
    || !isUuid(session.metadata?.user_id)
    || session.metadata.user_id !== session.client_reference_id
  ) return 'Les informations de réservation Stripe sont absentes ou incohérentes.';
  return null;
}
