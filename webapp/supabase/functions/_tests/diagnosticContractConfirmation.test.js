import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attemptDiagnosticContractConfirmationDelivery,
  buildDiagnosticContractConfirmationMessage,
} from '../_shared/diagnosticContractConfirmation.js';

function input(salesContext = 'personal') {
  return {
    order: {
      id: '86000000-0000-4000-8000-000000000010',
      customer_email: 'client@example.test',
      sales_context: salesContext,
      paid_at: '2026-08-26T16:00:00.000Z',
      contract_confirmation_delivery_attempts: 0,
    },
    cgv: { version: 'CGV-B2C-2026-08-26', content_text: 'Conditions contractuelles figées.' },
    withdrawalForm: { version: 'WITHDRAWAL-FORM-2026-08-26', content_text: 'FORMULAIRE TYPE DE RÉTRACTATION' },
  };
}

test('la confirmation durable B2C contient le contrat et le formulaire de rétractation', () => {
  const message = buildDiagnosticContractConfirmationMessage(input());
  assert.equal(message.recipientEmail, 'client@example.test');
  assert.match(message.body, /149 €/);
  assert.match(message.body, /CGV-B2C-2026-08-26/);
  assert.match(message.body, /FORMULAIRE TYPE DE RÉTRACTATION/);
  assert.match(message.body, /formaprompt\.com\/retractation/);
});

test('la confirmation B2B ne joint pas le formulaire consommateur', () => {
  const message = buildDiagnosticContractConfirmationMessage(input('professional'));
  assert.doesNotMatch(message.body, /FORMULAIRE TYPE DE RÉTRACTATION/);
});

test('un échec SMTP est tracé sans transformer le paiement en échec', async () => {
  const result = await attemptDiagnosticContractConfirmationDelivery(input(), {
    send: async () => { throw new Error('smtp unavailable'); },
    now: () => '2026-08-26T16:05:00.000Z',
  });
  assert.equal(result.contract_confirmation_delivery_status, 'failed');
  assert.equal(result.contract_confirmation_delivery_attempts, 1);
  assert.equal(result.contract_confirmation_delivery_error_code, 'smtp_delivery_failed');
});
