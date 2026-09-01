import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checkout = readFileSync(resolve('supabase/functions/create-checkout/index.ts'), 'utf8');
const validator = readFileSync(resolve('supabase/functions/validate-course-promotion/index.ts'), 'utf8');
const webhook = readFileSync(resolve('supabase/functions/stripe-webhook-ai-act/index.ts'), 'utf8');
const migration = readFileSync(resolve('supabase/migrations/20260831170000_integrate_course_promotions.sql'), 'utf8');

test('la validation dérive identité, email, cible et prix du serveur', () => {
  assert.match(validator, /auth\.getUser\(accessToken\)/);
  assert.match(validator, /p_user_id:\s*user\.id/);
  assert.match(validator, /p_email:\s*user\.email/);
  assert.match(validator, /p_target_type:\s*COURSE_PROMOTION\.targetType/);
  assert.match(validator, /p_target_key:\s*purchase\.courseId/);
  assert.match(validator, /p_original_amount_cents:\s*purchase\.amountTotal/);
  assert.doesNotMatch(validator, /body\.(user_id|email|final_amount_cents|discount_amount_cents)/);
});

test('le checkout fige une intention et utilise une clé Stripe stable', () => {
  assert.match(checkout, /prepare_course_checkout_intent/);
  assert.match(checkout, /prepare_course_promotion_checkout/);
  assert.match(checkout, /idempotencyKey:\s*`course-checkout-\$\{checkoutIntent\.id\}`/);
  assert.match(checkout, /price_data|buildCourseStripeLineItem/);
  assert.match(checkout, /price\.unit_amount !== purchase\.amountTotal/);
  assert.match(checkout, /isAmbiguousCourseStripeCreationError/);
  assert.match(checkout, /reset_course_promotion_checkout/);
});

test('le webhook consomme ou libère dans la transaction du processeur historique', () => {
  assert.match(webhook, /process_course_stripe_event/);
  assert.match(migration, /private\.consume_promo_redemption/);
  assert.match(migration, /private\.release_promo_redemption/);
  assert.match(migration, /public\.process_stripe_post_payment_event\(p_event\)/);
  assert.match(migration, /payment_intent\.payment_failed[\s\S]*processing_result[\s\S]*'ignored'/);
});

test('les RPC 1G-C sont exclusivement service_role et sans écriture LMS directe', () => {
  for (const signature of [
    'prepare_course_checkout_intent',
    'prepare_course_promotion_checkout',
    'reset_course_promotion_checkout',
    'process_course_stripe_event',
  ]) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${signature}`));
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${signature}[\\s\\S]*?TO service_role`));
  }
  assert.doesNotMatch(migration, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.course_access/i);
  assert.doesNotMatch(migration, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.purchases/i);
});
