import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPromotion, formatPromotionDiscount, listPromotions, normalizePromotionCode,
  parseEurosToCents, promotionDraftToRpc, promotionStatus, setPromotionActive,
  updatePromotion, validatePromotionDraft,
} from './promotionAdministration.js';

function validDraft(overrides = {}) {
  return {
    code: ' promo-20 ', description: 'Campagne', discount_type: 'percent',
    discount_value: '20', active: true, starts_at: '', ends_at: '', max_uses: '10',
    max_uses_per_user: '1', restricted_email: '', minimum_final_amount_cents: '0',
    targets: [{ target_type: 'diagnostic', target_key: 'diagnostic-ia-express' }],
    ...overrides,
  };
}

test('normalise les codes et convertit les euros sans calcul monétaire flottant', () => {
  assert.equal(normalizePromotionCode(' welcome10 '), 'WELCOME10');
  assert.equal(parseEurosToCents('20,05'), 2005);
  assert.equal(parseEurosToCents('20.5'), 2050);
  assert.equal(parseEurosToCents('20.005'), null);
});

test('valide pourcentage, montant fixe, dates, quotas et email', () => {
  assert.deepEqual(validatePromotionDraft(validDraft()), {});
  assert.deepEqual(validatePromotionDraft(validDraft({ discount_type: 'fixed_amount', discount_value: '20,00' })), {});
  const errors = validatePromotionDraft(validDraft({
    discount_value: '101', starts_at: '2026-09-02T12:00', ends_at: '2026-09-01T12:00',
    max_uses: '1', max_uses_per_user: '2', restricted_email: 'invalide',
  }));
  assert.ok(errors.discount_value);
  assert.ok(errors.ends_at);
  assert.ok(errors.max_uses_per_user);
  assert.ok(errors.restricted_email);
});

test('valide global, multi-cible et identifiants produit stables', () => {
  assert.deepEqual(validatePromotionDraft(validDraft({ targets: [{ target_type: 'all', target_key: 'all' }] })), {});
  assert.deepEqual(validatePromotionDraft(validDraft({ targets: [
    { target_type: 'course', target_key: 'formation-ia' },
    { target_type: 'product', target_key: 'audit-ia-2027' },
  ] })), {});
  assert.ok(validatePromotionDraft(validDraft({ targets: [
    { target_type: 'course', target_key: 'formation-ia' },
    { target_type: 'course', target_key: 'formation-ia' },
  ] })).targets);
  assert.ok(validatePromotionDraft(validDraft({ targets: [
    { target_type: 'all', target_key: 'all' },
    { target_type: 'course', target_key: 'formation-ia' },
  ] })).targets);
});

test('prépare les paramètres autoritatifs du RPC et convertit les montants en cents', () => {
  const { parameters } = promotionDraftToRpc(validDraft({
    discount_type: 'fixed_amount', discount_value: '20,00',
    restricted_email: ' ADMIN@EXAMPLE.FR ', minimum_final_amount_cents: '1,50',
  }));
  assert.equal(parameters.p_code, 'PROMO-20');
  assert.equal(parameters.p_discount_value, 2000);
  assert.equal(parameters.p_minimum_final_amount_cents, 150);
  assert.equal(parameters.p_restricted_email, 'admin@example.fr');
});

test('affiche les remises et les états administratifs', () => {
  assert.equal(formatPromotionDiscount({ discount_type: 'percent', discount_value: 10 }), '10 %');
  assert.match(formatPromotionDiscount({ discount_type: 'fixed_amount', discount_value: 2000 }), /20,00/);
  assert.equal(promotionStatus({ active: false }), 'Inactive');
  assert.equal(promotionStatus({ active: true, starts_at: '2030-01-01T00:00:00Z' }, new Date('2026-01-01')), 'Planifiée');
  assert.equal(promotionStatus({ active: true, remaining_uses: 0 }, new Date('2026-01-01')), 'Quota atteint');
});

test('utilise uniquement les RPC admin pour lister, créer, modifier et activer', async () => {
  const calls = [];
  const client = { rpc: async (name, parameters) => {
    calls.push([name, parameters]);
    return { data: name === 'admin_list_promotions' ? [{ id: 'promo-1' }] : { id: 'promo-1' }, error: null };
  } };
  assert.equal((await listPromotions(client)).length, 1);
  await createPromotion(client, validDraft());
  await updatePromotion(client, 'promo-1', validDraft());
  await setPromotionActive(client, 'promo-1', false);
  assert.deepEqual(calls.map(([name]) => name), [
    'admin_list_promotions', 'admin_create_promotion', 'admin_update_promotion', 'admin_set_promotion_active',
  ]);
  assert.equal(calls[2][1].p_code, undefined, 'le code immuable n’est pas envoyé à la modification');
  assert.equal(calls[2][1].p_active, undefined, 'l’activation possède une RPC dédiée');
});
