import test from 'node:test';
import assert from 'node:assert/strict';
import { isProtectedAccount, isRoleConflictError, isRolePermissionError, setAdminUserRole } from './adminUserRolesApi.js';

test('promotion et rétrogradation utilisent exclusivement la RPC avec le rôle attendu', async () => {
  for (const [expectedRole, role] of [['user', 'admin'], ['admin', 'employee']]) {
    const calls = [];
    const result = { userId: 'fake-id', role, protected: false, changed: true };
    const client = { rpc: async (...args) => { calls.push(args); return { data: result }; } };
    assert.equal(await setAdminUserRole(client, { userId: 'fake-id', role, expectedRole }), result);
    assert.deepEqual(calls, [['admin_set_user_role', { p_user_id: 'fake-id', p_role: role, p_expected_role: expectedRole }]]);
  }
});

test('un rôle inconnu ou une confirmation incohérente est refusé', async () => {
  const client = { rpc: async () => ({ data: { userId: 'fake-id', role: 'user', protected: false, changed: true } }) };
  await assert.rejects(setAdminUserRole(client, { userId: 'fake-id', role: 'trainer', expectedRole: 'user' }), /invalide/);
  await assert.rejects(setAdminUserRole(client, { userId: 'fake-id', role: 'admin', expectedRole: 'user' }), /pas confirmé/);
});

test('les refus serveur ne deviennent jamais des succès', async () => {
  const error = { code: '42501' };
  await assert.rejects(setAdminUserRole({ rpc: async () => ({ error }) }, { userId: 'fake-id', role: 'admin', expectedRole: 'user' }), (received) => received === error);
  assert.equal(isRolePermissionError(error), true);
  assert.equal(isRoleConflictError({ code: '40001' }), true);
  assert.equal(isRoleConflictError({ code: 'PT409' }), true);
});

test('protection serveur faisant autorité ; adresse en secours sans indicateur', () => {
  assert.equal(isProtectedAccount({ email: ' THIERRY227@GMAIL.COM ' }), true);
  assert.equal(isProtectedAccount({ email: 'fake@example.test', protected: true }), true);
  assert.equal(isProtectedAccount({ email: 'thierry227@gmail.com', protected: false }), false);
  assert.equal(isProtectedAccount({ email: 'fake@example.test' }), false);
});
