import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  deterministicCourseCohortEventId,
  ensureCourseCohortGoogleEvent,
  removeCourseCohortGoogleEvent,
} from '../_shared/courseCohortMeet.js'

const migration = readFileSync(new URL('../../migrations/20260913155100_add_course_cohort_google_meet.sql', import.meta.url), 'utf8')
const edge = readFileSync(new URL('../manage-course-cohorts/index.ts', import.meta.url), 'utf8')

function response(status, payload = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload }
}

const baseSession = {
  session_id: '11111111-1111-4111-8111-111111111111',
  position: 1,
  starts_at: '2026-10-01T07:00:00.000Z',
  ends_at: '2026-10-01T10:30:00.000Z',
  google_conference_attempt: 0,
}

test('produit un identifiant Google stable propre à la séance', async () => {
  const first = await deterministicCourseCohortEventId(baseSession.session_id)
  const second = await deterministicCourseCohortEventId(baseSession.session_id)
  assert.equal(first, second)
  assert.match(first, /^[0-9a-f]{40}$/)
})

test('crée un événement sans participant ni notification et restitue le lien Meet réel', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push([url, options])
    if (!options.method) return response(404)
    const body = JSON.parse(options.body)
    assert.equal(body.attendees, undefined)
    return response(200, { ...body, hangoutLink: 'https://meet.google.com/abc-defg-hij' })
  }
  const result = await ensureCourseCohortGoogleEvent({
    accessToken: 'token', calendarId: 'calendar@example.test', session: baseSession,
    courseTitle: 'Excel Initiation', fetchImpl,
  })
  assert.equal(result.status, 'created')
  assert.equal(result.meetingUrl, 'https://meet.google.com/abc-defg-hij')
  assert.match(calls[1][0], /conferenceDataVersion=1&sendUpdates=none/)
})

test('récupère l événement déterministe existant sans double insertion', async () => {
  const eventId = await deterministicCourseCohortEventId(baseSession.session_id)
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return response(200, {
      id: eventId,
      start: { dateTime: baseSession.starts_at },
      end: { dateTime: baseSession.ends_at },
      hangoutLink: 'https://meet.google.com/abc-defg-hij',
    })
  }
  const result = await ensureCourseCohortGoogleEvent({
    accessToken: 'token', calendarId: 'calendar@example.test',
    session: { ...baseSession, google_event_id: eventId }, courseTitle: 'Excel Initiation', fetchImpl,
  })
  assert.equal(result.outcome, 'recovered')
  assert.equal(calls, 1)
})

test('une conférence Google en échec est relancée sur le même événement', async () => {
  const eventId = await deterministicCourseCohortEventId(baseSession.session_id)
  const methods = []
  const fetchImpl = async (_url, options = {}) => {
    methods.push(options.method || 'GET')
    if (!options.method) return response(200, {
      id: eventId, start: { dateTime: baseSession.starts_at }, end: { dateTime: baseSession.ends_at },
      conferenceData: { createRequest: { status: { statusCode: 'failure' } } },
    })
    return response(200, {
      id: eventId, hangoutLink: 'https://meet.google.com/new-link-xyz',
      start: { dateTime: baseSession.starts_at }, end: { dateTime: baseSession.ends_at },
    })
  }
  const result = await ensureCourseCohortGoogleEvent({
    accessToken: 'token', calendarId: 'calendar@example.test',
    session: { ...baseSession, google_event_id: eventId }, courseTitle: 'Excel Initiation', fetchImpl,
  })
  assert.deepEqual(methods, ['GET', 'PATCH'])
  assert.equal(result.attempt, 1)
  assert.equal(result.status, 'created')
})

test('une conférence pending est relue sur le même événement jusqu au lien réel', async () => {
  const eventId = await deterministicCourseCohortEventId(baseSession.session_id)
  let ready = false
  const fetchImpl = async () => response(200, {
    id: eventId,
    start: { dateTime: baseSession.starts_at },
    end: { dateTime: baseSession.ends_at },
    ...(ready
      ? { hangoutLink: 'https://meet.google.com/ready-link-xyz' }
      : { conferenceData: { createRequest: { status: { statusCode: 'pending' } } } }),
  })
  const first = await ensureCourseCohortGoogleEvent({
    accessToken: 'token', calendarId: 'calendar@example.test',
    session: { ...baseSession, google_event_id: eventId }, courseTitle: 'Excel Initiation', fetchImpl,
  })
  assert.equal(first.status, 'pending')
  assert.equal(first.meetingUrl, null)
  ready = true
  const second = await ensureCourseCohortGoogleEvent({
    accessToken: 'token', calendarId: 'calendar@example.test',
    session: { ...baseSession, google_event_id: eventId }, courseTitle: 'Excel Initiation', fetchImpl,
  })
  assert.equal(second.outcome, 'recovered')
  assert.equal(second.meetingUrl, 'https://meet.google.com/ready-link-xyz')
})

test('refuse un événement déterministe dont les horaires ne correspondent plus', async () => {
  const eventId = await deterministicCourseCohortEventId(baseSession.session_id)
  let calls = 0
  await assert.rejects(ensureCourseCohortGoogleEvent({
    accessToken: 'token', calendarId: 'calendar@example.test',
    session: { ...baseSession, google_event_id: eventId }, courseTitle: 'Excel Initiation',
    fetchImpl: async () => {
      calls += 1
      return response(200, {
        id: eventId,
        start: { dateTime: '2026-10-01T08:00:00.000Z' },
        end: { dateTime: '2026-10-01T11:30:00.000Z' },
      })
    },
  }), /google_event_conflict/)
  assert.equal(calls, 1)
})

test('un événement déjà absent est un nettoyage idempotent', async () => {
  const result = await removeCourseCohortGoogleEvent({
    accessToken: 'token', calendarId: 'calendar@example.test', eventId: 'abcde',
    fetchImpl: async (url, options) => {
      assert.equal(options.method, 'DELETE')
      assert.match(url, /sendUpdates=none/)
      return response(404)
    },
  })
  assert.equal(result, 'already_deleted')
})

test('la migration borne les claims, masque les liens à l annulation et garde les liens manuels hors Google', () => {
  assert.match(migration, /private\.is_strict_admin\(\)/)
  assert.match(migration, /google_claim_expires_at = now\(\) \+ interval '10 minutes'/)
  assert.match(migration, /google_sync_status = CASE WHEN sessions\.google_event_id IS NULL THEN 'not_requested' ELSE 'delete_pending' END/)
  assert.match(migration, /AND sessions\.google_event_id IS NULL/)
  assert.match(migration, /v_cohort\.status NOT IN \('published', 'confirmed'\)/)
  assert.match(edge, /GOOGLE_COHORT_CALENDAR_ID/)
  assert.match(edge, /GOOGLE_COURSE_USE_DIAGNOSTIC_CALENDAR/)
  assert.doesNotMatch(edge, /attendees|sendUpdates=all/)
})
