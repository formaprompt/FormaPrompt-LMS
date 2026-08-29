const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const FREE_BUSY_ENDPOINT = 'https://www.googleapis.com/calendar/v3/freeBusy'
const CALENDAR_API_ENDPOINT = 'https://www.googleapis.com/calendar/v3'
const GOOGLE_MEET_URL_PATTERN = /^https:\/\/meet[.]google[.]com\/[A-Za-z0-9-]+$/

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
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || typeof payload.access_token !== 'string') {
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
  const response = await fetchImpl(FREE_BUSY_ENDPOINT, {
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
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.calendars) throw new Error('google_freebusy_failed')

  const busy = []
  for (const calendarId of calendarIds) {
    const calendar = payload.calendars[calendarId]
    if (!calendar || calendar.errors?.length) throw new Error('google_calendar_unavailable')
    for (const period of calendar.busy || []) {
      if (period?.start && period?.end) busy.push({ start: period.start, end: period.end })
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
  const response = await fetchImpl(
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
  const response = await fetchImpl(
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
