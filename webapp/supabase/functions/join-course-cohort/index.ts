import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { COHORT_COURSE_IDS } from '../_shared/bureautiqueBooking.js';
import { runCalendarAction } from '../_shared/calendarAction.js';
import { calendarServiceClient, calendarErrorResponse } from '../_shared/calendarServer.ts';
import { loadCalendarBusy, periodsOverlap } from '../_shared/calendarAvailability.js';

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
      if (!COHORT_COURSE_IDS.includes(courseId)) return jsonResponse({ error: 'Formation non réservable.' }, 400);
      const rpcName = action === 'list'
        ? (courseId === 'ia-creativite-groupe' ? 'list_available_creativity_group_cohorts' : 'list_available_course_cohorts')
        : 'get_my_course_cohort_enrollment';
      const { data, error } = await client.rpc(rpcName, { p_course_id: courseId });
      if (error) {
        if (error.code === '42501') return jsonResponse({ error: 'Accès actif requis.' }, 403);
        throw error;
      }
      if (action === 'list') {
        if (!Array.isArray(data)) throw new Error('google_calendar_database_unavailable');
        const cohorts = [];
        for (const cohort of data) {
          if (!Array.isArray(cohort.sessions) || !cohort.sessions.length) throw new Error('google_calendar_intervals_invalid');
          const { data: ownSessions, error: ownError } = await calendarServiceClient()
            .from('course_cohort_sessions').select('google_calendar_id,google_event_id,starts_at,ends_at')
            .eq('cohort_id', cohort.id);
          if (ownError || !Array.isArray(ownSessions)) throw new Error('google_calendar_database_unavailable');
          const result = await loadCalendarBusy({ intervals: cohort.sessions, mode: 'display', ownEvents: ownSessions
            .filter((session: Record<string, unknown>) => session.google_event_id)
            .map((session: Record<string, unknown>) => ({ calendar_id: session.google_calendar_id, event_id: session.google_event_id,
              starts_at: session.starts_at, ends_at: session.ends_at })) });
          if (!cohort.sessions.some((session: Record<string, unknown>) => result.busy.some((busy: { start: string; end: string }) => periodsOverlap(session, busy)))) cohorts.push(cohort);
        }
        return jsonResponse({ cohorts });
      }
      return jsonResponse({ enrollment: data || null });
    }

    if (action === 'join') {
      if (!isUuid(body.cohort_id)) return jsonResponse({ error: 'Session invalide.' }, 400);
      const data = await runCalendarAction({ client: calendarServiceClient(), actorId: authData.user.id,
        action: 'join_course_cohort', payload: { p_cohort_id: body.cohort_id },
        requestId: isUuid(body.request_id) ? body.request_id : null });
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
    return calendarErrorResponse(error);
  }
});
