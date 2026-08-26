import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const webappRoot = resolve(testsDirectory, '../../..');
const endpointSource = readFileSync(resolve(testsDirectory, '../submit-withdrawal-request/index.ts'), 'utf8');

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:js|jsx|ts|tsx)$/.test(entry) ? [path] : [];
  });
}

test('enregistre la demande avant de tenter l accusé électronique', () => {
  const insertPosition = endpointSource.search(/\.from\('withdrawal_requests'\)\s*\.insert\(/);
  const emailPosition = endpointSource.indexOf('attemptWithdrawalReceiptDelivery(receipt)');
  assert.ok(insertPosition >= 0 && emailPosition > insertPosition);
});

test('normalise le refus de commande et limite les appels rapprochés', () => {
  assert.match(endpointSource, /La demande ne peut pas être traitée avec les informations fournies/);
  assert.doesNotMatch(endpointSource, /Commande introuvable pour ce compte/);
  assert.match(endpointSource, /recentCount/);
  assert.match(endpointSource, /429/);
});

test('n accepte que la commande B2C Diagnostic payée du propriétaire', () => {
  assert.match(endpointSource, /\.from\('diagnostic_ia_orders'\)/);
  assert.match(endpointSource, /\.eq\('user_id', authData\.user\.id\)/);
  assert.match(endpointSource, /\.eq\('sales_context', 'personal'\)/);
  assert.match(endpointSource, /\.in\('status', \['paid', 'disputed'\]\)/);
  assert.doesNotMatch(endpointSource, /\.from\('course_access'\)/);
});

test('ne journalise ni charge utile ni détail SMTP sensible', () => {
  assert.doesNotMatch(endpointSource, /console\.(?:error|warn)\([^)]*payload/);
  assert.doesNotMatch(endpointSource, /console\.(?:error|warn)\([^)]*deliveryError/);
});

test('aucun secret SMTP n est exposé au code frontend', () => {
  const frontendSources = sourceFiles(join(webappRoot, 'src'));
  for (const file of frontendSources) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /SMTP_PASSWORD|VITE_(?:SMTP|EMAIL)|smtp\.ionos\.fr/i, file);
  }
});
