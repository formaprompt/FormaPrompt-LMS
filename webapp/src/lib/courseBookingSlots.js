const MINUTE_MS = 60_000

const SESSION_GROUP_MINUTES = {
  one_4h: [240],
  two_2h: [120, 120],
  four_1h: [60, 60, 60, 60],
  one_day_7h: [240, 180],
  two_3h30: [210, 210],
}

function durationMinutes(slot) {
  return Math.round((new Date(slot.ends_at) - new Date(slot.starts_at)) / MINUTE_MS)
}

function compatibleBaseSlots(slots, deliveryMode) {
  const compatible = slots
    .filter((slot) => slot.delivery_modes?.includes(deliveryMode))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
  const durations = compatible.map(durationMinutes).filter((duration) => duration > 0)
  const baseMinutes = durations.length ? Math.min(...durations) : 0

  return {
    baseMinutes,
    slots: compatible.filter((slot) => durationMinutes(slot) === baseMinutes),
  }
}

export function createBookingCandidates(slots, { duration, deliveryMode }) {
  const base = compatibleBaseSlots(slots, deliveryMode)
  const requiredSlots = duration / base.baseMinutes
  if (!base.baseMinutes || !Number.isInteger(requiredSlots) || requiredSlots < 1) return []

  const slotByStart = new Map(base.slots.map((slot) => [new Date(slot.starts_at).getTime(), slot]))

  return base.slots.flatMap((firstSlot) => {
    const group = [firstSlot]
    let expectedStart = new Date(firstSlot.ends_at).getTime()

    while (group.length < requiredSlots) {
      const nextSlot = slotByStart.get(expectedStart)
      if (!nextSlot) return []
      group.push(nextSlot)
      expectedStart = new Date(nextSlot.ends_at).getTime()
    }

    return [{
      id: group.map((slot) => slot.id).join(':'),
      slotIds: group.map((slot) => slot.id),
      starts_at: group[0].starts_at,
      ends_at: group[group.length - 1].ends_at,
    }]
  })
}

function parisDateKey(value) {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export function createSplitDayBookingCandidates(slots, {
  deliveryMode,
  morningDuration = 240,
  afternoonDuration = 180,
  lunchMinutes = 60,
}) {
  const morningCandidates = createBookingCandidates(slots, { duration: morningDuration, deliveryMode })
  const afternoonCandidates = createBookingCandidates(slots, { duration: afternoonDuration, deliveryMode })

  return morningCandidates.flatMap((morning) => {
    const expectedAfternoonStart = new Date(morning.ends_at).getTime() + lunchMinutes * MINUTE_MS
    const afternoon = afternoonCandidates.find((candidate) => (
      new Date(candidate.starts_at).getTime() === expectedAfternoonStart
      && parisDateKey(candidate.starts_at) === parisDateKey(morning.starts_at)
    ))
    if (!afternoon) return []

    return [{
      id: `${morning.id}|${afternoon.id}`,
      slotIds: [...morning.slotIds, ...afternoon.slotIds],
      starts_at: morning.starts_at,
      ends_at: afternoon.ends_at,
      segments: [morning, afternoon],
    }]
  })
}

export function flattenSelectedSlotIds(candidates, selectedCandidateIds) {
  const selectedIds = new Set(selectedCandidateIds)
  return candidates
    .filter((candidate) => selectedIds.has(candidate.id))
    .flatMap((candidate) => candidate.slotIds)
}

export function groupBookedSessions(sessions, scheduleFormat) {
  const targetDurations = SESSION_GROUP_MINUTES[scheduleFormat]
  const sortedSessions = [...sessions].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
  if (!targetDurations) return sortedSessions

  const grouped = []
  let offset = 0

  for (const targetDuration of targetDurations) {
    const group = []
    let accumulated = 0

    while (offset < sortedSessions.length && accumulated < targetDuration) {
      const session = sortedSessions[offset]
      if (group.length > 0
        && new Date(group[group.length - 1].ends_at).getTime() !== new Date(session.starts_at).getTime()) {
        return sortedSessions
      }
      group.push(session)
      accumulated += Number(session.duration_minutes) || durationMinutes(session)
      offset += 1
    }

    if (accumulated !== targetDuration || group.length === 0) return sortedSessions
    grouped.push({
      ...group[0],
      id: group.map((session) => session.id).join(':'),
      starts_at: group[0].starts_at,
      ends_at: group[group.length - 1].ends_at,
      duration_minutes: targetDuration,
      meeting_url: group.find((session) => session.meeting_url)?.meeting_url || null,
    })
  }

  return offset === sortedSessions.length ? grouped : sortedSessions
}

export function getLastBookedSession(booking) {
  const sessions = groupBookedSessions(
    booking?.course_session_bookings || [],
    booking?.schedule_format,
  )

  return sessions.reduce((latest, session) => (
    !latest || new Date(session.ends_at) > new Date(latest.ends_at) ? session : latest
  ), null)
}

export function hasLearnerSignedLastSession(booking) {
  const lastSession = getLastBookedSession(booking)
  if (!lastSession) return false

  const lastStart = new Date(lastSession.starts_at).getTime()
  const lastEnd = new Date(lastSession.ends_at).getTime()

  return (booking?.course_session_attendance || []).some((attendance) => (
    Boolean(attendance.learner_signature_sha256)
    && new Date(attendance.session_starts_at).getTime() === lastStart
    && new Date(attendance.session_ends_at).getTime() === lastEnd
  ))
}
