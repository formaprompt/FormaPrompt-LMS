import { useMemo, useState } from 'react'
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
  const [checkoutError, setCheckoutError] = useState('')

  const checkoutContext = useMemo(() => ({
    sales_context: salesContext,
    access_start_choice: salesContext === SALES_CONTEXTS.PERSONAL ? accessStartChoice : null,
    beneficiary_email: salesContext === SALES_CONTEXTS.BENEFICIARY ? beneficiaryEmail.trim() : null,
    buyer_organization_name: salesContext === SALES_CONTEXTS.BENEFICIARY ? organizationName.trim() : null,
  }), [accessStartChoice, beneficiaryEmail, organizationName, salesContext])
  const route = getCommercialRoute(purchase, checkoutContext)

  if (!purchase) return <p role="alert">Cette offre n’est pas disponible.</p>
  if (accessLoading) return <p role="status">Vérification de votre accès…</p>
  if (hasActiveAccess) return activeAccessActions

  function changeSalesContext(nextContext) {
    setSalesContext(nextContext)
    setConsents(EMPTY_CONSENTS)
    setCheckoutError('')
  }

  function changeStartChoice(nextChoice) {
    setAccessStartChoice(nextChoice)
    setConsents(EMPTY_CONSENTS)
    setCheckoutError('')
  }

  function updateConsent(consentType, checked) {
    setConsents((current) => ({ ...current, [consentType]: checked }))
    setCheckoutError('')
  }

  async function startCheckout() {
    if (checkoutLoading) return
    const payload = { ...consents, cgv_version: route?.cgvVersion }
    const validationError = validateCommercialCheckoutRequest(purchase, checkoutContext, payload)
    if (validationError) {
      setCheckoutError(validationError)
      return
    }

    setCheckoutLoading(true)
    setCheckoutError('')
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { course_id: courseId, checkout_context: checkoutContext, consents: payload },
      })
      if (error) throw error
      if (data?.alreadyPurchased) {
        window.location.assign(`/course/${encodeURIComponent(courseId)}`)
        return
      }
      const checkoutUrl = new URL(data?.url)
      if (checkoutUrl.protocol !== 'https:') throw new Error('URL Stripe invalide.')
      window.location.assign(checkoutUrl.toString())
    } catch (error) {
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
                  onChange={() => changeStartChoice(ACCESS_START_CHOICES.IMMEDIATE)}
                />
                <span>Accéder à la formation dès le paiement</span>
              </label>
              <label className="commercial-checkout__choice">
                <input
                  type="radio"
                  name={`access-start-${courseId}`}
                  checked={accessStartChoice === ACCESS_START_CHOICES.DEFERRED}
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
                  onChange={(event) => setBeneficiaryEmail(event.target.value)}
                />
              </label>
              <p>L’accès sera attribué au bénéficiaire après vérification de son compte FormaPrompt.</p>
            </div>
          )}

          <label className="commercial-checkout__consent">
            <input
              type="checkbox"
              checked={consents.cgv_acceptance}
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
            {checkoutLoading ? 'Ouverture du paiement sécurisé…' : `Commander et payer – ${priceLabel}`}
          </button>
        </>
      )}
    </div>
  )
}
