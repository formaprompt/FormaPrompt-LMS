import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as purchaseConfig from '../_shared/purchaseConfig.js';
import * as coursePromotion from '../_shared/coursePromotion.js';
import { buildStripePostPaymentPayload } from '../_shared/stripePostPayment.js';
import { officeResourceObjectPath, officeResourcesForCourse } from '../_shared/officeResources.js';

const excelExpectedOffers = [
  ['excel-initiation-inter', 'initiation', 'inter', 69000, 'STRIPE_EXCEL_INITIATION_INTER_PRICE_ID'],
  ['excel-initiation-individuel', 'initiation', 'individuel', 99000, 'STRIPE_EXCEL_INITIATION_INDIVIDUEL_PRICE_ID'],
  ['excel-perfectionnement-inter', 'perfectionnement', 'inter', 69000, 'STRIPE_EXCEL_PERFECTIONNEMENT_INTER_PRICE_ID'],
  ['excel-perfectionnement-individuel', 'perfectionnement', 'individuel', 99000, 'STRIPE_EXCEL_PERFECTIONNEMENT_INDIVIDUEL_PRICE_ID'],
  ['excel-avance-inter', 'avance', 'inter', 69000, 'STRIPE_EXCEL_AVANCE_INTER_PRICE_ID'],
  ['excel-avance-individuel', 'avance', 'individuel', 99000, 'STRIPE_EXCEL_AVANCE_INDIVIDUEL_PRICE_ID'],
];
const officeExpectedOffers = [
  ['word-initiation-inter', 'initiation', 'inter', 69000, 'STRIPE_WORD_INITIATION_INTER_PRICE_ID', 'word'],
  ['word-initiation-individuel', 'initiation', 'individuel', 99000, 'STRIPE_WORD_INITIATION_INDIVIDUEL_PRICE_ID', 'word'],
  ['word-perfectionnement-inter', 'perfectionnement', 'inter', 69000, 'STRIPE_WORD_PERFECTIONNEMENT_INTER_PRICE_ID', 'word'],
  ['word-perfectionnement-individuel', 'perfectionnement', 'individuel', 99000, 'STRIPE_WORD_PERFECTIONNEMENT_INDIVIDUEL_PRICE_ID', 'word'],
  ['powerpoint-initiation-inter', 'initiation', 'inter', 69000, 'STRIPE_POWERPOINT_INITIATION_INTER_PRICE_ID', 'powerpoint'],
  ['powerpoint-initiation-individuel', 'initiation', 'individuel', 99000, 'STRIPE_POWERPOINT_INITIATION_INDIVIDUEL_PRICE_ID', 'powerpoint'],
];
const bureautiqueExpectedOffers = [...excelExpectedOffers, ...officeExpectedOffers];

// References publiques validees, utilisees seulement par des doubles sans reseau.
const approvedStripeReferences = {
  'excel-initiation-inter': ['price_1UDgMfLCMjfi77wuBTp5I25B', 'prod_VE8d61ytFpS32A'],
  'excel-initiation-individuel': ['price_1UDgMgLCMjfi77wu8UpVRv86', 'prod_VE8d61ytFpS32A'],
  'excel-perfectionnement-inter': ['price_1UDgMhLCMjfi77wuFGwOLNms', 'prod_VE8dh6BaMam6ub'],
  'excel-perfectionnement-individuel': ['price_1UDgMhLCMjfi77wu16bz3jFH', 'prod_VE8dh6BaMam6ub'],
  'excel-avance-inter': ['price_1UDgMiLCMjfi77wu10YulHtu', 'prod_VE8dAm07CVCApk'],
  'excel-avance-individuel': ['price_1UDgMjLCMjfi77wuETS7F1cB', 'prod_VE8dAm07CVCApk'],
};
const localEnvPath = new URL('../.env.excel-live.local', import.meta.url);
test('le fichier local optionnel contient exclusivement les six references LIVE approuvees', { skip: !existsSync(localEnvPath) }, () => {
  const entries = Object.fromEntries(readFileSync(localEnvPath, 'utf8').split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#')).map((line) => line.split('=')));
  assert.deepEqual(entries, Object.fromEntries(excelExpectedOffers.map(([id, , , , env]) => [env, approvedStripeReferences[id][0]])));
});

test('les six offres distinguent niveau, modalité, montant serveur et référence de configuration Stripe', () => {
  assert.deepEqual(Object.keys(purchaseConfig.EXCEL_PURCHASES), excelExpectedOffers.map(([id]) => id));
  for (const [id, level, modality, cents, envName] of excelExpectedOffers) {
    const offer = purchaseConfig.getPurchaseConfig(id);
    assert.equal(offer.courseId, id);
    assert.equal(offer.pedagogicalLevel, level);
    assert.equal(offer.modality, modality);
    assert.equal(offer.amountTotal, cents);
    assert.equal(offer.priceEnvName, envName);
    assert.equal(offer.currency, 'eur');
    assert.equal(offer.deliveryKind, 'instructor_led_with_online_course');
    assert.equal(offer.requiresLmsAccess, true);
    assert.equal(offer.checkoutEnabled, true);
    assert.equal(Object.hasOwn(offer, 'priceId'), false);
    assert.ok(Object.isFrozen(offer));
  }
});

test('les six offres Office gardent un droit commercial distinct et un chemin de supports exact', () => {
  assert.deepEqual(Object.keys(purchaseConfig.OFFICE_PURCHASES), officeExpectedOffers.map(([id]) => id));
  for (const [id, level, modality, cents, envName, tool] of officeExpectedOffers) {
    const offer = purchaseConfig.getPurchaseConfig(id);
    assert.equal(offer.courseId, id);
    assert.equal(offer.tool, tool);
    assert.equal(offer.pedagogicalLevel, level);
    assert.equal(offer.modality, modality);
    assert.equal(offer.amountTotal, cents);
    assert.equal(offer.priceEnvName, envName);
    assert.equal(offer.resourcePath, `/course/office-supports/${id}`);
    assert.equal(offer.deliveryKind, 'instructor_led_with_online_course');
    assert.equal(offer.requiresLmsAccess, true);
    assert.equal(offer.checkoutEnabled, true);
    assert.ok(Object.isFrozen(offer));
  }
});

test('les identifiants inconnus, pédagogiques seuls, intra et propriétés héritées sont refusés', () => {
  for (const id of [
    'formation-excel', 'initiation', 'excel-initiation-intra', 'excel-avance',
    'word-initiation', 'word-initiation-intra', 'powerpoint-perfectionnement-inter',
    'toString', '__proto__', 'constructor', null, {}, 69000,
  ]) {
    assert.equal(purchaseConfig.getPurchaseConfig(id), null);
  }
});

test('deux modalités Office restent deux droits exacts vers un seul pack pédagogique', () => {
  const inter = purchaseConfig.getPurchaseConfig('word-initiation-inter');
  const individuel = purchaseConfig.getPurchaseConfig('word-initiation-individuel');
  assert.notEqual(inter.courseId, individuel.courseId);
  assert.equal(
    officeResourceObjectPath(inter.courseId, 'learner', officeResourcesForCourse(inter.courseId, 'learner')[0]),
    officeResourceObjectPath(individuel.courseId, 'learner', officeResourcesForCourse(individuel.courseId, 'learner')[0]),
  );
});

test('le remboursement existant cible achat, utilisateur et offre exacte et préserve l autre modalité', () => {
  const processor = readFileSync(new URL('../../migrations/20260822110413_sprint_5_stripe_post_payment.sql', import.meta.url), 'utf8');
  assert.match(processor, /WHERE purchase_id = v_transaction\.purchase_id\s+AND user_id IS NOT DISTINCT FROM v_transaction\.user_id\s+AND course_id IS NOT DISTINCT FROM v_transaction\.course_id/);
  assert.match(processor, /IF FOUND AND v_access\.status IN \('active', 'suspended'\)/);
});

test('la migration promotion autorise seulement les six offres Office aux montants catalogue', () => {
  const migration = readFileSync(new URL('../../migrations/20260913114223_add_office_commercial_offers.sql', import.meta.url), 'utf8');
  for (const [id, , modality, cents] of officeExpectedOffers) {
    assert.match(migration, new RegExp(`'${id}'`));
    const amountGroup = modality === 'inter' ? '69000' : '99000';
    assert.equal(String(cents), amountGroup);
  }
  assert.doesNotMatch(migration, /word-initiation-intra|powerpoint-perfectionnement/);
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:purchases|course_access|stripe_payment_transactions)/i);
});

test('les six achats conservent offre, acheteur, montant et references dans le traitement apres paiement existant', () => {
  for (const [id, level, modality, amount] of bureautiqueExpectedOffers) {
    const payload = buildStripePostPaymentPayload({ id: 'evt_local', type: 'checkout.session.completed', created: 1700000000,
      livemode: false, data: { object: { id: 'cs_local', payment_intent: 'pi_local', amount_total: amount, currency: 'eur',
        metadata: { course_id: id, user_id: 'user_local', payment_type: 'course', checkout_intent_id: 'intent_local',
          pedagogical_level: level, modality, access_activation_policy: 'immediate_after_payment' } } } }, 'hash_local');
    assert.equal(payload.course_id, id);
    assert.equal(payload.user_id, 'user_local');
    assert.equal(payload.amount_total, amount);
    assert.equal(payload.currency, 'eur');
    assert.equal(payload.stripe_checkout_session_id, 'cs_local');
    assert.equal(payload.stripe_payment_intent_id, 'pi_local');
    assert.equal(payload.activation_policy, 'immediate_after_payment');
    assert.equal(purchaseConfig.getPurchaseConfig(payload.course_id).pedagogicalLevel, level);
    assert.equal(purchaseConfig.getPurchaseConfig(payload.course_id).modality, modality);
  }
});

test('le calcul des lignes Stripe conserve le catalogue sans promotion et refuse les montants incohérents', () => {
  for (const [id, , , cents] of bureautiqueExpectedOffers) {
    const offer = purchaseConfig.getPurchaseConfig(id);
    // Aucun identifiant Stripe réel ou fictif n'est nécessaire pour ce contrôle pur.
    assert.deepEqual(coursePromotion.buildCourseStripeLineItem({
      purchase: offer, catalogPriceId: null, finalAmountCents: cents, promotionApplied: false,
    }), { price: null, quantity: 1 });
    for (const amount of [0, -1, 1, cents - 1, cents + 1, String(cents)]) {
      assert.throws(() => coursePromotion.buildCourseStripeLineItem({
        purchase: offer, finalAmountCents: amount, promotionApplied: false,
      }));
    }
  }
});

function checkoutHarness(offer, { missingPrice = false, invalidPromotion = false, wrongStripeAmount = false,
  priceMetadata = {}, productMetadata = {}, productActive = true } = {}) {
  const endpoint = 'create-checkout';
  const compiled = ts.transpileModule(readFileSync(new URL(`../${endpoint}/index.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
  });
  assert.deepEqual(compiled.diagnostics, []);
  let handler;
  const calls = [], stripeSessions = [];
  const [expectedPriceId, expectedProductId] = approvedStripeReferences[offer.courseId] || ['price_local_fixture', 'prod_local_fixture'];
  // Exécution locale intégralement simulée : ni Stripe, ni Supabase accessibles.
  const result = (data, error = null) => ({ data, error });
  const thenable = (data) => ({ single: async () => data, then: (resolve) => Promise.resolve(data).then(resolve) });
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'local-user', email: 'learner@example.test' } }, error: null }) },
    from(table) {
      const rows = table === 'legal_document_versions' ? [{ id: 'legal-local', document_type: 'cgv_b2b', version: offer.legalVersions.cgvB2b }] : null;
      const chain = {
        select: () => chain, eq: () => chain, or: () => chain, in: () => chain, update: () => chain,
        maybeSingle: async () => result(null), then: (resolve) => Promise.resolve(result(rows)).then(resolve),
      };
      return chain;
    },
    rpc(name, args) {
      calls.push({ name, args });
      if (name === 'prepare_course_checkout_intent') return thenable(result({ id: 'local-intent', stripe_checkout_session_id: null }));
      if (name === 'prepare_course_promotion_checkout') {
        if (invalidPromotion) return thenable(result(null, { code: 'P0001' }));
        const promo = Boolean(args.p_promo_code);
        return thenable(result({
          original_amount_cents: args.p_original_amount_cents,
          discount_amount_cents: promo ? 1000 : 0,
          final_amount_cents: args.p_original_amount_cents - (promo ? 1000 : 0),
          normalized_code: args.p_promo_code,
          promo_redemption_id: promo ? 'local-redemption' : null,
          reservation_expires_at: new Date(Date.now() + 36 * 60000).toISOString(),
        }));
      }
      if (name === 'reset_course_promotion_checkout') return thenable(result(true));
      throw new Error(`RPC inattendue : ${name}`);
    },
  };
  class LocalStripe {
    prices = { retrieve: async (id) => {
      assert.equal(id, expectedPriceId);
      return { active: true, livemode: false, currency: 'eur', recurring: null,
        unit_amount: wrongStripeAmount ? 1 : offer.amountTotal, product: expectedProductId,
        metadata: { course_id: offer.courseId, modality: offer.modality, ...priceMetadata } };
    } };
    products = { retrieve: async (id) => {
      assert.equal(id, expectedProductId);
      return { id, active: productActive, livemode: false,
        metadata: { pedagogical_level: offer.pedagogicalLevel, duration_hours: '14', ...productMetadata } };
    } };
    checkout = { sessions: { create: async (params) => {
      stripeSessions.push(params);
      return { id: 'cs_test_local_fixture', url: 'https://checkout.stripe.com/c/pay/local-fixture' };
    } } };
  }
  const deps = {
    'npm:stripe@^22': { default: LocalStripe },
    'npm:@supabase/supabase-js@2.105.1': { createClient: () => admin },
    '../_shared/cors.ts': { corsHeaders: {}, jsonResponse: (body, status = 200) => Response.json(body, { status }) },
    '../_shared/purchaseConfig.js': purchaseConfig,
    '../_shared/coursePromotion.js': coursePromotion,
  };
  const env = { STRIPE_SECRET_KEY: 'sk_test_local_fixture', SUPABASE_URL: 'https://supabase.invalid',
    SUPABASE_ANON_KEY: 'local-anon', SUPABASE_SERVICE_ROLE_KEY: 'local-service', SITE_URL: 'https://formaprompt.com',
    ...Object.fromEntries(excelExpectedOffers.map(([id, , , , envName]) => [envName, approvedStripeReferences[id][0]])),
    [offer.priceEnvName]: missingPrice ? undefined : expectedPriceId };
  runInNewContext(compiled.outputText, {
    exports: {}, require: (name) => { assert.ok(deps[name]); return deps[name]; },
    Deno: { env: { get: (name) => env[name] }, serve: (value) => { handler = value; } },
    Response, URL, Error, console: { error: () => {}, warn: () => {} },
  });
  return { calls, stripeSessions, invoke: (overrides = {}) => handler(new Request('https://local.invalid', {
    method: 'POST', headers: { Authorization: 'Bearer local-fixture', 'Content-Type': 'application/json' },
    body: JSON.stringify({ course_id: offer.courseId, checkout_request_id: '10000000-0000-4000-8000-000000000001',
      checkout_context: { sales_context: 'professional_self' },
      consents: { cgv_version: offer.legalVersions.cgvB2b, cgv_acceptance: true }, ...overrides }),
  })) };
}

for (const [id, , , amount] of bureautiqueExpectedOffers) {
  test(`${id} ignore le prix frontend et utilise le catalogue serveur sans promotion`, async () => {
    const harness = checkoutHarness(purchaseConfig.getPurchaseConfig(id));
    const response = await harness.invoke({ amount_total: 1, price: 1 });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).final_amount_cents, amount);
    assert.equal(harness.calls.find(({ name }) => name === 'prepare_course_promotion_checkout').args.p_original_amount_cents, amount);
    assert.equal(harness.stripeSessions.length, 1);
    const [expectedPriceId, expectedProductId] = approvedStripeReferences[id] || ['price_local_fixture', 'prod_local_fixture'];
    assert.equal(harness.stripeSessions[0].line_items[0].price, expectedPriceId);
    assert.equal(harness.stripeSessions[0].metadata.course_id, id);
    const session = harness.stripeSessions[0], offer = purchaseConfig.getPurchaseConfig(id);
    assert.equal(session.metadata.price_id, expectedPriceId);
    assert.equal(session.metadata.stripe_product_id, expectedProductId);
    assert.equal(session.metadata.modality, offer.modality);
    assert.equal(session.metadata.pedagogical_level, offer.pedagogicalLevel);
    assert.equal(session.payment_intent_data.metadata.modality, offer.modality);
    assert.ok(session.custom_text.submit.message.includes(offer.modalityLabel));
    assert.equal(session.invoice_creation.invoice_data.custom_fields[0].value, offer.modalityLabel);
    assert.equal(session.invoice_creation.invoice_data.metadata.course_id, id);
    assert.equal(harness.stripeSessions[0].automatic_tax.enabled, false);
  });
}

test('refuse une autre offre au meme montant, une autre modalite ou un produit incorrect/inactif', async () => {
  const offer = purchaseConfig.getPurchaseConfig('excel-initiation-inter');
  for (const overrides of [
    { priceMetadata: { course_id: 'excel-avance-inter' } },
    { priceMetadata: { modality: 'individuel' } },
    { productMetadata: { pedagogical_level: 'avance' } },
    { productMetadata: { duration_hours: '7' } },
    { productActive: false },
  ]) {
    const harness = checkoutHarness(offer, overrides);
    assert.equal((await harness.invoke()).status, 500);
    assert.equal(harness.stripeSessions.length, 0);
  }
});

test('les trois formations IA conservent leurs parametres Stripe sans ajout Excel', async () => {
  for (const id of ['formation-ia', 'formation-prompt-level-1', 'formation-ia-act']) {
    const harness = checkoutHarness(purchaseConfig.getPurchaseConfig(id));
    assert.equal((await harness.invoke()).status, 200);
    const session = harness.stripeSessions[0];
    assert.equal(session.custom_text, undefined);
    assert.equal(session.invoice_creation.invoice_data, undefined);
    assert.equal(session.metadata.modality, undefined);
    assert.equal(session.line_items[0].price, 'price_local_fixture');
  }
});

test('une référence Stripe manquante bloque le checkout avant toute création de session', async () => {
  for (const [id] of bureautiqueExpectedOffers) {
    const harness = checkoutHarness(purchaseConfig.getPurchaseConfig(id), { missingPrice: true });
    const response = await harness.invoke();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).checkout_unavailable, true);
    assert.equal(harness.stripeSessions.length, 0);
    assert.equal(harness.calls.length, 0);
  }
});

test('le checkout refuse un prix Stripe incohérent et un identifiant non reconnu', async () => {
  const harness = checkoutHarness(purchaseConfig.getPurchaseConfig(excelExpectedOffers[0][0]), { wrongStripeAmount: true });
  assert.equal((await harness.invoke()).status, 500);
  assert.equal((await harness.invoke({ course_id: 'excel-initiation-intra' })).status, 400);
  assert.equal(harness.stripeSessions.length, 0);
});

test('une promotion invalide refuse la session et libère la tentative via le mécanisme existant', async () => {
  const harness = checkoutHarness(purchaseConfig.getPurchaseConfig(excelExpectedOffers[0][0]), { invalidPromotion: true });
  const response = await harness.invoke({ promo_code: 'INVALID' });
  assert.equal((await response.json()).promotion_invalid, true);
  assert.equal(harness.stripeSessions.length, 0);
  assert.equal(harness.calls.at(-1).name, 'reset_course_promotion_checkout');
});

test('une promotion validée utilise le montant réservé côté serveur sans modifier le tarif catalogue', async () => {
  const harness = checkoutHarness(purchaseConfig.getPurchaseConfig(excelExpectedOffers[0][0]));
  const response = await harness.invoke({ promo_code: 'VALID', amount_total: 1 });
  assert.equal(response.status, 200);
  assert.equal(harness.stripeSessions[0].line_items[0].price_data.unit_amount, 68000);
  assert.equal(purchaseConfig.getPurchaseConfig(excelExpectedOffers[0][0]).amountTotal, 69000);
});

test('une promotion Office conserve cible, montant serveur et métadonnées de modalité dans Checkout', async () => {
  const offer = purchaseConfig.getPurchaseConfig('powerpoint-initiation-individuel');
  const harness = checkoutHarness(offer);
  const response = await harness.invoke({ promo_code: 'VALID', amount_total: 1 });
  assert.equal(response.status, 200);
  const promotionCall = harness.calls.find(({ name }) => name === 'prepare_course_promotion_checkout');
  assert.equal(promotionCall.args.p_course_id, offer.courseId);
  assert.equal(promotionCall.args.p_original_amount_cents, 99000);
  assert.equal(harness.stripeSessions[0].line_items[0].price_data.unit_amount, 98000);
  assert.equal(harness.stripeSessions[0].metadata.course_id, offer.courseId);
  assert.equal(harness.stripeSessions[0].metadata.modality, 'individuel');
});
