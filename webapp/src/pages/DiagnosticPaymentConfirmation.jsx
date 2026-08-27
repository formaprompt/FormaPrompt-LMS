import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, TriangleAlert } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import SEO from '../components/SEO'
import { useAuth } from '../contexts/useAuth'
import { supabase } from '../lib/supabaseClient'
import { fetchDiagnosticOrder } from '../lib/diagnosticCheckout'
import './DiagnosticPaymentConfirmation.css'

const PAID_STATUSES = new Set(['paid', 'disputed'])
const FAILED_STATUSES = new Set(['cancelled', 'refunded', 'chargeback'])

export default function DiagnosticPaymentConfirmation() {
  const { user, loading } = useAuth()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const orderId = searchParams.get('order_id')
  const validSessionId = /^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId || '') ? sessionId : null
  const validOrderId = /^[0-9a-f-]{36}$/i.test(orderId || '') ? orderId : null
  const reference = useMemo(() => ({ orderId: validOrderId, sessionId: validSessionId }), [validOrderId, validSessionId])
  const [serverStatus, setServerStatus] = useState('checking')
  const status = loading
    ? 'checking'
    : !user
    ? 'login-required'
    : (!reference.orderId && !reference.sessionId ? 'missing' : serverStatus)

  useEffect(() => {
    if (loading || !user || (!reference.orderId && !reference.sessionId)) return undefined

    let stopped = false
    let timer
    let attempts = 0

    async function checkOrder() {
      attempts += 1
      const { data, error } = await fetchDiagnosticOrder(supabase, reference)
      if (stopped) return
      if (error) {
        setServerStatus('error')
        return
      }
      if (data && PAID_STATUSES.has(data.status)) {
        setServerStatus('paid')
        return
      }
      if (data && FAILED_STATUSES.has(data.status)) {
        setServerStatus('failed')
        return
      }
      if (attempts >= 10) {
        setServerStatus('pending')
        return
      }
      timer = window.setTimeout(checkOrder, 1500)
    }

    checkOrder()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [loading, reference, user])

  const redirectPath = `/diagnostic-ia/confirmation?${searchParams.toString()}`
  const messages = {
    checking: {
      icon: Clock3,
      title: 'Confirmation du paiement en cours',
      text: 'Nous confirmons votre paiement. Cette opération peut prendre quelques secondes.',
    },
    pending: {
      icon: Clock3,
      title: 'Confirmation toujours en cours',
      text: 'La confirmation serveur prend plus de temps que prévu. Ne renouvelez pas le paiement.',
    },
    paid: {
      icon: CheckCircle2,
      title: 'Paiement confirmé',
      text: 'Paiement confirmé. La réservation de votre créneau sera disponible à l’étape suivante.',
    },
    failed: {
      icon: TriangleAlert,
      title: 'Paiement non confirmé',
      text: 'Cette commande ne dispose pas d’un paiement actif confirmé. Aucun succès n’a été enregistré.',
    },
    error: {
      icon: TriangleAlert,
      title: 'Vérification temporairement indisponible',
      text: 'Nous ne pouvons pas vérifier la commande pour le moment. Ne renouvelez pas le paiement et contactez FormaPrompt si nécessaire.',
    },
    missing: {
      icon: TriangleAlert,
      title: 'Référence de paiement absente',
      text: 'Aucun paiement ne peut être confirmé depuis cette adresse.',
    },
    'login-required': {
      icon: TriangleAlert,
      title: 'Connexion requise',
      text: 'Connectez-vous avec le compte utilisé avant le paiement pour consulter son statut.',
    },
  }
  const message = messages[status]
  const Icon = message.icon

  return (
    <>
      <SEO
        title="Confirmation du Diagnostic IA – FormaPrompt"
        description="Vérification sécurisée du paiement du Diagnostic IA Express."
        url="https://formaprompt.com/diagnostic-ia/confirmation"
        robots="noindex, nofollow"
      />
      <div className="diagnostic-confirmation-page">
        <section className="diagnostic-confirmation-card" aria-live="polite">
          <Icon aria-hidden="true" />
          <h1>{message.title}</h1>
          <p>{message.text}</p>

          {status === 'login-required' ? (
            <Link className="btn btn-primary" to={`/login?redirect=${encodeURIComponent(redirectPath)}`}>Se connecter</Link>
          ) : (
            <Link className="btn btn-primary" to="/diagnostic-ia">Revenir au Diagnostic IA Express</Link>
          )}
          <button className="btn diagnostic-confirmation-disabled" type="button" disabled>
            Choisir mon créneau
          </button>
        </section>
      </div>
    </>
  )
}
