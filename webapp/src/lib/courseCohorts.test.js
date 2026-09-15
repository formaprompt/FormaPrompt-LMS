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

test('charge complètement un mois paginé avec un ordre stable', async () => {
  const calls = []
  const pages = [
    Array.from({ length: 500 }, (_, index) => ({ id: `slot-${index}` })),
    [{ id: 'slot-500' }],
  ]
  const client = {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        gte: (field, value) => { calls.push(['gte', field, value]); return query },
        lt: (field, value) => { calls.push(['lt', field, value]); return query },
        gt: (field, value) => { calls.push(['gt', field, value]); return query },
        order: (field) => { calls.push(['order', field]); return query },
        range: async (from) => ({ data: pages[from / 500], error: null }),
      }
      return query
    },
  }
  const slots = await fetchAdminAvailabilitySlotsForMonth(client, '2026-10')
  assert.equal(slots.length, 501)
  assert.deepEqual(calls.filter(([kind]) => kind === 'order'), [['order', 'starts_at'], ['order', 'id'], ['order', 'starts_at'], ['order', 'id']])
  assert.deepEqual(calls.filter(([kind]) => ['gte', 'lt'].includes(kind)).slice(0, 2), [
    ['gte', 'starts_at', '2026-09-30T22:00:00.000Z'],
    ['lt', 'starts_at', '2026-10-31T23:00:00.000Z'],
  ])
})

test('ne propose pas les disponibilités déjà passées dans le mois courant', async () => {
  const source = [
    { id: 'past', starts_at: '2026-09-01T08:00:00.000Z' },
    { id: 'future', starts_at: '2026-09-21T08:00:00.000Z' },
  ]
  let minimumStart = ''
  const client = {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        gte: () => query,
        lt: () => query,
        gt: (field, value) => { assert.equal(field, 'starts_at'); minimumStart = value; return query },
        order: () => query,
        range: async () => ({
          data: source.filter((slot) => new Date(slot.starts_at) > new Date(minimumStart)),
          error: null,
        }),
      }
      return query
    },
  }
  const slots = await fetchAdminAvailabilitySlotsForMonth(client, '2026-09', { now: '2026-09-14T10:00:00.000Z' })
  assert.equal(minimumStart, '2026-09-14T10:00:00.000Z')
  assert.deepEqual(slots.map(({ id }) => id), ['future'])
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
