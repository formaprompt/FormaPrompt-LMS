import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardList, ShieldAlert } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import SEO from '../components/SEO'
import { useAuth } from '../contexts/useAuth'
import { supabase } from '../lib/supabaseClient'
import {
  AI_LEVELS,
  ORGANIZATION_SIZES,
  validateDiagnosticQuestionnaire,
} from '../../supabase/functions/_shared/diagnosticQuestionnaire.js'
import './DiagnosticQuestionnaire.css'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMPTY_ANSWERS = {
  first_name: '', last_name: '', organization: '', job_title: '', sector: '',
  organization_size: '', tools_used: '', ai_level: '', repetitive_tasks: '',
  documents_handled: '', main_difficulty: '', diagnostic_goal: '', one_task_to_remove: '',
}
const SIZE_LABELS = { independent: 'Indépendant·e / structure individuelle', '1_9': '1 à 9 personnes', '10_49': '10 à 49 personnes', '50_249': '50 à 249 personnes', '250_plus': '250 personnes ou plus' }
const AI_LABELS = { discovery: 'Découverte', beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé' }

export default function DiagnosticQuestionnaire() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const bookingId = searchParams.get('booking_id')
  const validBookingId = UUID_PATTERN.test(bookingId || '') ? bookingId : null
  const [status, setStatus] = useState(validBookingId ? 'loading' : 'unavailable')
  const [answers, setAnswers] = useState(EMPTY_ANSWERS)
  const [message, setMessage] = useState(validBookingId ? '' : 'La référence de réservation est absente ou invalide.')

  useEffect(() => {
    if (!user || !validBookingId) return undefined
    let active = true
    async function load() {
      const { data: booking, error: bookingError } = await supabase
        .from('diagnostic_ia_bookings')
        .select('id, status')
        .eq('id', validBookingId)
        .maybeSingle()
      if (!active) return
      if (bookingError || !booking || booking.status !== 'booked') {
        setStatus('unavailable')
        setMessage('Ce questionnaire est disponible uniquement après confirmation de votre rendez-vous.')
        return
      }
      const { data: questionnaire, error: questionnaireError } = await supabase
        .from('diagnostic_ia_preparation_questionnaires')
        .select('id, submitted_at')
        .eq('booking_id', validBookingId)
        .maybeSingle()
      if (!active) return
      if (questionnaireError) {
        setStatus('error')
        setMessage('Le questionnaire ne peut pas être chargé pour le moment.')
      } else if (questionnaire) {
        setStatus('submitted')
        setMessage(`Questionnaire transmis le ${new Date(questionnaire.submitted_at).toLocaleDateString('fr-FR')}.`)
      } else setStatus('ready')
    }
    load()
    return () => { active = false }
  }, [user, validBookingId])

  const updateAnswer = (event) => setAnswers((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    const validation = validateDiagnosticQuestionnaire(answers)
    if (validation.error || !validBookingId) {
      setMessage(validation.error || 'Réservation invalide.')
      return
    }
    setStatus('saving')
    setMessage('')
    const { data, error } = await supabase.functions.invoke('submit-diagnostic-questionnaire', {
      body: { booking_id: validBookingId, answers: validation.data },
    })
    if (error) {
      const payload = await error.context?.json?.().catch(() => null)
      setStatus('ready')
      setMessage(payload?.error || 'Le questionnaire ne peut pas être enregistré pour le moment.')
      return
    }
    setStatus('submitted')
    setMessage(`Questionnaire transmis le ${new Date(data.questionnaire.submitted_at).toLocaleDateString('fr-FR')}.`)
  }

  return <>
    <SEO title="Questionnaire préalable – Diagnostic IA" description="Préparez votre Diagnostic IA Express." url="https://formaprompt.com/diagnostic-ia/questionnaire" robots="noindex, nofollow" />
    <main className="diagnostic-questionnaire-page container section">
      <header className="diagnostic-questionnaire-hero"><ClipboardList aria-hidden="true" /><div><p>Diagnostic IA Express · préparation</p><h1>Préparons votre diagnostic</h1><span>Comptez 5 à 10 minutes. Vos réponses servent uniquement à préparer votre rendez-vous.</span></div></header>
      <aside className="diagnostic-questionnaire-privacy"><ShieldAlert aria-hidden="true" /><p><strong>Important :</strong> ne saisissez pas de données personnelles ou confidentielles inutiles. Décrivez les documents, outils et situations avec des termes génériques.</p></aside>
      {status === 'loading' && <p>Vérification de votre réservation…</p>}
      {status === 'unavailable' || status === 'error' ? <p className="diagnostic-questionnaire-error" role="alert">{message}</p> : null}
      {status === 'submitted' ? <section className="diagnostic-questionnaire-success" role="status"><CheckCircle2 aria-hidden="true" /><div><h2>Merci, votre préparation est enregistrée.</h2><p>{message}</p></div></section> : null}
      {['ready', 'saving'].includes(status) && <form className="diagnostic-questionnaire-form" onSubmit={submit}>
        <p className="diagnostic-questionnaire-required">Tous les champs sont nécessaires pour préparer l’échange.</p>
        <div className="diagnostic-questionnaire-grid">
          <label>Prénom<input name="first_name" value={answers.first_name} onChange={updateAnswer} maxLength="80" required /></label>
          <label>Nom<input name="last_name" value={answers.last_name} onChange={updateAnswer} maxLength="80" required /></label>
          <label>Organisation<input name="organization" value={answers.organization} onChange={updateAnswer} maxLength="160" required /></label>
          <label>Métier / fonction<input name="job_title" value={answers.job_title} onChange={updateAnswer} maxLength="120" required /></label>
          <label>Secteur d’activité<input name="sector" value={answers.sector} onChange={updateAnswer} maxLength="120" required /></label>
          <label>Taille de structure<select name="organization_size" value={answers.organization_size} onChange={updateAnswer} required><option value="">Sélectionnez</option>{ORGANIZATION_SIZES.map((value) => <option value={value} key={value}>{SIZE_LABELS[value]}</option>)}</select></label>
          <label>Niveau IA<select name="ai_level" value={answers.ai_level} onChange={updateAnswer} required><option value="">Sélectionnez</option>{AI_LEVELS.map((value) => <option value={value} key={value}>{AI_LABELS[value]}</option>)}</select></label>
        </div>
        <label>Outils utilisés<textarea name="tools_used" value={answers.tools_used} onChange={updateAnswer} maxLength="1000" required /></label>
        <label>Tâches répétitives ou chronophages<textarea name="repetitive_tasks" value={answers.repetitive_tasks} onChange={updateAnswer} maxLength="2000" required /></label>
        <label>Documents manipulés<textarea name="documents_handled" value={answers.documents_handled} onChange={updateAnswer} maxLength="1000" required /></label>
        <label>Difficulté principale<textarea name="main_difficulty" value={answers.main_difficulty} onChange={updateAnswer} maxLength="1000" required /></label>
        <label>Objectif du diagnostic<textarea name="diagnostic_goal" value={answers.diagnostic_goal} onChange={updateAnswer} maxLength="1000" required /></label>
        <label className="diagnostic-questionnaire-key-question">Si vous pouviez supprimer une seule tâche pénible de votre semaine, laquelle choisiriez-vous ?<textarea name="one_task_to_remove" value={answers.one_task_to_remove} onChange={updateAnswer} maxLength="1000" required /></label>
        {message && <p className="diagnostic-questionnaire-error" role="alert">{message}</p>}
        <button className="btn btn-primary" type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Enregistrement…' : 'Envoyer ma préparation'}</button>
      </form>}
    </main>
  </>
}
