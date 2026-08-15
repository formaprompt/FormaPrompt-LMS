import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const webappRoot = resolve(testsDirectory, '../../..');
const endpointSource = readFileSync(resolve(testsDirectory, '../admin-disciplinary-files/index.ts'), 'utf8');
const migrationSource = readFileSync(
  resolve(webappRoot, 'supabase/migrations/20260814143000_add_private_disciplinary_files.sql'),
  'utf8',
);

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:js|jsx|ts|tsx)$/.test(entry) ? [path] : [];
  });
}

test('réserve toutes les actions au rôle admin vérifié côté serveur', () => {
  assert.match(endpointSource, /auth\.getUser\(accessToken\)/);
  assert.match(endpointSource, /actor\.role !== 'admin'/);
  assert.match(endpointSource, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('ne crée jamais d URL publique ou permanente', () => {
  assert.match(endpointSource, /createSignedUrl/);
  assert.match(endpointSource, /signedUrlLifetime/);
  assert.doesNotMatch(endpointSource, /createPublicUrl|getPublicUrl|publicURL/i);
});

test('journalise dépôt, liste et délivrance d URL signée sans journaliser l URL', () => {
  assert.match(migrationSource, /disciplinary_file_uploaded/);
  assert.match(endpointSource, /disciplinary_files_listed/);
  assert.match(endpointSource, /disciplinary_file_signed_url_created/);
  assert.doesNotMatch(endpointSource, /console\.(?:info|error|warn)\([^)]*signedUrl/s);
});

test('nettoie le fichier Storage si les métadonnées ne peuvent pas être enregistrées', () => {
  const insertPosition = endpointSource.indexOf("rpc('register_disciplinary_file'");
  const cleanupPosition = endpointSource.indexOf('.remove([objectPath])');
  assert.ok(insertPosition >= 0 && cleanupPosition > insertPosition);
});

test('enregistre métadonnées et audit de dépôt dans une transaction SQL unique', () => {
  assert.match(endpointSource, /rpc\('register_disciplinary_file'/);
  assert.doesNotMatch(endpointSource, /disciplinary_file_uploaded[^]*await audit/);
});

test('ne touche jamais aux droits pédagogiques', () => {
  assert.doesNotMatch(endpointSource, /course_access|admin_change_course_access/);
});

test('aucun chemin de bucket disciplinaire n est exposé dans React', () => {
  for (const file of sourceFiles(join(webappRoot, 'src'))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /disciplinary-evidence|disciplinary_files/, file);
  }
});
