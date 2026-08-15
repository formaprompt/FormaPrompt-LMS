import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const endpoint = readFileSync(resolve('supabase/functions/paid-course-content/index.ts'), 'utf8');
const accessHelper = readFileSync(resolve('supabase/functions/_shared/paidCourseAccess.js'), 'utf8');
const player = readFileSync(resolve('src/pages/CoursePlayer.jsx'), 'utf8');
const publicCatalog = readFileSync(resolve('src/data/courseCatalog.js'), 'utf8');
const admin = readFileSync(resolve('src/pages/AdminDashboard.jsx'), 'utf8');

test('l identité puis course_access sont vérifiés avant toute URL signée', () => {
  const identityCheck = endpoint.indexOf('auth.getUser(token)');
  const accessCheck = endpoint.indexOf(".from('course_access')");
  const accessGuard = endpoint.indexOf('hasUsableCourseAccess(access)');
  const protectedContentDelivery = endpoint.indexOf('signCourseResources(adminClient, courseId, sourceCourse)');
  assert.ok(identityCheck >= 0);
  assert.ok(accessCheck > identityCheck);
  assert.ok(accessGuard > accessCheck);
  assert.ok(protectedContentDelivery > accessGuard);
  assert.doesNotMatch(endpoint, /from\(['"]purchases['"]\)/);
  assert.match(endpoint, /hasUsableCourseAccess\(access\)/);
});

test('les statuts non actifs et les échéances sont refusés dans le helper serveur', () => {
  assert.match(accessHelper, /access\.status !== 'active'/);
  assert.match(accessHelper, /access\.expires_at === null/);
  assert.match(accessHelper, /expiresAt\.getTime\(\) > now\.getTime\(\)/);
  assert.doesNotMatch(accessHelper, /suspension_ends_at.*active|status\s*=\s*['"]active/);
});

test('le lecteur ne décide plus du droit depuis React', () => {
  assert.match(player, /fetchPaidCourseContent\(supabase, id\)/);
  assert.doesNotMatch(player, /fetchActiveCourseAccess|from\(['"]course_access['"]\)/);
  assert.doesNotMatch(player, /from\(['"]purchases['"]\)/);
});

test('le frontend public ne contient plus les leçons ni les URL permanentes', () => {
  assert.doesNotMatch(publicCatalog, /guidedSteps|professionalExample|\/assets\/|videoUrl|glossary/);
  assert.doesNotMatch(admin, /\/assets\/guide-formateur/);
  assert.doesNotMatch(player, /getPublicUrl|createPublicUrl/);
});

test('les supports payants ont quitté public et sont présents dans le seed privé', () => {
  const privateSeed = resolve('supabase/seed/paid-course-content');
  const privateFiles = [
    'formation-ia/resources/guide-pratique-ia-generative-formaprompt.pdf',
    'formation-ia-act/resources/guide-pratique-ia-act-formaprompt.pdf',
    'formation-prompt-level-1/resources/guide-pratique-prompt-engineering-niveau-1-formaprompt.pdf',
    'formation-prompt-level-1/resources/creation-prompt-efficace-chatgpt.pdf',
    'formation-prompt-level-1/resources/Formation IA pour formateur finale 3J.docx',
    'formation-prompt-level-1/videos/FP_-_Capsule_001_-_Rediger_un_bon_prompt_finale_with_captions.mp4',
  ];
  for (const relativePath of privateFiles) assert.equal(existsSync(resolve(privateSeed, relativePath)), true, relativePath);
  assert.equal(existsSync(resolve('public/assets/guide-pratique-ia-generative-formaprompt.pdf')), false);
  assert.equal(existsSync(resolve('public/assets/creation-prompt-efficace-chatgpt.pdf')), false);
  assert.equal(existsSync(resolve('public/assets/Formation IA pour formateur finale 3J.docx')), false);
  assert.equal(existsSync(resolve('vidéo/FP_-_Capsule_001_-_Rédiger_un_bon_prompt_finale_with_captions.mp4')), false);
});

test('aucun secret ni détail de droit n est journalisé', () => {
  assert.doesNotMatch(endpoint, /console\.(?:log|error)\([^)]*(?:token|serviceRoleKey|access|expires_at|user)/s);
  assert.doesNotMatch(endpoint, /SUPABASE_SERVICE_ROLE_KEY[^\n]*(?:jsonResponse|return)/);
});
