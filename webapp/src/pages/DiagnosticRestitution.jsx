import { useEffect, useMemo, useState } from 'react';
import { FileText, Printer, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/useAuth';
import {
  DIAGNOSTIC_UUID_PATTERN,
  fetchPublishedDiagnosticRestitution,
  MATURITY_LEVELS,
} from '../lib/diagnosticRestitution';
import { supabase } from '../lib/supabaseClient';
import './DiagnosticRestitution.css';

const HORIZONS = [
  ['immediate', 'Immédiat'],
  ['30_days', '30 jours'],
  ['90_days', '90 jours'],
];

function formatDate(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date(value));
}

function TextSection({ title, children }) {
  if (!children) return null;
  return <section className="diagnostic-restitution-section"><h2>{title}</h2><p>{children}</p></section>;
}

function ListSection({ title, values }) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return <section className="diagnostic-restitution-section"><h2>{title}</h2><ul>{values.map((value, index) => <li key={`${title}-${index}`}>{value}</li>)}</ul></section>;
}

function RestitutionDocument({ restitution }) {
  const maturity = MATURITY_LEVELS.find((item) => item.value === Number(restitution.observed_maturity_level));
  const actionGroups = HORIZONS.map(([id, label]) => ({
    id,
    label,
    actions: (restitution.short_term_actions || []).filter((item) => item.horizon === id),
  })).filter((group) => group.actions.length > 0);

  return (
    <article className="diagnostic-restitution-document">
      <header className="diagnostic-restitution-document__header">
        <p>FormaPrompt</p>
        <h1>Diagnostic IA Express</h1>
        <dl>
          <div><dt>Date du diagnostic</dt><dd>{formatDate(restitution.booking.starts_at) || 'Non renseignée'}</dd></div>
          <div><dt>Restitution publiée</dt><dd>{formatDate(restitution.published_at) || 'Non renseignée'}</dd></div>
        </dl>
        {restitution.corrected_at && <p className="diagnostic-restitution-correction">Restitution mise à jour le {formatDate(restitution.corrected_at)}</p>}
      </header>

      <TextSection title="Synthèse générale">{restitution.overall_summary}</TextSection>
      <section className="diagnostic-restitution-section diagnostic-restitution-maturity">
        <h2>Niveau de maturité IA</h2>
        <strong>{maturity ? `${maturity.value}. ${maturity.label}` : 'Non renseigné'}</strong>
      </section>
      <TextSection title="Analyse de maturité">{restitution.maturity_assessment}</TextSection>
      <TextSection title="Usages actuels">{restitution.current_uses}</TextSection>
      <ListSection title="Points forts" values={restitution.strengths} />
      <ListSection title="Points de vigilance" values={restitution.watch_points} />

      {Array.isArray(restitution.priority_opportunities) && restitution.priority_opportunities.length > 0 && (
        <section className="diagnostic-restitution-section">
          <h2>Opportunités prioritaires</h2>
          <div className="diagnostic-restitution-opportunities">
            {restitution.priority_opportunities.map((opportunity, index) => (
              <article key={`opportunity-${index}`}>
                <h3>{opportunity.title}</h3>
                {opportunity.expected_benefit && <p>{opportunity.expected_benefit}</p>}
                <dl>
                  {opportunity.effort && <div><dt>Effort</dt><dd>{opportunity.effort}</dd></div>}
                  {opportunity.indicative_cost && <div><dt>Coût indicatif</dt><dd>{opportunity.indicative_cost}</dd></div>}
                  {opportunity.risk_or_watchpoint && <div><dt>Vigilance</dt><dd>{opportunity.risk_or_watchpoint}</dd></div>}
                  {opportunity.first_action && <div><dt>Première action</dt><dd>{opportunity.first_action}</dd></div>}
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}

      <ListSection title="Recommandations" values={restitution.recommendations} />
      {actionGroups.length > 0 && (
        <section className="diagnostic-restitution-section">
          <h2>Plan d’action à court terme</h2>
          <div className="diagnostic-restitution-action-groups">
            {actionGroups.map((group) => <section key={group.id}><h3>{group.label}</h3><ul>{group.actions.map((item, index) => <li key={`${group.id}-${index}`}>{item.action}</li>)}</ul></section>)}
          </div>
        </section>
      )}
      <ListSection title="Outils ou familles d’outils recommandés" values={restitution.recommended_tool_families} />
      <TextSection title="Confidentialité et RGPD">{restitution.privacy_rgpd_considerations}</TextSection>
      <TextSection title="AI Act">{restitution.ai_act_considerations}</TextSection>
      <TextSection title="Prochaines étapes">{restitution.next_steps}</TextSection>
    </article>
  );
}

export default function DiagnosticRestitution() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking_id');
  const validBookingId = DIAGNOSTIC_UUID_PATTERN.test(bookingId || '') ? bookingId : null;
  const [status, setStatus] = useState(validBookingId ? 'loading' : 'unavailable');
  const [restitution, setRestitution] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!user || !validBookingId) return undefined;
    let active = true;
    fetchPublishedDiagnosticRestitution(supabase, validBookingId)
      .then((data) => {
        if (!active) return;
        setRestitution(data);
        setStatus(data ? 'published' : 'unavailable');
      })
      .catch(() => {
        if (!active) return;
        setRestitution(null);
        setStatus('error');
      });
    return () => { active = false; };
  }, [user, validBookingId, retryKey]);

  const pageTitle = useMemo(() => restitution
    ? `Restitution du ${formatDate(restitution.booking.starts_at)} – Diagnostic IA`
    : 'Restitution – Diagnostic IA', [restitution]);

  return (
    <>
      <SEO title={`${pageTitle} | FormaPrompt`} description="Consultation privée de votre restitution Diagnostic IA Express." url="https://formaprompt.com/diagnostic-ia/restitution" robots="noindex, nofollow" />
      <main className="diagnostic-restitution-page container section">
        <header className="diagnostic-restitution-page__heading diagnostic-print-hidden">
          <div><FileText aria-hidden="true" /><div><p>Espace privé</p><h1>Ma restitution Diagnostic IA</h1></div></div>
          {status === 'published' && <button type="button" className="btn diagnostic-restitution-print" onClick={() => window.print()}><Printer aria-hidden="true" /> Imprimer ou enregistrer en PDF</button>}
        </header>

        {status === 'loading' && <div className="diagnostic-restitution-state" role="status"><RefreshCw className="diagnostic-restitution-spin" aria-hidden="true" /><p>Chargement de votre restitution…</p></div>}
        {status === 'unavailable' && <section className="diagnostic-restitution-state"><ShieldCheck aria-hidden="true" /><h2>Cette restitution n’est pas disponible.</h2><p>Elle est peut-être encore en préparation.</p><Link className="btn" to="/dashboard">Retour à mon espace</Link></section>}
        {status === 'error' && <section className="diagnostic-restitution-state is-error" role="alert"><h2>Un problème technique empêche le chargement.</h2><p>Réessayez dans quelques instants.</p><button type="button" className="btn" onClick={() => { setStatus('loading'); setRetryKey((value) => value + 1); }}>Réessayer</button></section>}
        {status === 'published' && restitution && <RestitutionDocument restitution={restitution} />}
      </main>
    </>
  );
}
