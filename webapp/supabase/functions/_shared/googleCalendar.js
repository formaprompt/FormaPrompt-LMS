const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const FREE_BUSY_ENDPOINT = 'https://www.googleapis.com/calendar/v3/freeBusy'

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

