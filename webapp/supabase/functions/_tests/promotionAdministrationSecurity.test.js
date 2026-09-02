import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../migrations/20260831150000_add_promotion_administration.sql', import.meta.url), 'utf8');

test('les RPC promotionnelles exigent un admin strict et un search_path vide', () => {
  assert.match(migration, /private\.is_strict_admin\(\)/);
  const definers = migration.match(/SECURITY DEFINER\s+SET search_path = ''/g) || [];
  assert.ok(definers.length >= 5, 'les fonctions sensibles sont SECURITY DEFINER avec search_path vide');
  assert.match(migration, /PERFORM private\.require_promotion_admin\(\)/);
  const rpcNames = [
    'admin_list_promotions', 'admin_create_promotion',
    'admin_update_promotion', 'admin_set_promotion_active',
  ];
  rpcNames.forEach((name, index) => {
    const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
    const nextStart = index + 1 < rpcNames.length
      ? migration.indexOf(`CREATE OR REPLACE FUNCTION public.${rpcNames[index + 1]}`)
      : migration.indexOf('REVOKE ALL ON FUNCTION public.admin_list_promotions');
    const definition = migration.slice(start, nextStart);
    assert.ok(start >= 0 && nextStart > start, `${name} possède une définition unique attendue`);
    assert.match(definition, /SECURITY DEFINER\s+SET search_path = ''/);
    assert.match(definition, /private\.require_promotion_admin\(\)/);
    assert.doesNotMatch(definition, /\bp_user_id\b|\bp_email\b/);
    assert.doesNotMatch(definition, /\bEXECUTE\s+(?:format|p_)/i);
  });
});
test('les mutations directes restent absentes de la surface frontend', () => {
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_create_promotion[\s\S]+TO authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_create_promotion[\s\S]+FROM PUBLIC, anon, authenticated, service_role/);
  assert.doesNotMatch(migration, /admin_delete_promotion/i);
});

test('la matrice de privilèges ne contient ni grant global ni privilège par défaut élargi', () => {
  assert.doesNotMatch(migration, /GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS/i);
  assert.doesNotMatch(migration, /ALTER\s+DEFAULT\s+PRIVILEGES/i);
  const rpcNames = [
    'admin_list_promotions', 'admin_create_promotion',
    'admin_update_promotion', 'admin_set_promotion_active',
  ];
  for (const name of rpcNames) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}[\\s\\S]+?FROM PUBLIC, anon, authenticated, service_role`));
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}[\\s\\S]+?TO authenticated`));
  }
});

test('promotion et targets sont remplacées dans la même RPC transactionnelle', () => {
  const updateBody = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.admin_update_promotion'));
  assert.match(updateBody, /FOR UPDATE/);
  assert.match(updateBody, /DELETE FROM public\.promo_code_targets/);
  assert.match(updateBody, /INSERT INTO public\.promo_code_targets/);
});

test('le code est immuable et les actions administratives alimentent audit_log sans donnée personnelle', () => {
  assert.match(migration, /CREATE TRIGGER promo_codes_prevent_identifier_change/);
  assert.match(migration, /INSERT INTO public\.audit_log/g);
  const auditPayloads = migration.match(/jsonb_build_object\([\s\S]*?\)/g) || [];
  assert.ok(auditPayloads.length > 0);
  assert.doesNotMatch(auditPayloads.join('\n'), /restricted_email['"]\s*,/);
});

test('le lot administration ne référence ni purchases ni course_access', () => {
  assert.doesNotMatch(migration, /\bpurchases\b/i);
  assert.doesNotMatch(migration, /\bcourse_access\b/i);
});
