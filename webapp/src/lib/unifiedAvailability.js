export const AVAILABILITY_UNAVAILABLE = 'Disponibilités temporairement indisponibles. Réessayez plus tard.'
export const AVAILABILITY_REFRESH_MS = 30_000

const validInstant = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const validSlot = (slot) => typeof slot?.id === 'string'
  && validInstant(slot.starts_at) && validInstant(slot.ends_at)
  && Date.parse(slot.ends_at) > Date.parse(slot.starts_at)
  && Array.isArray(slot.delivery_modes)
  && slot.is_reserved !== true && slot.is_active !== false
const validBlock = (block) => /^\d{4}-\d{2}-\d{2}$/.test(block?.booking_date || '')
  && ['Matin', 'Après-midi', 'Journée'].includes(block.slot)

// No client cache or database fallback: only a successful complete server check is usable.
export async function fetchUnifiedAvailability(client, body) {
  const { data, error } = await client.functions.invoke('get-unified-availability', { body })
  const rows = body.purpose === 'public_calendar' ? data?.blocks : data?.slots
  const validate = body.purpose === 'public_calendar' ? validBlock : validSlot
  if (error || data?.status !== 'available' || data?.time_zone !== 'Europe/Paris'
    || !validInstant(data.checked_at)
    || Date.now() - Date.parse(data.checked_at) > AVAILABILITY_REFRESH_MS
    || Date.parse(data.checked_at) - Date.now() > 5_000
    || !validInstant(data.range?.from) || !validInstant(data.range?.to)
    || Date.parse(data.range.to) <= Date.parse(data.range.from)
    || (body.from && Date.parse(data.range.from) > Date.parse(body.from))
    || (body.to && Date.parse(data.range.to) < Date.parse(body.to))
    || !Array.isArray(rows) || !rows.every(validate)) {
    throw new Error(AVAILABILITY_UNAVAILABLE)
  }
  return data
}

export async function manageCalendarBooking(client, body) {
  const { data, error } = await client.functions.invoke('manage-calendar-booking', { body })
  if (error) {
    const payload = await error?.context?.json?.().catch(() => null)
    throw new Error(payload?.code === 'CALENDAR_UNAVAILABLE' ? AVAILABILITY_UNAVAILABLE
      : payload?.error || 'La réservation ne peut pas être enregistrée pour le moment.')
  }
  const rows = body.action === 'create' ? data?.bookings : [data?.booking]
  if (!Array.isArray(rows) || !rows.length || rows.some(row => !row?.id || !row.date || !row.slot)) {
    throw new Error('La confirmation de réservation ne peut pas être vérifiée. Réessayez la même demande.')
  }
  return rows
}

// The server derives bounded windows from published slots, including distant dates.
// Metadata never authorizes a slot: every nonempty window needs a full calendar check.
export async function fetchCourseAvailability(client, courseId) {
  const { data, error } = await client.functions.invoke('get-unified-availability', {
    body: { purpose: 'course_booking', course_id: courseId, horizon: true },
  })
  if (error || !data || !Object.hasOwn(data, 'booking_horizon')) throw new Error(AVAILABILITY_UNAVAILABLE)
  if (data.booking_horizon === null) return { slots: [], checked_at: new Date().toISOString() }
  const horizon = data.booking_horizon
  if (!validInstant(horizon.from) || !validInstant(horizon.to)
    || !Array.isArray(horizon.windows) || !horizon.windows.length
    || horizon.windows.some(window => !validInstant(window.from) || !validInstant(window.to)
      || Date.parse(window.to) <= Date.parse(window.from)
      || Date.parse(window.to) - Date.parse(window.from) > 93 * 86_400_000)) {
    throw new Error(AVAILABILITY_UNAVAILABLE)
  }
  const results = []
  for (let index = 0; index < horizon.windows.length; index += 4) {
    results.push(...await Promise.all(horizon.windows.slice(index, index + 4).map(window => (
      fetchUnifiedAvailability(client, { purpose: 'course_booking', course_id: courseId, ...window })
    ))))
  }
  return {
    slots: [...new Map(results.flatMap(result => result.slots).map(slot => [slot.id, slot])).values()],
    checked_at: new Date(Math.min(...results.map(result => Date.parse(result.checked_at)))).toISOString(),
  }
}


export async function approveCourseBooking(client, bookingId) {
  const { data, error } = await client.functions.invoke('create-course-booking', {
    body: { action: 'admin_decision', decision: 'approve', booking_request_id: bookingId },
  })
  if (error) {
    const payload = await error?.context?.json?.().catch(() => null)
    throw new Error(payload?.code === 'CALENDAR_UNAVAILABLE' ? AVAILABILITY_UNAVAILABLE
      : payload?.error || 'La réservation ne peut pas être validée pour le moment.')
  }
  if (data?.booking?.id !== bookingId || !['awaiting_travel_payment', 'confirmed'].includes(data.booking.status)) {
    throw new Error('La validation de réservation ne peut pas être vérifiée. Rechargez la page.')
  }
  return data.booking
}
