import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, RefreshCw, TriangleAlert } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import SEO from '../components/SEO'
import { useAuth } from '../contexts/useAuth'
import { fetchDiagnosticAvailability, formatDiagnosticCandidate } from '../lib/diagnosticBooking'
import { supabase } from '../lib/supabaseClient'
import './DiagnosticBooking.css'

const EARLY_START_STATEMENT = 'Je demande expressément que l’exécution de mon Diagnostic IA Express commence avant la fin de mon délai légal de rétractation.'
const FULL_PERFORMANCE_STATEMENT = 'Je reconnais qu’après l’exécution complète de la prestation, je ne pourrai plus exercer mon droit de rétractation pour cette prestation.'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function groupCandidates(candidates) {
  return candidates.reduce((groups, candidate) => {
    const formatted = formatDiagnosticCandidate(candidate)
    const existing = groups.find((group) => group.dateKey === formatted.dateKey)
    const item = { ...candidate, ...formatted }
    if (existing) existing.candidates.push(item)
    else groups.push({ dateKey: formatted.dateKey, dateLabel: formatted.dateLabel, candidates: [item] })
    return groups
  }, [])
}
export default function DiagnosticBooking() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('order_id')
  const validOrderId = UUID_PATTERN.test(orderId || '') ? orderId : null
  const [status, setStatus] = useState(validOrderId ? 'loading' : 'error')
  const [candidates, setCandidates] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [feedback, setFeedback] = useState(validOrderId ? '' : 'La référence de commande est absente ou invalide.')
  const [earlyStartRequested, setEarlyStartRequested] = useState(false)
  const [fullPerformanceAcknowledged, setFullPerformanceAcknowledged] = useState(false)

  const loadAvailability = useCallback(async () => {
    if (!user || !validOrderId) return
    setStatus('loading')
    setFeedback('')
    try {
      const available = await fetchDiagnosticAvailability(supabase, validOrderId)
      setCandidates(available)
      setSelectedId((current) => available.some((candidate) => candidate.id === current) ? current : '')
      setStatus(available.length ? 'ready' : 'empty')
    } catch (error) {
      setCandidates([])
      setStatus('error')
      setFeedback(error.message)
    }
  }, [user, validOrderId])

  useEffect(() => {
    const timer = window.setTimeout(loadAvailability, 0)
    return () => window.clearTimeout(timer)
  }, [loadAvailability])

  const groups = useMemo(() => groupCandidates(candidates), [candidates])
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedId) || null
  const requiresEarlyConsents = selectedCandidate?.requires_early_start_consents === true
  const canConfirm = Boolean(selectedCandidate)
    && (!requiresEarlyConsents || (earlyStartRequested && fullPerformanceAcknowledged))
    && status === 'ready'

  const selectCandidate = (candidate) => {
    setSelectedId(candidate.id)
    setEarlyStartRequested(false)
    setFullPerformanceAcknowledged(false)
    setFeedback('')
  }

  const confirmSelection = async (event) => {
    event.preventDefault()
    if (!canConfirm || !validOrderId) return
    setStatus('confirming')
    setFeedback('')
    try {
      const refreshed = await fetchDiagnosticAvailability(supabase, validOrderId)
      const stillAvailable = refreshed.find((candidate) => candidate.id === selectedCandidate.id)
      if (!stillAvailable) {
        setCandidates(refreshed)
        setSelectedId('')
        setStatus('conflict')
        setFeedback('Ce créneau vient de devenir indisponible. Choisissez une autre proposition.')
        return
      }
      setCandidates(refreshed)
      setStatus('verified')
      setFeedback('Le créneau est toujours disponible. Son enregistrement définitif sera activé avec la réservation sécurisée Google Calendar.')
    } catch (error) {
      setStatus('error')
      setFeedback(error.message)
    }
  }

  return (
    <>
      <SEO
        title="Réserver le Diagnostic IA Express – FormaPrompt"
        description="Choix sécurisé d’un créneau de 90 minutes après confirmation du paiement."
        url="https://formaprompt.com/diagnostic-ia/reserver"
        robots="noindex, nofollow"
      />
      <main className="diagnostic-booking-page container section">
        <header className="diagnostic-booking-hero">
          <CalendarClock size={42} aria-hidden="true" />
          <div>
            <p className="diagnostic-booking-kicker">Diagnostic IA Express · 90 minutes</p>
            <h1>Choisissez votre créneau</h1>
            <p>Les horaires sont affichés en heure de Paris et contrôlés avec les disponibilités FormaPrompt.</p>
          </div>
        </header>

        <section className="diagnostic-booking-panel" aria-live="polite">
          {status === 'loading' ? (
            <div className="diagnostic-booking-state"><RefreshCw className="diagnostic-booking-spin" aria-hidden="true" /><p>Chargement des créneaux disponibles…</p></div>
          ) : status === 'empty' ? (
            <div className="diagnostic-booking-state"><CalendarClock aria-hidden="true" /><h2>Aucun créneau disponible actuellement</h2><p>De nouvelles disponibilités seront proposées prochainement.</p><button className="btn booking-refresh" type="button" onClick={loadAvailability}><RefreshCw size={18} aria-hidden="true" /> Actualiser</button></div>
          ) : status === 'error' ? (
            <div className="diagnostic-booking-state diagnostic-booking-error"><TriangleAlert aria-hidden="true" /><h2>Disponibilités temporairement indisponibles</h2><p>{feedback}</p>{validOrderId && <button className="btn booking-refresh" type="button" onClick={loadAvailability}><RefreshCw size={18} aria-hidden="true" /> Réessayer</button>}</div>
          ) : (
            <form onSubmit={confirmSelection}>
              {status === 'conflict' && <p className="diagnostic-booking-alert" role="alert">{feedback}</p>}
              {status === 'verified' && <div className="diagnostic-booking-verified"><CheckCircle2 aria-hidden="true" /><p>{feedback}</p></div>}

              <fieldset className="diagnostic-booking-slots" disabled={status === 'confirming' || status === 'verified'}>
                <legend>Sélectionnez une date et une heure</legend>
                {groups.map((group) => (
                  <section key={group.dateKey} className="diagnostic-booking-day">
                    <h2>{group.dateLabel}</h2>
                    <div className="diagnostic-booking-times">
                      {group.candidates.map((candidate) => (
                        <label key={candidate.id} className={selectedId === candidate.id ? 'selected' : ''}>
                          <input
                            type="radio"
                            name="diagnostic-slot"
                            value={candidate.id}
                            checked={selectedId === candidate.id}
                            onChange={() => selectCandidate(candidate)}
                          />
                          <span><strong>{candidate.timeLabel}</strong><small>90 minutes · visioconférence</small></span>
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </fieldset>

              {requiresEarlyConsents && (
                <fieldset className="diagnostic-booking-consents">
                  <legend>Exécution pendant le délai de rétractation</legend>
                  <p>Ce créneau intervient avant la fin de votre délai légal. Ces deux confirmations sont distinctes et ne sont jamais précochées.</p>
                  <label><input type="checkbox" checked={earlyStartRequested} onChange={(event) => setEarlyStartRequested(event.target.checked)} /> <span>{EARLY_START_STATEMENT}</span></label>
                  <label><input type="checkbox" checked={fullPerformanceAcknowledged} onChange={(event) => setFullPerformanceAcknowledged(event.target.checked)} /> <span>{FULL_PERFORMANCE_STATEMENT}</span></label>
                  <small>L’exécution complète correspond au rendez-vous de 90 minutes réalisé et au Plan d’action IA FormaPrompt personnalisé remis. <Link to="/cgv-particuliers">Consulter les CGV particuliers</Link>.</small>
                </fieldset>
              )}

              <div className="diagnostic-booking-actions">
                <button className="btn btn-primary" type="submit" disabled={!canConfirm}>
                  {status === 'confirming' ? 'Nouvelle vérification…' : 'Confirmer ce créneau'}
                </button>
                <button className="btn booking-refresh" type="button" onClick={loadAvailability} disabled={status === 'confirming'}><RefreshCw size={18} aria-hidden="true" /> Actualiser</button>
              </div>
            </form>
          )}
        </section>
      </main>
    </>
  )
}
