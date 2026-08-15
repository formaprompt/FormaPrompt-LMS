import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const endpointSource = readFileSync(resolve(testsDirectory, '../admin-process-privacy-request/index.ts'), 'utf8');

test('réserve le traitement au rôle admin et utilise une suppression Auth douce', () => {
  assert.match(endpointSource, /actor\.role !== 'admin'/);
  assert.match(endpointSource, /deleteUser\(authAction\.subject_user_id, true\)/);
  assert.doesNotMatch(endpointSource, /deleteUser\([^,]+, false\)/);
});

test('exécute le plan SQL avant toute action irréversible Auth', () => {
  const databaseExecution = endpointSource.indexOf("rpc('admin_execute_privacy_request'");
  const authDeletion = endpointSource.indexOf('auth.admin.deleteUser');
  assert.ok(databaseExecution >= 0 && authDeletion > databaseExecution);
});

test('ne journalise ni motif, ni confirmation, ni jeton', () => {
  assert.doesNotMatch(endpointSource, /console\.(?:info|error|warn)\([^)]*(?:confirmation|reason|accessToken)/s);
  assert.doesNotMatch(endpointSource, /SUPABASE_SERVICE_ROLE_KEY[^;]*console/);
});

test('prévoit une reprise idempotente et journalise un code d échec minimal', () => {
  assert.match(endpointSource, /authAction\.auth_already_deleted/);
  assert.match(endpointSource, /auth_soft_delete_failed/);
  assert.match(endpointSource, /admin_record_privacy_external_failure/);
});
