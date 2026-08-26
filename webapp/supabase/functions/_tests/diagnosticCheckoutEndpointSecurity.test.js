import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const checkout = readFileSync(resolve('supabase/functions/create-diagnostic-checkout/index.ts'), 'utf8');
const webhook = readFileSync(resolve('supabase/functions/stripe-webhook-ai-act/index.ts'), 'utf8');
const migration = readFileSync(resolve('supabase/migrations/20260826163906_add_diagnostic_ia_payments.sql'), 'utf8');

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

test('impose le Price test et une clé d idempotence serveur', () => {
  assert.match(checkout, /stripeMode !== 'test'/);
  assert.match(checkout, /prices\.retrieve\(priceId\)/);
  assert.match(checkout, /validateDiagnosticStripePrice/);
  assert.match(checkout, /idempotencyKey: `diagnostic-ia-checkout-\$\{order\.id\}`/);
  assert.match(checkout, /client_reference_id: user\.id/);
  assert.match(checkout, /session_id=\{CHECKOUT_SESSION_ID\}/);
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
});
