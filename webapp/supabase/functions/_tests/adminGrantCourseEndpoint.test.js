// Edge control-flow tests only. SQL/RLS/concurrency require separate real PostgreSQL acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ADMIN_GIFT_COURSES } from '../_shared/purchaseConfig.js';
const IAG = 'formation-ia-generative-elearning';
const source = readFileSync(new URL('../admin-grant-course/index.ts', import.meta.url), 'utf8');
const annotation = 'function requiredEnv(name: string)';
assert.equal(source.split(annotation).length, 2, 'One known TS annotation only; otherwise inspect the source before adapting this fixture.');
const code = source.replace(/^import[^\n]*\n/gm, '').replace(annotation, 'function requiredEnv(name)');
function fixture({ role = 'admin', validSession = true, existing = null, missingLearner = false, grantError = null } = {}) {
  let handler;
  const trace = { clients: [], reads: [], rpc: [] };
  const values = { SUPABASE_URL: 'https://fixture.invalid', SUPABASE_ANON_KEY: 'fixture-public', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' };
  const authClient = {
    auth: { getUser: async token => ({ data: { user: validSession && token === 'fixture-token' ? { id: 'actor', user_metadata: { role: 'admin' } } : null }, error: null }) },
    rpc: async (name, args) => {
      trace.rpc.push({ name, args, client: 'actor-authenticated' });
      return { data: grantError ? null : existing || { id: 'gift-fixture', user_id: args.p_target_user_id, course_id: args.p_course_id, status: 'active', access_source: 'gift', purchase_id: null, expires_at: null }, error: grantError };
    },
  };
  const serviceClient = { from(table) {
    const filters = []; trace.reads.push({ table, filters });
    const query = { select: () => query, eq: (key, value) => { filters.push([key, value]); return query; },
      maybeSingle: async () => ({ error: null, data: table === 'profiles'
        ? filters.some(([key, value]) => key === 'id' && value === 'actor') ? { id: 'actor', role } : missingLearner ? null : { id: 'learner' }
        : existing }) };
    return query;
  } };
  vm.runInNewContext(code, { Request, Response, Date, Set, console: { info() {}, error() {} }, ADMIN_GIFT_COURSES,
    corsHeaders: {}, jsonResponse: (value, status = 200) => new Response(JSON.stringify(value), { status }),
    Deno: { env: { get: key => values[key] }, serve: value => { handler = value; } },
    createClient: (url, key, options) => { trace.clients.push({ url, key, options }); return key === 'fixture-service' ? serviceClient : authClient; },
  });
  return { trace, send: (courseId = IAG, { token = 'fixture-token', method = 'POST' } = {}) => handler(new Request('https://fixture.invalid', {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify({ targetUserId: 'learner', courseId, role: 'admin' }) } : {}),
  })) };
}
test('gift Edge refuses anonymous and invalid sessions without an attribution RPC', async () => {
  const anonymous = fixture(); assert.equal((await anonymous.send(IAG, { token: null })).status, 401); assert.equal(anonymous.trace.rpc.length, 0);
  const invalid = fixture({ validSession: false }); assert.equal((await invalid.send()).status, 401); assert.equal(invalid.trace.rpc.length, 0);
});
for (const role of ['user', 'employee']) test(`gift Edge requires the live profile admin role, not JWT/body claims (${role})`, async () => {
  const f = fixture({ role }); assert.equal((await f.send()).status, 403); assert.equal(f.trace.rpc.length, 0);
});
test('gift Edge refuses an unknown course and a missing learner without an attribution RPC', async () => {
  const unknown = fixture(); assert.equal((await unknown.send('formation-unknown')).status, 400); assert.equal(unknown.trace.clients.length, 0);
  const missing = fixture({ missingLearner: true }); assert.equal((await missing.send()).status, 404); assert.equal(missing.trace.rpc.length, 0);
});
test('gift Edge IAG uses the original actor JWT for the existing RPC, with the exact target and audit reason', async () => {
  const f = fixture(); const response = await f.send(); assert.equal(response.status, 201);
  const data = await response.json(); assert.equal(data.access.course_id, IAG); assert.equal(data.access.status, 'active'); assert.equal(data.access.expires_at, null);
  assert.equal(f.trace.rpc.length, 1); const call = f.trace.rpc[0];
  assert.equal(call.client, 'actor-authenticated'); assert.equal(call.name, 'admin_grant_course_access');
  assert.equal(call.args.p_target_user_id, 'learner'); assert.equal(call.args.p_course_id, IAG);
  assert.equal(call.args.p_reason, 'Attribution administrative depuis FormaPrompt');
  assert.equal(f.trace.clients[0].options.global.headers.Authorization, 'Bearer fixture-token');
  assert.deepEqual(f.trace.reads.find(row => row.table === 'course_access').filters.map(pair => Array.from(pair)), [['user_id', 'learner'], ['course_id', IAG]]);
  assert.equal(f.trace.reads.some(row => row.table === 'purchases'), false);
});
test('gift Edge preserves the RPC and exact course target for all 18 historical offers', async () => {
  const ids = Object.keys(ADMIN_GIFT_COURSES).filter(id => id !== IAG); assert.equal(ids.length, 18);
  for (const id of ids) { const f = fixture(); assert.equal((await f.send(id)).status, 201); assert.equal(f.trace.rpc[0].args.p_course_id, id); }
});
test('gift Edge returns the existing active access unchanged, with no second gift claim', async () => {
  const existing = { id: 'already', status: 'active', access_source: 'stripe', purchase_id: 'purchase-kept', expires_at: '2099-01-01T00:00:00Z' };
  const f = fixture({ existing }); const response = await f.send(); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.granted, false); assert.equal(result.alreadyGranted, true); assert.deepEqual(result.access, existing);
});
for (const status of ['suspended', 'refunded', 'revoked', 'expired']) test(`gift Edge propagates SQL lifecycle refusal for ${status}`, async () => {
  const f = fixture({ existing: { id: 'inactive', status, expires_at: null }, grantError: { message: 'Un droit existe déjà. Utilisez une décision explicite de cycle de vie.' } });
  const response = await f.send(); assert.equal(response.status, 409); assert.equal((await response.json()).access, undefined); assert.equal(f.trace.rpc.length, 1);
});
test('gift Edge does not treat a past expiry as an active access or claim a reactivation', async () => {
  const f = fixture({ existing: { id: 'old', status: 'active', expires_at: '2020-01-01T00:00:00Z' }, grantError: { message: 'Un droit existe déjà. Utilisez une décision explicite de cycle de vie.' } });
  assert.equal((await f.send()).status, 409);
});
