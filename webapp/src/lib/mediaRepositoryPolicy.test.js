import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repository = fileURLToPath(new URL('../../../', import.meta.url));

function assertNoTrackedMp4(paths) {
  assert.deepEqual(paths.filter(path => /\.mp4$/i.test(path)), [], 'Les vidéos MP4 doivent rester hors du dépôt');
}

test('aucun MP4 n’est suivi dans l’index Git, quelle que soit sa casse', () => {
  const tracked = execFileSync('git', ['ls-files', '--cached', '-z'], { cwd: repository, encoding: 'utf8' }).split('\0').filter(Boolean);
  assertNoTrackedMp4(tracked);
  assert.throws(() => assertNoTrackedMp4(['public/video.Mp4']), /hors du dépôt/);
});

test('la règle générale MP4 reste présente sans exception vidéo', () => {
  const ignore = readFileSync(new URL('../../../.gitignore', import.meta.url), 'utf8');
  assert.match(ignore, /^\*\.mp4\s*$/m);
  assert.doesNotMatch(ignore, /^!.*\.mp4\s*$/im);
  assert.throws(() => assert.doesNotMatch('*.mp4\n!public/video.MP4\n', /^!.*\.mp4\s*$/im));
});

test('la configuration V2 conserve son activation et l’URL du média externe au dépôt', () => {
  const config = JSON.parse(readFileSync(new URL('../../public/config/learner-onboarding.json', import.meta.url), 'utf8'));
  assert.equal(config.enabled, true);
  assert.equal(config.version, '2');
  assert.equal(config.videoUrl, '/media/onboarding/bien-demarrer-espace-apprenant-v2.mp4');
});
