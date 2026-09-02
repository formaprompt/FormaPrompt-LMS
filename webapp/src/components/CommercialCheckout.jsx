import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ACCESS_START_CHOICES,
  CONSENT_TYPES,
  getCommercialRoute,
  getPurchaseConfig,
  SALES_CONTEXTS,
  validateCommercialCheckoutRequest,
} from '../../supabase/functions/_shared/purchaseConfig.js'
import { supabase } from '../lib/supabaseClient'
import './CommercialCheckout.css'

const EMPTY_CONSENTS = Object.freeze({
  [CONSENT_TYPES.CGV_ACCEPTANCE]: false,
  [CONSENT_TYPES.EARLY_SERVICE_START]: false,
  [CONSENT_TYPES.DIGITAL_CONTENT_START]: false,
  [CONSENT_TYPES.DIGITAL_CONTENT_WITHDRAWAL_ACKNOWLEDGEMENT]: false,
})

const SALES_CONTEXT_OPTIONS = Object.freeze([
  [SALES_CONTEXTS.PERSONAL, 'Pour vous-même en tant que particulier'],
  [SALES_CONTEXTS.PROFESSIONAL_SELF, 'Pour vous-même dans un cadre professionnel'],
  [SALES_CONTEXTS.BENEFICIARY, 'Pour un salarié ou un autre bénéficiaire'],
  [SALES_CONTEXTS.OF_OPCO, 'Avec une demande de financement OPCO'],
])

function formatEuros(amountCents) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amountCents / 100)
}
function newCheckoutRequestId() {
  return globalThis.crypto.randomUUID()
}

async function readFunctionErrorPayload(error) {
  const response = error?.context
  if (!response || typeof response.json !== 'function') return null
  try {
    return await (typeof response.clone === 'function' ? response.clone() : response).json()
  } catch {
    return null
  }
}

export default function CommercialCheckout({
  courseId,
  user,
  accessLoading,
  hasActiveAccess,
  activeAccessActions,
  priceLabel,
  purchaseConfig,
}) {
  const purchase = purchaseConfig || getPurchaseConfig(courseId)
  const [salesContext, setSalesContext] = useState(SALES_CONTEXTS.PERSONAL)
  const [accessStartChoice, setAccessStartChoice] = useState(ACCESS_START_CHOICES.IMMEDIATE)
  const [beneficiaryEmail, setBeneficiaryEmail] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [consents, setConsents] = useState(EMPTY_CONSENTS)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutConfigurationLocked, setCheckoutConfigurationLocked] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoStatus, setPromoStatus] = useState('empty')
  const [promoMessage, setPromoMessage] = useState('')
  const [promoAmounts, setPromoAmounts] = useState(null)
  const checkoutRequestId = useRef(newCheckoutRequestId())

  const checkoutContext = useMemo(() => ({
    sales_context: salesContext,
    access_start_choice: salesContext === SALES_CONTEXTS.PERSONAL ? accessStartChoice : null,
    beneficiary_email: salesContext === SALES_CONTEXTS.BENEFICIARY ? beneficiaryEmail.trim() : null,
    buyer_organization_name: salesContext === SALES_CONTEXTS.BENEFICIARY ? organizationName.trim() : null,
  }), [accessStartChoice, beneficiaryEmail, organizationName, salesContext])
  const route = getCommercialRoute(purchase, checkoutContext)
  const displayedAmount = promoStatus === 'valid' ? promoAmounts?.final_amount_cents : purchase?.amountTotal

  if (!purchase) return <p role="alert">Cette offre n’est pas disponible.</p>
  if (accessLoading) return <p role="status">Vérification de votre accès…</p>
  if (hasActiveAccess) return activeAccessActions

  function changeSalesContext(nextContext) {
    if (checkoutConfigurationLocked) return
    setSalesContext(nextContext)
    setConsents(EMPTY_CONSENTS)
    setCheckoutError('')
    checkoutRequestId.current = newCheckoutRequestId()
  }

  function changeStartChoice(nextChoice) {
    if (checkoutConfigurationLocked) return
    setAccessStartChoice(nextChoice)
    setConsents(EMPTY_CONSENTS)
    setCheckoutError('')
    checkoutRequestId.current = newCheckoutRequestId()
  }

  function updateConsent(consentType, checked) {
    if (checkoutConfigurationLocked) return
    setConsents((current) => ({ ...current, [consentType]: checked }))
    setCheckoutError('')
  }


  function changePromoCode(value) {
    if (checkoutConfigurationLocked) return
    setPromoCode(value)
    setPromoStatus(value.trim() ? 'unverified' : 'empty')
    setPromoMessage('')
    setPromoAmounts(null)
    setCheckoutError('')
    checkoutRequestId.current = newCheckoutRequestId()
  }

  async function validatePromotion() {
    if (!promoCode.trim() || promoStatus === 'checking') return
    setPromoStatus('checking')
    setPromoMessage('')
    try {
      const { data, error } = await supabase.functions.invoke('validate-course-promotion', {
        body: { course_id: courseId, promo_code: promoCode },
      })
      if (error) throw error
      if (!data?.valid) {
        setPromoStatus('invalid')
        setPromoAmounts(null)
        setPromoMessage(data?.message || "Ce code n'est pas valide ou n'est plus disponible.")
        return
      }
      setPromoCode(data.code)
      setPromoStatus('valid')
      setPromoAmounts(data)
      setPromoMessage(data.message || 'Code promotionnel appliqué.')
    } catch (error) {
      console.error('Vérification du code promotionnel impossible :', error)
      setPromoStatus('error')
      setPromoAmounts(null)
      setPromoMessage('La vérification du code est temporairement indisponible.')
    }
  }

  async function startCheckout() {
    if (checkoutLoading) return
    if (promoCode.trim() && promoStatus !== 'valid') {
      setCheckoutError('Vérifiez le code promotionnel ou effacez-le avant de continuer.')
      return
    }
    const payload = { ...consents, cgv_version: route?.cgvVersion }
    const validationError = validateCommercialCheckoutRequest(purchase, checkoutContext, payload)
    if (validationError) {
      setCheckoutError(validationError)
      return
    }

    setCheckoutLoading(true)
    setCheckoutConfigurationLocked(true)
    setCheckoutError('')
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          course_id: courseId,
          checkout_context: checkoutContext,
          consents: payload,
          checkout_request_id: checkoutRequestId.current,
          promo_code: promoStatus === 'valid' ? promoCode : null,
        },
      })
      if (error) throw error
      if (data?.promotion_invalid) {
        checkoutRequestId.current = newCheckoutRequestId()
        setCheckoutConfigurationLocked(false)
        setPromoStatus('invalid')
        setPromoAmounts(null)
        setPromoMessage(data.message || "Ce code n'est pas valide ou n'est plus disponible.")
        return
      }
      if (data?.checkout_context_reset) {
        checkoutRequestId.current = newCheckoutRequestId()
        setCheckoutConfigurationLocked(false)
        setCheckoutError(data.error || 'Cette tentative est terminée. Vous pouvez en démarrer une nouvelle.')
        return
      }
      if (data?.alreadyPurchased) {
        window.location.assign(`/course/${encodeURIComponent(courseId)}`)
        return
      }
      if (data?.confirmationPending) {
        window.location.assign(`/paiement-reussi?course=${encodeURIComponent(courseId)}`)
        return
      }
      const checkoutUrl = new URL(data?.url)
      if (checkoutUrl.protocol !== 'https:') throw new Error('URL Stripe invalide.')
      window.location.assign(checkoutUrl.toString())
    } catch (error) {
      const errorPayload = await readFunctionErrorPayload(error)
      if (errorPayload?.checkout_context_reset) {
        checkoutRequestId.current = newCheckoutRequestId()
        setCheckoutConfigurationLocked(false)
        setCheckoutError(errorPayload.error || 'Cette tentative est terminée. Vous pouvez en démarrer une nouvelle.')
        return
      }
      console.error('Ouverture de Stripe Checkout impossible :', error)
      setCheckoutError('Le paiement ne peut pas être ouvert pour le moment. Contactez FormaPrompt si le problème persiste.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const cgvPath = route?.cgvDocumentType === 'cgv_b2b' ? '/cgv-professionnels' : '/cgv-particuliers'

  return (
    <div className="commercial-checkout">
      <fieldset className="commercial-checkout__group">
        <legend>Vous achetez cette formation :</legend>
        {SALES_CONTEXT_OPTIONS.map(([value, label]) => (
          <label className="commercial-checkout__choice" key={value}>
            <input
              type="radio"
              name={`sales-context-${courseId}`}
              value={value}
              checked={salesContext === value}
              disabled={checkoutConfigurationLocked}
              onChange={() => changeSalesContext(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      {salesContext === SALES_CONTEXTS.OF_OPCO ? (
        <div className="commercial-checkout__administrative" role="status">
          <p>Le financement OPCO suit le parcours devis et convention de formation.</p>
          <Link to="/contact" className="btn btn-primary">Demander un devis ou un financement</Link>
        </div>
      ) : !user ? (
        <Link to="/login" className="btn btn-primary">Se connecter pour acheter – {priceLabel}</Link>
      ) : (
        <>
          {salesContext === SALES_CONTEXTS.PERSONAL && (
            <fieldset className="commercial-checkout__group">
              <legend>Quand souhaitez-vous commencer ?</legend>
              <label className="commercial-checkout__choice">
                <input
                  type="radio"
                  name={`access-start-${courseId}`}
                  checked={accessStartChoice === ACCESS_START_CHOICES.IMMEDIATE}
                  disabled={checkoutConfigurationLocked}
                  onChange={() => changeStartChoice(ACCESS_START_CHOICES.IMMEDIATE)}
                />
                <span>Accéder à la formation dès le paiement</span>
              </label>
              <label className="commercial-checkout__choice">
                <input
                  type="radio"
                  name={`access-start-${courseId}`}
                  checked={accessStartChoice === ACCESS_START_CHOICES.DEFERRED}
                  disabled={checkoutConfigurationLocked}
                  onChange={() => changeStartChoice(ACCESS_START_CHOICES.DEFERRED)}
                />
                <span>Payer maintenant et différer l’accès pédagogique</span>
              </label>
            </fieldset>
          )}

          {salesContext === SALES_CONTEXTS.BENEFICIARY && (
            <div className="commercial-checkout__beneficiary">
              <label>
                Organisation acheteuse
                <input
                  type="text"
                  value={organizationName}
                  maxLength={200}
                  autoComplete="organization"
                  disabled={checkoutConfigurationLocked}
                  onChange={(event) => setOrganizationName(event.target.value)}
                />
              </label>
              <label>
                Adresse e-mail du bénéficiaire
                <input
                  type="email"
                  value={beneficiaryEmail}
                  maxLength={254}
                  autoComplete="email"
                  disabled={checkoutConfigurationLocked}
                  onChange={(event) => setBeneficiaryEmail(event.target.value)}
                />
              </label>
              <p>L’accès sera attribué au bénéficiaire après vérification de son compte FormaPrompt.</p>
            </div>
          )}


          <div className="commercial-checkout__promotion">
            <label htmlFor={`promotion-code-${courseId}`}>Code promotionnel</label>
            <div className="commercial-checkout__promotion-row">
              <input
                id={`promotion-code-${courseId}`}
                type="text"
                value={promoCode}
                maxLength={64}
                autoComplete="off"
                onChange={(event) => changePromoCode(event.target.value)}
                disabled={checkoutConfigurationLocked || checkoutLoading || promoStatus === 'checking'}
              />
              <button
                type="button"
                className="btn commercial-checkout__promotion-button"
                onClick={validatePromotion}
                disabled={checkoutConfigurationLocked || !promoCode.trim() || checkoutLoading || promoStatus === 'checking'}
              >
                {promoStatus === 'checking' ? 'Vérification…' : 'Vérifier'}
              </button>
            </div>
            {promoMessage && (
              <p
                className={promoStatus === 'valid' ? 'commercial-checkout__promotion-success' : 'commercial-checkout__promotion-message'}
                role={promoStatus === 'valid' ? 'status' : 'alert'}
              >
                {promoMessage}
              </p>
            )}
            <dl className="commercial-checkout__amounts">
              <div><dt>Prix</dt><dd>{formatEuros(purchase.amountTotal)}</dd></div>
              {promoStatus === 'valid' && (
                <div><dt>Remise</dt><dd>− {formatEuros(promoAmounts.discount_amount_cents)}</dd></div>
              )}
              <div><dt>Total</dt><dd>{formatEuros(displayedAmount)}</dd></div>
            </dl>
          </div>

          <label className="commercial-checkout__consent">
            <input
              type="checkbox"
              checked={consents.cgv_acceptance}
              disabled={checkoutConfigurationLocked}
              onChange={(event) => updateConsent(CONSENT_TYPES.CGV_ACCEPTANCE, event.target.checked)}
            />
            <span>
              J’ai lu et j’accepte les{' '}
              <Link to={`${cgvPath}?version=${encodeURIComponent(route.cgvVersion)}`}>
                Conditions générales de vente applicables à cette commande
              </Link>.
            </span>
          </label>

          {route.requiredConsentTypes.includes(CONSENT_TYPES.EARLY_SERVICE_START) && (
            <label className="commercial-checkout__consent">
              <input
                type="checkbox"
              checked={consents.early_service_start}
              disabled={checkoutConfigurationLocked}
                onChange={(event) => updateConsent(CONSENT_TYPES.EARLY_SERVICE_START, event.target.checked)}
              />
              <span>Je demande expressément que la prestation de service commence avant la fin du délai de rétractation applicable.</span>
            </label>
          )}

          {route.requiredConsentTypes.includes(CONSENT_TYPES.DIGITAL_CONTENT_START) && (
            <label className="commercial-checkout__consent">
              <input
                type="checkbox"
              checked={consents.digital_content_start}
              disabled={checkoutConfigurationLocked}
                onChange={(event) => updateConsent(CONSENT_TYPES.DIGITAL_CONTENT_START, event.target.checked)}
              />
              <span>Je demande l’accès immédiat à la composante numérique précisément désignée dans l’offre.</span>
            </label>
          )}

          {route.requiredConsentTypes.includes(CONSENT_TYPES.DIGITAL_CONTENT_WITHDRAWAL_ACKNOWLEDGEMENT) && (
            <label className="commercial-checkout__consent">
              <input
                type="checkbox"
              checked={consents.digital_content_withdrawal_acknowledgement}
              disabled={checkoutConfigurationLocked}
                onChange={(event) => updateConsent(
                  CONSENT_TYPES.DIGITAL_CONTENT_WITHDRAWAL_ACKNOWLEDGEMENT,
                  event.target.checked,
                )}
              />
              <span>Je reconnais que ce commencement peut entraîner la perte du droit de rétractation pour cette seule composante numérique, dans les conditions légales indiquées.</span>
            </label>
          )}

          <p className="commercial-checkout__information">
            Avant de payer, consultez aussi le <Link to="/reglement-interieur">règlement intérieur</Link>, les{' '}
            <Link to="/informations-precontractuelles">informations précontractuelles</Link> et les{' '}
            <Link to="/retractation">modalités de rétractation</Link>.
          </p>
          {checkoutError && <p className="commercial-checkout__error" role="alert">{checkoutError}</p>}
          <button type="button" className="btn btn-primary" onClick={startCheckout} disabled={checkoutLoading}>
            {checkoutLoading ? 'Ouverture du paiement sécurisé…' : `Commander et payer – ${formatEuros(displayedAmount)}`}
          </button>
        </>
      )}
    </div>
  )
}
