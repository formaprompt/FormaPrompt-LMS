import test from 'node:test';
import assert from 'node:assert/strict';
import { creativityAccessAction } from './courseCohorts.js';
test('les trois cadeaux créativité évitent une confirmation de paiement fictif', () => {
  for (const course_id of ['ia-creativite-groupe', 'ia-creativite-individuel', 'ia-creativite-ecole-association']) {
    const action = creativityAccessAction({ course_id, access_source: 'gift', purchase_id: null });
    assert.equal(action.path, course_id === 'ia-creativite-groupe' ? '#creativity-group-sessions' : course_id === 'ia-creativite-individuel' ? '/reservation-formation?course=ia-creativite-individuel' : '/contact');
    assert.doesNotMatch(action.path, /paiement|course\//);
  }
});
test('l’individuel payé ouvre ses horaires, groupe et collectif leur preuve de paiement, autres formations inchangées', () => {
  for (const course_id of ['ia-creativite-groupe', 'ia-creativite-individuel', 'ia-creativite-ecole-association']) {
    assert.equal(creativityAccessAction({ course_id, access_source: 'stripe', purchase_id: 'paid-order' }).path, course_id === 'ia-creativite-individuel' ? '/reservation-formation?course=ia-creativite-individuel' : `/paiement-reussi?course=${course_id}`);
  }
  assert.equal(creativityAccessAction({ course_id: 'word-initiation-inter' }), null);
});
