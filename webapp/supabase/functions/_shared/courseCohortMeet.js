import {
  buildCourseCohortCalendarEvent,
  courseCohortConferenceState,
  createCourseCohortGoogleEvent,
  deleteCourseCohortGoogleEvent,
  isDiagnosticGoogleEventMatch,
  readDiagnosticGoogleEvent,
  retryCourseCohortConference,
} from './googleCalendar.js'

export async function deterministicCourseCohortEventId(sessionId) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`formaprompt-course-cohort-session-${sessionId}`),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 40)
}

export async function ensureCourseCohortGoogleEvent({
  accessToken,
  calendarId,
  session,
  courseTitle,
  fetchImpl = fetch,
}) {
  const eventId = session.google_event_id || await deterministicCourseCohortEventId(session.session_id)
  let event = await readDiagnosticGoogleEvent({ accessToken, calendarId, eventId, fetchImpl })
  let outcome = 'recovered'
  let attempt = Number(session.google_conference_attempt) || 0

  if (event && !isDiagnosticGoogleEventMatch({
    event,
    eventId,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
  })) throw new Error('google_event_conflict')

  if (!event) {
    event = await createCourseCohortGoogleEvent({
      accessToken,
      calendarId,
      event: buildCourseCohortCalendarEvent({
        eventId,
        courseTitle,
        position: session.position,
        startsAt: session.starts_at,
        endsAt: session.ends_at,
        attempt,
      }),
      fetchImpl,
    })
    outcome = 'created'
  }

  if (!event || !isDiagnosticGoogleEventMatch({
    event,
    eventId,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
  })) throw new Error('google_event_conflict')

  let state = courseCohortConferenceState(event)
  if (state.status === 'failed') {
    attempt += 1
    event = await retryCourseCohortConference({
      accessToken,
      calendarId,
      eventId,
      attempt,
      fetchImpl,
    })
    state = courseCohortConferenceState(event)
  }

  return { eventId, event, attempt, outcome, ...state }
}

export async function removeCourseCohortGoogleEvent(options) {
  return deleteCourseCohortGoogleEvent(options)
}
