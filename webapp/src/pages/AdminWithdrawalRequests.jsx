import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import {
  fetchWithdrawalRequests,
  splitWithdrawalRequests,
  updateWithdrawalRequest,
  WITHDRAWAL_STATUS_LABELS,
} from '../lib/withdrawalAdministration';
import './AdminWithdrawalRequests.css';

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
const DELIVERY_LABELS = {
  pending_configuration: 'Accusé en attente de configuration',
  pending: 'Accusé en attente',
  sent: 'Accusé envoyé',
  failed: 'Échec d’envoi de l’accusé',
};

function nextActions(status) {
  if (status === 'received') return [['under_review', 'Commencer l’instruction']];
  if (status === 'under_review') return [['accepted', 'Accepter'], ['rejected', 'Refuser']];
  if (status === 'accepted' || status === 'rejected') return [['closed', 'Clôturer']];
  return [];
}

function RequestCard({ request, onUpdated }) {
  const [reason, setReason] = useState('');
  const [state, setState] = useState({ saving: false, error: '' });
  const actions = nextActions(request.status);

  async function submit(status) {
    setState({ saving: true, error: '' });
    try {
      await updateWithdrawalRequest(supabase, request.id, status, reason);
      setReason('');
      await onUpdated();
      setState({ saving: false, error: '' });
    } catch (error) {
      setState({ saving: false, error: error.message });
    }
  }

  return (
    <article className={`withdrawal-card is-${request.status}`} id={`demande-${request.id}`}>
      <header className="withdrawal-card__header">
        <div>
          <span className="withdrawal-card__status">{WITHDRAWAL_STATUS_LABELS[request.status] || request.status}</span>
          <h3>{request.claimant_first_name} {request.claimant_last_name}</h3>
          <p>Reçue le {DATE_FORMAT.format(new Date(request.received_at))}</p>
        </div>
        <span className={`withdrawal-card__delivery is-${request.acknowledgement_delivery_status}`}>
          {DELIVERY_LABELS[request.acknowledgement_delivery_status] || 'Accusé non renseigné'}
        </span>
      </header>

      <dl className="withdrawal-card__facts">
        <div><dt>Formation</dt><dd>{request.course_id}</dd></div>
        <div><dt>Adresse de suivi</dt><dd><a href={`mailto:${request.acknowledgement_email}`}>{request.acknowledgement_email}</a></dd></div>
        <div><dt>Achat lié</dt><dd>{request.purchase_id || 'Non rattaché'}</dd></div>
        {request.reviewed_at && <div><dt>Instruction débutée</dt><dd>{DATE_FORMAT.format(new Date(request.reviewed_at))}</dd></div>}
      </dl>

      <details className="withdrawal-card__details">
        <summary>Consulter la déclaration et le suivi</summary>
        <p className="withdrawal-card__declaration">{request.declaration}</p>
        {request.admin_note && <p><strong>Dernier motif administratif :</strong> {request.admin_note}</p>}
      </details>

      {actions.length > 0 && (
        <div className="withdrawal-card__actions">
          <label htmlFor={`reason-${request.id}`}>Motif administratif obligatoire</label>
          <textarea
            id={`reason-${request.id}`}
            value={reason}
            minLength={10}
            maxLength={2000}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Décrire factuellement l’instruction ou la décision…"
          />
          {state.error && <p className="withdrawal-message is-error" role="alert">{state.error}</p>}
          <div className="withdrawal-card__buttons">
            {actions.map(([status, label]) => (
              <button key={status} type="button" disabled={state.saving || reason.trim().length < 10} onClick={() => submit(status)}>
                {state.saving ? 'Enregistrement…' : label}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default function AdminWithdrawalRequests() {
  const { role } = useAuth();
  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [state, setState] = useState({ loading: true, error: '' });

  async function load() {
    setState({ loading: true, error: '' });
    try {
      const data = await fetchWithdrawalRequests(supabase);
      setRequests(data);
      setState({ loading: false, error: '' });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }

  useEffect(() => {
    if (role !== 'admin') return undefined;
    let active = true;
    fetchWithdrawalRequests(supabase)
      .then((data) => {
        if (!active) return;
        setRequests(data);
        setState({ loading: false, error: '' });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: error.message });
      });
    return () => { active = false; };
  }, [role]);

  const visibleRequests = useMemo(() => requests.filter((request) => {
    const term = filters.search.trim().toLocaleLowerCase('fr');
    const haystack = `${request.claimant_first_name} ${request.claimant_last_name} ${request.acknowledgement_email} ${request.course_id}`.toLocaleLowerCase('fr');
    return (!filters.status || request.status === filters.status) && (!term || haystack.includes(term));
  }), [filters, requests]);
  const groups = useMemo(() => splitWithdrawalRequests(visibleRequests), [visibleRequests]);

  if (role !== 'admin') {
    return <main className="container admin-withdrawals"><div className="withdrawal-message is-error" role="alert"><h1>Accès réservé</h1><p>La gestion des rétractations est réservée aux administrateurs.</p></div></main>;
  }

  return (
    <main className="container admin-withdrawals">
      <header className="withdrawal-header">
        <div><p className="withdrawal-eyebrow">Sprint 6 · Suivi client</p><h1>Demandes de rétractation</h1><p>Consulter, instruire et clôturer les demandes sans déclencher automatiquement un remboursement ou modifier les accès pédagogiques.</p></div>
      </header>

      <form className="withdrawal-filters" onSubmit={(event) => event.preventDefault()}>
        <label>Rechercher<input type="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nom, email ou formation" /></label>
        <label>Statut<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">Tous les statuts</option>{Object.entries(WITHDRAWAL_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </form>

      {state.loading && <p className="withdrawal-message" role="status">Chargement des demandes de rétractation…</p>}
      {state.error && <div className="withdrawal-message is-error" role="alert"><p>{state.error}</p><button type="button" onClick={load}>Réessayer</button></div>}
      {!state.loading && !state.error && visibleRequests.length === 0 && <p className="withdrawal-message is-success">Aucune demande de rétractation pour ces critères.</p>}

      {!state.loading && !state.error && groups.open.length > 0 && <section aria-labelledby="withdrawals-open"><div className="withdrawal-section-heading"><div><p className="withdrawal-eyebrow">À traiter en priorité</p><h2 id="withdrawals-open">Demandes à instruire ou clôturer</h2></div><span>{groups.open.length}</span></div><div className="withdrawal-grid">{groups.open.map((request) => <RequestCard key={request.id} request={request} onUpdated={load} />)}</div></section>}
      {!state.loading && !state.error && groups.closed.length > 0 && <section aria-labelledby="withdrawals-closed"><div className="withdrawal-section-heading"><div><p className="withdrawal-eyebrow">Historique</p><h2 id="withdrawals-closed">Demandes terminées</h2></div><span>{groups.closed.length}</span></div><div className="withdrawal-grid">{groups.closed.map((request) => <RequestCard key={request.id} request={request} onUpdated={load} />)}</div></section>}
    </main>
  );
}
