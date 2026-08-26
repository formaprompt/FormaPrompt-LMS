import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const webhook = readFileSync(resolve('supabase/functions/stripe-webhook-ai-act/index.ts'), 'utf8');
const reconciliation = readFileSync(resolve('supabase/functions/admin-reconcile-stripe/index.ts'), 'utf8');
const checkout = readFileSync(resolve('supabase/functions/create-checkout/index.ts'), 'utf8');
const config = readFileSync(resolve('supabase/config.toml'), 'utf8');
const purchaseConfig = readFileSync(resolve('supabase/functions/_shared/purchaseConfig.js'), 'utf8');
const diagnosticCheckout = readFileSync(resolve('supabase/functions/create-diagnostic-checkout/index.ts'), 'utf8');

test('vérifie la signature sur le corps brut avant tout traitement', () => {
  const rawBody = webhook.indexOf('const rawBody = await request.text()');
  const signature = webhook.indexOf('constructEventAsync');
  const processing = webhook.indexOf('supabaseAdmin.rpc(processor');
  assert.ok(rawBody >= 0);
  assert.ok(signature > rawBody);
  assert.ok(processing > signature);
  assert.match(webhook, /event\.livemode !== liveMode/);
});

test('délègue toutes les mutations post-paiement à la transaction PostgreSQL', () => {
  assert.match(webhook, /process_stripe_post_payment_event/);
  assert.match(webhook, /process_diagnostic_ia_stripe_event/);
  assert.doesNotMatch(webhook, /from\(['"](?:purchases|course_access|stripe_payment_transactions|stripe_refunds|stripe_disputes)['"]\)\s*\.(?:insert|update|upsert|delete)/s);
  assert.match(webhook, /already_processed|\.\.\.data/);
});

test('la réconciliation distante est strictement administrative et Stripe lecture seule', () => {
  assert.match(reconciliation, /auth\.getUser\(token\)/);
  assert.match(reconciliation, /actor\.role !== 'admin'/);
  assert.match(reconciliation, /STRIPE_RECONCILIATION_READ_KEY/);
  assert.match(reconciliation, /rk_test_|rk_live_/);
  assert.match(reconciliation, /paymentIntents\.list/);
  assert.doesNotMatch(reconciliation, /stripe\.(?:refunds|paymentIntents|charges)\.(?:create|update|cancel|capture)/);
  assert.match(config, /\[functions\.admin-reconcile-stripe\]\s*verify_jwt = true/s);
});

test('préserve les trois paiements directs, les frais et automatic_tax false', () => {
  for (const courseId of ['formation-ia', 'formation-prompt-level-1', 'formation-ia-act']) {
    assert.match(purchaseConfig, new RegExp(`courseId: '${courseId}'`));
  }
  assert.match(purchaseConfig, /checkoutEnabled: true/);
  assert.match(purchaseConfig, /in_person_travel_fee/);
  assert.match(checkout, /automatic_tax:\s*\{ enabled: false \}/);
});

test('isole le paiement Diagnostic des achats et droits LMS', () => {
  assert.match(webhook, /process_diagnostic_ia_stripe_event/);
  assert.match(diagnosticCheckout, /STRIPE_DIAGNOSTIC_IA_PRICE_ID|priceEnvName/);
  assert.match(diagnosticCheckout, /automatic_tax:\s*\{ enabled: false \}/);
  assert.match(diagnosticCheckout, /idempotencyKey/);
  assert.doesNotMatch(diagnosticCheckout, /\.from\(['"](?:purchases|course_access)['"]\)/);
  assert.doesNotMatch(diagnosticCheckout, /payment_method_types/);
});
