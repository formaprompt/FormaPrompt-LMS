import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchWithdrawalRequests,
  splitWithdrawalRequests,
  updateWithdrawalRequest,
} from './withdrawalAdministration.js';

test('classe les demandes ouvertes avant l historique cloture', () => {
  const groups = splitWithdrawalRequests([
    { id: 'one', status: 'received' },
    { id: 'two', status: 'accepted' },
    { id: 'three', status: 'closed' },
  ]);
  assert.deepEqual(groups.open.map(({ id }) => id), ['one', 'two']);
  assert.deepEqual(groups.closed.map(({ id }) => id), ['three']);
});

test('lit les demandes exclusivement par la RPC administrative', async () => {
  const calls = [];
  const client = { rpc: async (...args) => { calls.push(args); return { data: [{ id: 'one' }], error: null }; } };
  assert.equal((await fetchWithdrawalRequests(client)).length, 1);
  assert.deepEqual(calls, [['admin_list_withdrawal_requests']]);
});

test('transmet une instruction documentee sans mutation de droits ou Stripe', async () => {
  const calls = [];
  const client = { rpc: async (...args) => { calls.push(args); return { data: { id: 'one' }, error: null }; } };
  await updateWithdrawalRequest(client, 'one', 'under_review', ' Instruction documentee et controlee. ');
  assert.deepEqual(calls, [[
    'admin_update_withdrawal_request',
    { p_request_id: 'one', p_status: 'under_review', p_reason: 'Instruction documentee et controlee.' },
  ]]);
  assert.ok(!JSON.stringify(calls).includes('course_access'));
  assert.ok(!JSON.stringify(calls).includes('stripe'));
});

test('refuse cote interface un motif administratif trop court', async () => {
  await assert.rejects(
    updateWithdrawalRequest({ rpc: async () => ({ data: null, error: null }) }, 'one', 'closed', 'Court'),
    /au moins 10 caractères/,
  );
});
