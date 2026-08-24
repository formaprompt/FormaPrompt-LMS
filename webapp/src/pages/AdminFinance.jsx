import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { formatMoney } from '../lib/cockpitAdministration';
import { fetchFinanceAdministration, summarizeStripeFinance } from '../lib/financeAdministration';
import './AdminFinance.css';

const COURSES = [
  ['', 'Toutes les formations'], ['formation-ia', 'IA générative'],
  ['formation-prompt-level-1', 'Prompt Engineering – Niveau 1'], ['formation-ia-act', 'IA Act'],
];
const dateInput = (date) => date.toISOString().slice(0, 10);
const initialFilters = () => ({ dateFrom: `${new Date().getFullYear()}-01-01`, dateTo: dateInput(new Date()), courseId: '' });

export default function AdminFinance() {
  const { role } = useAuth();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [result, setResult] = useState({ rows: [], openCases: [] });
  const [state, setState] = useState({ loading: true, error: '' });
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (role !== 'admin') return;
    let active = true;
    fetchFinanceAdministration(supabase, filters).then((data) => { if (active) { setResult(data); setState({ loading: false, error: '' }); } })
      .catch((error) => { if (active) setState({ loading: false, error: error.message }); });
    return () => { active = false; };
  }, [filters, reloadKey, role]);
  const summaries = useMemo(() => Object.values(summarizeStripeFinance(result.rows)), [result.rows]);
  if (role !== 'admin') return <main className="container admin-finance"><div className="finance-message is-error" role="alert"><h1>Accès réservé</h1><p>La synthèse financière est réservée aux administrateurs.</p></div></main>;
  return <main className="container admin-finance">
    <header className="finance-header"><div><p className="finance-eyebrow">Sprint 6 · Finance</p><h1>Synthèse financière</h1><p>Lecture locale des encaissements Stripe, remboursements, litiges et anomalies à examiner.</p></div><Link className="finance-detail-link" to="/admin/stripe-apres-paiement">Ouvrir le registre Stripe</Link></header>
    <form className="finance-filters" onSubmit={(e) => { e.preventDefault(); setFilters(draft); }}>
      <label>Du<input type="date" value={draft.dateFrom} onChange={(e) => setDraft((x) => ({ ...x, dateFrom: e.target.value }))} /></label>
      <label>Au<input type="date" value={draft.dateTo} onChange={(e) => setDraft((x) => ({ ...x, dateTo: e.target.value }))} /></label>
      <label>Formation<select value={draft.courseId} onChange={(e) => setDraft((x) => ({ ...x, courseId: e.target.value }))}>{COURSES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <button type="submit" onClick={() => setState({ loading: true, error: '' })}>Appliquer</button>
    </form>
    {state.loading && <p className="finance-message" role="status">Chargement de la synthèse financière…</p>}
    {state.error && <div className="finance-message is-error" role="alert"><p>{state.error}</p><button type="button" onClick={() => setReloadKey((key) => key + 1)}>Réessayer</button></div>}
    {!state.loading && !state.error && summaries.length === 0 && <p className="finance-message is-success">Aucun encaissement Stripe sur cette période.</p>}
    {!state.loading && !state.error && summaries.map((summary) => <section key={summary.currency} className="finance-summary" aria-labelledby={`finance-${summary.currency}`}>
      <div className="finance-section-heading"><div><h2 id={`finance-${summary.currency}`}>Flux en {summary.currency.toUpperCase()}</h2><p>{summary.transactionCount} transaction(s) locale(s) dans la période</p></div><span>Estimation</span></div>
      <div className="finance-kpis">
        <FinanceKpi label="Formation encaissée brute" value={formatMoney(summary.grossTrainingCents, summary.currency)} note="Paiements ayant atteint un état payé" />
        <FinanceKpi label="Remboursements confirmés" value={formatMoney(summary.successfulRefundCents, summary.currency)} note="Déduits de l’estimation" />
        <FinanceKpi label="Litiges ouverts" value={formatMoney(summary.openDisputeCents, summary.currency)} note="À surveiller, non déduits du net estimé" />
        <FinanceKpi label="Litiges perdus" value={formatMoney(summary.lostDisputeCents, summary.currency)} note="Déduits sans double compter un remboursement" />
        <FinanceKpi label="Net Stripe estimé" value={formatMoney(summary.estimatedNetStripeCents, summary.currency)} note="Ce n’est ni le solde Stripe ni le solde bancaire" primary />
        <FinanceKpi label="Frais de déplacement" value={formatMoney(summary.travelFeeCents, summary.currency)} note="Séparés de la formation et du BPF" />
      </div>
      <div className="finance-explanation"><h3>Repères de lecture</h3><ul><li><strong>Commande / facture :</strong> information commerciale, non calculée ici.</li><li><strong>Encaissement :</strong> transaction Stripe ayant atteint un état payé.</li><li><strong>Net formation estimé :</strong> {formatMoney(summary.estimatedNetTrainingCents, summary.currency)} après remboursements et litiges perdus attribuables à la formation.</li><li><strong>Frais de déplacement :</strong> isolés du produit de formation.</li></ul></div>
    </section>)}
    {!state.loading && !state.error && <section className="finance-cases"><div><p className="finance-eyebrow">Contrôle interne</p><h2>Cas de réconciliation ouverts</h2><p>{result.openCases.length ? `${result.openCases.length} cas nécessite(nt) une revue humaine.` : 'Aucun cas de réconciliation ouvert.'}</p></div><Link to="/admin/stripe-apres-paiement">Examiner les cas</Link></section>}
  </main>;
}

function FinanceKpi({ label, value, note, primary = false }) {
  return <article className={`finance-kpi${primary ? ' is-primary' : ''}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
