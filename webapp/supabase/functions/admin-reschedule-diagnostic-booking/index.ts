import { createClient } from 'npm:@supabase/supabase-js@2.105.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  diagnosticMeetUrl,
  excludeDiagnosticCalendarEventBusy,
  isDiagnosticGoogleEventMatch,
  parseGoogleCalendarIds,
  queryGoogleCalendarFreeBusy,
  readDiagnosticGoogleEvent,
  refreshGoogleCalendarAccessToken,
  updateDiagnosticGoogleEvent,
} from '../_shared/googleCalendar.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_env:${name}`)
  return value
}

function parseRequest(body: Record<string, unknown>) {
  const bookingId = typeof body.booking_id === 'string' ? body.booking_id : ''
  const slotIds = Array.isArray(body.slot_ids) ? body.slot_ids : []
  if (!UUID_PATTERN.test(bookingId)
    || slotIds.length !== 3
    || new Set(slotIds).size !== 3
    || !slotIds.every((id) => typeof id === 'string' && UUID_PATTERN.test(id))) {
    throw new Error('invalid_reschedule_request')
  }
  return { bookingId, slotIds: slotIds as string[] }
}

function attendeesFingerprint(event: Record<string, unknown> | null) {
  const attendees = Array.isArray(event?.attendees) ? event.attendees : []
  return attendees
    .map((attendee) => typeof attendee?.email === 'string' ? attendee.email.trim().toLowerCase() : '')
    .filter(Boolean)
    .sort()
    .join('|')
}

function safeCode(error: unknown) {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const value = error instanceof Error ? error.message : record.code || record.message
  return String(value || 'reschedule_failed')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .slice(0, 100)
}

async function cancelRescheduleClaim(
  client: ReturnType<typeof createClient>,
  bookingId: string,
  claimToken: unknown,
  calendarResult: string,
) {
  const { data, error } = await client.rpc('cancel_diagnostic_ia_booking_reschedule_claim', {
    p_booking_id: bookingId,
    p_claim_token: claimToken,
    p_calendar_result: calendarResult,
  })
  if (error || data !== true) throw new Error('reschedule_claim_release_failed')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)

  let bookingId = ''
  let adminId = ''
  let claim: Record<string, unknown> | null = null
  let calendarUpdated = false
  let calendarUpdateAttempted = false
  let calendarEventEtag = ''
  let googleAccessToken = ''
  let supabaseAdmin: ReturnType<typeof createClient> | null = null

  try {
    const authorization = request.headers.get('Authorization')
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!accessToken) return jsonResponse({ error: 'Connexion requise.' }, 401)

    const body = await request.json().catch(() => ({}))
    const parsed = parseRequest(body)
    bookingId = parsed.bookingId

    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const anonKey = requiredEnv('SUPABASE_ANON_KEY')
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken)
    if (authError || !authData.user?.id) {
      return jsonResponse({ error: 'Session administrateur invalide ou expirée.' }, 401)
    }
    adminId = authData.user.id

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    supabaseAdmin = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: claimRows, error: claimError } = await supabaseUser
      .rpc('admin_claim_diagnostic_ia_booking_reschedule', {
        p_booking_id: bookingId,
        p_slot_ids: parsed.slotIds,
      })
    if (claimError) {
      if (claimError.code === '42501') return jsonResponse({ error: 'Accès administrateur strict requis.' }, 403)
      if (['23505', '40001'].includes(claimError.code)) {
        return jsonResponse({ error: 'Ce créneau vient de devenir indisponible.' }, 409)
      }
      if (claimError.code === 'P0001') return jsonResponse({ error: claimError.message }, 409)
      throw claimError
    }
    claim = Array.isArray(claimRows) ? claimRows[0] || null : claimRows
    if (!claim?.claim_token || !claim.google_calendar_id || !claim.google_event_id) {
      throw new Error('reschedule_claim_failed')
    }

    googleAccessToken = await refreshGoogleCalendarAccessToken({
      clientId: requiredEnv('GOOGLE_CALENDAR_CLIENT_ID'),
      clientSecret: requiredEnv('GOOGLE_CALENDAR_CLIENT_SECRET'),
      refreshToken: requiredEnv('GOOGLE_CALENDAR_REFRESH_TOKEN'),
    })

    const oldEvent = await readDiagnosticGoogleEvent({
      accessToken: googleAccessToken,
      calendarId: String(claim.google_calendar_id),
      eventId: String(claim.google_event_id),
    })
    const matchesOld = isDiagnosticGoogleEventMatch({
      event: oldEvent,
      eventId: String(claim.google_event_id),
      startsAt: String(claim.old_starts_at),
      endsAt: String(claim.old_ends_at),
    })
    const matchesNew = isDiagnosticGoogleEventMatch({
      event: oldEvent,
      eventId: String(claim.google_event_id),
      startsAt: String(claim.new_starts_at),
      endsAt: String(claim.new_ends_at),
    })
    if (!matchesOld && !matchesNew) throw new Error('google_event_state_conflict')

    let updatedEvent = oldEvent
    if (matchesNew) {
      calendarUpdated = true
    } else {
      const diagnosticCalendarId = String(claim.google_calendar_id)
      const calendarIds = parseGoogleCalendarIds(
        diagnosticCalendarId,
        Deno.env.get('GOOGLE_BUSY_CALENDAR_IDS') || '',
      )
      const busy = await queryGoogleCalendarFreeBusy({
        accessToken: googleAccessToken,
        calendarIds,
        timeMin: String(claim.new_starts_at),
        timeMax: String(claim.new_ends_at),
      })
      const busyWithoutCurrentEvent = excludeDiagnosticCalendarEventBusy({
        busyPeriods: busy,
        calendarId: diagnosticCalendarId,
        startsAt: String(claim.old_starts_at),
        endsAt: String(claim.old_ends_at),
      })
      if (busyWithoutCurrentEvent.length > 0) {
        await cancelRescheduleClaim(
          supabaseAdmin,
          bookingId,
          claim.claim_token,
          'conflict_before_update',
        )
        claim = null
        return jsonResponse({ error: 'Ce créneau vient de devenir indisponible.' }, 409)
      }

      calendarUpdateAttempted = true
      updatedEvent = await updateDiagnosticGoogleEvent({
        accessToken: googleAccessToken,
        calendarId: diagnosticCalendarId,
        eventId: String(claim.google_event_id),
        startsAt: String(claim.new_starts_at),
        endsAt: String(claim.new_ends_at),
        etag: typeof oldEvent?.etag === 'string' ? oldEvent.etag : null,
      })
      calendarUpdated = true
    }
    calendarEventEtag = typeof updatedEvent?.etag === 'string' ? updatedEvent.etag : ''

    if (!isDiagnosticGoogleEventMatch({
      event: updatedEvent,
      eventId: String(claim.google_event_id),
      startsAt: String(claim.new_starts_at),
      endsAt: String(claim.new_ends_at),
    })) throw new Error('google_event_update_unverified')
    if (attendeesFingerprint(oldEvent) !== attendeesFingerprint(updatedEvent)) {
      throw new Error('google_attendees_changed')
    }
    if (claim.google_meet_url
      && diagnosticMeetUrl(updatedEvent) !== String(claim.google_meet_url)) {
      throw new Error('google_meet_changed')
    }

    const { data: finalized, error: finalizeError } = await supabaseAdmin
      .rpc('finalize_diagnostic_ia_booking_reschedule', {
        p_booking_id: bookingId,
        p_claim_token: claim.claim_token,
        p_calendar_result: 'updated_existing_event',
      })
    if (finalizeError) throw finalizeError
    const finalizedBooking = Array.isArray(finalized) ? finalized[0] : finalized
    if (!finalizedBooking?.id) throw new Error('reschedule_finalize_failed')
    const previousStartsAt = String(claim.old_starts_at)
    const nextStartsAt = String(claim.new_starts_at)
    claim = null

    console.info('diagnostic_ia_booking_rescheduled', {
      booking_id: bookingId,
      admin_id: adminId,
      old_starts_at: previousStartsAt,
      new_starts_at: nextStartsAt,
      calendar_result: 'updated_existing_event',
    })
    return jsonResponse({
      booking: {
        id: finalizedBooking.id,
        order_id: finalizedBooking.order_id,
        user_id: finalizedBooking.user_id,
        status: finalizedBooking.status,
        starts_at: finalizedBooking.starts_at,
        ends_at: finalizedBooking.ends_at,
        google_sync_status: finalizedBooking.google_sync_status,
        google_meet_status: finalizedBooking.google_meet_status,
        google_meet_url: finalizedBooking.google_meet_url,
      },
    }, 200)
  } catch (error) {
    const code = safeCode(error)
    if (supabaseAdmin && claim?.claim_token) {
      if (calendarUpdateAttempted && !calendarUpdated && googleAccessToken) {
        try {
          const observedEvent = await readDiagnosticGoogleEvent({
            accessToken: googleAccessToken,
            calendarId: String(claim.google_calendar_id),
            eventId: String(claim.google_event_id),
          })
          if (isDiagnosticGoogleEventMatch({
            event: observedEvent,
            eventId: String(claim.google_event_id),
            startsAt: String(claim.new_starts_at),
            endsAt: String(claim.new_ends_at),
          })) {
            calendarUpdated = true
            calendarEventEtag = typeof observedEvent?.etag === 'string' ? observedEvent.etag : ''
          } else if (!isDiagnosticGoogleEventMatch({
            event: observedEvent,
            eventId: String(claim.google_event_id),
            startsAt: String(claim.old_starts_at),
            endsAt: String(claim.old_ends_at),
          })) {
            throw new Error('google_event_state_unknown')
          }
        } catch (stateError) {
          console.error('diagnostic_ia_booking_reschedule_compensation_failed', {
            booking_id: bookingId,
            admin_id: adminId,
            code: safeCode(stateError),
          })
          return jsonResponse({
            error: 'Le déplacement nécessite une reprise contrôlée. Aucun créneau n’a été libéré.',
          }, 503)
        }
      }
      if (calendarUpdated && googleAccessToken) {
        try {
          const { data: bookingState, error: bookingStateError } = await supabaseAdmin
            .from('diagnostic_ia_bookings')
            .select('id,order_id,user_id,status,starts_at,ends_at,google_sync_status,google_meet_status,google_meet_url,reschedule_claim_token')
            .eq('id', bookingId)
            .maybeSingle()
          if (bookingStateError || !bookingState) throw new Error('reschedule_state_lookup_failed')
          const databaseAlreadyFinalized = isDiagnosticGoogleEventMatch({
            event: {
              id: String(claim.google_event_id),
              start: { dateTime: bookingState.starts_at },
              end: { dateTime: bookingState.ends_at },
            },
            eventId: String(claim.google_event_id),
            startsAt: String(claim.new_starts_at),
            endsAt: String(claim.new_ends_at),
          }) && bookingState.reschedule_claim_token == null
          if (databaseAlreadyFinalized) {
            const recoveredOldStartsAt = String(claim.old_starts_at)
            claim = null
            console.info('diagnostic_ia_booking_rescheduled', {
              booking_id: bookingId,
              admin_id: adminId,
              old_starts_at: recoveredOldStartsAt,
              new_starts_at: bookingState.starts_at,
              calendar_result: 'updated_existing_event_recovered',
            })
            return jsonResponse({ booking: bookingState }, 200)
          }
          if (bookingState.reschedule_claim_token !== claim.claim_token) {
            throw new Error('reschedule_state_conflict')
          }

          const restoredEvent = await updateDiagnosticGoogleEvent({
            accessToken: googleAccessToken,
            calendarId: String(claim.google_calendar_id),
            eventId: String(claim.google_event_id),
            startsAt: String(claim.old_starts_at),
            endsAt: String(claim.old_ends_at),
            etag: calendarEventEtag || null,
          })
          if (!isDiagnosticGoogleEventMatch({
            event: restoredEvent,
            eventId: String(claim.google_event_id),
            startsAt: String(claim.old_starts_at),
            endsAt: String(claim.old_ends_at),
          })) throw new Error('google_event_rollback_unverified')
          await cancelRescheduleClaim(
            supabaseAdmin,
            bookingId,
            claim.claim_token,
            'rolled_back_after_failure',
          )
        } catch (rollbackError) {
          console.error('diagnostic_ia_booking_reschedule_compensation_failed', {
            booking_id: bookingId,
            admin_id: adminId,
            code: safeCode(rollbackError),
          })
          return jsonResponse({
            error: 'Le déplacement nécessite une reprise contrôlée. Aucun créneau n’a été libéré.',
          }, 503)
        }
      } else {
        try {
          await cancelRescheduleClaim(supabaseAdmin, bookingId, claim.claim_token, code)
        } catch (releaseError) {
          console.error('diagnostic_ia_booking_reschedule_compensation_failed', {
            booking_id: bookingId,
            admin_id: adminId,
            code: safeCode(releaseError),
          })
          return jsonResponse({
            error: 'Le déplacement nécessite une reprise contrôlée. Aucun créneau n’a été libéré.',
          }, 503)
        }
      }
    }
    console.error('diagnostic_ia_booking_reschedule_failed', {
      booking_id: bookingId,
      admin_id: adminId,
      code,
    })
    if (code === 'invalid_reschedule_request') {
      return jsonResponse({ error: 'Le nouveau créneau est invalide.' }, 400)
    }
    const temporary = code.startsWith('google_') || code.startsWith('missing_env:GOOGLE_')
    return jsonResponse({
      error: temporary
        ? 'La mise à jour Calendar est temporairement indisponible.'
        : 'Le rendez-vous n’a pas pu être déplacé.',
    }, temporary ? 503 : 500)
  }
})
