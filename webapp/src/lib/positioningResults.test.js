import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePositioningDomainResults } from './positioningResults.js';

const questions = [
  {
    id: 'usage',
    domain: 'usages',
    answers: [{ score: 0 }, { score: 2 }],
  },
  {
    id: 'prompt',
    domain: 'formulation',
    answers: [{ score: 0 }, { score: 2 }],
  },
  {
    id: 'verification',
    domain: 'verification',
    answers: [{ score: 0 }, { score: 2 }],
  },
];

const domains = [
  {
    id: 'usages',
    label: 'Usages',
    guidance: [
      { maximumRatio: 0.5, label: 'À découvrir', advice: 'Commencer par les repères.' },
      { maximumRatio: 1, label: 'Déjà structuré', advice: 'Approfondir la méthode.' },
    ],
  },
  {
    id: 'formulation',
    label: 'Formulation',
    guidance: [{ maximumRatio: 1, label: 'À consolider', advice: 'Structurer les demandes.' }],
  },
  {
    id: 'verification',
    label: 'Vérification et sécurité',
    guidance: [{ maximumRatio: 1, label: 'À consolider', advice: 'Appliquer une grille.' }],
  },
];

test('calcule un résultat normalisé et un conseil pour chaque domaine', () => {
  const results = calculatePositioningDomainResults(questions, [
    { question_id: 'usage', score: 2 },
    { question_id: 'prompt', score: 1 },
    { question_id: 'verification', score: 0 },
  ], domains);

  assert.deepEqual(results.map(({ id, score, maximumScore, percentage, level }) => ({
    id,
    score,
    maximumScore,
    percentage,
    level,
  })), [
    { id: 'usages', score: 2, maximumScore: 2, percentage: 100, level: 'Déjà structuré' },
    { id: 'formulation', score: 1, maximumScore: 2, percentage: 50, level: 'À consolider' },
    { id: 'verification', score: 0, maximumScore: 2, percentage: 0, level: 'À consolider' },
  ]);
});

test('ignore un domaine qui ne contient aucune question', () => {
  const results = calculatePositioningDomainResults(questions, [], [
    ...domains,
    { id: 'absent', label: 'Sans question', guidance: [] },
  ]);

  assert.equal(results.length, 3);
});
