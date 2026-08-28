const GENERIC_AVAILABILITY_ERROR = 'Les disponibilités ne peuvent pas être chargées pour le moment.'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function functionErrorMessage(error) {
  if (error?.context && typeof error.context.json === 'function') {
    const payload = await error.context.json().catch(() => null)
    return payload?.error || GENERIC_AVAILABILITY_ERROR
  }
  return GENERIC_AVAILABILITY_ERROR
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
