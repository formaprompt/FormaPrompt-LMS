export const IAG_ELEARNING_COURSE_ID = 'formation-ia-generative-elearning';
// 01/01/2027 00:00:00 Europe/Paris (CET).
export const IAG_STANDARD_START = '2026-12-31T23:00:00.000Z';
export const IAG_PRICE_ENVIRONMENTS = Object.freeze({
  7900: 'STRIPE_IAG_ELEARNING_INTRO_PRICE_ID',
  9900: 'STRIPE_IAG_ELEARNING_STANDARD_PRICE_ID',
});

export function getIagOffer(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('Horloge IAG invalide.');
  const amountTotal = now.getTime() < Date.parse(IAG_STANDARD_START) ? 7900 : 9900;
  return Object.freeze({
    courseId: IAG_ELEARNING_COURSE_ID,
    amountTotal,
    currency: 'eur',
    priceEnvName: IAG_PRICE_ENVIRONMENTS[amountTotal],
    landingPath: '/formation-ia-generative-elearning#inscription',
    resourcePath: `/course/${IAG_ELEARNING_COURSE_ID}`,
    label: 'formation IA générative en e-learning',
    deliveryKind: 'self_paced_elearning',
    requiresLmsAccess: true,
    promotionEnabled: true,
    // Le rythme autonome ne supprime pas la prestation de correction/reprise.
    // Paramètres contractuels à valider avant toute ouverture commerciale.
    components: Object.freeze({ service: true, digitalContent: true }),
    serviceTermsValidationRequired: true,
    serviceCommitments: Object.freeze({
      writtenCorrections: 3,
      revisionPassesPerWork: 1,
      responseTimeDays: 2,
      responseTimeBasis: 'calendar_days',
      timeZone: 'Europe/Paris',
      weekendsAndHolidaysIncluded: true,
    }),
  });
}

// L'intention provient exclusivement du serveur, jamais du body/metadata Stripe.
// Les validateurs existants vérifient ensuite montants, utilisateur et session.
export function resolveIagIntentPurchase(purchase, intent, readEnv) {
  if (purchase?.courseId !== IAG_ELEARNING_COURSE_ID) return purchase;
  const priceEnvName = IAG_PRICE_ENVIRONMENTS[intent?.original_amount_cents];
  const expectedPriceId = priceEnvName && readEnv(priceEnvName)?.trim();
  if (!priceEnvName || !expectedPriceId || intent?.course_id !== purchase.courseId
    || intent.catalog_price_id !== expectedPriceId || !intent.checkout_configuration_locked_at) {
    throw new Error('Configuration IAG enregistrée absente ou incohérente.');
  }
  return Object.freeze({ ...purchase, amountTotal: intent.original_amount_cents, priceEnvName });
}

export function validateIagStripeCatalog(purchase, price, product, liveMode) {
  if (purchase?.courseId !== IAG_ELEARNING_COURSE_ID) return null;
  if (!price?.active || price.livemode !== liveMode || price.currency !== 'eur'
    || price.unit_amount !== purchase.amountTotal || price.recurring !== null
    || price.metadata?.course_id !== purchase.courseId
    || !product?.active || product.deleted || product.livemode !== liveMode
    || product.metadata?.course_id !== purchase.courseId
    || product.metadata?.delivery_kind !== 'self_paced_elearning') {
    return 'Le produit ou le tarif Stripe ne correspond pas au cours IAG e-learning.';
  }
  return null;
}
