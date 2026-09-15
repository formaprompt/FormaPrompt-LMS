import { createClient } from 'npm:@supabase/supabase-js@2.105.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { BUREAUTIQUE_INTER_COURSE_IDS, BUREAUTIQUE_SCHEDULE_FORMATS, getBureautiqueBookingCourse } from '../_shared/bureautiqueBooking.js'
import { deterministicCourseCohortEventId, ensureCourseCohortGoogleEvent, removeCourseCohortGoogleEvent } from '../_shared/courseCohortMeet.js'
import { refreshGoogleCalendarAccessToken } from '../_shared/googleCalendar.js'

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_env:${name}`)
  return value
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function safeGoogleErrorCode(error: unknown) {
  const code = error instanceof Error ? error.message : 'google_sync_failed'
  return /^google_[a-z_]+$/.test(code) ? code : 'google_sync_failed'
}

async function rpc(client: ReturnType<typeof createClient>, name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw error
  return data
}

async function googleAccessToken() {
  return refreshGoogleCalendarAccessToken({
    clientId: requiredEnv('GOOGLE_CALENDAR_CLIENT_ID'),
    clientSecret: requiredEnv('GOOGLE_CALENDAR_CLIENT_SECRET'),
    refreshToken: requiredEnv('GOOGLE_CALENDAR_REFRESH_TOKEN'),
  })
}

function courseCalendarId() {
  const dedicated = Deno.env.get('GOOGLE_COHORT_CALENDAR_ID')?.trim()
  if (dedicated) return dedicated
  if (Deno.env.get('GOOGLE_COURSE_USE_DIAGNOSTIC_CALENDAR')?.trim().toLowerCase() === 'true') {
    return requiredEnv('GOOGLE_DIAGNOSTIC_CALENDAR_ID')
  }
  throw new Error('missing_env:GOOGLE_COHORT_CALENDAR_ID')
}

async function cleanupMeetEvents(client: ReturnType<typeof createClient>, cohortId: string) {
  const claimToken = crypto.randomUUID()
  const claim = await rpc(client, 'admin_claim_course_cohort_meet_cleanup', {
    p_cohort_id: cohortId,
    p_claim_token: claimToken,
  }) as { sessions?: Array<Record<string, unknown>> }
  const claimed = (claim?.sessions || []).filter((session) => session.claim_acquired)
  let accessToken = ''
  let tokenError: unknown = null
  if (claimed.length) {
    try { accessToken = await googleAccessToken() } catch (error) { tokenError = error }
  }

  const results = []
  for (const session of claim?.sessions || []) {
    if (session.google_sync_status === 'deleted') {
      results.push({ session_id: session.session_id, position: session.position, status: 'already_deleted' })
      continue
    }
    if (!session.claim_acquired) {
      results.push({ session_id: session.session_id, position: session.position, status: 'failed', message: 'Nettoyage déjà en cours. Réessayez dans quelques minutes.' })
      continue
    }
    try {
      if (tokenError) throw tokenError
      const status = await removeCourseCohortGoogleEvent({
        accessToken,
        calendarId: String(session.google_calendar_id),
        eventId: String(session.google_event_id),
      })
      await rpc(client, 'admin_finalize_course_cohort_meet_cleanup', {
        p_session_id: session.session_id,
        p_claim_token: claimToken,
        p_deleted: true,
        p_error_code: null,
      })
      results.push({ session_id: session.session_id, position: session.position, status })
    } catch (error) {
      const code = safeGoogleErrorCode(error)
      await rpc(client, 'admin_finalize_course_cohort_meet_cleanup', {
        p_session_id: session.session_id,
        p_claim_token: claimToken,
        p_deleted: false,
        p_error_code: code,
      }).catch(() => null)
      results.push({ session_id: session.session_id, position: session.position, status: 'failed', message: 'Le nettoyage Google doit être relancé.' })
    }
  }
  return {
    cohort_id: cohortId,
    complete: results.every((result) => ['deleted', 'already_deleted'].includes(result.status)),
    sessions: results,
  }
}

async function generateMeetLinks(client: ReturnType<typeof createClient>, cohortId: string) {
  const cohorts = await rpc(client, 'admin_list_course_cohorts') as Array<Record<string, unknown>>
  const cohort = cohorts.find((item) => item.id === cohortId)
  if (!cohort) throw Object.assign(new Error('Cohorte introuvable.'), { code: '22023' })
  const sessions = Array.isArray(cohort.sessions) ? cohort.sessions as Array<Record<string, unknown>> : []
  const calendarId = courseCalendarId()
  const accessToken = await googleAccessToken()
  const events = await Promise.all(sessions.map(async (session) => ({
    session_id: session.id,
    event_id: await deterministicCourseCohortEventId(String(session.id)),
  })))
  const claimToken = crypto.randomUUID()
  const claim = await rpc(client, 'admin_claim_course_cohort_meet_sessions', {
    p_cohort_id: cohortId,
    p_calendar_id: calendarId,
    p_claim_token: claimToken,
    p_session_events: events,
  }) as { course_id?: string, sessions?: Array<Record<string, unknown>> }
  const course = getBureautiqueBookingCourse(String(claim.course_id))
  if (!course) throw Object.assign(new Error('Formation de cohorte inconnue.'), { code: '22023' })

  const results = []
  let cleanupRequired = false
  for (const session of claim.sessions || []) {
    if (session.meeting_url) {
      results.push({ session_id: session.session_id, position: session.position, status: 'existing', meeting_url: session.meeting_url })
      continue
    }
    if (!session.claim_acquired) {
      results.push({ session_id: session.session_id, position: session.position, status: 'pending', meeting_url: null, message: 'Génération déjà en cours.' })
      continue
    }
    try {
      const ensured = await ensureCourseCohortGoogleEvent({ accessToken, calendarId, session, courseTitle: course.title })
      const syncStatus = ensured.status === 'created' ? 'created' : 'pending'
      const finalized = await rpc(client, 'admin_finalize_course_cohort_meet_session', {
        p_session_id: session.session_id,
        p_claim_token: claimToken,
        p_sync_status: syncStatus,
        p_meeting_url: ensured.meetingUrl,
        p_conference_attempt: ensured.attempt,
        p_error_code: null,
      }) as { cleanup_required?: boolean }
      cleanupRequired ||= finalized?.cleanup_required === true
      results.push(finalized?.cleanup_required === true
        ? { session_id: session.session_id, position: session.position, status: 'failed', meeting_url: null, message: 'La cohorte a été annulée pendant la génération.' }
        : {
          session_id: session.session_id,
          position: session.position,
          status: syncStatus === 'created' ? ensured.outcome : 'pending',
          meeting_url: ensured.meetingUrl,
        })
    } catch (error) {
      const code = safeGoogleErrorCode(error)
      const finalized = await rpc(client, 'admin_finalize_course_cohort_meet_session', {
        p_session_id: session.session_id,
        p_claim_token: claimToken,
        p_sync_status: 'error',
        p_meeting_url: null,
        p_conference_attempt: Number(session.google_conference_attempt) || 0,
        p_error_code: code,
      }).catch(() => null) as { cleanup_required?: boolean } | null
      cleanupRequired ||= finalized?.cleanup_required === true
      results.push({ session_id: session.session_id, position: session.position, status: 'failed', meeting_url: null, message: 'La génération doit être relancée.' })
    }
  }

  if (cleanupRequired) await cleanupMeetEvents(client, cohortId).catch(() => null)
  return {
    cohort_id: cohortId,
    complete: results.every((result) => ['existing', 'created', 'recovered'].includes(result.status)),
    sessions: results,
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)
  try {
    const authorization = request.headers.get('Authorization')
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return jsonResponse({ error: 'Connexion requise.' }, 401)
    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const anonKey = requiredEnv('SUPABASE_ANON_KEY')
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await authClient.auth.getUser(token)
    if (authError || !authData.user?.id) return jsonResponse({ error: 'Session utilisateur invalide ou expirée.' }, 401)
    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization! } },
    })
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : ''

    if (action === 'generate_meet_links') {
      if (!isUuid(body.cohort_id)) return jsonResponse({ error: 'Cohorte invalide.' }, 400)
      return jsonResponse(await generateMeetLinks(client, body.cohort_id))
    }
    if (action === 'cleanup_meet_events') {
      if (!isUuid(body.cohort_id)) return jsonResponse({ error: 'Cohorte invalide.' }, 400)
      return jsonResponse(await cleanupMeetEvents(client, body.cohort_id))
    }

    let name = ''
    let args: Record<string, unknown> = {}
    if (action === 'list') name = 'admin_list_course_cohorts'
    else if (action === 'save_draft') {
      const draft = body.draft as Record<string, unknown> | undefined
      if (!draft || !BUREAUTIQUE_INTER_COURSE_IDS.includes(String(draft.course_id))
        || !Object.hasOwn(BUREAUTIQUE_SCHEDULE_FORMATS, String(draft.schedule_format))
        || !['remote', 'in_person'].includes(String(draft.delivery_mode))) {
        return jsonResponse({ error: 'Brouillon de cohorte invalide.' }, 400)
      }
      name = 'admin_save_course_cohort'
      args = {
        p_cohort_id: isUuid(draft.id) ? draft.id : null,
        p_course_id: draft.course_id,
        p_delivery_mode: draft.delivery_mode,
        p_schedule_format: draft.schedule_format,
        p_capacity: draft.capacity,
        p_minimum_participants: draft.minimum_participants,
        p_sessions: draft.sessions,
      }
    } else if (['publish', 'confirm', 'cancel'].includes(action)) {
      if (!isUuid(body.cohort_id)) return jsonResponse({ error: 'Cohorte invalide.' }, 400)
      name = `admin_${action}_course_cohort`
      args = { p_cohort_id: body.cohort_id }
      if (action === 'cancel') args.p_reason = body.reason
    } else if (action === 'set_meeting_url') {
      if (!isUuid(body.cohort_id) || !isUuid(body.session_id)) return jsonResponse({ error: 'Séance invalide.' }, 400)
      if (body.meeting_url !== null && typeof body.meeting_url !== 'string') return jsonResponse({ error: 'Lien de réunion invalide.' }, 400)
      name = 'admin_set_course_cohort_meeting_url'
      args = { p_cohort_id: body.cohort_id, p_session_id: body.session_id, p_meeting_url: body.meeting_url }
    } else return jsonResponse({ error: 'Action inconnue.' }, 400)

    const data = await rpc(client, name, args)
    if (action === 'cancel') {
      const cleanup = await cleanupMeetEvents(client, String(body.cohort_id)).catch(() => ({ cohort_id: body.cohort_id, complete: false, sessions: [] }))
      return jsonResponse({ result: data, cleanup })
    }
    return jsonResponse(action === 'list' ? { cohorts: data || [] } : { result: data })
  } catch (error) {
    const record = error && typeof error === 'object' ? error as { code?: string, message?: string } : {}
    if (record.code === '42501') return jsonResponse({ error: 'Action réservée à l’administrateur.' }, 403)
    if (record.code === '23P01') return jsonResponse({ error: 'Un autre créneau chevauchant est déjà réservé.' }, 409)
    if (['22023', '23505', '40001'].includes(record.code || '')) return jsonResponse({ error: record.message }, 409)
    const code = safeGoogleErrorCode(error)
    if (code.startsWith('google_') || (error instanceof Error && error.message.startsWith('missing_env:GOOGLE_'))) {
      return jsonResponse({ error: 'Google Meet est temporairement indisponible. Vérifiez la configuration serveur puis réessayez.' }, 503)
    }
    console.error('manage-course-cohorts:', error instanceof Error ? error.name : 'unknown')
    return jsonResponse({ error: "La gestion des cohortes n'a pas pu être traitée." }, 500)
  }
})
