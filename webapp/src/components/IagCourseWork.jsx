import { useEffect, useId, useRef, useState } from 'react';
const date = value => value ? new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '';
const essentialLabel = { attained: 'Atteint', not_attained: 'Non atteint', not_observed: 'Non observé' };
export default function IagCourseWork(props) {
  const { userId = '', workId, rubric } = props;
  return <CourseWorkForm key={`${userId}:${workId}:${rubric.version}`} {...props} />;
}

function CourseWorkForm({ api, userId, workId, rubric, history = [], onChanged, registrationConditions = '' }) {
  const uid = useId(); const [responseText, setResponseText] = useState('');
  const [assistants, setAssistants] = useState(''); const [changes, setChanges] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const receipts = history.filter(row => (!userId || row.user_id === userId) && String(row.work_id) === String(workId)).sort((a, b) => a.ordinal - b.ordinal);
  const allowed = receipts.length === 0 || (receipts.length === 1 && Boolean(receipts[0].review_id));
  const lifecycle = useRef(null);
  const pending = useRef(false);
  useEffect(() => {
    const scope = { active: true };
    lifecycle.current = scope;
    return () => { scope.active = false; };
  }, []);
  async function submit(event) {
    event.preventDefault();
    const scope = lifecycle.current;
    if (!allowed || pending.current || !scope?.active) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      await api.submitWork({ workId, responseText, assistants: assistants.split('\n').map(v => v.trim()).filter(Boolean), changes, registrationConditions });
      if (!scope.active) return;
      setResponseText(''); setChanges(''); setMessage('Travail reçu. La réception et l’échéance du retour sont enregistrées.');
      await onChanged?.();
    } catch (error) { if (scope.active) setMessage(error.message || 'La remise n’a pas été enregistrée.'); }
    finally { pending.current = false; if (scope.active) setBusy(false); }
  }
  return <section aria-label={`Travail ${workId}`}>
    <h3>Travail {workId}</h3><p>{receipts.length}/2 remises effectives. Une nouvelle remise est comprise après le premier retour. Conservez le sujet, le dossier et la consigne.</p>
    <p>Retour sous deux jours calendaires après réception, week-ends et jours fériés compris. Aucune date limite de remise n’est définie ici.</p>
    {receipts.map(row => <article key={row.response_id}>
      <h4>{row.ordinal === 1 ? 'Remise initiale' : 'Nouvelle remise'} — version {row.response_id}</h4>
      <p>Reçue le {date(row.received_at)}. Retour attendu le {date(row.due_at)} (Paris).</p>
      <details><summary>Relire cette version</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{row.response_text}</pre><p>{row.changes}</p></details>
      {row.review_id ? <div><h5>{row.ordinal === 1 ? 'Correction initiale' : 'Vérification ciblée'}</h5>
        <p>Retour du {date(row.returned_at)} · auteur {row.reviewer_id}</p>
        <p>Décision humaine : {row.decision === 'validated' ? 'Validé' : 'À compléter'}</p>
        <p>Note {row.complete ? 'complète' : 'partielle'} : {row.points}/20 ({row.observed}/20 observables examinés).</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{row.feedback_text}</p><p>Points à travailler : {row.changes_required || 'Voir le retour.'}</p>
        <details><summary>Critères et preuves de l’évaluation</summary>
          <ul>{rubric.essentials.map(e => <li key={e.id}>{e.label} — {essentialLabel[row.essentials?.[e.id]?.state] || 'Non observé'} : {row.essentials?.[e.id]?.evidence || 'Preuve non renseignée'}</li>)}</ul>
          <ul>{rubric.observations.map(o => <li key={o.id}>{o.label} — {row.observations?.[o.id]?.value ?? 'Non observé'} : {row.observations?.[o.id]?.evidence || 'Preuve non renseignée'}</li>)}</ul>
          <p>Essais réels vérifiés : {row.real_trials_evidence || 'À compléter'}</p>
        </details>
      </div> : <p>Retour en attente.</p>}
    </article>)}
    {allowed ? <form onSubmit={submit} aria-label={`Remettre le travail ${workId}`}>
      <fieldset disabled={busy}><legend>{receipts.length ? 'Nouvelle remise après retour' : 'Remise initiale'}</legend>
        <label htmlFor={`${uid}-response`}>Dossier et preuves : demandes, réponses, contrôles et résultats</label>
        <textarea id={`${uid}-response`} maxLength={20000} required value={responseText} onChange={e => setResponseText(e.target.value)} />
        <label htmlFor={`${uid}-assistants`}>Assistants réellement utilisés (un par ligne ; vide pour une voie manuelle)</label>
        <textarea id={`${uid}-assistants`} maxLength={2000} value={assistants} onChange={e => setAssistants(e.target.value)} />
        {receipts.length > 0 && <><label htmlFor={`${uid}-changes`}>Changements répondant au premier retour et leurs preuves</label><textarea id={`${uid}-changes`} maxLength={10000} required value={changes} onChange={e => setChanges(e.target.value)} /></>}
        <p>Utilisez uniquement les données fictives de l’exercice. La voie manuelle permet de poursuivre ; les essais réels d’IA restent nécessaires à la mention Réussite.</p>
        <button type="submit">{busy ? 'Envoi…' : 'Remettre cette version'}</button>
      </fieldset>
    </form> : <p>{receipts.length >= 2 ? 'Les deux remises comprises ont été reçues. Les points à travailler restent consultables.' : 'La nouvelle remise sera disponible après le retour initial.'}</p>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
