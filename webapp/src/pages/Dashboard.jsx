import { useAuth } from '../contexts/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { CalendarClock, CheckCircle2, FileCheck2, MessageSquareText } from 'lucide-react';
import CourseProgress from '../components/CourseProgress';
import { BOOKING_COURSES, getBookingUrl } from '../data/bookingCatalog';
import { courseCatalog } from '../data/courseCatalog';
import { DEMO_LEARNING_PATH_SLUG } from '../data/learningPathCatalog';
import { hasLearnerSignedLastSession } from '../lib/courseBookingSlots';
import { calculateCourseProgress } from '../lib/courseProgress';
import { fetchActiveCourseAccesses } from '../lib/courseAccess';
import { ATTESTATION_TYPES } from '../lib/attestationDocument';
import './Dashboard.css';

// Petit dictionnaire pour afficher le beau nom de la formation
const courseNames = {
  'formation-ia': 'Formation IA Générative',
  'formation-ia-act': 'IA : acculturation et préparation à la conformité AI Act',
  'formation-prompt-level-1': 'Formation Prompt Engineering – Niveau 1',
};

const bookingStatusLabels = {
  pending_distance: 'Distance à vérifier',
  awaiting_travel_payment: 'Participation au déplacement à régler',
  confirmed: 'Séances confirmées',
  rejected: 'Demande à revoir',
  cancelled: 'Réservation annulée',
  completed: 'Accompagnement réalisé',
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [courseAccesses, setCourseAccesses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [bookingLoadError, setBookingLoadError] = useState(false);
  const [surveyLoadError, setSurveyLoadError] = useState(false);
  const [exerciseResponses, setExerciseResponses] = useState([]);
  const [exerciseReviews, setExerciseReviews] = useState([]);
  const [progressAvailable, setProgressAvailable] = useState(true);
  const [attestations, setAttestations] = useState([]);
  const [attestationsAvailable, setAttestationsAvailable] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    async function fetchPurchases() {
      setLoadError('');
      setBookingLoadError(false);
      setSurveyLoadError(false);
      setProgressAvailable(true);
      setAttestationsAvailable(true);

      const [
        accessesResult,
        bookingResult,
        surveyResult,
        exerciseResponsesResult,
        exerciseReviewsResult,
        attestationsResult,
      ] = await Promise.all([
        fetchActiveCourseAccesses({ userId: user.id }),
        supabase
          .from('course_booking_requests')
          .select(`
            id, course_id, status, delivery_mode, schedule_format,
            course_session_bookings(id, starts_at, ends_at, duration_minutes, status),
            course_session_attendance(
              id, session_starts_at, session_ends_at,
              learner_confirmed_at, learner_signature_sha256
            )
          `)
          .eq('user_id', user.id),
        supabase
          .from('satisfaction_surveys')
          .select('id, booking_request_id, created_at')
          .eq('user_id', user.id),
        supabase
          .from('course_exercise_latest_responses')
          .select('course_id, exercise_id, status')
          .eq('user_id', user.id),
        supabase
          .from('course_exercise_latest_reviews')
          .select('course_id, exercise_id, review_status')
          .eq('user_id', user.id),
        supabase
          .from('course_attestation_issuances')
          .select('id, reference, course_id, document_type, issued_at')
          .eq('user_id', user.id)
          .order('issued_at', { ascending: false }),
      ]);

      if (accessesResult.error) {
        console.error('Erreur lors du chargement des formations :', accessesResult.error);
        setLoadError("Impossible de charger vos formations pour le moment. Veuillez réessayer ultérieurement.");
      } else {
        setCourseAccesses(accessesResult.data ?? []);
      }

      if (bookingResult.error) {
        console.error('Erreur lors du chargement de la réservation :', bookingResult.error);
        setBookingLoadError(true);
      } else {
        setBookings(bookingResult.data ?? []);
      }

      if (surveyResult.error) {
        console.error('Erreur lors du chargement des questionnaires :', surveyResult.error);
        setSurveyLoadError(true);
      } else {
        setSurveys(surveyResult.data ?? []);
      }

      if (exerciseResponsesResult.error || exerciseReviewsResult.error) {
        const progressError = exerciseResponsesResult.error || exerciseReviewsResult.error;
        if (!['42P01', 'PGRST205'].includes(progressError.code)) {
          console.error('Erreur lors du chargement de la progression :', progressError);
        }
        setProgressAvailable(false);
      } else {
        setExerciseResponses(exerciseResponsesResult.data ?? []);
        setExerciseReviews(exerciseReviewsResult.data ?? []);
      }

      if (attestationsResult.error) {
        if (!['42P01', 'PGRST205'].includes(attestationsResult.error.code)) {
          console.error('Erreur lors du chargement des attestations :', attestationsResult.error);
        }
        setAttestationsAvailable(false);
      } else {
        setAttestations(attestationsResult.data ?? []);
      }
      setLoading(false);
    }

    fetchPurchases();
  }, [user, navigate]);

  if (!user) return null;

  const bookableAccesses = courseAccesses.filter((access) => BOOKING_COURSES[access.course_id]);
  const pendingSatisfactionBookings = surveyLoadError ? [] : bookings.filter((booking) => (
    BOOKING_COURSES[booking.course_id]
    && hasLearnerSignedLastSession(booking)
    && !surveys.some((survey) => survey.booking_request_id === booking.id)
  ));

  return (
    <div className="container learner-dashboard" style={{ padding: '4rem 1rem', minHeight: '60vh' }}>
      <h1 style={{ marginBottom: '2rem' }}>Mon espace apprenant</h1>
      
      <div style={{ background: '#1e1e1e', color: '#fff', padding: '2rem', borderRadius: '12px', border: '1px solid #333' }}>
        <h2 style={{ color: '#fff' }}>Bienvenue, {user.email} !</h2>
        <p style={{ color: '#aaa', marginTop: '1rem', marginBottom: '2rem' }}>
          Vous retrouverez ici toutes les formations que vous avez achetées ou qui vous ont été attribuées.
        </p>

        <section className="learner-demo-path" aria-labelledby="learner-demo-path-title">
          <div>
            <p className="learner-demo-path__eyebrow">Premier parcours persistant</p>
            <h3 id="learner-demo-path-title">Introduction au Prompt Engineering</h3>
            <p>Cinq modules courts pour tester la progression et la reprise automatique dans votre espace apprenant.</p>
          </div>
          <Link to={`/parcours/${DEMO_LEARNING_PATH_SLUG}`} className="btn btn-primary">
            Commencer ou reprendre
          </Link>
        </section>
        
        {loading ? (
          <p>Chargement de vos formations...</p>
        ) : loadError ? (
          <div role="alert" style={{ padding: '1rem', border: '1px solid #f87171', borderRadius: '8px', background: '#3f1d24', color: '#fecaca' }}>
            {loadError}
          </div>
        ) : courseAccesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <h3 style={{ marginBottom: '1rem', color: '#fff', fontSize: '1.5rem' }}>Vous n'avez pas encore de formation</h3>
            <p style={{ color: '#aaa', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
              Découvrez nos programmes conçus pour booster votre productivité et maîtriser les outils numériques de demain.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', textAlign: 'left' }}>
              
              <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.1rem' }}>IA Générative</h4>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '1.5rem', flexGrow: 1 }}>Maîtrisez ChatGPT, Midjourney et les outils d'IA pour votre entreprise.</p>
                <Link to="/formation-ia-generative" className="btn btn-primary" style={{ textAlign: 'center', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6' }}>Découvrir le programme</Link>
              </div>
              
              <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Prompt Engineering</h4>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '1.5rem', flexGrow: 1 }}>Apprenez à formuler des requêtes parfaites pour obtenir exactement ce que vous voulez.</p>
                <Link to="/formation-prompt-engineering" className="btn btn-primary" style={{ textAlign: 'center', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6' }}>Découvrir le programme</Link>
              </div>
              
              <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Bureautique Pro</h4>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '1.5rem', flexGrow: 1 }}>Excel, Word, PowerPoint : gagnez en efficacité et en rapidité au quotidien.</p>
                <Link to="/formation-bureautique" className="btn btn-primary" style={{ textAlign: 'center', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6' }}>Découvrir le programme</Link>
              </div>

              <div style={{ padding: '1.5rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Acculturation IA &amp; AI Act</h4>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '1.5rem', flexGrow: 1 }}>Un parcours estimé à 4 h 45, dont 4 heures guidées avec le formateur.</p>
                <Link to="/formation-ia-act-conformite" className="btn btn-primary" style={{ textAlign: 'center', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6' }}>Découvrir le programme</Link>
              </div>
              
            </div>
          </div>
        ) : (
          <>
            {pendingSatisfactionBookings.map((booking) => {
              const course = BOOKING_COURSES[booking.course_id];
              return (
                <section
                  key={`satisfaction-${booking.id}`}
                  className="booking-next-step booking-next-step--satisfaction"
                  aria-live="polite"
                >
                  <div className="booking-next-step__icon" aria-hidden="true">
                    <MessageSquareText />
                  </div>
                  <div className="booking-next-step__content">
                    <p className="booking-next-step__course">{course.title}</p>
                    <p className="booking-next-step__eyebrow">Fin de formation</p>
                    <h3>Votre questionnaire de satisfaction est disponible</h3>
                    <p>
                      Vous avez signé la dernière séance de « {course.title} ». Merci de compléter
                      l’évaluation Qualiopi et, si vous le souhaitez, de laisser un avis.
                    </p>
                  </div>
                  <Link to={`/feedback?booking=${encodeURIComponent(booking.id)}`} className="btn booking-next-step__action">
                    Donner mon avis
                  </Link>
                </section>
              );
            })}

            {bookableAccesses.map((access) => {
              const course = BOOKING_COURSES[access.course_id];
              const currentBooking = bookings.find((item) => item.course_id === access.course_id);
              const hasActiveBooking = currentBooking && !['cancelled', 'rejected'].includes(currentBooking.status);
              return (
                <section
                  key={`booking-${access.course_id}`}
                  className={`booking-next-step ${hasActiveBooking ? 'booking-next-step--registered' : ''}`}
                  aria-live="polite"
                >
                  <div className="booking-next-step__icon" aria-hidden="true">
                    {hasActiveBooking ? <CheckCircle2 /> : <CalendarClock />}
                  </div>
                  <div className="booking-next-step__content">
                    <p className="booking-next-step__course">{course.title}</p>
                    <p className="booking-next-step__eyebrow">
                      {hasActiveBooking ? 'Réservation enregistrée' : 'Étape suivante'}
                    </p>
                    <h3>
                      {hasActiveBooking ? 'Vos heures avec le formateur sont planifiées' : `Réservez vos ${course.guidedHoursLabel} avec le formateur`}
                    </h3>
                    <p>
                      {hasActiveBooking
                        ? `État actuel : ${bookingStatusLabels[currentBooking.status] || currentBooking.status}.`
                        : `Votre accès à « ${course.shortTitle} » est actif. Choisissez maintenant votre modalité et vos horaires.`}
                    </p>
                    {bookingLoadError && (
                      <p className="booking-next-step__warning" role="status">
                        L’état de votre réservation n’a pas pu être vérifié. Vous pouvez néanmoins ouvrir la page des horaires.
                      </p>
                    )}
                  </div>
                  <Link to={getBookingUrl(access.course_id)} className="btn booking-next-step__action">
                    {hasActiveBooking ? 'Voir mes séances' : 'Choisir mes horaires'}
                  </Link>
                </section>
              );
            })}

            {attestationsAvailable && attestations.length > 0 && (
              <section className="learner-attestations" aria-labelledby="learner-attestations-title">
                <div className="learner-attestations__heading">
                  <FileCheck2 aria-hidden="true" />
                  <div>
                    <p>Documents de fin de formation</p>
                    <h2 id="learner-attestations-title">Mes attestations</h2>
                  </div>
                </div>
                <div className="learner-attestations__grid">
                  {attestations.map((attestation) => (
                    <article key={attestation.id} className="learner-attestation-card">
                      <div>
                        <h3>{ATTESTATION_TYPES[attestation.document_type]?.title || 'Attestation'}</h3>
                        <p>{courseNames[attestation.course_id] || attestation.course_id}</p>
                        <span>
                          Délivrée le {new Date(attestation.issued_at).toLocaleDateString('fr-FR')}
                          {' · '}{attestation.reference}
                        </span>
                      </div>
                      <Link to={`/attestations/${attestation.id}`} className="btn learner-attestation-card__action">
                        Consulter et imprimer
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <div className="learner-course-grid">
              {courseAccesses.map((access) => {
                const purchasedCourse = courseCatalog[access.course_id];
                const progress = calculateCourseProgress(
                  purchasedCourse?.exercises,
                  exerciseResponses.filter((response) => response.course_id === access.course_id),
                  exerciseReviews.filter((review) => review.course_id === access.course_id),
                );

                return (
                  <article key={access.id} className="learner-course-card">
                    <h3>{courseNames[access.course_id] || access.course_id}</h3>
                    {progressAvailable && (
                      <CourseProgress progress={progress} compact headingLevel={4} />
                    )}
                    <Link to={`/course/${access.course_id}`} className="btn btn-primary learner-course-card__action">
                      ▶ Voir la formation
                    </Link>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <button 
          onClick={signOut}
          className="btn"
          style={{ marginTop: '3rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
