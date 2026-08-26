import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { validateWithdrawalRequestPayload } from '../_shared/withdrawalValidation.js';
import { attemptWithdrawalReceiptDelivery } from '../_shared/smtpReceipt.js';

const RECEIPT_COLUMNS = 'id, purchase_id, diagnostic_order_id, course_id, claimant_first_name, claimant_last_name, declaration, status, received_at, acknowledgement_email, acknowledgement_delivery_status, acknowledgement_delivered_at, acknowledgement_delivery_attempted_at';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connexion requise.' }, 401);

    const payload = await request.json().catch(() => ({}));
    const validationError = validateWithdrawalRequestPayload(payload);
    if (validationError) return jsonResponse({ error: validationError }, 400);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAuth = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !authData.user?.id) return jsonResponse({ error: 'Session invalide ou expirée.' }, 401);

    const supabaseAdmin = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let purchase = null;
    let diagnosticOrder = null;
    if (payload.purchase_id) {
      const result = await supabaseAdmin
        .from('purchases')
        .select('id, user_id, course_id, stripe_checkout_session_id')
        .eq('id', payload.purchase_id)
        .eq('user_id', authData.user.id)
        .maybeSingle();
      if (result.error) throw result.error;
      purchase = result.data;
    } else {
      const result = await supabaseAdmin
        .from('diagnostic_ia_orders')
        .select('id, user_id, status, sales_context')
        .eq('id', payload.diagnostic_order_id)
        .eq('user_id', authData.user.id)
        .eq('sales_context', 'personal')
        .in('status', ['paid', 'disputed'])
        .maybeSingle();
      if (result.error) throw result.error;
      diagnosticOrder = result.data;
    }
    if (!purchase && !diagnosticOrder) {
      return jsonResponse({ error: 'La demande ne peut pas être traitée avec les informations fournies.' }, 400);
    }

    const { data: existingRequest, error: existingError } = await supabaseAdmin
      .from('withdrawal_requests')
      .select(RECEIPT_COLUMNS)
      .eq(purchase ? 'purchase_id' : 'diagnostic_order_id', purchase?.id || diagnosticOrder.id)
      .eq('user_id', authData.user.id)
      .in('status', ['received', 'under_review', 'accepted'])
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingRequest) return jsonResponse({ receipt: existingRequest, alreadyReceived: true });

    const rateLimitSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: recentCount, error: rateLimitError } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authData.user.id)
      .gte('received_at', rateLimitSince);
    if (rateLimitError) throw rateLimitError;
    if ((recentCount || 0) >= 5) {
      return jsonResponse({ error: 'Trop de demandes rapprochées. Réessayez ultérieurement.' }, 429);
    }

    let checkoutIntentId = null;
    if (purchase?.stripe_checkout_session_id) {
      const { data: intent, error: intentError } = await supabaseAdmin
        .from('commercial_checkout_intents')
        .select('id')
        .eq('stripe_checkout_session_id', purchase.stripe_checkout_session_id)
        .maybeSingle();
      if (intentError) throw intentError;
      checkoutIntentId = intent?.id || null;
    }

    let { data: receipt, error: insertError } = await supabaseAdmin
      .from('withdrawal_requests')
      .insert({
        user_id: authData.user.id,
        purchase_id: purchase?.id || null,
        diagnostic_order_id: diagnosticOrder?.id || null,
        checkout_intent_id: checkoutIntentId,
        course_id: purchase?.course_id || 'diagnostic-ia-express',
        claimant_first_name: String(payload.first_name).trim(),
        claimant_last_name: String(payload.last_name).trim(),
        acknowledgement_email: String(payload.acknowledgement_email).trim().toLowerCase(),
        declaration: String(payload.declaration).trim(),
      })
      .select(RECEIPT_COLUMNS)
      .single();
    if (insertError?.code === '23505') {
      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from('withdrawal_requests')
        .select(RECEIPT_COLUMNS)
        .eq(purchase ? 'purchase_id' : 'diagnostic_order_id', purchase?.id || diagnosticOrder.id)
        .eq('user_id', authData.user.id)
        .in('status', ['received', 'under_review', 'accepted'])
        .maybeSingle();
      if (duplicateError || !duplicate) throw duplicateError || insertError;
      return jsonResponse({ receipt: duplicate, alreadyReceived: true });
    }
    if (insertError || !receipt) throw insertError || new Error('withdrawal_insert_failed');

    const deliveryUpdate = await attemptWithdrawalReceiptDelivery(receipt);
    if (deliveryUpdate.acknowledgement_delivery_status === 'failed') {
      console.warn(`withdrawal_receipt_delivery:${deliveryUpdate.acknowledgement_delivery_error_code}`);
    }

    const { data: updatedReceipt, error: deliveryUpdateError } = await supabaseAdmin
      .from('withdrawal_requests')
      .update(deliveryUpdate)
      .eq('id', receipt.id)
      .select(RECEIPT_COLUMNS)
      .single();
    if (deliveryUpdateError) {
      console.warn('withdrawal_receipt_delivery_status_update_failed');
    } else {
      receipt = updatedReceipt;
    }

    // Aucun remboursement Stripe et aucune modification de course_access ici.
    return jsonResponse({
      receipt,
      durableDelivery: 'download_available',
      emailDelivery: receipt.acknowledgement_delivery_status,
    }, 201);
  } catch (error) {
    console.error('submit_withdrawal_request_failed');
    return jsonResponse({ error: 'Impossible d’enregistrer la demande pour le moment.' }, 500);
  }
});
