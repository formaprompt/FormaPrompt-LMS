import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { byteaToPngDataUrl, shortSignatureHash } from '../lib/signatureImage';
import { ArrowLeft, FileDown, Printer } from 'lucide-react';
import './AttendanceSheets.css';

const COURSE_TITLES = {
  'formation-ia': 'Formation IA Générative',
  'formation-ia-act': 'IA : acculturation et préparation à la conformité AI Act',
  'formation-prompt-level-1': 'Prompt engineering — Niveau 1',
};

const DELIVERY_LABELS = {
  remote: 'À distance',
  in_person: 'En présentiel',
};

const TRAINER_STATUS_LABELS = {
  pending: 'À valider',
  present: 'Présent',
  partial: 'Présence partielle',
  absent: 'Absent',
  technical_issue: 'Incident technique',
};

const formatDate = (value) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));

const formatTime = (value) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Non confirmé';

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes} min`;
  return remainingMinutes ? `${hours} h ${remainingMinutes}` : `${hours} h`;
};

export default function AttendanceSheets() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [selectedSheetId, setSelectedSheetId] = useState('');
  const [sheetSearch, setSheetSearch] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (role !== 'admin' && role !== 'employee') {
      navigate('/dashboard', { replace: true });
      return;
    }

    async function loadAttendanceData() {
      setLoading(true);
      setError('');

      const [attendanceResult, requestsResult, profilesResult, assessmentsResult] =
        await Promise.all([
          supabase
            .from('course_session_attendance')
            .select(
              'id, booking_request_id, user_id, session_starts_at, session_ends_at, delivery_mode, learner_confirmed_at, learner_signature_png, learner_signature_sha256, learner_signed_payload_sha256, trainer_status, actual_ends_at, trainer_note, trainer_validated_at, trainer_signature_png, trainer_signature_sha256, trainer_signed_payload_sha256'
            )
            .order('session_starts_at', { ascending: true }),
          supabase
            .from('course_booking_requests')
            .select('id, user_id, course_id, status, created_at'),
          supabase.from('profiles').select('id, email'),
          supabase
            .from('course_positioning_assessments')
            .select('user_id, course_id, course_title, learner_name, submitted_at')
            .order('submitted_at', { ascending: false }),
        ]);

      const firstError =
        attendanceResult.error ||
        requestsResult.error ||
        profilesResult.error ||
        assessmentsResult.error;

      if (firstError) {
        console.error("Impossible de charger les feuilles d'émargement :", firstError);
        setError(
          "Les données d'émargement ne peuvent pas être chargées. Vérifiez vos droits administrateur puis réessayez."
        );
      } else {
        setAttendance(attendanceResult.data || []);
        setBookingRequests(requestsResult.data || []);
        setProfiles(profilesResult.data || []);
        setAssessments(assessmentsResult.data || []);
      }

      setLoading(false);
    }

    loadAttendanceData();
  }, [navigate, role, user]);

  const sheets = useMemo(() => {
    const requestsById = new Map(
      bookingRequests.map((request) => [request.id, request])
    );
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    const groupedSessions = new Map();

    attendance.forEach((session) => {
      const key = session.booking_request_id;
      const current = groupedSessions.get(key) || [];
      current.push(session);
      groupedSessions.set(key, current);
    });

    return Array.from(groupedSessions.entries())
      .map(([bookingRequestId, sessions]) => {
        const request = requestsById.get(bookingRequestId);
        const userId = request?.user_id || sessions[0]?.user_id;
        const courseId = request?.course_id || 'formation';
        const assessment = assessments.find(
          (item) => item.user_id === userId && item.course_id === courseId
        );
        const profile = profilesById.get(userId);

        return {
          id: bookingRequestId,
          courseId,
          courseTitle:
            assessment?.course_title ||
            COURSE_TITLES[courseId] ||
            courseId,
          learnerName: assessment?.learner_name || profile?.email || 'Apprenant',
          learnerEmail: profile?.email || '',
          requestStatus: request?.status || '',
          sessions,
        };
      })
      .sort((a, b) => {
        const aDate = a.sessions[0]?.session_starts_at || '';
        const bDate = b.sessions[0]?.session_starts_at || '';
        return bDate.localeCompare(aDate);
      });
  }, [assessments, attendance, bookingRequests, profiles]);

  const filteredSheets = useMemo(() => {
    const query = sheetSearch.trim().toLocaleLowerCase('fr-FR');
    if (!query) return sheets;
    return sheets.filter((sheet) => (
      `${sheet.learnerName} ${sheet.learnerEmail} ${sheet.courseTitle} ${sheet.id}`
        .toLocaleLowerCase('fr-FR')
        .includes(query)
    ));
  }, [sheetSearch, sheets]);
  const effectiveSheetId = filteredSheets.some((sheet) => sheet.id === selectedSheetId)
    ? selectedSheetId
    : filteredSheets[0]?.id || '';
  const selectedSheet = sheets.find((sheet) => sheet.id === effectiveSheetId);
  const totalMinutes =
    selectedSheet?.sessions.reduce((total, session) => {
      const start = new Date(session.session_starts_at).getTime();
      const end = new Date(session.session_ends_at).getTime();
      return total + Math.max(0, Math.round((end - start) / 60000));
    }, 0) || 0;

  const handlePrint = () => {
    window.print();
  };

  if (!user || (role !== 'admin' && role !== 'employee')) return null;

  return (
    <div className="attendance-page">
      <div className="attendance-toolbar no-print">
        <button
          type="button"
          className="attendance-secondary-button"
          onClick={() => navigate('/admin')}
        >
          <ArrowLeft size={18} />
          Retour à l’administration
        </button>

        <div className="attendance-toolbar-actions">
          <label htmlFor="attendance-sheet-search">
            Rechercher l’apprenant
            <input
              id="attendance-sheet-search"
              type="search"
              placeholder="Nom ou e-mail…"
              value={sheetSearch}
              onChange={(event) => setSheetSearch(event.target.value)}
            />
          </label>
          <label htmlFor="attendance-sheet-select">
            Formation et feuille à préparer
            <select
              id="attendance-sheet-select"
              value={effectiveSheetId}
              onChange={(event) => setSelectedSheetId(event.target.value)}
              disabled={!filteredSheets.length}
            >
              {filteredSheets.map((sheet) => (
                <option key={sheet.id} value={sheet.id}>
                  {sheet.learnerName} — {sheet.courseTitle} — {sheet.sessions[0] ? formatDate(sheet.sessions[0].session_starts_at) : 'sans date'} — réf. {sheet.id.slice(0, 8).toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="attendance-print-button"
            onClick={handlePrint}
            disabled={!selectedSheet}
          >
            <FileDown size={18} />
            Imprimer / enregistrer en PDF
          </button>
        </div>
      </div>

      {loading && (
        <div className="attendance-message no-print">Chargement des émargements…</div>
      )}

      {error && <div className="attendance-error no-print">{error}</div>}

      {!loading && !error && !selectedSheet && (
        <div className="attendance-message no-print">
          {sheetSearch ? 'Aucune feuille ne correspond à cette recherche.' : 'Aucune séance d’émargement n’est encore disponible.'}
        </div>
      )}

      {selectedSheet && (
        <article className="attendance-print-sheet" aria-label="Feuille d’émargement">
          <header className="attendance-sheet-header">
            <div>
              <p className="attendance-organization">FORMAPROMPT</p>
              <p>Formation IA, bureautique et outils numériques</p>
            </div>
            <div className="attendance-document-title">
              <Printer size={24} aria-hidden="true" />
              <h1>Feuille d’émargement</h1>
            </div>
          </header>

          <section className="attendance-identification">
            <div>
              <span>Formation</span>
              <strong>{selectedSheet.courseTitle}</strong>
            </div>
            <div>
              <span>Apprenant</span>
              <strong>{selectedSheet.learnerName}</strong>
              {selectedSheet.learnerEmail &&
                selectedSheet.learnerEmail !== selectedSheet.learnerName && (
                  <small>{selectedSheet.learnerEmail}</small>
                )}
            </div>
            <div>
              <span>Formateur</span>
              <strong>Thierry FREZARD</strong>
            </div>
            <div>
              <span>Durée planifiée</span>
              <strong>{formatDuration(totalMinutes)}</strong>
            </div>
            <div>
              <span>Référence du dossier</span>
              <strong>{selectedSheet.id.slice(0, 8).toUpperCase()}</strong>
            </div>
          </section>

          <table className="attendance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Horaires</th>
                <th>Modalité</th>
                <th>Confirmation apprenant</th>
                <th>Validation formateur</th>
              </tr>
            </thead>
            <tbody>
              {selectedSheet.sessions.map((session) => (
                <tr key={session.id}>
                  <td>{formatDate(session.session_starts_at)}</td>
                  <td>
                    {formatTime(session.session_starts_at)}–{formatTime(session.session_ends_at)}
                  </td>
                  <td>{DELIVERY_LABELS[session.delivery_mode] || session.delivery_mode}</td>
                  <td>
                    <strong>{session.learner_signature_png ? 'Signé' : 'Non signé'}</strong>
                    {session.learner_signature_png && (
                      <img className="attendance-row-signature" src={byteaToPngDataUrl(session.learner_signature_png)} alt="Signature de l’apprenant" />
                    )}
                    <small>{formatDateTime(session.learner_confirmed_at)}</small>
                    {session.learner_signed_payload_sha256 && <small>Empreinte : {shortSignatureHash(session.learner_signed_payload_sha256)}</small>}
                  </td>
                  <td>
                    <strong>
                      {TRAINER_STATUS_LABELS[session.trainer_status] ||
                        session.trainer_status}
                    </strong>
                    {session.trainer_signature_png && (
                      <img className="attendance-row-signature" src={byteaToPngDataUrl(session.trainer_signature_png)} alt="Signature du formateur" />
                    )}
                    <small>{formatDateTime(session.trainer_validated_at)}</small>
                    {session.trainer_signed_payload_sha256 && <small>Empreinte : {shortSignatureHash(session.trainer_signed_payload_sha256)}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="attendance-summary">
            <p>
              <strong>Nombre de séances :</strong> {selectedSheet.sessions.length}
            </p>
            <p>
              <strong>Séances confirmées par l’apprenant :</strong>{' '}
              {
                selectedSheet.sessions.filter(
                  (session) => session.learner_signature_png
                ).length
              }
            </p>
            <p>
              <strong>Séances validées par le formateur :</strong>{' '}
              {
                selectedSheet.sessions.filter(
                  (session) =>
                    session.trainer_status &&
                    session.trainer_status !== 'pending'
                ).length
              }
            </p>
          </section>

          <section className="attendance-signatures">
            <div>
              <h2>Émargement de l’apprenant</h2>
              <p>
                Les signatures présentées ci-dessus ont été dessinées depuis le
                compte authentifié de l’apprenant et horodatées par le serveur.
              </p>
            </div>
            <div>
              <h2>Validation du formateur</h2>
              <p>
                Les statuts et signatures du formateur ont été enregistrés depuis
                un compte habilité et sont conservés avec une empreinte de contrôle.
              </p>
            </div>
          </section>

          <footer className="attendance-sheet-footer">
            <p>Document généré le {formatDateTime(new Date().toISOString())}</p>
            <p>Référence : {selectedSheet.id}</p>
          </footer>
        </article>
      )}
    </div>
  );
}
