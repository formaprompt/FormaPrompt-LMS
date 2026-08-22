import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve('supabase/functions/admin-manage-enrollment/index.ts'), 'utf8');

test('les mutations Sprint 4 restent derrière authentification du personnel', () => {
  assert.match(source, /auth\.getUser\(accessToken\)/);
  assert.match(source, /\['admin', 'employee'\]\.includes\(actor\.role\)/);
  for (const action of ['update_funding', 'cancel_enrollment', 'postpone_enrollment', 'transfer_beneficiary', 'abandon_enrollment', 'create_amendment']) {
    assert.match(source, new RegExp(action));
  }
});

test('les exceptions ne mutent jamais purchases ou course_access', () => {
  const start = source.indexOf("['update_funding'");
  const end = source.indexOf("if (action === 'regenerate_document')");
  const sprint4Block = source.slice(start, end);
  assert.doesNotMatch(sprint4Block, /from\('purchases'\)/);
  assert.doesNotMatch(sprint4Block, /from\('course_access'\)/);
  assert.match(sprint4Block, /rightsChanged: false/);
});

test('un transfert dissocie le lien ancien sans transférer le droit', () => {
  assert.match(source, /course_access_id: null/);
  const sprint4Block = source.slice(source.indexOf("['update_funding'"), source.indexOf("if (action === 'regenerate_document')"));
  assert.doesNotMatch(sprint4Block, /from\('course_access'\)/);
});

test('un report ou transfert régénère la version courante sans détruire la précédente', () => {
  assert.match(source, /\['postpone_enrollment', 'transfer_beneficiary'\]\.includes\(action\)/);
  assert.match(source, /version: Number\(document\.version \|\| 1\) \+ 1/);
  assert.match(source, /buildAdministrativeDocument\(document\.document_type, enrollment/);
});

test('aucun secret ou serveur SMTP n est ajouté au gestionnaire', () => {
  assert.doesNotMatch(source, /SMTP_PASSWORD\s*=|smtp\.ionos\.fr|SUPABASE_SERVICE_ROLE_KEY\s*=/);
});
