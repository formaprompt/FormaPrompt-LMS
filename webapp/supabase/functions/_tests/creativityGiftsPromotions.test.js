import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../migrations/20261007164124_creativity_gifts_promotions.sql', import.meta.url), 'utf8');
const creativeIds = ['ia-creativite-groupe', 'ia-creativite-individuel', 'ia-creativite-ecole-association'];

function functionBody(name) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  assert.notEqual(start, -1, `fonction ${name} présente`);
  const end = migration.indexOf('$function$;', start);
  assert.notEqual(end, -1, `fin de fonction ${name} présente`);
  return migration.slice(start, end + '$function$;'.length);
}

test('les trois formules gardent leurs prix catalogue exacts et peuvent réserver une promotion', () => {
  const promotion = functionBody('prepare_course_promotion_checkout');
  for (const courseId of creativeIds) assert.match(promotion, new RegExp(`'${courseId}'`));
  assert.match(promotion, /p_course_id = 'ia-creativite-groupe'[\s\S]*?IS DISTINCT FROM 69000/);
  assert.match(promotion, /p_course_id = 'ia-creativite-individuel'[\s\S]*?IS DISTINCT FROM 90000/);
  assert.match(promotion, /p_course_id = 'ia-creativite-ecole-association'[\s\S]*?IS DISTINCT FROM 160000/);
  assert.match(promotion, /private\.reserve_promo_code\([\s\S]*?'course', p_course_id/);
  assert.match(promotion, /v_reservation\.final_amount_cents <= 0/);
  assert.doesNotMatch(promotion, /ia-creativite-[^']+' AND v_normalized_code IS NOT NULL/);
  assert.doesNotMatch(promotion, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM) public\.(?:course_access|purchases)/i);
});

test('le cadeau reste une attribution admin auditée sans achat ni reçu payé fictif', () => {
  const grant = functionBody('admin_grant_course_access');
  for (const courseId of creativeIds) assert.match(grant, new RegExp(`'${courseId}'`));
  assert.match(grant, /private\.is_strict_admin\(\)/);
  assert.match(grant, /'active', 'gift'/);
  assert.match(grant, /set_config\('formaprompt\.audit_reason'/);
  assert.doesNotMatch(grant, /INSERT\s+INTO public\.purchases/i);
  assert.doesNotMatch(grant, /INSERT\s+INTO public\.course_cohort_enrollments/i);
});
