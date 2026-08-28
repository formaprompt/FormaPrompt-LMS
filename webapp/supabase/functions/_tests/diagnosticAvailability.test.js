import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  createDiagnosticAvailabilityCandidates,
  getBlockedDiagnosticDays,
} from '../_shared/diagnosticAvailability.js'
import {
  parseGoogleCalendarIds,
  queryGoogleCalendarFreeBusy,
  refreshGoogleCalendarAccessToken,
} from '../_shared/googleCalendar.js'

const endpoint = readFileSync(resolve('supabase/functions/get-diagnostic-availability/index.ts'), 'utf8')
const migrationPath = resolve('supabase/migrations/20260828165142_add_diagnostic_ia_booking_foundation.sql')
const migration = readFileSync(migrationPath, 'utf8')

function slot(id, startsAt) {
  const start = new Date(startsAt)
  return {
    id,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
    delivery_modes: ['remote'],
    is_active: true,
    is_reserved: false,
  }
}

const slots = [
  slot('s1', '2026-09-03T06:30:00Z'),
  slot('s2', '2026-09-03T07:00:00Z'),
  slot('s3', '2026-09-03T07:30:00Z'),
  slot('s4', '2026-09-03T08:00:00Z'),
]

test('compose uniquement trois demi-heures contiguës', () => {
  const candidates = createDiagnosticAvailabilityCandidates({
    slots,
    now: new Date('2026-09-01T00:00:00Z'),
  })
  assert.equal(candidates.length, 2)
  assert.deepEqual(candidates[0].slot_ids, ['s1', 's2', 's3'])
  assert.equal(new Date(candidates[0].ends_at) - new Date(candidates[0].starts_at), 90 * 60_000)
})

test('exclut une journée déjà réservée et les indisponibilités FormaPrompt', () => {
  assert.equal(createDiagnosticAvailabilityCandidates({
    slots,
    now: new Date('2026-09-01T00:00:00Z'),
    blockedDiagnosticDays: ['2026-09-03'],
  }).length, 0)
  assert.equal(createDiagnosticAvailabilityCandidates({
    slots,
    now: new Date('2026-09-01T00:00:00Z'),
    formaPromptBlocks: [{ date: '2026-09-03', slot: 'Matin' }],
  }).length, 0)
})

test('ignore une prise SQL expirée mais conserve une prise active', () => {
  const now = new Date('2026-09-01T10:00:00Z')
  const days = getBlockedDiagnosticDays([
    { status: 'booking_pending', starts_at: '2026-09-03T08:00:00Z', claim_expires_at: '2026-09-01T09:59:00Z' },
    { status: 'booking_pending', starts_at: '2026-09-04T08:00:00Z', claim_expires_at: '2026-09-01T10:05:00Z' },
    { status: 'booked', starts_at: '2026-09-05T08:00:00Z', claim_expires_at: null },
  ], now)
  assert.deepEqual(days, ['2026-09-04', '2026-09-05'])
})

test('exclut tout candidat occupé dans Google Calendar', () => {
  const candidates = createDiagnosticAvailabilityCandidates({
    slots,
    now: new Date('2026-09-01T00:00:00Z'),
    googleBusy: [{ start: '2026-09-03T07:15:00Z', end: '2026-09-03T07:45:00Z' }],
  })
  assert.equal(candidates.length, 0)
})

test('refuse une fin après 21 h Europe/Paris', () => {
  const eveningSlots = [
    slot('e1', '2026-09-03T18:00:00Z'),
    slot('e2', '2026-09-03T18:30:00Z'),
    slot('e3', '2026-09-03T19:00:00Z'),
  ]
  assert.equal(createDiagnosticAvailabilityCandidates({
    slots: eveningSlots,
    now: new Date('2026-09-01T00:00:00Z'),
  }).length, 0)
})

test('prépare le calendrier dédié et permet des calendriers FormaPrompt supplémentaires', () => {
  assert.deepEqual(
    parseGoogleCalendarIds('diagnostic@group.calendar.google.com', 'primary, diagnostic@group.calendar.google.com'),
    ['diagnostic@group.calendar.google.com', 'primary'],
  )
})

test('rafraîchit OAuth hors ligne sans exposer le refresh token', async () => {
  let request
  const accessToken = await refreshGoogleCalendarAccessToken({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    refreshToken: 'refresh-token',
    fetchImpl: async (url, init) => {
      request = { url, init }
      return { ok: true, json: async () => ({ access_token: 'access-token' }) }
    },
  })
  assert.equal(accessToken, 'access-token')
  assert.equal(request.url, 'https://oauth2.googleapis.com/token')
  assert.match(request.init.body.toString(), /grant_type=refresh_token/)
})

test('agrège freeBusy et échoue fermé si un calendrier est indisponible', async () => {
  const calendarIds = ['diagnostic-calendar', 'professional-calendar']
  const busy = await queryGoogleCalendarFreeBusy({
    accessToken: 'access-token',
    calendarIds,
    timeMin: '2026-09-01T00:00:00Z',
    timeMax: '2026-09-30T00:00:00Z',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        calendars: {
          'diagnostic-calendar': { busy: [{ start: '2026-09-03T08:00:00Z', end: '2026-09-03T09:00:00Z' }] },
          'professional-calendar': { busy: [] },
        },
      }),
    }),
  })
  assert.equal(busy.length, 1)

  await assert.rejects(queryGoogleCalendarFreeBusy({
    accessToken: 'access-token',
    calendarIds,
    timeMin: '2026-09-01T00:00:00Z',
    timeMax: '2026-09-30T00:00:00Z',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ calendars: { 'diagnostic-calendar': { busy: [] } } }),
    }),
  }), /google_calendar_unavailable/)
})

test('protège l endpoint et isole les réservations du LMS', () => {
  const auth = endpoint.indexOf('auth.getUser(accessToken)')
  const orderLookup = endpoint.indexOf(".from('diagnostic_ia_orders')")
  const slotLookup = endpoint.indexOf(".from('training_availability_slots')")
  assert.ok(auth >= 0)
  assert.ok(orderLookup > auth)
  assert.ok(slotLookup > orderLookup)
  assert.match(endpoint, /order\.status !== 'paid'/)
  assert.match(endpoint, /GOOGLE_DIAGNOSTIC_CALENDAR_ID/)
  assert.match(endpoint, /GOOGLE_BUSY_CALENDAR_IDS/)
  assert.match(endpoint, /queryGoogleCalendarFreeBusy/)
  assert.match(endpoint, /requiresDiagnosticEarlyExecutionConsent/)
  assert.match(endpoint, /requires_early_start_consents/)
  assert.doesNotMatch(endpoint, /\.from\(['"](?:purchases|course_access)['"]\)/)
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:purchases|course_access)/i)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g)
  assert.match(migration, /FORCE ROW LEVEL SECURITY/g)
})
