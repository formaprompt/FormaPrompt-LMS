const MINUTE_MS = 60_000
const PARIS_TIME_ZONE = 'Europe/Paris'

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parisParts(value) {
  const date = toDate(value)
  if (!date) return null

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]))

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    minuteOfDay: Number(values.hour) * 60 + Number(values.minute),
  }
}

export function parisDateKey(value) {
  return parisParts(value)?.dateKey || null
}

export function getBlockedDiagnosticDays(bookings, now = new Date()) {
  const nowMs = toDate(now)?.getTime() ?? Date.now()
  return bookings
    .filter((booking) => booking.status === 'booked'
      || (booking.status === 'booking_pending'
        && (toDate(booking.claim_expires_at)?.getTime() ?? 0) > nowMs))
    .map((booking) => parisDateKey(booking.starts_at))
    .filter(Boolean)
}

function overlaps(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && firstEnd > secondStart
}

function overlapsGoogleBusy(startsAt, endsAt, busyPeriods) {
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  return busyPeriods.some((busy) => {
    const busyStart = toDate(busy.start)?.getTime()
    const busyEnd = toDate(busy.end)?.getTime()
    return Number.isFinite(busyStart) && Number.isFinite(busyEnd)
      && overlaps(start, end, busyStart, busyEnd)
  })
}

function overlapsFormaPromptBlock(startsAt, endsAt, blocks) {
  const start = parisParts(startsAt)
  const end = parisParts(new Date(new Date(endsAt).getTime() - 1))
  if (!start || !end) return true

  return blocks.some((block) => {
    if (block.date !== start.dateKey && block.date !== end.dateKey) return false
    if (block.slot === 'Journée') return true
    if (block.slot === 'Matin') return start.minuteOfDay < 13 * 60
    if (block.slot === 'Après-midi') return end.minuteOfDay >= 13 * 60
    return false
  })
}

function isThirtyMinuteRemoteSlot(slot, nowMs) {
  const start = toDate(slot.starts_at)
  const end = toDate(slot.ends_at)
  return Boolean(
    slot?.id
    && start
    && end
    && start.getTime() > nowMs
    && end.getTime() - start.getTime() === 30 * MINUTE_MS
    && slot.delivery_modes?.includes('remote')
    && slot.is_active !== false
    && slot.is_reserved !== true,
  )
}

export function createDiagnosticAvailabilityCandidates({
  slots,
  now = new Date(),
  blockedDiagnosticDays = [],
  formaPromptBlocks = [],
  googleBusy = [],
}) {
  const blockedDays = new Set(blockedDiagnosticDays)
  const nowMs = toDate(now)?.getTime() ?? Date.now()
  const compatible = slots
    .filter((slot) => isThirtyMinuteRemoteSlot(slot, nowMs))
    .sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at))
  const byStart = new Map(compatible.map((slot) => [new Date(slot.starts_at).getTime(), slot]))

  return compatible.flatMap((firstSlot) => {
    const group = [firstSlot]
    let expectedStart = new Date(firstSlot.ends_at).getTime()

    while (group.length < 3) {
      const next = byStart.get(expectedStart)
      if (!next) return []
      group.push(next)
      expectedStart = new Date(next.ends_at).getTime()
    }

    const startsAt = group[0].starts_at
    const endsAt = group[2].ends_at
    const startParis = parisParts(startsAt)
    const endParis = parisParts(endsAt)
    if (!startParis || !endParis
      || startParis.dateKey !== endParis.dateKey
      || endParis.minuteOfDay > 21 * 60
      || blockedDays.has(startParis.dateKey)
      || overlapsFormaPromptBlock(startsAt, endsAt, formaPromptBlocks)
      || overlapsGoogleBusy(startsAt, endsAt, googleBusy)) {
      return []
    }

    return [{
      id: group.map((slot) => slot.id).join(':'),
      slot_ids: group.map((slot) => slot.id),
      starts_at: startsAt,
      ends_at: endsAt,
    }]
  })
}
