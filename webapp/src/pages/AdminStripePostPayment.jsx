import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
  filterStripeRows,
  formatStripeMoney,
  STRIPE_CASE_STATUS_LABELS,
  STRIPE_CASE_TYPE_LABELS,
  STRIPE_TRANSACTION_STATUS_LABELS,
} from '../lib/stripeAdministration';
import './AdminStripePostPayment.css';

const TABS = Object.freeze({
  transactions: 'Transactions',
  refunds: 'Remboursements',
  disputes: 'Litiges',
  cases: 'Réconciliation',
  audit: 'Historique',
});

function formatDate(value) {
  return value ? new Date(value).toLocaleString('fr-FR') : '—';
}

export default function AdminStripePostPayment() {
  const [activeTab, setActiveTab] = useState('transactions');
  const [search, setSearch] = useState('');
  const [caseStatus, setCaseStatus] = useState('open');
  const [data, setData] = useState({ transactions: [], refunds: [], disputes: [], cases: [], audit: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [running, setRunning] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [decisionStatus, setDecisionStatus] = useState('reviewed');
  const [decisionReason, setDecisionReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user?.id) throw new Error('Connexion administrative requise.');
      const { data: profile, error: profileError } = await supabase.from('profiles')
        .select('role').eq('id', authData.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (profile?.role !== 'admin') throw new Error('Cette page est réservée au rôle administrateur.');

      const results = await Promise.all([
        supabase.from('stripe_payment_transactions').select('*').order('created_at', { ascending: false }).limit(250),
        supabase.from('stripe_refunds').select('*').order('last_event_created_at', { ascending: false }).limit(250),
        supabase.from('stripe_disputes').select('*').order('last_event_created_at', { ascending: false }).limit(250),
        supabase.from('stripe_reconciliation_cases').select('*').order('last_seen_at', { ascending: false }).limit(250),
        supabase.from('audit_log').select('id,action_type,target_type,target_id,target_user_id,course_id,reason,metadata,created_at')
          .ilike('target_type', 'stripe%').order('created_at', { ascending: false }).limit(250),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      setData({
        transactions: results[0].data || [],
        refunds: results[1].data || [],
        disputes: results[2].data || [],
        cases: results[3].data || [],
        audit: results[4].data || [],
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement Stripe impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { loadData(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const visibleRows = useMemo(() => {
    const rows = data[activeTab] || [];
    const filtered = activeTab === 'cases' && caseStatus !== 'all'
      ? rows.filter((row) => (
        caseStatus === 'open' ? ['pending', 'reviewed'].includes(row.status) : row.status === caseStatus
      ))
      : rows;
    return filterStripeRows(filtered, search);
  }, [activeTab, caseStatus, data, search]);

  async function runReconciliation(kind) {
    setRunning(kind);
    setFeedback('');
    try {
      const result = kind === 'local'
        ? await supabase.rpc('admin_run_stripe_local_reconciliation')
        : await supabase.functions.invoke('admin-reconcile-stripe', { body: {} });
      if (result.error) throw result.error;
      const count = result.data?.detected_count ?? 0;
      setFeedback(`${kind === 'local' ? 'Rapprochement local' : 'Comparaison Stripe'} terminé : ${count} cas détecté(s).`);
      await loadData();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Rapprochement impossible.');
    } finally {
      setRunning('');
    }
  }

  async function submitDecision(event) {
    event.preventDefault();
    if (!selectedCase) return;
    setRunning('decision');
    setError('');
    try {
      const { error: decisionError } = await supabase.rpc('admin_update_stripe_reconciliation_case', {
        p_case_id: selectedCase.id,
        p_status: decisionStatus,
        p_reason: decisionReason,
      });
      if (decisionError) throw decisionError;
      setFeedback('La décision administrative a été enregistrée et auditée.');
      setSelectedCase(null);
      setDecisionReason('');
      await loadData();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Décision impossible.');
    } finally {
      setRunning('');
    }
  }

  return (
    <main className="admin-stripe container section">
      <header className="admin-stripe__header">
        <div>
          <p className="admin-stripe__eyebrow">Sprint 5</p>
          <h1>Stripe après paiement</h1>
          <p>Suivi financier et rapprochement administratif. Les droits pédagogiques restent exclusivement gérés par <code>course_access</code>.</p>
        </div>
        <Link className="btn" to="/admin">Retour à l’administration</Link>
      </header>

      <section className="admin-stripe__actions" aria-label="Actions de rapprochement">
        <button className="btn btn-primary" disabled={Boolean(running)} onClick={() => runReconciliation('local')}>
          {running === 'local' ? 'Analyse…' : 'Rapprocher les données locales'}
        </button>
        <button className="btn" disabled={Boolean(running)} onClick={() => runReconciliation('remote')}>
          {running === 'remote' ? 'Comparaison…' : 'Comparer à Stripe en lecture seule'}
        </button>
        <p>Aucun remboursement ni changement Stripe n’est déclenché depuis cette page.</p>
      </section>

      {error && <div className="admin-stripe__message is-error" role="alert">{error}</div>}
      {feedback && <div className="admin-stripe__message is-success" role="status">{feedback}</div>}

      <nav className="admin-stripe__tabs" aria-label="Registres Stripe">
        {Object.entries(TABS).map(([key, label]) => (
          <button key={key} className={activeTab === key ? 'is-active' : ''} onClick={() => setActiveTab(key)}>
            {label} <span>{data[key].length}</span>
          </button>
        ))}
      </nav>

      <div className="admin-stripe__filters">
        <label>Rechercher<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Formation, identifiant, statut…" /></label>
        {activeTab === 'cases' && (
          <label>État<select value={caseStatus} onChange={(event) => setCaseStatus(event.target.value)}>
            <option value="open">À traiter</option><option value="pending">À examiner</option>
            <option value="reviewed">Examinés</option><option value="resolved">Résolus</option>
            <option value="dismissed">Classés</option><option value="all">Tous</option>
          </select></label>
        )}
      </div>

      {loading ? <p>Chargement des registres Stripe…</p> : (
        <section className="admin-stripe__list" aria-live="polite">
          {visibleRows.length === 0 && <p>Aucun élément ne correspond aux filtres.</p>}

          {activeTab === 'transactions' && visibleRows.map((row) => <article key={row.id}>
            <header><strong>{STRIPE_TRANSACTION_STATUS_LABELS[row.status] || row.status}</strong><span>{formatStripeMoney(row.amount_total, row.currency)}</span></header>
            <p>{row.course_id || 'Frais de déplacement'} · {formatDate(row.created_at)}</p>
            <dl><div><dt>PaymentIntent</dt><dd>{row.stripe_payment_intent_id || '—'}</dd></div><div><dt>Session</dt><dd>{row.stripe_checkout_session_id || '—'}</dd></div><div><dt>Remboursé</dt><dd>{formatStripeMoney(row.amount_refunded, row.currency)}</dd></div></dl>
          </article>)}

          {activeTab === 'refunds' && visibleRows.map((row) => <article key={row.id}>
            <header><strong>Remboursement {row.status}</strong><span>{formatStripeMoney(row.amount, row.currency)}</span></header>
            <p>{row.stripe_refund_id} · {formatDate(row.last_event_created_at)}</p>
            {row.failure_reason && <p className="is-warning">Échec : {row.failure_reason}</p>}
          </article>)}

          {activeTab === 'disputes' && visibleRows.map((row) => <article key={row.id}>
            <header><strong>Litige {row.status}</strong><span>{formatStripeMoney(row.amount, row.currency)}</span></header>
            <p>{row.stripe_dispute_id} · motif {row.reason || 'non communiqué'}</p>
            <p>Échéance de réponse : {formatDate(row.evidence_due_at)}</p>
          </article>)}

          {activeTab === 'cases' && visibleRows.map((row) => <article key={row.id} className={`is-${row.severity}`}>
            <header><strong>{STRIPE_CASE_TYPE_LABELS[row.case_type] || row.case_type}</strong><span>{STRIPE_CASE_STATUS_LABELS[row.status] || row.status}</span></header>
            <p>{row.summary}</p><small>Détecté le {formatDate(row.detected_at)} · vu {row.occurrence_count} fois</small>
            {!['resolved', 'dismissed'].includes(row.status) && <button className="btn" onClick={() => { setSelectedCase(row); setDecisionStatus('reviewed'); }}>Traiter ce cas</button>}
          </article>)}

          {activeTab === 'audit' && visibleRows.map((row) => <article key={row.id}>
            <header><strong>{row.action_type}</strong><span>{formatDate(row.created_at)}</span></header>
            <p>{row.reason || 'Événement technique'} · {row.target_id}</p>
          </article>)}
        </section>
      )}

      {selectedCase && <div className="admin-stripe__decision" role="dialog" aria-modal="true" aria-labelledby="stripe-decision-title">
        <form onSubmit={submitDecision}>
          <h2 id="stripe-decision-title">Décision administrative</h2>
          <p>{selectedCase.summary}</p>
          <label>Décision<select value={decisionStatus} onChange={(event) => setDecisionStatus(event.target.value)}>
            <option value="reviewed">Marquer comme examiné</option><option value="resolved">Marquer comme résolu</option><option value="dismissed">Classer sans suite</option>
          </select></label>
          <label>Motif administratif<textarea required minLength="5" maxLength="2000" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /></label>
          <div><button type="button" className="btn" onClick={() => setSelectedCase(null)}>Annuler</button><button className="btn btn-primary" disabled={running === 'decision'}>Enregistrer</button></div>
        </form>
      </div>}
    </main>
  );
}
