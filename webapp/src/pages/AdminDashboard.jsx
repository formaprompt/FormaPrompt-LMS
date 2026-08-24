import { useAuth } from '../contexts/useAuth';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchActiveCourseAccesses } from '../lib/courseAccess';
import { courseCatalog } from '../data/courseCatalog';
import { createAvailabilitySlots, createInitialAvailabilityForm, formatDateInput } from '../lib/availabilitySlots';
import { groupBookedSessions } from '../lib/courseBookingSlots';
import {
  calculateFinalProjectReviewStatus,
  FINAL_PROJECT_REVIEW_FIELDS,
} from '../lib/finalProjectEvaluation';
import { buildAttestationDossier, formatAttestationDuration } from '../lib/attestationDossier';
import { fetchTrainerGuideUrl } from '../lib/paidCourseContent';
import SignaturePad from '../components/SignaturePad';
import './AdminDashboard.css';

const MAX_BLOG_IMAGE_SIZE = 5 * 1024 * 1024;
const BLOG_IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const COURSE_LABELS = {
  'formation-ia': 'Formation IA générative',
  'formation-ia-act': 'IA Act – acculturation et conformité',
  'formation-prompt-level-1': 'Prompt Engineering – Niveau 1',
};

const COURSE_OPTIONS = Object.entries(COURSE_LABELS).map(([id, label]) => ({ id, label }));

const TRAINER_GUIDES = [
  {
    id: 'formation-ia',
    title: 'Guide formateur IA générative',
    description: 'Déroulés des trois rythmes de 10 heures, démonstrations, corrections, adaptations et preuves pédagogiques.',
  },
  {
    id: 'formation-ia-act',
    title: 'Guide formateur IA Act',
    description: "Déroulés des trois formats de 4 heures guidées, exercices liés aux modules, évaluation finale et preuves pédagogiques.",
  },
  {
    id: 'formation-prompt-level-1',
    title: 'Guide formateur Prompt Engineering – Niveau 1',
    description: 'Déroulés des deux formats de 7 heures, six démonstrations, réponses attendues, corrections et preuves Qualiopi.',
  },
];

function TrainerGuideLink({ guide }) {
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  async function openGuide() {
    setFeedback('');
    const targetWindow = window.open('', '_blank');
    if (!targetWindow) {
      setFeedback('Autorisez l’ouverture d’un nouvel onglet puis réessayez.');
      return;
    }
    targetWindow.opener = null;
    setLoading(true);
    try {
      const signedUrl = await fetchTrainerGuideUrl(supabase, guide.id);
      targetWindow.location.replace(signedUrl);
    } catch (error) {
      targetWindow.close();
      setFeedback(error.message || 'Le guide ne peut pas être ouvert pour le moment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn admin-dashboard__guide-link"
        onClick={openGuide}
        disabled={loading}
      >
        {loading ? 'Vérification…' : 'Ouvrir le guide PDF'}
      </button>
      {feedback && <p role="alert">{feedback}</p>}
    </>
  );
}

const EXERCISE_REVIEW_STATUS_LABELS = {
  needs_revision: 'À reprendre',
  validated: 'Validé',
};

const FINAL_PROJECT_REVIEW_STATUS_LABELS = {
  needs_revision: 'Nouvelle remise attendue',
  validated: 'Évaluation validée',
};

const BOOKING_STATUS_LABELS = {
  pending_distance: 'Distance à vérifier',
  awaiting_travel_payment: 'Participation de 30 € attendue',
  confirmed: 'Confirmée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
  completed: 'Réalisée',
};

const BOOKING_FORMAT_LABELS = {
  one_4h: '1 × 4 h',
  two_2h: '2 × 2 h',
  four_1h: '4 × 1 h',
  one_day_7h: '1 journée : 4 h + 3 h',
  two_3h30: '2 × 3 h 30',
  two_5h: '2 × 5 h',
  four_2h30: '4 × 2 h 30',
  three_4h_4h_2h: '4 h + 4 h + 2 h',
};

const ATTENDANCE_STATUS_LABELS = {
  pending: 'À valider par le formateur',
  present: 'Présence complète',
  partial: 'Départ anticipé',
  absent: 'Absent(e)',
  technical_issue: 'Incident technique',
};

function formatBookingSlot(slot) {
  const start = new Date(slot.starts_at);
  const end = new Date(slot.ends_at);
  return `${start.toLocaleDateString('fr-FR')} · ${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function slotsOverlap(firstSlot, secondSlot) {
  return new Date(firstSlot.starts_at) < new Date(secondSlot.ends_at)
    && new Date(firstSlot.ends_at) > new Date(secondSlot.starts_at);
}

function attendanceSessionKey(bookingId, session) {
  return `${bookingId}:${session.starts_at}:${session.ends_at}`;
}

function toLocalDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function findAttendanceRecord(attendanceRecords, bookingId, session) {
  const startsAt = new Date(session.starts_at).getTime();
  const endsAt = new Date(session.ends_at).getTime();
  return attendanceRecords.find((record) => (
    record.booking_request_id === bookingId
    && new Date(record.session_starts_at).getTime() === startsAt
    && new Date(record.session_ends_at).getTime() === endsAt
  ));
}

function AttendanceSessionAdmin({ booking, session, attendance, draft, sessionFeedback, bookingAction, onDraftChange, onAction }) {
  const actionPrefix = `attendance:${attendanceSessionKey(booking.id, session)}`;
  const actionRunning = bookingAction.startsWith(actionPrefix);
  const isCheckInOpen = Boolean(attendance?.check_in_opened_at && !attendance?.check_in_closed_at);
  const hasLearnerSignature = Boolean(attendance?.learner_signature_sha256);
  const canValidate = draft.trainer_status !== 'pending'
    && (draft.trainer_status !== 'partial' || Boolean(draft.actual_ends_at))
    && Boolean(draft.trainer_signature_base64)
    && (!['present', 'partial'].includes(draft.trainer_status) || hasLearnerSignature);

  return (
    <article className="attendance-session-admin">
      <header>
        <div>
          <strong>{formatBookingSlot(session)}</strong>
          <span>{booking.delivery_mode === 'remote' ? 'Classe virtuelle' : 'Présentiel'}</span>
        </div>
        <span className={`attendance-badge attendance-badge--${attendance?.trainer_status || 'pending'}`}>
          {ATTENDANCE_STATUS_LABELS[attendance?.trainer_status || 'pending']}
        </span>
      </header>

      {booking.delivery_mode === 'remote' && (
        <div className="meeting-link-block">
          <div className="meeting-link-editor">
            <label htmlFor={`meeting-url-${session.id}`}>
              Lien de visioconférence
              <input
                id={`meeting-url-${session.id}`}
                type="url"
                inputMode="url"
                placeholder="https://meet.google.com/… ou lien Microsoft Teams"
                value={draft.meeting_url}
                onChange={(event) => onDraftChange('meeting_url', event.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={actionRunning}
              onClick={() => onAction('save_meeting_url')}
            >
              {bookingAction === `${actionPrefix}:save_meeting_url` ? 'Enregistrement et vérification…' : 'Enregistrer le lien'}
            </button>
          </div>

          {sessionFeedback ? (
            <div
              className={`meeting-link-feedback meeting-link-feedback--${sessionFeedback.type}`}
              role={sessionFeedback.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {sessionFeedback.message}
            </div>
          ) : attendance?.meeting_url ? (
            <div className="meeting-link-feedback meeting-link-feedback--success" role="status">
              <strong>✓ Lien enregistré dans Supabase.</strong>
              <a href={attendance.meeting_url} target="_blank" rel="noreferrer">Tester le lien enregistré</a>
              {attendance.updated_at && <small>Dernière vérification : {new Date(attendance.updated_at).toLocaleString('fr-FR')}</small>}
            </div>
          ) : (
            <div className="meeting-link-feedback meeting-link-feedback--empty" role="status">
              Aucun lien de visioconférence n’est actuellement enregistré pour cette séance.
            </div>
          )}
        </div>
      )}

      <div className="attendance-check-in-state">
        <p>
          <strong>Émargement apprenant :</strong>{' '}
          {hasLearnerSignature
            ? `signé le ${new Date(attendance.learner_confirmed_at).toLocaleString('fr-FR')}`
            : 'signature manquante'}
        </p>
        <div>
          {isCheckInOpen ? (
            <button type="button" className="btn attendance-secondary-btn" disabled={actionRunning} onClick={() => onAction('close_check_in')}>
              Fermer l’émargement
            </button>
          ) : (
            <button type="button" className="btn attendance-secondary-btn" disabled={actionRunning || hasLearnerSignature} onClick={() => onAction('open_check_in')}>
              Ouvrir l’émargement maintenant
            </button>
          )}
        </div>
      </div>

      <details className="attendance-validation-details" open={attendance?.trainer_status === 'pending' && hasLearnerSignature}>
        <summary>Valider la présence réelle après la séance</summary>
        <form onSubmit={(event) => { event.preventDefault(); onAction('validate'); }}>
          <label>
            État constaté
            <select value={draft.trainer_status} onChange={(event) => onDraftChange('trainer_status', event.target.value)}>
              <option value="pending">À valider</option>
              <option value="present">Présence complète</option>
              <option value="partial">Départ anticipé</option>
              <option value="absent">Absent(e)</option>
              <option value="technical_issue">Incident technique</option>
            </select>
          </label>
          <label>
            Heure réelle de fin ou de départ
            <input
              type="datetime-local"
              value={draft.actual_ends_at}
              onChange={(event) => onDraftChange('actual_ends_at', event.target.value)}
              disabled={draft.trainer_status === 'absent'}
              required={draft.trainer_status === 'partial'}
            />
          </label>
          <label className="attendance-note-field">
            Note facultative
            <textarea
              rows="3"
              maxLength="1500"
              placeholder="Ex. départ à 15 h 30, coupure de connexion…"
              value={draft.trainer_note}
              onChange={(event) => onDraftChange('trainer_note', event.target.value)}
            />
          </label>
          <div className="attendance-trainer-signature">
            <SignaturePad
              id={`trainer-signature-${session.id}`}
              label={attendance?.trainer_validated_at ? 'Nouvelle signature du formateur pour cette correction' : 'Signature du formateur'}
              onChange={(signature) => onDraftChange('trainer_signature_base64', signature)}
              disabled={actionRunning}
            />
            <small>En signant, vous certifiez l’état de présence indiqué ci-dessus. Une correction exige une nouvelle signature.</small>
          </div>
          <button type="submit" className="btn btn-primary" disabled={actionRunning || !canValidate}>
            {bookingAction === `${actionPrefix}:validate` ? 'Validation…' : attendance?.trainer_validated_at ? 'Enregistrer la correction' : 'Valider la présence'}
          </button>
        </form>
      </details>
    </article>
  );
}

function normalizeAdministrativeSearch(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .trim();
}

function getLearnerIdentity(booking, positioningAssessments) {
  const assessment = positioningAssessments.find((item) => (
    item.user_id === booking.user_id && item.course_id === booking.course_id
  ));
  return {
    name: assessment?.learner_name || booking.profiles?.email || 'Apprenant',
    email: booking.profiles?.email || '',
  };
}

function getBookingSessions(booking) {
  return groupBookedSessions(booking.course_session_bookings || [], booking.schedule_format)
    .sort((first, second) => new Date(first.starts_at) - new Date(second.starts_at));
}

function VisibleDateField({ id, label, min, value, onChange }) {
  const inputRef = useRef(null);

  const openCalendar = () => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
    }
  };

  return (
    <div className="availability-visible-date-field">
      <label htmlFor={id}>{label}</label>
      <div className="availability-date-control">
        <input
          ref={inputRef}
          id={id}
          type="date"
          required
          min={min}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          onClick={openCalendar}
          aria-label={`Ouvrir le calendrier : ${label}`}
          title={`Choisir la date : ${label}`}
        >
          <span aria-hidden="true">📅</span>
        </button>
      </div>
    </div>
  );
}

function BookingRequestsSection({
  bookingRequests,
  positioningAssessments,
  attendanceRecords,
  attendanceDrafts,
  attendanceSessionFeedbacks,
  bookingAction,
  onAttendanceDraftChange,
  onAttendanceAction,
  onDecision,
}) {
  const [learnerSearch, setLearnerSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [administrativeFilter, setAdministrativeFilter] = useState('active');
  const [administrativeReferenceTime] = useState(() => new Date());
  const todayKey = administrativeReferenceTime.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const courseOptions = useMemo(() => Array.from(new Set(bookingRequests.map((booking) => booking.course_id))), [bookingRequests]);

  const enrichedBookings = useMemo(() => bookingRequests.map((booking) => {
    const sessions = getBookingSessions(booking);
    const learner = getLearnerIdentity(booking, positioningAssessments);
    const sessionStates = sessions.map((session) => ({
      session,
      attendance: findAttendanceRecord(attendanceRecords, booking.id, session),
    }));
    const nextSession = sessions.find((session) => new Date(session.ends_at) >= administrativeReferenceTime) || sessions.at(-1);
    const todaySession = sessions.find((session) => (
      new Date(session.starts_at).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) === todayKey
    ));
    const attentionSessionState = sessionStates.find(({ session, attendance }) => (
      (attendance?.learner_signature_sha256 && attendance?.trainer_status === 'pending')
      || (new Date(session.ends_at) < administrativeReferenceTime && !attendance?.learner_signature_sha256)
    ));
    const needsAttention = ['pending_distance', 'awaiting_travel_payment'].includes(booking.status)
      || Boolean(attentionSessionState);
    const hasSessionToday = Boolean(todaySession);
    return {
      booking,
      sessions,
      learner,
      sessionStates,
      nextSession,
      todaySession,
      attentionSession: attentionSessionState?.session,
      needsAttention,
      hasSessionToday,
    };
  }), [administrativeReferenceTime, attendanceRecords, bookingRequests, positioningAssessments, todayKey]);

  const visibleBookings = useMemo(() => {
    const query = normalizeAdministrativeSearch(learnerSearch);
    return enrichedBookings
      .filter(({ booking, learner, needsAttention, hasSessionToday }) => {
        if (courseFilter !== 'all' && booking.course_id !== courseFilter) return false;
        if (administrativeFilter === 'active' && ['completed', 'cancelled', 'rejected'].includes(booking.status)) return false;
        if (administrativeFilter === 'attention' && !needsAttention) return false;
        if (administrativeFilter === 'today' && !hasSessionToday) return false;
        if (administrativeFilter === 'archived' && !['completed', 'cancelled', 'rejected'].includes(booking.status)) return false;
        if (!query) return true;
        return normalizeAdministrativeSearch([
          learner.name,
          learner.email,
          COURSE_LABELS[booking.course_id] || booking.course_id,
          booking.id,
        ].join(' ')).includes(query);
      })
      .map((item) => {
        if (administrativeFilter === 'today') {
          return { ...item, displaySession: item.todaySession, displaySessionLabel: 'Séance du jour' };
        }
        if (administrativeFilter === 'attention' && item.attentionSession) {
          return { ...item, displaySession: item.attentionSession, displaySessionLabel: 'Séance à traiter' };
        }
        if (administrativeFilter === 'archived') {
          return { ...item, displaySession: item.sessions[0], displaySessionLabel: 'Première séance' };
        }
        return { ...item, displaySession: item.nextSession, displaySessionLabel: 'Prochaine séance' };
      })
      .sort((first, second) => {
        const firstTime = first.displaySession ? new Date(first.displaySession.starts_at).getTime() : Number.POSITIVE_INFINITY;
        const secondTime = second.displaySession ? new Date(second.displaySession.starts_at).getTime() : Number.POSITIVE_INFINITY;
        if (firstTime !== secondTime) return firstTime - secondTime;
        return first.learner.name.localeCompare(second.learner.name, 'fr-FR');
      });
  }, [administrativeFilter, courseFilter, enrichedBookings, learnerSearch]);

  const attentionCount = enrichedBookings.filter((item) => item.needsAttention).length;
  const todayCount = enrichedBookings.filter((item) => item.hasSessionToday).length;

  return (
    <section className="booking-requests-section" aria-labelledby="booking-requests-title">
      <div className="booking-requests-heading">
        <div>
          <h3 id="booking-requests-title">Centre de suivi des séances</h3>
          <p>Recherchez d’abord l’apprenant, puis vérifiez la formation et la date avant d’ouvrir son émargement.</p>
        </div>
        <span>{bookingRequests.length} réservation{bookingRequests.length > 1 ? 's' : ''}</span>
      </div>

      <div className="administrative-overview" aria-label="Résumé des séances">
        <button type="button" onClick={() => setAdministrativeFilter('today')}>
          <strong>{todayCount}</strong><span>Aujourd’hui</span>
        </button>
        <button type="button" onClick={() => setAdministrativeFilter('attention')}>
          <strong>{attentionCount}</strong><span>À traiter</span>
        </button>
        <Link to="/admin/emargements"><strong>PDF</strong><span>Toutes les feuilles</span></Link>
      </div>

      <div className="administrative-filters">
        <label className="administrative-search-field">
          Rechercher un apprenant
          <input
            type="search"
            placeholder="Nom, e-mail ou référence…"
            value={learnerSearch}
            onChange={(event) => setLearnerSearch(event.target.value)}
          />
        </label>
        <label>
          Formation
          <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
            <option value="all">Toutes les formations</option>
            {courseOptions.map((courseId) => <option key={courseId} value={courseId}>{COURSE_LABELS[courseId] || courseId}</option>)}
          </select>
        </label>
        <label>
          Affichage
          <select value={administrativeFilter} onChange={(event) => setAdministrativeFilter(event.target.value)}>
            <option value="active">Dossiers actifs</option>
            <option value="today">Séances aujourd’hui</option>
            <option value="attention">Administratif à traiter</option>
            <option value="archived">Dossiers terminés ou annulés</option>
            <option value="all">Tous les dossiers</option>
          </select>
        </label>
      </div>

      <div className="administrative-result-count" role="status">
        <span>
          {visibleBookings.length} dossier{visibleBookings.length > 1 ? 's' : ''} affiché{visibleBookings.length > 1 ? 's' : ''}
          <small> · tri chronologique, du plus proche au plus éloigné</small>
        </span>
        {(learnerSearch || courseFilter !== 'all' || administrativeFilter !== 'active') && (
          <button type="button" onClick={() => { setLearnerSearch(''); setCourseFilter('all'); setAdministrativeFilter('active'); }}>Réinitialiser les filtres</button>
        )}
      </div>

      {bookingRequests.length === 0 ? (
        <p style={{ color: '#cbd5e1' }}>Aucune demande de réservation.</p>
      ) : visibleBookings.length === 0 ? (
        <p className="administrative-empty">Aucun dossier ne correspond à ces critères.</p>
      ) : (
        <div className="administrative-booking-list">
          {visibleBookings.map(({ booking, sessions, learner, displaySession, displaySessionLabel, needsAttention, hasSessionToday }) => (
            <article key={booking.id} className={booking.status === 'pending_distance' ? 'booking-request-card booking-request-card--pending' : 'booking-request-card'}>
              <div className="administrative-booking-header">
                <div className="administrative-learner-identity">
                  <span>APPRENANT</span>
                  <h4>{learner.name}</h4>
                  {learner.email && learner.email !== learner.name && <p>{learner.email}</p>}
                </div>
                <div className="administrative-course-identity">
                  <span>FORMATION</span>
                  <strong>{COURSE_LABELS[booking.course_id] || booking.course_id}</strong>
                  <small>Réf. {booking.id.slice(0, 8).toUpperCase()}</small>
                </div>
              </div>

              <div className="administrative-booking-landmarks">
                <div><span>{displaySessionLabel}</span><strong>{displaySession ? formatBookingSlot(displaySession) : 'Aucune séance'}</strong></div>
                <div><span>Modalité</span><strong>{booking.delivery_mode === 'remote' ? 'Classe virtuelle' : `Présentiel · ${booking.postal_code} ${booking.city}`}</strong></div>
                <div><span>Rythme</span><strong>{BOOKING_FORMAT_LABELS[booking.schedule_format]}</strong></div>
              </div>

              <div className="administrative-card-actions">
                <Link className="attendance-sheet-primary-link" to={`/admin/emargements/${booking.id}`}>
                  Ouvrir l’émargement — {learner.name}
                </Link>
                <span className={`administrative-status administrative-status--${needsAttention ? 'attention' : hasSessionToday ? 'today' : 'normal'}`}>
                  {needsAttention ? 'Administratif à traiter' : hasSessionToday ? 'Séance aujourd’hui' : BOOKING_STATUS_LABELS[booking.status] || booking.status}
                </span>
              </div>

              <details className="administrative-session-details" open={needsAttention || hasSessionToday}>
                <summary>Gérer les {sessions.length} séance{sessions.length > 1 ? 's' : ''}, signatures et visioconférences</summary>
                <div className="attendance-session-list">
                {sessions.map((session) => {
                  const key = attendanceSessionKey(booking.id, session);
                  const attendance = findAttendanceRecord(attendanceRecords, booking.id, session);
                  const draft = attendanceDrafts[key] || {
                    meeting_url: attendance?.meeting_url || session.meeting_url || '',
                    trainer_status: attendance?.trainer_status || 'pending',
                    actual_ends_at: toLocalDateTimeInput(attendance?.actual_ends_at),
                    trainer_note: attendance?.trainer_note || '',
                    trainer_signature_base64: null,
                  };

                  return (
                    <AttendanceSessionAdmin
                      key={session.id}
                      booking={booking}
                      session={session}
                      attendance={attendance}
                      draft={draft}
                      sessionFeedback={attendanceSessionFeedbacks[key]}
                      bookingAction={bookingAction}
                      onDraftChange={(field, value) => onAttendanceDraftChange(key, field, value)}
                      onAction={(action) => onAttendanceAction(booking, session, action)}
                    />
                  );
                })}
                </div>
              </details>

              {booking.delivery_mode === 'in_person' && ['two_2h', 'two_3h30', 'two_5h'].includes(booking.schedule_format) && (
                <p style={{ color: '#fbbf24' }}>
                  Participation déplacement : {booking.travel_fee_status === 'paid' ? '30 € réglés' : '30 € non réglés'}
                </p>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {booking.status === 'pending_distance' && (
                  <>
                    <button type="button" className="btn btn-primary" disabled={bookingAction === `booking:${booking.id}`} onClick={() => onDecision(booking, 'approve')}>
                      {bookingAction === `booking:${booking.id}` ? 'Validation…' : 'Valider la distance'}
                    </button>
                    <button type="button" className="btn" disabled={bookingAction === `booking:${booking.id}`} onClick={() => onDecision(booking, 'reject')} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#fca5a5' }}>Refuser</button>
                  </>
                )}
                {['confirmed', 'awaiting_travel_payment'].includes(booking.status) && (
                  <button type="button" className="btn" disabled={bookingAction === `booking:${booking.id}`} onClick={() => onDecision(booking, 'cancel')} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#fca5a5' }}>Annuler</button>
                )}
                {booking.status === 'confirmed' && (
                  <button type="button" className="btn btn-primary" disabled={bookingAction === `booking:${booking.id}`} onClick={() => onDecision(booking, 'complete')}>Marquer réalisée</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="booking-requests-rgpd-note">
        La commune et le code postal servent uniquement à vérifier le rayon de déplacement. Demandez l’adresse exacte après acceptation et conservez ces données pendant une durée proportionnée au suivi de la formation.
      </p>
    </section>
  );
}

export default function AdminDashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const requestedTab = searchParams.get('onglet');
  const [activeTab, setActiveTab] = useState(
    ['overview', 'users', 'contacts', 'blog', 'purchases', 'bookings', 'positioning', 'corrections', 'trainer-guides', 'feedback'].includes(requestedTab)
      ? requestedTab
      : 'overview',
  );
  const [bookingWorkspaceTab, setBookingWorkspaceTab] = useState('sessions');
  const [correctionWorkspaceTab, setCorrectionWorkspaceTab] = useState('exercises');
  const [correctionSearch, setCorrectionSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [positioningAssessments, setPositioningAssessments] = useState([]);
  const [positioningError, setPositioningError] = useState('');
  const [exerciseSubmissions, setExerciseSubmissions] = useState([]);
  const [exerciseReviewHistory, setExerciseReviewHistory] = useState([]);
  const [correctionDrafts, setCorrectionDrafts] = useState({});
  const [correctionFeedbacks, setCorrectionFeedbacks] = useState({});
  const [correctionSaving, setCorrectionSaving] = useState('');
  const [correctionsAvailable, setCorrectionsAvailable] = useState(true);
  const [correctionsError, setCorrectionsError] = useState('');
  const [finalProjectSubmissions, setFinalProjectSubmissions] = useState([]);
  const [finalProjectReviewHistory, setFinalProjectReviewHistory] = useState([]);
  const [finalProjectReviewDrafts, setFinalProjectReviewDrafts] = useState({});
  const [finalProjectReviewFeedbacks, setFinalProjectReviewFeedbacks] = useState({});
  const [finalProjectReviewSaving, setFinalProjectReviewSaving] = useState('');
  const [finalProjectReviewsAvailable, setFinalProjectReviewsAvailable] = useState(true);
  const [finalProjectReviewsError, setFinalProjectReviewsError] = useState('');
  const [purchases, setPurchases] = useState([]);
  const [purchasesError, setPurchasesError] = useState('');
  const [courseAccesses, setCourseAccesses] = useState([]);
  const [selectedCourseByUser, setSelectedCourseByUser] = useState({});
  const [grantingAccess, setGrantingAccess] = useState('');
  const [grantFeedback, setGrantFeedback] = useState(null);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [attendanceSessionFeedbacks, setAttendanceSessionFeedbacks] = useState({});
  const [bookingError, setBookingError] = useState('');
  const [bookingFeedback, setBookingFeedback] = useState('');
  const [bookingAction, setBookingAction] = useState('');
  const [slotForm, setSlotForm] = useState(() => createInitialAvailabilityForm());
  const [loading, setLoading] = useState(true);

  // Blog Form State
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [newPost, setNewPost] = useState({
    title: '',
    slug: '',
    category: '',
    excerpt: '',
    seo_title: '',
    meta_description: '',
    image_alt: '',
    content: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchBookingManagement = useCallback(async () => {
    const [slotsResult, requestsResult, attendanceResult] = await Promise.all([
      supabase
        .from('training_availability_slots')
        .select('*')
        .or('is_active.eq.true,is_reserved.eq.true')
        .order('starts_at', { ascending: true }),
      supabase
        .from('course_booking_requests')
        .select(`
          *,
          profiles!course_booking_requests_user_id_fkey(email),
          course_session_bookings(id, starts_at, ends_at, duration_minutes, status, meeting_url)
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('course_session_attendance')
        .select('id, booking_request_id, user_id, session_starts_at, session_ends_at, delivery_mode, meeting_url, check_in_opened_at, check_in_closed_at, learner_confirmed_at, learner_confirmation_version, learner_signature_sha256, learner_signed_payload_sha256, trainer_status, actual_ends_at, trainer_note, trainer_validated_by, trainer_validated_at, trainer_signature_sha256, trainer_signed_payload_sha256, locked_at, created_at, updated_at')
        .order('session_starts_at', { ascending: true }),
    ]);

    if (slotsResult.error || requestsResult.error || attendanceResult.error) {
      console.error('Gestion des réservations indisponible :', {
        slots: slotsResult.error,
        requests: requestsResult.error,
        attendance: attendanceResult.error,
      });
      setBookingError("Les réservations ne peuvent pas être chargées. Vérifiez que la migration Supabase est appliquée.");
      return;
    }

    const loadedBookings = requestsResult.data || [];
    const loadedAttendance = attendanceResult.data || [];
    const nextDrafts = {};
    loadedBookings.forEach((booking) => {
      groupBookedSessions(booking.course_session_bookings || [], booking.schedule_format).forEach((session) => {
        const key = attendanceSessionKey(booking.id, session);
        const attendance = findAttendanceRecord(loadedAttendance, booking.id, session);
        nextDrafts[key] = {
          meeting_url: attendance?.meeting_url || session.meeting_url || '',
          trainer_status: attendance?.trainer_status || 'pending',
          actual_ends_at: toLocalDateTimeInput(attendance?.actual_ends_at),
          trainer_note: attendance?.trainer_note || '',
          trainer_signature_base64: null,
        };
      });
    });

    setAvailabilitySlots(slotsResult.data || []);
    setBookingRequests(loadedBookings);
    setAttendanceRecords(loadedAttendance);
    setAttendanceDrafts(nextDrafts);
    setBookingError('');
  }, []);

  const fetchCourseCorrections = useCallback(async () => {
    const [submissionsResult, historyResult] = await Promise.all([
      supabase
        .from('course_exercise_latest_submissions')
        .select('id, user_id, course_id, exercise_id, response_text, saved_at')
        .order('saved_at', { ascending: false }),
      supabase
        .from('course_exercise_review_history')
        .select('id, response_id, user_id, course_id, exercise_id, response_saved_at, feedback_text, review_status, created_at')
        .order('created_at', { ascending: false }),
    ]);

    const loadError = submissionsResult.error || historyResult.error;
    if (loadError) {
      if (['42P01', 'PGRST205'].includes(loadError.code)) {
        setCorrectionsAvailable(false);
        setCorrectionsError('');
      } else {
        console.error('Chargement des corrections pédagogiques impossible :', loadError);
        setCorrectionsAvailable(true);
        setCorrectionsError("Les réponses terminées ne peuvent pas être chargées pour le moment.");
      }
      return;
    }

    setExerciseSubmissions(submissionsResult.data || []);
    setExerciseReviewHistory(historyResult.data || []);
    setCorrectionsAvailable(true);
    setCorrectionsError('');
  }, []);

  const fetchFinalProjectReviews = useCallback(async () => {
    const [submissionsResult, historyResult] = await Promise.all([
      supabase
        .from('course_final_project_latest_submissions')
        .select(`
          id, user_id, course_id, prompt_and_iterations, final_output,
          verification_grid_reference, action_plan, learner_note, saved_at
        `)
        .order('saved_at', { ascending: false }),
      supabase
        .from('course_final_project_review_history')
        .select(`
          id, submission_id, user_id, course_id, submission_saved_at,
          need_and_audience_level, prompt_and_success_criteria_level,
          checks_and_risks_level, choices_and_limits_level,
          appreciation, improvement_areas, review_status, created_at
        `)
        .order('created_at', { ascending: false }),
    ]);

    const loadError = submissionsResult.error || historyResult.error;
    if (loadError) {
      if (['42P01', 'PGRST205'].includes(loadError.code)) {
        setFinalProjectReviewsAvailable(false);
        setFinalProjectReviewsError('');
      } else {
        console.error('Chargement des évaluations finales impossible :', loadError);
        setFinalProjectReviewsAvailable(true);
        setFinalProjectReviewsError("Les remises finales ne peuvent pas être chargées pour le moment.");
      }
      return;
    }

    setFinalProjectSubmissions(submissionsResult.data || []);
    setFinalProjectReviewHistory(historyResult.data || []);
    setFinalProjectReviewsAvailable(true);
    setFinalProjectReviewsError('');
  }, []);

  useEffect(() => {
    if (!user || (role !== 'admin' && role !== 'employee')) {
      navigate('/dashboard');
      return;
    }

    async function fetchData() {
      // Fetch users
      const { data: profilesData } = await supabase.from('profiles').select('*');
      if (profilesData) setUsers(profilesData);

      // Fetch purchases and the phone number supplied for pedagogical follow-up
      const { data: purchasesData, error: purchasesLoadError } = await supabase
        .from('purchases')
        .select('id, user_id, course_id, amount_total, currency, payment_status, customer_phone, purchased_at')
        .order('purchased_at', { ascending: false });

      if (purchasesLoadError) {
        console.error('Erreur lors du chargement des achats :', purchasesLoadError);
        setPurchasesError("Les achats ne peuvent pas être chargés pour le moment.");
      } else {
        setPurchases(purchasesData || []);
      }

      const { data: courseAccessData, error: courseAccessLoadError } = await fetchActiveCourseAccesses();

      if (courseAccessLoadError) {
        console.error('Erreur lors du chargement des droits de formation :', courseAccessLoadError);
      } else {
        setCourseAccesses(courseAccessData || []);
      }

      // Fetch contacts
      const { data: contactsData } = await supabase.from('contact_requests').select('*').order('created_at', { ascending: false });
      if (contactsData) setContacts(contactsData);

      // Fetch blog posts
      const { data: postsData } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
      if (postsData) setBlogPosts(postsData);

      // Fetch satisfaction surveys
      const { data: surveysData } = await supabase.from('satisfaction_surveys').select('*').order('created_at', { ascending: false });
      if (surveysData) setSurveys(surveysData);

      // Fetch prerequisite positioning assessments and learner emails
      const { data: positioningData, error: positioningLoadError } = await supabase
        .from('course_positioning_assessments')
        .select(`
          id,
          user_id,
          learner_name,
          course_id,
          course_title,
          answers,
          score,
          maximum_score,
          level,
          is_initial,
          submitted_at,
          profiles!course_positioning_assessments_user_id_fkey(email)
        `)
        .eq('is_initial', true)
        .order('submitted_at', { ascending: false });

      if (positioningLoadError) {
        console.error('Erreur lors du chargement des positionnements :', positioningLoadError);
        setPositioningError(
          "Les positionnements ne peuvent pas être chargés. Vérifiez que le script SQL dédié a bien été exécuté dans Supabase.",
        );
      } else {
        setPositioningAssessments(positioningData || []);
      }

      await Promise.all([fetchBookingManagement(), fetchCourseCorrections(), fetchFinalProjectReviews()]);

      setLoading(false);
    }

    fetchData();
  }, [user, role, navigate, fetchBookingManagement, fetchCourseCorrections, fetchFinalProjectReviews]);

  const availabilityPreview = useMemo(() => {
    try {
      const generated = createAvailabilitySlots(slotForm, { createdBy: user?.id });
      const reservedSlots = availabilitySlots.filter((slot) => slot.is_reserved);
      const slots = generated.slots.filter((candidate) => (
        !reservedSlots.some((reservedSlot) => slotsOverlap(candidate, reservedSlot))
      ));
      return {
        ...generated,
        slots,
        blockedByReservation: generated.slots.length - slots.length,
        error: '',
      };
    } catch (error) {
      return { slots: [], includedDays: 0, skippedPastSlots: 0, blockedByReservation: 0, error: error.message };
    }
  }, [slotForm, user, availabilitySlots]);

  const exerciseCorrections = useMemo(() => exerciseSubmissions.map((submission) => {
    const course = courseCatalog[submission.course_id];
    const exercise = course?.exercises?.find(
      (item) => String(item.id) === String(submission.exercise_id),
    );
    const learnerEmail = users.find((profile) => profile.id === submission.user_id)?.email || submission.user_id;
    const positioning = positioningAssessments.find((assessment) => (
      assessment.user_id === submission.user_id && assessment.course_id === submission.course_id
    ));
    const history = exerciseReviewHistory.filter((review) => (
      review.user_id === submission.user_id
      && review.course_id === submission.course_id
      && String(review.exercise_id) === String(submission.exercise_id)
    ));
    const currentSubmissionReview = history.find(
      (review) => String(review.response_id) === String(submission.id),
    ) || null;

    return {
      ...submission,
      learnerName: positioning?.learner_name || learnerEmail,
      learnerEmail,
      courseTitle: course?.title || COURSE_LABELS[submission.course_id] || submission.course_id,
      exerciseTitle: exercise?.title || `Exercice ${submission.exercise_id}`,
      history,
      latestReview: history[0] || null,
      currentSubmissionReview,
    };
  }), [exerciseReviewHistory, exerciseSubmissions, positioningAssessments, users]);

  const finalProjectEvaluations = useMemo(() => finalProjectSubmissions.map((submission) => {
    const course = courseCatalog[submission.course_id];
    const learnerProfile = users.find((profile) => profile.id === submission.user_id);
    const positioning = positioningAssessments.find((assessment) => (
      assessment.user_id === submission.user_id && assessment.course_id === submission.course_id
    ));
    const booking = bookingRequests.find((request) => (
      request.user_id === submission.user_id && request.course_id === submission.course_id
    ));
    const sessions = booking ? getBookingSessions(booking) : [];
    const history = finalProjectReviewHistory.filter((review) => (
      review.user_id === submission.user_id && review.course_id === submission.course_id
    ));
    const latestReview = history[0] || null;
    const currentSubmissionReview = history.find((review) => review.submission_id === submission.id) || null;
    const learnerEmail = learnerProfile?.email || submission.user_id;
    const learnerName = positioning?.learner_name || learnerEmail;

    return {
      ...submission,
      learnerName,
      learnerEmail,
      courseTitle: course?.title || COURSE_LABELS[submission.course_id] || submission.course_id,
      rubric: course?.finalProject?.rubric || [],
      rubricLevels: course?.finalProject?.rubricLevels || [],
      deliverables: (course?.finalProject?.submissionFields || []).map((field) => ({
        id: field.id,
        label: field.label,
        value: submission[field.id],
      })),
      history,
      latestReview,
      currentSubmissionReview,
      booking,
      attestationDossier: buildAttestationDossier({
        learnerName,
        learnerEmail,
        booking,
        sessions,
        attendanceRecords,
        finalReview: currentSubmissionReview,
      }),
    };
  }), [
    attendanceRecords,
    bookingRequests,
    finalProjectReviewHistory,
    finalProjectSubmissions,
    positioningAssessments,
    users,
  ]);

  const normalizedCorrectionSearch = normalizeAdministrativeSearch(correctionSearch);
  const pendingExerciseCorrections = useMemo(
    () => exerciseCorrections.filter((submission) => !submission.currentSubmissionReview),
    [exerciseCorrections],
  );
  const pendingFinalProjectEvaluations = useMemo(
    () => finalProjectEvaluations.filter((submission) => !submission.currentSubmissionReview),
    [finalProjectEvaluations],
  );
  const visibleExerciseCorrections = useMemo(() => {
    if (!normalizedCorrectionSearch) return pendingExerciseCorrections;
    return exerciseCorrections.filter((submission) => normalizeAdministrativeSearch([
      submission.learnerName,
      submission.learnerEmail,
      submission.courseTitle,
      submission.exerciseTitle,
      submission.response_text,
    ].join(' ')).includes(normalizedCorrectionSearch));
  }, [exerciseCorrections, normalizedCorrectionSearch, pendingExerciseCorrections]);
  const visibleFinalProjectEvaluations = useMemo(() => {
    if (!normalizedCorrectionSearch) return pendingFinalProjectEvaluations;
    return finalProjectEvaluations.filter((submission) => normalizeAdministrativeSearch([
      submission.learnerName,
      submission.learnerEmail,
      submission.courseTitle,
      submission.learner_note,
      ...submission.deliverables.map((deliverable) => deliverable.value),
    ].join(' ')).includes(normalizedCorrectionSearch));
  }, [finalProjectEvaluations, normalizedCorrectionSearch, pendingFinalProjectEvaluations]);
  const pendingPedagogicalWorkCount = pendingExerciseCorrections.length + pendingFinalProjectEvaluations.length;

  if (!user || (role !== 'admin' && role !== 'employee')) return null;

  const handleStatusChange = async (id, newStatus) => {
    const contact = contacts.find((item) => item.id === id);
    if (!contact) return;
    const { error } = await supabase.functions.invoke('admin-commercial-cycle', {
      body: {
        action: 'update_request',
        requestId: id,
        request: {
          status: newStatus,
          requestType: contact.request_type,
          courseId: contact.course_id,
          organizationName: contact.organization_name,
          beneficiaryName: contact.beneficiary_name,
          beneficiaryEmail: contact.beneficiary_email,
          fundingRequested: contact.funding_requested,
          administrativeNotes: contact.administrative_notes,
        },
      },
    });
      
    if (!error) {
      setContacts(contacts.map(c => c.id === id ? { ...c, status: newStatus } : c));
    }
  };

  const handleGrantCourse = async (learner) => {
    const courseId = selectedCourseByUser[learner.id];
    if (!courseId || role !== 'admin') return;

    const courseLabel = COURSE_LABELS[courseId] || courseId;
    const alreadyGranted = courseAccesses.some(
      (access) => access.user_id === learner.id
        && access.course_id === courseId
        && access.status === 'active'
        && (!access.expires_at || new Date(access.expires_at) > new Date()),
    );

    if (alreadyGranted) {
      setGrantFeedback({ type: 'info', message: `${learner.email} possède déjà cette formation.` });
      return;
    }

    const confirmed = window.confirm(
      `Offrir « ${courseLabel} » à ${learner.email} ?\n\nCette action donnera immédiatement accès à la formation sans paiement.`,
    );
    if (!confirmed) return;

    const actionKey = `${learner.id}:${courseId}`;
    setGrantingAccess(actionKey);
    setGrantFeedback(null);

    const { data, error } = await supabase.functions.invoke('admin-grant-course', {
      body: { targetUserId: learner.id, courseId },
    });

    if (error) {
      console.error("Erreur lors de l'attribution de la formation :", error);
      setGrantFeedback({
        type: 'error',
        message: "La formation n'a pas pu être attribuée. Vérifiez votre connexion puis réessayez.",
      });
    } else {
      if (data?.access) {
        setCourseAccesses((currentAccesses) => {
          const withoutDuplicate = currentAccesses.filter((access) => access.id !== data.access.id);
          return [data.access, ...withoutDuplicate];
        });
      }

      setGrantFeedback({
        type: data?.alreadyGranted ? 'info' : 'success',
        message: data?.alreadyGranted
          ? `${learner.email} possède déjà cette formation.`
          : `La formation « ${courseLabel} » a été offerte à ${learner.email}.`,
      });
    }

    setGrantingAccess('');
  };

  const handleAddAvailability = async (event) => {
    event.preventDefault();
    if (availabilityPreview.error) {
      setBookingError(availabilityPreview.error);
      return;
    }

    setBookingAction('add-slot');
    setBookingError('');
    setBookingFeedback('');
    const { data, error } = await supabase
      .from('training_availability_slots')
      .upsert(availabilityPreview.slots, {
        onConflict: 'starts_at,ends_at',
        ignoreDuplicates: true,
      })
      .select('id');

    if (error) {
      console.error("Ajout de disponibilité impossible :", error);
      setBookingError("Les disponibilités n'ont pas pu être ajoutées.");
    } else {
      const publishedCount = data?.length ?? 0;
      const duplicateCount = availabilityPreview.slots.length - publishedCount;
      setBookingFeedback(
        publishedCount === 0
          ? 'Toutes les demi-heures de cette période existaient déjà : aucun doublon n’a été créé.'
          : `${publishedCount} demi-heure${publishedCount > 1 ? 's' : ''} publiée${publishedCount > 1 ? 's' : ''}${duplicateCount > 0 ? `, ${duplicateCount} doublon${duplicateCount > 1 ? 's' : ''} ignoré${duplicateCount > 1 ? 's' : ''}` : ''}.`,
      );
      await fetchBookingManagement();
    }
    setBookingAction('');
  };

  const handleDeleteAvailability = async (slot) => {
    if (slot.is_reserved || !window.confirm(`Supprimer le créneau du ${formatBookingSlot(slot)} ?`)) return;
    setBookingAction(`slot:${slot.id}`);
    const { error } = await supabase.from('training_availability_slots').delete().eq('id', slot.id);
    if (error) {
      console.error('Suppression du créneau impossible :', error);
      setBookingError("Le créneau n'a pas pu être supprimé.");
    } else {
      await fetchBookingManagement();
    }
    setBookingAction('');
  };

  const handleBookingDecision = async (booking, action) => {
    const changes = {};
    if (action === 'approve') {
      changes.distance_status = 'approved';
      changes.status = ['two_2h', 'two_3h30', 'two_5h'].includes(booking.schedule_format) ? 'awaiting_travel_payment' : 'confirmed';
    } else if (action === 'reject') {
      changes.distance_status = 'rejected';
      changes.status = 'rejected';
    } else if (action === 'cancel') {
      changes.status = 'cancelled';
    } else if (action === 'complete') {
      changes.status = 'completed';
    } else {
      return;
    }

    const confirmationMessages = {
      approve: ['two_2h', 'two_3h30', 'two_5h'].includes(booking.schedule_format)
        ? "Valider la distance et demander la participation unique de 30 € ?"
        : 'Valider la distance et confirmer la séance ?',
      reject: 'Refuser cette demande et libérer les créneaux ?',
      cancel: 'Annuler la réservation et libérer les créneaux ?',
      complete: 'Marquer l’accompagnement comme réalisé ?',
    };
    if (!window.confirm(confirmationMessages[action])) return;

    setBookingError('');
    setBookingFeedback('');
    setBookingAction(`booking:${booking.id}`);
    const { data, error } = await supabase
      .from('course_booking_requests')
      .update(changes)
      .eq('id', booking.id)
      .select('id, status, distance_status')
      .single();
    if (error) {
      console.error('Mise à jour de la réservation impossible :', error);
      setBookingError("La réservation n'a pas pu être mise à jour. Rechargez la page puis réessayez.");
    } else {
      await fetchBookingManagement();
      const successMessages = {
        approve: data.status === 'confirmed'
          ? 'Distance validée : la réservation présentielle est maintenant confirmée.'
          : 'Distance validée : la participation déplacement de 30 € est maintenant attendue.',
        reject: 'Demande refusée et créneaux libérés.',
        cancel: 'Réservation annulée et créneaux libérés.',
        complete: 'Formation marquée comme réalisée.',
      };
      setBookingFeedback(successMessages[action]);
    }
    setBookingAction('');
  };

  const handleAttendanceDraftChange = (key, field, value) => {
    setAttendanceDrafts((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }));
  };

  const handleAttendanceAction = async (booking, session, action) => {
    const key = attendanceSessionKey(booking.id, session);
    const draft = attendanceDrafts[key] || {};
    const actionKey = `attendance:${key}:${action}`;

    if (action === 'validate' && !window.confirm('Enregistrer cette validation de présence dans le dossier Qualiopi ?')) return;

    setBookingAction(actionKey);
    setBookingError('');
    setBookingFeedback('');
    if (action === 'save_meeting_url') {
      setAttendanceSessionFeedbacks((current) => ({
        ...current,
        [key]: { type: 'pending', message: 'Enregistrement puis relecture du lien dans Supabase…' },
      }));
    }

    const actualEndsAt = draft.actual_ends_at
      ? new Date(draft.actual_ends_at).toISOString()
      : null;
    const { error } = await supabase.rpc('admin_manage_course_attendance', {
      p_booking_request_id: booking.id,
      p_session_starts_at: session.starts_at,
      p_session_ends_at: session.ends_at,
      p_action: action,
      p_meeting_url: draft.meeting_url || null,
      p_trainer_status: draft.trainer_status || null,
      p_actual_ends_at: actualEndsAt,
      p_trainer_note: draft.trainer_note || null,
      p_trainer_signature_base64: action === 'validate' ? draft.trainer_signature_base64 : null,
    });

    if (error) {
      console.error("Gestion de l'émargement impossible :", error);
      setBookingError(error.message || "L'action sur l'émargement n'a pas pu être enregistrée.");
      if (action === 'save_meeting_url') {
        setAttendanceSessionFeedbacks((current) => ({
          ...current,
          [key]: { type: 'error', message: `✗ Le lien n’a pas été enregistré : ${error.message || 'erreur Supabase.'}` },
        }));
      }
    } else {
      if (action === 'save_meeting_url') {
        const expectedUrl = draft.meeting_url?.trim() || null;
        const { data: verifiedAttendance, error: verificationError } = await supabase
          .from('course_session_attendance')
          .select('meeting_url, updated_at')
          .eq('booking_request_id', booking.id)
          .eq('session_starts_at', session.starts_at)
          .eq('session_ends_at', session.ends_at)
          .single();

        const isVerified = !verificationError && (verifiedAttendance?.meeting_url || null) === expectedUrl;
        if (!isVerified) {
          console.error('Vérification du lien de visioconférence impossible :', verificationError || verifiedAttendance);
          setAttendanceSessionFeedbacks((current) => ({
            ...current,
            [key]: { type: 'error', message: '✗ Le site ne peut pas confirmer la relecture du lien. Réessayez avant d’utiliser cette séance.' },
          }));
          setBookingError('Le lien a été envoyé mais sa relecture dans Supabase n’a pas pu être confirmée.');
          setBookingAction('');
          return;
        }

        setAttendanceSessionFeedbacks((current) => ({
          ...current,
          [key]: {
            type: 'success',
            message: expectedUrl
              ? `✓ Lien enregistré et relu dans Supabase le ${new Date(verifiedAttendance.updated_at).toLocaleString('fr-FR')}.`
              : `✓ Suppression du lien enregistrée et vérifiée le ${new Date(verifiedAttendance.updated_at).toLocaleString('fr-FR')}.`,
          },
        }));
      }

      const messages = {
        save_meeting_url: draft.meeting_url ? 'Lien de visioconférence enregistré pour cette séance.' : 'Lien de visioconférence retiré.',
        open_check_in: "L'émargement est ouvert immédiatement pour cette séance.",
        close_check_in: "L'émargement est fermé pour cette séance.",
        validate: 'Présence validée et ajoutée au dossier Qualiopi.',
      };
      setBookingFeedback(messages[action]);
      await fetchBookingManagement();
    }

    setBookingAction('');
  };

  const handleCorrectionDraftChange = (responseId, field, value) => {
    setCorrectionDrafts((current) => ({
      ...current,
      [responseId]: {
        feedbackText: '',
        reviewStatus: 'validated',
        ...current[responseId],
        [field]: value,
      },
    }));
    setCorrectionFeedbacks((current) => ({ ...current, [responseId]: null }));
  };

  const handleSaveExerciseCorrection = async (submission) => {
    const draft = correctionDrafts[submission.id] || {};
    const feedbackText = draft.feedbackText?.trim() || '';
    const reviewStatus = draft.reviewStatus || submission.latestReview?.review_status || 'validated';
    if (!feedbackText || !user || !correctionsAvailable) return;

    setCorrectionSaving(String(submission.id));
    setCorrectionFeedbacks((current) => ({
      ...current,
      [submission.id]: { type: 'pending', message: 'Enregistrement de la correction…' },
    }));

    const { error } = await supabase
      .from('course_exercise_reviews')
      .insert({
        response_id: submission.id,
        reviewer_id: user.id,
        feedback_text: feedbackText,
        review_status: reviewStatus,
      });

    if (error) {
      console.error("Enregistrement de la correction impossible :", error);
      setCorrectionFeedbacks((current) => ({
        ...current,
        [submission.id]: {
          type: 'error',
          message: "La correction n'a pas été enregistrée. Réessayez dans quelques instants.",
        },
      }));
      setCorrectionSaving('');
      return;
    }

    await fetchCourseCorrections();
    setCorrectionDrafts((current) => ({
      ...current,
      [submission.id]: { feedbackText: '', reviewStatus },
    }));
    setCorrectionFeedbacks((current) => ({
      ...current,
      [submission.id]: {
        type: 'success',
        message: 'Correction enregistrée. Elle est maintenant visible par l’apprenant.',
      },
    }));
    setCorrectionSaving('');
  };

  const handleFinalProjectReviewDraftChange = (submissionId, field, value) => {
    setFinalProjectReviewDrafts((current) => ({
      ...current,
      [submissionId]: {
        appreciation: '',
        improvement_areas: '',
        ...current[submissionId],
        [field]: value,
      },
    }));
    setFinalProjectReviewFeedbacks((current) => ({ ...current, [submissionId]: null }));
  };

  const handleSaveFinalProjectReview = async (submission) => {
    const draft = finalProjectReviewDrafts[submission.id] || {};
    const levelValues = FINAL_PROJECT_REVIEW_FIELDS.map(({ column }) => (
      draft[column] || submission.currentSubmissionReview?.[column] || ''
    ));
    const reviewStatus = calculateFinalProjectReviewStatus(levelValues);
    const appreciation = draft.appreciation?.trim() || '';
    const improvementAreas = draft.improvement_areas?.trim() || '';

    if (!reviewStatus || !appreciation || !improvementAreas || !user || !finalProjectReviewsAvailable) return;

    setFinalProjectReviewSaving(String(submission.id));
    setFinalProjectReviewFeedbacks((current) => ({
      ...current,
      [submission.id]: { type: 'pending', message: 'Enregistrement de l’évaluation finale…' },
    }));

    const levels = Object.fromEntries(
      FINAL_PROJECT_REVIEW_FIELDS.map(({ column }, index) => [column, levelValues[index]]),
    );
    const { error } = await supabase
      .from('course_final_project_reviews')
      .insert({
        submission_id: submission.id,
        reviewer_id: user.id,
        ...levels,
        appreciation,
        improvement_areas: improvementAreas,
        review_status: reviewStatus,
      });

    if (error) {
      console.error("Enregistrement de l'évaluation finale impossible :", error);
      setFinalProjectReviewFeedbacks((current) => ({
        ...current,
        [submission.id]: {
          type: 'error',
          message: "L’évaluation n'a pas été enregistrée. Réessayez dans quelques instants.",
        },
      }));
      setFinalProjectReviewSaving('');
      return;
    }

    await fetchFinalProjectReviews();
    setFinalProjectReviewDrafts((current) => ({
      ...current,
      [submission.id]: { appreciation: '', improvement_areas: '' },
    }));
    setFinalProjectReviewFeedbacks((current) => ({
      ...current,
      [submission.id]: {
        type: 'success',
        message: 'Évaluation enregistrée. Le résultat est maintenant visible par l’apprenant.',
      },
    }));
    setFinalProjectReviewSaving('');
  };

  const handleTogglePublishSurvey = async (id, currentStatus) => {
    const { error } = await supabase
      .from('satisfaction_surveys')
      .update({ is_published: !currentStatus })
      .eq('id', id);
      
    if (!error) {
      setSurveys(surveys.map(s => s.id === id ? { ...s, is_published: !currentStatus } : s));
    }
  };

  const generateSlug = (text) => {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w-]+/g, '')        // Remove all non-word chars
      .replace(/--+/g, '-')            // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  };

  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) {
      alert("Le titre et le contenu sont obligatoires.");
      return;
    }

    setIsUploading(true);
    let imageUrl = newPost.image_url || null;

    if (imageFile) {
      const fileExt = BLOG_IMAGE_EXTENSIONS[imageFile.type];

      if (!fileExt) {
        alert('Format non autorisé. Utilisez une image JPEG, PNG ou WebP.');
        setIsUploading(false);
        return;
      }

      if (imageFile.size > MAX_BLOG_IMAGE_SIZE) {
        alert("L'image dépasse 5 Mo. Réduisez sa taille avant de la publier.");
        setIsUploading(false);
        return;
      }

      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error("Erreur d'upload :", uploadError);
        alert("Erreur lors de l'importation de l'image.");
        setIsUploading(false);
        return;
      }

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      imageUrl = data.publicUrl;
    }

    const postData = {
      title: newPost.title,
      slug: generateSlug(newPost.slug || newPost.title),
      category: newPost.category || 'Général',
      excerpt: newPost.excerpt,
      seo_title: newPost.seo_title || null,
      meta_description: newPost.meta_description || null,
      image_alt: newPost.image_alt || null,
      content: newPost.content,
      image_url: imageUrl,
      author: 'Thierry FREZARD'
    };

    if (editingPostId) {
      const { data: updatedPost, error } = await supabase
        .from('blog_posts')
        .update(postData)
        .eq('id', editingPostId)
        .select();

      if (error) {
        console.error("Erreur de mise à jour :", error);
        alert("Erreur lors de la modification de l'article.");
      } else if (updatedPost) {
        setBlogPosts(blogPosts.map(p => p.id === editingPostId ? updatedPost[0] : p));
        resetForm();
      }
    } else {
      const { data: insertedPost, error } = await supabase
        .from('blog_posts')
        .insert([postData])
        .select();

      if (error) {
        console.error("Erreur de création :", error);
        alert("Erreur lors de la création de l'article.");
      } else if (insertedPost) {
        setBlogPosts([insertedPost[0], ...blogPosts]);
        resetForm();
      }
    }
    
    setIsUploading(false);
  };

  const resetForm = () => {
    setIsAddingPost(false);
    setEditingPostId(null);
    setNewPost({
      title: '',
      slug: '',
      category: '',
      excerpt: '',
      seo_title: '',
      meta_description: '',
      image_alt: '',
      content: '',
    });
    setImageFile(null);
  };

  const handleEditPost = (post) => {
    setNewPost({
      title: post.title || '',
      slug: post.slug || '',
      category: post.category || '',
      excerpt: post.excerpt || '',
      seo_title: post.seo_title || '',
      meta_description: post.meta_description || '',
      image_alt: post.image_alt || '',
      content: post.content || '',
      image_url: post.image_url || null,
    });
    setEditingPostId(post.id);
    setIsAddingPost(true);
  };

  const handleDeletePost = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer cet article ?")) {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (!error) {
        setBlogPosts(blogPosts.filter(p => p.id !== id));
      }
    }
  };

  return (
    <div className="container admin-dashboard" style={{ padding: '4rem 1rem', minHeight: '80vh' }}>
      <h1 className="admin-dashboard__title">
        <span className="admin-dashboard__title-icon" aria-hidden="true">⚙️</span>
        <span className="admin-dashboard__title-text">Panneau d'Administration</span>
      </h1>

      <div className="admin-dashboard__quick-actions" aria-label="Outils du formateur">
        <button
          type="button"
          onClick={() => navigate('/admin/dossiers')}
          className="btn btn-primary"
        >
          Dossiers OF / OPCO
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin/emargements')}
          className="btn btn-primary"
        >
          Feuilles d’émargement
        </button>
        {role === 'admin' && (
          <>
            <button
              type="button"
              onClick={() => navigate('/admin/acces-incidents')}
              className="btn btn-primary"
            >
              Accès & incidents
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/demandes-rgpd')}
              className="btn btn-primary"
            >
              Demandes RGPD
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : ''}`}
          style={activeTab !== 'overview' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Vue d'ensemble
        </button>
        <button 
          onClick={() => setActiveTab('users')} 
          className={`btn ${activeTab === 'users' ? 'btn-primary' : ''}`}
          style={activeTab !== 'users' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Clients & Inscriptions
        </button>
        <button 
          onClick={() => setActiveTab('contacts')} 
          className={`btn ${activeTab === 'contacts' ? 'btn-primary' : ''}`}
          style={activeTab !== 'contacts' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Demandes de Devis
        </button>
        <button 
          onClick={() => setActiveTab('blog')} 
          className={`btn ${activeTab === 'blog' ? 'btn-primary' : ''}`}
          style={activeTab !== 'blog' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Blog & Actualités
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`btn ${activeTab === 'purchases' ? 'btn-primary' : ''}`}
          style={activeTab !== 'purchases' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Achats, accès & appels
        </button>
        <button
          onClick={() => setActiveTab('bookings')}
          className={`btn ${activeTab === 'bookings' ? 'btn-primary' : ''}`}
          style={activeTab !== 'bookings' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Séances & disponibilités
        </button>
        <button
          onClick={() => setActiveTab('positioning')}
          className={`btn ${activeTab === 'positioning' ? 'btn-primary' : ''}`}
          style={activeTab !== 'positioning' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Positionnements
        </button>
        <button
          onClick={() => setActiveTab('corrections')}
          className={`btn ${activeTab === 'corrections' ? 'btn-primary' : ''}`}
          style={activeTab !== 'corrections' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Corrections & évaluations
          {pendingPedagogicalWorkCount > 0
            ? ` (${pendingPedagogicalWorkCount})`
            : ''}
        </button>
        <button
          onClick={() => setActiveTab('trainer-guides')}
          className={`btn ${activeTab === 'trainer-guides' ? 'btn-primary' : ''}`}
          style={activeTab !== 'trainer-guides' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Guides formateur ({TRAINER_GUIDES.length})
        </button>
        <button 
          onClick={() => setActiveTab('feedback')} 
          className={`btn ${activeTab === 'feedback' ? 'btn-primary' : ''}`}
          style={activeTab !== 'feedback' ? { background: '#2a2a2a', border: '1px solid #444', color: '#fff' } : {}}
        >
          Avis & Qualiopi
        </button>
      </div>

      <div className="admin-dashboard__panel" style={{ background: '#1e1e1e', padding: '2rem', borderRadius: '12px', border: '1px solid #333' }}>
        {loading ? (
          <p>Chargement des données...</p>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
                  <h3 style={{ color: '#aaa', fontSize: '1rem' }}>Total Utilisateurs</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0' }}>{users.length}</p>
                </div>
                <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
                  <h3 style={{ color: '#aaa', fontSize: '1rem' }}>Demandes en attente</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#f59e0b' }}>
                    {contacts.filter(c => c.status === 'pending').length}
                  </p>
                </div>
                <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
                  <h3 style={{ color: '#aaa', fontSize: '1rem' }}>Articles de blog</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: 'var(--color-primary)' }}>
                    {blogPosts.length}
                  </p>
                </div>
                <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
                  <h3 style={{ color: '#aaa', fontSize: '1rem' }}>Accès enregistrés</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#60a5fa' }}>
                    {purchases.length}
                  </p>
                </div>
                <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
                  <h3 style={{ color: '#aaa', fontSize: '1rem' }}>Tests de positionnement</h3>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#2dd4bf' }}>
                    {positioningAssessments.length}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'trainer-guides' && (
              <section className="trainer-guides-section" aria-labelledby="trainer-guides-title">
                <header className="trainer-guides-heading">
                  <div>
                    <p className="trainer-guides-kicker">Documents internes</p>
                    <h2 id="trainer-guides-title">Guides formateur</h2>
                  </div>
                  <span>{TRAINER_GUIDES.length} guides disponibles</span>
                </header>
                <p className="trainer-guides-intro">
                  Retrouvez ici les déroulés, réponses attendues, adaptations et preuves à conserver pour chaque formation.
                  Ces documents ne doivent contenir aucune donnée personnelle d’apprenant.
                </p>
                <div className="trainer-guides-grid">
                  {TRAINER_GUIDES.map((guide) => (
                    <article className="trainer-guide-card" key={guide.id}>
                      <div>
                        <h3>{guide.title}</h3>
                        <p>{guide.description}</p>
                      </div>
                      <TrainerGuideLink guide={guide} />
                    </article>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'users' && (
              <div>
                <h2 style={{ marginBottom: '0.5rem' }}>Liste des clients</h2>
                {role === 'admin' && (
                  <p style={{ color: '#aaa', margin: '0 0 1.5rem' }}>
                    Sélectionnez une formation pour l'offrir immédiatement à un apprenant inscrit.
                  </p>
                )}
                {grantFeedback && (
                  <div
                    role={grantFeedback.type === 'error' ? 'alert' : 'status'}
                    style={{
                      padding: '1rem',
                      marginBottom: '1.25rem',
                      borderRadius: '8px',
                      color: grantFeedback.type === 'error' ? '#fecaca' : '#d1fae5',
                      background: grantFeedback.type === 'error' ? '#3f1d24' : '#123c32',
                      border: `1px solid ${grantFeedback.type === 'error' ? '#f87171' : '#34d399'}`,
                    }}
                  >
                    {grantFeedback.message}
                  </div>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #444', color: '#aaa' }}>
                        <th style={{ padding: '1rem' }}>Email</th>
                        <th style={{ padding: '1rem' }}>Rôle</th>
                        <th style={{ padding: '1rem' }}>Date d'inscription</th>
                        {role === 'admin' && <th style={{ padding: '1rem' }}>Offrir une formation</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #333' }}>
                          <td style={{ padding: '1rem' }}>{u.email}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', background: u.role === 'admin' ? '#ef4444' : '#3b82f6', color: '#fff' }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', color: '#aaa' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                          {role === 'admin' && (
                            <td style={{ padding: '1rem', minWidth: '340px' }}>
                              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <label
                                  htmlFor={`gift-course-${u.id}`}
                                  style={{
                                    position: 'absolute',
                                    width: '1px',
                                    height: '1px',
                                    padding: 0,
                                    margin: '-1px',
                                    overflow: 'hidden',
                                    clip: 'rect(0, 0, 0, 0)',
                                    whiteSpace: 'nowrap',
                                    border: 0,
                                  }}
                                >
                                  Formation à offrir à {u.email}
                                </label>
                                <select
                                  id={`gift-course-${u.id}`}
                                  value={selectedCourseByUser[u.id] || ''}
                                  onChange={(event) => {
                                    setSelectedCourseByUser((current) => ({
                                      ...current,
                                      [u.id]: event.target.value,
                                    }));
                                    setGrantFeedback(null);
                                  }}
                                  style={{
                                    flex: '1 1 210px',
                                    padding: '0.65rem',
                                    borderRadius: '6px',
                                    border: '1px solid #555',
                                    background: '#161616',
                                    color: '#fff',
                                  }}
                                >
                                  <option value="">Choisir une formation</option>
                                  {COURSE_OPTIONS.map((course) => {
                                    const learnerHasAccess = courseAccesses.some(
                                      (access) => access.user_id === u.id
                                        && access.course_id === course.id
                                        && access.status === 'active'
                                        && (!access.expires_at || new Date(access.expires_at) > new Date()),
                                    );
                                    return (
                                      <option key={course.id} value={course.id} disabled={learnerHasAccess}>
                                        {course.label}{learnerHasAccess ? ' — déjà accessible' : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={
                                    !selectedCourseByUser[u.id]
                                    || Boolean(grantingAccess)
                                    || courseAccesses.some(
                                      (access) => access.user_id === u.id
                                        && access.course_id === selectedCourseByUser[u.id]
                                        && access.status === 'active'
                                        && (!access.expires_at || new Date(access.expires_at) > new Date()),
                                    )
                                  }
                                  onClick={() => handleGrantCourse(u)}
                                  style={{ whiteSpace: 'nowrap' }}
                                >
                                  {grantingAccess === `${u.id}:${selectedCourseByUser[u.id]}` ? 'Attribution…' : 'Offrir'}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Demandes de Devis et Contacts</h2>
                <p style={{ marginBottom: '1.5rem' }}>
                  <Link className="btn btn-primary" to="/admin/commercial">
                    Ouvrir le cycle commercial complet
                  </Link>
                  {' '}
                  <Link className="btn" to="/admin/stripe-apres-paiement">
                    Ouvrir Stripe après paiement
                  </Link>
                </p>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {contacts.length === 0 ? (
                    <p style={{ color: '#888' }}>Aucune demande pour le moment.</p>
                  ) : (
                    contacts.map(c => (
                      <div key={c.id} style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: `1px solid ${c.status === 'new' ? '#f59e0b' : '#444'}`, position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div>
                            <h3 style={{ margin: '0 0 0.25rem 0' }}>{c.name} <span style={{ color: '#aaa', fontSize: '1rem', fontWeight: 'normal' }}>({c.email})</span></h3>
                            <p style={{ color: '#93c5fd', fontWeight: 'bold', margin: 0 }}>Sujet: {c.subject}</p>
                            <p style={{ fontSize: '0.85rem', color: '#b6bbc4', marginTop: '0.25rem' }}>{new Date(c.created_at).toLocaleString()}</p>
                          </div>
                          <div>
                            {c.status === 'new' ? (
                              <button onClick={() => handleStatusChange(c.id, 'processing')} style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                Prendre en traitement
                              </button>
                            ) : (
                              <span style={{ color: '#aaa' }}>{c.status}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ background: '#1e1e1e', padding: '1rem', borderRadius: '6px', color: '#ddd', whiteSpace: 'pre-wrap' }}>
                          {c.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'blog' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>Gestion du Blog</h2>
                  <button 
                    onClick={() => {
                      if (isAddingPost) resetForm();
                      else setIsAddingPost(true);
                    }} 
                    className="btn btn-primary"
                  >
                    {isAddingPost ? "Annuler" : "+ Nouvel Article"}
                  </button>
                </div>

                {isAddingPost ? (
                  <div style={{ background: '#2a2a2a', padding: '2rem', borderRadius: '8px', border: '1px solid #444', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>{editingPostId ? "Modifier l'article" : "Rédiger un nouvel article"}</h3>
                    <form onSubmit={handleSavePost}>
                      <div className="form-group">
                        <label>Image d'en-tête (Optionnel)</label>
                        <input 
                          type="file" 
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => setImageFile(e.target.files[0])}
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.5rem', width: '100%', borderRadius: '4px' }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Titre de l'article *</label>
                        <input 
                          type="text" 
                          value={newPost.title} 
                          onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                          required 
                          placeholder="Ex: Les 5 avantages de l'IA..."
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444' }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Adresse de l'article (slug)</label>
                        <input
                          type="text"
                          value={newPost.slug}
                          onChange={(e) => setNewPost({...newPost, slug: e.target.value})}
                          placeholder="Ex: meilleur-generateur-prompts-comparatif-2026"
                          aria-describedby="blog-slug-help"
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444' }}
                        />
                        <small id="blog-slug-help" style={{ display: 'block', color: '#aaa', marginTop: '0.5rem' }}>
                          Laissez vide pour créer automatiquement l'adresse à partir du titre.
                        </small>
                      </div>
                      <div className="form-group">
                        <label>Catégorie</label>
                        <input 
                          type="text" 
                          value={newPost.category} 
                          onChange={(e) => setNewPost({...newPost, category: e.target.value})}
                          placeholder="Ex: IA Générative"
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444' }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Résumé (S'affiche sur la liste des articles)</label>
                        <textarea 
                          value={newPost.excerpt} 
                          onChange={(e) => setNewPost({...newPost, excerpt: e.target.value})}
                          rows="3"
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444' }}
                        ></textarea>
                      </div>
                      <div className="form-group">
                        <label>Titre SEO</label>
                        <input
                          type="text"
                          value={newPost.seo_title}
                          onChange={(e) => setNewPost({...newPost, seo_title: e.target.value})}
                          placeholder="Titre concis pour les moteurs de recherche"
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444' }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Méta-description</label>
                        <textarea
                          value={newPost.meta_description}
                          onChange={(e) => setNewPost({...newPost, meta_description: e.target.value})}
                          rows="3"
                          placeholder="Description affichée dans les résultats de recherche et les aperçus de partage"
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444' }}
                        ></textarea>
                      </div>
                      <div className="form-group">
                        <label>Texte alternatif de l'image</label>
                        <textarea
                          value={newPost.image_alt}
                          onChange={(e) => setNewPost({...newPost, image_alt: e.target.value})}
                          rows="2"
                          placeholder="Décrivez le contenu utile de l'image pour les personnes qui ne la voient pas"
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444' }}
                        ></textarea>
                      </div>
                      <div className="form-group">
                        <label>Contenu complet (Format Markdown autorisé)</label>
                        <small style={{ display: 'block', color: '#aaa', marginBottom: '0.5rem' }}>
                          Astuce : Utilisez **texte** pour le gras, # Titre pour un grand titre, et - pour des puces.
                        </small>
                        <textarea 
                          value={newPost.content} 
                          onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                          required
                          rows="15"
                          style={{ background: '#1e1e1e', color: 'white', padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #444', fontFamily: 'monospace' }}
                        ></textarea>
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={isUploading} style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
                        {isUploading ? "Publication en cours..." : "Publier l'article"}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {blogPosts.length === 0 ? (
                      <p style={{ color: '#888' }}>Aucun article publié. Créez votre premier article !</p>
                    ) : (
                      blogPosts.map(post => (
                        <div key={post.id} style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {post.image_url ? (
                              <img src={post.image_url} alt="miniature" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                            ) : (
                              <div style={{ width: '80px', height: '80px', background: '#1e1e1e', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                                Sans image
                              </div>
                            )}
                            <div>
                              <h3 style={{ margin: '0 0 0.5rem 0' }}>{post.title}</h3>
                              <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem' }}>Publié le {new Date(post.created_at).toLocaleDateString()} • {post.category}</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => handleEditPost(post)} 
                              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Modifier
                            </button>
                            <button 
                              onClick={() => handleDeletePost(post.id)} 
                              style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bookings' && (
              <div>
                <div className="booking-workspace-heading">
                  <h2>Organisation des formations synchrones</h2>
                  <p style={{ color: '#aaa', margin: 0 }}>
                    Séparez le suivi administratif des séances de la publication de votre calendrier.
                  </p>
                </div>

                <div className="booking-workspace-tabs" role="tablist" aria-label="Gestion des séances et disponibilités">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={bookingWorkspaceTab === 'sessions'}
                    className={bookingWorkspaceTab === 'sessions' ? 'is-active' : ''}
                    onClick={() => setBookingWorkspaceTab('sessions')}
                  >
                    Suivi des séances
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={bookingWorkspaceTab === 'availability'}
                    className={bookingWorkspaceTab === 'availability' ? 'is-active' : ''}
                    onClick={() => setBookingWorkspaceTab('availability')}
                  >
                    Mes disponibilités
                  </button>
                </div>

                {bookingError && (
                  <div role="alert" style={{ padding: '1rem', marginBottom: '1.5rem', color: '#fecaca', background: '#3f1d24', border: '1px solid #f87171', borderRadius: '8px' }}>
                    {bookingError}
                  </div>
                )}

                {bookingFeedback && (
                  <div role="status" className="availability-feedback">
                    {bookingFeedback}
                  </div>
                )}

                {bookingWorkspaceTab === 'sessions' && (
                  <BookingRequestsSection
                    bookingRequests={bookingRequests}
                    positioningAssessments={positioningAssessments}
                    attendanceRecords={attendanceRecords}
                    attendanceDrafts={attendanceDrafts}
                    attendanceSessionFeedbacks={attendanceSessionFeedbacks}
                    bookingAction={bookingAction}
                    onAttendanceDraftChange={handleAttendanceDraftChange}
                    onAttendanceAction={handleAttendanceAction}
                    onDecision={handleBookingDecision}
                  />
                )}

                {bookingWorkspaceTab === 'availability' && (
                  <>
                <form onSubmit={handleAddAvailability} className="availability-range-form">
                  <div className="availability-range-heading">
                    <h3>Créer une série de disponibilités</h3>
                    <p>Indiquez une période et vos horaires habituels. Le site compose ensuite automatiquement les séances demandées par les apprenants.</p>
                  </div>

                  <div className="availability-range-grid">
                    <VisibleDateField
                      id="availability-from-date"
                      label="Disponible du"
                      min={formatDateInput(new Date())}
                      value={slotForm.fromDate}
                      onChange={(event) => setSlotForm({ ...slotForm, fromDate: event.target.value })}
                    />

                    <VisibleDateField
                      id="availability-to-date"
                      label="Jusqu’au"
                      min={slotForm.fromDate || formatDateInput(new Date())}
                      value={slotForm.toDate}
                      onChange={(event) => setSlotForm({ ...slotForm, toDate: event.target.value })}
                    />

                  <label>
                    Début de journée
                    <input type="time" required value={slotForm.dayStart} onChange={(event) => setSlotForm({ ...slotForm, dayStart: event.target.value })} />
                  </label>

                  <label>
                    Fin de journée
                    <input type="time" required value={slotForm.dayEnd} onChange={(event) => setSlotForm({ ...slotForm, dayEnd: event.target.value })} />
                  </label>

                  <label>
                    Début de la pause déjeuner (1 h)
                    <input type="time" required value={slotForm.lunchStart} onChange={(event) => setSlotForm({ ...slotForm, lunchStart: event.target.value })} />
                  </label>

                  <label>
                    Modalité possible
                    <select value={slotForm.mode} onChange={(event) => setSlotForm({ ...slotForm, mode: event.target.value })}>
                      <option value="both">Distanciel ou présentiel</option>
                      <option value="remote">Distanciel uniquement</option>
                      <option value="in_person">Présentiel uniquement</option>
                    </select>
                  </label>

                  <label className="availability-note-field">
                    Note interne facultative
                    <input value={slotForm.notes} maxLength="500" onChange={(event) => setSlotForm({ ...slotForm, notes: event.target.value })} placeholder="Ex. créneaux de rentrée" />
                  </label>
                  </div>

                  <fieldset className="availability-day-options">
                    <legend>Jours à publier</legend>
                    <label className="availability-checkbox">
                      <input type="checkbox" checked={slotForm.includeSaturday} onChange={(event) => setSlotForm({ ...slotForm, includeSaturday: event.target.checked })} />
                      Inclure les samedis
                    </label>
                    <label className="availability-checkbox">
                      <input type="checkbox" checked={slotForm.excludeHolidays} onChange={(event) => setSlotForm({ ...slotForm, excludeHolidays: event.target.checked })} />
                      Exclure les jours fériés
                    </label>
                    <p>Les dimanches sont toujours exclus.</p>
                  </fieldset>

                  <div className={`availability-preview ${availabilityPreview.error ? 'availability-preview--error' : ''}`} role="status">
                    {availabilityPreview.error ? (
                      availabilityPreview.error
                    ) : (
                      <>
                        <strong>
                          {availabilityPreview.slots.length} demi-heure{availabilityPreview.slots.length > 1 ? 's' : ''} disponible{availabilityPreview.slots.length > 1 ? 's' : ''} {availabilityPreview.slots.length > 1 ? 'seront publiées' : 'sera publiée'}
                        </strong>
                        <span> sur {availabilityPreview.includedDays} jour{availabilityPreview.includedDays > 1 ? 's' : ''} retenu{availabilityPreview.includedDays > 1 ? 's' : ''}.</span>
                        {availabilityPreview.blockedByReservation > 0 && (
                          <span> {availabilityPreview.blockedByReservation} demi-heure{availabilityPreview.blockedByReservation > 1 ? 's' : ''} déjà réservée{availabilityPreview.blockedByReservation > 1 ? 's' : ''} ne {availabilityPreview.blockedByReservation > 1 ? 'seront' : 'sera'} pas republiée{availabilityPreview.blockedByReservation > 1 ? 's' : ''}.</span>
                        )}
                      </>
                    )}
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={bookingAction === 'add-slot'}>
                    {bookingAction === 'add-slot' ? 'Publication…' : 'Publier ces disponibilités'}
                  </button>
                </form>

                <section style={{ marginBottom: '2.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Créneaux publiés</h3>
                  {availabilitySlots.length === 0 ? (
                    <p style={{ color: '#888' }}>Aucune disponibilité publiée.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {availabilitySlots.map((slot) => (
                        <article key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '1rem', background: '#2a2a2a', border: '1px solid #444', borderRadius: '8px' }}>
                          <div>
                            <strong>{formatBookingSlot(slot)}</strong>
                            <p style={{ margin: '0.25rem 0 0', color: '#aaa' }}>
                              {slot.delivery_modes.includes('remote') ? 'Distanciel' : ''}
                              {slot.delivery_modes.length === 2 ? ' ou ' : ''}
                              {slot.delivery_modes.includes('in_person') ? 'Présentiel' : ''}
                              {slot.notes ? ` · ${slot.notes}` : ''}
                            </p>
                          </div>
                          <span style={{ color: slot.is_reserved ? '#fbbf24' : slot.is_active ? '#6ee7b7' : '#aaa' }}>
                            {slot.is_reserved ? 'Réservé' : slot.is_active ? 'Disponible' : 'Masqué'}
                          </span>
                          <button type="button" className="btn" disabled={slot.is_reserved || bookingAction === `slot:${slot.id}`} onClick={() => handleDeleteAvailability(slot)} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#fca5a5' }}>
                            Supprimer
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                  </>
                )}

              </div>
            )}

            {activeTab === 'corrections' && (
              <section className="exercise-corrections" aria-labelledby="correction-workspace-title">
                <div className="booking-workspace-heading">
                  <h2 id="correction-workspace-title">Corrections et évaluations</h2>
                  <p>
                    Traitez les nouvelles remises. Les éléments déjà corrigés sont masqués et restent accessibles par
                    la recherche.
                  </p>
                </div>

                <div className="booking-workspace-tabs correction-workspace-tabs" role="tablist" aria-label="Corrections et évaluations pédagogiques">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={correctionWorkspaceTab === 'exercises'}
                    aria-controls="exercise-corrections-panel"
                    className={correctionWorkspaceTab === 'exercises' ? 'is-active' : ''}
                    onClick={() => setCorrectionWorkspaceTab('exercises')}
                  >
                    Corrections des exercices ({pendingExerciseCorrections.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={correctionWorkspaceTab === 'evaluations'}
                    aria-controls="final-project-evaluations-panel"
                    className={correctionWorkspaceTab === 'evaluations' ? 'is-active' : ''}
                    onClick={() => setCorrectionWorkspaceTab('evaluations')}
                  >
                    Évaluations finales ({pendingFinalProjectEvaluations.length})
                  </button>
                </div>

                <div className="correction-workspace-search">
                  <label htmlFor="correction-workspace-search">
                    Rechercher dans les {correctionWorkspaceTab === 'exercises' ? 'corrections' : 'évaluations'}
                    <input
                      id="correction-workspace-search"
                      type="search"
                      placeholder={correctionWorkspaceTab === 'exercises'
                        ? 'Nom, e-mail, formation ou exercice…'
                        : 'Nom, e-mail ou formation…'}
                      value={correctionSearch}
                      onChange={(event) => setCorrectionSearch(event.target.value)}
                    />
                  </label>
                  <div className="correction-workspace-search__status" role="status">
                    <p>
                      {normalizedCorrectionSearch
                        ? `La recherche inclut les éléments à traiter et ceux déjà terminés.`
                        : 'Seuls les éléments à traiter sont affichés. Utilisez la recherche pour retrouver un historique.'}
                    </p>
                    {normalizedCorrectionSearch && (
                      <button type="button" onClick={() => setCorrectionSearch('')}>Effacer la recherche</button>
                    )}
                  </div>
                </div>

                {correctionWorkspaceTab === 'evaluations' && (
                <section id="final-project-evaluations-panel" role="tabpanel" className="final-project-evaluations" aria-labelledby="final-project-evaluations-title">
                  <div className="exercise-corrections-heading">
                    <div>
                      <h2 id="final-project-evaluations-title">Évaluations finales</h2>
                      <p>
                        Évaluez la dernière remise avec la grille présentée à l’apprenant. La décision est calculée
                        automatiquement : les quatre critères doivent atteindre au minimum « Acquis ».
                      </p>
                    </div>
                    <span>
                      {visibleFinalProjectEvaluations.length} remise{visibleFinalProjectEvaluations.length !== 1 ? 's' : ''}{' '}
                      {normalizedCorrectionSearch
                        ? `trouvée${visibleFinalProjectEvaluations.length !== 1 ? 's' : ''}`
                        : 'à traiter'}
                    </span>
                  </div>

                  {!finalProjectReviewsAvailable ? (
                    <div className="exercise-corrections-notice" role="status">
                      Le poste d’évaluation finale est prêt dans le site. Il sera utilisable après l’activation de la
                      migration Supabase dédiée.
                    </div>
                  ) : finalProjectReviewsError ? (
                    <div className="exercise-corrections-notice is-error" role="alert">{finalProjectReviewsError}</div>
                  ) : visibleFinalProjectEvaluations.length === 0 ? (
                    <div className="exercise-corrections-empty">
                      <h3>{normalizedCorrectionSearch ? 'Aucune évaluation trouvée' : 'Toutes les évaluations sont à jour'}</h3>
                      <p>
                        {normalizedCorrectionSearch
                          ? 'Modifiez la recherche pour retrouver une autre remise.'
                          : 'Une nouvelle remise apparaîtra ici automatiquement. Les évaluations terminées restent accessibles par recherche.'}
                      </p>
                    </div>
                  ) : (
                    <div className="final-project-evaluation-list">
                      {visibleFinalProjectEvaluations.map((submission) => {
                        const draft = finalProjectReviewDrafts[submission.id] || {};
                        const feedback = finalProjectReviewFeedbacks[submission.id];
                        const isSaving = finalProjectReviewSaving === String(submission.id);
                        const selectedLevels = FINAL_PROJECT_REVIEW_FIELDS.map(({ column }) => (
                          draft[column] || submission.currentSubmissionReview?.[column] || ''
                        ));
                        const calculatedStatus = calculateFinalProjectReviewStatus(selectedLevels);

                        return (
                          <article key={submission.id} className="final-project-evaluation-card">
                            <header className="exercise-correction-card__header">
                              <div>
                                <p className="exercise-correction-card__learner">{submission.learnerName}</p>
                                {submission.learnerName !== submission.learnerEmail && <p>{submission.learnerEmail}</p>}
                                <h3>{submission.courseTitle}</h3>
                                <p>Cas pratique final</p>
                              </div>
                              <div className="exercise-correction-card__status">
                                {submission.currentSubmissionReview ? (
                                  <span className={`is-${submission.currentSubmissionReview.review_status}`}>
                                    {FINAL_PROJECT_REVIEW_STATUS_LABELS[submission.currentSubmissionReview.review_status]}
                                  </span>
                                ) : (
                                  <span className="is-pending">À évaluer</span>
                                )}
                                <small>Remise du {new Date(submission.saved_at).toLocaleString('fr-FR')}</small>
                              </div>
                            </header>

                            <section className="final-project-evaluation-deliverables" aria-label="Livrables remis par l’apprenant">
                              <h4>Livrables remis</h4>
                              <dl>
                                {submission.deliverables.map((deliverable) => (
                                  <div key={deliverable.id}>
                                    <dt>{deliverable.label}</dt>
                                    <dd>{deliverable.value}</dd>
                                  </div>
                                ))}
                              </dl>
                              {submission.learner_note && (
                                <aside>
                                  <strong>Message de l’apprenant</strong>
                                  <p>{submission.learner_note}</p>
                                </aside>
                              )}
                            </section>

                            {submission.currentSubmissionReview && (
                              <section className="final-project-evaluation-latest" aria-label="Dernière évaluation de cette remise">
                                <h4>Dernière évaluation de cette remise</h4>
                                <p>{submission.currentSubmissionReview.appreciation}</p>
                                <strong>Axes de progrès</strong>
                                <p>{submission.currentSubmissionReview.improvement_areas}</p>
                                <small>
                                  {FINAL_PROJECT_REVIEW_STATUS_LABELS[submission.currentSubmissionReview.review_status]} le{' '}
                                  {new Date(submission.currentSubmissionReview.created_at).toLocaleString('fr-FR')}
                                </small>
                              </section>
                            )}

                            {!submission.currentSubmissionReview && submission.latestReview && (
                              <p className="final-project-evaluation-new-version" role="status">
                                Une remise plus récente attend une nouvelle évaluation. Le retour précédent reste dans
                                l’historique et n’est pas remplacé.
                              </p>
                            )}

                            <section
                              className="attestation-dossier"
                              aria-labelledby={`attestation-dossier-title-${submission.id}`}
                            >
                              <header>
                                <div>
                                  <p className="attestation-dossier__eyebrow">Suivi Qualiopi</p>
                                  <h4 id={`attestation-dossier-title-${submission.id}`}>Dossier d’attestation</h4>
                                  <p>
                                    Contrôlez les preuves avant de préparer un document. Aucune attestation n’est
                                    générée automatiquement à cette étape.
                                  </p>
                                </div>
                                <span className={`attestation-dossier__status ${submission.attestationDossier.competencyReady ? 'is-ready' : 'is-incomplete'}`}>
                                  {submission.attestationDossier.competencyReady
                                    ? 'Dossier compétences prêt'
                                    : 'Dossier à compléter'}
                                </span>
                              </header>

                              <div className="attestation-dossier__documents">
                                <article>
                                  <div>
                                    <h5>Attestation de réalisation</h5>
                                    <span className={submission.attestationDossier.realizationReady ? 'is-ready' : 'is-incomplete'}>
                                      {submission.attestationDossier.realizationReady ? 'Prête à préparer' : 'Preuves incomplètes'}
                                    </span>
                                  </div>
                                  <p>
                                    {submission.attestationDossier.completedSessionCount} séance{submission.attestationDossier.completedSessionCount !== 1 ? 's' : ''}
                                    {' '}sur {submission.attestationDossier.sessionCount} signée{submission.attestationDossier.sessionCount > 1 ? 's' : ''} et validée{submission.attestationDossier.sessionCount > 1 ? 's' : ''}.
                                  </p>
                                  <strong>
                                    Durée réellement suivie : {formatAttestationDuration(submission.attestationDossier.attendedMinutes)}
                                  </strong>
                                  {submission.attestationDossier.plannedMinutes > 0 && (
                                    <small>
                                      Durée planifiée : {formatAttestationDuration(submission.attestationDossier.plannedMinutes)}.
                                    </small>
                                  )}
                                  <Link
                                    className="attestation-dossier__link"
                                    to={`/admin/attestations/${submission.id}/realisation`}
                                  >
                                    {submission.attestationDossier.realizationReady
                                      ? 'Ouvrir l’attestation de réalisation'
                                      : 'Voir le modèle incomplet'}
                                  </Link>
                                </article>

                                <article>
                                  <div>
                                    <h5>Attestation de compétences</h5>
                                    <span className={submission.attestationDossier.competencyReady ? 'is-ready' : 'is-incomplete'}>
                                      {submission.attestationDossier.competencyReady ? 'Prête à préparer' : 'Validation attendue'}
                                    </span>
                                  </div>
                                  <p>
                                    {submission.currentSubmissionReview
                                      ? FINAL_PROJECT_REVIEW_STATUS_LABELS[submission.currentSubmissionReview.review_status]
                                      : 'Le cas pratique final n’est pas encore évalué.'}
                                  </p>
                                  <strong>Les quatre critères doivent atteindre au moins « Acquis ».</strong>
                                  <Link
                                    className="attestation-dossier__link"
                                    to={`/admin/attestations/${submission.id}/competences`}
                                  >
                                    {submission.attestationDossier.competencyReady
                                      ? 'Ouvrir l’attestation de compétences'
                                      : 'Voir le modèle incomplet'}
                                  </Link>
                                </article>
                              </div>

                              <dl className="attestation-dossier__identity">
                                <div>
                                  <dt>Apprenant</dt>
                                  <dd>{submission.learnerName}</dd>
                                </div>
                                <div>
                                  <dt>Adresse du compte</dt>
                                  <dd>{submission.learnerEmail}</dd>
                                </div>
                                <div>
                                  <dt>Modalité</dt>
                                  <dd>
                                    {submission.booking
                                      ? `${submission.booking.delivery_mode === 'remote' ? 'Distanciel synchrone' : 'Présentiel'} · ${BOOKING_FORMAT_LABELS[submission.booking.schedule_format] || submission.booking.schedule_format}`
                                      : 'Réservation à retrouver'}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Formation</dt>
                                  <dd>{submission.courseTitle}</dd>
                                </div>
                              </dl>

                              {submission.attestationDossier.missingRequirements.length > 0 && (
                                <p className="attestation-dossier__missing" role="status">
                                  <strong>À compléter :</strong>{' '}
                                  {submission.attestationDossier.missingRequirements.join(' · ')}.
                                </p>
                              )}

                              <details className="attestation-dossier__proofs">
                                <summary>Voir les références des preuves</summary>
                                <ul>
                                  <li>Référence de la remise finale : {submission.id}</li>
                                  <li>
                                    Référence de l’évaluation : {submission.currentSubmissionReview?.id || 'en attente'}
                                  </li>
                                  <li>Référence de la réservation : {submission.booking?.id || 'en attente'}</li>
                                  {submission.attestationDossier.sessionProofs.map((proof, index) => (
                                    <li key={`${proof.startsAt}-${proof.endsAt}`}>
                                      Séance {index + 1}, le {new Date(proof.startsAt).toLocaleDateString('fr-FR')} :{' '}
                                      {proof.proofComplete
                                        ? `preuve ${proof.attendanceId} · ${formatAttestationDuration(proof.attendedMinutes)} suivie${proof.attendedMinutes > 60 ? 's' : ''}`
                                        : ATTENDANCE_STATUS_LABELS[proof.trainerStatus] || 'preuve incomplète'}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            </section>

                            <form
                              className="final-project-evaluation-form"
                              onSubmit={(event) => {
                                event.preventDefault();
                                handleSaveFinalProjectReview(submission);
                              }}
                            >
                              <fieldset disabled={isSaving}>
                                <legend>Niveau observé pour chaque critère</legend>
                                <div className="final-project-evaluation-criteria">
                                  {submission.rubric.map((criterion) => {
                                    const field = FINAL_PROJECT_REVIEW_FIELDS.find(
                                      (candidate) => candidate.rubricId === criterion.id,
                                    );
                                    if (!field) return null;
                                    const selectedLevel = draft[field.column]
                                      || submission.currentSubmissionReview?.[field.column]
                                      || '';

                                    return (
                                      <label key={criterion.id} htmlFor={`final-review-${submission.id}-${criterion.id}`}>
                                        <span>{criterion.criterion}</span>
                                        <select
                                          id={`final-review-${submission.id}-${criterion.id}`}
                                          value={selectedLevel}
                                          onChange={(event) => handleFinalProjectReviewDraftChange(
                                            submission.id,
                                            field.column,
                                            event.target.value,
                                          )}
                                          required
                                        >
                                          <option value="">Choisir un niveau</option>
                                          {submission.rubricLevels.map((level) => (
                                            <option key={level.id} value={level.id}>{level.label}</option>
                                          ))}
                                        </select>
                                        {selectedLevel && (
                                          <small>{criterion.descriptors[selectedLevel]}</small>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              </fieldset>

                              <p className={`final-project-evaluation-decision ${calculatedStatus ? `is-${calculatedStatus}` : ''}`} role="status">
                                {calculatedStatus
                                  ? `Décision calculée : ${FINAL_PROJECT_REVIEW_STATUS_LABELS[calculatedStatus]}.`
                                  : 'Sélectionnez les quatre niveaux pour obtenir la décision pédagogique.'}
                              </p>

                              <label htmlFor={`final-review-appreciation-${submission.id}`}>
                                Appréciation générale
                                <textarea
                                  id={`final-review-appreciation-${submission.id}`}
                                  value={draft.appreciation || ''}
                                  onChange={(event) => handleFinalProjectReviewDraftChange(
                                    submission.id,
                                    'appreciation',
                                    event.target.value,
                                  )}
                                  placeholder="Présentez les points réussis et expliquez la décision de façon concrète."
                                  rows="5"
                                  maxLength="10000"
                                  disabled={isSaving}
                                  required
                                />
                              </label>

                              <label htmlFor={`final-review-improvement-${submission.id}`}>
                                Axes de progrès ou prochaine étape
                                <textarea
                                  id={`final-review-improvement-${submission.id}`}
                                  value={draft.improvement_areas || ''}
                                  onChange={(event) => handleFinalProjectReviewDraftChange(
                                    submission.id,
                                    'improvement_areas',
                                    event.target.value,
                                  )}
                                  placeholder="Indiquez ce qui doit être repris ou, si le travail est validé, comment poursuivre la progression."
                                  rows="5"
                                  maxLength="10000"
                                  disabled={isSaving}
                                  required
                                />
                              </label>

                              <div className="exercise-correction-form__footer">
                                <small>
                                  Cette nouvelle évaluation sera datée et ajoutée à l’historique sans remplacer les précédentes.
                                </small>
                                <button
                                  type="submit"
                                  className="btn btn-primary"
                                  disabled={
                                    isSaving
                                    || !calculatedStatus
                                    || !draft.appreciation?.trim()
                                    || !draft.improvement_areas?.trim()
                                  }
                                >
                                  {isSaving ? 'Enregistrement…' : 'Envoyer l’évaluation'}
                                </button>
                              </div>

                              {feedback && (
                                <p className={`exercise-correction-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
                                  {feedback.message}
                                </p>
                              )}
                            </form>

                            {submission.history.length > 0 && (
                              <details className="exercise-correction-history">
                                <summary>Historique des évaluations ({submission.history.length})</summary>
                                <ol>
                                  {submission.history.map((review) => (
                                    <li key={review.id}>
                                      <strong>{FINAL_PROJECT_REVIEW_STATUS_LABELS[review.review_status]}</strong>
                                      <span>{new Date(review.created_at).toLocaleString('fr-FR')}</span>
                                      <p>{review.appreciation}</p>
                                      <small>Axes de progrès : {review.improvement_areas}</small>
                                      <small>
                                        Remise évaluée du {new Date(review.submission_saved_at).toLocaleString('fr-FR')}
                                      </small>
                                    </li>
                                  ))}
                                </ol>
                              </details>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <p className="exercise-corrections-rgpd-note">
                    Les livrables et évaluations servent uniquement au suivi pédagogique et aux preuves Qualiopi.
                    N’ouvrez que les liens volontairement transmis et ne recopiez aucune donnée sensible inutile.
                  </p>
                </section>
                )}

                {correctionWorkspaceTab === 'exercises' && (
                <section id="exercise-corrections-panel" role="tabpanel" className="exercise-corrections-panel" aria-labelledby="exercise-corrections-title">
                <div className="exercise-corrections-heading">
                  <div>
                    <h2 id="exercise-corrections-title">Corrections des exercices terminés</h2>
                    <p>
                      Relisez la dernière version déclarée terminée, indiquez les points réussis et les améliorations
                      attendues, puis validez l’exercice ou demandez une reprise.
                    </p>
                  </div>
                  <span>
                    {visibleExerciseCorrections.length} réponse{visibleExerciseCorrections.length !== 1 ? 's' : ''}{' '}
                    {normalizedCorrectionSearch
                      ? `trouvée${visibleExerciseCorrections.length !== 1 ? 's' : ''}`
                      : 'à traiter'}
                  </span>
                </div>

                {!correctionsAvailable ? (
                  <div className="exercise-corrections-notice" role="status">
                    Le poste de correction est prêt dans le site. Il sera utilisable après l’activation de la migration
                    Supabase dédiée.
                  </div>
                ) : correctionsError ? (
                  <div className="exercise-corrections-notice is-error" role="alert">{correctionsError}</div>
                ) : visibleExerciseCorrections.length === 0 ? (
                  <div className="exercise-corrections-empty">
                    <h3>{normalizedCorrectionSearch ? 'Aucune correction trouvée' : 'Toutes les corrections sont à jour'}</h3>
                    <p>
                      {normalizedCorrectionSearch
                        ? 'Modifiez la recherche pour retrouver une autre réponse.'
                        : 'Une nouvelle réponse terminée apparaîtra ici automatiquement. Les corrections réalisées restent accessibles par recherche.'}
                    </p>
                  </div>
                ) : (
                  <div className="exercise-corrections-list">
                    {visibleExerciseCorrections.map((submission) => {
                      const draft = correctionDrafts[submission.id] || {};
                      const feedback = correctionFeedbacks[submission.id];
                      const isSaving = correctionSaving === String(submission.id);

                      return (
                        <article key={submission.id} className="exercise-correction-card">
                          <header className="exercise-correction-card__header">
                            <div>
                              <p className="exercise-correction-card__learner">{submission.learnerName}</p>
                              {submission.learnerName !== submission.learnerEmail && <p>{submission.learnerEmail}</p>}
                              <h3>{submission.exerciseTitle}</h3>
                              <p>{submission.courseTitle}</p>
                            </div>
                            <div className="exercise-correction-card__status">
                              {submission.currentSubmissionReview ? (
                                <span className={`is-${submission.currentSubmissionReview.review_status}`}>
                                  {EXERCISE_REVIEW_STATUS_LABELS[submission.currentSubmissionReview.review_status]}
                                </span>
                              ) : (
                                <span className="is-pending">À corriger</span>
                              )}
                              <small>Réponse du {new Date(submission.saved_at).toLocaleString('fr-FR')}</small>
                            </div>
                          </header>

                          <section className="exercise-correction-response" aria-label="Réponse de l’apprenant">
                            <h4>Réponse terminée de l’apprenant</h4>
                            <p>{submission.response_text}</p>
                          </section>

                          {submission.latestReview && (
                            <section className="exercise-correction-latest" aria-label="Dernière correction enregistrée">
                              <h4>Dernier retour envoyé</h4>
                              <p>{submission.latestReview.feedback_text}</p>
                              <small>
                                {EXERCISE_REVIEW_STATUS_LABELS[submission.latestReview.review_status]} le{' '}
                                {new Date(submission.latestReview.created_at).toLocaleString('fr-FR')}
                              </small>
                            </section>
                          )}

                          <form
                            className="exercise-correction-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              handleSaveExerciseCorrection(submission);
                            }}
                          >
                            <label htmlFor={`exercise-correction-status-${submission.id}`}>
                              Décision pédagogique
                              <select
                                id={`exercise-correction-status-${submission.id}`}
                                value={draft.reviewStatus || submission.latestReview?.review_status || 'validated'}
                                onChange={(event) => handleCorrectionDraftChange(submission.id, 'reviewStatus', event.target.value)}
                                disabled={isSaving}
                              >
                                <option value="validated">Exercice validé</option>
                                <option value="needs_revision">Réponse à reprendre</option>
                              </select>
                            </label>
                            <label htmlFor={`exercise-correction-feedback-${submission.id}`}>
                              Appréciation et conseils
                              <textarea
                                id={`exercise-correction-feedback-${submission.id}`}
                                value={draft.feedbackText || ''}
                                onChange={(event) => handleCorrectionDraftChange(submission.id, 'feedbackText', event.target.value)}
                                placeholder="Commencez par les points réussis, puis indiquez précisément ce qui doit être corrigé et comment s’y prendre."
                                rows="6"
                                maxLength="10000"
                                disabled={isSaving}
                                required
                              />
                            </label>
                            <div className="exercise-correction-form__footer">
                              <small>
                                Cette appréciation sera visible par l’apprenant et ajoutée à l’historique sans remplacer les précédentes.
                              </small>
                              <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={isSaving || !draft.feedbackText?.trim()}
                              >
                                {isSaving ? 'Enregistrement…' : 'Envoyer le retour'}
                              </button>
                            </div>
                            {feedback && (
                              <p className={`exercise-correction-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
                                {feedback.message}
                              </p>
                            )}
                          </form>

                          {submission.history.length > 0 && (
                            <details className="exercise-correction-history">
                              <summary>
                                Historique des appréciations ({submission.history.length})
                              </summary>
                              <ol>
                                {submission.history.map((review) => (
                                  <li key={review.id}>
                                    <strong>{EXERCISE_REVIEW_STATUS_LABELS[review.review_status]}</strong>
                                    <span>{new Date(review.created_at).toLocaleString('fr-FR')}</span>
                                    <p>{review.feedback_text}</p>
                                    <small>
                                      Version apprenant du {new Date(review.response_saved_at).toLocaleString('fr-FR')}
                                    </small>
                                  </li>
                                ))}
                              </ol>
                            </details>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}

                <p className="exercise-corrections-rgpd-note">
                  Ces réponses et appréciations servent exclusivement au suivi pédagogique. Elles doivent être conservées
                  pendant la durée définie par FormaPrompt, puis supprimées ou anonymisées lorsqu’elles ne sont plus utiles.
                </p>
                </section>
                )}
              </section>
            )}

            {activeTab === 'positioning' && (
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ marginBottom: '0.5rem' }}>Tests de positionnement préalables</h2>
                  <p style={{ color: '#aaa', margin: 0 }}>
                    Preuves nominatives : apprenant, formation, date, résultat et détail des réponses.
                  </p>
                </div>

                {positioningError ? (
                  <div role="alert" style={{ padding: '1rem', color: '#fecaca', background: '#3f1d24', border: '1px solid #f87171', borderRadius: '8px' }}>
                    {positioningError}
                  </div>
                ) : positioningAssessments.length === 0 ? (
                  <p style={{ color: '#888' }}>Aucun test de positionnement enregistré pour le moment.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '1.25rem' }}>
                    {positioningAssessments.map((assessment) => {
                      const recordedAnswers = Array.isArray(assessment.answers) ? assessment.answers : [];

                      return (
                        <article key={assessment.id} style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '10px', border: '1px solid #444' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                            <div>
                              <h3 style={{ margin: '0 0 0.3rem', color: '#fff' }}>{assessment.learner_name}</h3>
                              <p style={{ margin: '0 0 0.3rem', color: '#cbd5e1' }}>{assessment.profiles?.email || 'Adresse e-mail indisponible'}</p>
                              <p style={{ margin: 0, color: '#2dd4bf', fontWeight: 'bold' }}>{assessment.course_title}</p>
                            </div>
                            <div style={{ minWidth: '150px', textAlign: 'right' }}>
                              <div style={{ color: '#fbbf24', fontSize: '1.55rem', fontWeight: 'bold' }}>
                                {assessment.score}/{assessment.maximum_score}
                              </div>
                              <div style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>{assessment.level}</div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                            <span>Réalisé le {new Date(assessment.submitted_at).toLocaleString('fr-FR')}</span>
                            <span>•</span>
                            <span>Référence {assessment.id.slice(0, 8).toUpperCase()}</span>
                            <span>•</span>
                            <span>{recordedAnswers.length} réponse{recordedAnswers.length > 1 ? 's' : ''}</span>
                          </div>

                          <details style={{ background: '#1e1e1e', border: '1px solid #3f3f46', borderRadius: '8px' }}>
                            <summary style={{ padding: '0.9rem 1rem', cursor: 'pointer', color: '#fff', fontWeight: 'bold' }}>
                              Voir les réponses nominatives
                            </summary>
                            <ol style={{ margin: 0, padding: '0 1rem 1rem 2.5rem' }}>
                              {recordedAnswers.map((answer, index) => (
                                <li key={`${assessment.id}-${answer.question_id || index}`} style={{ padding: '0.9rem 0', color: '#e2e8f0', borderTop: index === 0 ? '1px solid #3f3f46' : 'none' }}>
                                  <p style={{ margin: '0 0 0.4rem', fontWeight: 'bold' }}>{answer.question}</p>
                                  <p style={{ margin: 0, color: '#99f6e4' }}>{answer.answer}</p>
                                </li>
                              ))}
                            </ol>
                          </details>
                        </article>
                      );
                    })}
                  </div>
                )}

                <p style={{ marginTop: '1.25rem', color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  Ces données sont réservées au suivi pédagogique et aux justificatifs qualité. Leur durée de conservation
                  doit être définie dans la politique RGPD de FormaPrompt.
                </p>
              </div>
            )}

            {activeTab === 'purchases' && (
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ marginBottom: '0.5rem' }}>Achats, accès offerts et personnalisation pédagogique</h2>
                  <p style={{ color: '#aaa', margin: 0 }}>
                    Le téléphone est affiché uniquement pour préparer et personnaliser la formation de l'apprenant.
                  </p>
                </div>

                {purchasesError ? (
                  <div role="alert" style={{ padding: '1rem', color: '#fecaca', background: '#3f1d24', border: '1px solid #f87171', borderRadius: '8px' }}>
                    {purchasesError}
                  </div>
                ) : purchases.length === 0 ? (
                  <p style={{ color: '#888' }}>Aucun achat enregistré pour le moment.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #444', color: '#aaa' }}>
                          <th style={{ padding: '1rem' }}>Apprenant</th>
                          <th style={{ padding: '1rem' }}>Formation</th>
                          <th style={{ padding: '1rem' }}>Téléphone</th>
                          <th style={{ padding: '1rem' }}>Paiement</th>
                          <th style={{ padding: '1rem' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map((purchase) => {
                          const learner = users.find((profile) => profile.id === purchase.user_id);
                          const phoneHref = purchase.customer_phone?.replace(/[^+\d]/g, '');

                          return (
                            <tr key={purchase.id} style={{ borderBottom: '1px solid #333' }}>
                              <td style={{ padding: '1rem' }}>{learner?.email || purchase.user_id}</td>
                              <td style={{ padding: '1rem' }}>{COURSE_LABELS[purchase.course_id] || purchase.course_id}</td>
                              <td style={{ padding: '1rem' }}>
                                {phoneHref ? <a href={`tel:${phoneHref}`} style={{ color: '#60a5fa' }}>{purchase.customer_phone}</a> : 'Non renseigné'}
                              </td>
                              <td style={{ padding: '1rem' }}>
                                {purchase.payment_status === 'granted_by_admin'
                                  ? 'Accès offert'
                                  : purchase.amount_total
                                    ? `${(purchase.amount_total / 100).toFixed(2)} ${purchase.currency?.toUpperCase() || 'EUR'}`
                                    : 'Accès manuel'}
                              </td>
                              <td style={{ padding: '1rem', color: '#aaa' }}>
                                {purchase.purchased_at ? new Date(purchase.purchased_at).toLocaleString('fr-FR') : 'Date inconnue'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <p style={{ marginTop: '1.25rem', color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  Donnée personnelle : ne pas utiliser ce numéro pour de la prospection sans consentement distinct et
                  supprimer les informations devenues inutiles selon la durée de conservation définie par FormaPrompt.
                </p>
              </div>
            )}

            {activeTab === 'feedback' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Questionnaires de satisfaction (Qualiopi)</h2>
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  {surveys.length === 0 ? (
                    <p style={{ color: '#888' }}>Aucun avis reçu pour le moment.</p>
                  ) : (
                    surveys.map(s => (
                      <div key={s.id} style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div>
                            <h3 style={{ margin: '0 0 0.25rem 0' }}>{s.student_name} <span style={{ color: '#aaa', fontSize: '1rem', fontWeight: 'normal' }}>({s.student_email})</span></h3>
                            <p style={{ color: '#6ee7b7', fontWeight: 'bold', margin: '0 0 0.25rem 0' }}>{s.course_name} (Fin le {new Date(s.training_date).toLocaleDateString()})</p>
                            <p style={{ fontSize: '0.85rem', color: '#b6bbc4', margin: 0 }}>Soumis le {new Date(s.created_at).toLocaleString()}</p>
                            {s.booking_request_id && (
                              <p style={{ margin: '0.5rem 0 0', color: '#86efac', fontSize: '0.85rem', fontWeight: 700 }}>
                                ✓ Parcours vérifié — questionnaire ouvert après la dernière séance signée
                              </p>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fbbf24' }}>
                              {s.rating_overall}/5
                            </div>
                            <small style={{ color: '#aaa' }}>Global</small>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                          <span style={{ padding: '4px 8px', background: '#1e1e1e', borderRadius: '4px', fontSize: '0.9rem' }}>Pédagogie: <strong style={{ color: '#fbbf24' }}>{s.rating_pedagogy}/5</strong></span>
                          <span style={{ padding: '4px 8px', background: '#1e1e1e', borderRadius: '4px', fontSize: '0.9rem' }}>Objectifs: <strong style={{ color: '#fbbf24' }}>{s.rating_objectives}/5</strong></span>
                          <span style={{ padding: '4px 8px', background: '#1e1e1e', borderRadius: '4px', fontSize: '0.9rem' }}>Logistique: <strong style={{ color: '#fbbf24' }}>{s.rating_logistics}/5</strong></span>
                        </div>

                        {s.public_testimonial && (
                          <div style={{ marginBottom: '1rem' }}>
                            <strong style={{ color: '#fff' }}>Témoignage public :</strong>
                            <p style={{ fontStyle: 'italic', background: '#1e1e1e', padding: '1rem', borderRadius: '6px', margin: '0.5rem 0' }}>"{s.public_testimonial}"</p>
                            
                            {s.consent_marketing ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#10b98120', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #10b981' }}>
                                <span style={{ color: '#10b981', fontSize: '0.9rem' }}>✓ Accord marketing donné</span>
                                <button 
                                  onClick={() => handleTogglePublishSurvey(s.id, s.is_published)}
                                  className="btn"
                                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem', background: s.is_published ? '#ef4444' : '#10b981', color: 'white', border: 'none' }}
                                >
                                  {s.is_published ? 'Dépublier du site' : 'Publier sur le site'}
                                </button>
                              </div>
                            ) : (
                              <div style={{ background: '#ef444420', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #ef4444' }}>
                                <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>✗ Pas d'accord marketing (Ne pas publier)</span>
                              </div>
                            )}
                          </div>
                        )}

                        {s.private_feedback && (
                          <div>
                            <strong style={{ color: '#fff' }}>Remarques (Confidentiel) :</strong>
                            <p style={{ background: '#1e1e1e', padding: '1rem', borderRadius: '6px', margin: '0.5rem 0', color: '#fca5a5' }}>{s.private_feedback}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
