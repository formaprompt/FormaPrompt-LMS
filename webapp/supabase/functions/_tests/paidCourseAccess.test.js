import test from 'node:test';
import assert from 'node:assert/strict';
import {
  courseHasIonVideo,
  hasUsableCourseAccess,
  hasTrainerRole,
  paidResourceObjectPath,
  trainerGuideObjectPath,
  validatePaidCourseId,
} from '../_shared/paidCourseAccess.js';
import {
  excelResourceObjectPath,
  excelResourcesForCourse,
  validateExcelCourseId,
} from '../_shared/excelInitiationResources.js';
import {
  canonicalOfficeCourseId,
  officeResourceObjectPath,
  officeResourcesForCourse,
  validateOfficeCourseId,
} from '../_shared/officeResources.js';

test('seul un course_access active autorise le contenu', () => {
  assert.equal(hasUsableCourseAccess({ status: 'active', expires_at: null }), true);
  for (const status of ['suspended', 'revoked', 'refunded', 'expired']) {
    assert.equal(hasUsableCourseAccess({ status, expires_at: null }), false, status);
  }
});

test('expires_at NULL signifie seulement absence d échéance prédéfinie', () => {
  const now = new Date('2026-08-15T10:00:00.000Z');
  assert.equal(hasUsableCourseAccess({ status: 'active', expires_at: null }, now), true);
  assert.equal(hasUsableCourseAccess({ status: 'active', expires_at: '2026-08-15T09:59:59.000Z' }, now), false);
  assert.equal(hasUsableCourseAccess({ status: 'active', expires_at: '2026-08-15T10:00:01.000Z' }, now), true);
});

test('une fin de suspension ne réactive jamais le droit', () => {
  assert.equal(hasUsableCourseAccess({
    status: 'suspended',
    expires_at: null,
    suspension_ends_at: '2026-08-01T00:00:00.000Z',
  }, new Date('2026-08-15T10:00:00.000Z')), false);
});

test('les identifiants de formation sont limités au catalogue payant', () => {
  assert.equal(validatePaidCourseId('formation-ia'), 'formation-ia');
  assert.throws(() => validatePaidCourseId('../public'), /invalide/i);
});

test('les chemins Storage sont construits sans traversée', () => {
  assert.equal(
    paidResourceObjectPath('formation-ia', '/assets/guide-pratique-ia-generative-formaprompt.pdf'),
    'formation-ia/resources/guide-pratique-ia-generative-formaprompt.pdf',
  );
  assert.throws(() => paidResourceObjectPath('formation-ia', '/assets/../secret.pdf'), /invalide/i);
  assert.match(trainerGuideObjectPath('formation-ia-act'), /^formation-ia-act\/trainer\//);
});

test('la vidéo Prompt reste signalée comme média IONOS hors Storage', () => {
  assert.equal(courseHasIonVideo('formation-ia'), false);
  assert.equal(courseHasIonVideo('formation-prompt-level-1'), true);
});

test('les contenus formateur sont réservés aux rôles admin et employee', () => {
  assert.equal(hasTrainerRole('admin'), true);
  assert.equal(hasTrainerRole('employee'), true);
  assert.equal(hasTrainerRole('user'), false);
  assert.equal(hasTrainerRole(undefined), false);
});

test('les ressources Excel sont isolées par niveau, audience et offre exacte', () => {
  for (const level of ['initiation', 'perfectionnement', 'avance']) {
    for (const modality of ['inter', 'individuel']) {
      const courseId = `excel-${level}-${modality}`;
      assert.equal(validateExcelCourseId(courseId), courseId);
      assert.ok(excelResourcesForCourse(courseId, 'learner').length > 0);
      assert.ok(excelResourcesForCourse(courseId, 'trainer').length > 0);
    }
  }
  assert.throws(() => validateExcelCourseId('excel-initiation-intra'), /invalide/i);
  assert.equal(
    excelResourceObjectPath('excel-initiation-inter', 'learner', excelResourcesForCourse('excel-initiation-inter', 'learner')[0]),
    'excel-initiation/apprenants/Exercices_Excel_Initiation_Apprenant.xlsx',
  );
  assert.equal(
    excelResourceObjectPath('excel-avance-individuel', 'trainer', excelResourcesForCourse('excel-avance-individuel', 'trainer')[5]),
    'excel-avance/formateur/Grille_evaluation_cas_final.md',
  );
  assert.throws(() => excelResourcesForCourse('excel-avance-inter', 'apprenants'), /Audience/i);
});

test('les packs Word et PowerPoint sont isolés par formation, offre et audience', () => {
  for (const courseId of ['word-initiation', 'word-perfectionnement', 'powerpoint-initiation']) {
    assert.equal(validateOfficeCourseId(courseId), courseId);
    assert.equal(officeResourcesForCourse(courseId, 'learner').length, 1);
    assert.equal(officeResourcesForCourse(courseId, 'trainer').length, 1);
  }
  assert.equal(
    officeResourceObjectPath(
      'word-initiation',
      'learner',
      officeResourcesForCourse('word-initiation', 'learner')[0],
    ),
    'word-initiation/apprenants/Pack_apprenant_Word_Initiation.zip',
  );
  assert.equal(
    officeResourceObjectPath(
      'powerpoint-initiation',
      'trainer',
      officeResourcesForCourse('powerpoint-initiation', 'trainer')[0],
    ),
    'powerpoint-initiation/formateur/PowerPoint_Initiation_14h_Pack_formateur.zip',
  );
  for (const [alias, canonical] of [
    ['word-initiation-inter', 'word-initiation'],
    ['word-initiation-individuel', 'word-initiation'],
    ['word-perfectionnement-inter', 'word-perfectionnement'],
    ['word-perfectionnement-individuel', 'word-perfectionnement'],
    ['powerpoint-initiation-inter', 'powerpoint-initiation'],
    ['powerpoint-initiation-individuel', 'powerpoint-initiation'],
  ]) {
    assert.equal(validateOfficeCourseId(alias), alias);
    assert.equal(canonicalOfficeCourseId(alias), canonical);
    assert.equal(
      officeResourceObjectPath(alias, 'learner', officeResourcesForCourse(alias, 'learner')[0]),
      officeResourceObjectPath(canonical, 'learner', officeResourcesForCourse(canonical, 'learner')[0]),
    );
  }
  assert.throws(() => validateOfficeCourseId('word-initiation-intra'), /invalide/i);
  assert.throws(() => validateOfficeCourseId('powerpoint-perfectionnement-inter'), /invalide/i);
  assert.throws(() => officeResourcesForCourse('word-initiation', 'formateur'), /Audience/i);
});
