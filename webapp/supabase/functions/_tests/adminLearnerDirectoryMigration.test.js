import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../migrations/20260915170000_add_admin_learner_directory.sql', import.meta.url), 'utf8');

test('annuaire et fiche restent réservés à l’appelant admin strict', () => {
  assert.match(sql, /private\.is_strict_admin\(\)/);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_list_learners[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_list_learners[\s\S]*TO authenticated/);
});

test('recherche et pagination portent sur la totalité avant découpage', () => {
  assert.match(sql, /filtered AS \([\s\S]*page AS \([\s\S]*LIMIT p_limit OFFSET p_offset/);
  assert.match(sql, /'total', \(SELECT count\(\*\) FROM filtered\)/);
  assert.match(sql, /p_limit < 1 OR p_limit > 100/);
  assert.match(sql, /normalize_admin_learner_search/);
  assert.match(sql, /regexp_split_to_table\(v_search, ' '\)[\s\S]*NOT LIKE '%' \|\| token\.value \|\| '%'/);
});

test('identité bénéficiaire et entreprise utilisent uniquement le user_id exact', () => {
  assert.match(sql, /WHERE e\.user_id = profile\.id[\s\S]*ORDER BY e\.updated_at DESC, e\.id DESC/);
  assert.match(sql, /WHERE a\.user_id = profile\.id[\s\S]*ORDER BY a\.submitted_at DESC, a\.id DESC/);
  assert.doesNotMatch(sql, /e\.email\s*=|a\.email\s*=|profile\.email\s*=/);
});

test('tous les rôles restent listés et lisibles par UUID exact', () => {
  assert.match(sql, /'role', item\.role/);
  assert.match(sql, /'role', v_profile\.role/);
  assert.doesNotMatch(sql, /profile\.role\s*=\s*'user'/);
  assert.match(sql, /FROM public\.profiles AS profile\s+WHERE profile\.id = p_user_id;/);
});
