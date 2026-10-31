import { InputError, requiredUuid } from './httpInput.js';
import { createNotificationStore, deliverAdminNotification } from './adminEmailNotifications.js';

export async function notificationAction(input, database, options) {
  if (input.action === 'list') {
    const [open, recent] = await Promise.all([
      database.from('admin_email_notifications').select('*').in('status',['pending','sending','failed','uncertain']).order('created_at',{ascending:true}).limit(51),
      database.from('admin_email_notifications').select('*').eq('status','sent').order('sent_at',{ascending:false}).limit(10),
    ]);
    if (open.error || recent.error) throw new Error('notification_list_unavailable');
    return { rows:[...(open.data || []).slice(0,50),...(recent.data || [])], hasMore:(open.data || []).length > 50 };
  }
  if (input.action !== 'retry') throw new InputError('Action invalide.');
  const id = requiredUuid(input.id);
  const { data: row, error } = await database.from('admin_email_notifications').select('*').eq('id',id).maybeSingle();
  if (error) throw error;
  if (!row) throw new InputError('Notification introuvable.',404);
  if (row.status === 'sent') return { status:'sent' };
  const stale = row.status === 'sending' && row.attempted_at && Date.now()-Date.parse(row.attempted_at) > 2*60_000;
  if (row.status === 'uncertain' || stale) {
    if (input.acknowledgePossibleDuplicate !== true) throw new InputError('Vérifiez la boîte de réception avant de confirmer une nouvelle tentative : un doublon est possible.',409);
  } else if (!['pending','failed'].includes(row.status)) throw new InputError('Un envoi est déjà en cours.',409);
  if (row.status !== 'pending') {
    const { data, error: updateError } = await database.from('admin_email_notifications')
      .update({status:'pending',updated_at:new Date().toISOString()}).eq('id',id).eq('status',row.status).eq('attempts',row.attempts).select('id').maybeSingle();
    if (updateError) throw updateError;
    if (!data) return { status:'unchanged' };
  }
  return deliverAdminNotification(createNotificationStore(database),id,options);
}
