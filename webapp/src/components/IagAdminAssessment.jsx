import { useEffect, useId, useRef, useState } from 'react';

// The identity belongs to the form itself as well as to its parent list.
export default function IagAdminAssessment(props) {
  const { viewerId = '', submission, rubric } = props;
  return <AdminAssessmentForm key={`${viewerId}:${submission.user_id}:${submission.response_id}:${rubric.workId}:${rubric.version}`} {...props} />;
}

function AdminAssessmentForm({ api, submission, rubric, onSaved }) {
  const uid = useId();
  const [observations, setObservations] = useState(() => Object.fromEntries(rubric.observations.map(o => [o.id, { value: null, evidence: '' }])));
  const [essentials, setEssentials] = useState(() => Object.fromEntries(rubric.essentials.map(e => [e.id, { state: 'not_observed', evidence: '' }])));
  const [decision, setDecision] = useState('needs_revision');
  const [feedback, setFeedback] = useState('');
  const [changesRequired, setChangesRequired] = useState('');
  const [realTrialsEvidence, setRealTrialsEvidence] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const values = Object.values(observations);
  const points = values.reduce((sum, o) => sum + (o.value ?? 0), 0);
  const observed = values.filter(o => o.value !== null).length;
  const patch = (set, key, field, value) => set(previous => ({ ...previous, [key]: { ...previous[key], [field]: value } }));
  const lifecycle = useRef(null);
  const pending = useRef(false);
  useEffect(() => {
    const scope = { active: true };
    lifecycle.current = scope;
    return () => { scope.active = false; };
  }, []);
  async function save(event) {
    event.preventDefault();
    const scope = lifecycle.current;
    if (pending.current || submission.review_id || !scope?.active) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      await api.recordReview({ responseId: submission.response_id, observations, essentials, decision, feedback, changesRequired, realTrialsEvidence });
      if (!scope.active) return;
      setMessage('Retour enregistré et disponible dans l’espace apprenant.');
      await onSaved?.();
    } catch (error) { if (scope.active) setMessage(error.message || 'Le retour n’a pas été enregistré.'); }
    finally { pending.current = false; if (scope.active) setBusy(false); }
  }
  const formatDate = value => value ? new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : 'Non renseigné';
  if (submission.review_id) return <p>Cette version possède déjà un retour. Consultez son historique avant de sélectionner une nouvelle remise.</p>;
  return <form onSubmit={save} aria-label={`Évaluation du travail ${rubric.workId}`}>
    <h3>Travail {rubric.workId} — {submission.ordinal === 2 ? 'Vérification ciblée' : 'Correction initiale'}</h3>
    <p>Dossier {submission.user_id} · version {submission.response_id} · grille {rubric.version}</p>
    <p>Réception : {formatDate(submission.received_at)}. Retour attendu : {formatDate(submission.due_at)} (heure de Paris, week-ends et jours fériés compris).</p>
    <p>Conditions déclarées à la remise : {submission.registration_conditions || 'Non renseignées'}</p>
    <p>Assistants déclarés : {(submission.assistants || []).join(', ') || 'Voie manuelle / non renseignés'}</p>
    <details><summary>Version examinée et preuves fournies</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{submission.response_text}</pre><p>Changements : {submission.changes || 'Remise initiale'}</p></details>
    <fieldset disabled={busy}><legend>Observables — grille V7 sur 20</legend>
      <p aria-live="polite">{points}/20 — note {observed === 20 ? 'complète' : 'partielle'} ({observed}/20 observables examinés).</p>
      {rubric.observations.map(o => <div key={o.id}>
        <label htmlFor={`${uid}-${o.id}`}>{o.group} — {o.label}</label>
        <select id={`${uid}-${o.id}`} value={observations[o.id].value ?? 'unobserved'} onChange={e => patch(setObservations, o.id, 'value', e.target.value === 'unobserved' ? null : Number(e.target.value))}>
          <option value="unobserved">Non observé</option><option value="0">0 — non constaté</option><option value="1">1 — constaté</option>
        </select>
        <label htmlFor={`${uid}-${o.id}-proof`}>Preuve et repère dans cette version</label>
        <textarea id={`${uid}-${o.id}-proof`} maxLength={3000} required={observations[o.id].value !== null} value={observations[o.id].evidence} onChange={e => patch(setObservations, o.id, 'evidence', e.target.value)} />
      </div>)}
    </fieldset>
    <fieldset disabled={busy}><legend>Critères essentiels, distincts de la note</legend>
      {rubric.essentials.map(e => <div key={e.id}>
        <label htmlFor={`${uid}-${e.id}`}>{e.id} — {e.label}</label>
        <select id={`${uid}-${e.id}`} value={essentials[e.id].state} onChange={event => patch(setEssentials, e.id, 'state', event.target.value)}>
          <option value="not_observed">Non observé</option><option value="not_attained">Non atteint</option><option value="attained">Atteint</option>
        </select>
        <label htmlFor={`${uid}-${e.id}-proof`}>Preuve du critère</label>
        <textarea id={`${uid}-${e.id}-proof`} maxLength={3000} required={essentials[e.id].state !== 'not_observed'} value={essentials[e.id].evidence} onChange={event => patch(setEssentials, e.id, 'evidence', event.target.value)} />
      </div>)}
    </fieldset>
    <fieldset disabled={busy}><legend>Décision pédagogique humaine</legend>
      <p>Aucun seuil de note ne décide de la validation. Examinez les critères essentiels et les essais réels attendus.</p>
      <label htmlFor={`${uid}-trials`}>Preuves des essais réels (deux assistants texte pour le travail 3)</label>
      <textarea id={`${uid}-trials`} maxLength={10000} required={decision === 'validated'} value={realTrialsEvidence} onChange={e => setRealTrialsEvidence(e.target.value)} />
      <label htmlFor={`${uid}-decision`}>Décision</label><select id={`${uid}-decision`} value={decision} onChange={e => setDecision(e.target.value)}>
        <option value="needs_revision">À compléter</option><option value="validated">Validé humainement</option>
      </select>
      <label htmlFor={`${uid}-feedback`}>Retour et motif de la décision</label><textarea id={`${uid}-feedback`} maxLength={10000} required value={feedback} onChange={e => setFeedback(e.target.value)} />
      <label htmlFor={`${uid}-changes`}>Points à modifier et preuves attendues</label><textarea id={`${uid}-changes`} maxLength={10000} value={changesRequired} onChange={e => setChangesRequired(e.target.value)} />
      <button type="submit">{busy ? 'Enregistrement…' : 'Transmettre le retour dans l’espace apprenant'}</button>
    </fieldset><p role="status" aria-live="polite">{message}</p>
  </form>;
}
