import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accessAuditSentence,
  buildAdministrativeIdentityMap,
  createAccessActionTarget,
  filterAdministrativeAccesses,
  isAccessActionTargetConsistent,
} from './accessAdministration.js';

const profiles = [
  { id: 'user-a', email: 'thierry227@gmail.com', role: 'admin' },
  { id: 'user-b', email: 'thierry270363@gmail.com', role: 'user' },
];
const accesses = [
  { id: 'access-a', user_id: 'user-a', course_id: 'formation-ia', status: 'active' },
  { id: 'access-b', user_id: 'user-b', course_id: 'formation-ia', status: 'active' },
];
const courseLabels = { 'formation-ia': 'Formation IA générative' };
const statusLabels = { active: 'Actif', revoked: 'Révoqué' };

test('identifie aussi un administrateur possédant un accès apprenant', () => {
  const identities = buildAdministrativeIdentityMap(
    profiles,
    [{ user_id: 'user-b', learner_first_name: 'Thierry', learner_last_name: 'Frezard' }],
    [{ user_id: 'user-a', learner_name: 'Thierry FREZARD' }],
  );

  assert.deepEqual(identities.get('user-a'), {
    userId: 'user-a',
    fullName: 'Thierry FREZARD',
    email: 'thierry227@gmail.com',
    role: 'admin',
  });
  assert.equal(identities.get('user-b').email, 'thierry270363@gmail.com');
});

test('une recherche exacte ne conserve que le compte demandé', () => {
  const identities = buildAdministrativeIdentityMap(profiles);
  assert.deepEqual(
    filterAdministrativeAccesses(accesses, identities, 'thierry270363@gmail.com', courseLabels, statusLabels)
      .map(({ id }) => id),
    ['access-b'],
  );
  assert.deepEqual(
    filterAdministrativeAccesses(accesses, identities, 'thierry227@gmail.com', courseLabels, statusLabels)
      .map(({ id }) => id),
    ['access-a'],
  );
});

test('une action conserve les trois identifiants stables de la cible', () => {
  const target = createAccessActionTarget('revoke', accesses[1]);
  assert.equal(isAccessActionTargetConsistent(target, accesses[1]), true);
  assert.equal(isAccessActionTargetConsistent(target, accesses[0]), false);
  assert.deepEqual(target, {
    type: 'revoke',
    accessId: 'access-b',
    expectedUserId: 'user-b',
    expectedCourseId: 'formation-ia',
  });
});

test('distingue la restauration d’une révocation de la réactivation après suspension', () => {
  assert.match(accessAuditSentence('access_reactivated', 'Formation IA'), /après suspension/);
  assert.match(accessAuditSentence('access_restored', 'Formation IA'), /après révocation/);
});
