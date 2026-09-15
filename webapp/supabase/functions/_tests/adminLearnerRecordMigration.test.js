import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../../migrations/20260915143000_add_admin_learner_record.sql', import.meta.url), 'utf8');

test('la RPC de fiche apprenant impose le rôle admin strict et des privilèges fermés', () => {
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/i);
  assert.match(sql, /auth\.uid\(\).*private\.is_strict_admin\(\)/is);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_get_learner_record\(uuid\)\s+FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_get_learner_record\(uuid\) TO authenticated/i);
  assert.doesNotMatch(sql, /private\.is_admin\(\)/i);
});

test('chaque rubrique nominative est filtrée par le UUID cible et exclut les contenus bruts', () => {
  const exactFilters = sql.match(/(?:e|access|purchase|progress|booking|survey|document|attestation)\.user_id = p_user_id/g) || [];
  assert.ok(exactFilters.length >= 8, `filtres UUID exacts trouvés: ${exactFilters.length}`);
  assert.doesNotMatch(sql, /lower\s*\([^)]*email|content_snapshot|meeting_url|'stripePaymentIntentId'|'stripeCheckoutSessionId'/i);
  assert.match(sql, /survey\.private_feedback/);
  assert.match(sql, /e\.administrative_notes/);
});

test('les alertes pédagogiques comparent la dernière remise à une revue de son identifiant exact', () => {
  assert.match(sql, /DISTINCT ON \(response\.user_id, response\.course_id, response\.exercise_id\)[\s\S]*response\.status = 'submitted'[\s\S]*response\.saved_at DESC, response\.id DESC/i);
  assert.match(sql, /review\.response_id = latest\.id/i);
  assert.match(sql, /DISTINCT ON \(submission\.user_id, submission\.course_id\)[\s\S]*submission\.status = 'submitted'[\s\S]*submission\.saved_at DESC, submission\.id DESC/i);
  assert.match(sql, /review\.submission_id = latest\.id/i);
  assert.doesNotMatch(sql, /review_status\s*=\s*'needs_revision'/i);
});

test('les montants reposent sur une transaction probante et les cadeaux sur une origine exacte', () => {
  assert.match(sql, /transaction\.status IN \('paid', 'partially_refunded', 'refunded', 'disputed', 'dispute_won', 'dispute_lost'\)/i);
  assert.match(sql, /transaction\.purchase_id = purchase\.id/i);
  assert.match(sql, /transaction\.amount_total IS NOT DISTINCT FROM purchase\.amount_total/i);
  assert.match(sql, /transaction\.currency IS NOT DISTINCT FROM purchase\.currency/i);
  assert.match(sql, /greatest\(purchase\.amount_total - finance\.amount_refunded, 0\)/i);
  assert.match(sql, /access\.access_source = 'gift'[\s\S]*access\.purchase_id IS NULL/i);
  assert.match(sql, /'promotionCode', NULL/i);
  assert.doesNotMatch(sql, /JOIN public\.promo_codes/i);
});
