import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  bytesToSha256Hex,
  DISCIPLINARY_BUCKET,
  disciplinaryObjectPath,
  signedUrlLifetime,
  validateDisciplinaryFile,
  validateDisciplinaryReason,
  validateDisciplinaryUuid,
} from '../_shared/disciplinaryFiles.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable d’environnement manquante : ${name}`);
  return value;
}

function validationError(error: unknown) {
  return error instanceof Error && /requis|invalide|interdit|entre 1 octet|au moins 10/i.test(error.message);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  let action = '';
  let targetId = '';
  try {
    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connexion administrative requise.' }, 401);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAnonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !authData.user?.id) return jsonResponse({ error: 'Session invalide ou expirée.' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: actor, error: actorError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (actorError) throw actorError;
    if (!actor || actor.role !== 'admin') {
      return jsonResponse({ error: 'Cette action est réservée à l’administrateur.' }, 403);
    }
    const actorId = actor.id;

    const isMultipart = request.headers.get('content-type')?.toLowerCase().includes('multipart/form-data');
    const payload = isMultipart
      ? await request.formData()
      : await request.json().catch(() => ({}));
    const readValue = (key: string) => isMultipart
      ? (payload as FormData).get(key)
      : (payload as Record<string, unknown>)[key];

    action = typeof readValue('action') === 'string' ? String(readValue('action')).trim() : '';
    const reason = validateDisciplinaryReason(readValue('reason'));

    async function incidentContext(incidentId: string) {
      const { data, error } = await adminClient
        .from('disciplinary_incidents')
        .select('id, learner_user_id, course_id')
        .eq('id', incidentId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Incident invalide.');
      return data;
    }

    async function audit(
      actionType: string,
      targetType: 'disciplinary_file' | 'disciplinary_incident',
      auditedTargetId: string,
      incident: { id: string; learner_user_id: string; course_id: string },
      metadata: Record<string, unknown> = {},
    ) {
      const { error } = await adminClient.from('audit_log').insert({
        actor_user_id: actorId,
        action_type: actionType,
        target_type: targetType,
        target_id: auditedTargetId,
        target_user_id: incident.learner_user_id,
        course_id: incident.course_id,
        reason,
        metadata: { incident_id: incident.id, ...metadata },
      });
      if (error) throw error;
    }

    if (action === 'list') {
      const incidentId = validateDisciplinaryUuid(readValue('incidentId'), 'Incident');
      targetId = incidentId;
      const incident = await incidentContext(incidentId);
      const { data: files, error } = await adminClient
        .from('disciplinary_files')
        .select('id, incident_id, hearing_id, original_file_name, mime_type, size_bytes, created_by, created_at')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      await audit('disciplinary_files_listed', 'disciplinary_incident', incidentId, incident, { file_count: files.length });
      return jsonResponse({ files });
    }

    if (action === 'signed_url') {
      const fileId = validateDisciplinaryUuid(readValue('fileId'), 'Pièce');
      targetId = fileId;
      const { data: fileRow, error: fileError } = await adminClient
        .from('disciplinary_files')
        .select('id, incident_id, object_path, original_file_name, mime_type, size_bytes')
        .eq('id', fileId)
        .maybeSingle();
      if (fileError) throw fileError;
      if (!fileRow) throw new Error('Pièce invalide.');
      const incident = await incidentContext(fileRow.incident_id);
      const expiresIn = signedUrlLifetime(readValue('expiresIn'));
      const { data: signed, error: signedError } = await adminClient.storage
        .from(DISCIPLINARY_BUCKET)
        .createSignedUrl(fileRow.object_path, expiresIn, { download: fileRow.original_file_name });
      if (signedError || !signed?.signedUrl) throw signedError || new Error('URL signée indisponible.');
      await audit('disciplinary_file_signed_url_created', 'disciplinary_file', fileId, incident, {
        expires_in_seconds: expiresIn,
      });
      return jsonResponse({
        file: {
          id: fileRow.id,
          originalFileName: fileRow.original_file_name,
          mimeType: fileRow.mime_type,
          sizeBytes: fileRow.size_bytes,
        },
        signedUrl: signed.signedUrl,
        expiresIn,
      });
    }

    if (action === 'upload' && isMultipart) {
      const incidentId = validateDisciplinaryUuid(readValue('incidentId'), 'Incident');
      const hearingValue = readValue('hearingId');
      const hearingId = typeof hearingValue === 'string' && hearingValue.trim()
        ? validateDisciplinaryUuid(hearingValue, 'Audition')
        : null;
      targetId = incidentId;
      const incident = await incidentContext(incidentId);
      if (hearingId) {
        const { data: hearing, error: hearingError } = await adminClient
          .from('disciplinary_hearings')
          .select('id')
          .eq('id', hearingId)
          .eq('incident_id', incidentId)
          .maybeSingle();
        if (hearingError) throw hearingError;
        if (!hearing) throw new Error('Audition invalide.');
      }

      const file = readValue('file');
      const validatedFile = validateDisciplinaryFile(file);
      const fileId = crypto.randomUUID();
      targetId = fileId;
      const objectPath = disciplinaryObjectPath(incidentId, fileId, validatedFile.extension);
      const fileBytes = new Uint8Array(await (file as File).arrayBuffer());
      const sha256Hex = bytesToSha256Hex(await crypto.subtle.digest('SHA-256', fileBytes));
      const { error: uploadError } = await adminClient.storage
        .from(DISCIPLINARY_BUCKET)
        .upload(objectPath, fileBytes, {
          contentType: validatedFile.mimeType,
          upsert: false,
          cacheControl: '0',
        });
      if (uploadError) throw uploadError;

      const { data: fileRow, error: insertError } = await adminClient.rpc('register_disciplinary_file', {
        p_actor_user_id: actorId,
        p_file_id: fileId,
        p_incident_id: incidentId,
        p_hearing_id: hearingId,
        p_object_path: objectPath,
        p_original_file_name: validatedFile.originalName,
        p_mime_type: validatedFile.mimeType,
        p_size_bytes: validatedFile.sizeBytes,
        p_sha256_hex: sha256Hex,
        p_reason: reason,
      });
      if (insertError) {
        await adminClient.storage.from(DISCIPLINARY_BUCKET).remove([objectPath]);
        throw insertError;
      }
      return jsonResponse({ file: fileRow }, 201);
    }

    return jsonResponse({ error: 'Action inconnue.' }, 400);
  } catch (error) {
    const isValidation = validationError(error);
    console.error('Pièce disciplinaire refusée', {
      action: action || null,
      targetId: targetId || null,
      code: isValidation ? 'invalid_request' : 'processing_failed',
    });
    return jsonResponse({
      error: isValidation
        ? (error instanceof Error ? error.message : 'La demande est invalide.')
        : 'La pièce disciplinaire ne peut pas être traitée pour le moment.',
    }, isValidation ? 400 : 409);
  }
});
