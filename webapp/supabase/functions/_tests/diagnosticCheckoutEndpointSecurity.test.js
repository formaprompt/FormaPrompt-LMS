import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const checkout = readFileSync(resolve('supabase/functions/create-diagnostic-checkout/index.ts'), 'utf8');
const webhook = readFileSync(resolve('supabase/functions/stripe-webhook-ai-act/index.ts'), 'utf8');
const promotionValidation = readFileSync(resolve('supabase/functions/validate-diagnostic-promotion/index.ts'), 'utf8');
const migration = readFileSync(resolve('supabase/migrations/20260826163906_add_diagnostic_ia_payments.sql'), 'utf8');
const promotionMigration = readFileSync(resolve('supabase/migrations/20260831130000_integrate_diagnostic_promotions.sql'), 'utf8');
const legalMigration = readFileSync(resolve('supabase/migrations/20260826192602_add_diagnostic_ia_legal_consents.sql'), 'utf8');

test('authentifie côté serveur avant toute création de commande', () => {
  const authentication = checkout.indexOf('auth.getUser(accessToken)');
  const orderInsert = checkout.indexOf(".from('diagnostic_ia_orders')");
  const stripeCreation = checkout.indexOf('stripe.checkout.sessions.create');
  assert.ok(authentication >= 0);
  assert.ok(orderInsert > authentication);
  assert.ok(stripeCreation > authentication);
  assert.doesNotMatch(checkout, /body\.(?:amount|price|user_id|email)/);
});

test('fige la formulation CGV et enregistre une preuve serveur avant Stripe', () => {
  const statementLookup = checkout.indexOf('DIAGNOSTIC_LEGAL_STATEMENTS.cgvAcceptance');
  const evidenceInsert = checkout.indexOf(".from('diagnostic_ia_consents')");
  const stripeCreation = checkout.indexOf('stripe.checkout.sessions.create');
  assert.ok(statementLookup >= 0);
  assert.ok(evidenceInsert > statementLookup);
  assert.ok(stripeCreation > evidenceInsert);
  assert.match(checkout, /consent_type: 'cgv_acceptance'/);
  assert.match(checkout, /source: 'web_checkout'/);
});

test('impose un Price cohérent avec la clé TEST ou LIVE et une clé d idempotence serveur', () => {
  assert.doesNotMatch(checkout, /stripeMode !== 'test'/);
  assert.match(checkout, /getDiagnosticStripeMode/);
  assert.match(checkout, /prices\.retrieve\(priceId\)/);
  assert.match(checkout, /validateDiagnosticStripePrice/);
  assert.match(checkout, /idempotencyKey: `diagnostic-ia-checkout-\$\{order\.id\}`/);
  assert.match(checkout, /client_reference_id: user\.id/);
  assert.match(checkout, /session_id=\{CHECKOUT_SESSION_ID\}/);
});

test('derive identité et email côté serveur pour la validation promotionnelle', () => {
  const authentication = promotionValidation.indexOf('auth.getUser(accessToken)');
  const validationRpc = promotionValidation.indexOf("rpc('validate_promo_code_for_checkout'");
  assert.ok(authentication >= 0);
  assert.ok(validationRpc > authentication);
  assert.match(promotionValidation, /p_user_id: user\.id/);
  assert.match(promotionValidation, /p_email: user\.email/);
  assert.match(promotionValidation, /p_original_amount_cents: DIAGNOSTIC_IA_PAYMENT\.amountTotal/);
  assert.match(promotionValidation, /p_target_type: DIAGNOSTIC_PROMOTION\.targetType/);
  assert.doesNotMatch(promotionValidation, /body\.(?:user_id|email|amount|discount|final)/);
});

test('reserve avant Stripe et libere un échec de création définitif', () => {
  const prepare = checkout.indexOf("rpc('prepare_diagnostic_promotion_checkout'");
  const stripeCreation = checkout.indexOf('stripe.checkout.sessions.create');
  const cleanup = checkout.lastIndexOf("rpc('reset_diagnostic_promotion_checkout'");
  assert.ok(prepare >= 0);
  assert.ok(stripeCreation > prepare);
  assert.ok(cleanup > stripeCreation);
  assert.match(checkout, /isAmbiguousStripeCreationError/);
  assert.match(checkout, /promo_redemption_id/);
  assert.match(checkout, /expires_at/);
});

test('facture le total réservé avec price_data sans modifier le Price catalogue', () => {
  assert.match(checkout, /buildDiagnosticStripeLineItem/);
  assert.match(checkout, /finalAmountCents: checkoutConfiguration\.final_amount_cents/);
  assert.doesNotMatch(checkout, /coupons:|allow_promotion_codes: true/);
  assert.match(checkout, /allow_promotion_codes: false/);
});

test('utilise des métadonnées déterministes sans information sensible', () => {
  for (const key of ['purchase_type', 'diagnostic_order_id', 'user_id', 'price_id']) {
    assert.match(checkout, new RegExp(`${key}:`));
  }
  assert.doesNotMatch(checkout, /questionnaire|phone_number_collection/);
});

test('le webhook Diagnostic reste signé et isolé du LMS', () => {
  assert.match(webhook, /constructEventAsync/);
  assert.match(webhook, /validateCompletedDiagnosticSession/);
  assert.match(webhook, /process_diagnostic_ia_stripe_event/);
  assert.doesNotMatch(migration, /INSERT INTO public\.(?:purchases|course_access)/i);
  assert.doesNotMatch(migration, /UPDATE public\.(?:purchases|course_access)/i);
  assert.doesNotMatch(promotionMigration, /INSERT INTO public\.(?:purchases|course_access)/i);
  assert.doesNotMatch(promotionMigration, /UPDATE public\.(?:purchases|course_access)/i);
});

test('vérifie le montant réservé avant de consommer la promotion', () => {
  const lookup = webhook.indexOf(".from('diagnostic_ia_orders')");
  const amountValidation = webhook.indexOf('diagnosticOrder.final_amount_cents');
  const processor = webhook.indexOf("'process_diagnostic_ia_stripe_event'");
  assert.ok(lookup >= 0);
  assert.ok(amountValidation > lookup);
  assert.ok(processor > amountValidation);
  assert.match(promotionMigration, /private\.consume_promo_redemption/);
  assert.match(promotionMigration, /v_amount_total IS DISTINCT FROM v_order\.final_amount_cents/);
  assert.match(promotionMigration, /private\.release_promo_redemption/);
});

test('fige une configuration unique par commande pour les doubles clics et retries', () => {
  assert.match(migration, /CREATE UNIQUE INDEX diagnostic_ia_orders_pending_user_uidx/);
  assert.match(migration, /WHERE status = 'payment_pending'/);
  assert.match(promotionMigration, /FOR UPDATE/);
  assert.match(promotionMigration, /checkout_configuration_locked_at/);
  assert.match(promotionMigration, /'diagnostic_ia_order'/);
  assert.match(checkout, /idempotencyKey: `diagnostic-ia-checkout-\$\{order\.id\}`/);
  assert.match(checkout, /configuredPromotionCode !== requestedPromotionCode/);
  assert.match(checkout, /autre configuration tarifaire/);
});

test('la reservation couvre Checkout avec un tampon et un échec de carte reste retentable', () => {
  assert.match(checkout, /diagnosticPromotionCheckoutExpiresAt/);
  assert.match(promotionMigration, /interval '35 minutes'/);
  assert.match(promotionMigration, /IS DISTINCT FROM 'payment_intent\.payment_failed'/);
  assert.match(
    promotionMigration,
    /ELSIF v_event_type IN \('checkout\.session\.async_payment_failed', 'checkout\.session\.expired'\) THEN/,
  );
});

test('préserve les anciennes CGV et fige la version acceptée par chaque intention', () => {
  assert.match(legalMigration, /CGV-B2C-2026-08-12/);
  assert.match(legalMigration, /CGV-B2C-2026-08-26/);
  assert.doesNotMatch(legalMigration, /DELETE\s+FROM\s+public\.legal_document_versions/i);
  assert.match(webhook, /cgv_document_version_id/);
  assert.match(webhook, /legal_document_versions!inner\(id, version\)/);
});

test('borne et temporise la reprise des confirmations contractuelles', () => {
  assert.match(webhook, /DIAGNOSTIC_CONTRACT_DELIVERY_MAX_ATTEMPTS/);
  assert.match(webhook, /diagnosticContractDeliveryClaimFilter/);
  assert.match(webhook, /\.lt\('contract_confirmation_delivery_attempts'/);
  assert.match(webhook, /DIAGNOSTIC_CONTRACT_DELIVERY_RETRY_PENDING/);
});
