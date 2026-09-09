// Test PostgreSQL local (PGlite/WASM) : aucun serveur ou compte distant.
// Argument : chemin du module PGlite installé dans un répertoire de validation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE_PURCHASES } from '../supabase/functions/_shared/purchaseConfig.js';

if (!process.argv[2]) throw new Error('Indiquer le chemin local du module @electric-sql/pglite.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20260909070845_excel_commercial_offers.sql', import.meta.url), 'utf8');
const userId = '10000000-0000-4000-8000-000000000001';
let checks = 0;

try {
  // Tables minimales du contrat de la RPC. Les dépendances promotionnelles
  // existantes sont simulées ; seule la fonction modifiée est exécutée réellement.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA private;
    CREATE TABLE commercial_checkout_intents (
      id uuid PRIMARY KEY, user_id uuid, course_id text, status text,
      promo_redemption_id uuid, original_amount_cents integer,
      discount_amount_cents integer, final_amount_cents integer,
      checkout_configuration_locked_at timestamptz, updated_at timestamptz
    );
    CREATE TABLE promo_codes (id uuid PRIMARY KEY, code text);
    CREATE TABLE promo_redemptions (
      id uuid PRIMARY KEY, promo_code_id uuid, status text, reservation_expires_at timestamptz
    );
    CREATE FUNCTION private.promo_invalid() RETURNS void LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Promotion invalide' USING ERRCODE = 'P0001'; END; $$;
    CREATE FUNCTION private.reserve_promo_code(text,uuid,text,text,text,integer,text,uuid)
    RETURNS TABLE (redemption_id uuid, original_amount_cents integer, discount_amount_cents integer, final_amount_cents integer)
    LANGUAGE plpgsql AS $$
    DECLARE code_id uuid := gen_random_uuid(); redeem_id uuid := gen_random_uuid();
    BEGIN
      IF $1 <> 'LOCAL-VALID' OR $4 <> 'course' OR $7 <> 'commercial_checkout_intent' THEN
        PERFORM private.promo_invalid();
      END IF;
      INSERT INTO public.promo_codes VALUES(code_id, $1);
      INSERT INTO public.promo_redemptions VALUES(redeem_id, code_id, 'reserved', now() + interval '30 minutes');
      RETURN QUERY SELECT redeem_id, $6, 1000, $6 - 1000;
    END; $$;
  `);
  await db.exec(migration);

  async function intent(courseId) {
    return (await db.query(`INSERT INTO commercial_checkout_intents(id,user_id,course_id,status)
      VALUES(gen_random_uuid(),$1,$2,'created') RETURNING id`, [userId, courseId])).rows[0].id;
  }
  const prepare = (id, courseId, amount, code = null, buyer = userId) => db.query(
    'SELECT * FROM public.prepare_course_promotion_checkout($1,$2,$3,$4,$5,$6)',
    [id, buyer, 'learner@example.test', courseId, amount, code],
  );
  for (const offer of Object.values(COURSE_PURCHASES)) {
    const id = await intent(offer.courseId);
    const first = (await prepare(id, offer.courseId, offer.amountTotal)).rows[0];
    assert.equal(first.final_amount_cents, offer.amountTotal);
    assert.equal(first.discount_amount_cents, 0);
    assert.equal(first.promo_redemption_id, null);
    const replay = (await prepare(id, offer.courseId, offer.amountTotal)).rows[0];
    assert.deepEqual(replay, first);
    checks++;
    if (offer.courseId.startsWith('excel-')) {
      await assert.rejects(prepare(id, offer.courseId, 1), /Promotion invalide/);
      await assert.rejects(prepare(id, offer.courseId, offer.amountTotal, null, '20000000-0000-4000-8000-000000000002'), /Promotion invalide/);
      const invalidId = await intent(offer.courseId);
      await assert.rejects(prepare(invalidId, offer.courseId, offer.amountTotal, 'LOCAL-INVALID'), /Promotion invalide/);
      const unchanged = (await db.query('SELECT checkout_configuration_locked_at FROM commercial_checkout_intents WHERE id=$1', [invalidId])).rows[0];
      assert.equal(unchanged.checkout_configuration_locked_at, null);
      const promoId = await intent(offer.courseId);
      const promo = (await prepare(promoId, offer.courseId, offer.amountTotal, 'LOCAL-VALID')).rows[0];
      assert.equal(promo.final_amount_cents, offer.amountTotal - 1000);
      assert.ok(promo.promo_redemption_id);
      await assert.rejects(prepare(promoId, offer.courseId, offer.amountTotal, null), /Promotion invalide/);
      checks += 5;
    }
  }
  for (const courseId of ['excel-initiation-intra', 'excel-unknown', 'formation-excel']) {
    const id = await intent(courseId);
    await assert.rejects(prepare(id, courseId, 69000), /Promotion invalide/);
    checks++;
  }
  const roles = await db.query(`SELECT
    has_function_privilege('anon','public.prepare_course_promotion_checkout(uuid,uuid,text,text,integer,text)','EXECUTE') AS anon,
    has_function_privilege('authenticated','public.prepare_course_promotion_checkout(uuid,uuid,text,text,integer,text)','EXECUTE') AS authenticated,
    has_function_privilege('service_role','public.prepare_course_promotion_checkout(uuid,uuid,text,text,integer,text)','EXECUTE') AS service`);
  assert.deepEqual(roles.rows[0], { anon: false, authenticated: false, service: true });
  checks++;
  console.log(`PASS : ${checks} scénarios SQL ; 9 offres, montants, relecture, refus, réservations et permissions.`);
} catch (error) {
  console.error('FAIL SQL Excel :', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
