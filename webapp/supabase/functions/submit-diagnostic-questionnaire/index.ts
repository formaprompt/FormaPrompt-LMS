import { createClient } from 'npm:@supabase/supabase-js@2.105.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { validateDiagnosticQuestionnaire } from '../_shared/diagnosticQuestionnaire.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_env:${name}`)
  return value
}

function safeQuestionnaireErrorCode(error: unknown) {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : null
  return typeof code === 'string' && /^[A-Za-z0-9_:-]{2,80}$/.test(code)
    ? code
    : 'questionnaire_failed'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!accessToken) return jsonResponse({ error: 'Connexion requise.' }, 401)
    const body = await request.json().catch(() => ({}))
    const bookingId = typeof body.booking_id === 'string' ? body.booking_id : ''
    if (!UUID_PATTERN.test(bookingId)) return jsonResponse({ error: 'Réservation invalide.' }, 400)
    const validation = validateDiagnosticQuestionnaire(body.answers)
    if (validation.error) return jsonResponse({ error: validation.error }, 400)

    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const supabaseAuth = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken)
    const user = authData.user
    if (authError || !user?.id) return jsonResponse({ error: 'Session utilisateur invalide ou expirée.' }, 401)

    const supabaseAdmin = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('diagnostic_ia_bookings')
      .select('id, user_id, status')
      .eq('id', bookingId)
      .maybeSingle()
    if (bookingError) throw bookingError
    if (!booking || booking.user_id !== user.id) return jsonResponse({ error: 'Réservation introuvable.' }, 404)
    if (booking.status !== 'booked') return jsonResponse({ error: 'Le questionnaire est disponible après confirmation du rendez-vous.' }, 403)

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('diagnostic_ia_preparation_questionnaires')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) return jsonResponse({ error: 'Ce questionnaire a déjà été transmis.' }, 409)

    const { data: questionnaire, error: insertError } = await supabaseAdmin
      .from('diagnostic_ia_preparation_questionnaires')
      .insert({ booking_id: bookingId, user_id: user.id, ...validation.data })
      .select('id, submitted_at, questionnaire_version')
      .single()
    if (insertError?.code === '23505') return jsonResponse({ error: 'Ce questionnaire a déjà été transmis.' }, 409)
    if (insertError) throw insertError
    return jsonResponse({ questionnaire }, 201)
  } catch (error) {
    const code = safeQuestionnaireErrorCode(error)
    if (!code.startsWith('missing_env:')) console.error('submit-diagnostic-questionnaire:', code)
    return jsonResponse({ error: 'Le questionnaire ne peut pas être enregistré pour le moment.' }, 500)
  }
})
