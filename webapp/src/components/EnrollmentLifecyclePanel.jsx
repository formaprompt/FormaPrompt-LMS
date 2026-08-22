import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EVENT_LABELS, FUNDING_STATUS_LABELS, euroAmount, sortedLifecycleItems } from '../lib/enrollmentLifecycle';

function localDateTime(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function emptyAction(enrollment) {
  return {
    reason: '', actorLabel: '', origin: '', targetUserId: '', learnerFirstName: '', learnerLastName: '', learnerEmail: '',
    startsAt: localDateTime(enrollment.starts_at), endsAt: localDateTime(enrollment.ends_at),
  };
}

export default function EnrollmentLifecyclePanel({ enrollment, profiles, running, onAction }) {
  const [funding, setFunding] = useState({
    status: enrollment.funding_status || 'not_requested',
    requestedCents: enrollment.funding_requested_cents ?? enrollment.price_amount_cents ?? 0,
    grantedCents: enrollment.funding_granted_cents ?? '',
    funderName: enrollment.funder_name || '', fundingReference: enrollment.funding_reference || '', reason: '',
  });
  const [actionType, setActionType] = useState('postpone_enrollment');
  const [exception, setException] = useState(() => emptyAction(enrollment));
  const [amendment, setAmendment] = useState({ effectiveDate: new Date().toISOString().slice(0, 10), reason: '', changeSummary: '' });
  const timeline = useMemo(() => sortedLifecycleItems(enrollment), [enrollment]);
  const locked = ['completed', 'archived', 'cancelled', 'abandoned'].includes(enrollment.status);
  const update = (setter, name, value) => setter((current) => ({ ...current, [name]: value }));

  async function submitFunding(event) {
    event.preventDefault();
    const ok = await onAction(enrollment.id, 'update_funding', {
      funding: {
        ...funding,
        requestedCents: funding.status === 'not_requested' ? null : Number(funding.requestedCents),
        grantedCents: funding.grantedCents === '' ? null : Number(funding.grantedCents),
      },
    });
    if (ok) update(setFunding, 'reason', '');
  }

  async function submitException(event) {
    event.preventDefault();
    const payload = { ...exception };
    if (actionType === 'postpone_enrollment') {
      payload.startsAt = new Date(exception.startsAt).toISOString();
      payload.endsAt = new Date(exception.endsAt).toISOString();
    }
    const ok = await onAction(enrollment.id, actionType, { exception: payload });
    if (ok) setException(emptyAction(enrollment));
  }

  async function submitAmendment(event) {
    event.preventDefault();
    const ok = await onAction(enrollment.id, 'create_amendment', {
      amendment: {
        ...amendment,
        previousValues: { status: enrollment.status, startsAt: enrollment.starts_at, endsAt: enrollment.ends_at },
        newValues: { summary: amendment.changeSummary },
      },
    });
    if (ok) setAmendment((current) => ({ ...current, reason: '', changeSummary: '' }));
  }

  return (
    <details className="admin-enrollments__lifecycle">
      <summary>Financement, exceptions, avenants et historique</summary>
      <section className="admin-enrollments__funding-summary" aria-label="Synthèse du financement">
        <strong>{FUNDING_STATUS_LABELS[enrollment.funding_status] || 'Non demandé'}</strong>
        <span>Demandé : {euroAmount(enrollment.funding_requested_cents)}</span>
        <span>Accordé : {euroAmount(enrollment.funding_granted_cents)}</span>
        <span>Reste : {euroAmount(enrollment.funding_balance_cents)}</span>
        <small>Ces montants n’attribuent aucun droit pédagogique.</small>
      </section>

      <form className="admin-enrollments__lifecycle-form" onSubmit={submitFunding}>
        <h4>Suivi OF / OPCO</h4>
        <label>Statut<select value={funding.status} onChange={(event) => update(setFunding, 'status', event.target.value)}>{Object.entries(FUNDING_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Demandé (€)<input type="number" min="0" step="1" value={Number(funding.requestedCents) / 100} onChange={(event) => update(setFunding, 'requestedCents', Math.round(Number(event.target.value) * 100))} /></label>
        <label>Accordé (€)<input type="number" min="0" step="1" value={funding.grantedCents === '' ? '' : Number(funding.grantedCents) / 100} onChange={(event) => update(setFunding, 'grantedCents', event.target.value === '' ? '' : Math.round(Number(event.target.value) * 100))} /></label>
        <label>Financeur<input maxLength="200" value={funding.funderName} onChange={(event) => update(setFunding, 'funderName', event.target.value)} /></label>
        <label>Référence<input maxLength="120" value={funding.fundingReference} onChange={(event) => update(setFunding, 'fundingReference', event.target.value)} /></label>
        <label className="admin-enrollments__wide">Motif obligatoire<textarea required minLength="3" maxLength="2000" value={funding.reason} onChange={(event) => update(setFunding, 'reason', event.target.value)} /></label>
        <button className="btn" disabled={Boolean(running)}>Enregistrer le financement</button>
      </form>

      {!locked && <form className="admin-enrollments__lifecycle-form" onSubmit={submitException}>
        <h4>Exception administrative</h4>
        <label>Action<select value={actionType} onChange={(event) => setActionType(event.target.value)}><option value="postpone_enrollment">Reporter</option><option value="cancel_enrollment">Annuler</option><option value="abandon_enrollment">Enregistrer un abandon</option><option value="transfer_beneficiary">Transférer le bénéficiaire</option></select></label>
        {actionType === 'postpone_enrollment' && <><label>Nouveau début<input type="datetime-local" required value={exception.startsAt} onChange={(event) => update(setException, 'startsAt', event.target.value)} /></label><label>Nouvelle fin<input type="datetime-local" required value={exception.endsAt} onChange={(event) => update(setException, 'endsAt', event.target.value)} /></label></>}
        {actionType === 'cancel_enrollment' && <label>Acteur de l’annulation<input required maxLength="120" value={exception.actorLabel} onChange={(event) => update(setException, 'actorLabel', event.target.value)} /></label>}
        {actionType === 'abandon_enrollment' && <label>Origine de l’abandon<input required maxLength="120" value={exception.origin} onChange={(event) => update(setException, 'origin', event.target.value)} /></label>}
        {actionType === 'transfer_beneficiary' && <><label>Compte cible<select required value={exception.targetUserId} onChange={(event) => { const profile = profiles.find((item) => item.id === event.target.value); setException((current) => ({ ...current, targetUserId: event.target.value, learnerEmail: profile?.email || '' })); }}><option value="">Sélectionner</option>{profiles.filter((profile) => profile.id !== enrollment.user_id).map((profile) => <option key={profile.id} value={profile.id}>{profile.email}</option>)}</select></label><label>Prénom<input required maxLength="100" value={exception.learnerFirstName} onChange={(event) => update(setException, 'learnerFirstName', event.target.value)} /></label><label>Nom<input required maxLength="120" value={exception.learnerLastName} onChange={(event) => update(setException, 'learnerLastName', event.target.value)} /></label></>}
        <label className="admin-enrollments__wide">Motif obligatoire<textarea required minLength="5" maxLength="2000" value={exception.reason} onChange={(event) => update(setException, 'reason', event.target.value)} /></label>
        <p className="admin-enrollments__warning">Aucun achat ni droit pédagogique ne sera supprimé, transféré ou réactivé. Un contrôle séparé des droits est requis après annulation, abandon ou transfert.</p>
        <button className="btn" disabled={Boolean(running)}>Confirmer l’action</button>
      </form>}

      <form className="admin-enrollments__lifecycle-form" onSubmit={submitAmendment}>
        <h4>Créer un avenant figé</h4>
        <label>Date d’effet<input type="date" required value={amendment.effectiveDate} onChange={(event) => update(setAmendment, 'effectiveDate', event.target.value)} /></label>
        <label className="admin-enrollments__wide">Motif<textarea required minLength="5" maxLength="2000" value={amendment.reason} onChange={(event) => update(setAmendment, 'reason', event.target.value)} /></label>
        <label className="admin-enrollments__wide">Modification avant / après<textarea required minLength="5" maxLength="4000" value={amendment.changeSummary} onChange={(event) => update(setAmendment, 'changeSummary', event.target.value)} /></label>
        <button className="btn" disabled={Boolean(running)}>Créer la version figée</button>
      </form>

      <div className="admin-enrollments__timeline">
        <h4>Historique complet</h4>
        {timeline.length === 0 ? <p>Aucun événement.</p> : <ol>{timeline.map((item) => <li key={`${item.kind}-${item.id}`}><strong>{item.kind === 'amendment' ? `Avenant ${item.amendment_number}` : EVENT_LABELS[item.event_type] || item.event_type}</strong><span>{new Date(item.created_at).toLocaleString('fr-FR')}</span><p>{item.reason}</p>{item.kind === 'amendment' && <Link to={`/admin/dossiers/avenants/${item.id}`}>Ouvrir / imprimer</Link>}{item.rights_impact === 'review_required' && <em>Droits pédagogiques à contrôler séparément</em>}</li>)}</ol>}
      </div>
    </details>
  );
}
