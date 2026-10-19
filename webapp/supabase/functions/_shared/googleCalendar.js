// Source active récupérée depuis confirm-diagnostic-booking v5
// ezbr_sha256: 4fc8792fe52e8a561a2a05fe0fd4c08617914e48d2a36a53bb1e2c07e931e73c
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const FREE_BUSY_ENDPOINT = 'https://www.googleapis.com/calendar/v3/freeBusy'
const CALENDAR_API_ENDPOINT = 'https://www.googleapis.com/calendar/v3'
const GOOGLE_MEET_URL_PATTERN = /^https:\/\/meet[.]google[.]com\/[A-Za-z0-9-]+$/
const ALLOWED_WRITE_CALENDAR_ID = '3802495b2d992809bc164fd81537eb8f9b71aec9410226335bd20ff37fc8c558@group.calendar.google.com'
const GOOGLE_INSTANT = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

function validGoogleInstant(value) {
  if (typeof value !== 'string' || !GOOGLE_INSTANT.test(value) || !Number.isFinite(Date.parse(value))) return false
  const date = new Date(value.slice(0, 10) + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10)
}

export function assertProfessionalWriteCalendar(calendarId) {
  if (calendarId !== ALLOWED_WRITE_CALENDAR_ID) throw new Error('google_calendar_write_forbidden')
}

async function googleCalendarFetch(fetchImpl, url, options) {
  try {
    return await fetchImpl(url, { ...options, signal: AbortSignal.timeout(8000) })
  } catch {
    throw new Error('google_calendar_unavailable')
  }
}

// Bound external calls and normalize network/JSON failures without logging credentials.
async function calendarJsonRequest(fetchImpl, url, options, errorCode) {
  try {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(8000) })
    const payload = await response.json()
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error(errorCode)
    return { response, payload }
  } catch {
    throw new Error(errorCode)
  }
}

export function parseGoogleCalendarIds(diagnosticCalendarId, additionalCalendarIds = '') {
  return [...new Set([
    diagnosticCalendarId,
    ...additionalCalendarIds.split(','),
  ].map((value) => value?.trim()).filter(Boolean))]
}

export async function refreshGoogleCalendarAccessToken({
  clientId,
  clientSecret,
  refreshToken,
  fetchImpl = fetch,
}) {
  const { response, payload } = await calendarJsonRequest(fetchImpl, TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  }, 'google_oauth_refresh_failed')
  if (!response.ok || typeof payload.access_token !== 'string' || !payload.access_token.trim()) {
    throw new Error('google_oauth_refresh_failed')
  }
  return payload.access_token
}

export async function queryGoogleCalendarFreeBusy({
  accessToken,
  calendarIds,
  timeMin,
  timeMax,
  fetchImpl = fetch,
}) {
  if (!Array.isArray(calendarIds) || calendarIds.length === 0 || calendarIds.length > 50
    || calendarIds.some((id) => typeof id !== 'string' || !id.trim())
    || !validGoogleInstant(timeMin) || !validGoogleInstant(timeMax)
    || Date.parse(timeMin) >= Date.parse(timeMax)) throw new Error('google_freebusy_input_invalid')
  const { response, payload } = await calendarJsonRequest(fetchImpl, FREE_BUSY_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: 'Europe/Paris',
      items: calendarIds.map((id) => ({ id })),
    }),
  }, 'google_freebusy_failed')
  if (!response.ok || !payload.calendars || typeof payload.calendars !== 'object'
    || Array.isArray(payload.calendars)) throw new Error('google_freebusy_failed')

  const busy = []
  for (const calendarId of calendarIds) {
    const calendar = payload.calendars[calendarId]
    if (!calendar || (calendar.errors !== undefined && (!Array.isArray(calendar.errors) || calendar.errors.length))
      || !Array.isArray(calendar.busy)) throw new Error('google_calendar_unavailable')
    for (const period of calendar.busy) {
      if (typeof period?.start !== 'string' || typeof period?.end !== 'string'
        || !validGoogleInstant(period.start) || !validGoogleInstant(period.end)
        || Date.parse(period.start) >= Date.parse(period.end)) throw new Error('google_calendar_unavailable')
      busy.push({ calendarId, start: period.start, end: period.end })
    }
  }
  return busy
}

export function buildDiagnosticCalendarEvent({
  eventId,
  clientName,
  clientEmail,
  startsAt,
  endsAt,
}) {
  const safeName = String(clientName || 'Client FormaPrompt')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 120) || 'Client FormaPrompt'
  const safeEmail = String(clientEmail || '').trim().toLowerCase()
  if (!eventId || !safeEmail || !startsAt || !endsAt) throw new Error('google_event_input_invalid')

  return {
    id: eventId,
    summary: `Diagnostic IA Express — ${safeName}`,
    description: [
      'Diagnostic IA Express FormaPrompt',
      `Client : ${safeName}`,
      `Contact : ${safeEmail}`,
      'Durée : 90 minutes',
      'Format : visioconférence',
    ].join('\n'),
    start: { dateTime: startsAt, timeZone: 'Europe/Paris' },
    end: { dateTime: endsAt, timeZone: 'Europe/Paris' },
    attendees: [{ email: safeEmail }],
    conferenceData: {
      createRequest: {
        requestId: `meet-${eventId}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  }
}

export function diagnosticMeetUrl(event) {
  const candidates = [
    event?.hangoutLink,
    ...(event?.conferenceData?.entryPoints || [])
      .filter((entry) => entry?.entryPointType === 'video')
      .map((entry) => entry.uri),
  ]
  return candidates.find((value) => GOOGLE_MEET_URL_PATTERN.test(value || '')) || null
}

function sameDateTime(left, right) {
  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime
}

export function isDiagnosticGoogleEventMatch({ event, eventId, startsAt, endsAt }) {
  const start = event?.start?.dateTime
  const end = event?.end?.dateTime
  return event?.id === eventId
    && typeof start === 'string'
    && typeof end === 'string'
    && sameDateTime(start, startsAt)
    && sameDateTime(end, endsAt)
}

export async function readDiagnosticGoogleEvent({
  accessToken,
  calendarId,
  eventId,
  fetchImpl = fetch,
}) {
  assertProfessionalWriteCalendar(calendarId)
  const response = await googleCalendarFetch(fetchImpl,
    `${CALENDAR_API_ENDPOINT}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  )
  const payload = await response.json().catch(() => ({}))
  if (response.status === 404) return null
  if (!response.ok || payload.status === 'cancelled' || !payload.id) {
    throw new Error('google_event_lookup_failed')
  }
  return payload
}

async function readCalendarEvent(options) {
  const event = await readDiagnosticGoogleEvent(options)
  if (!event) throw new Error('google_event_lookup_failed')
  return event
}

export async function createDiagnosticGoogleEvent({
  accessToken,
  calendarId,
  event,
  fetchImpl = fetch,
}) {
  assertProfessionalWriteCalendar(calendarId)
  const response = await googleCalendarFetch(fetchImpl,
    `${CALENDAR_API_ENDPOINT}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(event),
    },
  )

  if (response.status === 409) {
    return readCalendarEvent({
      accessToken,
      calendarId,
      eventId: event.id,
      fetchImpl,
    })
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.id || payload.status === 'cancelled') {
    throw new Error('google_event_create_failed')
  }
  return payload
}

export function buildCourseCohortCalendarEvent({ eventId, courseTitle, position, startsAt, endsAt, attempt = 0 }) {
  if (!eventId || !courseTitle || !startsAt || !endsAt) throw new Error('google_event_input_invalid')
  return {
    id: eventId,
    summary: `${String(courseTitle).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 120)} — séance ${position}`,
    description: 'Séance de formation FormaPrompt. Aucun participant n’est ajouté automatiquement.',
    start: { dateTime: startsAt, timeZone: 'Europe/Paris' },
    end: { dateTime: endsAt, timeZone: 'Europe/Paris' },
    conferenceData: {
      createRequest: {
        requestId: `cohort-${eventId}-${attempt}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  }
}

export async function createCourseCohortGoogleEvent({ accessToken, calendarId, event, fetchImpl = fetch }) {
  assertProfessionalWriteCalendar(calendarId)
  const response = await googleCalendarFetch(fetchImpl,
    `${CALENDAR_API_ENDPOINT}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=none`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(event),
    },
  )
  if (response.status === 409) {
    return readDiagnosticGoogleEvent({ accessToken, calendarId, eventId: event.id, fetchImpl })
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.id || payload.status === 'cancelled') throw new Error('google_event_create_failed')
  return payload
}

export async function retryCourseCohortConference({ accessToken, calendarId, eventId, attempt, fetchImpl = fetch }) {
  assertProfessionalWriteCalendar(calendarId)
  const response = await googleCalendarFetch(fetchImpl,
    `${CALENDAR_API_ENDPOINT}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=none`,
    {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ conferenceData: { createRequest: {
        requestId: `cohort-${eventId}-${attempt}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      } } }),
    },
  )
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.id || payload.status === 'cancelled') throw new Error('google_event_update_failed')
  return payload
}

export async function deleteCourseCohortGoogleEvent({ accessToken, calendarId, eventId, fetchImpl = fetch }) {
  assertProfessionalWriteCalendar(calendarId)
  const response = await googleCalendarFetch(fetchImpl,
    `${CALENDAR_API_ENDPOINT}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } },
  )
  if (response.status === 404 || response.status === 410) return 'already_deleted'
  if (!response.ok) throw new Error('google_event_delete_failed')
  return 'deleted'
}

export function courseCohortConferenceState(event) {
  const meetingUrl = diagnosticMeetUrl(event)
  if (meetingUrl) return { status: 'created', meetingUrl }
  const statusCode = event?.conferenceData?.createRequest?.status?.statusCode
  if (statusCode === 'failure') return { status: 'failed', meetingUrl: null }
  return { status: 'pending', meetingUrl: null }
}

export async function updateDiagnosticGoogleEvent({
  accessToken,
  calendarId,
  eventId,
  startsAt,
  endsAt,
  etag = null,
  fetchImpl = fetch,
}) {
  assertProfessionalWriteCalendar(calendarId)
  if (!eventId || !startsAt || !endsAt) throw new Error('google_event_input_invalid')
  const response = await googleCalendarFetch(fetchImpl,
    `${CALENDAR_API_ENDPOINT}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        ...(etag ? { 'if-match': etag } : {}),
      },
      body: JSON.stringify({
        start: { dateTime: startsAt, timeZone: 'Europe/Paris' },
        end: { dateTime: endsAt, timeZone: 'Europe/Paris' },
      }),
    },
  )
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.id || payload.status === 'cancelled') {
    throw new Error('google_event_update_failed')
  }
  return payload
}

// FreeBusy merges events: subtraction cannot prove that another event is absent.
export function excludeDiagnosticCalendarEventBusy({ busyPeriods }) {
  return busyPeriods
}
