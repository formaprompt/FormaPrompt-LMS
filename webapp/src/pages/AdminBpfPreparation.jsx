import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { formatMoney } from '../lib/cockpitAdministration';
import {
  ACTIVITY_RELATIONSHIPS, ACTIVITY_STATUSES, INVOICE_STATUSES,
  bpfActivityAnchor, buildBpfCsv, buildBpfSummary, createExternalActivity, describeBpfActivity,
  fetchBpfAdministration, filterExternalActivities, findBpfDataIssues,
  updateExternalActivity,
} from '../lib/bpfAdministration';
import './AdminBpfPreparation.css';

const CUSTOMER_OPTIONS = {
  individual: 'Particulier', company: 'Entreprise', training_organization: 'Organisme de formation',
  public_body: 'Organisme public', nonprofit: 'Association', other: 'Autre',
};
const FUNDING_OPTIONS = { self_funded: 'Autofinancement', company: 'Entreprise', opco: 'OPCO', free: 'Gratuit', other: 'Autre' };
const DELIVERY_OPTIONS = { remote: 'À distance', in_person: 'Présentiel', hybrid: 'Hybride' };
const today = () => new Date().toISOString().slice(0, 10);
const initialPeriod = (search = '') => {
  const params = new URLSearchParams(search);
  const dateFrom = params.get('du');
  const dateTo = params.get('au');
  const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return isDate(dateFrom) && isDate(dateTo) && dateTo >= dateFrom
    ? { dateFrom, dateTo }
    : { dateFrom: `${new Date().getFullYear()}-01-01`, dateTo: today() };
};
const euros = (cents) => Number(cents || 0) / 100;
const formatNumber = (value) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value || 0));

function blankActivity() {
  return {
    title: '', activityRelationship: 'direct', orderingOrganization: '', customerCategory: 'company',
    fundingMode: 'company', deliveryMode: 'remote', startsOn: today(), endsOn: today(), status: 'planned',
    traineeCount: 0, deliveredHours: 0, traineeHours: 0, invoicedAmount: 0, collectedAmount: '',
    invoiceReference: '', invoiceStatus: 'not_invoiced', administrativeNote: '',
    reason: 'Saisie administrative d’une activité de formation hors LMS',
  };
}

function activityValues(row) {
  return {
    activityId: row.id, title: row.title, activityRelationship: row.activity_relationship,
    orderingOrganization: row.ordering_organization || '', customerCategory: row.customer_category,
    fundingMode: row.funding_mode, deliveryMode: row.delivery_mode, startsOn: row.starts_on,
    endsOn: row.ends_on, status: row.status, traineeCount: row.trainee_count,
    deliveredHours: row.delivered_hours, traineeHours: row.trainee_hours,
    invoicedAmount: euros(row.invoiced_amount_cents),
    collectedAmount: row.collected_amount_cents == null ? '' : euros(row.collected_amount_cents),
    invoiceReference: row.invoice_reference || '', invoiceStatus: row.invoice_status,
    administrativeNote: row.administrative_note || '',
    reason: 'Mise à jour administrative de l’activité de formation hors LMS',
  };
}

function ExternalActivityForm({ initialValues, onSubmit, submitLabel }) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const change = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const expectedTraineeHours = Number(values.traineeCount || 0) * Number(values.deliveredHours || 0);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try { await onSubmit(values); } finally { setSaving(false); }
  }
  return (
    <form className="bpf-activity-form" onSubmit={submit}>
      <label>Intitulé<input required minLength="3" value={values.title} onChange={change('title')} /></label>
      <label>Relation de prestation<select value={values.activityRelationship} onChange={change('activityRelationship')}>
        {Object.entries(ACTIVITY_RELATIONSHIPS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Organisme donneur d’ordre<input required={values.activityRelationship !== 'direct'} value={values.orderingOrganization} onChange={change('orderingOrganization')} /></label>
      <label>Catégorie client<select value={values.customerCategory} onChange={change('customerCategory')}>{Object.entries(CUSTOMER_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Financement<select value={values.fundingMode} onChange={change('fundingMode')}>{Object.entries(FUNDING_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Modalité<select value={values.deliveryMode} onChange={change('deliveryMode')}>{Object.entries(DELIVERY_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Date de début<input required type="date" value={values.startsOn} onChange={change('startsOn')} /></label>
      <label>Date de fin<input required type="date" value={values.endsOn} onChange={change('endsOn')} /></label>
      <label>Statut<select value={values.status} onChange={change('status')}>{Object.entries(ACTIVITY_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Nombre de stagiaires<input required type="number" min="0" step="1" value={values.traineeCount} onChange={change('traineeCount')} /></label>
      <label>Heures réalisées<input required type="number" min="0" step="0.25" value={values.deliveredHours} onChange={change('deliveredHours')} /></label>
      <label>Heures-stagiaires<input required type="number" min="0" step="0.25" value={values.traineeHours} onChange={change('traineeHours')} /></label>
      <p className="bpf-hours-note">Les heures-stagiaires sont saisies et contrôlées séparément. Elles peuvent différer de stagiaires × durée ({formatNumber(expectedTraineeHours)} h ici).</p>
      <label>Montant facturé (€)<input required type="number" min="0" step="0.01" value={values.invoicedAmount} onChange={change('invoicedAmount')} /></label>
      <label>Montant encaissé (€)<input type="number" min="0" step="0.01" value={values.collectedAmount} onChange={change('collectedAmount')} /></label>
      <label>Statut facture<select value={values.invoiceStatus} onChange={change('invoiceStatus')}>{Object.entries(INVOICE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Référence facture<input value={values.invoiceReference} onChange={change('invoiceReference')} /></label>
      <label className="bpf-wide-field">Note administrative<textarea maxLength="4000" value={values.administrativeNote} onChange={change('administrativeNote')} /></label>
      <label className="bpf-wide-field">Motif administratif<input required minLength="10" value={values.reason} onChange={change('reason')} /></label>
      <button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : submitLabel}</button>
    </form>
  );
}

function SummaryCard({ label, value, note }) {
  return <article className="bpf-kpi"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

function BpfRowCard({ row, source, identities, outsideProjection = false }) {
  const internal = row.source_kind === 'internal_lms';
  return (
    <article className="bpf-row-card" id={internal ? bpfActivityAnchor(row) : undefined} tabIndex={-1}>
      <div className="bpf-card-heading">
        <span>{internal ? 'Interne LMS' : 'Externe'}</span>
        <small>{row.activity_relationship ? ACTIVITY_RELATIONSHIPS[row.activity_relationship] : 'FormaPrompt LMS'}</small>
      </div>
      <h3>{describeBpfActivity(source, identities)}</h3>
      <p>{row.starts_on} → {row.ends_on}</p>
      <dl>
        <div><dt>Stagiaires</dt><dd>{row.trainee_count}</dd></div>
        <div><dt>Heures</dt><dd>{row.training_hours == null ? 'À vérifier' : `${formatNumber(row.training_hours)} h`}</dd></div>
        <div><dt>Heures-stagiaires</dt><dd>{row.trainee_hours == null ? 'À vérifier' : `${formatNumber(row.trainee_hours)} h`}</dd></div>
        <div><dt>Produit retenu</dt><dd>{outsideProjection ? 'Hors projection' : formatMoney(row.product_amount_cents)}</dd></div>
      </dl>
      <p className="bpf-basis">{outsideProjection ? 'Activité absente de la projection — contrôle requis.'
        : `Base : ${row.product_amount_basis === 'external_invoiced_amount' ? 'montant facturé externe' : 'montant administratif interne'} — contrôle humain requis.`}</p>
      {internal && source.trainee_reference && <Link to={`/admin/apprenants/${encodeURIComponent(source.trainee_reference)}`}>Ouvrir le dossier apprenant</Link>}
    </article>
  );
}

export default function AdminBpfPreparation() {
  const { role } = useAuth();
  const location = useLocation();
  const [draftPeriod, setDraftPeriod] = useState(() => initialPeriod(location.search));
  const [period, setPeriod] = useState(() => initialPeriod(location.search));
  const [filters, setFilters] = useState({ search: '', relationship: '', status: '' });
  const [data, setData] = useState({ externalActivities: [], internalActivities: [], allActivities: [], bpfRows: [] });
  const [state, setState] = useState({ loading: true, error: '', success: '' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const next = initialPeriod(location.search);
    setDraftPeriod((current) => current.dateFrom === next.dateFrom && current.dateTo === next.dateTo ? current : next);
    setPeriod((current) => current.dateFrom === next.dateFrom && current.dateTo === next.dateTo ? current : next);
  }, [location.search]);

  useEffect(() => {
    if (role !== 'admin') return;
    let active = true;
    fetchBpfAdministration(supabase, period)
      .then((result) => { if (active) { setData(result); setState((current) => ({ ...current, loading: false, error: '' })); } })
      .catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: error.message })); });
    return () => { active = false; };
  }, [period, reloadKey, role]);

  const summary = useMemo(() => buildBpfSummary(data.allActivities, data.bpfRows), [data]);
  const issues = useMemo(() => findBpfDataIssues(data.allActivities, data.internalActivities, data.identities), [data]);
  const visibleExternal = useMemo(() => filterExternalActivities(data.externalActivities, filters), [data.externalActivities, filters]);
  const internalOutsideProjection = useMemo(() => data.internalActivities.filter((activity) =>
    activity.status === 'completed' && !data.bpfRows.some((row) => row.source_kind === 'internal_lms'
      && row.activity_id === activity.activity_id)), [data]);

  useEffect(() => {
    if (state.loading || state.error || !location.hash.startsWith('#bpf-activity-')) return;
    let anchor;
    try { anchor = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(anchor);
    target?.scrollIntoView?.({ block: 'center' });
    target?.focus({ preventScroll: true });
  }, [location.hash, data, state.loading, state.error, visibleExternal]);

  function reload(success = '', error = '') {
    setState({ loading: true, success, error });
    setReloadKey((value) => value + 1);
  }

  async function createActivity(values) {
    try { await createExternalActivity(supabase, values); reload('Activité externe créée et auditée.'); }
    catch (error) { setState((current) => ({ ...current, loading: false, success: '', error: error.message })); }
  }

  async function updateActivity(values) {
    try { await updateExternalActivity(supabase, values); reload('Activité externe mise à jour et auditée.'); }
    catch (error) { setState((current) => ({ ...current, loading: false, success: '', error: error.message })); }
  }

  function exportCsv() {
    const blob = new Blob([buildBpfCsv(data.bpfRows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `preparation-bpf-${period.dateFrom}-${period.dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (role !== 'admin') return <main className="container admin-bpf"><div className="bpf-message is-error" role="alert"><h1>Accès réservé</h1><p>La préparation BPF est réservée aux administrateurs.</p></div></main>;

  return (
    <main className="container admin-bpf">
      <header className="bpf-header">
        <div><p className="bpf-eyebrow">Sprint 6 · Activité</p><h1>Préparation BPF</h1><p>Contrôle administrateur requis — ces données ne constituent pas une déclaration officielle.</p></div>
        <button type="button" className="bpf-export" onClick={exportCsv} disabled={!data.bpfRows.length}>Exporter les lignes CSV</button>
      </header>

      <form className="bpf-period-filters" onSubmit={(event) => { event.preventDefault(); setState({ loading: true, error: '', success: '' }); setPeriod(draftPeriod); }}>
        <label>Début de l’exercice<input type="date" value={draftPeriod.dateFrom} onChange={(event) => setDraftPeriod((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
        <label>Fin de l’exercice<input type="date" value={draftPeriod.dateTo} onChange={(event) => setDraftPeriod((current) => ({ ...current, dateTo: event.target.value }))} /></label>
        <button type="submit">Appliquer</button>
      </form>

      {state.success && <p className="bpf-message is-success" role="status">{state.success}</p>}
      {state.loading && <p className="bpf-message" role="status">Chargement de la préparation BPF…</p>}
      {!state.loading && state.error && <div className="bpf-message is-error" role="alert"><p>{state.error}</p><button type="button" onClick={() => reload()}>Réessayer</button></div>}

      {!state.loading && !state.error && <>
        <section aria-labelledby="bpf-summary-title">
          <div className="bpf-section-heading"><div><p className="bpf-eyebrow">Interne + externe, sans double comptage</p><h2 id="bpf-summary-title">Synthèse de l’activité réalisée</h2></div><span>{period.dateFrom} → {period.dateTo}</span></div>
          <div className="bpf-kpis">
            <SummaryCard label="Formations réalisées" value={summary.total.activityCount} note={`${summary.internal.activityCount} LMS · ${summary.external.activityCount} externes`} />
            <SummaryCard label="Stagiaires" value={summary.total.traineeCount} note="Somme des lignes réalisées" />
            <SummaryCard label="Heures de formation" value={`${formatNumber(summary.total.trainingHours)} h`} note="Heures réalisées vérifiables" />
            <SummaryCard label="Heures-stagiaires" value={`${formatNumber(summary.total.traineeHours)} h`} note="Valeur distincte de stagiaires × durée" />
            <SummaryCard label="Produits de formation" value={formatMoney(summary.total.productAmountCents)} note="Base administrative interne + facturé externe, à contrôler" />
            <SummaryCard label="Sous-traitance" value={summary.subcontracting.activityCount} note={`${summary.subcontracting.traineeCount} stagiaire(s)`} />
          </div>
          <div className="bpf-source-breakdown">
            <article><h3>Activité interne LMS</h3><p>{summary.internal.activityCount} formation(s) · {summary.internal.traineeCount} stagiaire(s) · {formatNumber(summary.internal.trainingHours)} h</p></article>
            <article><h3>Activité externe</h3><p>{summary.external.activityCount} formation(s) · {summary.external.traineeCount} stagiaire(s) · {formatNumber(summary.external.trainingHours)} h</p><p>Facturé : {formatMoney(summary.externalInvoicedCents)} · Encaissé : {formatMoney(summary.externalCollectedCents)}</p></article>
          </div>
        </section>

        <section className={`bpf-controls${issues.length ? ' has-issues' : ''}`} aria-labelledby="bpf-controls-title">
          <div><p className="bpf-eyebrow">Avant utilisation</p><h2 id="bpf-controls-title">Contrôles de cohérence</h2></div>
          {issues.length ? <ul>{issues.map((issue) => <li key={issue.key} className={`is-${issue.severity}`}><div><strong>{issue.label}</strong><span className="bpf-issue-identity">{issue.activityLabel}</span></div>{issue.destinationPath && <Link to={issue.destinationPath} onClick={() => setFilters({ search: '', relationship: '', status: '' })}>Contrôler l’activité</Link>}</li>)}</ul> : <p>Aucune incohérence détectée sur la période.</p>}
        </section>

        <section aria-labelledby="external-title">
          <div className="bpf-section-heading"><div><p className="bpf-eyebrow">Registre indépendant du LMS</p><h2 id="external-title">Activités de formation hors LMS</h2></div><span>{data.externalActivities.length} activité(s)</span></div>
          <details className="bpf-create"><summary>Créer une activité externe</summary><ExternalActivityForm initialValues={blankActivity()} onSubmit={createActivity} submitLabel="Créer l’activité" /></details>
          <div className="bpf-list-filters">
            <label>Rechercher<input type="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></label>
            <label>Relation<select value={filters.relationship} onChange={(event) => setFilters((current) => ({ ...current, relationship: event.target.value }))}><option value="">Toutes</option>{Object.entries(ACTIVITY_RELATIONSHIPS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Statut<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">Tous</option>{Object.entries(ACTIVITY_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          {!visibleExternal.length ? <p className="bpf-empty">Aucune activité externe pour ces filtres.</p> : <div className="bpf-activity-grid">{visibleExternal.map((activity) => <article className={`bpf-activity-card is-${activity.status}`} key={activity.id} id={bpfActivityAnchor({ source_kind: 'external', activity_id: activity.id })} tabIndex={-1}>
            <div className="bpf-card-heading"><span>{ACTIVITY_RELATIONSHIPS[activity.activity_relationship]}</span><small>{ACTIVITY_STATUSES[activity.status]}</small></div>
            <h3>{activity.title}</h3><p>{activity.ordering_organization || 'Client à préciser'}</p><p>{activity.starts_on} → {activity.ends_on}</p>
            <dl><div><dt>Stagiaires</dt><dd>{activity.trainee_count}</dd></div><div><dt>Heures</dt><dd>{formatNumber(activity.delivered_hours)} h</dd></div><div><dt>Heures-stagiaires</dt><dd>{formatNumber(activity.trainee_hours)} h</dd></div><div><dt>Facturé</dt><dd>{formatMoney(activity.invoiced_amount_cents)}</dd></div><div><dt>Encaissé</dt><dd>{formatMoney(activity.collected_amount_cents)}</dd></div><div><dt>Facture</dt><dd>{INVOICE_STATUSES[activity.invoice_status]}</dd></div></dl>
            <details className="bpf-editor"><summary>Modifier l’activité</summary><ExternalActivityForm initialValues={activityValues(activity)} onSubmit={updateActivity} submitLabel="Enregistrer les modifications" /></details>
          </article>)}</div>}
        </section>

        <section aria-labelledby="bpf-lines-title">
          <div className="bpf-section-heading"><div><p className="bpf-eyebrow">Projection contrôlée</p><h2 id="bpf-lines-title">Lignes utilisées pour la préparation BPF</h2></div><span>{data.bpfRows.length} ligne(s)</span></div>
          {!data.bpfRows.length ? <p className="bpf-empty">Aucune activité réalisée ne remplit actuellement les critères de la projection BPF.</p> : <div className="bpf-row-grid">{data.bpfRows.map((row) => <BpfRowCard
            key={`${row.source_kind}-${row.activity_id}`} row={row} identities={data.identities}
            source={data.allActivities.find((activity) => activity.source_kind === row.source_kind && activity.activity_id === row.activity_id) || row}
          />)}</div>}
        </section>
        {internalOutsideProjection.length > 0 && <section aria-labelledby="bpf-outside-title">
          <h2 id="bpf-outside-title">Activités LMS hors projection BPF</h2>
          <div className="bpf-row-grid">{internalOutsideProjection.map((activity) => <BpfRowCard
            key={activity.activity_id} row={{ ...activity, training_hours: activity.delivered_hours }}
            source={activity} identities={data.identities} outsideProjection
          />)}</div>
        </section>}
      </>}
    </main>
  );
}
