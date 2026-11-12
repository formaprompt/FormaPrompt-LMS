import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  buildAdministrativeDocument,
  validateAdministrativeEnrollment,
  validateEnrollmentException,
} from '../_shared/trainingAdministration.js';

const source = readFileSync(new URL('../admin-manage-enrollment/index.ts', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '');
const code = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });

function fixture({ completionError, role = 'employee', completed = false, concurrentEdit = false } = {}) {
  const dossier = {
    id: 'dossier-fixture', course_id: 'formation-ia-act', status: completed ? 'completed' : 'validated',
    completed_at: completed ? '2026-10-15T13:00:00.000Z' : null, updated_at: '2026-10-15T15:00:00.000Z',
    user_id: 'learner-fixture', learner_first_name: 'Camille', learner_last_name: 'Exemple',
    profiles: { email: 'learner@example.test' },
  };
  const calls = [];
  const writes = [];
  let handler;
  const auth = { auth: { getUser: async () => ({ data: { user: { id: 'staff-fixture' } } }) } };
  const service = {
    from(table) {
      assert.ok(['profiles', 'training_enrollments'].includes(table));
      const filters = [];
      let changes;
      const result = () => ({
        data: table === 'profiles' ? { id: 'staff-fixture', role }
          : changes && concurrentEdit ? null : dossier,
      });
      const query = {
        select: () => query,
        eq: (column, value) => { filters.push([column, value]); return query; },
        update: (payload) => { changes = payload; writes.push({ table, filters }); return query; },
        maybeSingle: async () => result(),
        single: async () => result(),
      };
      return query;
    },
    rpc(name, args) {
      calls.push({ name, args });
      return { single: async () => ({
        data: completionError ? null : { ...dossier, status: 'completed' },
        error: completionError,
      }) };
    },
  };
  const env = { SUPABASE_ANON_KEY: 'fixture-public', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' };
  new Function('Deno', 'createClient', 'corsHeaders', 'jsonResponse', 'buildAdministrativeDocument',
    'validateAdministrativeEnrollment', 'validateEnrollmentException', 'console', code)(
    { env: { get: (name) => env[name] || 'https://fixture.invalid' }, serve: (fn) => { handler = fn; } },
    (_url, key) => key === 'fixture-service' ? service : auth,
    {},
    (value, status = 200) => new Response(JSON.stringify(value), { status }),
    buildAdministrativeDocument,
    validateAdministrativeEnrollment,
    validateEnrollmentException,
    { error() {} },
  );
  return {
    calls, dossier, writes,
    send: (action = 'complete_enrollment', extra = {}) => handler(new Request('https://fixture.invalid', {
      method: 'POST', headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, enrollmentId: dossier.id, ...extra }),
    })),
  };
}

test('the Edge handler delegates completion to one transactional RPC with the original completion date on retry', async () => {
  for (const completed of [false, true]) {
    const { calls, dossier, send } = fixture({ completed });
    assert.equal((await send()).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'complete_training_enrollment');
    const args = calls[0].args;
    assert.equal(args.p_actor_id, 'staff-fixture');
    assert.equal(args.p_enrollment_id, dossier.id);
    assert.equal(args.p_expected_updated_at, dossier.updated_at);
    assert.equal(args.p_certificate.enrollment.status, 'completed');
    assert.equal(args.p_certificate.completion.completedAt, completed ? dossier.completed_at : args.p_generated_at);
  }
});

test('the Edge handler rejects non-staff and returns an actionable conflict after a concurrent dossier edit', async () => {
  const denied = fixture({ role: 'user' });
  assert.equal((await denied.send()).status, 403);
  assert.equal(denied.calls.length, 0);
  const stale = fixture({ completionError: { message: 'ENROLLMENT_COMPLETION_STALE' } });
  const response = await stale.send();
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /Réessayez la clôture/);
  assert.equal(stale.calls.length, 1);
});

test('a stale form or lifecycle update returns conflict before writing documents or history', async () => {
  const { dossier, send, writes } = fixture({ concurrentEdit: true });
  const updates = [
    ['update_enrollment', { enrollment: {
      courseId: dossier.course_id, targetUserId: dossier.user_id, learnerEmail: dossier.profiles.email,
      learnerFirstName: 'Camille', learnerLastName: 'Exemple', enrollmentSource: 'manual', fundingMode: 'free',
      deliveryMode: 'remote', startsAt: '2026-10-15T13:00:00Z', endsAt: '2026-10-15T17:00:00Z',
      updateReason: 'Changement de date',
    } }],
    ['cancel_enrollment', { exception: { reason: 'Annulation de test', actorLabel: 'Formateur' } }],
  ];
  for (const [action, extra] of updates) {
    const response = await send(action, extra);
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /Le dossier a changé/);
  }
  assert.deepEqual(writes, Array.from({ length: 2 }, () => ({
    table: 'training_enrollments',
    filters: [['id', dossier.id], ['status', dossier.status], ['updated_at', dossier.updated_at]],
  })));
});
