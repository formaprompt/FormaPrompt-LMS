import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  buildDiagnosticCalendarEvent,
  createDiagnosticGoogleEvent,
  diagnosticMeetUrl,
} from '../_shared/googleCalendar.js'

const endpoint = readFileSync(resolve('supabase/functions/confirm-diagnostic-booking/index.ts'), 'utf8')
const transactionMigration = readFileSync(
  resolve('supabase/migrations/20260829065727_add_diagnostic_ia_booking_transactions.sql'),
  'utf8',
)
const foundationMigration = readFileSync(
  resolve('supabase/migrations/20260828165142_add_diagnostic_ia_booking_foundation.sql'),
  'utf8',
)

test('prépare un événement minimal, invite le client et demande Google Meet', () => {
  const event = buildDiagnosticCalendarEvent({
    eventId: 'abcdef0123456789',
    clientName: 'Camille\nMartin',
    clientEmail: 'Camille@example.test',
    startsAt: '2026-09-03T08:00:00.000Z',
    endsAt: '2026-09-03T09:30:00.000Z',
  })
  assert.equal(event.id, 'abcdef0123456789')
  assert.equal(event.attendees[0].email, 'camille@example.test')
  assert.equal(event.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet')
  assert.doesNotMatch(event.summary, /\n/)
  assert.doesNotMatch(event.description, /questionnaire|réponses/i)
})

test('crée l événement avec conferenceData et récupère idempotemment un conflit 409', async () => {
  const calls = []
  const event = buildDiagnosticCalendarEvent({
    eventId: 'abcdef0123456789',
    clientName: 'Camille Martin',
    clientEmail: 'camille@example.test',
    startsAt: '2026-09-03T08:00:00.000Z',
    endsAt: '2026-09-03T09:30:00.000Z',
  })
  const created = await createDiagnosticGoogleEvent({
    accessToken: 'access-token',
    calendarId: 'diagnostic@group.calendar.google.com',
    event,
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: event.id, hangoutLink: 'https://meet.google.com/abc-defg-hij' }),
      }
    },
  })
  assert.match(calls[0].url, /conferenceDataVersion=1/)
  assert.match(calls[0].url, /sendUpdates=all/)
  assert.equal(diagnosticMeetUrl(created), 'https://meet.google.com/abc-defg-hij')

  let attempt = 0
  const recovered = await createDiagnosticGoogleEvent({
    accessToken: 'access-token',
    calendarId: 'diagnostic@group.calendar.google.com',
    event,
    fetchImpl: async (_url, init) => {
      attempt += 1
      if (attempt === 1) return { ok: false, status: 409, json: async () => ({}) }
      assert.equal(init.method, undefined)
      return { ok: true, status: 200, json: async () => ({ id: event.id, status: 'confirmed' }) }
    },
  })
  assert.equal(recovered.id, event.id)
  assert.equal(attempt, 2)
})

test('le serveur applique freeBusy, verrou SQL, nouvelle vérification puis Calendar', () => {
  const firstFreeBusy = endpoint.indexOf(': await loadSelectedCandidate')
  const claim = endpoint.indexOf("rpc('claim_diagnostic_ia_booking'")
  const secondFreeBusy = endpoint.indexOf('const finalBusy')
  const calendarCreation = endpoint.indexOf('googleEvent = await createDiagnosticGoogleEvent')
  const finalize = endpoint.indexOf("rpc('finalize_diagnostic_ia_booking'")
  assert.ok(firstFreeBusy >= 0)
  assert.ok(claim > firstFreeBusy)
  assert.ok(secondFreeBusy > claim)
  assert.ok(calendarCreation > secondFreeBusy)
  assert.ok(finalize > calendarCreation)
  assert.match(endpoint, /auth[.]getUser\(accessToken\)/)
  assert.match(endpoint, /order[.]status !== 'paid'/)
  assert.match(endpoint, /validateDiagnosticEarlyExecutionConsents/)
  assert.match(endpoint, /conference|GoogleEvent|deterministicGoogleEventId/)
})

test('les transactions restent atomiques, privées et isolées du LMS', () => {
  assert.match(transactionMigration, /FOR UPDATE/g)
  assert.match(transactionMigration, /SET is_reserved = true/)
  assert.match(transactionMigration, /SET is_reserved = false/)
  assert.match(transactionMigration, /TO service_role/g)
  assert.match(transactionMigration, /FROM PUBLIC, anon, authenticated/g)
  assert.match(transactionMigration, /INSERT INTO public[.]diagnostic_ia_consents/)
  assert.match(transactionMigration, /'early_service_start'/)
  assert.match(transactionMigration, /'full_performance_withdrawal_acknowledgement'/)
  assert.match(foundationMigration, /diagnostic_ia_bookings_active_paris_day_uidx/)
  assert.doesNotMatch(endpoint, /[.]from\(['"](?:purchases|course_access)['"]\)/)
  assert.doesNotMatch(transactionMigration, /(?:INSERT INTO|UPDATE|DELETE FROM) public[.](?:purchases|course_access)/i)
})
