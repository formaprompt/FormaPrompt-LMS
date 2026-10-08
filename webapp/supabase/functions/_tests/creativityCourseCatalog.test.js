import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creativityCourseCatalog } from '../_shared/creativityCourseCatalog.js';

const ids = ['ia-creativite-individuel', 'ia-creativite-groupe', 'ia-creativite-ecole-association'];
const forbidden = /Training Lab|espace apprenant|Commencer un brouillon|Nouvelle tentative|dépôt dans l’espace|joindre un fichier|téléverser|trainer-guide|questionnaire préalable/iu;

test('le catalogue expose exactement les trois formules de créativité', () => {
  assert.deepEqual(Object.keys(creativityCourseCatalog).sort(), [...ids].sort());
  for (const [id, course] of Object.entries(creativityCourseCatalog)) {
    assert.equal(course.initialPositioningRequired, false, id);
    assert.equal(course.durationLabel, '14 heures accompagnées · 2 journées ou 4 demi-journées (pauses en supplément)', id);
    assert.equal(course.landingPath, '/formation-ia-creativite#inscription', id);
    assert.equal(course.modules.length, 4, id);
    assert.deepEqual(course.modules.map(({ duration }) => duration), ['3 h 30', '3 h 30', '3 h 30', '3 h 30']);
    assert.equal(course.exercises.length, 6, id);
    assert.deepEqual(course.exercises.map(({ id: exerciseId }) => exerciseId), [1, 2, 3, 4, 5, 6]);
  }
});

test('les activités et le projet conservent le schéma du lecteur de cours', () => {
  const course = creativityCourseCatalog[ids[0]];
  for (const module of course.modules) {
    assert.ok(module.number >= 1 && module.number <= 4);
    assert.ok(module.goals.length && module.keyPoints.length);
    assert.ok(Array.isArray(module.lesson.introduction));
  }
  for (const exercise of course.exercises) {
    for (const field of ['title', 'objective', 'instructions', 'howTo', 'successCriteria', 'prompt']) assert.ok(exercise[field], `${exercise.id}:${field}`);
    assert.notDeepEqual(exercise.howTo, exercise.successCriteria, `howTo doit décrire des étapes (${exercise.id})`);
  }
  assert.deepEqual(course.finalProject.submissionFields.map(({ id: fieldId }) => fieldId), ['prompt_and_iterations', 'final_output', 'verification_grid_reference', 'action_plan']);
  assert.deepEqual(course.finalProject.rubric.map(({ id: rubricId }) => rubricId), ['need_and_audience', 'prompt_and_success_criteria', 'checks_and_risks', 'choices_and_limits']);
});

test('les ressources sont apprenant, sans procédure Lab ni contenu formateur', () => {
  const course = creativityCourseCatalog[ids[0]];
  assert.deepEqual(course.resources, []);
  assert.deepEqual(course.glossary, []);
  assert.equal(course.textResources.length, 5);
  assert.ok(course.textResources.every(({ id, title, markdown }) => id && title && markdown));
  const text = JSON.stringify(course);
  assert.equal(forbidden.test(text), false);
});

