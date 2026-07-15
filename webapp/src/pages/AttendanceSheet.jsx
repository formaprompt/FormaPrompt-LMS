import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { groupBookedSessions } from '../lib/courseBookingSlots';
import { byteaToPngDataUrl, shortSignatureHash } from '../lib/signatureImage';
import './AttendanceSheet.css';

const COURSE_LABELS = {
  'formation-ia-act': 'IA Act – acculturation et conformité',
  'formation-prompt-level-1': 'Prompt Engineering – Niveau 1',
};

const STATUS_LABELS = {
  pending: 'À valider',
  present: 'Présence complète',
  partial: 'Départ anticipé',
  absent: 'Absent(e)',
  technical_issue: 'Incident technique',
};

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('fr-FR') : '—';
}

function formatPlannedSession(session) {
  const start = new Date(session.starts_at);
  const end = new Date(session.ends_at);
  return `${start.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · ${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function findAttendance(records, session) {
  const start = new Date(session.starts_at).getTime();
  const end = new Date(session.ends_at).getTime();
  return (records || []).find((record) => (
    new Date(record.session_starts_at).getTime() === start
    && new Date(record.session_ends_at).getTime() === end
  ));
}

export default function AttendanceSheet() {
  const { bookingId } = useParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || (role !== 'admin' && role !== 'employee')) {
      navigate('/dashboard', { replace: true });
      return;
    }

    async function loadAttendanceSheet() {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from('course_booking_requests')
        .select(`
          id, user_id, course_id, delivery_mode, schedule_format, city, postal_code, status, created_at,
          profiles!course_booking_requests_user_id_fkey(email),
          course_session_bookings(id, starts_at, ends_at, duration_minutes, status),
          course_session_attendance(
            id, session_starts_at, session_ends_at, delivery_mode,
            learner_confirmed_at, learner_confirmation_version,
            learner_signature_png, learner_signature_sha256, learner_signed_payload_sha256,
            trainer_status, actual_ends_at, trainer_note,
            trainer_validated_at, trainer_signature_png, trainer_signature_sha256,
            trainer_signed_payload_sha256, locked_at, created_at,
            trainer:profiles!course_session_attendance_trainer_validated_by_fkey(email)
          )
        `)
        .eq('id', bookingId)
        .single();

      if (loadError) {
        console.error("Chargement de la feuille d'émargement impossible :", loadError);
        setError("La feuille d’émargement n’a pas pu être chargée.");
      } else {
        const { data: positioning } = await supabase
          .from('course_positioning_assessments')
          .select('learner_name')
          .eq('user_id', data.user_id)
          .eq('course_id', data.course_id)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setBooking({ ...data, learnerName: positioning?.learner_name || '' });
      }
      setLoading(false);
    }

    loadAttendanceSheet();
  }, [bookingId, navigate, role, user]);

  const sessions = useMemo(() => (
    booking
      ? groupBookedSessions(booking.course_session_bookings || [], booking.schedule_format)
      : []
  ), [booking]);

  if (!user || (role !== 'admin' && role !== 'employee')) return null;

  return (
    <div className="attendance-sheet-page">
      <div className="attendance-sheet-actions">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /> Imprimer ou enregistrer en PDF
        </button>
        <button type="button" className="btn attendance-back-button" onClick={() => navigate('/admin?onglet=bookings')}>
          Retour à l’administration
        </button>
      </div>

      {loading ? <p>Chargement de la preuve d’émargement…</p> : error ? (
        <p role="alert" className="attendance-sheet-error">{error}</p>
      ) : (
        <article className="attendance-document">
          <header className="attendance-document__header">
            <img src="/assets/logo-new.png" alt="FormaPrompt" />
            <div>
              <p>Document de suivi pédagogique</p>
              <h1>Feuille d’émargement</h1>
              <span>Référence réservation : {booking.id}</span>
            </div>
          </header>

          <section className="attendance-document__identity">
            <div><strong>Formation</strong><span>{COURSE_LABELS[booking.course_id] || booking.course_id}</span></div>
            <div>
              <strong>Apprenant</strong>
              <span>{booking.learnerName || booking.profiles?.email || 'Compte apprenant'}</span>
              {booking.learnerName && <small>{booking.profiles?.email}</small>}
            </div>
            <div><strong>Modalité</strong><span>{booking.delivery_mode === 'remote' ? 'Distanciel synchrone' : 'Présentiel'}</span></div>
            <div><strong>Lieu</strong><span>{booking.delivery_mode === 'remote' ? 'Classe virtuelle' : `${booking.postal_code || ''} ${booking.city || ''}`.trim()}</span></div>
          </section>

          <div className="attendance-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Séance prévue</th>
                  <th>Confirmation apprenant</th>
                  <th>Validation formateur</th>
                  <th>Fin réelle / observation</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const attendance = findAttendance(booking.course_session_attendance, session);
                  return (
                    <tr key={session.id}>
                      <td>{formatPlannedSession(session)}</td>
                      <td>
                        {attendance?.learner_signature_png ? (
                          <>
                            <strong>Signature apprenant</strong>
                            <img className="attendance-signature-image" src={byteaToPngDataUrl(attendance.learner_signature_png)} alt="Signature manuscrite de l’apprenant" />
                            <span>{formatDateTime(attendance.learner_confirmed_at)}</span>
                            <small>Empreinte : {shortSignatureHash(attendance.learner_signed_payload_sha256)}</small>
                          </>
                        ) : 'Non signé'}
                      </td>
                      <td>
                        <strong>{STATUS_LABELS[attendance?.trainer_status || 'pending']}</strong>
                        {attendance?.trainer_signature_png && (
                          <img className="attendance-signature-image" src={byteaToPngDataUrl(attendance.trainer_signature_png)} alt="Signature manuscrite du formateur" />
                        )}
                        <span>{formatDateTime(attendance?.trainer_validated_at)}</span>
                        {attendance?.trainer?.email && <small>Validé par {attendance.trainer.email}</small>}
                        {attendance?.trainer_signed_payload_sha256 && <small>Empreinte : {shortSignatureHash(attendance.trainer_signed_payload_sha256)}</small>}
                      </td>
                      <td>
                        <span>{attendance?.actual_ends_at ? `Fin : ${formatDateTime(attendance.actual_ends_at)}` : '—'}</span>
                        {attendance?.trainer_note && <small>{attendance.trainer_note}</small>}
                        {attendance?.id && <small>Preuve : {attendance.id}</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <footer className="attendance-document__footer">
            <p>
              Les signatures sont dessinées depuis des comptes authentifiés, horodatées par le serveur et
              liées à la séance par une empreinte de contrôle. Les corrections restent tracées dans
              l’historique sécurisé de FormaPrompt.
            </p>
            <p>
              Document à conserver selon les obligations applicables à l’action de formation et la durée
              définie dans la politique de conservation RGPD de FormaPrompt.
            </p>
            <span>Généré le {new Date().toLocaleString('fr-FR')}</span>
          </footer>
        </article>
      )}
    </div>
  );
}
