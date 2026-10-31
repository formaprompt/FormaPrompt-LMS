import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_GIFT_COURSES, BUREAUTIQUE_PURCHASES } from '../_shared/purchaseConfig.js';
import { EXPECTED_COMMERCIAL_COURSE_IDS } from './commercialExpectedCourses.js';
import { adminGiftAllowlist, latestFunctionMigration, sqlStatements } from './migrationFunctionSource.js';
const name = 'public.admin_grant_course_access';
const declaration = (value, tag = '$fn$') => `CREATE OR REPLACE FUNCTION ${name}(uuid,text,text) RETURNS text LANGUAGE sql AS ${tag} SELECT '${value}'; ${tag};`;

test('migration selector follows chronological order and retains function ACL statements', () => {
  const selected = latestFunctionMigration([
    { name: '20261021210000_new.sql', source: `${declaration('iag')}
      REVOKE ALL ON FUNCTION ${name}(uuid,text,text) FROM PUBLIC,anon;
      GRANT EXECUTE ON FUNCTION ${name}(uuid,text,text) TO authenticated;` },
    { name: '20261007164124_old.sql', source: declaration('historic') },
  ], name);
  assert.equal(selected.name, '20261021210000_new.sql');
  assert.match(selected.source, /SELECT 'iag'/);
  assert.match(selected.source, /TO authenticated/);
});
test('selector cannot mistake comments, calls or a dollar-quoted DO body for a replacement', () => {
  const selected = latestFunctionMigration([
    { name: '01.sql', source: declaration('real') },
    { name: '02.sql', source: `-- ${declaration('line-comment')}
       /* outer /* nested */ ${declaration('block-comment')} */
       DO $body$ BEGIN RAISE NOTICE '${declaration('inside-string')}'; END; $body$;
       SELECT ${name}(null,null,null);` },
  ], name);
  assert.equal(selected.name, '01.sql'); assert.match(selected.source, /'real'/);
});
test('last actual definition in the same migration wins; dollar-tag whitespace is preserved', () => {
  const selected = latestFunctionMigration([{ name: '01.sql', source: declaration('first') + declaration('last', '$another_tag$') }], name);
  assert.match(selected.source, /'last'/); assert.doesNotMatch(selected.source, /'first'/);
});
test('unknown function is absent rather than replaced with a convenient fallback', () => {
  assert.equal(latestFunctionMigration([{ name: '01.sql', source: declaration('actual') }], 'public.another_function'), null);
  assert.throws(() => latestFunctionMigration([], 'public.fn;DROP TABLE x'), /Invalid/);
});
test('selector rejects an unexpected overload instead of blessing the wrong callable signature', () => {
  assert.throws(() => latestFunctionMigration([{ name: '01.sql', source: declaration('real') + `CREATE FUNCTION ${name}(uuid,text) RETURNS text LANGUAGE sql AS $$ SELECT 'wrong'; $$;` }], name), /overload/);
  const source = `CREATE FUNCTION ${name}(p_target uuid,p_course text,p_reason text DEFAULT 'a,b') RETURNS text LANGUAGE sql AS $$ SELECT 'valid'; $$;`;
  assert.match(latestFunctionMigration([{ name: '01.sql', source }], name).source, /'valid'/);
});
test('SQL tokenizer handles semicolons in text, identifiers, nested comments and dollar bodies', () => {
  const statements = sqlStatements(`SELECT 'a;''b', "x;y"; /* a /* b; */ c */ DO $$ BEGIN PERFORM 1; END; $$;`);
  assert.equal(statements.length, 2);
  assert.throws(() => sqlStatements('DO $x$ missing'), /dollar/);
  assert.throws(() => sqlStatements('/* missing'), /comment/);
  assert.throws(() => sqlStatements("SELECT 'missing"), /quote/);
});

const migrationDirectory = new URL('../../migrations/', import.meta.url);
const effectiveGiftMigration = latestFunctionMigration(readdirSync(migrationDirectory)
  .filter(filename => /^\d{14}_[A-Za-z0-9_-]+\.sql$/.test(filename))
  .map(filename => ({ name: filename, source: readFileSync(new URL(filename, migrationDirectory), 'utf8') })), name);
assert.ok(effectiveGiftMigration, 'The canonical gift function must exist.');
const migrationName = effectiveGiftMigration.name;
// Mutate the effective gift function only, excluding unrelated earlier RPCs.
const actualSql = effectiveGiftMigration.source;
const assertionUrl = new URL('./adminGrantCourse.test.js', import.meta.url);
const assertionSource = readFileSync(assertionUrl, 'utf8')
  .replace(/^import[^\n]*\n/gm, '').replaceAll('import.meta.url', '__moduleUrl');
function attributionAssertion(sql) {
  const registered = [];
  const read = (file, ...args) => path.basename(file instanceof URL ? fileURLToPath(file) : String(file)) === migrationName ? sql : readFileSync(file, ...args);
  // Execute the real test module's second callback in the same realm: no duplicate assertion.
  new Function('test', 'assert', 'readFileSync', 'readdirSync', 'adminGiftAllowlist', 'latestFunctionMigration',
    'ADMIN_GIFT_COURSES', 'BUREAUTIQUE_PURCHASES', 'EXPECTED_COMMERCIAL_COURSE_IDS', '__moduleUrl', assertionSource)(
    (title, callback) => registered.push({ title, callback }), assert, read, readdirSync, adminGiftAllowlist, latestFunctionMigration,
    ADMIN_GIFT_COURSES, BUREAUTIQUE_PURCHASES, EXPECTED_COMMERCIAL_COURSE_IDS, assertionUrl.href);
  const original = registered.find(({ title }) => title.startsWith('l attribution reste admin seulement'));
  assert.ok(original, 'The real attribution callback must still exist');
  return original.callback;
}
function withoutIag(sql) {
  const literal = "'formation-ia-generative-elearning', ";
  assert.equal(sql.split(literal).length, 2); return sql.replace(literal, '');
}
function declareNote(sql, declaration) {
  const marker = '\nDECLARE\n  v_course_id';
  assert.equal(sql.split(marker).length, 2);
  return sql.replace(marker, `\nDECLARE\n  ${declaration}\n  v_course_id`);
}
test('P2 real attribution callback accepts the unchanged effective canonical SQL', () => {
  assert.doesNotThrow(attributionAssertion(actualSql));
});
test('P2 auditor mutant: IAG removed from allowlist and present only in DECLARE comment is rejected', () => {
  const mutant = declareNote(withoutIag(actualSql), "-- 'formation-ia-generative-elearning'");
  assert.throws(attributionAssertion(mutant), { code: 'ERR_ASSERTION' });
});
test('P2 IAG only in an unrelated text initializer is rejected by the real attribution callback', () => {
  const mutant = declareNote(withoutIag(actualSql), "v_note text := 'formation-ia-generative-elearning';");
  assert.throws(attributionAssertion(mutant), { code: 'ERR_ASSERTION' });
});
test('P2 fabricated allowlist inside nested block comments does not supply executable membership', () => {
  const mutant = declareNote(withoutIag(actualSql), "/* outer /* nested */ IF v_course_id NOT IN ('formation-ia-generative-elearning') THEN */");
  assert.throws(attributionAssertion(mutant), { code: 'ERR_ASSERTION' });
});
test('P2 fabricated allowlist inside dollar-quoted text stays opaque', () => {
  const mutant = declareNote(withoutIag(actualSql), "v_note text := $note$IF v_course_id NOT IN ('formation-ia-generative-elearning') THEN$note$;");
  assert.throws(attributionAssertion(mutant), { code: 'ERR_ASSERTION' });
});
test('P2 duplicate actual IAG entry is rejected even when all expected IDs occur', () => {
  const mutant = actualSql.replace("'formation-ia-generative-elearning', ", "'formation-ia-generative-elearning', 'formation-ia-generative-elearning', ");
  assert.throws(attributionAssertion(mutant), { code: 'ERR_ASSERTION' });
});
test('P2 nineteen entries with a historical offer replaced by duplicate IAG are rejected', () => {
  const mutant = actualSql.replace("'formation-ia', 'formation-ia-act'", "'formation-ia-generative-elearning', 'formation-ia-act'");
  assert.notEqual(mutant, actualSql); assert.throws(attributionAssertion(mutant), { code: 'ERR_ASSERTION' });
});
test('P2 missing or multiple executable allowlist blocks fail closed', () => {
  const body = "CREATE FUNCTION public.admin_grant_course_access(uuid,text,text) RETURNS text LANGUAGE plpgsql AS $f$ BEGIN %BODY% END; $f$;";
  assert.throws(() => adminGiftAllowlist(body.replace('%BODY%', "PERFORM 'IF v_course_id NOT IN (x) THEN';")), /exactly one/);
  assert.throws(() => adminGiftAllowlist(body.replace('%BODY%', "IF v_course_id NOT IN ('a') THEN NULL; END IF; IF v_course_id NOT IN ('b') THEN NULL; END IF;")), /exactly one/);
});
