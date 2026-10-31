import { jsonResponse } from '../_shared/cors.ts';
import { requireMailAdmin } from '../_shared/requireMailAdmin.ts';
import { InputError, readBoundedBody } from '../_shared/httpInput.js';
import { notificationAction } from '../_shared/adminNotificationActions.js';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({});
  if (request.method !== 'POST') return jsonResponse({error:'Méthode non autorisée.'},405);
  try {
    const { database } = await requireMailAdmin(request);
    const input = JSON.parse(new TextDecoder().decode(await readBoundedBody(request,4096)));
    return jsonResponse(await notificationAction(input,database));
  } catch (error) {
    if (error instanceof InputError) return jsonResponse({error:error.message},error.status);
    console.error('admin_notification_action_unavailable');
    return jsonResponse({error:'Le suivi des notifications est indisponible.'},503);
  }
});
