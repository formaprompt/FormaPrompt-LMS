import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { runCalendarAction } from '../_shared/calendarAction.js'
import { INDIVIDUAL_14H_COURSE_IDS, BUREAUTIQUE_SCHEDULE_FORMATS } from '../_shared/bureautiqueBooking.js'

test('approbation présentielle : vraie chaîne handler/preuve/Google conserve une seule enveloppe booking', async () => {
  const actor = '10000000-0000-4000-8000-000000000001'
  const bookingId = '20000000-0000-4000-8000-000000000001'
  const row = { id: bookingId, status: 'awaiting_travel_payment', distance_status: 'approved' }
  const calls = []
  let googleChecks = 0
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: actor } } }) },
    rpc: async (name, args) => {
      calls.push({ name, args })
      if (name === 'prepare_unified_calendar_action') return { data: {
        action_id: '30000000-0000-4000-8000-000000000001',
        proof: '40000000-0000-4000-8000-000000000001',
        intervals: [{ starts_at: '2030-04-15T08:00:00Z', ends_at: '2030-04-15T10:00:00Z' }],
      } }
      assert.equal(googleChecks, 1, 'la mutation suit un contrôle Google effectif')
      return { data: { booking: row } }
    },
  }
  const fetchImpl = async (_url, options) => {
    googleChecks += 1
    const body = JSON.parse(options.body)
    return { ok: true, json: async () => ({ calendars: Object.fromEntries(body.items.map(({ id }) => [id, { busy: [] }])) }) }
  }
  let handler
  const Deno = { env: { get: () => 'configured' }, serve: (value) => { handler = value } }
  const response = (body, status = 200) => new Response(JSON.stringify(body), { status })
  const source = readFileSync(new URL('../create-course-booking/index.ts', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '')
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext })
  new Function('Deno', 'createClient', 'corsHeaders', 'jsonResponse', 'INDIVIDUAL_14H_COURSE_IDS',
    'BUREAUTIQUE_SCHEDULE_FORMATS', 'runCalendarAction', 'calendarServiceClient', 'calendarErrorResponse', js)(
    Deno, () => client, {}, response, INDIVIDUAL_14H_COURSE_IDS, BUREAUTIQUE_SCHEDULE_FORMATS,
    (options) => runCalendarAction({ ...options, availabilityOptions: { accessToken: 'fictitious', fetchImpl, env: () => undefined } }),
    () => client, (error) => { throw error },
  )
  const result = await handler(new Request('https://local.test', {
    method: 'POST', headers: { Authorization: 'Bearer fictitious', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'admin_decision', decision: 'approve', booking_request_id: bookingId }),
  }))
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { booking: row })
  assert.equal(calls[0].args.p_actor_id, actor)
  assert.equal(calls[0].args.p_action, 'approve_course_booking')
  assert.deepEqual(calls[0].args.p_payload, { p_booking_request_id: bookingId })
  assert.equal(calls[1].name, 'execute_unified_calendar_action')
})
