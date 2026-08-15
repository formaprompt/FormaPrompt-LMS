import test from 'node:test';
import assert from 'node:assert/strict';
import { latestAssessmentRun, privacyIdentityMatches } from './privacyAdministration.js';

test('la recherche administrative cible uniquement l email demandé', () => {
  assert.equal(privacyIdentityMatches({ email: 'personne@example.test' }, 'PERSONNE@EXAMPLE'), true);
  assert.equal(privacyIdentityMatches({ email: 'autre@example.test' }, 'personne@example.test'), false);
});

test('une nouvelle analyse ne remplace pas l instantané précédent', () => {
  const assessments = [
    { id: 'old', analysis_run_id: 'run-old', assessed_at: '2026-08-12T08:00:00Z' },
    { id: 'new-1', analysis_run_id: 'run-new', assessed_at: '2026-08-12T09:00:00Z' },
    { id: 'new-2', analysis_run_id: 'run-new', assessed_at: '2026-08-12T09:00:00Z' },
  ];
  assert.deepEqual(latestAssessmentRun(assessments).map(({ id }) => id), ['new-1', 'new-2']);
  assert.equal(assessments.length, 3);
});
