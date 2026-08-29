import { createClient } from 'npm:@supabase/supabase-js@2.105.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  createDiagnosticAvailabilityCandidates,
  getBlockedDiagnosticDays,
  parisDateKey,
} from '../_shared/diagnosticAvailability.js'
import {
  buildDiagnosticCalendarEvent,
  createDiagnosticGoogleEvent,
  diagnosticMeetUrl,
  parseGoogleCalendarIds,
  queryGoogleCalendarFreeBusy,
  refreshGoogleCalendarAccessToken,
} from '../_shared/googleCalendar.js'
import {
  DIAGNOSTIC_LEGAL_STATEMENTS,
  requiresDiagnosticEarlyExecutionConsent,
  validateDiagnosticEarlyExecutionConsents,
} from '../_shared/diagnosticPayment.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_env:${name}`)
  return value
}

function parseRequest(body: Record<string, unknown>) {
  const orderId = typeof body.order_id === 'string' ? body.order_id : ''
  const slotIds = Array.isArray(body.slot_ids) ? body.slot_ids : []
  if (!UUID_PATTERN.test(orderId)
    || slotIds.length !== 3
    || new Set(slotIds).size !== 3
    || !slotIds.every((id) => typeof id === 'string' && UUID_PATTERN.test(id))) {
    throw new Error('invalid_booking_request')
  }
  return { orderId, slotIds: slotIds as string[] }
}

function clientDisplayName(user: { email?: string, user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata || {}
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name : ''
  const firstName = typeof metadata.first_name === 'string' ? metadata.first_name : ''
  const lastName = typeof metadata.last_name === 'string' ? metadata.last_name : ''
  return fullName.trim() || `${firstName} ${lastName}`.trim() || user.email || 'Client FormaPrompt'
}

function sameSlotSet(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id))
}

async function deterministicGoogleEventId(bookingId: string) {
  const bytes = new TextEncoder().encode(`formaprompt-diagnostic-${bookingId}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 40)
}

async function loadSelectedCandidate({
  supabaseAdmin,
  slotIds,
  googleAccessToken,
  calendarIds,
  excludeBookingId = null,
}: {
  supabaseAdmin: ReturnType<typeof createClient>,
  slotIds: string[],
  googleAccessToken: string,
  calendarIds: string[],
  excludeBookingId?: string | null,
}) {
  const { data: slots, error: slotsError } = await supabaseAdmin
    .from('training_availability_slots')
    .select('id, starts_at, ends_at, delivery_modes, is_active, is_reserved')
    .in('id', slotIds)
    .order('starts_at')
  if (slotsError) throw slotsError
  if (!slots || slots.length !== 3) throw new Error('slot_conflict')

  const startsAt = slots[0].starts_at
  const endsAt = slots[2].ends_at
  const startsDate = new Date(startsAt)
  const endsDate = new Date(endsAt)
  if (Number.isNaN(startsDate.getTime()) || Number.isNaN(endsDate.getTime())) {
    throw new Error('slot_conflict')
  }
  const dateKey = parisDateKey(startsAt)
  if (!dateKey) throw new Error('slot_conflict')

  const [bookingsResult, blocksResult, googleBusy] = await Promise.all([
    supabaseAdmin
      .from('diagnostic_ia_bookings')
      .select('id, starts_at, status, claim_expires_at')
      .in('status', ['booking_pending', 'booked'])
      .gte('starts_at', new Date(startsDate.getTime() - 24 * 60 * 60_000).toISOString())
      .lt('starts_at', new Date(endsDate.getTime() + 24 * 60 * 60_000).toISOString()),
    supabaseAdmin.from('calendar_bookings').select('date, slot').eq('date', dateKey),
    queryGoogleCalendarFreeBusy({
      accessToken: googleAccessToken,
      calendarIds,
      timeMin: startsDate.toISOString(),
      timeMax: endsDate.toISOString(),
    }),
  ])
  if (bookingsResult.error) throw bookingsResult.error
  if (blocksResult.error) throw blocksResult.error

  const candidate = createDiagnosticAvailabilityCandidates({
    slots,
    now: new Date(),
    blockedDiagnosticDays: getBlockedDiagnosticDays(
      (bookingsResult.data || []).filter((booking) => booking.id !== excludeBookingId),
      new Date(),
    ),
    formaPromptBlocks: blocksResult.data || [],
    googleBusy,
  }).find((item) => item.slot_ids.every((id) => slotIds.includes(id)))
  if (!candidate) throw new Error('slot_conflict')
  return candidate
}

async function markSyncError(
  supabaseAdmin: ReturnType<typeof createClient>,
  bookingId: string,
  userId: string,
  errorCode: string,
  calendarId: string | null,
  event: Record<string, unknown> | null,
) {
  const meetUrl = event ? diagnosticMeetUrl(event) : null
  await supabaseAdmin
    .from('diagnostic_ia_bookings')
    .update({
      google_sync_status: 'error',
      google_meet_status: event ? (meetUrl ? 'created' : 'unavailable') : 'error',
      google_calendar_id: event ? calendarId : null,
      google_event_id: typeof event?.id === 'string' ? event.id : null,
      google_meet_url: meetUrl,
      google_sync_error_code: errorCode.slice(0, 100),
    })
    .eq('id', bookingId)
    .eq('user_id', userId)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)

  let bookingId = ''
  let userId = ''
  let calendarId: string | null = null
  let googleEvent: Record<string, unknown> | null = null
  let supabaseAdmin: ReturnType<typeof createClient> | null = null

  try {
    const authorization = request.headers.get('Authorization')
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!accessToken) return jsonResponse({ error: 'Connexion requise.' }, 401)

    const body = await request.json().catch(() => ({}))
    const { orderId, slotIds } = parseRequest(body)
    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const supabaseAuth = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken)
    const user = authData.user
    if (authError || !user?.id || !EMAIL_PATTERN.test(user.email || '')) {
      return jsonResponse({ error: 'Session utilisateur invalide ou expirée.' }, 401)
    }
    userId = user.id

    supabaseAdmin = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: order, error: orderError } = await supabaseAdmin
      .from('diagnostic_ia_orders')
      .select('id, user_id, status, sales_context, paid_at')
      .eq('id', orderId)
      .eq('user_id', userId)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404)
    if (order.status !== 'paid' || !order.paid_at) {
      return jsonResponse({ error: 'Paiement confirmé requis.' }, 403)
    }

    const { data: existingBooking, error: existingBookingError } = await supabaseAdmin
      .from('diagnostic_ia_bookings')
      .select('id, status, starts_at, ends_at, claim_expires_at, google_event_id, google_meet_url')
      .eq('order_id', orderId)
      .maybeSingle()
    if (existingBookingError) throw existingBookingError

    let existingSlotIds: string[] = []
    if (existingBooking) {
      const { data: existingLinks, error: existingLinksError } = await supabaseAdmin
        .from('diagnostic_ia_booking_slots')
        .select('availability_slot_id')
        .eq('booking_id', existingBooking.id)
        .is('released_at', null)
      if (existingLinksError) throw existingLinksError
      existingSlotIds = (existingLinks || []).map((link) => link.availability_slot_id)

      if (['booked', 'completed'].includes(existingBooking.status)) {
        if (!sameSlotSet(existingSlotIds, slotIds)) {
          return jsonResponse({ error: 'Cette commande possède déjà une réservation.' }, 409)
        }
        return jsonResponse({
          booking: {
            id: existingBooking.id,
            status: existingBooking.status,
            starts_at: existingBooking.starts_at,
            ends_at: existingBooking.ends_at,
            google_meet_url: existingBooking.google_meet_url,
          },
        }, 200)
      }

      if (existingBooking.status === 'booking_pending'
        && existingBooking.claim_expires_at
        && new Date(existingBooking.claim_expires_at) > new Date()
        && !sameSlotSet(existingSlotIds, slotIds)) {
        return jsonResponse({ error: 'Une réservation est déjà en cours pour cette commande.' }, 409)
      }
    }

    calendarId = requiredEnv('GOOGLE_DIAGNOSTIC_CALENDAR_ID')
    const calendarIds = parseGoogleCalendarIds(calendarId, Deno.env.get('GOOGLE_BUSY_CALENDAR_IDS') || '')
    const googleAccessToken = await refreshGoogleCalendarAccessToken({
      clientId: requiredEnv('GOOGLE_CALENDAR_CLIENT_ID'),
      clientSecret: requiredEnv('GOOGLE_CALENDAR_CLIENT_SECRET'),
      refreshToken: requiredEnv('GOOGLE_CALENDAR_REFRESH_TOKEN'),
    })
    const recoveringCreatedEvent = existingBooking?.status === 'booking_pending'
      && Boolean(existingBooking.google_event_id)
      && sameSlotSet(existingSlotIds, slotIds)
    const selected = recoveringCreatedEvent
      ? { starts_at: existingBooking.starts_at, ends_at: existingBooking.ends_at }
      : await loadSelectedCandidate({
        supabaseAdmin,
        slotIds,
        googleAccessToken,
        calendarIds,
        excludeBookingId: existingBooking?.status === 'booking_pending' ? existingBooking.id : null,
      })

    const earlyExecution = order.sales_context === 'personal'
      ? requiresDiagnosticEarlyExecutionConsent({
        paidAt: order.paid_at,
        appointmentStartsAt: selected.starts_at,
      })
      : { required: false, withdrawalDeadline: null }
    if (earlyExecution.required) {
      const consentError = validateDiagnosticEarlyExecutionConsents(body)
      if (consentError) return jsonResponse({ error: consentError }, 400)
    }

    const { data: claimRows, error: claimError } = await supabaseAdmin.rpc('claim_diagnostic_ia_booking', {
      p_order_id: orderId,
      p_user_id: userId,
      p_slot_ids: slotIds,
    })
    if (claimError) {
      if (claimError.code === '23505') return jsonResponse({ error: 'Ce créneau vient de devenir indisponible.' }, 409)
      if (claimError.code === '42501') return jsonResponse({ error: 'Paiement confirmé requis.' }, 403)
      throw claimError
    }
    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows
    if (!claim?.booking_id) throw new Error('booking_claim_failed')
    bookingId = claim.booking_id

    if (claim.booking_status === 'booked' || claim.booking_status === 'completed') {
      return jsonResponse({
        booking: {
          id: claim.booking_id,
          status: claim.booking_status,
          starts_at: claim.starts_at,
          ends_at: claim.ends_at,
          google_meet_url: claim.google_meet_url,
        },
      }, 200)
    }

    if (!claim.google_event_id) {
      const finalBusy = await queryGoogleCalendarFreeBusy({
        accessToken: googleAccessToken,
        calendarIds,
        timeMin: claim.starts_at,
        timeMax: claim.ends_at,
      })
      if (finalBusy.length > 0) {
        await supabaseAdmin.rpc('cancel_diagnostic_ia_booking_claim', {
          p_booking_id: bookingId,
          p_user_id: userId,
          p_error_code: 'google_conflict',
        })
        return jsonResponse({ error: 'Ce créneau vient de devenir indisponible.' }, 409)
      }
    }

    const eventId = claim.google_event_id || await deterministicGoogleEventId(bookingId)
    googleEvent = await createDiagnosticGoogleEvent({
      accessToken: googleAccessToken,
      calendarId,
      event: buildDiagnosticCalendarEvent({
        eventId,
        clientName: clientDisplayName(user),
        clientEmail: user.email,
        startsAt: claim.starts_at,
        endsAt: claim.ends_at,
      }),
    })
    const meetUrl = diagnosticMeetUrl(googleEvent)

    const { data: finalizedRows, error: finalizedError } = await supabaseAdmin.rpc('finalize_diagnostic_ia_booking', {
      p_booking_id: bookingId,
      p_user_id: userId,
      p_google_calendar_id: calendarId,
      p_google_event_id: googleEvent.id,
      p_google_meet_url: meetUrl,
      p_requires_early_consents: earlyExecution.required,
      p_withdrawal_period_ends_at: earlyExecution.required ? earlyExecution.withdrawalDeadline : null,
    })
    if (finalizedError) throw new Error('booking_finalize_failed')
    const finalized = Array.isArray(finalizedRows) ? finalizedRows[0] : finalizedRows

    return jsonResponse({
      booking: {
        id: finalized.booking_id,
        status: finalized.booking_status,
        starts_at: finalized.starts_at,
        ends_at: finalized.ends_at,
        google_meet_url: finalized.google_meet_url,
      },
    }, 201)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'booking_failed'
    if (supabaseAdmin && bookingId) {
      await markSyncError(supabaseAdmin, bookingId, userId, code, calendarId, googleEvent)
    }
    if (code === 'invalid_booking_request') {
      return jsonResponse({ error: 'Les créneaux choisis sont invalides.' }, 400)
    }
    if (code === 'slot_conflict') {
      return jsonResponse({ error: 'Ce créneau vient de devenir indisponible.' }, 409)
    }
    const temporary = code.startsWith('google_') || code.startsWith('missing_env:GOOGLE_')
    if (!temporary) console.error('confirm-diagnostic-booking:', code)
    return jsonResponse({
      error: temporary
        ? 'La synchronisation du rendez-vous est temporairement indisponible.'
        : 'La réservation n’a pas pu être finalisée.',
    }, temporary ? 503 : 500)
  }
})
