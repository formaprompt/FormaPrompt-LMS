import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  createDiagnosticAvailabilityCandidates,
  getBlockedDiagnosticDays,
  parisDateKey,
} from '../_shared/diagnosticAvailability.js';
import {
  parseGoogleCalendarIds,
  queryGoogleCalendarFreeBusy,
  refreshGoogleCalendarAccessToken,
} from '../_shared/googleCalendar.js';

const MAX_AVAILABILITY_RANGE_DAYS = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function parseRange(body: Record<string, unknown>) {
  const now = new Date();
  const from = typeof body.from === 'string' ? new Date(body.from) : now;
  const to = typeof body.to === 'string'
    ? new Date(body.to)
    : new Date(from.getTime() + MAX_AVAILABILITY_RANGE_DAYS * 24 * 60 * 60_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())
    || to <= from
    || to.getTime() - from.getTime() > MAX_AVAILABILITY_RANGE_DAYS * 24 * 60 * 60_000) {
    throw new Error('invalid_availability_range');
  }
  return { from, to, now };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connexion requise.' }, 401);

    const body = await request.json().catch(() => ({}));
    const orderId = typeof body.order_id === 'string' ? body.order_id : '';
    if (!UUID_PATTERN.test(orderId)) return jsonResponse({ error: 'Commande invalide.' }, 400);
    const range = parseRange(body);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAuth = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    const user = authData.user;
    if (authError || !user?.id) return jsonResponse({ error: 'Session utilisateur invalide ou expirée.' }, 401);

    const supabaseAdmin = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await supabaseAdmin
      .from('diagnostic_ia_orders')
      .select('id, user_id, status, paid_at')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);
    if (order.status !== 'paid' || !order.paid_at) {
      return jsonResponse({ error: 'Paiement confirmé requis.' }, 403);
    }

    const fromIso = range.from.toISOString();
    const toIso = range.to.toISOString();
    const firstDate = parisDateKey(range.from);
    const lastDate = parisDateKey(range.to);
    const [slotsResult, bookingsResult, blocksResult] = await Promise.all([
      supabaseAdmin
        .from('training_availability_slots')
        .select('id, starts_at, ends_at, delivery_modes, is_active, is_reserved')
        .eq('is_active', true)
        .eq('is_reserved', false)
        .contains('delivery_modes', ['remote'])
        .gt('starts_at', range.now.toISOString())
        .gte('starts_at', fromIso)
        .lt('starts_at', toIso)
        .lte('ends_at', toIso)
        .order('starts_at'),
      supabaseAdmin
        .from('diagnostic_ia_bookings')
        .select('starts_at, status, claim_expires_at')
        .in('status', ['booking_pending', 'booked'])
        .gte('starts_at', fromIso)
        .lt('starts_at', toIso),
      supabaseAdmin
        .from('calendar_bookings')
        .select('date, slot')
        .gte('date', firstDate)
        .lte('date', lastDate),
    ]);
    if (slotsResult.error) throw slotsResult.error;
    if (bookingsResult.error) throw bookingsResult.error;
    if (blocksResult.error) throw blocksResult.error;

    const calendarIds = parseGoogleCalendarIds(
      requiredEnv('GOOGLE_DIAGNOSTIC_CALENDAR_ID'),
      Deno.env.get('GOOGLE_BUSY_CALENDAR_IDS') || '',
    );
    const googleAccessToken = await refreshGoogleCalendarAccessToken({
      clientId: requiredEnv('GOOGLE_CALENDAR_CLIENT_ID'),
      clientSecret: requiredEnv('GOOGLE_CALENDAR_CLIENT_SECRET'),
      refreshToken: requiredEnv('GOOGLE_CALENDAR_REFRESH_TOKEN'),
    });
    const googleBusy = await queryGoogleCalendarFreeBusy({
      accessToken: googleAccessToken,
      calendarIds,
      timeMin: fromIso,
      timeMax: toIso,
    });

    const candidates = createDiagnosticAvailabilityCandidates({
      slots: slotsResult.data || [],
      now: range.now,
      blockedDiagnosticDays: getBlockedDiagnosticDays(bookingsResult.data || [], range.now),
      formaPromptBlocks: blocksResult.data || [],
      googleBusy,
    });

    return jsonResponse({ candidates }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'availability_failed';
    const temporary = code.startsWith('google_') || code.startsWith('missing_env:GOOGLE_');
    if (!temporary) console.error('get-diagnostic-availability:', code);
    return jsonResponse({
      error: temporary
        ? 'Les disponibilités sont temporairement indisponibles.'
        : 'Impossible de charger les disponibilités.',
    }, temporary ? 503 : 500);
  }
});
