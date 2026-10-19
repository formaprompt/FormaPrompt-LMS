// Only the existing professional destination may be read at event granularity.
import { EXISTING_BOOKING_CALENDAR_ID, isCalendarInstant, parisLocalDateTime, periodsOverlap } from './calendarAvailability.js'

export async function queryProfessionalBusyWithoutOwnEvents({
  accessToken, calendarId, timeMin, timeMax, ownEvents, fetchImpl = fetch,
}) {
  if (calendarId !== EXISTING_BOOKING_CALENDAR_ID || !Array.isArray(ownEvents) || !ownEvents.length) {
    throw new Error('google_calendar_own_events_invalid')
  }
  const expected = new Map()
  for (const own of ownEvents) {
    if (own.calendar_id !== calendarId || typeof own.event_id !== 'string'
      || !isCalendarInstant(own.starts_at) || !isCalendarInstant(own.ends_at)
      || Date.parse(own.starts_at) >= Date.parse(own.ends_at)) throw new Error('google_calendar_own_events_invalid')
    expected.set(own.event_id, own)
  }
  const busy = []
  const seenPages = new Set()
  let pageToken = ''
  do {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events')
    url.searchParams.set('timeMin', timeMin)
    url.searchParams.set('timeMax', timeMax)
    url.searchParams.set('timeZone', 'Europe/Paris')
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('showDeleted', 'false')
    url.searchParams.set('maxResults', '2500')
    url.searchParams.set('fields', 'items(id,start,end,status,transparency),nextPageToken')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    let payload
    try {
      const response = await fetchImpl(url.toString(), {
        headers: { authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(8000),
      })
      payload = await response.json()
      if (!response.ok || !payload || !Array.isArray(payload.items)) throw new Error()
    } catch { throw new Error('google_calendar_events_unavailable') }
    for (const event of payload.items) {
      if (event.status === 'cancelled' || event.transparency === 'transparent') continue
      if (typeof event.id !== 'string') throw new Error('google_calendar_events_unavailable')
      const start = event.start?.dateTime || (event.start?.date ? parisLocalDateTime(event.start.date) : null)
      const end = event.end?.dateTime || (event.end?.date ? parisLocalDateTime(event.end.date) : null)
      if (!isCalendarInstant(start) || !isCalendarInstant(end) || Date.parse(start) >= Date.parse(end)) {
        throw new Error('google_calendar_events_unavailable')
      }
      const own = expected.get(event.id)
      if (own && Date.parse(start) === Date.parse(own.starts_at) && Date.parse(end) === Date.parse(own.ends_at)) continue
      if (own) throw new Error('google_calendar_own_event_changed')
      if (periodsOverlap({ start, end }, { start: timeMin, end: timeMax })) busy.push({ calendarId, start, end })
    }
    pageToken = payload.nextPageToken || ''
    if (typeof pageToken !== 'string' || (pageToken && seenPages.has(pageToken)) || seenPages.size > 100) {
      throw new Error('google_calendar_events_unavailable')
    }
    if (pageToken) seenPages.add(pageToken)
  } while (pageToken)
  return busy
}
