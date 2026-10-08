import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchAvailableCourseCohorts, fetchMyCourseCohortEnrollment, joinCourseCohort } from '../lib/courseCohorts';
import { CREATIVITY_GROUP_COURSE_ID } from '../../supabase/functions/_shared/bureautiqueBooking.js';
import CourseCohortPicker from './CourseCohortPicker';

export default function CreativityGroupCohorts({ userId }) {
  const [state, setState] = useState({ userId: null, cohorts: [], enrollment: null, loading: true, error: '' });
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAvailableCourseCohorts(supabase, CREATIVITY_GROUP_COURSE_ID), fetchMyCourseCohortEnrollment(supabase, CREATIVITY_GROUP_COURSE_ID)])
      .then(([cohorts, enrollment]) => { if (!cancelled) setState({ userId, cohorts, enrollment, loading: false, error: '' }); })
      .catch(error => { if (!cancelled) setState({ userId, cohorts: [], enrollment: null, loading: false, error: error?.message || 'Les sessions ne peuvent pas être chargées.' }); });
    return () => { cancelled = true; };
  }, [userId]);
  const current = state.userId === userId ? state : { cohorts: [], enrollment: null, loading: true, error: '' };
  const enrollment = current.enrollment;
  const cancelled = enrollment?.status === 'cohort_cancelled_refund_review' || enrollment?.cohort_status === 'cancelled';
  const confirmed = enrollment?.cohort_status === 'confirmed' && !cancelled;
  const join = async (cohortId) => {
    await joinCourseCohort(supabase, cohortId);
    const [cohorts, selected] = await Promise.all([fetchAvailableCourseCohorts(supabase, CREATIVITY_GROUP_COURSE_ID), fetchMyCourseCohortEnrollment(supabase, CREATIVITY_GROUP_COURSE_ID)]);
    setState({ userId, cohorts, enrollment: selected, loading: false, error: '' });
  };
  return <section id="creativity-group-sessions" aria-labelledby="creativity-group-heading">
    <h2 id="creativity-group-heading">Mes dates — groupe créativité</h2>
    {enrollment ? <>
      <p role="status">{cancelled ? 'Cette session a été annulée.' : confirmed ? 'Votre groupe est confirmé.' : 'Votre choix de session est enregistré. L’ouverture du groupe reste à confirmer par Thierry.'}</p>
      {cancelled ? <p>{enrollment.is_paid ? 'Si le groupe n’ouvre pas, votre paiement est remboursé intégralement. Contactez Thierry pour le suivi du remboursement.' : enrollment.is_administrative || ['manual', 'opco'].includes(enrollment.access_source) ? 'Contactez Thierry pour réorganiser la formation inscrite dans votre dossier.' : 'Cette formation vous a été offerte. Contactez Thierry pour convenir de la suite.'}</p> : <>
        <p>{enrollment.minimum_participants ?? 4} participants minimum, {enrollment.capacity ?? 6} maximum · 4 séances de 3 h 30. {enrollment.delivery_mode === 'in_person' ? 'En présentiel à Calais.' : 'À distance.'}</p>
        <ul aria-label="Mes quatre séances">{(enrollment.sessions || []).map(session => <li key={session.id || session.position}>{new Date(session.starts_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' })} · 3 h 30{confirmed && session.meeting_url && <a href={session.meeting_url} target="_blank" rel="noopener noreferrer"> Rejoindre la visioconférence</a>}</li>)}</ul>
        {!confirmed && enrollment.is_paid && <p>Si le groupe n’ouvre pas, votre paiement est remboursé intégralement.</p>}
      </>}
    </> : <CourseCohortPicker courseId={CREATIVITY_GROUP_COURSE_ID} cohorts={current.cohorts} loading={current.loading} error={current.error} onJoin={join} />}
  </section>;
}
