import { queryGoogleCalendarFreeBusy, refreshGoogleCalendarAccessToken } from './googleCalendar.js'
import { queryProfessionalBusyWithoutOwnEvents } from './calendarProfessionalEvents.js'

export const CALENDAR_TIME_ZONE = 'Europe/Paris'
export const AVAILABILITY_CACHE_MS = 30_000
export const MAX_AVAILABILITY_DAYS = 93
// Explicit primary identities: "primary" would resolve only to the OAuth account.
export const REQUIRED_BUSY_CALENDAR_IDS = Object.freeze([
  'formaprompt@gmail.com',
  'thierry227@gmail.com',
])
// Existing destination verified by the coordinator; other secondary calendars are excluded.
export const EXISTING_BOOKING_CALENDAR_ID = '3802495b2d992809bc164fd81537eb8f9b71aec9410226335bd20ff37fc8c558@group.calendar.google.com'
const cache = new Map()
const DAY_MS = 86_400_000
const RFC3339 = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

export function isCalendarInstant(value) {
  if (typeof value !== 'string' || !RFC3339.test(value) || !Number.isFinite(Date.parse(value))) return false
  const date = new Date(value.slice(0, 10) + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10)
}

export function requiredCalendarEnv(name, env = (key) => globalThis.Deno?.env.get(key)) {
  const value = env(name)?.trim()
  if (!value) throw new Error('google_calendar_configuration_unavailable')
  return value
}

export function unifiedCalendarIds(destinationId = EXISTING_BOOKING_CALENDAR_ID) {
  if (destinationId !== EXISTING_BOOKING_CALENDAR_ID) throw new Error('google_calendar_configuration_unavailable')
  return [...REQUIRED_BUSY_CALENDAR_IDS, destinationId]
}

export function calendarIntervals(intervals) {
  if (!Array.isArray(intervals) || !intervals.length || intervals.length > 10_000) {
    throw new Error('google_calendar_intervals_invalid')
  }
  return intervals.map((interval) => {
    const startValue = interval.starts_at ?? interval.start
    const endValue = interval.ends_at ?? interval.end
    if (!isCalendarInstant(startValue) || !isCalendarInstant(endValue)) throw new Error('google_calendar_intervals_invalid')
    const start = Date.parse(startValue)
    const end = Date.parse(endValue)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end - start > MAX_AVAILABILITY_DAYS * DAY_MS) {
      throw new Error('google_calendar_intervals_invalid')
    }
    return { starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() }
  }).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
}

export function periodsOverlap(first, second) {
  return Date.parse(first.starts_at ?? first.start) < Date.parse(second.ends_at ?? second.end)
    && Date.parse(first.ends_at ?? first.end) > Date.parse(second.starts_at ?? second.start)
}

export async function loadCalendarBusy({
  intervals,
  mode = 'confirm',
  destinationId = EXISTING_BOOKING_CALENDAR_ID,
  accessToken = null,
  ownEvents = [],
  fetchImpl = fetch,
  env = (key) => globalThis.Deno?.env.get(key),
  now = Date.now(),
}) {
  const normalized = calendarIntervals(intervals)
  const configuredPrimaryIds = [env('GOOGLE_PROFESSIONAL_CALENDAR_ID')?.trim(), env('GOOGLE_PERSONAL_CALENDAR_ID')?.trim()]
  if (configuredPrimaryIds.some((id, index) => id && id !== REQUIRED_BUSY_CALENDAR_IDS[index])) {
    throw new Error('google_calendar_configuration_unavailable')
  }
  const calendarIds = unifiedCalendarIds(destinationId)
  const timeMin = normalized[0].starts_at
  const timeMax = normalized.reduce((end, item) => Date.parse(item.ends_at) > Date.parse(end) ? item.ends_at : end, normalized[0].ends_at)
  const key = JSON.stringify([calendarIds, normalized, ownEvents])
  const cached = mode === 'display' ? cache.get(key) : null
  if (cached && now - cached.at < AVAILABILITY_CACHE_MS) return cached.value
  const token = accessToken || await refreshGoogleCalendarAccessToken({
    clientId: requiredCalendarEnv('GOOGLE_CALENDAR_CLIENT_ID', env),
    clientSecret: requiredCalendarEnv('GOOGLE_CALENDAR_CLIENT_SECRET', env),
    refreshToken: requiredCalendarEnv('GOOGLE_CALENDAR_REFRESH_TOKEN', env),
    fetchImpl,
  })
  // Query each merged contiguous interval, rather than exposing unrelated days between sessions.
  const merged = []
  for (const item of normalized) {
    const last = merged.at(-1)
    if (last && Date.parse(item.starts_at) <= Date.parse(last.ends_at)) {
      if (Date.parse(item.ends_at) > Date.parse(last.ends_at)) last.ends_at = item.ends_at
    } else merged.push({ ...item })
  }
  if (mode === 'display') merged.splice(0, merged.length, { starts_at: timeMin, ends_at: timeMax })
  const busy = []
  for (let offset = 0; offset < merged.length; offset += 4) {
    const results = await Promise.all(merged.slice(offset, offset + 4).map(async (item) => {
      const primaryBusy = await queryGoogleCalendarFreeBusy({
        accessToken: token, calendarIds: ownEvents.length ? [...REQUIRED_BUSY_CALENDAR_IDS] : calendarIds,
        timeMin: item.starts_at, timeMax: item.ends_at, fetchImpl,
      })
      const destinationBusy = ownEvents.length ? await queryProfessionalBusyWithoutOwnEvents({
        accessToken: token, calendarId: destinationId, timeMin: item.starts_at, timeMax: item.ends_at, ownEvents, fetchImpl,
      }) : []
      return [...primaryBusy, ...destinationBusy]
    }))
    busy.push(...results.flat())
  }
  const value = { busy, checked_at: new Date(now).toISOString() }
  if (mode === 'display') {
    for (const [oldKey, entry] of cache) if (now - entry.at >= AVAILABILITY_CACHE_MS) cache.delete(oldKey)
    if (cache.size >= 100) cache.delete(cache.keys().next().value)
    cache.set(key, { at: now, value })
  }
  return value
}

export async function assertCalendarAvailable(options) {
  const result = await loadCalendarBusy({ ...options, mode: 'confirm' })
  if (calendarIntervals(options.intervals).some((interval) => result.busy.some((busy) => periodsOverlap(interval, busy)))) {
    throw Object.assign(new Error('calendar_conflict'), { code: '23P01' })
  }
  return result
}

export async function queryUnifiedCalendarBusy(options) {
  const { accessToken, timeMin, timeMax, ownEvents = [], fetchImpl = fetch, mode = 'confirm' } = options
  const result = await loadCalendarBusy({
    intervals: [{ starts_at: timeMin, ends_at: timeMax }], accessToken, ownEvents, fetchImpl, mode,
  })
  return result.busy
}

// FreeBusy merges same-calendar events. An own event cannot safely be subtracted.
// Ambiguous reschedules/cohort retries remain unavailable until a disjoint period is selected.
export function conservativeBusyPeriods(busyPeriods) {
  return busyPeriods
}

export function calendarUnavailablePayload() {
  return { error: 'Les disponibilités sont temporairement indisponibles.', code: 'CALENDAR_UNAVAILABLE' }
}

export function parisLocalDateTime(date, hour = 0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid_availability_range')
  if (!isCalendarInstant(date + 'T00:00:00Z') || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error('invalid_availability_range')
  }
  const [year, month, day] = date.split('-').map(Number)
  const target = Date.UTC(year, month - 1, day, hour)
  let instant = target
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: CALENDAR_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(instant)).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, Number(value)]))
    instant += target - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  }
  return new Date(instant).toISOString()
}

export function parseAvailabilityRange(body) {
  let from = body.from
  let to = body.to
  if (body.month !== undefined) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(body.month)
    if (!match) throw new Error('invalid_availability_range')
    const year = Number(match[1])
    const month = Number(match[2])
    from = parisLocalDateTime(`${match[1]}-${match[2]}-01`)
    to = parisLocalDateTime(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`)
  }
  if (!isCalendarInstant(from) || !isCalendarInstant(to)) throw new Error('invalid_availability_range')
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end
    || end - start > MAX_AVAILABILITY_DAYS * DAY_MS) {
    throw new Error('invalid_availability_range')
  }
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() }
}
