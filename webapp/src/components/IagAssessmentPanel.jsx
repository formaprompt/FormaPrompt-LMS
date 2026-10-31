import { useCallback, useEffect, useMemo, useState } from 'react';
import { WORK_IDS } from '../../supabase/functions/_shared/iagAssessment.js';
import { createIagAssessmentApi } from '../lib/iagAssessmentApi.js';
import IagCourseWork from './IagCourseWork.jsx';
const titles = { 1: 'Courriel professionnel', 2: 'Recherche et travail sur documents', 3: 'Projet final' };

export default function IagAssessmentPanel({ supabase, userId, courseId = 'formation-ia-generative-elearning' }) {
  const api = useMemo(() => createIagAssessmentApi(supabase), [supabase]);
  if (!userId || courseId !== 'formation-ia-generative-elearning') return <p role="alert">Connectez-vous au compte autorisé pour consulter les travaux IAG.</p>;
  return <AssessmentSession key={`${userId}:${courseId}`} api={api} userId={userId} />;
}

function AssessmentSession({ api, userId }) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let current = true;
    Promise.all([api.loadHistory(userId), api.loadRubrics()]).then(([rows, rubrics]) => {
      if (current) setResult({ api, revision, history: rows, rubrics, error: '' });
    }).catch(failure => {
      if (current) setResult({ api, revision, history: null, rubrics: null, error: failure.message || 'Lecture des travaux indisponible.' });
    });
    return () => { current = false; };
  }, [api, revision, userId]);
  const current = result?.api === api && result.revision === revision;
  const history = current ? result.history : null;
  const rubrics = current ? result.rubrics : null;
  const error = current ? result.error : '';
  if (error) return <section aria-label="Mes trois travaux"><p role="alert">{error}</p><button type="button" onClick={reload}>Recharger mes travaux</button></section>;
  if (!history || !rubrics) return <p role="status">Chargement de vos remises, grilles et retours…</p>;
  return <section aria-labelledby="iag-work-title">
    <h2 id="iag-work-title">Mes trois travaux et mes retours</h2>
    <p>Chaque travail est noté sur 20. La décision du formateur examine séparément les critères essentiels et vos essais réels d'IA. Aucun seuil de note ne valide automatiquement votre travail.</p>
    {WORK_IDS.map((workId) => <details key={workId}>
      <summary>{workId}. {titles[workId]}</summary>
      <IagCourseWork api={api} userId={userId} workId={workId} rubric={rubrics[workId]} history={history} onChanged={reload} />
    </details>)}
    <p>Le certificat de fin de formation correspond au parcours terminé. La mention Réussite demande les trois validations humaines avec les essais réels attendus. Aucun certificat n'est émis par ce formulaire.</p>
  </section>;
}
