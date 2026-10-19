import { createClient } from 'npm:@supabase/supabase-js@2.105.1'
import { corsHeaders } from '../_shared/cors.ts'
import { calendarActor, calendarErrorResponse, calendarResponse, calendarServiceClient } from '../_shared/calendarServer.ts'
import { CALENDAR_TIME_ZONE, loadCalendarBusy, parseAvailabilityRange, parisLocalDateTime, periodsOverlap } from '../_shared/calendarAvailability.js'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return calendarResponse({ error: 'Méthode non autorisée.' }, 405)
  try {
    const body = await request.json().catch(() => ({}))
    const purpose = body.purpose
    if (!['public_calendar', 'course_booking', 'admin_cohort'].includes(purpose)) {
      return calendarResponse({ error: 'Usage de disponibilité invalide.' }, 400)
    }
    if (purpose === 'course_booking' && body.horizon === true) {
      await calendarActor(request)
      const scoped = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: request.headers.get('Authorization')! } },
      })
      const now = new Date().toISOString()
      const windows: Array<{ from: string; to: string }> = []
      for (let page = 0; page < 100; page += 1) {
        const { data, error } = await scoped.from('training_availability_slots').select('id,starts_at,ends_at')
          .eq('is_active', true).eq('is_reserved', false).gt('starts_at', now)
          .order('starts_at').order('id').range(page * 1000, page * 1000 + 999)
        if (error || !Array.isArray(data)) throw new Error('google_calendar_database_unavailable')
        for (const slot of data) {
          if (!Number.isFinite(Date.parse(slot.starts_at)) || !Number.isFinite(Date.parse(slot.ends_at))
            || Date.parse(slot.ends_at) <= Date.parse(slot.starts_at)) throw new Error('google_calendar_database_unavailable')
          const last = windows.at(-1)
          if (last && Date.parse(slot.ends_at) - Date.parse(last.from) <= 93 * 86_400_000) {
            if (Date.parse(slot.ends_at) > Date.parse(last.to)) last.to = slot.ends_at
          } else windows.push({ from: slot.starts_at, to: slot.ends_at })
        }
        if (data.length < 1000) break
        if (page === 99) throw new Error('google_calendar_database_unavailable')
      }
      return calendarResponse({ booking_horizon: windows.length
        ? { from: windows[0].from, to: windows.at(-1)!.to, windows } : null })
    }
    const range = parseAvailabilityRange(body)
    const service = calendarServiceClient()
    const { data: dbBlocks, error: blocksError } = await service.from('calendar_bookings')
      .select('date,slot').gte('date', range.from.slice(0, 10)).lte('date', range.to.slice(0, 10))
    if (blocksError || !Array.isArray(dbBlocks)) throw new Error('google_calendar_database_unavailable')
    if (purpose === 'public_calendar') {
      const result = await loadCalendarBusy({
        intervals: [{ starts_at: range.from, ends_at: range.to }], mode: 'display',
      })
      const blocks = new Map<string, { booking_date: string; slot: string }>()
      const { data: learnerBlocks, error: learnerError } = await service.from('learner_calendar_blocks')
        .select('booking_date,slot').gte('booking_date', range.from.slice(0, 10)).lte('booking_date', range.to.slice(0, 10))
      if (learnerError || !Array.isArray(learnerBlocks)) throw new Error('google_calendar_database_unavailable')
      for (const block of learnerBlocks) {
        const date = block.booking_date ?? block.date
        if (typeof date !== 'string' || !['Matin', 'Après-midi'].includes(block.slot)) throw new Error('google_calendar_database_unavailable')
        blocks.set(`${date}:${block.slot}`, { booking_date: date, slot: block.slot })
      }
      for (const block of dbBlocks) {
        if (block.slot === 'Journée') {
          for (const slot of ['Matin', 'Après-midi']) blocks.set(`${block.date}:${slot}`, { booking_date: block.date, slot })
        } else blocks.set(`${block.date}:${block.slot}`, { booking_date: block.date, slot: block.slot })
      }
      // Iterate abstract calendar dates; each boundary is converted separately for DST.
      const last = new Date(Date.parse(range.to) + 86_400_000).toISOString().slice(0, 10)
      for (let date = new Date(Date.parse(range.from) - 86_400_000).toISOString().slice(0, 10); date <= last;) {
        const nextDate = new Date(Date.parse(date + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10)
        for (const slot of ['Matin', 'Après-midi']) {
          const starts_at = parisLocalDateTime(date, slot === 'Matin' ? 0 : 13)
          const ends_at = slot === 'Matin' ? parisLocalDateTime(date, 13) : parisLocalDateTime(nextDate)
          const interval = { starts_at, ends_at }
          if (periodsOverlap(interval, { starts_at: range.from, ends_at: range.to })
            && result.busy.some((busy: { start: string; end: string }) => periodsOverlap(interval, busy))) {
            blocks.set(`${date}:${slot}`, { booking_date: date, slot })
          }
        }
        date = nextDate
      }
      return calendarResponse({ status: 'available', time_zone: CALENDAR_TIME_ZONE, checked_at: result.checked_at, range, blocks: [...blocks.values()] })
    }
    await calendarActor(request)
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: request.headers.get('Authorization')! } },
    })
    if (purpose === 'admin_cohort') {
      const { error } = await userClient.rpc('admin_list_course_cohorts')
      if (error) throw error
    }
    // User-scoped read retains existing entitlements and RLS filters.
    const slots: Array<{ id: string; starts_at: string; ends_at: string; delivery_modes: string[] }> = []
    for (let page = 0; page < 20; page += 1) {
      const { data, error } = await userClient.from('training_availability_slots')
        .select('id,starts_at,ends_at,delivery_modes')
        .eq('is_active', true).eq('is_reserved', false)
        .gte('starts_at', range.from).lt('starts_at', range.to).lte('ends_at', range.to)
        .gt('starts_at', new Date().toISOString()).order('starts_at').order('id')
        .range(page * 500, page * 500 + 499)
      if (error || !Array.isArray(data)) throw new Error('google_calendar_database_unavailable')
      slots.push(...data)
      if (data.length < 500) break
      if (page === 19) throw new Error('google_calendar_database_unavailable')
    }
    if (!slots.length) {
      // Verify Google even for an empty month, so outage never appears as a valid response.
      const result = await loadCalendarBusy({ intervals: [{ starts_at: range.from, ends_at: range.to }], mode: 'display' })
      return calendarResponse({ status: 'available', time_zone: CALENDAR_TIME_ZONE, checked_at: result.checked_at, range, slots: [] })
    }
    const result = await loadCalendarBusy({ intervals: slots, mode: 'display' })
    return calendarResponse({
      status: 'available', time_zone: CALENDAR_TIME_ZONE, checked_at: result.checked_at, range,
      slots: slots.filter((slot) => !result.busy.some((busy: { start: string; end: string }) => periodsOverlap(slot, busy))),
    })
  } catch (error) { return calendarErrorResponse(error) }
})
