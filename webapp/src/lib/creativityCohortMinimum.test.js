import test from 'node:test';
import assert from 'node:assert/strict';
import { setAdminCreativityCohortMinimum } from './courseCohorts.js';
test('transmet uniquement identifiant et seuil au moteur admin existant, sans dates ni inscriptions', async () => {
  const calls = [];
  const client = { functions: { invoke: async (...args) => { calls.push(args); return { data: { result: 'group-id' }, error: null }; } } };
  await setAdminCreativityCohortMinimum(client, 'group-id', 2);
  assert.deepEqual(calls, [['manage-course-cohorts', { body: { action: 'set_minimum_participants', cohort_id: 'group-id', minimum_participants: 2 } }]]);
});
test('restitue le refus serveur de seuil sans annoncer un enregistrement réussi', async () => {
  const client = { functions: { invoke: async () => ({ data: null, error: { context: { json: async () => ({ error: 'Groupe déjà confirmé.' }) } } }) } };
  await assert.rejects(setAdminCreativityCohortMinimum(client, 'group-id', 2), /Groupe déjà confirmé/);
});
