import assert from 'node:assert/strict';
import test from 'node:test';
import { filterStripeRows, formatStripeMoney, STRIPE_CASE_STATUS_LABELS } from './stripeAdministration.js';

test('formate les montants Stripe en unités monétaires', () => {
  assert.match(formatStripeMoney(18_700, 'eur'), /187/);
  assert.equal(formatStripeMoney(null, 'eur'), '—');
});

test('recherche dans les identifiants et les libellés sans modifier les lignes', () => {
  const rows = [
    { id: 'tx-1', course_id: 'formation-ia', status: 'paid' },
    { id: 'tx-2', course_id: 'formation-ia-act', status: 'refunded' },
  ];
  assert.deepEqual(filterStripeRows(rows, 'REFUNDED'), [rows[1]]);
  assert.equal(filterStripeRows(rows, ''), rows);
});

test('distingue examen et résolution administrative', () => {
  assert.equal(STRIPE_CASE_STATUS_LABELS.reviewed, 'Examiné');
  assert.equal(STRIPE_CASE_STATUS_LABELS.resolved, 'Résolu');
});
