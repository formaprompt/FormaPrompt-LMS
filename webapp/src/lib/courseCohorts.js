async function readFunctionError(error, fallback) {
  try {
    const payload = await error?.context?.json()
    return typeof payload?.error === 'string' ? payload.error : fallback
  } catch {
    return fallback
  }
}

async function invoke(client, functionName, body, fallback) {
  const { data, error } = await client.functions.invoke(functionName, { body })
  if (error) throw new Error(await readFunctionError(error, fallback))
  return data
}

const PARIS_TIME_ZONE = 'Europe/Paris'
const AVAILABILITY_PAGE_SIZE = 500

function parisLocalMidnightUtc(year, month) {
  const target = Date.UTC(year, month - 1, 1)
  let instant = target
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const values = Object.fromEntries(formatter.formatToParts(new Date(instant))
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]))
    const displayedAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second)
    const nextInstant = instant + (target - displayedAsUtc)
    if (nextInstant === instant) break
    instant = nextInstant
  }

  return new Date(instant).toISOString()
}

export function getParisMonthBounds(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey)
  const year = Number(match?.[1])
  const month = Number(match?.[2])
  if (!match || month < 1 || month > 12) throw new Error('Mois de disponibilité invalide.')
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return {
    startsAt: parisLocalMidnightUtc(year, month),
    endsAt: parisLocalMidnightUtc(nextYear, nextMonth),
  }
}

export async function fetchAdminAvailabilitySlotsForMonth(client, monthKey, { now = new Date() } = {}) {
  const { startsAt, endsAt } = getParisMonthBounds(monthKey)
  const nowIso = new Date(now).toISOString()
  const slots = []

  for (let from = 0; ; from += AVAILABILITY_PAGE_SIZE) {
    const { data, error } = await client
      .from('training_availability_slots')
      .select('*')
      .eq('is_active', true)
      .eq('is_reserved', false)
      .gte('starts_at', startsAt)
      .lt('starts_at', endsAt)
      .gt('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + AVAILABILITY_PAGE_SIZE - 1)
    if (error) throw new Error("Les disponibilités de ce mois ne peuvent pas être chargées.")
    const page = data || []
    slots.push(...page)
    if (page.length < AVAILABILITY_PAGE_SIZE) return slots
  }
}

export async function fetchAdminBookingAvailabilitySlots(client) {
  const slots = []
  for (let from = 0; ; from += AVAILABILITY_PAGE_SIZE) {
    const { data, error } = await client
      .from('training_availability_slots')
      .select('*')
      .or('is_active.eq.true,is_reserved.eq.true')
      .order('starts_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + AVAILABILITY_PAGE_SIZE - 1)
    if (error) throw new Error("Les disponibilités ne peuvent pas être chargées.")
    const page = data || []
    slots.push(...page)
    if (page.length < AVAILABILITY_PAGE_SIZE) return slots
  }
}

export async function fetchAvailableCourseCohorts(client, courseId) {
  const data = await invoke(client, 'join-course-cohort', {
    action: 'list',
    course_id: courseId,
  }, 'Les sessions inter ne peuvent pas être chargées.')
  return Array.isArray(data?.cohorts) ? data.cohorts : []
}

export async function fetchMyCourseCohortEnrollment(client, courseId) {
  const data = await invoke(client, 'join-course-cohort', {
    action: 'my_enrollment',
    course_id: courseId,
  }, 'Votre inscription inter ne peut pas être chargée.')
  return data?.enrollment || null
}

export async function joinCourseCohort(client, cohortId) {
  const data = await invoke(client, 'join-course-cohort', {
    action: 'join',
    cohort_id: cohortId,
  }, "L'inscription à cette session n'a pas pu être enregistrée.")
  return data?.enrollment || null
}

export async function cancelCourseCohortEnrollment(client, enrollmentId) {
  const data = await invoke(client, 'join-course-cohort', {
    action: 'cancel',
    enrollment_id: enrollmentId,
  }, "L'inscription à cette session ne peut pas être annulée.")
  return data?.enrollment || null
}

export async function fetchAdminCourseCohorts(client) {
  const data = await invoke(client, 'manage-course-cohorts', { action: 'list' }, 'Les cohortes ne peuvent pas être chargées.')
  return Array.isArray(data?.cohorts) ? data.cohorts : []
}

export async function saveAdminCourseCohort(client, draft) {
  return invoke(client, 'manage-course-cohorts', { action: 'save_draft', draft }, "Le brouillon n'a pas pu être enregistré.")
}

export async function publishAdminCourseCohort(client, cohortId) {
  return invoke(client, 'manage-course-cohorts', { action: 'publish', cohort_id: cohortId }, "La cohorte n'a pas pu être publiée.")
}

export async function confirmAdminCourseCohort(client, cohortId) {
  return invoke(client, 'manage-course-cohorts', { action: 'confirm', cohort_id: cohortId }, "La cohorte n'a pas pu être confirmée.")
}

export async function cancelAdminCourseCohort(client, cohortId, reason) {
  return invoke(client, 'manage-course-cohorts', { action: 'cancel', cohort_id: cohortId, reason }, "La cohorte n'a pas pu être annulée.")
}

export async function setAdminCourseCohortMeetingUrl(client, cohortId, sessionId, meetingUrl) {
  return invoke(client, 'manage-course-cohorts', {
    action: 'set_meeting_url',
    cohort_id: cohortId,
    session_id: sessionId,
    meeting_url: meetingUrl,
  }, "Le lien de réunion n'a pas pu être enregistré.")
}

export async function generateAdminCourseCohortMeetingLinks(client, cohortId) {
  return invoke(client, 'manage-course-cohorts', {
    action: 'generate_meet_links',
    cohort_id: cohortId,
  }, 'Les liens Google Meet ne peuvent pas être générés pour le moment.')
}

export async function cleanupAdminCourseCohortMeetingEvents(client, cohortId) {
  return invoke(client, 'manage-course-cohorts', {
    action: 'cleanup_meet_events',
    cohort_id: cohortId,
  }, 'Le nettoyage des événements Google Meet ne peut pas être terminé pour le moment.')
}
