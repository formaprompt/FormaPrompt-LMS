import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { jsonResponse } from '../_shared/cors.ts';
import { InputError, readBoundedBody } from '../_shared/httpInput.js';
import { createContactStore, submitContact } from '../_shared/contactSubmission.js';
import { createNotificationStore, notifySourceSafely } from '../_shared/adminEmailNotifications.js';
declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({});
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' },405);
  const origin = request.headers.get('origin');
  if (origin && !['https://formaprompt.com','https://www.formaprompt.com'].includes(origin)) return jsonResponse({ error:'Origine non autorisée.' },403);
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new InputError('Format de requête invalide.');
    const bytes = await readBoundedBody(request, 48 * 1024);
    const input = JSON.parse(new TextDecoder().decode(bytes));
    const database = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{ auth:{ persistSession:false,autoRefreshToken:false } });
    const outbox = createNotificationStore(database);
    const result = await submitContact(input, {
      store: createContactStore(database),
      notify: (id: string) => notifySourceSafely(outbox,'contact_request',id),
      defer: (task: Promise<unknown>) => EdgeRuntime.waitUntil(task),
    });
    return jsonResponse(result,202);
  } catch (error) {
    if (error instanceof InputError) return jsonResponse({ error:error.message },error.status);
    // Never log request contents, customer email, SMTP details or credentials.
    console.error('contact_submission_unavailable');
    return jsonResponse({ error:'Votre demande ne peut pas être enregistrée pour le moment.' },503);
  }
});
