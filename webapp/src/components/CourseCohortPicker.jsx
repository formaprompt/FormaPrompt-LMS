import { useMemo, useState } from 'react';
import './CourseCohorts.css';

const FORMAT_LABELS = {
  four_half_days_3h30: '4 demi-journées de 3 h 30',
  two_days_2x3h30: '2 jours : 2 demi-journées de 3 h 30',
};

function formatSession(session) {
  const start = new Date(session.starts_at);
  const end = new Date(session.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Horaire à confirmer';
  return `${start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function isJoinable(cohort) {
  return ['published', 'confirmed'].includes(cohort.status) && Number(cohort.available_places) > 0;
}

export default function CourseCohortPicker({
  courseId,
  cohorts = [],
  loading = false,
  error = '',
  joiningCohortId = '',
  onJoin,
}) {
  const [localJoiningId, setLocalJoiningId] = useState('');
  const [localError, setLocalError] = useState('');
  const displayedCohorts = useMemo(() => cohorts.filter((cohort) => cohort.course_id === courseId), [cohorts, courseId]);

  if (loading) return <p role="status">Chargement des prochaines sessions inter…</p>;

  return (
    <section className="course-cohorts" aria-labelledby="course-cohorts-title">
      <header>
        <p className="course-cohorts__eyebrow">Formation inter-entreprises</p>
        <h2 id="course-cohorts-title">Choisir une session publiée</h2>
        <p>Les dates et le nombre de places sont mis à jour par FormaPrompt. La formation reste accompagnée par le formateur.</p>
      </header>

      {(error || localError) && <p className="course-cohorts__message course-cohorts__message--error" role="alert">{localError || error}</p>}

      {displayedCohorts.length === 0 ? (
        <p className="course-cohorts__empty" role="status">Aucune session inter n’est publiée actuellement. Vous pouvez contacter FormaPrompt pour être informé des prochaines dates.</p>
      ) : (
        <div className="course-cohorts__grid">
          {displayedCohorts.map((cohort) => {
            const joinable = isJoinable(cohort);
            const joining = joiningCohortId === cohort.id || localJoiningId === cohort.id;
            const sessions = [...(cohort.sessions || [])].sort((a, b) => a.position - b.position);
            return (
              <article key={cohort.id} className="course-cohorts__card">
                <div className="course-cohorts__card-heading">
                  <h3>{FORMAT_LABELS[cohort.schedule_format] || 'Format de 14 heures'}</h3>
                  <span className={`course-cohorts__status course-cohorts__status--${cohort.status}`}>{cohort.status === 'cancelled' ? 'Annulée' : cohort.status === 'confirmed' ? 'Confirmée' : joinable ? 'Places disponibles' : 'Complète'}</span>
                </div>
                <ul className="course-cohorts__sessions" aria-label="Dates de la session">
                  {sessions.map((session) => <li key={session.id || `${session.position}-${session.starts_at}`}>{formatSession(session)}</li>)}
                </ul>
                <p className="course-cohorts__places"><strong>{Math.max(0, Number(cohort.available_places) || 0)}</strong> place{Number(cohort.available_places) > 1 ? 's' : ''} restante{Number(cohort.available_places) > 1 ? 's' : ''} sur {cohort.capacity}</p>
                <button type="button" className="btn btn-primary" disabled={!joinable || joining} onClick={async () => {
                  setLocalError(''); setLocalJoiningId(cohort.id);
                  try { await onJoin?.(cohort.id); } catch (joinError) { setLocalError(joinError?.message || 'L’inscription ne peut pas être enregistrée pour le moment.'); } finally { setLocalJoiningId(''); }
                }}>
                  {joining ? 'Inscription en cours…' : joinable ? 'Rejoindre cette session' : cohort.status === 'cancelled' ? 'Session annulée' : 'Session complète'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
