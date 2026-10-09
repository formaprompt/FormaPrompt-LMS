import { useCallback, useEffect, useRef, useState } from 'react';
import { adminChallengeTrainingApi, challengeDate, challengeTrainingApi, trainingEndError, trainingEndStatus } from '../lib/aiActChallenge';

// Les déclarations et décisions restent distinctes des résultats du jeu.
function useTrainingRequest(api, subjectUserId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const generation = useRef(0);
  const lock = useRef(false);
  const request = useCallback(async (action, payload = {}) => {
    if (lock.current) return;
    const scope = generation.current;
    lock.current = true; setBusy(true); setError(null);
    const mutation = !['status', 'analyse'].includes(action);
    if (mutation) setPending({ action, payload });
    try {
      const next = await api(action, subjectUserId ? { subject_user_id: subjectUserId, ...payload } : payload);
      if (scope !== generation.current) return;
      setData(next); setPending(null);
      return next;
    } catch (failure) {
      if (scope !== generation.current) return;
      const problem = trainingEndError(failure);
      setError(problem);
      if (problem.denied) setData(null);
      if (problem.denied || problem.conflict || problem.text !== trainingEndError({}).text) setPending(null);
    } finally {
      if (scope === generation.current) { lock.current = false; setBusy(false); }
    }
  }, [api, subjectUserId]);
  const reloadAction = subjectUserId ? 'analyse' : 'status';
  useEffect(() => {
    let mounted = true;
    generation.current += 1; lock.current = false;
    queueMicrotask(() => { if (mounted) { setData(null); setError(null); setPending(null); request(reloadAction); } });
    return () => { mounted = false; generation.current += 1; };
  }, [request, reloadAction]);
  return { data, error, busy, pending, request, reloadAction };
}

function RequestError({ operation }) {
  const { error, busy, pending, request, reloadAction } = operation;
  if (!error) return null;
  return <div role="alert" className="aac-error"><p>{error.text}</p>{!error.denied && <button disabled={busy} onClick={() => pending ? request(pending.action, pending.payload) : request(reloadAction)}>{pending ? 'Réessayer la même demande' : 'Recharger la fin de formation'}</button>}</div>;
}

function EndStatus({ status }) {
  return <><p>État : <strong>{trainingEndStatus(status.state)}</strong></p>
    {status.declared_ended_at && <p>Date déclarée : {challengeDate(status.declared_ended_at)}</p>}
    {status.state === 'verified' && status.ended_at ? <><p>Fin effective vérifiée : {challengeDate(status.ended_at)}</p><p>Vérification : {challengeDate(status.verified_at)}</p>{status.due_at && <p>Échéance de conservation du Challenge : {challengeDate(status.due_at)}</p>}</> : <p>Aucun délai de conservation ne démarre sur cette déclaration. La fin effective doit être vérifiée sur justificatifs.</p>}
  </>;
}

const proofLabels = { id: 'Identifiant de la pièce', reference: 'Référence', document_type: 'Type de pièce', status: 'État', issued_at: 'Délivrée le', issued_by: 'Délivrée par', generated_at: 'Générée le', generated_by: 'Générée par', content_snapshot: 'Contenu du justificatif', course_id: 'Formation', user_id: 'Apprenant', enrollment_id: 'Dossier de formation', starts_at: 'Début prévu', ends_at: 'Fin prévue', completed_at: 'Clôture administrative', abandoned_at: 'Abandon enregistré', archived_at: 'Archivage', title: 'Intitulé', display_name: 'Nom affiché', learner_name: 'Apprenant', hours: 'Heures', duration_hours: 'Durée en heures', sessions: 'Séances', date: 'Date', booking_request_id: 'Demande liée', submission_id: 'Travail remis', review_id: 'Évaluation liée', signature: 'Signature', attendance: 'Présence' };
const proofValues = { realisation: 'Attestation de réalisation', competences: 'Attestation de compétences', attendance_sheet: 'Feuille de présence', completed: 'Terminé', archived: 'Archivé', in_progress: 'En cours', formation: 'Formation' };
function ProofContent({ value }) {
  if (value == null) return <span>—</span>;
  if (Array.isArray(value)) return value.length ? <ol>{value.map((item, index) => <li key={index}><ProofContent value={item} /></li>)}</ol> : <p>Aucun élément.</p>;
  if (typeof value === 'object') return <dl>{Object.entries(value).map(([key, item]) => <div key={key}><dt><strong>{proofLabels[key] || key.replaceAll('_', ' ')}</strong></dt><dd><ProofContent value={item} /></dd></div>)}</dl>;
  const text = typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value);
  return <span>{proofValues[text] || text}</span>;
}

export default function AiActChallengeTrainingEnd({ api = challengeTrainingApi }) {
  const operation = useTrainingRequest(api);
  const [date, setDate] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const { data, busy, pending, error, request } = operation;
  return <section className="aac-card" aria-label="Fin de votre formation" aria-busy={busy}>
    <h3>Fin de votre formation</h3>
    <p>Déclarez la fin de votre parcours complet. Terminer le Challenge ne clôture pas la formation.</p>
    {busy && <p role="status">Vérification de la demande…</p>}
    <RequestError operation={operation} />
    {data && <><EndStatus status={data} />{data.state === 'ongoing' && <form onSubmit={(event) => { event.preventDefault(); request('declare', { request_id: crypto.randomUUID(), expected_revision: data.revision, declared_ended_at: new Date(date).toISOString(), confirmed: true }); }}>
      <label>Date de fin déclarée<input type="datetime-local" required value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="aac-check"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Je déclare avoir terminé le parcours de formation ; cette déclaration reste à vérifier.</label>
      <button disabled={busy || Boolean(pending) || Boolean(error) || !date || !confirmed} type="submit">Déclarer la fin de ma formation</button>
    </form>}</>}
  </section>;
}

export function AiActChallengeTrainingEndAdmin({ subjectUserId, api = adminChallengeTrainingApi }) {
  const operation = useTrainingRequest(api, subjectUserId);
  const { data, busy, pending, error, request } = operation;
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [reference, setReference] = useState('');
  const [hash, setHash] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [revisionAction, setRevisionAction] = useState('review');
  const candidates = [ ...(data?.evidence_candidates?.attestations || []).map((item) => ({ ...item, kind: 'attestation' })), ...(data?.evidence_candidates?.documents || []).map((item) => ({ ...item, kind: 'document' })) ];
  const blocked = busy || Boolean(pending) || Boolean(error);
  const needsRevision = data?.status.state === 'verified' || data?.history?.at(-1)?.action === 'verify';
  return <section className="aac-card" aria-label="Vérification administrative de la fin" aria-busy={busy}>
    <h3>Vérifier la fin effective de formation</h3>
    <p>Administrateur uniquement. Examinez le dossier complet et les justificatifs avant de formaliser votre décision. La date du clic de clôture et le score du jeu ne prouvent pas la fin effective.</p>
    {busy && <p role="status">Chargement du dossier de fin…</p>}
    <RequestError operation={operation} />
    {data && <><EndStatus status={data.status} />
      {data.enrollments && <details style={{ overflowWrap: 'anywhere' }}><summary>Examiner les dossiers de formation liés</summary><ProofContent value={data.enrollments} /><p>Ces dates administratives sont des éléments de contexte. Elles ne remplacent pas l’examen des justificatifs pédagogiques.</p></details>}
      <details style={{ overflowWrap: 'anywhere' }}><summary>Examiner les justificatifs disponibles</summary>{!candidates.length && <p>Aucun justificatif lié disponible. Une pièce externe contrôlée peut être référencée.</p>}{candidates.map(({ kind, ...item }) => <article key={`${kind}:${item.id}`}><h4>{kind === 'attestation' ? 'Attestation' : 'Document'} · {item.title || item.reference || proofValues[item.document_type] || item.id}</h4><ProofContent value={item} /></article>)}</details>
      {data.closure && <details><summary>Décision enregistrée et traçabilité</summary>
        <p>Révision : {data.closure.revision} · Administrateur : {data.closure.verified_by || '—'} · Vérification : {challengeDate(data.closure.verified_at)}</p>
        <p>Référence du justificatif : {data.closure.evidence_reference || '—'}</p>
        <ol>{(data.history || []).map((item) => <li key={item.revision}>Révision {item.revision} · {({ declare: 'Déclaration apprenant', verify: 'Fin vérifiée', reopen: 'Reprise réelle', review: 'Réexamen demandé' })[item.action] || 'Décision'} · {challengeDate(item.recorded_at)} · Auteur : {item.actor_user_id || '—'} · Motif : {item.reason_code}</li>)}</ol>
      </details>}
      {needsRevision && <form onSubmit={(event) => { event.preventDefault(); setConfirmed(false); setReviewed(false); request(revisionAction, { request_id: crypto.randomUUID(), expected_revision: data.status.revision, reason_code: reason.trim().toUpperCase(), confirmed: true }); }}>
        <p>Une reprise réelle ou une décision à réexaminer invalide la fin précédente. Une nouvelle vérification sera nécessaire.</p>
        <label>Décision de révision<select value={revisionAction} onChange={(event) => { setRevisionAction(event.target.value); setConfirmed(false); }}><option value="review">Fin à réexaminer</option><option value="reopen">Reprise réelle du parcours</option></select></label>
        <label>Motif de révision (code, sans donnée personnelle)<input required minLength={3} maxLength={80} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <label className="aac-check"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Je confirme la décision sélectionnée et l’invalidation de la fin précédente.</label>
        <button type="submit" disabled={blocked || !reason || !confirmed}>Enregistrer la révision motivée</button>
      </form>}
      {!needsRevision && <form onSubmit={(event) => {
        event.preventDefault();
        const [kind, id] = evidence.split(':');
        setConfirmed(false); setReviewed(false);
        request('verify', { request_id: crypto.randomUUID(), expected_revision: data.status.revision, ended_at: new Date(date).toISOString(), reason_code: reason.trim().toUpperCase(), confirmed: true, evidence_reviewed: true, evidence_kind: kind, ...(kind === 'controlled_external' ? { evidence_reference: reference.trim().toUpperCase(), evidence_sha256: hash.trim().toLowerCase() } : { evidence_id: id }) });
      }}>
        <label>Date de fin effective vérifiée<input type="datetime-local" required value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Motif de décision (code, sans donnée personnelle)<input required minLength={3} maxLength={80} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="FIN-PARCOURS-VERIFIEE" /></label>
        <label>Justificatif examiné<select required value={evidence} onChange={(event) => { setEvidence(event.target.value); setReviewed(false); }}><option value="">Sélectionner une pièce</option>{candidates.map((item) => <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{item.kind === 'attestation' ? 'Attestation' : 'Document'} · {item.title || item.reference || proofValues[item.document_type] || item.id}</option>)}<option value="controlled_external">Pièce externe contrôlée</option></select></label>
        {evidence === 'controlled_external' && <><p>Consultez réellement la pièce externe dans votre dossier sécurisé. L’empreinte identifie le fichier ; elle ne prouve pas à elle seule son contenu.</p><label>Référence de la pièce externe (code)<input required minLength={3} maxLength={80} value={reference} onChange={(event) => setReference(event.target.value)} /></label><label>Empreinte SHA-256 de la pièce consultée<input required pattern="[a-fA-F0-9]{64}" value={hash} onChange={(event) => setHash(event.target.value)} /></label></>}
        <label className="aac-check"><input type="checkbox" required checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> J’ai consulté le justificatif et vérifié qu’il établit la fin effective du parcours.</label>
        <label className="aac-check"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Je confirme cette décision manuelle et sa date effective.</label>
        <button type="submit" disabled={blocked || !date || !reason || !evidence || !reviewed || !confirmed}>Enregistrer la fin effective vérifiée</button>
      </form>}
    </>}
  </section>;
}
