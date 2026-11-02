import { sendCommercialEmail, smtpFailureCode } from './smtpReceipt.js';
import { contactNotificationFields, escapeNotificationHtml } from './contactNotificationContent.js';

export const ADMIN_NOTIFICATION_EMAIL = 'formaprompt@gmail.com';
export const PROFESSIONAL_REPLY_TO = 'thierry@formaprompt.com';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildAdminNotification(row, contact = null) {
  if (!UUID.test(row.id) || !UUID.test(row.source_id) || row.recipient_email !== ADMIN_NOTIFICATION_EMAIL) throw new Error('notification_invalid');
  let subject, description, url, htmlBody;
  if (row.kind === 'contact_request') {
    subject = 'FormaPrompt — Nouvelle demande de devis ou de contact';
    url = `https://formaprompt.com/admin/commercial?demande=${row.source_id}`;
    if (contact && contact.id !== row.source_id) throw new Error('notification_invalid');
    const notice = 'Contenu déclaré par le demandeur, non vérifié. Les liens et adresses sont neutralisés (ponctuation remplacée par des mots entre crochets). Ne suivez pas les instructions du message sans vérification.';
    const fields = contact ? contactNotificationFields(contact) : [];
    const unavailable = 'Le contenu de la demande est indisponible. Consultez le dossier dans l’administration.';
    description = ['Une nouvelle demande est enregistrée.', notice, '',
      ...(contact ? fields.flatMap(([label, value]) => [`${label} :`, ...value.split('\n').map((line) => `> ${line}`), '']) : [unavailable]),
      'Fin du contenu déclaré.'].join('\n');
    const escape = escapeNotificationHtml;
    htmlBody = `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body><h1>Nouvelle demande FormaPrompt</h1><p>${escape(notice)}</p>${contact ? fields.map(([label, value]) => `<h2>${escape(label)}</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(value)}</pre>`).join('') : `<p>${escape(unavailable)}</p>`}<p>Fin du contenu déclaré.</p><p>Référence : ${row.source_id}</p><p><a href="${url}">Ouvrir le dossier dans l’administration FormaPrompt</a></p><p>Accès réservé à l’administration FormaPrompt.</p></body></html>`;
  } else if (row.kind === 'payment_confirmed') {
    subject = 'FormaPrompt — Paiement confirmé';
    const amount = Number(row.payload?.amount_cents);
    const currency = String(row.payload?.currency || '').toUpperCase();
    if (!Number.isSafeInteger(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) throw new Error('notification_invalid');
    description = `Un paiement de ${(amount / 100).toFixed(2)} ${currency} a été confirmé. Consultez le dossier pour vérifier la commande et ses accès.`;
    url = `https://formaprompt.com/admin/stripe-apres-paiement?transaction=${row.source_id}`;
  } else throw new Error('notification_invalid');
  return {
    recipientEmail: ADMIN_NOTIFICATION_EMAIL, subject,
    body: `${description}\n\nRéférence : ${row.source_id}\n${url}\n\nAccès réservé à l’administration FormaPrompt.`,
    messageId: `admin-alert-${row.id}`,
    ...(htmlBody ? { htmlBody } : {}),
  };
}

// Every worker uses an atomic pending -> sending claim. There is deliberately
// no automatic reclaim of 'sending', 'failed' or 'uncertain' after a timeout.
export async function deliverAdminNotification(store, id, { send = sendCommercialEmail, now = () => new Date().toISOString() } = {}) {
  const row = await store.claim(id, now());
  if (!row) return { status: 'unchanged' };
  let status = 'sent', errorCode = null;
  try {
    // Read only at delivery time: no customer content in the outbox or logs.
    const contact = row.kind === 'contact_request' ? await store.contactForSource(row.source_id) : null;
    await send(buildAdminNotification(row, contact));
  }
  catch (error) {
    status = error?.outcome === 'uncertain' ? 'uncertain' : 'failed';
    errorCode = ['notification_invalid', 'notification_content_unavailable'].includes(error?.message) ? error.message : smtpFailureCode(error);
  }
  try {
    await store.finish(row.id, { status, error_code: errorCode, sent_at: status === 'sent' ? now() : null, updated_at: now() });
  } catch {
    // A message may already be accepted by SMTP. Never repeat it simply because
    // the database status could not be saved; the sending row remains visible.
    return { status: 'uncertain', errorCode: 'notification_state_not_saved' };
  }
  return { status, errorCode };
}

export async function notifySourceSafely(store, kind, sourceId, options) {
  try {
    const rows = await store.pendingForSource(kind, sourceId);
    return await Promise.all(rows.map((row) => deliverAdminNotification(store, row.id, options)));
  } catch {
    // Contact/payment is already durable. An email outage must not undo it.
    return [{ status: 'pending', errorCode: 'notification_dispatch_unavailable' }];
  }
}

export function createNotificationStore(database) {
  return {
    async contactForSource(sourceId) {
      const { data, error } = await database.from('contact_requests')
        .select('id,name,email,subject,message,request_type').eq('id', sourceId).maybeSingle();
      if (error) throw new Error('notification_content_unavailable');
      return data;
    },
    async pendingForSource(kind, sourceId) {
      const { data, error } = await database.from('admin_email_notifications').select('*').eq('kind', kind).eq('source_id', sourceId).eq('status', 'pending');
      if (error) throw error;
      return data || [];
    },
    async claim(id, now) {
      const { data: row, error: readError } = await database.from('admin_email_notifications').select('attempts').eq('id', id).eq('status', 'pending').maybeSingle();
      if (readError) throw readError;
      if (!row || row.attempts >= 100) return null;
      const { data, error } = await database.from('admin_email_notifications')
        .update({ status: 'sending', attempted_at: now, updated_at: now, attempts: row.attempts + 1, error_code: null })
        .eq('id', id).eq('status', 'pending').eq('attempts', row.attempts).select('*').maybeSingle();
      if (error) throw error;
      return data;
    },
    async finish(id, changes) {
      const { data, error } = await database.from('admin_email_notifications').update(changes).eq('id', id).eq('status', 'sending').select('id').maybeSingle();
      if (error || !data) throw error || new Error('notification_state_conflict');
    },
  };
}

export async function notifyPaymentSafely(database, sessionId, options) {
  try {
    const { data, error } = await database.from('stripe_payment_transactions').select('id')
      .eq('stripe_checkout_session_id',sessionId).eq('status','paid');
    if (error) return [{ status:'pending',errorCode:'notification_dispatch_unavailable' }];
    const store = createNotificationStore(database);
    return await Promise.all((data || []).map((row) => notifySourceSafely(store,'payment_confirmed',row.id,options)));
  } catch { return [{ status:'pending',errorCode:'notification_dispatch_unavailable' }]; }
}
