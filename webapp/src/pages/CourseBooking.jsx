import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarClock, CheckCircle, MapPin, Monitor, RefreshCw } from 'lucide-react'
import SEO from '../components/SEO'
import SignaturePad from '../components/SignaturePad'
import { useAuth } from '../contexts/useAuth'
import { BOOKING_COURSES, DEFAULT_BOOKING_COURSE_ID, getBookingCourse } from '../data/bookingCatalog'
import { supabase } from '../lib/supabaseClient'
import { fetchActiveCourseAccess } from '../lib/courseAccess'
import {
  createBookingCandidates,
  createSplitDayBookingCandidates,
  createVariableSessionBookingCandidates,
  flattenSelectedSlotIds,
  groupBookedSessions,
} from '../lib/courseBookingSlots'
import './CourseBooking.css'

const STATUS_LABELS = {
  pending_distance: 'Vérification de la distance par FormaPrompt',
  awaiting_travel_payment: 'Participation déplacement à régler',
  confirmed: 'Réservation confirmée',
  rejected: 'Demande non retenue',
  cancelled: 'Réservation annulée',
  completed: 'Accompagnement réalisé',
}

function formatSlot(slot) {
  const start = new Date(slot.starts_at)
  const end = new Date(slot.ends_at)
  return `${start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} de ${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

function formatCandidate(candidate) {
  const sessionPrefix = Number.isInteger(candidate.sessionIndex)
    ? `Séance ${candidate.sessionIndex + 1} (${candidate.sessionDuration / 60} h) — `
    : ''
  if (!candidate.segments) return `${sessionPrefix}${formatSlot(candidate)}`
  const [morning, afternoon] = candidate.segments
  return `${formatSlot(morning)}, puis de ${new Date(afternoon.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à ${new Date(afternoon.ends_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

function findAttendanceForSession(records, session) {
  const startsAt = new Date(session.starts_at).getTime()
  const endsAt = new Date(session.ends_at).getTime()
  return (records || []).find((record) => (
    new Date(record.session_starts_at).getTime() === startsAt
    && new Date(record.session_ends_at).getTime() === endsAt
  ))
}

async function readFunctionError(error) {
  try {
    const payload = await error?.context?.json()
    return typeof payload?.error === 'string' ? payload.error : ''
  } catch {
    return ''
  }
}

export default function CourseBooking() {
  const { user, role, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedCourseId = searchParams.get('course') || DEFAULT_BOOKING_COURSE_ID
  const courseId = BOOKING_COURSES[requestedCourseId] ? requestedCourseId : DEFAULT_BOOKING_COURSE_ID
  const course = getBookingCourse(courseId)
  const redirectPath = `/reservation-formation?course=${encodeURIComponent(courseId)}`
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [slots, setSlots] = useState([])
  const [booking, setBooking] = useState(null)
  const [deliveryMode, setDeliveryMode] = useState('remote')
  const [scheduleFormat, setScheduleFormat] = useState(course.defaultFormat)
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([])
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [attendanceAction, setAttendanceAction] = useState('')
  const [attendanceSignatures, setAttendanceSignatures] = useState({})

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setFeedback('')

    const [accessResult, bookingResult, slotsResult] = await Promise.all([
      fetchActiveCourseAccess(user.id, courseId),
      supabase
        .from('course_booking_requests')
        .select(`
          *,
          course_session_bookings(id, starts_at, ends_at, duration_minutes, status, meeting_url),
          course_session_attendance(
            id, session_starts_at, session_ends_at, meeting_url,
            check_in_opened_at, check_in_closed_at, learner_confirmed_at,
            learner_signature_sha256, learner_signed_payload_sha256,
            trainer_status, trainer_validated_at
          )
        `)
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle(),
      supabase
        .from('training_availability_slots')
        .select('id, starts_at, ends_at, delivery_modes')
        .eq('is_active', true)
        .eq('is_reserved', false)
        .gt('starts_at', new Date().toISOString())
        .order('starts_at'),
    ])

    if (accessResult.error || bookingResult.error || slotsResult.error) {
      console.error('Chargement des réservations impossible :', {
        access: accessResult.error,
        booking: bookingResult.error,
        slots: slotsResult.error,
      })
      setFeedback('Impossible de charger les disponibilités pour le moment.')
    }

    setHasAccess(Boolean(accessResult.data))
    setBooking(bookingResult.data || null)
    setSlots(slotsResult.data || [])
    setLoading(false)
  }, [user, courseId])

  useEffect(() => {
    if (!user) {
      const destination = encodeURIComponent(redirectPath)
      navigate(sessionExpired ? `/login?session=expired&redirect=${destination}` : `/login?redirect=${destination}`)
      return undefined
    }
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [user, sessionExpired, navigate, loadData, redirectPath])

  useEffect(() => {
    if (searchParams.get('paiement') !== 'succes' || booking?.travel_fee_status === 'paid') return undefined
    const timer = window.setInterval(loadData, 2000)
    const stop = window.setTimeout(() => window.clearInterval(timer), 16000)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(stop)
    }
  }, [searchParams, booking?.travel_fee_status, loadData])

  const currentScheduleFormat = course.formats[scheduleFormat] ? scheduleFormat : course.defaultFormat
  const selectedFormat = course.formats[currentScheduleFormat]
  const compatibleCandidates = useMemo(() => (
    selectedFormat.type === 'split_day'
      ? createSplitDayBookingCandidates(slots, {
        deliveryMode,
        morningDuration: selectedFormat.segmentDurations[0],
        afternoonDuration: selectedFormat.segmentDurations[1],
        lunchMinutes: selectedFormat.lunchMinutes,
      })
      : selectedFormat.type === 'variable_sessions'
        ? createVariableSessionBookingCandidates(slots, {
          deliveryMode,
          sessionDurations: selectedFormat.sessionDurations,
        })
      : createBookingCandidates(slots, { duration: selectedFormat.durationMinutes, deliveryMode })
  ), [slots, selectedFormat, deliveryMode])

  const selectedCandidates = useMemo(() => {
    const selectedIds = new Set(selectedCandidateIds)
    return compatibleCandidates.filter((candidate) => selectedIds.has(candidate.id))
  }, [compatibleCandidates, selectedCandidateIds])

  const hasCompleteSelection = selectedCandidateIds.length === selectedFormat.sessionCount
  const bookingActionLabel = submitting
    ? 'Enregistrement…'
    : deliveryMode === 'remote'
      ? 'Confirmer mes séances'
      : 'Envoyer ma demande de présentiel'

  const availableFormats = Object.entries(course.formats).filter(([, format]) => (
    deliveryMode === 'remote' ? !format.inPersonOnly : !format.remoteOnly
  ))

  const chooseMode = (mode) => {
    setDeliveryMode(mode)
    setSelectedCandidateIds([])
    const currentFormat = course.formats[currentScheduleFormat]
    if ((mode === 'remote' && currentFormat?.inPersonOnly) || (mode === 'in_person' && currentFormat?.remoteOnly)) {
      const replacement = Object.entries(course.formats).find(([, format]) => (
        mode === 'remote' ? !format.inPersonOnly : !format.remoteOnly
      ))
      if (replacement) setScheduleFormat(replacement[0])
    }
  }

  const chooseFormat = (format) => {
    setScheduleFormat(format)
    setSelectedCandidateIds([])
  }

  const toggleCandidate = (candidate) => {
    setSelectedCandidateIds((current) => {
      if (current.includes(candidate.id)) return current.filter((id) => id !== candidate.id)
      const currentCandidates = compatibleCandidates.filter((item) => current.includes(item.id))
      const candidatesToKeep = Number.isInteger(candidate.sessionIndex)
        ? currentCandidates.filter((item) => item.sessionIndex !== candidate.sessionIndex)
        : currentCandidates
      if (candidatesToKeep.length >= selectedFormat.sessionCount) return current
      const usedSlotIds = new Set(candidatesToKeep
        .flatMap((item) => item.slotIds))
      if (candidate.slotIds.some((id) => usedSlotIds.has(id))) return current
      const orderingConflict = Number.isInteger(candidate.sessionIndex) && candidatesToKeep.some((item) => (
        item.sessionIndex < candidate.sessionIndex
          ? new Date(item.ends_at) > new Date(candidate.starts_at)
          : new Date(candidate.ends_at) > new Date(item.starts_at)
      ))
      if (orderingConflict) return current
      return [...candidatesToKeep.map((item) => item.id), candidate.id]
    })
  }

  const submitBooking = async (event) => {
    event.preventDefault()
    if (selectedCandidateIds.length !== selectedFormat.sessionCount) {
      setFeedback(`Sélectionnez ${selectedFormat.sessionCount} proposition${selectedFormat.sessionCount > 1 ? 's' : ''}.`)
      return
    }

    setSubmitting(true)
    setFeedback('')
    const selectedSlotIds = flattenSelectedSlotIds(compatibleCandidates, selectedCandidateIds)
    const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession()
    const accessToken = sessionData.session?.access_token
    if (sessionError || !accessToken) {
      await supabase.auth.signOut({ scope: 'local' })
      navigate(`/login?session=expired&redirect=${encodeURIComponent(redirectPath)}`, { replace: true })
      setSubmitting(false)
      return
    }

    const { error } = await supabase.functions.invoke('create-course-booking', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        course_id: courseId,
        delivery_mode: deliveryMode,
        schedule_format: currentScheduleFormat,
        slot_ids: selectedSlotIds,
        city: deliveryMode === 'in_person' ? city : null,
        postal_code: deliveryMode === 'in_person' ? postalCode : null,
      },
    })

    if (error) {
      const serverMessage = await readFunctionError(error)
      console.error('Réservation impossible :', error)
      if (serverMessage.includes('Session utilisateur invalide') || serverMessage.includes('Connexion requise')) {
        await supabase.auth.signOut({ scope: 'local' })
        navigate(`/login?session=expired&redirect=${encodeURIComponent(redirectPath)}`, { replace: true })
        setSubmitting(false)
        return
      }
      setFeedback(serverMessage.includes('plus disponibles')
        ? 'Un créneau vient d’être réservé. Actualisez les disponibilités et choisissez-en un autre.'
        : serverMessage.includes('existe déjà')
          ? 'Une réservation existe déjà pour cette formation. Actualisez la page pour l’afficher.'
          : serverMessage || 'La demande n’a pas pu être enregistrée. Vérifiez les informations puis réessayez.')
    } else {
      await loadData()
    }
    setSubmitting(false)
  }

  const startTravelPayment = async () => {
    setPaymentLoading(true)
    setFeedback('')
    const { data, error } = await supabase.functions.invoke('create-travel-fee-checkout', {
      body: { booking_request_id: booking.id },
    })

    if (error || !data?.url) {
      console.error('Paiement du déplacement impossible :', error || data)
      setFeedback(data?.alreadyPaid ? 'Cette participation est déjà réglée. Actualisez la page.' : 'Le paiement ne peut pas être ouvert pour le moment.')
      setPaymentLoading(false)
      return
    }
    window.location.assign(data.url)
  }

  const confirmAttendance = async (session) => {
    const actionKey = `${session.starts_at}:${session.ends_at}`
    const signature = attendanceSignatures[actionKey]
    if (!signature) {
      setFeedback('Dessinez votre signature dans le cadre avant de confirmer votre présence.')
      return
    }
    setAttendanceAction(actionKey)
    setFeedback('')

    const { error } = await supabase.rpc('confirm_course_attendance', {
      p_booking_request_id: booking.id,
      p_session_starts_at: session.starts_at,
      p_session_ends_at: session.ends_at,
      p_signature_base64: signature,
    })

    if (error) {
      console.error("Émargement impossible :", error)
      setFeedback(error.message || "L’émargement n’a pas pu être enregistré.")
    } else {
      await loadData()
      setAttendanceSignatures((current) => ({ ...current, [actionKey]: null }))
      setFeedback('Votre signature et votre présence ont été enregistrées et horodatées pour cette séance.')
    }
    setAttendanceAction('')
  }

  if (!user) return null

  return (
    <>
      <SEO title={`Réserver – ${course.shortTitle} | FormaPrompt`} description="Choisissez les horaires et la modalité de votre formation FormaPrompt." url="https://formaprompt.com/reservation-formation" />
      <main className="booking-page container section">
        <header className="booking-hero">
          <CalendarClock size={42} aria-hidden="true" />
          <div>
            <p className="booking-kicker">{course.shortTitle}</p>
            <h1>Réserver mes {course.guidedHoursLabel} avec le formateur</h1>
            <p>Choisissez la modalité, le rythme et les horaires proposés.</p>
          </div>
        </header>

        {loading ? <p>Chargement de vos droits et des disponibilités…</p> : !hasAccess ? (
          <section className="booking-panel">
            <h2>Accès à la formation requis</h2>
            <p>La réservation est disponible après le paiement ou l’attribution de la formation par FormaPrompt.</p>
            <Link to={course.landingPath} className="btn btn-primary">Voir la formation</Link>
          </section>
        ) : booking ? (
          <section className="booking-panel booking-summary" aria-live="polite">
            <CheckCircle size={36} aria-hidden="true" />
            <div>
              <p className="booking-kicker">{STATUS_LABELS[booking.status] || booking.status}</p>
              <h2>{booking.delivery_mode === 'remote' ? 'Classe virtuelle' : 'Présentiel'} – {course.formats[booking.schedule_format]?.label}</h2>
              {booking.delivery_mode === 'in_person' && <p><MapPin size={17} aria-hidden="true" /> {booking.postal_code} {booking.city} — validation dans un rayon de 100 km autour de Calais.</p>}
              <div className="booking-session-list">
                {groupBookedSessions(booking.course_session_bookings || [], booking.schedule_format).map((session) => {
                  const attendance = findAttendanceForSession(booking.course_session_attendance, session)
                  const meetingUrl = attendance?.meeting_url || session.meeting_url
                  const actionKey = `${session.starts_at}:${session.ends_at}`
                  const canCheckIn = ['confirmed', 'completed'].includes(booking.status)

                  return (
                    <article key={session.id} className={attendance?.learner_signature_sha256 ? 'booking-session--signed' : ''}>
                      <strong>{formatSlot(session)}</strong>
                      <span>{session.status === 'confirmed' ? 'Confirmée' : session.status === 'completed' ? 'Réalisée' : 'En attente'}</span>

                      {attendance?.learner_signature_sha256 ? (
                        <div className="learner-attendance-confirmed">
                          <CheckCircle size={19} aria-hidden="true" />
                          <span>Feuille signée le {new Date(attendance.learner_confirmed_at).toLocaleString('fr-FR')}</span>
                        </div>
                      ) : canCheckIn ? (
                        <div className="learner-attendance-action">
                          <p>Au début de la séance, signez depuis votre compte. Votre signature atteste votre présence pour les horaires indiqués.</p>
                          <SignaturePad
                            id={`learner-signature-${session.id}`}
                            label="Signature de l’apprenant"
                            onChange={(signature) => setAttendanceSignatures((current) => ({ ...current, [actionKey]: signature }))}
                            disabled={attendanceAction === actionKey}
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={attendanceAction === actionKey || !attendanceSignatures[actionKey]}
                            onClick={() => confirmAttendance(session)}
                          >
                            {attendanceAction === actionKey ? 'Enregistrement…' : 'Signer et confirmer ma présence'}
                          </button>
                          <small>La signature est liée à votre compte, à cette séance et à un horodatage serveur. Elle ne pourra plus être modifiée après validation.</small>
                        </div>
                      ) : null}

                      {booking.delivery_mode === 'remote' && attendance?.learner_signature_sha256 && meetingUrl && (
                        <a className="meeting-access-link" href={meetingUrl} target="_blank" rel="noreferrer">Rejoindre la visioconférence</a>
                      )}
                      {booking.delivery_mode === 'remote' && attendance?.learner_signature_sha256 && !meetingUrl && (
                        <span className="meeting-link-pending">Le lien de visioconférence sera ajouté ici par le formateur.</span>
                      )}
                    </article>
                  )
                })}
              </div>
              {booking.status === 'pending_distance' && <p className="booking-notice">FormaPrompt vérifie la distance routière avant de confirmer la demande.</p>}
              {booking.status === 'awaiting_travel_payment' && booking.travel_fee_status !== 'paid' && (
                <div className="booking-payment-box">
                  <p>Votre demande est acceptée. La participation unique aux deux déplacements est de <strong>30 €</strong>.</p>
                  <button type="button" className="btn btn-primary" onClick={startTravelPayment} disabled={paymentLoading}>{paymentLoading ? 'Ouverture du paiement…' : 'Régler les 30 € et confirmer'}</button>
                </div>
              )}
              {searchParams.get('paiement') === 'succes' && booking.travel_fee_status !== 'paid' && <p className="booking-notice">Paiement reçu par Stripe, confirmation en cours…</p>}
              {feedback && <p role="alert" className="booking-error">{feedback}</p>}
              <button type="button" className="btn booking-refresh" onClick={loadData}><RefreshCw size={17} aria-hidden="true" /> Actualiser</button>
            </div>
          </section>
        ) : (
          <form className={`booking-panel${hasCompleteSelection ? ' has-floating-confirm' : ''}`} onSubmit={submitBooking}>
            <fieldset>
              <legend>1. Choisissez la modalité</legend>
              <div className="booking-choice-grid">
                <button type="button" className={deliveryMode === 'remote' ? 'selected' : ''} onClick={() => chooseMode('remote')}><Monitor size={25} aria-hidden="true" /><strong>Classe virtuelle</strong><span>Sans supplément</span></button>
                <button type="button" className={deliveryMode === 'in_person' ? 'selected' : ''} onClick={() => chooseMode('in_person')}><MapPin size={25} aria-hidden="true" /><strong>Présentiel</strong><span>À moins de 100 km de Calais, après validation</span></button>
              </div>
            </fieldset>

            <fieldset>
              <legend>2. Choisissez le rythme</legend>
              <div className="booking-choice-grid booking-format-grid">
                {availableFormats.map(([key, format]) => (
                  <button type="button" key={key} className={currentScheduleFormat === key ? 'selected' : ''} onClick={() => chooseFormat(key)}>
                    <strong>{format.label}</strong>
                    <span>{deliveryMode === 'in_person' && format.travelFeeInPerson ? '+ 30 € de participation déplacement' : 'Inclus dans la formation'}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {deliveryMode === 'in_person' && (
              <fieldset>
                <legend>3. Indiquez la commune du lieu de formation</legend>
                <div className="booking-location-grid">
                  <label>Code postal<input value={postalCode} onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 5))} required pattern="[0-9]{5}" inputMode="numeric" /></label>
                  <label>Commune<input value={city} onChange={(event) => setCity(event.target.value)} required minLength="2" maxLength="120" /></label>
                </div>
                <p className="booking-privacy-note">L’adresse exacte ne sera demandée qu’après validation. La commune sert uniquement à contrôler la distance.</p>
              </fieldset>
            )}

            <fieldset>
              <legend>{deliveryMode === 'in_person' ? '4' : '3'}. Choisissez {selectedFormat.sessionCount} proposition{selectedFormat.sessionCount > 1 ? 's' : ''}</legend>
              <p>{selectedCandidateIds.length} sur {selectedFormat.sessionCount} sélectionnée{selectedCandidateIds.length > 1 ? 's' : ''}. {selectedFormat.selectionHint || (selectedFormat.type === 'split_day' ? 'Le site assemble automatiquement les créneaux de 30 minutes et conserve une heure pour déjeuner.' : 'Le site assemble automatiquement les créneaux de 30 minutes.')}</p>
              <div className="booking-slots">
                {compatibleCandidates.length === 0 ? (
                  <div className="booking-notice">
                    <strong>Aucun horaire compatible n’est encore publié.</strong>
                    <p>Les horaires apparaîtront ici dès que FormaPrompt aura renseigné ses disponibilités.</p>
                    {(role === 'admin' || role === 'employee') && <Link to="/admin?onglet=bookings" className="booking-admin-link">Renseigner les disponibilités dans l’administration</Link>}
                  </div>
                ) : compatibleCandidates.map((candidate) => {
                  const isSelected = selectedCandidateIds.includes(candidate.id)
                  const comparisonCandidates = Number.isInteger(candidate.sessionIndex)
                    ? selectedCandidates.filter((item) => item.sessionIndex !== candidate.sessionIndex)
                    : selectedCandidates
                  const selectedSlots = new Set(comparisonCandidates.flatMap((item) => item.slotIds))
                  const overlapsSelection = !isSelected && candidate.slotIds.some((id) => selectedSlots.has(id))
                  const orderingConflict = !isSelected && Number.isInteger(candidate.sessionIndex) && comparisonCandidates.some((item) => (
                    item.sessionIndex < candidate.sessionIndex
                      ? new Date(item.ends_at) > new Date(candidate.starts_at)
                      : new Date(candidate.ends_at) > new Date(item.starts_at)
                  ))
                  return (
                    <label key={candidate.id} className={`${isSelected ? 'selected' : ''}${overlapsSelection || orderingConflict ? ' unavailable' : ''}`}>
                      <input type="checkbox" checked={isSelected} disabled={overlapsSelection || orderingConflict} onChange={() => toggleCandidate(candidate)} />
                      <span>{formatCandidate(candidate)}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {feedback && <p role="alert" className="booking-error">{feedback}</p>}
            <button type="submit" className="btn btn-primary" disabled={submitting || !hasCompleteSelection}>{bookingActionLabel}</button>

            {hasCompleteSelection && (
              <div className="booking-floating-confirm" role="region" aria-label="Confirmation des séances sélectionnées">
                <p aria-live="polite">
                  <CheckCircle size={22} aria-hidden="true" />
                  <span>Votre sélection est complète.</span>
                </p>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{bookingActionLabel}</button>
              </div>
            )}
          </form>
        )}
      </main>
    </>
  )
}
