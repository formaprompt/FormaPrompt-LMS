import test from 'node:test';
import assert from 'node:assert/strict';
import { ISSUED_ATTESTATION_ERROR, startIssuedAttestationRequest } from './issuedAttestationRequest.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const pending = deferred();
  const calls = [];
  const query = {
    select: value => { calls.push(['select', value]); return query; },
    eq: (...args) => { calls.push(['eq', ...args]); return query; },
    maybeSingle: () => { calls.push(['maybeSingle']); return pending.promise; },
  };
  return { pending, calls, client: { from: table => { calls.push(['from', table]); return query; } } };
}
const document = (owner, type = 'realisation') => Object.freeze({
  id: '77', reference: 'FP-REA-2026-FICTIF00', user_id: owner,
  course_id: 'formation-prompt-level-1', document_type: type,
  content_snapshot: Object.freeze({ learnerName: `FICTIF ${owner}`, objectives: ['Objectif historique fictif'] }),
  issued_at: '2026-07-01T15:00:00Z',
});

test('reader keeps the exact authenticated SELECT, document filter and server authorization boundary', async () => {
  const f = fixture(), events = [];
  const request = startIssuedAttestationRequest(f.client, '77', result => events.push(result));
  f.pending.resolve({ data: document('learner'), error: null }); await request.settled;
  assert.deepEqual(f.calls, [
    ['from', 'course_attestation_issuances'],
    ['select', 'id, reference, user_id, course_id, document_type, content_snapshot, issued_at'],
    ['eq', 'id', '77'], ['maybeSingle'],
  ]);
  assert.equal(events.length, 1);
});
for (const type of ['realisation', 'competences']) test(`reader preserves historical ${type} snapshot and metadata unchanged`, async () => {
  const f = fixture(), row = document('learner', type), events = [];
  const request = startIssuedAttestationRequest(f.client, '77', result => events.push(result));
  f.pending.resolve({ data: row, error: null }); await request.settled;
  assert.equal(events[0].issuance, row); assert.equal(events[0].error, '');
});
test('reader does not replace staff cross-owner authorization with a client owner filter', async () => {
  const f = fixture(), events = [];
  const request = startIssuedAttestationRequest(f.client, '77', result => events.push(result));
  f.pending.resolve({ data: document('other-authorized-learner'), error: null }); await request.settled;
  assert.equal(events[0].issuance.user_id, 'other-authorized-learner');
  assert.deepEqual(f.calls.filter(([name]) => name === 'eq'), [['eq', 'id', '77']]);
});
for (const response of [{ data: null, error: null }, { data: document('A'), error: { message: 'fixture denial' } }]) {
  test(`reader clears issuance for ${response.error ? 'query denial' : 'missing document'}`, async () => {
    const f = fixture(), events = [];
    const request = startIssuedAttestationRequest(f.client, '77', result => events.push(result));
    f.pending.resolve(response); await request.settled;
    assert.deepEqual(events, [{ issuance: null, error: ISSUED_ATTESTATION_ERROR }]);
  });
}
test('reader converts a rejected promise into a neutral terminal error', async () => {
  const f = fixture(), events = [];
  const request = startIssuedAttestationRequest(f.client, '77', result => events.push(result));
  f.pending.reject(new Error('fixture transport detail')); await request.settled;
  assert.deepEqual(events, [{ issuance: null, error: ISSUED_ATTESTATION_ERROR }]);
});
test('reader catches a synchronous query failure without leaking details', async () => {
  const events = [];
  const request = startIssuedAttestationRequest({ from() { throw new Error('fixture detail'); } }, '77', result => events.push(result));
  await request.settled;
  assert.deepEqual(events, [{ issuance: null, error: ISSUED_ATTESTATION_ERROR }]);
});
test('cancel/unmount suppresses a late successful result', async () => {
  const f = fixture(), events = [];
  const request = startIssuedAttestationRequest(f.client, '77', result => events.push(result));
  request.cancel(); request.cancel();
  f.pending.resolve({ data: document('A'), error: null }); await request.settled;
  assert.deepEqual(events, []);
});
for (const reject of [false, true]) test(`cancel/unmount suppresses late ${reject ? 'promise rejection' : 'query error'}`, async () => {
  const f = fixture(), events = [];
  const request = startIssuedAttestationRequest(f.client, '77', result => events.push(result));
  request.cancel();
  if (reject) f.pending.reject(new Error('late fixture error'));
  else f.pending.resolve({ data: null, error: { message: 'late fixture error' } });
  await request.settled; assert.deepEqual(events, []);
});
test('A result arriving while B is pending cannot publish into the replacement view', async () => {
  const a = fixture(), b = fixture(), events = [];
  const old = startIssuedAttestationRequest(a.client, '77', result => events.push(['A', result]));
  old.cancel();
  const current = startIssuedAttestationRequest(b.client, '77', result => events.push(['B', result]));
  a.pending.resolve({ data: document('A'), error: null }); await old.settled;
  assert.deepEqual(events, []);
  b.pending.resolve({ data: document('B'), error: null }); await current.settled;
  assert.deepEqual(events.map(([owner, value]) => [owner, value.issuance.user_id]), [['B', 'B']]);
});
test('out-of-order old success cannot replace a newer document', async () => {
  const a = fixture(), b = fixture(), events = [];
  const old = startIssuedAttestationRequest(a.client, '77', value => events.push(value)); old.cancel();
  const current = startIssuedAttestationRequest(b.client, '88', value => events.push(value));
  b.pending.resolve({ data: { ...document('B'), id: '88' }, error: null }); await current.settled;
  a.pending.resolve({ data: document('A'), error: null }); await old.settled;
  assert.equal(events.length, 1); assert.equal(events[0].issuance.id, '88');
});
test('late old error cannot replace a newer successful document', async () => {
  const a = fixture(), b = fixture(), events = [];
  const old = startIssuedAttestationRequest(a.client, '77', value => events.push(value)); old.cancel();
  const current = startIssuedAttestationRequest(b.client, '88', value => events.push(value));
  b.pending.resolve({ data: document('B'), error: null }); await current.settled;
  a.pending.reject(new Error('late A')); await old.settled;
  assert.equal(events.length, 1); assert.equal(events[0].issuance.user_id, 'B'); assert.equal(events[0].error, '');
});
test('rapid A -> B -> A still requires the last generation, not just a matching owner', async () => {
  const first = fixture(), second = fixture(), last = fixture(), events = [];
  const a1 = startIssuedAttestationRequest(first.client, '77', value => events.push(['A1', value])); a1.cancel();
  const b = startIssuedAttestationRequest(second.client, '77', value => events.push(['B', value])); b.cancel();
  const a2 = startIssuedAttestationRequest(last.client, '77', value => events.push(['A2', value]));
  first.pending.resolve({ data: document('A'), error: null }); second.pending.reject(new Error('old B'));
  await Promise.all([a1.settled, b.settled]); assert.deepEqual(events, []);
  last.pending.resolve({ data: document('A'), error: null }); await a2.settled;
  assert.deepEqual(events.map(([generation]) => generation), ['A2']);
});
test('effect setup -> cleanup -> setup uses independent cancellation scopes', async () => {
  const first = fixture(), second = fixture(), events = [];
  const initial = startIssuedAttestationRequest(first.client, '77', value => events.push(value)); initial.cancel();
  const replay = startIssuedAttestationRequest(second.client, '77', value => events.push(value));
  first.pending.resolve({ data: document('old'), error: null }); second.pending.resolve({ data: document('new'), error: null });
  await Promise.all([initial.settled, replay.settled]);
  assert.equal(events.length, 1); assert.equal(events[0].issuance.user_id, 'new');
});
