import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchUnifiedAvailability, fetchCourseAvailability, manageCalendarBooking, approveCourseBooking } from './unifiedAvailability.js'

const response = (extra = {}) => ({ status: 'available', time_zone: 'Europe/Paris', checked_at: new Date().toISOString(), range: { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z' }, blocks: [], ...extra })
const client = (data, error = null) => ({ functions: { invoke: async () => ({ data, error }) } })
const body = { purpose: 'public_calendar', month: '2026-10' }

test('un résultat vérifié vide est distinct d’une panne ou réponse incomplète', async () => {
  assert.deepEqual((await fetchUnifiedAvailability(client(response()), body)).blocks, [])
  for (const data of [null, {}, response({blocks:null}), response({status:'unavailable'}), response({blocks:[{}]}), response({checked_at:new Date(Date.now()-31_000).toISOString()})]) {
    await assert.rejects(fetchUnifiedAvailability(client(data), body), /temporairement indisponibles/)
  }
  await assert.rejects(fetchUnifiedAvailability(client(response(), new Error('upstream')), body), /temporairement indisponibles/)
})

test('un intervalle incomplet ne devient jamais une plage réservable', async () => {
  const courseBody = {purpose:'course_booking',from:'2026-10-01T00:00:00Z',to:'2026-11-01T00:00:00Z',course_id:'formation-ia'}
  await assert.rejects(fetchUnifiedAvailability(client(response({slots:[{id:'x',starts_at:'2026-10-01T08:00:00Z'}]})), courseBody), /temporairement indisponibles/)
})

test('transmet un identifiant de demande stable lors d’un réessai OF et conserve le message de panne', async () => {
  const requests = []
  const api = {functions:{invoke:async (name, options) => { requests.push([name,options]); return {data:{bookings:[{id:'1',date:'2026-10-20',slot:'Matin'}]}} }}}
  const request = {action:'create',request_id:'stable',booking:{date:'2026-10-20',slot:'Matin'}}
  await manageCalendarBooking(api, request)
  await manageCalendarBooking(api, request)
  assert.deepEqual(requests[0], requests[1])
  await assert.rejects(manageCalendarBooking(client(null,{context:{json:async()=>({code:'CALENDAR_UNAVAILABLE'})}}),request),/temporairement indisponibles/)
})


test('préserve les plages publiées éloignées sans interroger les années vides', async () => {
  const windows = [{from:'2026-10-20T08:00:00Z',to:'2026-10-20T12:00:00Z'}, {from:'2030-03-12T08:00:00Z',to:'2030-03-12T12:00:00Z'}]
  const calls = []
  const api = {functions:{invoke:async (_, {body}) => {
    calls.push(body)
    if (body.horizon) return {data:{booking_horizon:{from:windows[0].from,to:windows[1].to,windows}}}
    return {data:response({range:{from:body.from,to:body.to},slots:[{id:body.from,starts_at:body.from,ends_at:body.to,delivery_modes:['remote']}]})}
  }}}
  const result = await fetchCourseAvailability(api, 'formation-ia')
  assert.equal(result.slots.length,2)
  assert.equal(calls.length,3)
  assert.equal(calls[2].from,'2030-03-12T08:00:00Z')
  assert.ok(calls.every(call => call.course_id === 'formation-ia'))
})

test('une fenêtre en panne interdit de présenter les autres comme un résultat complet', async () => {
  let count = 0
  const windows = [{from:'2026-10-20T08:00:00Z',to:'2026-10-20T12:00:00Z'}, {from:'2030-03-12T08:00:00Z',to:'2030-03-12T12:00:00Z'}]
  const api = {functions:{invoke:async (_, {body}) => {
    if (body.horizon) return {data:{booking_horizon:{from:windows[0].from,to:windows[1].to,windows}}}
    count += 1
    return count === 1 ? {data:response({range:{from:body.from,to:body.to},slots:[]})} : {error:new Error('calendar failure')}
  }}}
  await assert.rejects(fetchCourseAvailability(api,'formation-ia'),/temporairement indisponibles/)
})


test('l’approbation présentielle conserve le statut de frais serveur et ne contourne pas une panne agenda', async () => {
  const calls = []
  const api = {functions:{invoke:async (name, options) => {
    calls.push([name,options])
    return {data:{booking:{id:'booking',status:'awaiting_travel_payment',distance_status:'approved'}}}
  }}}
  assert.equal((await approveCourseBooking(api,'booking')).status,'awaiting_travel_payment')
  assert.deepEqual(calls, [['create-course-booking',{body:{action:'admin_decision',decision:'approve',booking_request_id:'booking'}}]])
  await assert.rejects(approveCourseBooking(client(null,{context:{json:async()=>({code:'CALENDAR_UNAVAILABLE'})}}),'booking'),/temporairement indisponibles/)
  await assert.rejects(approveCourseBooking(client({booking:{id:'another',status:'confirmed'}}),'booking'),/ne peut pas être vérifiée/)
})
