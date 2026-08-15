import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  privacyExecutionErrorCode,
  validatePrivacyExecutionInput,
} from '../_shared/privacyAdministration.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  let requestId = '';
  let confirmation = '';
  try {
    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connexion administrative requise.' }, 401);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAnonKey = requiredEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !authData.user?.id) return jsonResponse({ error: 'Session invalide ou expirée.' }, 401);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: actor, error: actorError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (actorError) throw actorError;
    if (!actor || actor.role !== 'admin') {
      return jsonResponse({ error: 'Cette action est réservée à l’administrateur.' }, 403);
    }

    const input = validatePrivacyExecutionInput(await request.json().catch(() => null));
    requestId = input.requestId;
    confirmation = input.confirmation;

    const adminRpc = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: execution, error: executionError } = await adminRpc.rpc('admin_execute_privacy_request', {
      p_request_id: requestId,
      p_confirmation: confirmation,
      p_execution_reason: input.reason,
    });
    if (executionError) throw executionError;

    const { data: authAction, error: authActionError } = await adminRpc.rpc('admin_prepare_privacy_auth_action', {
      p_request_id: requestId,
      p_confirmation: confirmation,
    });
    if (authActionError) throw authActionError;

    let finalStatus = execution.status;
    if (authAction?.subject_user_id) {
      const { error: deleteError } = authAction.auth_already_deleted
        ? { error: null }
        : await supabaseAdmin.auth.admin.deleteUser(authAction.subject_user_id, true);
      if (deleteError) {
        await adminRpc.rpc('admin_record_privacy_external_failure', {
          p_request_id: requestId,
          p_failure_code: 'auth_soft_delete_failed',
        });
        console.error('Traitement RGPD : anonymisation Auth échouée', {
          requestId,
          failureCode: 'auth_soft_delete_failed',
        });
        return jsonResponse({ error: 'L’anonymisation du compte doit être reprise par un administrateur.' }, 502);
      }

      const { data: completion, error: completionError } = await adminRpc.rpc('admin_complete_privacy_auth_action', {
        p_request_id: requestId,
        p_confirmation: confirmation,
        p_reason: input.reason,
      });
      if (completionError) throw completionError;
      finalStatus = completion.status;
    }

    console.info('Traitement RGPD exécuté', {
      requestId,
      actorId: actor.id,
      status: finalStatus,
      authSoftDeleted: Boolean(authAction?.subject_user_id),
    });
    return jsonResponse({
      requestId,
      status: finalStatus,
      affectedRows: execution.affected_rows,
      externalActionsRemaining: execution.external_action_count,
      authSoftDeleted: Boolean(authAction?.subject_user_id),
    });
  } catch (error) {
    const code = privacyExecutionErrorCode(error);
    console.error('Traitement RGPD refusé', { requestId: requestId || null, code });
    return jsonResponse({
      error: code === 'invalid_request'
        ? (error instanceof Error ? error.message : 'La demande est invalide.')
        : 'Le traitement RGPD ne peut pas être exécuté pour le moment.',
    }, code === 'invalid_request' ? 400 : 409);
  }
});
