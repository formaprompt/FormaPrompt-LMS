import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  createDiagnosticAvailabilityCandidates,
  getBlockedDiagnosticDays,
  parisDateKey,
} from '../_shared/diagnosticAvailability.js';
import {
  excludeDiagnosticCalendarEventBusy,
  isDiagnosticGoogleEventMatch,
  parseGoogleCalendarIds,
  queryGoogleCalendarFreeBusy,
  readDiagnosticGoogleEvent,
  refreshGoogleCalendarAccessToken,
} from '../_shared/googleCalendar.js';
import { requiresDiagnosticEarlyExecutionConsent } from '../_shared/diagnosticPayment.js';

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
    let orderId = typeof body.order_id === 'string' ? body.order_id : '';
    const rescheduleBookingId = typeof body.booking_id === 'string' ? body.booking_id : '';
    if (rescheduleBookingId && !UUID_PATTERN.test(rescheduleBookingId)) {
      return jsonResponse({ error: 'Rendez-vous invalide.' }, 400);
    }
    if (!rescheduleBookingId && !UUID_PATTERN.test(orderId)) {
      return jsonResponse({ error: 'Commande invalide.' }, 400);
    }
    const range = parseRange(body);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAuth = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    const user = authData.user;
    if (authError || !user?.id) return jsonResponse({ error: 'Session utilisateur invalide ou expirée.' }, 401);

    let rescheduleContext: Record<string, unknown> | null = null;
    if (rescheduleBookingId) {
      const supabaseUser = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });
      const { data: contextRows, error: contextError } = await supabaseUser
        .rpc('admin_get_diagnostic_ia_reschedule_context', { p_booking_id: rescheduleBookingId });
      if (contextError?.code === '42501') return jsonResponse({ error: 'Accès administrateur requis.' }, 403);
      if (contextError) throw contextError;
      rescheduleContext = Array.isArray(contextRows) ? contextRows[0] || null : contextRows;
      if (!rescheduleContext) return jsonResponse({ error: 'Rendez-vous introuvable.' }, 404);
      if (rescheduleContext.booking_status !== 'booked') {
        return jsonResponse({ error: 'Seul un rendez-vous réservé peut être déplacé.' }, 409);
      }
      orderId = String(rescheduleContext.order_id || '');
    }

    const supabaseAdmin = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let orderQuery = supabaseAdmin
      .from('diagnostic_ia_orders')
      .select('id, user_id, status, sales_context, paid_at')
      .eq('id', orderId);
    if (!rescheduleContext) orderQuery = orderQuery.eq('user_id', user.id);
    const { data: order, error: orderError } = await orderQuery.maybeSingle();
    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);
    if (order.status !== 'paid' || !order.paid_at) {
      return jsonResponse({ error: 'Paiement confirmé requis.' }, 403);
    }

    const { error: cleanupError } = await supabaseAdmin
      .rpc('cleanup_expired_diagnostic_ia_booking_claims');
    if (cleanupError) throw cleanupError;

    const fromIso = range.from.toISOString();
    const toIso = range.to.toISOString();
    const firstDate = parisDateKey(range.from);
    const lastDate = parisDateKey(range.to);
    let slotsQuery = supabaseAdmin
        .from('training_availability_slots')
        .select('id, starts_at, ends_at, delivery_modes, is_active, is_reserved')
        .eq('is_active', true)
        .contains('delivery_modes', ['remote'])
        .gt('starts_at', range.now.toISOString())
        .gte('starts_at', fromIso)
        .lt('starts_at', toIso)
        .lte('ends_at', toIso)
        .order('starts_at');
    const currentSlotIds = Array.isArray(rescheduleContext?.current_slot_ids)
      ? rescheduleContext.current_slot_ids.filter((id) => typeof id === 'string' && UUID_PATTERN.test(id))
      : [];
    slotsQuery = currentSlotIds.length
      ? slotsQuery.or(`is_reserved.eq.false,id.in.(${currentSlotIds.join(',')})`)
      : slotsQuery.eq('is_reserved', false);

    const [slotsResult, bookingsResult, blocksResult] = await Promise.all([
      slotsQuery,
      supabaseAdmin
        .from('diagnostic_ia_bookings')
        .select('id, starts_at, status, claim_expires_at')
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
    const rawGoogleBusy = await queryGoogleCalendarFreeBusy({
      accessToken: googleAccessToken,
      calendarIds,
      timeMin: fromIso,
      timeMax: toIso,
    });
    let googleBusy = rawGoogleBusy;
    if (rescheduleContext) {
      const currentEvent = await readDiagnosticGoogleEvent({
        accessToken: googleAccessToken,
        calendarId: String(rescheduleContext.google_calendar_id || ''),
        eventId: String(rescheduleContext.google_event_id || ''),
      });
      if (!isDiagnosticGoogleEventMatch({
        event: currentEvent,
        eventId: String(rescheduleContext.google_event_id || ''),
        startsAt: String(rescheduleContext.starts_at || ''),
        endsAt: String(rescheduleContext.ends_at || ''),
      })) throw new Error('google_event_lookup_failed');
      googleBusy = excludeDiagnosticCalendarEventBusy({
        busyPeriods: rawGoogleBusy,
        calendarId: String(rescheduleContext.google_calendar_id || ''),
        startsAt: String(rescheduleContext.starts_at || ''),
        endsAt: String(rescheduleContext.ends_at || ''),
      });
    }

    const candidateSlots = (slotsResult.data || []).map((slot) => currentSlotIds.includes(slot.id)
      ? { ...slot, is_reserved: false }
      : slot);
    const candidates = createDiagnosticAvailabilityCandidates({
      slots: candidateSlots,
      now: range.now,
      blockedDiagnosticDays: getBlockedDiagnosticDays(
        (bookingsResult.data || []).filter((booking) => booking.id !== rescheduleBookingId),
        range.now,
      ),
      formaPromptBlocks: blocksResult.data || [],
      googleBusy,
    }).map((candidate) => {
      const earlyExecution = order.sales_context === 'personal'
        ? requiresDiagnosticEarlyExecutionConsent({
          paidAt: order.paid_at,
          appointmentStartsAt: candidate.starts_at,
        })
        : { required: false, withdrawalDeadline: null };
      return {
        ...candidate,
        requires_early_start_consents: earlyExecution.required,
        withdrawal_period_ends_at: earlyExecution.withdrawalDeadline,
      };
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
