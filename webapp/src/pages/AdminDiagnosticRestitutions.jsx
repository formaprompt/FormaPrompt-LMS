import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import {
  completeDiagnosticBooking,
  correctDiagnosticRestitution,
  createEmptyRestitutionContent,
  DIAGNOSTIC_FILTERS,
  fetchDiagnosticAdministration,
  filterDiagnostics,
  isRevisionConflict,
  MATURITY_LEVELS,
  publishDiagnosticRestitution,
  RESTITUTION_LIMITS,
  restitutionToContent,
  saveDiagnosticRestitution,
  validateRestitutionContent,
} from '../lib/diagnosticRestitution';
import './AdminDiagnosticRestitutions.css';

const BOOKING_LABELS = {
  booking_pending: 'Réservation en cours',
  booked: 'Réservé',
  cancelled: 'Annulé',
  completed: 'Réalisé',
};

const ORDER_LABELS = {
  payment_pending: 'Paiement en attente',
  paid: 'Payée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
  disputed: 'Contestée',
  chargeback: 'Chargeback',
};

const QUESTIONNAIRE_FIELDS = [
  ['Organisation', 'organization'],
  ['Fonction', 'job_title'],
  ['Secteur', 'sector'],
  ['Taille de l’organisation', 'organization_size'],
  ['Outils utilisés', 'tools_used'],
  ['Niveau IA déclaré', 'ai_level'],
  ['Tâches répétitives', 'repetitive_tasks'],
  ['Documents traités', 'documents_handled'],
  ['Difficulté principale', 'main_difficulty'],
  ['Objectif du diagnostic', 'diagnostic_goal'],
  ['Tâche à réduire', 'one_task_to_remove'],
];

const QUESTIONNAIRE_VALUE_LABELS = {
  independent: 'Indépendant',
  '1_9': '1 à 9 personnes',
  '10_49': '10 à 49 personnes',
  '50_249': '50 à 249 personnes',
  '250_plus': '250 personnes ou plus',
  discovery: 'Découverte',
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
};

const OPPORTUNITY_FIELDS = [
  ['Titre', 'title', 200],
  ['Bénéfice attendu', 'expected_benefit', 1000],
  ['Effort indicatif', 'effort', 300],
  ['Coût indicatif', 'indicative_cost', 300],
  ['Risque ou vigilance', 'risk_or_watchpoint', 1000],
  ['Première action', 'first_action', 1000],
];

const EMPTY_OPPORTUNITY = Object.freeze({
  title: '', expected_benefit: '', effort: '', indicative_cost: '', risk_or_watchpoint: '', first_action: '',
});

function formatDateTime(value) {
  if (!value) return 'Non renseigné';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return 'Non renseignée';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
}

function reference(value) {
  return value || 'Non renseignée';
}

function statusClass(status) {
  return `diagnostic-admin-status is-${String(status || 'missing').replaceAll('_', '-')}`;
}

function restitutionLabel(restitution) {
  if (!restitution) return 'Absente';
  return restitution.status === 'published' ? 'Publiée' : 'Brouillon';
}

function ConfirmationDialog({ type, onCancel, onConfirm, busy }) {
  const publication = type === 'publish';
  return (
    <div className="diagnostic-admin-dialog-backdrop" role="presentation">
      <section className="diagnostic-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="diagnostic-confirmation-title">
        <h2 id="diagnostic-confirmation-title">{publication ? 'Confirmer la publication' : 'Confirmer la réalisation'}</h2>
        <p>{publication
          ? 'Après publication, la restitution devient immédiatement visible par le client.'
          : 'Confirmez que le rendez-vous Diagnostic IA a bien été réalisé. Calendar et Meet ne seront pas modifiés.'}</p>
        <div className="diagnostic-admin-dialog__actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>Annuler</button>
          <button type="button" className="button-primary" onClick={onConfirm} disabled={busy}>
            {busy ? 'Traitement…' : publication ? 'Publier maintenant' : 'Marquer comme réalisé'}
          </button>
        </div>
      </section>
    </div>
  );
}

function CharacterField({ label, value, onChange, maximum, disabled, rows = 4, hint }) {
  const id = `restitution-${label.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
  return (
    <div className="diagnostic-admin-field">
      <label htmlFor={id}>{label}</label>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      <textarea id={id} rows={rows} maxLength={maximum} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
      <small className="diagnostic-admin-counter">{value.length} / {maximum}</small>
    </div>
  );
}

function TextListEditor({ title, singular, values, limits, onChange, disabled }) {
  function update(index, value) {
    onChange(values.map((item, itemIndex) => itemIndex === index ? value : item));
  }
  return (
    <div className="diagnostic-admin-list-editor">
      <div className="diagnostic-admin-list-editor__heading">
        <h3>{title}</h3><span>{values.length} / {limits.items}</span>
      </div>
      {values.length === 0 && <p className="diagnostic-admin-muted">Aucun élément renseigné.</p>}
      {values.map((item, index) => (
        <div className="diagnostic-admin-list-row" key={`${singular}-${index}`}>
          <label>
            <span className="sr-only">{singular} {index + 1}</span>
            <textarea aria-label={`${singular} ${index + 1}`} rows="2" maxLength={limits.item} value={item} onChange={(event) => update(index, event.target.value)} disabled={disabled} />
            <small>{item.length} / {limits.item}</small>
          </label>
          <button type="button" className="button-tertiary" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} disabled={disabled}>Retirer</button>
        </div>
      ))}
      <button type="button" className="button-secondary" onClick={() => onChange([...values, ''])} disabled={disabled || values.length >= limits.items}>
        Ajouter {singular.toLowerCase()}
      </button>
    </div>
  );
}

function OpportunityEditor({ values, onChange, disabled }) {
  function update(index, field, value) {
    onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }
  return (
    <div className="diagnostic-admin-list-editor">
      <div className="diagnostic-admin-list-editor__heading"><h3>Opportunités prioritaires</h3><span>{values.length} / 3</span></div>
      {values.length === 0 && <p className="diagnostic-admin-muted">Aucune opportunité renseignée.</p>}
      {values.map((item, index) => (
        <article className="diagnostic-admin-opportunity" key={`opportunity-${index}`}>
          <header><h4>Opportunité {index + 1}</h4><button type="button" className="button-tertiary" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} disabled={disabled}>Retirer</button></header>
          <div className="diagnostic-admin-form-grid">
            {OPPORTUNITY_FIELDS.map(([label, field, maximum]) => (
              <label key={field} className={field === 'title' ? 'is-wide' : ''}>
                {label}
                <textarea rows={field === 'title' ? 2 : 3} maxLength={maximum} value={item[field]} onChange={(event) => update(index, field, event.target.value)} disabled={disabled} />
                <small>{item[field].length} / {maximum}</small>
              </label>
            ))}
          </div>
        </article>
      ))}
      <button type="button" className="button-secondary" onClick={() => onChange([...values, { ...EMPTY_OPPORTUNITY }])} disabled={disabled || values.length >= 3}>Ajouter une opportunité</button>
    </div>
  );
}

function ShortTermActionsEditor({ values, onChange, disabled }) {
  function update(index, field, value) {
    onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }
  return (
    <div className="diagnostic-admin-list-editor">
      <div className="diagnostic-admin-list-editor__heading"><h3>Plan à court terme</h3><span>{values.length} / 6</span></div>
      {values.length === 0 && <p className="diagnostic-admin-muted">Aucune action renseignée.</p>}
      {values.map((item, index) => (
        <div className="diagnostic-admin-action-row" key={`action-${index}`}>
          <label>Action {index + 1}<textarea rows="2" maxLength="1000" value={item.action} onChange={(event) => update(index, 'action', event.target.value)} disabled={disabled} /></label>
          <label>Horizon<select value={item.horizon} onChange={(event) => update(index, 'horizon', event.target.value)} disabled={disabled}><option value="immediate">Immédiat</option><option value="30_days">30 jours</option><option value="90_days">90 jours</option></select></label>
          <button type="button" className="button-tertiary" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} disabled={disabled}>Retirer</button>
        </div>
      ))}
      <button type="button" className="button-secondary" onClick={() => onChange([...values, { action: '', horizon: 'immediate' }])} disabled={disabled || values.length >= 6}>Ajouter une action</button>
    </div>
  );
}

function RestitutionPreview({ content, onClose }) {
  const maturity = MATURITY_LEVELS.find((level) => level.value === Number(content.observed_maturity_level));
  const sections = [
    ['Analyse de maturité', content.maturity_assessment],
    ['Usages actuels', content.current_uses],
    ['Confidentialité et RGPD', content.privacy_rgpd_considerations],
    ['AI Act', content.ai_act_considerations],
    ['Prochaines étapes', content.next_steps],
  ];
  return (
    <section className="diagnostic-admin-preview" aria-labelledby="diagnostic-preview-title">
      <header><div><p>Aperçu non publié</p><h2 id="diagnostic-preview-title">Restitution Diagnostic IA Express</h2></div><button type="button" className="button-secondary" onClick={onClose}>Fermer l’aperçu</button></header>
      <div className="diagnostic-admin-preview__intro"><span>Niveau de maturité</span><strong>{maturity ? `${maturity.value}. ${maturity.label}` : 'À renseigner'}</strong><p>{content.overall_summary || 'La synthèse générale apparaîtra ici.'}</p></div>
      {sections.map(([title, value]) => value && <section key={title}><h3>{title}</h3><p>{value}</p></section>)}
      <PreviewList title="Points forts" values={content.strengths} />
      <PreviewList title="Points de vigilance" values={content.watch_points} />
      {content.priority_opportunities.length > 0 && <section><h3>Opportunités prioritaires</h3><div className="diagnostic-admin-preview__cards">{content.priority_opportunities.map((item, index) => <article key={`preview-opportunity-${index}`}><h4>{item.title || `Opportunité ${index + 1}`}</h4><p>{item.expected_benefit}</p><dl><div><dt>Effort</dt><dd>{item.effort || 'À préciser'}</dd></div><div><dt>Coût</dt><dd>{item.indicative_cost || 'À préciser'}</dd></div><div><dt>Vigilance</dt><dd>{item.risk_or_watchpoint || 'À préciser'}</dd></div><div><dt>Première action</dt><dd>{item.first_action || 'À préciser'}</dd></div></dl></article>)}</div></section>}
      <PreviewList title="Recommandations" values={content.recommendations} />
      {content.short_term_actions.length > 0 && <section><h3>Plan à court terme</h3><ol>{content.short_term_actions.map((item, index) => <li key={`preview-action-${index}`}><strong>{item.action || 'Action à préciser'}</strong> — {{ immediate: 'Immédiat', '30_days': '30 jours', '90_days': '90 jours' }[item.horizon] || 'Horizon à préciser'}</li>)}</ol></section>}
      <PreviewList title="Familles d’outils recommandées" values={content.recommended_tool_families} />
    </section>
  );
}

function PreviewList({ title, values }) {
  if (!values.length) return null;
  return <section><h3>{title}</h3><ul>{values.map((value, index) => <li key={`${title}-${index}`}>{value}</li>)}</ul></section>;
}

function RestitutionForm({ diagnostic, content, setContent, working, correctionMode, setCorrectionMode, correctionReason, setCorrectionReason, onCancelCorrection, onSave, onPreview, onPublish, onCorrect }) {
  const restitution = diagnostic.restitution;
  const published = restitution?.status === 'published';
  const disabled = working || (published && !correctionMode);
  const publicationValidation = validateRestitutionContent(content, { forPublication: true });
  const setField = (field) => (value) => setContent((current) => ({ ...current, [field]: value }));
  const canPublish = restitution?.status === 'draft' && diagnostic.status === 'completed' && publicationValidation.valid;
  return (
    <section className="diagnostic-admin-restitution" aria-labelledby="restitution-form-title">
      <header className="diagnostic-admin-section-heading">
        <div><p>Document métier privé</p><h2 id="restitution-form-title">Restitution</h2></div>
        <div className="diagnostic-admin-restitution__meta">
          <span className={statusClass(restitution?.status)}>{restitutionLabel(restitution)}</span>
          {restitution && <span>Révision {restitution.revision}</span>}
          {restitution?.content_sha256 && <span title={restitution.content_sha256}>SHA {restitution.content_sha256.slice(0, 12)}…</span>}
        </div>
      </header>
      {published && <div className="diagnostic-admin-publication-note"><strong>Publiée le {formatDateTime(restitution.published_at)}</strong>{restitution.corrected_at && <span>Révision {restitution.revision} — corrigée le {formatDateTime(restitution.corrected_at)}</span>}<span>Consultable jusqu’au {formatDate(restitution.retention_due_at)}</span></div>}

      <form onSubmit={(event) => event.preventDefault()}>
        <fieldset disabled={disabled}>
          <legend>Synthèse</legend>
          <CharacterField label="Synthèse générale" value={content.overall_summary} onChange={setField('overall_summary')} maximum={RESTITUTION_LIMITS.overall_summary} disabled={disabled} rows={6} hint="50 caractères minimum pour publier." />
          <label className="diagnostic-admin-field">Niveau de maturité
            <select value={content.observed_maturity_level ?? ''} onChange={(event) => setField('observed_maturity_level')(event.target.value ? Number(event.target.value) : null)} disabled={disabled}>
              <option value="">À évaluer</option>{MATURITY_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.value}. {level.label}</option>)}
            </select>
          </label>
          <CharacterField label="Analyse de maturité" value={content.maturity_assessment} onChange={setField('maturity_assessment')} maximum={RESTITUTION_LIMITS.maturity_assessment} disabled={disabled} />
          <CharacterField label="Usages actuels" value={content.current_uses} onChange={setField('current_uses')} maximum={RESTITUTION_LIMITS.current_uses} disabled={disabled} />
        </fieldset>

        <fieldset disabled={disabled}><legend>Forces et vigilances</legend><div className="diagnostic-admin-two-columns"><TextListEditor title="Points forts" singular="Point fort" values={content.strengths} limits={RESTITUTION_LIMITS.strengths} onChange={setField('strengths')} disabled={disabled} /><TextListEditor title="Points de vigilance" singular="Point de vigilance" values={content.watch_points} limits={RESTITUTION_LIMITS.watch_points} onChange={setField('watch_points')} disabled={disabled} /></div></fieldset>
        <fieldset disabled={disabled}><legend>Priorités</legend><OpportunityEditor values={content.priority_opportunities} onChange={setField('priority_opportunities')} disabled={disabled} /></fieldset>
        <fieldset disabled={disabled}><legend>Recommandations</legend><TextListEditor title="Recommandations concrètes" singular="Recommandation" values={content.recommendations} limits={RESTITUTION_LIMITS.recommendations} onChange={setField('recommendations')} disabled={disabled} /></fieldset>
        <fieldset disabled={disabled}><legend>Plan d’action</legend><ShortTermActionsEditor values={content.short_term_actions} onChange={setField('short_term_actions')} disabled={disabled} /></fieldset>
        <fieldset disabled={disabled}><legend>Outils</legend><TextListEditor title="Familles d’outils recommandées" singular="Famille d’outils" values={content.recommended_tool_families} limits={RESTITUTION_LIMITS.recommended_tool_families} onChange={setField('recommended_tool_families')} disabled={disabled} /></fieldset>
        <fieldset disabled={disabled}><legend>Conformité</legend><CharacterField label="Confidentialité et RGPD" value={content.privacy_rgpd_considerations} onChange={setField('privacy_rgpd_considerations')} maximum={RESTITUTION_LIMITS.privacy_rgpd_considerations} disabled={disabled} /><CharacterField label="AI Act" value={content.ai_act_considerations} onChange={setField('ai_act_considerations')} maximum={RESTITUTION_LIMITS.ai_act_considerations} disabled={disabled} /></fieldset>
        <fieldset disabled={disabled}><legend>Suite</legend><CharacterField label="Prochaines étapes proposées" value={content.next_steps} onChange={setField('next_steps')} maximum={RESTITUTION_LIMITS.next_steps} disabled={disabled} /></fieldset>

        {correctionMode && <div className="diagnostic-admin-field diagnostic-admin-correction-reason">
          <label htmlFor="diagnostic-correction-reason">Motif de correction obligatoire</label>
          <textarea id="diagnostic-correction-reason" rows="3" minLength="5" maxLength={RESTITUTION_LIMITS.correction_reason} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} disabled={working} />
          <small>{correctionReason.length} / {RESTITUTION_LIMITS.correction_reason}</small>
        </div>}

        <div className="diagnostic-admin-form-actions">
          <button type="button" className="button-secondary" onClick={onPreview}>Prévisualiser</button>
          {!published && <button type="button" className="button-primary" onClick={onSave} disabled={working}>Enregistrer le brouillon</button>}
          {restitution?.status === 'draft' && <button type="button" className="button-publish" onClick={onPublish} disabled={working || !canPublish}>Publier la restitution</button>}
          {published && !correctionMode && <button type="button" className="button-secondary" onClick={() => setCorrectionMode(true)} disabled={working}>Corriger la restitution</button>}
          {published && correctionMode && <><button type="button" className="button-primary" onClick={onCorrect} disabled={working || correctionReason.trim().length < 5}>Enregistrer la correction</button><button type="button" className="button-tertiary" onClick={onCancelCorrection} disabled={working}>Annuler la correction</button></>}
        </div>
        {restitution?.status === 'draft' && diagnostic.status !== 'completed' && <p className="diagnostic-admin-help">Le diagnostic doit être marqué comme réalisé avant publication.</p>}
        {restitution?.status === 'draft' && diagnostic.status === 'completed' && !publicationValidation.valid && <p className="diagnostic-admin-help">Complétez les champs métier requis avant publication.</p>}
      </form>
    </section>
  );
}

export default function AdminDiagnosticRestitutions() {
  const { role } = useAuth();
  const [diagnostics, setDiagnostics] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [content, setContent] = useState(createEmptyRestitutionContent);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [revisionConflict, setRevisionConflict] = useState(false);

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    if (role !== 'admin') return;
    if (!quiet) setLoading(true);
    try {
      const data = await fetchDiagnosticAdministration(supabase);
      setDiagnostics(data);
      setSelectedId((current) => current && data.some((item) => item.id === current) ? current : null);
      const refreshedSelection = data.find((item) => item.id === selectedId);
      if (refreshedSelection) {
        setContent(restitutionToContent(refreshedSelection.restitution));
        setCorrectionMode(false);
        setCorrectionReason('');
      }
      setFeedback(null);
      setRevisionConflict(false);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Les Diagnostics IA ne peuvent pas être chargés.' });
    } finally {
      setLoading(false);
    }
  }, [role, selectedId]);

  useEffect(() => {
    if (role !== 'admin') return undefined;
    let active = true;
    fetchDiagnosticAdministration(supabase)
      .then((data) => {
        if (!active) return;
        setDiagnostics(data);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setFeedback({ type: 'error', message: error.message || 'Les Diagnostics IA ne peuvent pas être chargés.' });
        setLoading(false);
      });
    return () => { active = false; };
  }, [role]);

  const selected = diagnostics.find((item) => item.id === selectedId) || null;
  const visibleDiagnostics = useMemo(() => filterDiagnostics(diagnostics, filter), [diagnostics, filter]);

  function openDiagnostic(diagnostic) {
    setSelectedId(diagnostic.id);
    setContent(restitutionToContent(diagnostic.restitution));
    setCorrectionMode(false);
    setCorrectionReason('');
    setPreviewOpen(false);
    setRevisionConflict(false);
  }

  function replaceSelected(values) {
    setDiagnostics((current) => current.map((item) => item.id === selectedId ? { ...item, ...values } : item));
  }

  function handleError(error, fallback) {
    const conflict = isRevisionConflict(error);
    setRevisionConflict(conflict);
    setFeedback({ type: 'error', message: conflict
      ? 'Une version plus récente existe. Rechargez la fiche avant de poursuivre.'
      : error.message || fallback });
  }

  async function completeBooking() {
    if (!selected) return;
    setWorking(true);
    try {
      const booking = await completeDiagnosticBooking(supabase, selected.id);
      replaceSelected({ ...booking, order: selected.order, questionnaire: selected.questionnaire, restitution: selected.restitution, clientName: selected.clientName });
      setConfirmation(null);
      await loadData({ quiet: true });
      setFeedback({ type: 'success', message: 'Le diagnostic est marqué comme réalisé.' });
    } catch (error) {
      handleError(error, 'Le diagnostic ne peut pas être marqué comme réalisé.');
    } finally {
      setWorking(false);
    }
  }

  async function saveDraft() {
    if (!selected) return;
    const validation = validateRestitutionContent(content);
    if (!validation.valid) {
      setFeedback({ type: 'error', message: 'Le brouillon contient une valeur vide, trop longue ou non conforme.' });
      return;
    }
    setWorking(true);
    try {
      const restitution = await saveDiagnosticRestitution(supabase, selected.id, selected.restitution?.revision || 0, content);
      replaceSelected({ restitution });
      setContent(restitutionToContent(restitution));
      setFeedback({ type: 'success', message: `Brouillon enregistré — révision ${restitution.revision}.` });
      setRevisionConflict(false);
    } catch (error) {
      handleError(error, 'Le brouillon ne peut pas être enregistré.');
    } finally {
      setWorking(false);
    }
  }

  async function publishRestitution() {
    if (!selected?.restitution) return;
    setWorking(true);
    try {
      const restitution = await publishDiagnosticRestitution(supabase, selected.restitution.id, selected.restitution.revision);
      replaceSelected({ restitution });
      setContent(restitutionToContent(restitution));
      setFeedback({ type: 'success', message: 'La restitution est publiée et visible par le client.' });
      setConfirmation(null);
    } catch (error) {
      handleError(error, 'La restitution ne peut pas être publiée.');
    } finally {
      setWorking(false);
    }
  }

  async function correctRestitution() {
    if (!selected?.restitution || correctionReason.trim().length < 5) {
      setFeedback({ type: 'error', message: 'Le motif de correction doit comporter au moins 5 caractères.' });
      return;
    }
    const validation = validateRestitutionContent(content, { forPublication: true });
    if (!validation.valid) {
      setFeedback({ type: 'error', message: 'La correction doit conserver un contenu complet et publiable.' });
      return;
    }
    setWorking(true);
    try {
      const restitution = await correctDiagnosticRestitution(supabase, selected.restitution.id, selected.restitution.revision, content, correctionReason);
      replaceSelected({ restitution });
      setContent(restitutionToContent(restitution));
      setCorrectionMode(false);
      setCorrectionReason('');
      setFeedback({ type: 'success', message: `Correction enregistrée — révision ${restitution.revision}.` });
      setRevisionConflict(false);
    } catch (error) {
      handleError(error, 'La correction ne peut pas être enregistrée.');
    } finally {
      setWorking(false);
    }
  }

  if (role !== 'admin') return <main className="container diagnostic-admin"><div className="diagnostic-admin-message is-error" role="alert"><h1>Accès réservé</h1><p>La gestion des Diagnostics IA est réservée à l’administrateur.</p></div></main>;

  return (
    <main className="container diagnostic-admin">
      <header className="diagnostic-admin-header"><div><p className="diagnostic-admin-eyebrow">Diagnostic IA Express</p><h1>Diagnostics et restitutions</h1><p>Du rendez-vous confirmé à la restitution publiée, sans modifier les données Calendar ou Meet.</p></div><button type="button" className="button-secondary" onClick={() => loadData()} disabled={loading || working}>Actualiser</button></header>

      {feedback && <div className={`diagnostic-admin-message is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}><span>{feedback.message}</span>{revisionConflict && <button type="button" onClick={() => loadData()}>Recharger la fiche</button>}</div>}
      {loading && <p className="diagnostic-admin-message" role="status">Chargement des Diagnostics IA…</p>}

      {!loading && <div className="diagnostic-admin-layout">
        <aside className="diagnostic-admin-list" aria-label="Liste des Diagnostics IA">
          <div className="diagnostic-admin-list__heading"><h2>Diagnostics</h2><span>{visibleDiagnostics.length}</span></div>
          <div className="diagnostic-admin-filters" aria-label="Filtres des Diagnostics IA">{DIAGNOSTIC_FILTERS.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
          {visibleDiagnostics.length === 0 && <p className="diagnostic-admin-empty">Aucun diagnostic dans ce filtre.</p>}
          <div className="diagnostic-admin-cards">{visibleDiagnostics.map((item) => <article key={item.id} className={item.id === selectedId ? 'is-selected' : ''}><div><strong>{item.clientName}</strong><span>{formatDateTime(item.starts_at)}</span></div><div className="diagnostic-admin-card-statuses"><span className={statusClass(item.status)}>{BOOKING_LABELS[item.status] || item.status}</span><span className={statusClass(item.questionnaire ? 'received' : 'missing')}>{item.questionnaire ? 'Questionnaire transmis' : 'Questionnaire absent'}</span><span className={statusClass(item.restitution?.status)}>{restitutionLabel(item.restitution)}</span></div><button type="button" onClick={() => openDiagnostic(item)}>Ouvrir la fiche de {item.clientName}</button></article>)}</div>
        </aside>

        <section className="diagnostic-admin-detail" aria-live="polite">
          {!selected && <div className="diagnostic-admin-empty-detail"><h2>Sélectionnez un diagnostic</h2><p>La commande, le questionnaire et la restitution apparaîtront ici.</p></div>}
          {selected && <>
            <header className="diagnostic-admin-detail__header"><div><p>Fiche Diagnostic</p><h2>{selected.clientName}</h2><span>{selected.order?.customer_email}</span></div><button type="button" className="button-tertiary" onClick={() => setSelectedId(null)}>Fermer la fiche</button></header>
            <div className="diagnostic-admin-summary-grid">
              <section><h3>Commande</h3><dl><div><dt>Référence</dt><dd className="diagnostic-admin-reference">{reference(selected.order_id)}</dd></div><div><dt>Client</dt><dd>{selected.order?.customer_email || selected.clientName}</dd></div><div><dt>Statut</dt><dd>{ORDER_LABELS[selected.order?.status] || selected.order?.status || 'Inconnu'}</dd></div></dl></section>
              <section><h3>Rendez-vous</h3><dl><div><dt>Date et horaires</dt><dd>{formatDateTime(selected.starts_at)} – {new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(new Date(selected.ends_at))}</dd></div><div><dt>Booking</dt><dd>{BOOKING_LABELS[selected.status] || selected.status}</dd></div><div><dt>Calendar</dt><dd>{selected.google_sync_status}</dd></div><div><dt>Meet</dt><dd>{selected.google_meet_status}</dd></div></dl>{selected.status === 'booked' && <button type="button" className="button-primary" onClick={() => setConfirmation('complete')} disabled={working}>Marquer le diagnostic comme réalisé</button>}</section>
            </div>

            <section className="diagnostic-admin-questionnaire" aria-labelledby="questionnaire-title"><header className="diagnostic-admin-section-heading"><div><p>Lecture seule</p><h2 id="questionnaire-title">Questionnaire préalable</h2></div><span className={statusClass(selected.questionnaire ? 'received' : 'missing')}>{selected.questionnaire ? 'Transmis' : 'Absent'}</span></header>{selected.questionnaire ? <><p className="diagnostic-admin-questionnaire__identity"><strong>{selected.questionnaire.first_name} {selected.questionnaire.last_name}</strong> · version {selected.questionnaire.questionnaire_version} · transmis le {formatDateTime(selected.questionnaire.submitted_at)}</p><dl>{QUESTIONNAIRE_FIELDS.map(([label, field]) => <div key={field}><dt>{label}</dt><dd>{QUESTIONNAIRE_VALUE_LABELS[selected.questionnaire[field]] || selected.questionnaire[field]}</dd></div>)}</dl></> : <p className="diagnostic-admin-muted">Aucun questionnaire n’a été transmis pour ce booking.</p>}</section>

            {previewOpen && <RestitutionPreview content={content} onClose={() => setPreviewOpen(false)} />}
            <RestitutionForm diagnostic={selected} content={content} setContent={setContent} working={working} correctionMode={correctionMode} setCorrectionMode={setCorrectionMode} correctionReason={correctionReason} setCorrectionReason={setCorrectionReason} onCancelCorrection={() => { setCorrectionMode(false); setCorrectionReason(''); setContent(restitutionToContent(selected.restitution)); }} onSave={saveDraft} onPreview={() => setPreviewOpen(true)} onPublish={() => setConfirmation('publish')} onCorrect={correctRestitution} />
          </>}
        </section>
      </div>}
      {confirmation && <ConfirmationDialog type={confirmation} onCancel={() => setConfirmation(null)} onConfirm={confirmation === 'publish' ? publishRestitution : completeBooking} busy={working} />}
    </main>
  );
}
