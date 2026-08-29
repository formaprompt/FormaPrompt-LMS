import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  buildDiagnosticCalendarEvent,
  createDiagnosticGoogleEvent,
  diagnosticMeetUrl,
  isDiagnosticGoogleEventMatch,
  readDiagnosticGoogleEvent,
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
const claimConflictMigration = readFileSync(
  resolve('supabase/migrations/20260829090855_fix_diagnostic_ia_booking_claim_conflict.sql'),
  'utf8',
)
const googleReferencesMigration = readFileSync(
  resolve('supabase/migrations/20260829093409_fix_diagnostic_ia_google_references_check.sql'),
  'utf8',
)
const recoveryClaimMigration = readFileSync(
  resolve('supabase/migrations/20260829094733_renew_diagnostic_ia_booking_recovery_claim.sql'),
  'utf8',
)
const claimCheckMigration = readFileSync(
  resolve('supabase/migrations/20260829095852_fix_diagnostic_ia_booking_claim_check.sql'),
  'utf8',
)
const bookingSqlTest = readFileSync(resolve('supabase/tests/diagnostic_ia_bookings.sql'), 'utf8')

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

test('lit et valide uniquement l événement déterministe correspondant à la reprise', async () => {
  const eventId = 'abcdef0123456789'
  const matchingEvent = {
    id: eventId,
    status: 'confirmed',
    start: { dateTime: '2026-09-03T08:00:00.000Z' },
    end: { dateTime: '2026-09-03T09:30:00.000Z' },
  }
  const recovered = await readDiagnosticGoogleEvent({
    accessToken: 'access-token',
    calendarId: 'diagnostic@group.calendar.google.com',
    eventId,
    fetchImpl: async (_url, init) => {
      assert.equal(init.method, undefined)
      return { ok: true, status: 200, json: async () => matchingEvent }
    },
  })
  assert.equal(recovered, matchingEvent)
  assert.ok(isDiagnosticGoogleEventMatch({
    event: recovered,
    eventId,
    startsAt: '2026-09-03T08:00:00.000Z',
    endsAt: '2026-09-03T09:30:00.000Z',
  }))
  assert.ok(!isDiagnosticGoogleEventMatch({
    event: recovered,
    eventId,
    startsAt: '2026-09-03T08:00:00.000Z',
    endsAt: '2026-09-03T10:00:00.000Z',
  }))
  const absent = await readDiagnosticGoogleEvent({
    accessToken: 'access-token',
    calendarId: 'diagnostic@group.calendar.google.com',
    eventId,
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }),
  })
  assert.equal(absent, null)
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

test('le catch journalise les erreurs PostgREST de façon assainie', () => {
  assert.match(endpoint, /function safeBookingLogValue\(value: unknown\)/)
  assert.match(endpoint, /function safeBookingErrorContext\(error: unknown\)/)
  assert.match(endpoint, /code: safeBookingLogValue\(record[.]code\)/)
  assert.match(endpoint, /message: safeBookingLogValue\(message\)/)
  assert.match(endpoint, /details: safeBookingLogValue\(record[.]details\)/)
  assert.match(endpoint, /Bearer \[redacted\]/)
  assert.match(endpoint, /\[redacted-email\]/)
  assert.match(endpoint, /\[redacted-id\]/)
  assert.match(endpoint, /console[.]error\('confirm-diagnostic-booking:', errorContext\)/)
  assert.doesNotMatch(endpoint, /console[.]error\('confirm-diagnostic-booking:', error\)/)
})

test('la migration de prise de créneaux cible la contrainte sous variable_conflict=error', () => {
  assert.match(claimConflictMigration, /^CREATE OR REPLACE FUNCTION public[.]claim_diagnostic_ia_booking/m)
  assert.match(
    claimConflictMigration,
    /ON CONFLICT ON CONSTRAINT diagnostic_ia_booking_slots_booking_slot_unique DO UPDATE/,
  )
  assert.doesNotMatch(claimConflictMigration, /ON CONFLICT \(booking_id, availability_slot_id\) DO UPDATE/)
  assert.doesNotMatch(claimConflictMigration, /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|CONSTRAINT)\b/i)
  assert.match(bookingSqlTest, /SET LOCAL plpgsql[.]variable_conflict = 'error'/)
  assert.match(bookingSqlTest, /lives_ok\([\s\S]*claim_diagnostic_ia_booking/)
})

test('la migration conserve la borne Google Event ID sans regex PostgreSQL invalide', () => {
  assert.match(
    googleReferencesMigration,
    /^ALTER TABLE public[.]diagnostic_ia_bookings\s+DROP CONSTRAINT diagnostic_ia_bookings_google_references_check,/m,
  )
  assert.match(googleReferencesMigration, /char_length\(google_event_id\) BETWEEN 5 AND 1024/)
  assert.match(googleReferencesMigration, /google_event_id ~ '\^\[a-v0-9\]\+\$'/)
  assert.doesNotMatch(googleReferencesMigration, /\{5,1024\}/)
  assert.match(bookingSqlTest, /google_event_id = repeat\('a', 1024\)/)
})

test('la reprise renouvelée est bornée au même booking et au même triplet de créneaux', () => {
  assert.match(recoveryClaimMigration, /^CREATE OR REPLACE FUNCTION public[.]claim_diagnostic_ia_booking/m)
  assert.doesNotMatch(recoveryClaimMigration, /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|CONSTRAINT)\b/i)
  assert.match(recoveryClaimMigration, /AND bookings[.]order_id <> p_order_id/)
  assert.match(recoveryClaimMigration, /v_recoverable_slot_count = 3/)
  assert.match(recoveryClaimMigration, /claim_expires_at = now\(\) \+ interval '15 minutes'/)
  assert.match(endpoint, /samePendingBookingSlots/)
  assert.match(endpoint, /readDiagnosticGoogleEvent/)
  assert.match(endpoint, /recoveringDeterministicEvent/)
  assert.match(endpoint, /!claim[.]google_event_id && !recoveredGoogleEvent/)
  assert.match(endpoint, /if \(recoveredGoogleEvent\)/)
  assert.match(bookingSqlTest, /Un claim expiré du même booking est renouvelé atomiquement/)
  assert.match(bookingSqlTest, /Un autre booking conserve le refus 23505 des créneaux réservés/)
})

test('la contrainte de claim se base sur updated_at après le trigger contrôlé', () => {
  assert.match(
    claimCheckMigration,
    /^ALTER TABLE public[.]diagnostic_ia_bookings\s+DROP CONSTRAINT diagnostic_ia_bookings_claim_check,/m,
  )
  assert.match(claimCheckMigration, /claim_expires_at > updated_at/)
  assert.match(claimCheckMigration, /claim_expires_at <= updated_at \+ interval '15 minutes'/)
  assert.match(claimCheckMigration, /status <> 'booking_pending' AND claim_expires_at IS NULL/)
  assert.doesNotMatch(claimCheckMigration, /claim_expires_at <= created_at/)
  assert.match(bookingSqlTest, /Un claim initial de 15 minutes est accepté/)
  assert.match(bookingSqlTest, /Un renouvellement ultérieur de 15 minutes est accepté/)
  assert.match(bookingSqlTest, /Un claim supérieur à 15 minutes est refusé/)
  assert.match(bookingSqlTest, /Un booking non pending avec claim est refusé/)
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
