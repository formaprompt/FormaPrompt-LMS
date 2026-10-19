import { createClient } from 'npm:@supabase/supabase-js@2.105.1'
import { corsHeaders } from './cors.ts'
import { calendarUnavailablePayload } from './calendarAvailability.js'

export function calendarResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
  } })
}

export function calendarServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')?.trim()
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (!url || !key) throw new Error('google_calendar_configuration_unavailable')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function calendarActor(request: Request, required = true) {
  const authorization = request.headers.get('Authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) {
    if (required) throw Object.assign(new Error('Connexion requise.'), { code: '401' })
    return null
  }
  // A legacy public anon JWT is a transport credential, not an authenticated user.
  const anon = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  if (!required && token === anon) return null
  const service = calendarServiceClient()
  const { data, error } = await service.auth.getUser(token)
  if (error || !data.user?.id) throw Object.assign(new Error('Session invalide ou expirée.'), { code: '401' })
  return data.user.id
}

export function calendarErrorResponse(error: unknown) {
  const record = error && typeof error === 'object' ? error as { code?: string; message?: string } : {}
  if (record.code === '401') return calendarResponse({ error: 'Connexion requise.' }, 401)
  if (record.code === '42501') return calendarResponse({ error: 'Accès non autorisé.' }, 403)
  if (['23P01', '23505', '40001', 'P0001'].includes(record.code || '')) {
    return calendarResponse({ error: 'Ce créneau vient de devenir indisponible.', code: 'CALENDAR_CONFLICT' }, 409)
  }
  if (record.message === 'invalid_availability_range' || record.code === '22023') {
    return calendarResponse({ error: 'La demande de disponibilité est invalide.' }, 400)
  }
  return calendarResponse(calendarUnavailablePayload(), 503)
}
