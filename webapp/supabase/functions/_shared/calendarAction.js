import { assertCalendarAvailable } from './calendarAvailability.js'

export async function runCalendarAction({ client, actorId = null, action, payload, requestId = null, availabilityOptions = {} }) {
  const { data: prepared, error: prepareError } = await client.rpc('prepare_unified_calendar_action', {
    p_actor_id: actorId, p_action: action, p_payload: payload, p_request_id: requestId,
  })
  if (prepareError) throw prepareError
  const ticket = Array.isArray(prepared) ? prepared[0] : prepared
  if (ticket?.already_executed === true && Object.hasOwn(ticket, 'result')) return ticket.result
  if (!ticket || typeof ticket.action_id !== 'string' || typeof ticket.proof !== 'string'
    || !Array.isArray(ticket.intervals) || !ticket.intervals.length) throw new Error('google_calendar_action_invalid')
  // The opaque ticket is short-lived and bound to the exact database snapshot.
  // Completed intents are recovered by execute; they must not create a second booking.
  await assertCalendarAvailable({ ...availabilityOptions, intervals: ticket.intervals,
    ownEvents: [...(ticket.own_events || []), ...(availabilityOptions.ownEvents || [])] })
  const { data, error } = await client.rpc('execute_unified_calendar_action', {
    p_action_id: ticket.action_id, p_proof: ticket.proof,
  })
  if (error) throw error
  return data
}
