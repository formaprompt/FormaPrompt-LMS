import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCommercialRequests, formatMoney } from './commercialAdministration.js';

test('filtre les demandes par statut et contenu sans tenir compte de la casse', () => {
  const requests = [
    { id: '1', status: 'new', name: 'Alice Martin', email: 'alice@example.test', subject: 'Devis' },
    { id: '2', status: 'won', name: 'Entreprise Z', email: 'contact@z.test', subject: 'IA Act' },
  ];
  assert.deepEqual(filterCommercialRequests(requests, 'ALICE', 'new').map(({ id }) => id), ['1']);
  assert.deepEqual(filterCommercialRequests(requests, '', 'won').map(({ id }) => id), ['2']);
});

test('formate un montant en centimes', () => {
  assert.match(formatMoney(49700), /497[\s\u00a0]€|497,00/);
});
