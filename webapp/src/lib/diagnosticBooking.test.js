import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchDiagnosticAvailability,
  fetchDiagnosticRescheduleAvailability,
  formatDiagnosticCandidate,
  rescheduleDiagnosticBooking,
} from './diagnosticBooking.js'

const ORDER_ID = '88000000-0000-4000-8000-000000000001'
const CANDIDATE = {
  id: 'candidate-1',
  slot_ids: [
    '88000000-0000-4000-8000-000000000011',
    '88000000-0000-4000-8000-000000000012',
    '88000000-0000-4000-8000-000000000013',
  ],
  starts_at: '2026-09-03T08:00:00.000Z',
  ends_at: '2026-09-03T09:30:00.000Z',
  requires_early_start_consents: false,
}

test('interroge uniquement le serveur avec la commande authentifiée et filtre les réponses invalides', async () => {
    const calls = []
    const invoke = async (...args) => {
      calls.push(args)
      return {
      data: { candidates: [CANDIDATE, { ...CANDIDATE, id: 'invalid', slot_ids: CANDIDATE.slot_ids.slice(0, 2) }] },
      error: null,
      }
    }

    assert.deepEqual(await fetchDiagnosticAvailability({ functions: { invoke } }, ORDER_ID), [CANDIDATE])
    assert.deepEqual(calls, [['get-diagnostic-availability', { body: { order_id: ORDER_ID } }]])
    assert.doesNotMatch(JSON.stringify(calls), /amount|price/i)
  })

test('refuse une référence de commande invalide avant tout appel serveur', async () => {
    let called = false
    const invoke = async () => { called = true }
    await assert.rejects(fetchDiagnosticAvailability({ functions: { invoke } }, 'invalid'), /référence de commande/)
    assert.equal(called, false)
  })

test('restitue le message contrôlé de la fonction', async () => {
    const invoke = async () => ({
      data: null,
      error: { context: { json: async () => ({ error: 'Paiement requis.' }) } },
    })
    await assert.rejects(fetchDiagnosticAvailability({ functions: { invoke } }, ORDER_ID), /Paiement requis/)
  })

test('formate le créneau dans le fuseau Europe/Paris', () => {
    const formatted = formatDiagnosticCandidate(CANDIDATE)
    assert.match(formatted.dateLabel, /jeudi 3 septembre 2026/i)
  assert.equal(formatted.timeLabel, '10:00 – 11:30')
})

test('réutilise la disponibilité serveur avec le contexte booking administrateur', async () => {
  const calls = []
  const client = { functions: { invoke: async (...args) => {
    calls.push(args)
    return { data: { candidates: [CANDIDATE] }, error: null }
  } } }
  assert.deepEqual(await fetchDiagnosticRescheduleAvailability(client, ORDER_ID), [CANDIDATE])
  assert.deepEqual(calls, [['get-diagnostic-availability', { body: { booking_id: ORDER_ID } }]])
})

test('déplace le même booking par la fonction serveur dédiée', async () => {
  const calls = []
  const client = { functions: { invoke: async (...args) => {
    calls.push(args)
    return { data: { booking: {
      id: ORDER_ID,
      order_id: 'order-preserved',
      status: 'booked',
      starts_at: CANDIDATE.starts_at,
      ends_at: CANDIDATE.ends_at,
    } }, error: null }
  } } }
  const booking = await rescheduleDiagnosticBooking(client, ORDER_ID, CANDIDATE)
  assert.equal(booking.id, ORDER_ID)
  assert.equal(booking.order_id, 'order-preserved')
  assert.deepEqual(calls, [['admin-reschedule-diagnostic-booking', {
    body: { booking_id: ORDER_ID, slot_ids: CANDIDATE.slot_ids },
  }]])
})
