import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('tracked production configuration contains only reviewed public GA4 values', () => {
  const source = readFileSync(new URL('../../.env.production', import.meta.url), 'utf8');
  const entries = source.split(/\r?\n/).map(line => line.trim())
    .filter(line => line && !line.startsWith('#')).map(line => line.split('='));
  assert.equal(entries.length, 3);
  assert.deepEqual(Object.fromEntries(entries), {
    VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID: 'G-FL8HMVXF4Z',
    VITE_GOOGLE_ANALYTICS_ENABLED: 'true',
    VITE_GOOGLE_ANALYTICS_PRIVACY_REVIEWED: 'true',
  });
});

test('local template remains disabled and only production env is explicitly tracked', () => {
  const example = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
  assert.match(example, /^VITE_GOOGLE_ANALYTICS_ENABLED=false$/m);
  assert.match(example, /^VITE_GOOGLE_ANALYTICS_PRIVACY_REVIEWED=false$/m);
  const ignore = readFileSync(new URL('../../../.gitignore', import.meta.url), 'utf8');
  assert.match(ignore, /^webapp\/\.env\*$/m);
  assert.match(ignore, /^!webapp\/\.env\.production$/m);
  assert.doesNotMatch(ignore, /^!.*\.env\.production\.local$/m);
});
