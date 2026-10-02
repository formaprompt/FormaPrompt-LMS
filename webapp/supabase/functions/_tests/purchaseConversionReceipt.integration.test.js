import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createPurchaseConversionReceiptHandler } from '../_shared/purchaseConversionReceipt.js';

// No environment files, real account, Stripe, Google or Supabase instance are used.
// This exercises the installed SDK's Auth/PostgREST HTTP transport, not a fluent-client mock.
const userId = '11000000-0000-4000-8000-000000000001';
const otherId = '22000000-0000-4000-8000-000000000002';
const businessId = '33000000-0000-4000-8000-000000000003';
const transactionId = '44000000-0000-4000-8000-000000000004';
const sessionId = 'cs_live_fictional_receipt';
const anonKey = 'fictional-anon-key-not-a-secret';
const readKey = 'fictional-service-key-not-a-secret';
const token = 'fictional-valid-token';
const selections = {
  stripe_payment_transactions: 'id,user_id,purchase_id,diagnostic_order_id,booking_request_id,course_id,payment_type,status,amount_total,amount_refunded,currency,stripe_checkout_session_id,last_event_id',
  stripe_webhook_events: 'event_id,event_type,stripe_object_id,livemode,payload_sha256,processing_result',
  purchases: 'id,user_id,course_id,payment_status,amount_total,currency,stripe_checkout_session_id',
  diagnostic_ia_orders: 'id,user_id,status,amount_total,final_amount_cents,currency,paid_at,stripe_checkout_session_id',
};

function fixture(diagnostic = false) {
  return {
    sessionId,
    transaction: {
      id: transactionId, user_id: userId, purchase_id: diagnostic ? null : businessId,
      diagnostic_order_id: diagnostic ? businessId : null, booking_request_id: null,
      course_id: diagnostic ? null : 'fictional-course',
      payment_type: diagnostic ? 'diagnostic_ia_express' : 'course', status: 'paid',
      amount_total: 11900, amount_refunded: 0, currency: 'eur',
      stripe_checkout_session_id: sessionId, last_event_id: 'evt_fictional_paid',
    },
    event: {
      event_id: 'evt_fictional_paid', event_type: 'checkout.session.completed',
      stripe_object_id: sessionId, livemode: true, payload_sha256: 'a'.repeat(64), processing_result: 'processed',
    },
    business: {
      id: businessId, user_id: userId, course_id: 'fictional-course', payment_status: 'paid', status: 'paid',
      amount_total: 11900, final_amount_cents: 11900, currency: 'eur', paid_at: '2026-10-01T12:00:00Z',
      stripe_checkout_session_id: sessionId,
      // Deliberately higher reference price: receipt must use the actual paid net amount.
      original_amount_cents: 14900, discount_amount_cents: 3000, promo_code: 'FICTIONAL-PROMO',
      email: 'fictional@example.invalid', full_name: 'Fictional Person',
    },
  };
}

async function harness() {
  const requests = [];
  const allRequests = [];
  const serverErrors = [];
  const blocked = [];
  let current = fixture();
  let restFailure = null;
  let authFailure = false;
  let origin;
  let handler;
  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, origin);
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      const record = {
        method: incoming.method, path: url.pathname,
        query: Object.fromEntries(url.searchParams), body,
        authorization: incoming.headers.authorization, apikey: incoming.headers.apikey,
      };
      requests.push(record);
      allRequests.push(record);
      if (url.pathname === '/functions/v1/get-purchase-conversion-receipt') {
        const request = new Request(url, {
          method: incoming.method, headers: incoming.headers,
          ...(['GET', 'HEAD', 'OPTIONS'].includes(incoming.method) ? {} : { body }),
        });
        const response = await handler(request);
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(await response.text());
        return;
      }
      outgoing.setHeader('Content-Type', 'application/json');
      if (url.pathname === '/auth/v1/user') {
        assert.equal(incoming.method, 'GET');
        assert.equal(record.apikey, anonKey);
        if (authFailure || record.authorization !== `Bearer ${token}`) {
          outgoing.writeHead(401);
          outgoing.end(JSON.stringify({ code: 'bad_jwt', msg: 'Fictional invalid or expired token' }));
        } else {
          outgoing.end(JSON.stringify({ id: userId, aud: 'authenticated', email: 'fictional@example.invalid' }));
        }
        return;
      }
      const table = url.pathname.replace('/rest/v1/', '');
      assert.ok(Object.hasOwn(selections, table), `Unexpected route: ${url.pathname}`);
      assert.equal(incoming.method, 'GET', 'Only SELECT requests are allowed');
      assert.equal(record.authorization, `Bearer ${readKey}`);
      assert.equal(record.apikey, readKey);
      assert.equal(body, '');
      assert.equal(record.query.select, selections[table]);
      if (restFailure === table) {
        outgoing.writeHead(500);
        outgoing.end(JSON.stringify({ code: 'XX000', message: 'Fictional read failure' }));
        return;
      }
      const row = {
        stripe_payment_transactions: current.transaction, stripe_webhook_events: current.event,
        purchases: current.transaction?.payment_type === 'course' ? current.business : null,
        diagnostic_ia_orders: current.transaction?.payment_type === 'diagnostic_ia_express' ? current.business : null,
      }[table];
      const matching = row && [...url.searchParams].every(([key, value]) => key === 'select'
        || (value.startsWith('eq.') && String(row[key]) === value.slice(3)));
      // Emulate PostgREST SELECT/projection; maybeSingle transforms []/[row] in the real SDK.
      const projected = matching ? Object.fromEntries(selections[table].split(',').map(key => [key, row[key]])) : null;
      outgoing.end(JSON.stringify(projected ? [projected] : []));
    } catch (error) {
      serverErrors.push(error.message);
      outgoing.writeHead(500, { 'Content-Type': 'application/json' });
      outgoing.end(JSON.stringify({ message: error.message }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  const nativeFetch = globalThis.fetch;
  const localFetch = (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.origin !== origin) {
      blocked.push(url.origin);
      throw new Error('Non-local fetch blocked by isolated integration test');
    }
    // Never follow a redirect out of this fixture server.
    return nativeFetch(input, { ...init, redirect: 'error' });
  };
  globalThis.fetch = localFetch;
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: localFetch } };
  handler = createPurchaseConversionReceiptHandler({
    createAuthClient: () => createClient(origin, anonKey, options),
    createReadClient: () => createClient(origin, readKey, options),
  });
  return {
    requests, allRequests, serverErrors, blocked, origin,
    reset(f = fixture(), failure = null, failAuth = false) {
      current = f; restFailure = failure; authFailure = failAuth; requests.length = 0;
    },
    async call({ method = 'POST', authorization = `Bearer ${token}`, body = { session_id: current.sessionId }, rawBody } = {}) {
      const response = await localFetch(`${origin}/functions/v1/get-purchase-conversion-receipt`, {
        method, headers: { 'Content-Type': 'application/json', ...(authorization == null ? {} : { Authorization: authorization }) },
        ...(['GET', 'HEAD', 'OPTIONS'].includes(method) ? {} : { body: rawBody ?? JSON.stringify(body) }),
      });
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const text = await response.text();
      assert.doesNotMatch(text, /fictional-valid-token|fictional-service-key|fictional-anon-key|fictional@example|Fictional Person|FICTIONAL-PROMO|evt_fictional|cs_live_|11000000|22000000/);
      for (const request of requests.filter(r => r.path.startsWith('/rest/v1/'))) {
        assert.equal(request.method, 'GET');
        assert.equal(request.body, '');
        assert.doesNotMatch(request.path, /\/rpc\//);
      }
      return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
    },
    async close() {
      globalThis.fetch = nativeFetch;
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}

test('HTTP isolated receipt integration with real Supabase SDK', async t => {
  const h = await harness();
  t.after(() => h.close());
  const version = JSON.parse(readFileSync(new URL('../../../node_modules/@supabase/supabase-js/package.json', import.meta.url), 'utf8')).version;
  t.diagnostic(`Installed Supabase SDK: ${version}; HTTP limited to 127.0.0.1 on an ephemeral port.`);

  await t.test('SDK version matches pinned Edge import; JWT gateway is configured (static check only)', () => {
    const endpoint = readFileSync(new URL('../get-purchase-conversion-receipt/index.ts', import.meta.url), 'utf8');
    const config = readFileSync(new URL('../../config.toml', import.meta.url), 'utf8');
    assert.ok(endpoint.includes(`npm:@supabase/supabase-js@${version}'`));
    assert.match(config, /\[functions\.get-purchase-conversion-receipt\]\s*verify_jwt = true/);
  });

  for (const diagnostic of [false, true]) {
    await t.test(`${diagnostic ? 'Diagnostic promotional net' : 'Course'} paid receipt: HTTP/Auth/SELECT and five fields`, async () => {
      const f = fixture(diagnostic); h.reset(f);
      const result = await h.call();
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { receipt: {
        verified: true, transaction_id: transactionId, amount_total_cents: 11900, currency: 'EUR', livemode: true,
      } });
      assert.deepEqual(h.requests.map(r => [r.method, r.path]), [
        ['POST', '/functions/v1/get-purchase-conversion-receipt'], ['GET', '/auth/v1/user'],
        ['GET', '/rest/v1/stripe_payment_transactions'], ['GET', '/rest/v1/stripe_webhook_events'],
        ['GET', `/rest/v1/${diagnostic ? 'diagnostic_ia_orders' : 'purchases'}`],
      ]);
      assert.deepEqual(h.requests[2].query, {
        select: selections.stripe_payment_transactions, user_id: `eq.${userId}`, stripe_checkout_session_id: `eq.${sessionId}`,
      });
      assert.deepEqual(h.requests[3].query, { select: selections.stripe_webhook_events, event_id: 'eq.evt_fictional_paid' });
      const table = diagnostic ? 'diagnostic_ia_orders' : 'purchases';
      assert.deepEqual(h.requests[4].query, {
        select: selections[table], user_id: `eq.${userId}`, id: `eq.${businessId}`, stripe_checkout_session_id: `eq.${sessionId}`,
      });
      assert.equal(f.business.original_amount_cents, 14900);
      assert.equal(f.business.discount_amount_cents, 3000);
      assert.equal(f.business.promo_code, 'FICTIONAL-PROMO');
    });
  }

  for (const [name, authorization] of [['absent', null], ['invalid', 'Bearer fictional-invalid'], ['expired', 'Bearer fictional-expired']]) {
    await t.test(`Token ${name}: no business read`, async () => {
      h.reset(); const result = await h.call({ authorization });
      assert.equal(result.status, 401);
      assert.equal(h.requests.filter(r => r.path.startsWith('/rest/')).length, 0);
      assert.equal(h.requests.filter(r => r.path === '/auth/v1/user').length, authorization ? 1 : 0);
    });
  }

  const cases = {
    'other user transaction': f => { f.transaction.user_id = otherId; },
    'other user purchase': f => { f.business.user_id = otherId; },
    'other transaction session': f => { f.transaction.stripe_checkout_session_id = 'cs_live_other'; },
    'other purchase session': f => { f.business.stripe_checkout_session_id = 'cs_live_other'; },
    'missing transaction': f => { f.transaction = null; },
    'missing event': f => { f.event = null; },
    'missing business': f => { f.business = null; },
    'wrong event ID': f => { f.event.event_id = 'evt_wrong'; },
    'wrong event object': f => { f.event.stripe_object_id = 'cs_live_wrong'; },
    'wrong event type': f => { f.event.event_type = 'refund.updated'; },
    'unprocessed event': f => { f.event.processing_result = 'failed'; },
    'wrong payload hash': f => { f.event.payload_sha256 = 'not-a-valid-hash'; },
    'missing payload hash': f => { f.event.payload_sha256 = null; },
    'test livemode': f => { f.event.livemode = false; },
    'unknown livemode': f => { f.event.livemode = null; },
    'absent livemode': f => { delete f.event.livemode; },
    'wrong business amount': f => { f.business.amount_total = 14900; },
    'zero amount': f => { f.business.amount_total = f.transaction.amount_total = 0; },
    'refunded amount': f => { f.transaction.amount_refunded = 100; },
    'wrong business currency': f => { f.business.currency = 'usd'; },
    'pending purchase despite paid transaction': f => { f.business.payment_status = 'pending'; },
    'test checkout session': f => {
      f.sessionId = f.transaction.stripe_checkout_session_id = f.business.stripe_checkout_session_id = f.event.stripe_object_id = 'cs_test_fictional';
    },
  };
  for (const status of ['pending', 'cancelled', 'refunded', 'partially_refunded', 'disputed', 'chargeback']) {
    cases[`transaction ${status}`] = f => { f.transaction.status = status; };
  }
  for (const [name, mutate] of Object.entries(cases)) {
    await t.test(`No receipt: ${name}`, async () => {
      const f = fixture(); mutate(f); h.reset(f);
      assert.deepEqual(await h.call().then(r => [r.status, r.body]), [200, { receipt: null }]);
      if (name === 'other user transaction' || name === 'other transaction session' || name === 'missing transaction') {
        assert.equal(h.requests.filter(r => r.path.startsWith('/rest/')).length, 1);
      }
    });
  }
  for (const [name, mutate] of Object.entries({
    'final amount mismatch': f => { f.business.final_amount_cents = 14900; },
    'other user': f => { f.business.user_id = otherId; },
    'missing paid date': f => { f.business.paid_at = null; },
    'pending order': f => { f.business.status = 'pending'; },
    'cancelled order': f => { f.business.status = 'cancelled'; },
    'refunded order': f => { f.business.status = 'refunded'; },
    'disputed order': f => { f.business.status = 'disputed'; },
  })) {
    await t.test(`Diagnostic no receipt: ${name}`, async () => {
      const f = fixture(true); mutate(f); h.reset(f);
      assert.deepEqual(await h.call().then(r => [r.status, r.body]), [200, { receipt: null }]);
    });
  }

  for (const body of [{ session_id: sessionId, amount_total: 1 }, { session_id: sessionId, user_id: otherId }, { session_id: 'invalid' }]) {
    await t.test(`Invalid/spoofed request fields: ${Object.keys(body).join(',')}`, async () => {
      h.reset(); const result = await h.call({ body });
      assert.equal(result.status, 400);
      assert.equal(h.requests.filter(r => r.path.startsWith('/rest/')).length, 0);
    });
  }
  await t.test('Malformed JSON does not access business tables', async () => {
    h.reset(); assert.equal((await h.call({ rawBody: '{' })).status, 400);
    assert.equal(h.requests.filter(r => r.path.startsWith('/rest/')).length, 0);
  });
  for (const [method, status] of [['OPTIONS', 204], ['GET', 405], ['PUT', 405], ['DELETE', 405]]) {
    await t.test(`${method}: no-store and no Auth/business access`, async () => {
      h.reset(); const result = await h.call({ method });
      assert.equal(result.status, status);
      assert.equal(h.requests.length, 1);
      assert.equal(result.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
    });
  }
  for (const table of Object.keys(selections)) {
    await t.test(`Read failure ${table}: generic no-store 503`, async () => {
      h.reset(fixture(table === 'diagnostic_ia_orders'), table);
      const result = await h.call();
      assert.deepEqual(result, { ...result, status: 503, body: { error: 'Vérification temporairement indisponible.' } });
      assert.equal(h.requests.at(-1).path, `/rest/v1/${table}`);
    });
  }
  await t.test('Fetch isolation blocks a non-local URL before any network access', async () => {
    h.reset();
    assert.throws(() => globalThis.fetch('https://network-forbidden.invalid'), /Non-local fetch blocked/);
    assert.deepEqual(h.blocked, ['https://network-forbidden.invalid']);
    assert.equal(h.requests.length, 0);
  });
  await t.test('All recorded SDK requests were authorized reads and fixture server assertions passed', () => {
    assert.deepEqual(h.serverErrors, [], 'Fixture assertion errors must not masquerade as expected handler errors');
    const upstream = h.allRequests.filter(r => !r.path.startsWith('/functions/'));
    assert.ok(upstream.length > 0);
    assert.ok(upstream.every(r => r.method === 'GET' && (r.path === '/auth/v1/user'
      || Object.hasOwn(selections, r.path.replace('/rest/v1/', '')))));
    t.diagnostic(`Recorded ${h.allRequests.length} local HTTP requests, including ${upstream.length} SDK Auth/SELECT requests; zero external requests.`);
  });
});
