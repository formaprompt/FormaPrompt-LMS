import { buildDiagnosticPromoEvidence } from '../../supabase/functions/_shared/diagnosticContractEvidence.js'

const GENERIC_CHECKOUT_ERROR = 'Le paiement ne peut pas être ouvert pour le moment.'

async function functionErrorMessage(error) {
  if (error?.context && typeof error.context.json === 'function') {
    const payload = await error.context.json().catch(() => null)
    return payload?.error || GENERIC_CHECKOUT_ERROR
  }
  return GENERIC_CHECKOUT_ERROR
}

export async function createDiagnosticCheckout(supabase, body) {
  const { data, error } = await supabase.functions.invoke('create-diagnostic-checkout', { body })
  if (error) throw new Error(await functionErrorMessage(error))

  if (data?.url) {
    const checkoutUrl = new URL(data.url)
    if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
      throw new Error('L’adresse du paiement sécurisé est invalide.')
    }
    return { ...data, url: checkoutUrl.toString() }
  }
  if (data?.alreadyPaid || data?.confirmationPending) return data
  throw new Error(GENERIC_CHECKOUT_ERROR)
}

export async function validateDiagnosticPromotion(supabase, promoCode) {
  const { data, error } = await supabase.functions.invoke('validate-diagnostic-promotion', {
    body: { promo_code: promoCode },
  })
  if (error) throw new Error('La vérification du code est temporairement indisponible.')
  if (
    typeof data?.valid !== 'boolean'
    || data.catalog_amount_cents !== 14_900
    || !Number.isInteger(data.discount_amount_cents)
    || !Number.isInteger(data.final_amount_cents)
    || data.discount_amount_cents < 0
    || data.final_amount_cents <= 0
    || (data.valid && (typeof data.code !== 'string' || !/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(data.code)))
    || (!data.valid && (data.discount_amount_cents !== 0 || data.final_amount_cents !== 14_900))
    || data.discount_amount_cents + data.final_amount_cents !== 14_900
  ) {
    throw new Error('La réponse de vérification du code est invalide.')
  }
  if (data.valid) {
    const expected = buildDiagnosticPromoEvidence({ ...data, original_amount_cents: data.catalog_amount_cents })
    if (data.acceptance_statement?.version !== expected.version || data.acceptance_statement?.text !== expected.text) {
      throw new Error('La preuve de vérification du code est invalide.')
    }
  }
  return {
    ...data,
    message: data.valid ? 'Code promotionnel appliqué.' : "Ce code n'est pas valide ou n'est plus disponible.",
  }
}

export async function fetchDiagnosticOrder(supabase, { orderId, sessionId }) {
  let query = supabase
    .from('diagnostic_ia_orders')
    .select('id, status, amount_total, currency, paid_at, stripe_checkout_session_id')

  if (orderId) query = query.eq('id', orderId)
  else if (sessionId) query = query.eq('stripe_checkout_session_id', sessionId)
  else return { data: null, error: new Error('Référence de commande absente.') }

  return query.maybeSingle()
}
