import test from 'node:test';
import assert from 'node:assert/strict';
import { canFinishAttempt, challengeError, challengeThemes, completedAttempts, openAttempt, trainingEndError, trainingEndStatus } from './aiActChallenge.js';

const questions = Array.from({ length:12 },(_,i) => ({ code:`Q${String(i+1).padStart(2,'0')}`,theme:'Exemple',options:[{code:'A'},{code:'B'},{code:'C'}] }));
const attempt = { status:'in_progress', answers:Object.fromEntries(questions.map((q) => [q.code,'A'])) };
test('la clôture exige douze réponses valides acquittées, aucune opération en attente', () => {
  assert.equal(canFinishAttempt(attempt,questions),true);
  assert.equal(canFinishAttempt(attempt,questions,true),false);
  assert.equal(canFinishAttempt({...attempt,answers:{...attempt.answers,Q01:'D'}},questions),false);
  assert.equal(canFinishAttempt({...attempt,status:'passed'},questions),false);
  assert.equal(canFinishAttempt(attempt,questions.slice(1)),false);
});
test('les erreurs de concurrence imposent recharge et les accès refusés sont distincts', () => {
  assert.equal(challengeError({message:'REVISION_CONFLICT'}).conflict,true);
  assert.equal(challengeError({message:'ACCESS_DENIED'}).denied,true);
  assert.equal(challengeError({message:'network'}).conflict,undefined);
});
test('la présentation sépare tentative ouverte et historique terminé', () => {
  const state = { attempts:[{id:'closed',status:'passed'},{id:'open',status:'in_progress'}] };
  assert.equal(openAttempt(state).id,'open');
  assert.deepEqual(completedAttempts(state).map((a) => a.id),['closed']);
});
test('les thèmes suivent les résultats serveur, sans supposer une bonne lettre', () => {
  assert.deepEqual(challengeThemes({results:[{question_code:'Q01',is_correct:true},{question_code:'Q02',is_correct:false}]},questions),[{theme:'Exemple',correct:1,total:2}]);
});

test('fin pédagogique : statut et erreurs séparent déclaration, preuve et concurrence', () => {
  assert.equal(trainingEndStatus('declared'),'Fin déclarée · vérification en attente');
  assert.equal(trainingEndError(new Error('ALREADY_VERIFIED')).conflict,true);
  assert.equal(trainingEndError(new Error('REQUEST_ID_REUSED')).conflict,true);
  assert.match(trainingEndError(new Error('EVIDENCE_NOT_VALID')).text,/justificatif/);
  assert.match(trainingEndError(new Error('TRAINING_NOT_CLOSED')).text,/encore actif/);
});
