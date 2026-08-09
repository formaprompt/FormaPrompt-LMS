import test from 'node:test';
import assert from 'node:assert/strict';
import { keepOwnVisibleAdministrativeDocuments } from './administrativeDocuments.js';

test("ne conserve que les documents visibles appartenant à l'apprenant connecté", () => {
  const documents = [
    { id: 'own-visible', user_id: 'learner-a', visible_to_learner: true },
    { id: 'own-private', user_id: 'learner-a', visible_to_learner: false },
    { id: 'foreign-visible', user_id: 'learner-b', visible_to_learner: true },
  ];

  assert.deepEqual(
    keepOwnVisibleAdministrativeDocuments(documents, 'learner-a').map(({ id }) => id),
    ['own-visible'],
  );
});

test('renvoie une liste vide sans compte connecté', () => {
  assert.deepEqual(keepOwnVisibleAdministrativeDocuments([], ''), []);
});
