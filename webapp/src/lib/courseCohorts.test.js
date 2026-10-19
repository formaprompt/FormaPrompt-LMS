import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanupAdminCourseCohortMeetingEvents,
  fetchAdminBookingAvailabilitySlots,
  fetchAdminAvailabilitySlotsForMonth,
  generateAdminCourseCohortMeetingLinks,
  getParisMonthBounds,
} from './courseCohorts.js'

function clientReturning(data, error = null) {
  const calls = []
  return {
    calls,
    functions: {
      invoke: async (name, options) => {
        calls.push([name, options])
        return { data, error }
      },
    },
  }
}

test('demande la génération Meet pour une seule cohorte et renvoie le résultat par séance', async () => {
  const expected = { cohort_id: 'cohort-1', complete: false, sessions: [{ session_id: 'session-1', status: 'pending' }] }
  const client = clientReturning(expected)
  assert.deepEqual(await generateAdminCourseCohortMeetingLinks(client, 'cohort-1'), expected)
  assert.deepEqual(client.calls, [['manage-course-cohorts', { body: { action: 'generate_meet_links', cohort_id: 'cohort-1' } }]])
})

test('demande explicitement le nettoyage réessayable des événements annulés', async () => {
  const expected = { cohort_id: 'cohort-1', complete: true, sessions: [{ session_id: 'session-1', status: 'deleted' }] }
  const client = clientReturning(expected)
  assert.deepEqual(await cleanupAdminCourseCohortMeetingEvents(client, 'cohort-1'), expected)
  assert.equal(client.calls[0][1].body.action, 'cleanup_meet_events')
})

test('propage un message serveur borné sans exposer le contexte technique', async () => {
  const client = clientReturning(null, { context: { json: async () => ({ error: 'Google Meet est temporairement indisponible.' }) } })
  await assert.rejects(
    generateAdminCourseCohortMeetingLinks(client, 'cohort-1'),
    /Google Meet est temporairement indisponible/,
  )
})

test('borne un mois Paris en UTC aux changements d’heure et au changement d’année', () => {
  assert.deepEqual(getParisMonthBounds('2026-03'), {
    startsAt: '2026-02-28T23:00:00.000Z',
    endsAt: '2026-03-31T22:00:00.000Z',
  })
  assert.deepEqual(getParisMonthBounds('2026-10'), {
    startsAt: '2026-09-30T22:00:00.000Z',
    endsAt: '2026-10-31T23:00:00.000Z',
  })
  assert.deepEqual(getParisMonthBounds('2026-12'), {
    startsAt: '2026-11-30T23:00:00.000Z',
    endsAt: '2026-12-31T23:00:00.000Z',
  })
})

test('charge les plages du mois uniquement via la disponibilité serveur unifiée', async () => {
  const client = clientReturning({ status: 'available', time_zone: 'Europe/Paris', checked_at: new Date().toISOString(), range: { from: '2026-09-30T22:00:00Z', to: '2026-10-31T23:00:00Z' }, slots: [] })
  assert.deepEqual(await fetchAdminAvailabilitySlotsForMonth(client, '2026-10'), [])
  assert.deepEqual(client.calls, [['get-unified-availability', { body: { purpose: 'admin_cohort', month: '2026-10' } }]])
})

test('ne remplace pas une panne de disponibilité par un mois vide', async () => {
  await assert.rejects(fetchAdminAvailabilitySlotsForMonth(clientReturning(null, new Error('CALENDAR_UNAVAILABLE')), '2026-10'), /temporairement indisponibles/)
})

test('charge aussi la liste de gestion par pages au-delà du plafond de réponse', async () => {
  const ranges = []
  const client = {
    from: () => {
      const query = {
        select: () => query,
        or: () => query,
        order: () => query,
        range: async (from) => {
          ranges.push(from)
          return { data: from === 0 ? Array.from({ length: 500 }, (_, index) => ({ id: index })) : [{ id: 500 }], error: null }
        },
      }
      return query
    },
  }
  assert.equal((await fetchAdminBookingAvailabilitySlots(client)).length, 501)
  assert.deepEqual(ranges, [0, 500])
})
