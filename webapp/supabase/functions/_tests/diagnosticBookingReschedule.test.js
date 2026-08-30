import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  excludeDiagnosticCalendarEventBusy,
  updateDiagnosticGoogleEvent,
} from '../_shared/googleCalendar.js'

const endpoint = readFileSync(
  resolve('supabase/functions/admin-reschedule-diagnostic-booking/index.ts'),
  'utf8',
)
const availabilityEndpoint = readFileSync(
  resolve('supabase/functions/get-diagnostic-availability/index.ts'),
  'utf8',
)
const migration = readFileSync(
  resolve('supabase/migrations/20260830173543_add_diagnostic_ia_booking_reschedule.sql'),
  'utf8',
)
const config = readFileSync(resolve('supabase/config.toml'), 'utf8')

test('modifie uniquement les horaires de l événement existant et demande les notifications Calendar', async () => {
  let request
  const event = await updateDiagnosticGoogleEvent({
    accessToken: 'access-token',
    calendarId: 'diagnostic@example.test',
    eventId: 'event12345',
    startsAt: '2026-09-12T14:00:00Z',
    endsAt: '2026-09-12T15:30:00Z',
    etag: '"etag-before"',
    fetchImpl: async (url, init) => {
      request = { url, init }
      return {
        ok: true,
        json: async () => ({
          id: 'event12345',
          status: 'confirmed',
          start: { dateTime: '2026-09-12T14:00:00Z' },
          end: { dateTime: '2026-09-12T15:30:00Z' },
          attendees: [{ email: 'client@example.test' }],
          hangoutLink: 'https://meet.google.com/abc-defg-hij',
        }),
      }
    },
  })
  assert.equal(request.init.method, 'PATCH')
  assert.match(request.url, /events\/event12345/)
  assert.match(request.url, /conferenceDataVersion=1/)
  assert.match(request.url, /sendUpdates=all/)
  assert.equal(request.init.headers['if-match'], '"etag-before"')
  assert.deepEqual(Object.keys(JSON.parse(request.init.body)).sort(), ['end', 'start'])
  assert.equal(event.hangoutLink, 'https://meet.google.com/abc-defg-hij')
})

test('retire uniquement l intervalle de l événement courant du freeBusy Diagnostic', () => {
  const busy = excludeDiagnosticCalendarEventBusy({
    busyPeriods: [
      { calendarId: 'diagnostic', start: '2026-09-12T13:30:00Z', end: '2026-09-12T16:00:00Z' },
      { calendarId: 'other', start: '2026-09-12T14:00:00Z', end: '2026-09-12T15:30:00Z' },
    ],
    calendarId: 'diagnostic',
    startsAt: '2026-09-12T14:00:00Z',
    endsAt: '2026-09-12T15:30:00Z',
  })
  assert.deepEqual(busy, [
    { calendarId: 'diagnostic', start: '2026-09-12T13:30:00Z', end: '2026-09-12T14:00:00.000Z' },
    { calendarId: 'diagnostic', start: '2026-09-12T15:30:00.000Z', end: '2026-09-12T16:00:00Z' },
    { calendarId: 'other', start: '2026-09-12T14:00:00Z', end: '2026-09-12T15:30:00Z' },
  ])
})

test('le contexte admin réutilise get-diagnostic-availability sans second moteur', () => {
  assert.match(availabilityEndpoint, /admin_get_diagnostic_ia_reschedule_context/)
  assert.match(availabilityEndpoint, /current_slot_ids/)
  assert.match(availabilityEndpoint, /excludeDiagnosticCalendarEventBusy/)
  assert.match(availabilityEndpoint, /booking[.]id !== rescheduleBookingId/)
  assert.match(availabilityEndpoint, /createDiagnosticAvailabilityCandidates/)
})

test('la prise SQL est admin stricte, atomique et conserve les identités métier', () => {
  assert.match(migration, /admin_claim_diagnostic_ia_booking_reschedule/)
  assert.match(migration, /private[.]is_strict_admin\(\)/)
  assert.match(migration, /v_booking[.]status <> 'booked'/)
  assert.match(migration, /FOR UPDATE/g)
  assert.match(migration, /SET is_reserved = true/)
  assert.match(migration, /reschedule_slot_ids = v_selected_slot_ids/)
  assert.match(migration, /FROM public[.]calendar_bookings AS blocks/)
  assert.match(migration, /UPDATE public[.]diagnostic_ia_booking_slots[\s\S]*SET released_at = now\(\)/)
  assert.match(migration, /SET starts_at = v_booking[.]reschedule_starts_at/)
  assert.doesNotMatch(migration, /UPDATE public[.]diagnostic_ia_orders/)
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE|DELETE FROM) public[.](?:purchases|course_access)/i)
  assert.doesNotMatch(migration, /diagnostic_ia_preparation_questionnaires[\s\S]*(?:UPDATE|DELETE)/i)
})

test('le serveur vérifie le JWT, recontrôle le créneau, met à jour puis finalise', () => {
  const auth = endpoint.indexOf('auth.getUser(accessToken)')
  const claim = endpoint.indexOf("rpc('admin_claim_diagnostic_ia_booking_reschedule'")
  const busy = endpoint.indexOf('const busy = await queryGoogleCalendarFreeBusy', claim)
  const patch = endpoint.indexOf('updatedEvent = await updateDiagnosticGoogleEvent')
  const finalize = endpoint.indexOf("rpc('finalize_diagnostic_ia_booking_reschedule'")
  assert.ok(auth >= 0)
  assert.ok(claim > auth)
  assert.ok(busy > claim)
  assert.ok(patch > busy)
  assert.ok(finalize > patch)
  assert.match(endpoint, /google_meet_changed/)
  assert.match(endpoint, /google_attendees_changed/)
  assert.doesNotMatch(endpoint, /createDiagnosticGoogleEvent/)
  assert.match(config, /\[functions[.]admin-reschedule-diagnostic-booking\]\s+verify_jwt = true/)
})

test('un échec Calendar libère la prise et un échec tardif tente la compensation', () => {
  assert.match(endpoint, /cancel_diagnostic_ia_booking_reschedule_claim/)
  assert.match(endpoint, /rolled_back_after_failure/)
  assert.match(endpoint, /diagnostic_ia_booking_reschedule_compensation_failed/)
  assert.match(endpoint, /Aucun créneau n’a été libéré/)
  assert.match(endpoint, /matchesNew/)
  assert.match(endpoint, /matchesOld/)
})

test('les audits et logs excluent les contenus sensibles', () => {
  assert.match(migration, /diagnostic_ia_booking_rescheduled/)
  assert.match(migration, /'starts_at'/)
  assert.match(migration, /'ends_at'/)
  assert.match(migration, /'calendar_result'/)
  assert.doesNotMatch(endpoint, /questionnaire|restitution|overall_summary/i)
  assert.doesNotMatch(migration, /overall_summary|maturity_assessment|questionnaire_version/i)
  assert.doesNotMatch(migration, /observed_maturity_level/i)
})
