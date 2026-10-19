import { corsHeaders } from '../_shared/cors.ts'
import { calendarActor, calendarErrorResponse, calendarResponse, calendarServiceClient } from '../_shared/calendarServer.ts'
import { runCalendarAction } from '../_shared/calendarAction.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return calendarResponse({ error: 'Méthode non autorisée.' }, 405)
  try {
    const body = await request.json().catch(() => ({}))
    if (!UUID.test(body.request_id || '') || !['create', 'confirm'].includes(body.action)) {
      return calendarResponse({ error: 'Demande de réservation invalide.' }, 400)
    }
    const actorId = await calendarActor(request, body.action === 'confirm')
    if (body.action === 'create') {
      const booking = body.booking
      if (!booking || typeof booking !== 'object' || Array.isArray(booking)
        || !/^\d{4}-\d{2}-\d{2}$/.test(booking.date || '')
        || !['Matin', 'Après-midi', 'Journée'].includes(booking.slot)
        || !['option', 'confirmé'].includes(booking.type)
        || typeof booking.of_name !== 'string' || booking.of_name.trim().length < 2
        || booking.of_name.length > 150 || (booking.comments != null && (typeof booking.comments !== 'string' || booking.comments.length > 2000))) {
        return calendarResponse({ error: 'Informations de réservation invalides.' }, 400)
      }
    } else if (!UUID.test(body.booking_id || '')) {
      return calendarResponse({ error: 'Réservation invalide.' }, 400)
    }
    const result = await runCalendarAction({
      client: calendarServiceClient(), actorId,
      action: body.action === 'create' ? 'create_calendar_booking' : 'confirm_calendar_booking',
      payload: body.action === 'create'
        ? { booking: { date: body.booking.date, slot: body.booking.slot, type: body.booking.type, of_name: body.booking.of_name.trim(), comments: body.booking.comments || '' }, request_id: body.request_id }
        : { booking_id: body.booking_id, request_id: body.request_id },
      requestId: body.request_id,
    })
    return calendarResponse(result, body.action === 'create' ? 201 : 200)
  } catch (error) { return calendarErrorResponse(error) }
})
