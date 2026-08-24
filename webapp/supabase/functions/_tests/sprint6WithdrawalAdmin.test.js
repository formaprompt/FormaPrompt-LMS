import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const directory = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(resolve(directory, '../../migrations/20260824102546_sprint_6_withdrawal_admin.sql'), 'utf8');

test('ne cree aucune table et reutilise withdrawal_requests', () => {
  assert.doesNotMatch(migration, /CREATE TABLE/);
  assert.match(migration, /RETURNS SETOF public\.withdrawal_requests/);
  assert.match(migration, /RETURNS public\.withdrawal_requests/);
});

test('reserve les deux RPC a l administrateur strict', () => {
  assert.match(migration, /private\.is_strict_admin\(\)/g);
  assert.match(migration, /SECURITY DEFINER\s+SET search_path = ''/g);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_list_withdrawal_requests\(\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_update_withdrawal_request\(uuid, text, text\)[\s\S]*TO authenticated/);
});

test('verrouille la demande, exige le motif et audite uniquement le suivi utile', () => {
  assert.match(migration, /WHERE id = p_request_id\s+FOR UPDATE/);
  assert.match(migration, /char_length\(v_reason\) NOT BETWEEN 10 AND 2000/);
  assert.match(migration, /INSERT INTO public\.audit_log/);
  assert.doesNotMatch(migration, /claimant_first_name|claimant_last_name|acknowledgement_email|declaration/);
});

test('ne touche jamais aux droits, achats, paiements ou remboursements', () => {
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:course_access|purchases|stripe_[a-z_]+)/);
  assert.doesNotMatch(migration, /refund|payment_intent|checkout\.sessions|net\.http|functions\.invoke/i);
});
