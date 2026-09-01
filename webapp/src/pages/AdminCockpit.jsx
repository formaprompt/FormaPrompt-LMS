import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import AdminShell from '../components/AdminShell';
import CockpitActionList from '../components/CockpitActionList';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import {
  fetchCockpitSummary,
  formatMoney,
  prioritizeCockpitActions,
} from '../lib/cockpitAdministration';
import './AdminCockpit.css';

const COURSE_OPTIONS = [
  { id: '', label: 'Toutes les formations' },
  { id: 'formation-ia', label: 'IA générative' },
  { id: 'formation-prompt-level-1', label: 'Prompt Engineering – Niveau 1' },
  { id: 'formation-ia-act', label: 'IA Act' },
];

const DOMAIN_LABELS = {
  bpf: 'BPF',
  commercial: 'Commercial',
  incident: 'Incident',
  legal: 'Rétractation',
  privacy: 'RGPD',
  quality: 'Qualité',
  stripe: 'Stripe',
};

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialFilters() {
  const today = new Date();
  return {
    dateFrom: `${today.getFullYear()}-01-01`,
    dateTo: toDateInput(today),
    courseId: '',
  };
}

function dateLabel(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
}

function KpiCard({ label, value, note }) {
  return (
    <article className="cockpit-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

export default function AdminCockpit() {
  const { role } = useAuth();
  const [searchParams] = useSearchParams();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (role !== 'admin') return undefined;
    let active = true;
    fetchCockpitSummary(supabase, filters)
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Le cockpit ne peut pas être chargé.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [filters, reloadKey, role]);

  const prioritizedActions = useMemo(
    () => prioritizeCockpitActions(summary?.priority_actions || []),
    [summary],
  );
  const deadlines = useMemo(() => prioritizedActions
    .filter((action) => action.due_at)
    .sort((left, right) => Date.parse(left.due_at) - Date.parse(right.due_at))
    .slice(0, 5), [prioritizedActions]);
  const recentActivity = useMemo(() => [...prioritizedActions]
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .slice(0, 5), [prioritizedActions]);

  const financialRows = summary?.stripe_financial_by_currency || [];
  const euroFinancial = financialRows.find((row) => row.currency === 'eur');
  const primaryFinancial = euroFinancial || (financialRows.length === 1 ? financialRows[0] : null);
  const kpis = summary?.kpis || {};
  const domainCounts = Object.entries(summary?.action_counts_by_domain || {})
    .sort(([, left], [, right]) => Number(right) - Number(left));
  const maximumDomainCount = Math.max(1, ...domainCounts.map(([, count]) => Number(count)));

  if (searchParams.has('onglet')) {
    return <Navigate to={`/admin/pedagogique?${searchParams.toString()}`} replace />;
  }

  if (role !== 'admin') {
    return (
      <AdminShell>
        <main className="container admin-cockpit">
          <div className="cockpit-error" role="alert">
            <h1>Accès réservé</h1>
            <p>Le cockpit global est réservé au rôle administrateur.</p>
          </div>
        </main>
      </AdminShell>
    );
  }

  function applyFilters(event) {
    event.preventDefault();
    if (draftFilters.dateTo < draftFilters.dateFrom) {
      setError('La date de fin doit être postérieure à la date de début.');
      return;
    }
    setLoading(true);
    setError('');
    setFilters({ ...draftFilters });
  }

  return (
    <AdminShell>
      <main className="container admin-cockpit">
        <header className="cockpit-header">
          <div>
            <p className="cockpit-eyebrow">Pilotage FormaPrompt</p>
            <h1>Cockpit administrateur</h1>
            <p>Les priorités opérationnelles, puis les indicateurs utiles à la décision.</p>
          </div>
          <form className="cockpit-filters" onSubmit={applyFilters} aria-label="Filtres du cockpit">
            <label>
              Du
              <input type="date" value={draftFilters.dateFrom} onChange={(event) => setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
            </label>
            <label>
              Au
              <input type="date" value={draftFilters.dateTo} onChange={(event) => setDraftFilters((current) => ({ ...current, dateTo: event.target.value }))} />
            </label>
            <label>
              Formation
              <select value={draftFilters.courseId} onChange={(event) => setDraftFilters((current) => ({ ...current, courseId: event.target.value }))}>
                {COURSE_OPTIONS.map((course) => <option key={course.id || 'all'} value={course.id}>{course.label}</option>)}
              </select>
            </label>
            <button type="submit">Appliquer</button>
          </form>
        </header>

        <section className="cockpit-diagnostic-entry" aria-labelledby="cockpit-diagnostic-title">
          <div>
            <p className="cockpit-eyebrow">Diagnostic IA Express</p>
            <h2 id="cockpit-diagnostic-title">Restitutions client</h2>
            <p>Consulter les rendez-vous, lire les questionnaires et préparer les restitutions.</p>
          </div>
          <Link to="/admin/diagnostics">Gérer les Diagnostics IA</Link>
        </section>

        <section className="cockpit-diagnostic-entry" aria-labelledby="cockpit-promotions-title">
          <div>
            <p className="cockpit-eyebrow">Moteur transversal</p>
            <h2 id="cockpit-promotions-title">Promotions</h2>
            <p>Créer, cibler et désactiver les promotions FormaPrompt sans modifier les prix catalogue.</p>
          </div>
          <Link to="/admin/promotions">Gérer les promotions</Link>
        </section>

        {loading && <div className="cockpit-status" role="status">Chargement du cockpit…</div>}
        {!loading && error && (
          <div className="cockpit-error" role="alert">
            <strong>Les données du cockpit ne sont pas disponibles.</strong>
            <span>{error}</span>
            <button type="button" onClick={() => { setLoading(true); setError(''); setReloadKey((value) => value + 1); }}>Réessayer</button>
          </div>
        )}

        {!loading && !error && summary && (
          <>
            <div className="cockpit-primary-grid">
              <section className="cockpit-panel cockpit-actions-panel" aria-labelledby="actions-title">
                <div className="cockpit-section-heading">
                  <div>
                    <p>Priorité client, puis opérationnelle</p>
                    <h2 id="actions-title">À traiter maintenant</h2>
                  </div>
                  <span>{Number(kpis.action_items_total || 0)} action(s)</span>
                </div>
                <CockpitActionList actions={prioritizedActions.slice(0, 8)} />
                {Number(kpis.action_items_total || 0) > prioritizedActions.length && (
                  <p className="cockpit-data-note">Le contrat affiche les 20 actions les plus prioritaires sur {kpis.action_items_total}.</p>
                )}
              </section>

              <aside className="cockpit-side-column" aria-label="Repères temporels">
                <section className="cockpit-panel" aria-labelledby="deadlines-title">
                  <h2 id="deadlines-title">Échéances proches</h2>
                  {deadlines.length ? (
                    <ul className="cockpit-compact-list">
                      {deadlines.map((action) => (
                        <li key={`deadline-${action.domain}-${action.item_id}`}>
                          <strong>{action.neutral_label}</strong>
                          <span>{action.is_overdue ? 'En retard · ' : ''}{dateLabel(action.due_at)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="cockpit-muted">Aucune échéance datée dans la file actuelle.</p>}
                </section>
                <section className="cockpit-panel" aria-labelledby="activity-title">
                  <h2 id="activity-title">Activité récente</h2>
                  {recentActivity.length ? (
                    <ul className="cockpit-compact-list">
                      {recentActivity.map((action) => (
                        <li key={`recent-${action.domain}-${action.item_id}`}>
                          <strong>{action.neutral_label}</strong>
                          <span>{dateLabel(action.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="cockpit-muted">Aucun nouvel élément actionnable.</p>}
                </section>
              </aside>
            </div>

            <section className="cockpit-kpi-section" aria-labelledby="kpi-title">
              <div className="cockpit-section-heading">
                <div><p>Période sélectionnée</p><h2 id="kpi-title">Indicateurs clés</h2></div>
              </div>
              <div className="cockpit-kpis">
                <KpiCard label="Actions à traiter" value={Number(kpis.action_items_total || 0)} note={`${Number(kpis.critical_action_items || 0)} critique(s)`} />
                <KpiCard label="Apprenants actifs" value={Number(kpis.active_course_access || 0)} note="Source : course_access" />
                <KpiCard label="Activités réalisées" value={Number(kpis.completed_training_activities || 0)} note="LMS et activités externes" />
                <KpiCard label="Stagiaires réalisés" value={Number(kpis.completed_trainees || 0)} note="Sur la période" />
                <KpiCard label="Actions qualité en retard" value={Number(kpis.overdue_quality_actions || 0)} note="Indicateur global" />
                <KpiCard
                  label="Net Stripe estimé"
                  value={primaryFinancial ? formatMoney(primaryFinancial.estimated_net_stripe_cents, primaryFinancial.currency) : 'Non disponible'}
                  note={primaryFinancial ? 'Estimation locale, hors solde bancaire' : 'Aucune devise unique exploitable'}
                />
              </div>
            </section>

            <section className="cockpit-panel cockpit-synthesis" aria-labelledby="synthesis-title">
              <div className="cockpit-section-heading">
                <div><p>Lecture utile, sans graphique décoratif</p><h2 id="synthesis-title">Tendances et synthèse</h2></div>
              </div>
              <div className="cockpit-synthesis__grid">
                <div>
                  <h3>Actions par domaine</h3>
                  {domainCounts.length ? (
                    <ul className="cockpit-domain-list">
                      {domainCounts.map(([domain, count]) => (
                        <li key={domain}>
                          <span><strong>{DOMAIN_LABELS[domain] || domain}</strong><b>{count}</b></span>
                          <progress value={Number(count)} max={maximumDomainCount} aria-label={`${DOMAIN_LABELS[domain] || domain} : ${count}`} />
                        </li>
                      ))}
                    </ul>
                  ) : <p className="cockpit-muted">Aucune action à répartir.</p>}
                </div>
                <div>
                  <h3>Synthèse financière locale</h3>
                  {financialRows.length ? financialRows.map((row) => (
                    <dl className="cockpit-finance-summary" key={row.currency}>
                      <div><dt>Net Stripe estimé</dt><dd>{formatMoney(row.estimated_net_stripe_cents, row.currency)}</dd></div>
                      <div><dt>Remboursements confirmés</dt><dd>{formatMoney(row.successful_refund_cents, row.currency)}</dd></div>
                      <div><dt>Litiges ouverts</dt><dd>{formatMoney(row.open_dispute_cents, row.currency)}</dd></div>
                    </dl>
                  )) : <p className="cockpit-muted">Aucun mouvement Stripe sur la période.</p>}
                  <p className="cockpit-data-note">Ces montants sont des estimations issues des registres locaux, pas un solde Stripe ou bancaire.</p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </AdminShell>
  );
}
