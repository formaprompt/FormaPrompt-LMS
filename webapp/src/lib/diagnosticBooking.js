const GENERIC_AVAILABILITY_ERROR = 'Les disponibilités ne peuvent pas être chargées pour le moment.'
const GENERIC_BOOKING_ERROR = 'La réservation ne peut pas être finalisée pour le moment.'
const GENERIC_RESCHEDULE_ERROR = 'Le rendez-vous ne peut pas être déplacé pour le moment.'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MEET_URL_PATTERN = /^https:\/\/meet[.]google[.]com\/[A-Za-z0-9-]+$/

async function functionErrorMessage(error, fallback = GENERIC_AVAILABILITY_ERROR) {
  if (error?.context && typeof error.context.json === 'function') {
    const payload = await error.context.json().catch(() => null)
    return payload?.error || fallback
  }
  return fallback
}
function validCandidate(candidate) {
  const start = new Date(candidate?.starts_at)
  const end = new Date(candidate?.ends_at)
  return typeof candidate?.id === 'string'
    && Array.isArray(candidate.slot_ids)
    && candidate.slot_ids.length === 3
    && new Set(candidate.slot_ids).size === 3
    && candidate.slot_ids.every((id) => UUID_PATTERN.test(id))
    && !Number.isNaN(start.getTime())
    && !Number.isNaN(end.getTime())
    && end.getTime() - start.getTime() === 90 * 60_000
}

export async function fetchDiagnosticAvailability(supabase, orderId) {
  if (!UUID_PATTERN.test(orderId || '')) throw new Error('La référence de commande est invalide.')
  const { data, error } = await supabase.functions.invoke('get-diagnostic-availability', {
    body: { order_id: orderId },
  })
  if (error) throw new Error(await functionErrorMessage(error))
  return Array.isArray(data?.candidates) ? data.candidates.filter(validCandidate) : []
}

export async function fetchDiagnosticRescheduleAvailability(supabase, bookingId, range = {}) {
  if (!UUID_PATTERN.test(bookingId || '')) throw new Error('La référence du rendez-vous est invalide.')
  const body = { booking_id: bookingId }
  if (range.from) body.from = range.from
  if (range.to) body.to = range.to
  const { data, error } = await supabase.functions.invoke('get-diagnostic-availability', { body })
  if (error) throw new Error(await functionErrorMessage(error))
  return Array.isArray(data?.candidates) ? data.candidates.filter(validCandidate) : []
}

export async function rescheduleDiagnosticBooking(supabase, bookingId, candidate) {
  if (!UUID_PATTERN.test(bookingId || '') || !validCandidate(candidate)) {
    throw new Error('La sélection de déplacement est invalide.')
  }
  const { data, error } = await supabase.functions.invoke('admin-reschedule-diagnostic-booking', {
    body: { booking_id: bookingId, slot_ids: candidate.slot_ids },
  })
  if (error) throw new Error(await functionErrorMessage(error, GENERIC_RESCHEDULE_ERROR))
  const booking = data?.booking
  const start = new Date(booking?.starts_at)
  const end = new Date(booking?.ends_at)
  if (booking?.id !== bookingId
    || booking?.status !== 'booked'
    || Number.isNaN(start.getTime())
    || Number.isNaN(end.getTime())
    || end.getTime() - start.getTime() !== 90 * 60_000) {
    throw new Error(GENERIC_RESCHEDULE_ERROR)
  }
  return booking
}

export async function confirmDiagnosticBooking(supabase, orderId, candidate, consents = {}) {
  if (!UUID_PATTERN.test(orderId || '') || !validCandidate(candidate)) {
    throw new Error('La sélection de réservation est invalide.')
  }
  const { data, error } = await supabase.functions.invoke('confirm-diagnostic-booking', {
    body: {
      order_id: orderId,
      slot_ids: candidate.slot_ids,
      early_service_start_requested: consents.earlyStartRequested === true,
      full_performance_withdrawal_acknowledged: consents.fullPerformanceAcknowledged === true,
      early_service_start_statement_version: 'DIAGNOSTIC-EARLY-START-2026-08-26',
      full_performance_acknowledgement_version: 'DIAGNOSTIC-FULL-PERFORMANCE-ACK-2026-08-26',
    },
  })
  if (error) throw new Error(await functionErrorMessage(error, GENERIC_BOOKING_ERROR))

  const booking = data?.booking
  const start = new Date(booking?.starts_at)
  const end = new Date(booking?.ends_at)
  const meetUrlIsValid = booking?.google_meet_url == null
    || MEET_URL_PATTERN.test(booking.google_meet_url)
  if (!UUID_PATTERN.test(booking?.id || '')
    || !['booked', 'completed'].includes(booking?.status)
    || Number.isNaN(start.getTime())
    || Number.isNaN(end.getTime())
    || end.getTime() - start.getTime() !== 90 * 60_000
    || !meetUrlIsValid) {
    throw new Error(GENERIC_BOOKING_ERROR)
  }
  return booking
}

export function formatDiagnosticCandidate(candidate) {
  const start = new Date(candidate.starts_at)
  const end = new Date(candidate.ends_at)
  return {
    dateKey: new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(start),
    dateLabel: new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(start),
    timeLabel: `${start.toLocaleTimeString('fr-FR', {
      timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit',
    })} – ${end.toLocaleTimeString('fr-FR', {
      timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit',
    })}`,
  }
}
