import test from 'node:test';
import assert from 'node:assert/strict';
import { isLiveCheckoutSessionId, validatePurchaseConversionReceipt } from './purchaseConversionReceipt.js';

const receipt = { verified: true, livemode: true, transaction_id: '88000000-0000-4000-8000-000000000001', amount_total_cents: 11900, currency: 'EUR' };

test('validates live checkout keys without treating the URL as purchase proof', () => {
  assert.equal(isLiveCheckoutSessionId('cs_live_abc123'), true);
  assert.equal(isLiveCheckoutSessionId('cs_live_abc_123'), true);
  assert.equal(isLiveCheckoutSessionId(`cs_live_${'a'.repeat(190)}`), true);
  assert.equal(isLiveCheckoutSessionId(`cs_live_${'a'.repeat(191)}`), false);
  for (const key of ['cs_test_abc123', 'cs_fake_abc123', null, 'cs_live_', 'cs_live_a?paid=true', `cs_live_${'a'.repeat(256)}`]) {
    assert.equal(isLiveCheckoutSessionId(key), false);
  }
});

test('keeps the server amount and opaque transaction, discarding unrelated data', () => {
  assert.deepEqual(validatePurchaseConversionReceipt({ ...receipt, email: 'never-forward@example.test' }), receipt);
  assert.equal(validatePurchaseConversionReceipt({ ...receipt, amount_total_cents: 4900 }).amount_total_cents, 4900);
});

test('rejects test, unpaid, cancelled, malformed and unsafe receipts without fallback', () => {
  for (const value of [null, [], {}, { ...receipt, verified: false }, { ...receipt, livemode: false },
    { ...receipt, transaction_id: 'cs_live_private' }, { ...receipt, transaction_id: '00000000-0000-0000-0000-000000000000' },
    { ...receipt, amount_total_cents: 0 }, { ...receipt, amount_total_cents: -1 }, { ...receipt, amount_total_cents: 119.5 },
    { ...receipt, amount_total_cents: '11900' }, { ...receipt, amount_total_cents: Number.MAX_SAFE_INTEGER + 1 },
    { ...receipt, currency: 'eur' }, { ...receipt, currency: 'invalid' }, { status: 'paid' }, { status: 'cancelled' }]) {
    assert.equal(validatePurchaseConversionReceipt(value), null);
  }
});
