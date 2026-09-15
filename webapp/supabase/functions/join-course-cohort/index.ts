import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { BUREAUTIQUE_INTER_COURSE_IDS } from '../_shared/bureautiqueBooking.js';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Configuration serveur manquante : ${name}`);
  return value;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return jsonResponse({ error: 'Connexion requise.' }, 401);
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user?.id) return jsonResponse({ error: 'Session utilisateur invalide ou expirée.' }, 401);

    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization! } },
    });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'list' || action === 'my_enrollment') {
      const courseId = typeof body.course_id === 'string' ? body.course_id : '';
      if (!BUREAUTIQUE_INTER_COURSE_IDS.includes(courseId)) return jsonResponse({ error: 'Formation non réservable.' }, 400);
      const rpcName = action === 'list' ? 'list_available_course_cohorts' : 'get_my_course_cohort_enrollment';
      const { data, error } = await client.rpc(rpcName, { p_course_id: courseId });
      if (error) {
        if (error.code === '42501') return jsonResponse({ error: 'Accès actif requis.' }, 403);
        throw error;
      }
      return jsonResponse(action === 'list' ? { cohorts: data || [] } : { enrollment: data || null });
    }

    if (action === 'join') {
      if (!isUuid(body.cohort_id)) return jsonResponse({ error: 'Session invalide.' }, 400);
      const { data, error } = await client.rpc('join_course_cohort', { p_cohort_id: body.cohort_id });
      if (error) {
        if (error.code === '42501') return jsonResponse({ error: 'Accès actif requis.' }, 403);
        if (error.code === '23505' || error.code === '40001') return jsonResponse({ error: error.message }, 409);
        throw error;
      }
      return jsonResponse({ enrollment: data }, 201);
    }

    if (action === 'cancel') {
      if (!isUuid(body.enrollment_id)) return jsonResponse({ error: 'Inscription invalide.' }, 400);
      const { data, error } = await client.rpc('cancel_my_course_cohort_enrollment', { p_enrollment_id: body.enrollment_id });
      if (error) {
        if (error.code === '42501') return jsonResponse({ error: 'Accès refusé.' }, 403);
        if (error.code === '22023') return jsonResponse({ error: error.message }, 409);
        throw error;
      }
      return jsonResponse({ enrollment: data });
    }

    return jsonResponse({ error: 'Action inconnue.' }, 400);
  } catch (error) {
    console.error('join-course-cohort:', error instanceof Error ? error.name : 'unknown');
    return jsonResponse({ error: "La réservation inter n'a pas pu être traitée." }, 500);
  }
});
