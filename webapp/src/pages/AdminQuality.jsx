import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import {
  buildQualityOverview, createComplaint, createQualityAction, createQualityRecord, createQualityRisk,
  fetchQualityAdministration, updateComplaint, updateQualityAction, updateQualityRecord, updateQualityRisk,
} from '../lib/qualityAdministration';
import './AdminQuality.css';

const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const dateLabel = (value) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value)) : 'Non définie';
const profileLabel = (profile) => profile.full_name || profile.email || profile.id;

function ComplaintEditor({ item, reload }) {
  const [reason, setReason] = useState('Suivi administratif de la réclamation');
  const [due, setDue] = useState(item.response_due_at?.slice(0, 16) || '');
  const [outcome, setOutcome] = useState(item.outcome);
  const [summary, setSummary] = useState(item.resolution_summary || '');
  const [saving, setSaving] = useState(false);
  const save = async (acknowledge = false) => {
    setSaving(true);
    try {
      const closing = outcome !== 'pending';
      await updateComplaint(supabase, {
        qualityRecordId: item.quality_record_id, reason,
        acknowledgedAt: acknowledge ? new Date().toISOString() : null,
        responseDueAt: due ? new Date(due).toISOString() : null,
        outcome, finalResponseAt: closing ? new Date().toISOString() : null,
        resolutionSummary: closing ? summary : null,
      });
      reload('Réclamation mise à jour.');
    } catch (error) { reload('', error.message); } finally { setSaving(false); }
  };
  return (
    <details className="quality-editor">
      <summary>Traiter la réclamation</summary>
      <div className="quality-form-grid">
        <label>Réponse attendue avant<input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <label>Issue<select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="pending">En attente</option><option value="substantiated">Fondée</option>
          <option value="partially_substantiated">Partiellement fondée</option><option value="unsubstantiated">Non fondée</option>
          <option value="withdrawn">Retirée</option>
        </select></label>
        {outcome !== 'pending' && <label className="quality-field-wide">Réponse finale / synthèse<textarea minLength="10" value={summary} onChange={(e) => setSummary(e.target.value)} /></label>}
        <label className="quality-field-wide">Motif administratif<input minLength="10" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </div>
      <div className="quality-buttons">
        {!item.acknowledged_at && <button type="button" onClick={() => save(true)} disabled={saving}>Accuser réception</button>}
        <button type="button" onClick={() => save(false)} disabled={saving || reason.trim().length < 10 || (outcome !== 'pending' && summary.trim().length < 10)}>Enregistrer</button>
      </div>
    </details>
  );
}

function ActionEditor({ item, profiles, reload }) {
  const [status, setStatus] = useState(item.status);
  const [owner, setOwner] = useState(item.responsible_user_id);
  const [due, setDue] = useState(item.due_at?.slice(0, 16) || '');
  const [evidence, setEvidence] = useState(item.completion_evidence || '');
  const [reason, setReason] = useState('Mise à jour du plan d’amélioration');
  const save = async () => {
    try {
      await updateQualityAction(supabase, { actionId: item.id, status, responsibleUserId: owner, dueAt: due ? new Date(due).toISOString() : null, completionEvidence: evidence, reason });
      reload('Action qualité mise à jour.');
    } catch (error) { reload('', error.message); }
  };
  return <details className="quality-editor"><summary>Mettre à jour</summary><div className="quality-form-grid">
    <label>Statut<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="planned">Planifiée</option><option value="in_progress">En cours</option><option value="blocked">Bloquée</option><option value="completed">Terminée</option><option value="cancelled">Annulée</option></select></label>
    <label>Responsable<select value={owner} onChange={(e) => setOwner(e.target.value)}>{profiles.map((p) => <option key={p.id} value={p.id}>{profileLabel(p)}</option>)}</select></label>
    <label>Échéance<input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></label>
    <label className="quality-field-wide">Preuve de réalisation<textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Obligatoire pour terminer (10 caractères minimum)" /></label>
    <label className="quality-field-wide">Motif administratif<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
  </div><button type="button" onClick={save} disabled={reason.trim().length < 10 || (status === 'completed' && evidence.trim().length < 10)}>Enregistrer</button></details>;
}

function RiskEditor({ item, profiles, reload }) {
  const [values, setValues] = useState({ status: item.status, likelihood: item.likelihood, impact: item.impact, strategy: item.treatment_strategy, ownerUserId: item.owner_user_id, reviewDueAt: item.review_due_at?.slice(0, 16) || '', reason: 'Revue périodique du risque qualité' });
  const change = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const save = async () => {
    try { await updateQualityRisk(supabase, { ...values, riskId: item.id, reviewDueAt: values.reviewDueAt ? new Date(values.reviewDueAt).toISOString() : null }); reload('Risque qualité mis à jour.'); }
    catch (error) { reload('', error.message); }
  };
  return <details className="quality-editor"><summary>Effectuer la revue</summary><div className="quality-form-grid">
    <label>Statut<select value={values.status} onChange={change('status')}><option value="identified">Identifié</option><option value="assessed">Évalué</option><option value="treatment_in_progress">Traitement en cours</option><option value="accepted">Accepté</option><option value="closed">Clôturé</option></select></label>
    <label>Probabilité<input type="number" min="1" max="5" value={values.likelihood} onChange={change('likelihood')} /></label>
    <label>Impact<input type="number" min="1" max="5" value={values.impact} onChange={change('impact')} /></label>
    <label>Stratégie<select value={values.strategy} onChange={change('strategy')}><option value="mitigate">Réduire</option><option value="avoid">Éviter</option><option value="transfer">Transférer</option><option value="accept">Accepter</option><option value="monitor">Surveiller</option></select></label>
    <label>Responsable<select value={values.ownerUserId} onChange={change('ownerUserId')}>{profiles.map((p) => <option key={p.id} value={p.id}>{profileLabel(p)}</option>)}</select></label>
    <label>Prochaine revue<input type="datetime-local" value={values.reviewDueAt} onChange={change('reviewDueAt')} /></label>
    <label className="quality-field-wide">Motif administratif<input value={values.reason} onChange={change('reason')} /></label>
  </div><button type="button" onClick={save} disabled={values.reason.trim().length < 10}>Enregistrer</button></details>;
}

export default function AdminQuality() {
  const { role, user } = useAuth();
  const [data, setData] = useState({ records: [], complaints: [], actions: [], risks: [], profiles: [] });
  const [state, setState] = useState({ loading: true, error: '', success: '' });
  const [tab, setTab] = useState('complaints');
  const [reloadKey, setReloadKey] = useState(0);
  const reload = (success = '', error = '') => { setState({ loading: true, success, error }); setReloadKey((key) => key + 1); };

  useEffect(() => {
    if (role !== 'admin') return;
    let active = true;
    fetchQualityAdministration(supabase).then((result) => { if (active) { setData(result); setState((s) => ({ ...s, loading: false, error: '' })); } })
      .catch((error) => { if (active) setState((s) => ({ ...s, loading: false, error: error.message })); });
    return () => { active = false; };
  }, [reloadKey, role]);

  const overview = useMemo(() => buildQualityOverview(data), [data]);
  const currentOwner = data.profiles.find((p) => p.id === user?.id)?.id || data.profiles[0]?.id || '';

  if (role !== 'admin') return <main className="container admin-quality"><div className="quality-message is-error" role="alert"><h1>Accès réservé</h1><p>Le registre qualité est réservé aux administrateurs.</p></div></main>;
  return <main className="container admin-quality">
    <header className="quality-header"><div><p className="quality-eyebrow">Sprint 6 · Qualité</p><h1>Qualité et réclamations</h1><p>Traiter d’abord ce qui affecte le client, puis piloter les actions et les risques.</p></div></header>
    {state.success && <p className="quality-message is-success" role="status">{state.success}</p>}
    {state.error && <div className="quality-message is-error" role="alert"><p>{state.error}</p><button type="button" onClick={() => reload()}>Réessayer</button></div>}
    {state.loading ? <p className="quality-message" role="status">Chargement du registre qualité…</p> : <>
      <section className="quality-priority" aria-labelledby="quality-priority-title"><div><p className="quality-eyebrow">Satisfaction client d’abord</p><h2 id="quality-priority-title">Réclamations à traiter maintenant</h2></div><strong>{overview.openComplaints.length}</strong></section>
      {overview.openComplaints.length === 0 ? <p className="quality-empty">Aucune réclamation ouverte actuellement.</p> : <div className="quality-card-grid">{overview.openComplaints.map((item) => <article className={`quality-card complaint${item.isOverdue ? ' is-overdue' : ''}`} key={item.quality_record_id}>
        <div className="quality-card-heading"><span>{!item.acknowledged_at ? 'Accusé attendu' : item.isOverdue ? 'Réponse en retard' : 'Suivi en cours'}</span><small>{item.parent.severity || 'medium'}</small></div>
        <h3>{item.parent.title || 'Réclamation'}</h3><p>{item.parent.factual_description}</p>
        <dl><div><dt>Reçue</dt><dd>{dateLabel(item.received_at)}</dd></div><div><dt>Échéance</dt><dd>{dateLabel(item.response_due_at)}</dd></div><div><dt>Actions liées</dt><dd>{item.associatedActions.length}</dd></div></dl>
        <ComplaintEditor item={item} reload={reload} />
      </article>)}</div>}

      <nav className="quality-tabs" aria-label="Vues du registre">
        {[['complaints', 'Réclamations'], ['actions', 'Actions'], ['risks', 'Risques'], ['records', 'Registre']].map(([id, label]) => <button type="button" key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      {tab === 'complaints' && <ComplaintCreateForm ownerId={currentOwner} reload={reload} />}
      {tab === 'actions' && <><ActionCreateForm records={data.records} profiles={data.profiles} ownerId={currentOwner} reload={reload} /><div className="quality-card-grid">{overview.actions.map((item) => <article className={`quality-card${item.isOverdue ? ' is-overdue' : ''}`} key={item.id}><div className="quality-card-heading"><span>{item.isOverdue ? 'En retard' : item.status}</span><small>{item.priority}</small></div><h3>{item.title}</h3><p>{item.action_description}</p><p>Échéance : {dateLabel(item.due_at)}</p><ActionEditor item={item} profiles={data.profiles} reload={reload} /></article>)}</div></>}
      {tab === 'risks' && <><RiskCreateForm records={data.records} profiles={data.profiles} ownerId={currentOwner} reload={reload} /><div className="quality-card-grid">{overview.risks.map((item) => <article className={`quality-card${item.needsReview ? ' is-overdue' : ''}`} key={item.id}><div className="quality-card-heading"><span>{item.needsReview ? 'Revue en retard' : item.status}</span><small>Score {item.risk_score}/25</small></div><h3>{item.title}</h3><p>{item.risk_description}</p><p>Prochaine revue : {dateLabel(item.review_due_at)}</p><RiskEditor item={item} profiles={data.profiles} reload={reload} /></article>)}</div></>}
      {tab === 'records' && <><RecordCreateForm profiles={data.profiles} ownerId={currentOwner} reload={reload} /><div className="quality-card-grid">{data.records.map((item) => <article className="quality-card" key={item.id}><div className="quality-card-heading"><span>{overview.closableRecords.some((record) => record.id === item.id) && item.status !== 'closed' ? 'Clôturable' : item.status}</span><small>{item.severity}</small></div><h3>{item.title}</h3><p>{item.factual_description}</p><p>Détecté le {dateLabel(item.detected_at)}</p><RecordEditor item={item} profiles={data.profiles} reload={reload} /></article>)}</div></>}
    </>}
  </main>;
}

function ComplaintCreateForm({ ownerId, reload }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: '', description: '', severity: 'medium', ownerUserId: ownerId, receivedAt: nowLocal(), channel: 'email', complainantType: 'learner', complainantName: '', complainantEmail: '', responseDueAt: '', reason: 'Ouverture et traçabilité de la réclamation client' });
  const change = (key) => (e) => setV((x) => ({ ...x, [key]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); try { await createComplaint(supabase, { ...v, ownerUserId: v.ownerUserId || ownerId, receivedAt: new Date(v.receivedAt).toISOString(), responseDueAt: v.responseDueAt ? new Date(v.responseDueAt).toISOString() : null }); setOpen(false); reload('Réclamation créée et auditée.'); } catch (error) { reload('', error.message); } };
  return <details className="quality-create" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}><summary>Créer une réclamation</summary><form onSubmit={submit} className="quality-form-grid">
    <label>Titre<input required minLength="3" value={v.title} onChange={change('title')} /></label><label>Gravité<select value={v.severity} onChange={change('severity')}><option value="low">Faible</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="critical">Critique</option></select></label>
    <label className="quality-field-wide">Description factuelle<textarea required minLength="10" value={v.description} onChange={change('description')} /></label>
    <label>Date de réception<input required type="datetime-local" value={v.receivedAt} onChange={change('receivedAt')} /></label><label>Réponse avant<input type="datetime-local" value={v.responseDueAt} onChange={change('responseDueAt')} /></label>
    <label>Canal<select value={v.channel} onChange={change('channel')}><option value="email">E-mail</option><option value="form">Formulaire</option><option value="mail">Courrier</option><option value="phone">Téléphone</option><option value="other">Autre</option></select></label><label>Réclamant<select value={v.complainantType} onChange={change('complainantType')}><option value="learner">Apprenant</option><option value="customer">Client</option><option value="funder">Financeur</option><option value="partner">Partenaire</option><option value="other">Autre</option></select></label>
    <label>Nom (facultatif)<input value={v.complainantName} onChange={change('complainantName')} /></label><label>E-mail (facultatif)<input type="email" value={v.complainantEmail} onChange={change('complainantEmail')} /></label>
    <label>Inscription liée (UUID facultatif)<input value={v.trainingEnrollmentId || ''} onChange={change('trainingEnrollmentId')} /></label><label>Demande commerciale liée (UUID facultatif)<input value={v.contactRequestId || ''} onChange={change('contactRequestId')} /></label>
    <label className="quality-field-wide">Motif administratif<input required minLength="10" value={v.reason} onChange={change('reason')} /></label><button type="submit" disabled={!ownerId}>Créer la réclamation</button>
  </form></details>;
}

function ActionCreateForm({ records, profiles, ownerId, reload }) {
  const openRecords = records.filter((r) => r.status !== 'closed');
  const [v, setV] = useState({ qualityRecordId: '', actionType: 'corrective', title: '', description: '', priority: 'medium', responsibleUserId: ownerId, dueAt: '', reason: 'Création du plan d’amélioration qualité' });
  const change = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); try { await createQualityAction(supabase, { ...v, qualityRecordId: v.qualityRecordId || openRecords[0]?.id, responsibleUserId: v.responsibleUserId || ownerId, dueAt: v.dueAt ? new Date(v.dueAt).toISOString() : null }); reload('Action qualité créée.'); } catch (error) { reload('', error.message); } };
  return <details className="quality-create"><summary>Créer une action d’amélioration</summary><form onSubmit={submit} className="quality-form-grid"><label>Constat<select required value={v.qualityRecordId} onChange={change('qualityRecordId')}>{openRecords.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label><label>Type<select value={v.actionType} onChange={change('actionType')}><option value="corrective">Corrective</option><option value="preventive">Préventive</option><option value="improvement">Amélioration</option></select></label><label>Titre<input required minLength="3" value={v.title} onChange={change('title')} /></label><label>Priorité<select value={v.priority} onChange={change('priority')}><option value="low">Faible</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="critical">Critique</option></select></label><label className="quality-field-wide">Description<textarea required minLength="10" value={v.description} onChange={change('description')} /></label><label>Responsable<select value={v.responsibleUserId} onChange={change('responsibleUserId')}>{profiles.map((p) => <option key={p.id} value={p.id}>{profileLabel(p)}</option>)}</select></label><label>Échéance<input type="datetime-local" value={v.dueAt} onChange={change('dueAt')} /></label><label className="quality-field-wide">Motif<input required minLength="10" value={v.reason} onChange={change('reason')} /></label><button type="submit">Créer l’action</button></form></details>;
}

function RiskCreateForm({ records, profiles, ownerId, reload }) {
  const openRecords = records.filter((r) => r.status !== 'closed');
  const [v, setV] = useState({ qualityRecordId: '', title: '', description: '', likelihood: 3, impact: 3, strategy: 'mitigate', ownerUserId: ownerId, reviewDueAt: '', reason: 'Création et évaluation initiale du risque qualité' });
  const change = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); try { await createQualityRisk(supabase, { ...v, qualityRecordId: v.qualityRecordId || openRecords[0]?.id, ownerUserId: v.ownerUserId || ownerId, reviewDueAt: v.reviewDueAt ? new Date(v.reviewDueAt).toISOString() : null }); reload('Risque qualité créé.'); } catch (error) { reload('', error.message); } };
  return <details className="quality-create"><summary>Créer un risque</summary><form onSubmit={submit} className="quality-form-grid"><label>Constat<select required value={v.qualityRecordId} onChange={change('qualityRecordId')}>{openRecords.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label><label>Titre<input required minLength="3" value={v.title} onChange={change('title')} /></label><label className="quality-field-wide">Description<textarea required minLength="10" value={v.description} onChange={change('description')} /></label><label>Probabilité<input type="number" min="1" max="5" value={v.likelihood} onChange={change('likelihood')} /></label><label>Impact<input type="number" min="1" max="5" value={v.impact} onChange={change('impact')} /></label><label>Stratégie<select value={v.strategy} onChange={change('strategy')}><option value="mitigate">Réduire</option><option value="avoid">Éviter</option><option value="transfer">Transférer</option><option value="accept">Accepter</option><option value="monitor">Surveiller</option></select></label><label>Responsable<select value={v.ownerUserId} onChange={change('ownerUserId')}>{profiles.map((p) => <option key={p.id} value={p.id}>{profileLabel(p)}</option>)}</select></label><label>Revue avant<input type="datetime-local" value={v.reviewDueAt} onChange={change('reviewDueAt')} /></label><label className="quality-field-wide">Motif<input required minLength="10" value={v.reason} onChange={change('reason')} /></label><button type="submit">Créer le risque</button></form></details>;
}

function RecordCreateForm({ profiles, ownerId, reload }) {
  const [v, setV] = useState({ recordType: 'finding', sourceType: 'quality_review', title: '', description: '', severity: 'medium', ownerUserId: ownerId, occurredAt: '', reason: 'Création documentée du constat qualité' });
  const change = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); try { await createQualityRecord(supabase, { ...v, ownerUserId: v.ownerUserId || ownerId, occurredAt: v.occurredAt ? new Date(v.occurredAt).toISOString() : null }); reload('Constat qualité créé.'); } catch (error) { reload('', error.message); } };
  return <details className="quality-create"><summary>Créer un constat qualité</summary><form onSubmit={submit} className="quality-form-grid"><label>Type<select value={v.recordType} onChange={change('recordType')}><option value="finding">Constat</option><option value="nonconformity">Non-conformité</option><option value="improvement_opportunity">Opportunité d’amélioration</option><option value="stakeholder_feedback">Retour partie prenante</option><option value="other">Autre</option></select></label><label>Source<select value={v.sourceType} onChange={change('sourceType')}><option value="internal_audit">Audit interne</option><option value="learner_feedback">Retour apprenant</option><option value="quality_review">Revue qualité</option><option value="regulatory">Réglementaire</option><option value="other">Autre</option></select></label><label>Titre<input required minLength="3" value={v.title} onChange={change('title')} /></label><label>Gravité<select value={v.severity} onChange={change('severity')}><option value="low">Faible</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="critical">Critique</option></select></label><label className="quality-field-wide">Description factuelle<textarea required minLength="10" value={v.description} onChange={change('description')} /></label><label>Responsable<select value={v.ownerUserId || ownerId} onChange={change('ownerUserId')}>{profiles.map((p) => <option key={p.id} value={p.id}>{profileLabel(p)}</option>)}</select></label><label>Date du fait<input type="datetime-local" value={v.occurredAt} onChange={change('occurredAt')} /></label><label className="quality-field-wide">Motif<input required minLength="10" value={v.reason} onChange={change('reason')} /></label><button type="submit">Créer le constat</button></form></details>;
}

function RecordEditor({ item, profiles, reload }) {
  const [v, setV] = useState({ status: item.status, severity: item.severity, ownerUserId: item.owner_user_id, title: item.title, description: item.factual_description, reason: 'Mise à jour documentée du constat qualité' });
  const change = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => { try { await updateQualityRecord(supabase, { ...v, recordId: item.id }); reload('Constat qualité mis à jour.'); } catch (error) { reload('', error.message); } };
  if (item.status === 'closed') return <p><strong>Constat clôturé et immuable.</strong></p>;
  return <details className="quality-editor"><summary>Mettre à jour le constat</summary><div className="quality-form-grid"><label>Statut<select value={v.status} onChange={change('status')}><option value="open">Ouvert</option><option value="under_review">En revue</option><option value="action_plan">Plan d’action</option><option value="resolved">Résolu</option><option value="closed">Clôturé</option></select></label><label>Gravité<select value={v.severity} onChange={change('severity')}><option value="low">Faible</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="critical">Critique</option></select></label><label>Responsable<select value={v.ownerUserId} onChange={change('ownerUserId')}>{profiles.map((p) => <option key={p.id} value={p.id}>{profileLabel(p)}</option>)}</select></label><label>Titre<input value={v.title} onChange={change('title')} /></label><label className="quality-field-wide">Description<textarea value={v.description} onChange={change('description')} /></label><label className="quality-field-wide">Motif<input value={v.reason} onChange={change('reason')} /></label></div><button type="button" onClick={save} disabled={v.reason.trim().length < 10}>Enregistrer</button></details>;
}
