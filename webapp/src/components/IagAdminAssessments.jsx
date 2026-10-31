import { useCallback, useEffect, useMemo, useState } from 'react';
import { createIagAssessmentApi } from '../lib/iagAssessmentApi.js';
import IagAdminAssessment from './IagAdminAssessment.jsx';

export default function IagAdminAssessments({ supabase, viewerId }) {
  const api = useMemo(() => createIagAssessmentApi(supabase), [supabase]);
  if (!viewerId) return <p role="alert">Connectez-vous au compte du personnel autorisé.</p>;
  return <AdminAssessmentSession key={viewerId} api={api} viewerId={viewerId} />;
}

function AdminAssessmentSession({ api, viewerId }) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState(''); const [showHistory, setShowHistory] = useState(false);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let current = true;
    Promise.all([api.loadHistory(), api.loadRubrics()]).then(([rows, rubrics]) => {
      if (current) setResult({ api, revision, history: rows, rubrics, error: '' });
    }).catch(failure => {
      if (current) setResult({ api, revision, history: null, rubrics: null, error: failure.message || 'Lecture des remises indisponible.' });
    });
    return () => { current = false; };
  }, [api, revision]);
  const current = result?.api === api && result.revision === revision;
  const history = current ? result.history : null;
  const rubrics = current ? result.rubrics : null;
  const error = current ? result.error : '';
  const visible = (rubrics ? history || [] : []).filter((row) => (!row.review_id || showHistory) && `${row.user_id} ${row.work_id} ${row.response_id}`.toLowerCase().includes(search.toLowerCase()));
  const date = (value) => new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  return <section aria-labelledby="iag-admin-title" style={{ marginBlock: '2rem' }}>
    <h2 id="iag-admin-title">IAG e-learning : trois travaux sur 20</h2>
    <p>Correction initiale et vérification de la nouvelle remise sont distinguées. L'échéance enregistrée est calculée en jours calendaires, week-ends et jours fériés compris, à l'heure de Paris.</p>
    <label htmlFor="iag-admin-search">Rechercher par identifiant apprenant, travail ou version</label>{' '}
    <input id="iag-admin-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />{' '}
    <label><input type="checkbox" checked={showHistory} onChange={(event) => setShowHistory(event.target.checked)} /> Afficher aussi les retours déjà transmis</label>
    {error && <p role="alert">{error}</p>}
    {(!history || !rubrics) && !error && <p role="status">Chargement des remises et grilles…</p>}
    <button type="button" onClick={reload}>Actualiser les remises</button>
    {history && <p role="status">{visible.length} version(s) affichée(s), {history.filter((row) => !row.review_id).length} retour(s) à transmettre.</p>}
    {visible.map((row) => <details key={row.response_id}>
      <summary>Apprenant {row.user_id} - travail {row.work_id} - {row.ordinal === 1 ? 'remise initiale' : 'nouvelle remise'} - {row.review_id ? 'retour transmis' : `attendu le ${date(row.due_at)}`}</summary>
      {row.review_id ? <article>
        <p>Version {row.response_id} reçue le {date(row.received_at)}. Retour {row.review_id} du {date(row.returned_at)}, formateur {row.reviewer_id}.</p>
        <p>Note {row.complete ? 'complète' : 'partielle'} : {row.points}/20 ({row.observed}/20 observables examinés). Décision humaine : {row.decision === 'validated' ? 'Validé' : 'À compléter'}.</p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{row.response_text}</pre>
        <p style={{ whiteSpace: 'pre-wrap' }}>{row.feedback_text}</p><p>Points à modifier : {row.changes_required || 'Voir le retour.'}</p>
        <ul>{rubrics[row.work_id].observations.map((item) => <li key={item.id}>{item.label} : {row.observations?.[item.id]?.value ?? 'Non observé'} - {row.observations?.[item.id]?.evidence || 'Preuve non renseignée'}</li>)}</ul>
        <ul>{rubrics[row.work_id].essentials.map((item) => <li key={item.id}>{item.label} : {({ attained: 'Atteint', not_attained: 'Non atteint', not_observed: 'Non observé' })[row.essentials?.[item.id]?.state] || 'Non observé'} - {row.essentials?.[item.id]?.evidence || 'Preuve non renseignée'}</li>)}</ul>
        <p>Essais réels vérifiés : {row.real_trials_evidence || 'À compléter'}</p>
      </article> : <IagAdminAssessment key={row.response_id} viewerId={viewerId} api={api} submission={row} rubric={rubrics[row.work_id]} onSaved={reload} />}
    </details>)}
  </section>;
}
