import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  buildQuoteEmail,
  buildQuoteSnapshot,
  communicationKey,
  QUOTE_STATUSES,
  validateQuoteInput,
  validateRequestUpdate,
} from '../_shared/commercialCycle.js';
import { sendCommercialEmail, smtpFailureCode } from '../_shared/smtpReceipt.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Action commerciale invalide.';
}

function requiredId(value: unknown, label: string) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) throw new Error(`${label} invalide.`);
  return id;
}

function boundedText(value: unknown, label: string, max: number) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < 2 || normalized.length > max) throw new Error(`${label} invalide.`);
  return normalized;
}

function relatedEmail(relation: unknown) {
  const row = Array.isArray(relation) ? relation[0] : relation;
  const value = row && typeof row === 'object' ? (row as { email?: unknown }).email : null;
  return typeof value === 'string' ? value.toLowerCase() : '';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return jsonResponse({ error: 'Connexion administrative requise.' }, 401);

    const url = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user?.id) return jsonResponse({ error: 'Session invalide ou expirée.' }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: actor, error: actorError } = await admin.from('profiles')
      .select('id, role').eq('id', authData.user.id).maybeSingle();
    if (actorError) throw actorError;
    if (!actor || !['admin', 'employee'].includes(actor.role)) {
      return jsonResponse({ error: 'Action réservée au personnel autorisé.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';
    const requestId = requiredId(body.requestId, 'Demande');
    const { data: commercialRequest, error: requestError } = await admin.from('contact_requests')
      .select('*').eq('id', requestId).maybeSingle();
    if (requestError) throw requestError;
    if (!commercialRequest) return jsonResponse({ error: 'Demande introuvable.' }, 404);

    const addHistory = async (eventType: string, details: Record<string, unknown> = {}, previousStatus?: string, newStatus?: string) => {
      const { error } = await admin.from('commercial_request_history').insert({
        contact_request_id: requestId,
        actor_user_id: actor.id,
        event_type: eventType,
        previous_status: previousStatus || null,
        new_status: newStatus || null,
        details,
      });
      if (error) throw error;
    };

    if (action === 'update_request') {
      const update = validateRequestUpdate(body.request);
      if (update.status === 'won') throw new Error('La demande devient gagnée uniquement lors d’une conversion vérifiée.');
      const { data, error } = await admin.from('contact_requests').update({
        ...update, assigned_to: actor.id, updated_at: new Date().toISOString(),
      }).eq('id', requestId).select('*').single();
      if (error) throw error;
      await addHistory(
        commercialRequest.status === update.status ? 'qualified' : 'status_changed',
        { requestType: update.request_type, courseId: update.course_id },
        commercialRequest.status,
        update.status || undefined,
      );
      return jsonResponse({ request: data });
    }

    if (action === 'create_quote') {
      if (['won', 'lost'].includes(commercialRequest.status)) throw new Error('Cette demande est clôturée.');
      const quoteInput = validateQuoteInput(body.quote, commercialRequest);
      const { data: quote, error } = await admin.from('commercial_quotes').insert({
        contact_request_id: requestId, ...quoteInput, created_by: actor.id,
      }).select('*').single();
      if (error) throw error;
      await addHistory('quote_created', { quoteId: quote.id, quoteNumber: quote.quote_number });
      return jsonResponse({ quote }, 201);
    }

    const quoteId = ['update_quote', 'send_quote', 'set_quote_status'].includes(action)
      ? requiredId(body.quoteId, 'Devis') : null;
    let quote = null;
    if (quoteId) {
      const result = await admin.from('commercial_quotes').select('*')
        .eq('id', quoteId).eq('contact_request_id', requestId).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return jsonResponse({ error: 'Devis introuvable pour cette demande.' }, 404);
      quote = result.data;
    }

    if (action === 'update_quote') {
      if (quote.status !== 'draft') throw new Error('Un devis envoyé est figé et ne peut plus être modifié.');
      const quoteInput = validateQuoteInput(body.quote, commercialRequest);
      const { data, error } = await admin.from('commercial_quotes').update({
        ...quoteInput, version: quote.version + 1, updated_at: new Date().toISOString(),
      }).eq('id', quote.id).eq('version', quote.version).select('*').single();
      if (error) throw error;
      await addHistory('quote_updated', { quoteId: quote.id, version: data.version });
      return jsonResponse({ quote: data });
    }

    if (action === 'send_quote') {
      if (quote.status !== 'draft') return jsonResponse({ error: 'Ce devis a déjà été envoyé ou clôturé.' }, 409);
      const sentAt = new Date().toISOString();
      const snapshot = buildQuoteSnapshot(quote, sentAt);
      const email = buildQuoteEmail(snapshot);
      const key = communicationKey('quote', quote.id, quote.version);
      const { data: communication, error: communicationError } = await admin.from('commercial_communications').insert({
        contact_request_id: requestId,
        quote_id: quote.id,
        communication_type: 'quote',
        recipient_email: quote.client_email,
        subject: email.subject,
        body: email.body,
        delivery_status: 'sending',
        idempotency_key: key,
        prepared_by: actor.id,
        attempted_at: sentAt,
      }).select('*').single();
      if (communicationError) {
        if (communicationError.code === '23505') return jsonResponse({ error: 'Ce devis a déjà fait l’objet d’un envoi.' }, 409);
        throw communicationError;
      }
      try {
        await sendCommercialEmail({
          recipientEmail: quote.client_email, subject: email.subject, body: email.body,
          messageId: `commercial-${communication.id}`,
        });
      } catch (error) {
        await admin.from('commercial_communications').update({
          delivery_status: 'failed', error_code: smtpFailureCode(error), attempted_at: sentAt,
        }).eq('id', communication.id);
        await addHistory('email_failed', { communicationId: communication.id, quoteId: quote.id });
        return jsonResponse({ error: 'L’e-mail n’a pas été remis. Aucun nouvel envoi automatique ne sera tenté.' }, 502);
      }
      const { data: sentQuote, error: quoteError } = await admin.from('commercial_quotes').update({
        status: 'sent', sent_snapshot: snapshot, sent_at: sentAt, sent_by: actor.id, updated_at: sentAt,
      }).eq('id', quote.id).eq('status', 'draft').select('*').single();
      if (quoteError) throw quoteError;
      await admin.from('commercial_communications').update({
        delivery_status: 'sent', sent_at: sentAt, provider_message_id: `commercial-${communication.id}`,
      }).eq('id', communication.id);
      await admin.from('contact_requests').update({ status: 'quote_sent', updated_at: sentAt }).eq('id', requestId);
      await addHistory('quote_sent', { quoteId: quote.id, communicationId: communication.id }, commercialRequest.status, 'quote_sent');
      return jsonResponse({ quote: sentQuote, communicationId: communication.id });
    }

    if (action === 'set_quote_status') {
      const nextStatus = typeof body.status === 'string' ? body.status : '';
      if (!QUOTE_STATUSES.has(nextStatus) || !['accepted', 'refused', 'expired'].includes(nextStatus)) {
        throw new Error('Statut de devis invalide.');
      }
      if (quote.status !== 'sent') throw new Error('Seul un devis envoyé peut recevoir cette décision.');
      const now = new Date().toISOString();
      const update = {
        status: nextStatus,
        accepted_at: nextStatus === 'accepted' ? now : null,
        refused_at: nextStatus === 'refused' ? now : null,
        updated_at: now,
      };
      const { data, error } = await admin.from('commercial_quotes').update(update)
        .eq('id', quote.id).eq('status', 'sent').select('*').single();
      if (error) throw error;
      const requestStatus = nextStatus === 'refused' ? 'lost' : (nextStatus === 'accepted' ? 'processing' : commercialRequest.status);
      if (requestStatus !== commercialRequest.status) {
        await admin.from('contact_requests').update({ status: requestStatus, updated_at: now }).eq('id', requestId);
      }
      await addHistory('quote_status_changed', { quoteId: quote.id, status: nextStatus }, commercialRequest.status, requestStatus);
      return jsonResponse({ quote: data, requestStatus });
    }

    if (action === 'schedule_follow_up') {
      if (['won', 'lost'].includes(commercialRequest.status)) throw new Error('Aucune relance sur une demande clôturée.');
      const scheduledFor = new Date(body.scheduledFor);
      if (Number.isNaN(scheduledFor.getTime()) || scheduledFor < new Date(Date.now() - 5 * 60_000)) throw new Error('Date de relance invalide.');
      const subject = boundedText(body.subject, 'Objet', 300);
      const message = boundedText(body.message, 'Message', 10000);
      const key = communicationKey('follow-up', requestId, scheduledFor.getTime());
      const { data, error } = await admin.from('commercial_follow_ups').insert({
        contact_request_id: requestId,
        quote_id: body.quoteId || null,
        scheduled_for: scheduledFor.toISOString(), subject, body: message,
        idempotency_key: key, created_by: actor.id,
      }).select('*').single();
      if (error) {
        if (error.code === '23505') return jsonResponse({ error: 'Cette relance est déjà programmée.' }, 409);
        throw error;
      }
      await addHistory('follow_up_scheduled', { followUpId: data.id, scheduledFor: data.scheduled_for });
      return jsonResponse({ followUp: data }, 201);
    }

    if (action === 'send_follow_up') {
      const followUpId = requiredId(body.followUpId, 'Relance');
      const { data: followUp, error } = await admin.from('commercial_follow_ups').select('*')
        .eq('id', followUpId).eq('contact_request_id', requestId).maybeSingle();
      if (error) throw error;
      if (!followUp || followUp.status !== 'scheduled') return jsonResponse({ error: 'Cette relance a déjà été traitée.' }, 409);
      const attemptedAt = new Date().toISOString();
      const { data: communication, error: insertError } = await admin.from('commercial_communications').insert({
        contact_request_id: requestId,
        quote_id: followUp.quote_id,
        communication_type: 'follow_up',
        recipient_email: commercialRequest.email,
        subject: followUp.subject,
        body: followUp.body,
        delivery_status: 'sending',
        idempotency_key: followUp.idempotency_key,
        prepared_by: actor.id,
        attempted_at: attemptedAt,
      }).select('*').single();
      if (insertError) return jsonResponse({ error: 'Cette relance a déjà fait l’objet d’un envoi.' }, 409);
      try {
        await sendCommercialEmail({
          recipientEmail: commercialRequest.email, subject: followUp.subject, body: followUp.body,
          messageId: `commercial-${communication.id}`,
        });
      } catch (sendError) {
        await admin.from('commercial_communications').update({ delivery_status: 'failed', error_code: smtpFailureCode(sendError) }).eq('id', communication.id);
        await admin.from('commercial_follow_ups').update({ status: 'failed' }).eq('id', followUp.id);
        await addHistory('email_failed', { followUpId, communicationId: communication.id });
        return jsonResponse({ error: 'La relance n’a pas été remise et ne sera pas renvoyée automatiquement.' }, 502);
      }
      await admin.from('commercial_communications').update({ delivery_status: 'sent', sent_at: attemptedAt }).eq('id', communication.id);
      await admin.from('commercial_follow_ups').update({ status: 'sent', sent_at: attemptedAt, communication_id: communication.id }).eq('id', followUp.id);
      await admin.from('contact_requests').update({ status: 'follow_up', updated_at: attemptedAt }).eq('id', requestId);
      await addHistory('follow_up_sent', { followUpId, communicationId: communication.id }, commercialRequest.status, 'follow_up');
      return jsonResponse({ communicationId: communication.id });
    }

    if (action === 'convert_stripe') {
      const purchaseId = requiredId(body.purchaseId, 'Achat');
      const { data: purchase, error } = await admin.from('purchases')
        .select('id, user_id, course_id, payment_status, profiles!purchases_user_id_fkey(email)')
        .eq('id', purchaseId).maybeSingle();
      if (error) throw error;
      if (!purchase || purchase.payment_status !== 'paid') throw new Error('Achat Stripe payé introuvable.');
      if (relatedEmail(purchase.profiles) !== commercialRequest.email.toLowerCase()) throw new Error('L’achat ne correspond pas au demandeur.');
      if (commercialRequest.course_id && commercialRequest.course_id !== purchase.course_id) throw new Error('La formation de l’achat ne correspond pas à la demande.');
      const { data: access, error: accessError } = await admin.from('course_access')
        .select('id, status, expires_at').eq('purchase_id', purchase.id).eq('user_id', purchase.user_id).eq('course_id', purchase.course_id).maybeSingle();
      if (accessError) throw accessError;
      if (!access || access.status !== 'active' || (access.expires_at && new Date(access.expires_at) <= new Date())) {
        throw new Error('Le droit pédagogique actif issu de cet achat est introuvable. Aucune réactivation automatique n’est permise.');
      }
      const now = new Date().toISOString();
      const { data, error: updateError } = await admin.from('contact_requests').update({
        status: 'won', converted_at: now, conversion_kind: 'stripe', converted_purchase_id: purchase.id, updated_at: now,
      }).eq('id', requestId).select('*').single();
      if (updateError) throw updateError;
      await addHistory('converted', { kind: 'stripe', purchaseId: purchase.id, courseAccessId: access.id }, commercialRequest.status, 'won');
      return jsonResponse({ request: data, courseAccessId: access.id });
    }

    return jsonResponse({ error: 'Action inconnue.' }, 400);
  } catch (error) {
    console.error('admin-commercial-cycle:', error);
    const message = safeMessage(error);
    const status = /invalide|requis|introuvable|clôturée|figé|correspond|permi/i.test(message) ? 400 : 500;
    return jsonResponse({ error: status === 400 ? message : 'L’action commerciale ne peut pas être traitée pour le moment.' }, status);
  }
});
