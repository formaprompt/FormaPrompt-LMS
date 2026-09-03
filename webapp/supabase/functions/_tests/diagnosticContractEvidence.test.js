import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { buildDiagnosticPromoEvidence, DIAGNOSTIC_PROMO_ACCEPTANCE_VERSION } from '../_shared/diagnosticContractEvidence.js';
import { buildDiagnosticContractConfirmationMessage, attemptDiagnosticContractConfirmationDelivery } from '../_shared/diagnosticContractConfirmation.js';

const cgv = { version: 'CGV-B2C-2026-08-26', content_text: 'CGV historiques de test inchangees.' };
const historicalOrder = { id: 'order-fixture', customer_email: 'contract@example.test', sales_context: 'personal',
  paid_at: '2026-09-03T10:00:00Z', amount_total: 14900, currency: 'eur' };
const amounts = (discount, final) => ({ original_amount_cents: 14900, discount_amount_cents: discount,
  final_amount_cents: final, currency: 'eur' });
function promoted(discount = 14155, final = 745) {
  const evidence = buildDiagnosticPromoEvidence(amounts(discount, final));
  return { cgv, order: { ...historicalOrder, ...amounts(discount, final), amount_total: final,
    promo_redemption_id: 'redemption-fixture', cgv_acceptance_statement_version_id: 'template-fixture' },
  acceptance: { acceptance_text: evidence.text, legal_document_version_id: 'template-fixture',
    legal_document_versions: { version: evidence.version } } };
}

test('sans promotion : confirmation 149 euros historique et aucune preuve promotionnelle', () => {
  const result = buildDiagnosticContractConfirmationMessage({ order: historicalOrder, cgv });
  assert.match(result.body, /Prix total payé : 149 €/);
  assert.match(result.body, /Conditions contractuelles acceptées : CGV-B2C-2026-08-26/);
  assert.doesNotMatch(result.body, /Remise|ACCEPTANCE-PROMO/);
});
for (const [label, discount, final, expectedDiscount, expectedFinal] of [
  ['95 pour cent simules', 14155, 745, '141,55 €', '7,45 €'],
  ['autre pourcentage 10', 1490, 13410, '14,90 €', '134,10 €'],
  ['montant fixe 20 euros', 2000, 12900, '20,00 €', '129,00 €'],
]) {
  test(`preuve et confirmation dynamiques : ${label}`, () => {
    const input = promoted(discount, final);
    assert.equal(input.acceptance.legal_document_versions.version, DIAGNOSTIC_PROMO_ACCEPTANCE_VERSION);
    assert.equal(input.acceptance.acceptance_text,
      "J'accepte les Conditions générales de vente applicables au Diagnostic IA Express. "
      + `Prix catalogue : 149,00 €. Remise promotionnelle : ${expectedDiscount}. `
      + `Montant total de ma commande : ${expectedFinal}. Je reconnais que ma commande m'oblige au paiement de ${expectedFinal}.`);
    const message = buildDiagnosticContractConfirmationMessage(input);
    assert.ok(message.body.includes(input.acceptance.acceptance_text));
    assert.match(message.body, /CGV-B2C-2026-08-26/);
    assert.doesNotMatch(message.body, /paiement de 149(?:,00)? €/);
  });
}
test('la preuve SMTP est identique entre panne et retry', async () => {
  const input = promoted(), sent = [];
  const first = await attemptDiagnosticContractConfirmationDelivery(input, { send: async (message) => {
    sent.push(message); throw new Error('fixture smtp');
  } });
  assert.equal(first.contract_confirmation_delivery_status, 'failed');
  const retry = await attemptDiagnosticContractConfirmationDelivery({ ...input,
    order: { ...input.order, contract_confirmation_delivery_attempts: 1 } }, {
    send: async (message) => { sent.push(message); },
  });
  assert.equal(retry.contract_confirmation_delivery_status, 'sent');
  assert.deepEqual(sent[0], sent[1]);
});
test('preuve figee, devise et montant paye incoherents sont refuses', () => {
  for (const change of [
    (i) => { i.acceptance.acceptance_text = 'Paiement de 149 €'; },
    (i) => { i.order.amount_total = 14900; },
    (i) => { i.order.currency = 'usd'; },
    (i) => { i.acceptance.legal_document_version_id = 'autre'; },
  ]) {
    const input = promoted(); change(input);
    assert.throws(() => buildDiagnosticContractConfirmationMessage(input));
  }
  assert.throws(() => buildDiagnosticPromoEvidence(amounts(14900, 0)));
});
test('contre-test executable : une implementation figee a 149 euros est detectee', () => {
  const source = readFileSync('supabase/functions/_shared/diagnosticContractEvidence.js', 'utf8');
  const mutant = source.replace('const final = diagnosticEvidenceEuros(final_amount_cents);', "const final = '149,00 €';");
  assert.notEqual(mutant, source);
  const exports = {};
  runInNewContext(ts.transpileModule(mutant, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  const requirement = (build) => assert.match(build(amounts(14155, 745)).text, /oblige au paiement de 7,45 €/);
  requirement(buildDiagnosticPromoEvidence);
  assert.throws(() => requirement(exports.buildDiagnosticPromoEvidence), { name: 'AssertionError' });
});
