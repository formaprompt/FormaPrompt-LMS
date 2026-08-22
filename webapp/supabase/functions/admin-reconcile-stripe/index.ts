import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { stripeReconciliationWindow } from '../_shared/stripePostPayment.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

function reconciliationKey() {
  const key = requiredEnv('STRIPE_RECONCILIATION_READ_KEY');
  if (!key.startsWith('rk_test_') && !key.startsWith('rk_live_')) {
    throw new Error('La réconciliation exige une clé Stripe restreinte en lecture seule.');
  }
  return key;
}

function safeCourseId(value: unknown) {
  return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 100
    ? value.trim()
    : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return jsonResponse({ error: 'Connexion administrative requise.' }, 401);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user?.id) return jsonResponse({ error: 'Session invalide ou expirée.' }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: actor, error: actorError } = await admin.from('profiles')
      .select('id, role').eq('id', authData.user.id).maybeSingle();
    if (actorError) throw actorError;
    if (!actor || actor.role !== 'admin') {
      return jsonResponse({ error: 'Action réservée au rôle administrateur.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const windowStart = stripeReconciliationWindow(body.created_after);
    const stripe = new Stripe(reconciliationKey());
    const remotePayments: Stripe.PaymentIntent[] = [];
    let startingAfter: string | undefined;
    let complete = true;

    for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
      const page = await stripe.paymentIntents.list({
        limit: 100,
        created: { gte: Math.floor(windowStart.getTime() / 1000) },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      remotePayments.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data.at(-1)?.id;
      if (pageNumber === 9) complete = false;
    }

    const { data: localRows, error: localError } = await admin
      .from('stripe_payment_transactions')
      .select('id,purchase_id,user_id,course_id,stripe_payment_intent_id,status,amount_total,currency,created_at')
      .gte('created_at', windowStart.toISOString());
    if (localError) throw localError;

    const localByIntent = new Map((localRows || [])
      .filter((row) => row.stripe_payment_intent_id)
      .map((row) => [row.stripe_payment_intent_id, row]));
    const remoteByIntent = new Map(remotePayments.map((payment) => [payment.id, payment]));
    const cases: Record<string, unknown>[] = [];

    for (const payment of remotePayments) {
      const courseId = safeCourseId(payment.metadata?.course_id);
      if (!courseId && payment.metadata?.payment_type !== 'in_person_travel_fee') continue;
      const local = localByIntent.get(payment.id);
      if (!local) {
        cases.push({
          deduplication_key: `remote-missing-local:${payment.id}`,
          case_type: 'stripe_remote_payment_missing_local',
          severity: payment.status === 'succeeded' ? 'critical' : 'high',
          summary: 'Un PaymentIntent Stripe n’existe pas dans le registre financier local.',
          details: {
            payment_intent_id: payment.id,
            stripe_status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
          },
          course_id: courseId,
          last_seen_at: new Date().toISOString(),
        });
        continue;
      }

      const amountMismatch = local.amount_total !== payment.amount;
      const currencyMismatch = local.currency !== payment.currency;
      const successMismatch = payment.status === 'succeeded'
        && !['paid', 'partially_refunded', 'refunded', 'disputed', 'dispute_won', 'dispute_lost'].includes(local.status);
      if (amountMismatch || currencyMismatch || successMismatch) {
        cases.push({
          deduplication_key: `remote-status-mismatch:${payment.id}`,
          case_type: 'stripe_remote_mismatch',
          severity: 'critical',
          summary: 'Stripe et le registre financier local présentent des valeurs différentes.',
          details: {
            payment_intent_id: payment.id,
            stripe_status: payment.status,
            local_status: local.status,
            stripe_amount: payment.amount,
            local_amount: local.amount_total,
            stripe_currency: payment.currency,
            local_currency: local.currency,
          },
          transaction_id: local.id,
          purchase_id: local.purchase_id,
          user_id: local.user_id,
          course_id: local.course_id,
          last_seen_at: new Date().toISOString(),
        });
      }
    }

    if (complete) {
      for (const local of localRows || []) {
        if (
          local.stripe_payment_intent_id
          && ['paid', 'partially_refunded', 'refunded', 'disputed', 'dispute_won', 'dispute_lost'].includes(local.status)
          && !remoteByIntent.has(local.stripe_payment_intent_id)
        ) {
          cases.push({
            deduplication_key: `local-missing-remote:${local.stripe_payment_intent_id}`,
            case_type: 'local_payment_missing_stripe',
            severity: 'critical',
            summary: 'Une transaction locale n’a pas été retrouvée dans la fenêtre Stripe contrôlée.',
            details: { payment_intent_id: local.stripe_payment_intent_id },
            transaction_id: local.id,
            purchase_id: local.purchase_id,
            user_id: local.user_id,
            course_id: local.course_id,
            last_seen_at: new Date().toISOString(),
          });
        }
      }
    }

    if (cases.length > 0) {
      const { error: casesError } = await admin.from('stripe_reconciliation_cases')
        .upsert(cases, { onConflict: 'deduplication_key' });
      if (casesError) throw casesError;
    }

    const { error: auditError } = await admin.from('audit_log').insert({
      actor_user_id: actor.id,
      action_type: 'stripe_remote_reconciliation_run',
      target_type: 'stripe_reconciliation',
      target_id: crypto.randomUUID(),
      reason: 'Comparaison Stripe en lecture seule lancée par un administrateur.',
      metadata: {
        created_after: windowStart.toISOString(),
        remote_count: remotePayments.length,
        local_count: localRows?.length || 0,
        detected_count: cases.length,
        complete,
      },
    });
    if (auditError) throw auditError;

    return jsonResponse({
      ok: true,
      created_after: windowStart.toISOString(),
      remote_count: remotePayments.length,
      local_count: localRows?.length || 0,
      detected_count: cases.length,
      complete,
    });
  } catch (error) {
    console.error('admin-reconcile-stripe:', error);
    return jsonResponse({ error: 'La réconciliation Stripe est indisponible.' }, 500);
  }
});
