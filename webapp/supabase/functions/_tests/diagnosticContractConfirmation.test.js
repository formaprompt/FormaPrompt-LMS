import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attemptDiagnosticContractConfirmationDelivery,
  buildDiagnosticContractConfirmationMessage,
  diagnosticContractDeliveryClaimFilter,
  DIAGNOSTIC_CONTRACT_DELIVERY_MAX_ATTEMPTS,
  DIAGNOSTIC_CONTRACT_DELIVERY_STALE_AFTER_MS,
  isDiagnosticContractDeliveryRetryable,
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

test('un envoi sending ne devient récupérable qu’après quinze minutes et avec un nombre borné de tentatives', () => {
  const now = new Date('2026-08-27T12:00:00.000Z');
  const filter = diagnosticContractDeliveryClaimFilter(now);
  assert.equal(DIAGNOSTIC_CONTRACT_DELIVERY_STALE_AFTER_MS, 15 * 60 * 1000);
  assert.equal(DIAGNOSTIC_CONTRACT_DELIVERY_MAX_ATTEMPTS, 5);
  assert.match(filter, /status\.eq\.pending/);
  assert.match(filter, /status\.in\.\(failed,sending\)/);
  assert.match(filter, /2026-08-27T11:45:00\.000Z/);
  assert.equal(isDiagnosticContractDeliveryRetryable({
    contract_confirmation_delivery_status: 'sending',
    contract_confirmation_delivery_attempts: 1,
  }), true);
  assert.equal(isDiagnosticContractDeliveryRetryable({
    contract_confirmation_delivery_status: 'sent',
    contract_confirmation_delivery_attempts: 1,
  }), false);
  assert.equal(isDiagnosticContractDeliveryRetryable({
    contract_confirmation_delivery_status: 'failed',
    contract_confirmation_delivery_attempts: 5,
  }), false);
});
