import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

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

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAuth = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    const user = authData.user;
    if (authError || !user?.id) return jsonResponse({ error: 'Session utilisateur invalide ou expirée.' }, 401);

    const body = await request.json().catch(() => ({}));
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const allowedSlotCounts: Record<string, number> = {
      'formation-ia': 20,
      'formation-ia-act': 8,
      'formation-prompt-level-1': 14,
    };
    const expectedSlotCount = allowedSlotCounts[body.course_id];
    if (!expectedSlotCount
      || !Array.isArray(body.slot_ids)
      || body.slot_ids.length !== expectedSlotCount
      || new Set(body.slot_ids).size !== expectedSlotCount
      || !body.slot_ids.every((slotId: unknown) => typeof slotId === 'string' && uuidPattern.test(slotId))) {
      return jsonResponse({ error: 'Les horaires choisis sont invalides.' }, 400);
    }

    const supabaseUser = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data, error } = await supabaseUser.rpc('create_course_booking_request', {
      p_course_id: body.course_id,
      p_delivery_mode: body.delivery_mode,
      p_schedule_format: body.schedule_format,
      p_slot_ids: body.slot_ids,
      p_city: body.city ?? null,
      p_postal_code: body.postal_code ?? null,
    });

    if (error) {
      if (error.code === '42501') return jsonResponse({ error: error.message }, 403);
      if (error.code === '23505') return jsonResponse({ error: error.message }, 409);
      throw error;
    }
    return jsonResponse({ booking_request_id: data }, 201);
  } catch (error) {
    console.error('create-course-booking:', error);
    return jsonResponse({ error: "La réservation n'a pas pu être enregistrée." }, 500);
  }
});
