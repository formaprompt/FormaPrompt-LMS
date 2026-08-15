import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import {
  allowedPrivacyResolutions,
  latestAssessmentRun,
  PRIVACY_ACTION_LABELS,
  PRIVACY_ACTION_STATUS_LABELS,
  PRIVACY_CATEGORY_LABELS,
  PRIVACY_CONCLUSION_LABELS,
  PRIVACY_RESOLUTION_LABELS,
  PRIVACY_STATUS_LABELS,
  privacyExecutionPhrase,
  privacyIdentityMatches,
} from '../lib/privacyAdministration';
import './AdminPrivacyRequests.css';

const IDENTITY_LABELS = {
  pending: 'À vérifier',
  not_required: 'Vérification non nécessaire',
  verified: 'Identité vérifiée',
  failed: 'Vérification non concluante',
};

const EVENT_LABELS = {
  request_created: 'Demande enregistrée',
  analysis_started: 'Analyse lancée',
  analysis_completed: 'Analyse terminée',
  status_changed: 'Statut modifié',
  identity_verification_changed: 'Vérification d’identité mise à jour',
  administrative_decision_recorded: 'Décision administrative enregistrée',
  analysis_finalized: 'Plan de traitement préparé',
  action_decided: 'Décision par catégorie enregistrée',
  execution_started: 'Exécution contrôlée démarrée',
  action_executed: 'Action exécutée',
  action_failed: 'Action externe en échec',
  external_action_confirmed: 'Action externe confirmée',
  request_completed: 'Traitement clôturé',
};

function localDateTime(value = new Date()) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Non renseigné';
}

export default function AdminPrivacyRequests() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [actions, setActions] = useState([]);
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [requestType, setRequestType] = useState('erasure');
  const [requestOrigin, setRequestOrigin] = useState('email');
  const [receivedAt, setReceivedAt] = useState(localDateTime());
  const [identityStatus, setIdentityStatus] = useState('pending');
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [actionDrafts, setActionDrafts] = useState({});
  const [executionDrafts, setExecutionDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadData = useCallback(async () => {
    if (!user || role !== 'admin') return;
    setLoading(true);
    const [profilesResult, requestsResult, assessmentsResult, actionsResult, eventsResult] = await Promise.all([
      supabase.from('profiles').select('id, email, role').order('email'),
      supabase.from('privacy_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('privacy_dependency_assessments').select('*').order('assessed_at', { ascending: false }),
      supabase.from('privacy_processing_actions').select('*').order('created_at', { ascending: false }),
      supabase.from('privacy_request_events').select('*').order('created_at', { ascending: false }),
    ]);
    const error = profilesResult.error || requestsResult.error || assessmentsResult.error || actionsResult.error || eventsResult.error;
    if (error) {
      setFeedback({ type: 'error', message: 'Les demandes RGPD ne peuvent pas être chargées.' });
    } else {
      const nextRequests = requestsResult.data || [];
      setProfiles(profilesResult.data || []);
      setRequests(nextRequests);
      setAssessments(assessmentsResult.data || []);
      const nextActions = actionsResult.data || [];
      setActions(nextActions);
      setEvents(eventsResult.data || []);
      setReviewDrafts(Object.fromEntries(nextRequests.map((request) => [request.id, {
        status: request.status,
        identityStatus: request.identity_verification_status,
        decision: request.administrative_decision || '',
        reason: request.decision_reason || '',
      }])));
      setActionDrafts(Object.fromEntries(nextActions.map((action) => [action.id, {
        resolution: action.resolution || action.suggested_resolution || '',
        reason: action.reason || '',
      }])));
    }
    setLoading(false);
  }, [role, user]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData, navigate, user]);

  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const matchingProfiles = useMemo(
    () => profiles.filter((profile) => privacyIdentityMatches(profile, search)),
    [profiles, search],
  );

  async function createRequest(event) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    const { error } = await supabase.rpc('admin_create_privacy_request', {
      p_subject_user_id: selectedUserId,
      p_request_type: requestType,
      p_request_origin: requestOrigin,
      p_received_at: new Date(receivedAt).toISOString(),
      p_identity_verification_status: identityStatus,
    });
    setSubmitting(false);
    if (error) {
      setFeedback({ type: 'error', message: error.message });
      return;
    }
    setFeedback({ type: 'success', message: 'Demande enregistrée. Aucune donnée n’a été supprimée.' });
    setSelectedUserId('');
    await loadData();
  }

  async function analyzeRequest(requestId) {
    setSubmitting(true);
    setFeedback(null);
    const { data, error } = await supabase.rpc('admin_analyze_privacy_request', { p_request_id: requestId });
    setSubmitting(false);
    if (error) {
      setFeedback({ type: 'error', message: error.message });
      return;
    }
    setFeedback({
      type: 'success',
      message: `Analyse terminée : ${PRIVACY_CONCLUSION_LABELS[data.analysis_conclusion]}. Aucun traitement destructif n’a été exécuté.`,
    });
    await loadData();
  }

  function updateDraft(requestId, field, value) {
    setReviewDrafts((current) => ({
      ...current,
      [requestId]: { ...current[requestId], [field]: value },
    }));
  }

  function updateActionDraft(actionId, field, value) {
    setActionDrafts((current) => ({
      ...current,
      [actionId]: { ...current[actionId], [field]: value },
    }));
  }

  function updateExecutionDraft(requestId, field, value) {
    setExecutionDrafts((current) => ({
      ...current,
      [requestId]: { ...current[requestId], [field]: value },
    }));
  }

  async function saveActionDecision(event, actionId) {
    event.preventDefault();
    const draft = actionDrafts[actionId];
    setSubmitting(true);
    setFeedback(null);
    const { error } = await supabase.rpc('admin_set_privacy_action_decision', {
      p_action_id: actionId,
      p_resolution: draft.resolution,
      p_reason: draft.reason.trim(),
    });
    setSubmitting(false);
    if (error) {
      setFeedback({ type: 'error', message: error.message });
      return;
    }
    setFeedback({ type: 'success', message: 'Décision par catégorie enregistrée et journalisée.' });
    await loadData();
  }

  async function executeRequest(event, request) {
    event.preventDefault();
    const draft = executionDrafts[request.id] || {};
    setSubmitting(true);
    setFeedback(null);
    const { data, error } = await supabase.functions.invoke('admin-process-privacy-request', {
      body: {
        requestId: request.id,
        confirmation: draft.confirmation || '',
        reason: (draft.reason || '').trim(),
      },
    });
    setSubmitting(false);
    if (error) {
      setFeedback({ type: 'error', message: error.message || 'Le traitement RGPD a été refusé.' });
      return;
    }
    setFeedback({
      type: 'success',
      message: data.status === 'closed'
        ? 'Traitement RGPD exécuté et clôturé. Le journal d’audit a été conservé.'
        : 'Traitement en base terminé. Une action externe approuvée reste à confirmer.',
    });
    setExecutionDrafts((current) => ({ ...current, [request.id]: { confirmation: '', reason: '' } }));
    await loadData();
  }

  async function confirmExternalAction(event, request, action) {
    event.preventDefault();
    const draft = executionDrafts[request.id] || {};
    setSubmitting(true);
    setFeedback(null);
    const { error } = await supabase.rpc('admin_confirm_privacy_external_action', {
      p_action_id: action.id,
      p_confirmation: `CONFIRMER ${request.subject_reference}`,
      p_reason: (draft.reason || '').trim(),
    });
    setSubmitting(false);
    if (error) {
      setFeedback({ type: 'error', message: error.message });
      return;
    }
    setFeedback({ type: 'success', message: 'Action externe confirmée et journalisée.' });
    await loadData();
  }

  async function saveReview(event, requestId) {
    event.preventDefault();
    const draft = reviewDrafts[requestId];
    setSubmitting(true);
    setFeedback(null);
    const { error } = await supabase.rpc('admin_review_privacy_request', {
      p_request_id: requestId,
      p_status: draft.status,
      p_identity_verification_status: draft.identityStatus,
      p_administrative_decision: draft.decision || null,
      p_decision_reason: draft.decision ? draft.reason.trim() : null,
    });
    setSubmitting(false);
    if (error) {
      setFeedback({ type: 'error', message: error.message });
      return;
    }
    setFeedback({ type: 'success', message: 'Revue humaine enregistrée et journalisée.' });
    await loadData();
  }

  if (!user) return null;
  if (role !== 'admin') {
    return <main className="container privacy-admin-page"><div className="privacy-alert" role="alert">Accès réservé à l’administrateur.</div></main>;
  }

  return (
    <main className="privacy-admin-page">
      <header className="privacy-header container">
        <div>
          <p className="privacy-eyebrow">Sprint 1.1A · traitement RGPD contrôlé</p>
          <h1>Demandes RGPD</h1>
          <p>Analyser les dépendances, décider catégorie par catégorie, puis exécuter uniquement le plan explicitement approuvé.</p>
        </div>
        <Link className="btn privacy-back" to="/admin">Retour à l’administration</Link>
      </header>

      <div className="container">
        <div className="privacy-safety-notice" role="note">
          <strong>Aucune action irréversible n’est automatique.</strong>
          <span>L’identité, chaque catégorie, le motif et la phrase de confirmation sont vérifiés côté serveur. Les preuves légalement nécessaires restent conservées.</span>
        </div>
        {feedback && <div className={`privacy-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</div>}

        <section className="privacy-panel" aria-labelledby="new-request-title">
          <h2 id="new-request-title">Enregistrer une demande</h2>
          <form className="privacy-form" onSubmit={createRequest}>
            <label>Rechercher la personne
              <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedUserId(''); }} placeholder="Adresse email" />
            </label>
            <label>Compte concerné
              <select required value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                <option value="">Sélectionner un compte</option>
                {matchingProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.email} · {profile.role}</option>)}
              </select>
            </label>
            <label>Type de demande
              <select value={requestType} onChange={(event) => setRequestType(event.target.value)}>
                <option value="erasure">Effacement</option><option value="access">Accès</option><option value="rectification">Rectification</option><option value="restriction">Limitation</option><option value="portability">Portabilité</option><option value="objection">Opposition</option><option value="other">Autre</option>
              </select>
            </label>
            <label>Origine
              <select value={requestOrigin} onChange={(event) => setRequestOrigin(event.target.value)}>
                <option value="email">Email</option><option value="contact_form">Formulaire de contact</option><option value="postal_mail">Courrier postal</option><option value="verbal">Demande verbale</option><option value="other">Autre</option>
              </select>
            </label>
            <label>Reçue le
              <input type="datetime-local" required value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
            </label>
            <label>Vérification d’identité
              <select value={identityStatus} onChange={(event) => setIdentityStatus(event.target.value)}>
                {Object.entries(IDENTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <button type="submit" disabled={submitting || !selectedUserId}>Enregistrer sans traiter les données</button>
          </form>
        </section>

        <section aria-labelledby="requests-title">
          <h2 id="requests-title">Demandes enregistrées</h2>
          {loading ? <p>Chargement…</p> : requests.length === 0 ? <p>Aucune demande enregistrée.</p> : (
            <div className="privacy-request-list">
              {requests.map((request) => {
                const profile = profileById.get(request.subject_user_id);
                const requestAssessments = latestAssessmentRun(assessments.filter((item) => item.request_id === request.id));
                const requestEvents = events.filter((item) => item.request_id === request.id);
                const actionByAssessment = new Map(actions.filter((item) => item.request_id === request.id).map((item) => [item.assessment_id, item]));
                const dependencyCount = requestAssessments.reduce((sum, item) => sum + (item.category === 'profile' ? 0 : item.record_count), 0);
                const draft = reviewDrafts[request.id] || { status: request.status, identityStatus: request.identity_verification_status, decision: '', reason: '' };
                const executionDraft = executionDrafts[request.id] || { confirmation: '', reason: '' };
                const expectedConfirmation = privacyExecutionPhrase(request.subject_reference);
                return (
                  <article className="privacy-request-card" key={request.id}>
                    <header>
                      <div><h3>{profile?.email || 'Identité retirée après clôture'}</h3><p>{PRIVACY_STATUS_LABELS[request.status]}</p></div>
                      <span className={`privacy-conclusion is-${request.analysis_conclusion || 'pending'}`}>{request.analysis_conclusion ? PRIVACY_CONCLUSION_LABELS[request.analysis_conclusion] : 'Analyse non lancée'}</span>
                    </header>
                    <dl className="privacy-summary">
                      <div><dt>Demande reçue</dt><dd>{formatDate(request.received_at)}</dd></div>
                      <div><dt>Identité</dt><dd>{IDENTITY_LABELS[request.identity_verification_status]}</dd></div>
                      <div><dt>Dépendances détectées</dt><dd>{dependencyCount}</dd></div>
                      <div><dt>Dernière analyse</dt><dd>{formatDate(request.last_analyzed_at)}</dd></div>
                    </dl>
                    <button type="button" disabled={submitting || !request.subject_user_id} onClick={() => analyzeRequest(request.id)}>{request.last_analyzed_at ? 'Relancer l’analyse' : 'Lancer l’analyse'}</button>

                    {requestAssessments.length > 0 && <div className="privacy-assessments" aria-label="Résultat de la dernière analyse">
                      <h4>Catégories concernées</h4>
                      <ul>{requestAssessments.map((assessment) => {
                        const action = actionByAssessment.get(assessment.id);
                        const actionDraft = action ? actionDrafts[action.id] || {} : {};
                        const resolutions = allowedPrivacyResolutions(assessment.category);
                        return <li key={assessment.id}>
                          <div><strong>{PRIVACY_CATEGORY_LABELS[assessment.category] || assessment.category}</strong><span>{assessment.record_count} élément(s) · risque {assessment.risk_level}</span></div>
                          <div>
                            <p>{PRIVACY_ACTION_LABELS[assessment.proposed_action]}</p>
                            {assessment.external_check_required && <span className="privacy-external">Contrôle externe requis</span>}
                          </div>
                          {action && <form className="privacy-action-form" onSubmit={(event) => saveActionDecision(event, action.id)}>
                            <label>Décision pour cette catégorie
                              <select disabled={action.status === 'executed'} required value={actionDraft.resolution || ''} onChange={(event) => updateActionDraft(action.id, 'resolution', event.target.value)}>
                                <option value="">Choisir une décision</option>
                                {resolutions.map((resolution) => <option key={resolution} value={resolution}>{PRIVACY_RESOLUTION_LABELS[resolution]}</option>)}
                              </select>
                            </label>
                            <label>Justification
                              <textarea disabled={action.status === 'executed'} rows="2" minLength="10" maxLength="4000" required value={actionDraft.reason || ''} onChange={(event) => updateActionDraft(action.id, 'reason', event.target.value)} />
                            </label>
                            <span className="privacy-action-status">{PRIVACY_ACTION_STATUS_LABELS[action.status] || action.status}</span>
                            {action.status !== 'executed' && <button type="submit" disabled={submitting || !actionDraft.resolution}>Approuver cette décision</button>}
                            {request.status === 'external_action_required' && action.status === 'approved' && action.resolution === 'external_action' && !['profile', 'auth_identity'].includes(assessment.category) && <button type="button" disabled={submitting || (executionDraft.reason || '').trim().length < 10} onClick={(event) => confirmExternalAction(event, request, action)}>Confirmer l’action externe réalisée</button>}
                          </form>}
                        </li>;
                      })}</ul>
                    </div>}

                    <details className="privacy-review">
                      <summary>Revue humaine et décision</summary>
                      <form onSubmit={(event) => saveReview(event, request.id)}>
                        <label>Statut
                          <select value={draft.status} onChange={(event) => updateDraft(request.id, 'status', event.target.value)}>{Object.entries(PRIVACY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                        </label>
                        <label>Vérification d’identité
                          <select value={draft.identityStatus} onChange={(event) => updateDraft(request.id, 'identityStatus', event.target.value)}>{Object.entries(IDENTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                        </label>
                        <label>Décision administrative
                          <select value={draft.decision} onChange={(event) => updateDraft(request.id, 'decision', event.target.value)}>
                            <option value="">Aucune décision</option>{Object.entries(PRIVACY_CONCLUSION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </label>
                        <label>Motif de la décision
                          <textarea rows="3" minLength="5" maxLength="4000" required={Boolean(draft.decision)} value={draft.reason} onChange={(event) => updateDraft(request.id, 'reason', event.target.value)} />
                        </label>
                        <button type="submit" disabled={submitting}>Enregistrer la revue administrative</button>
                      </form>
                    </details>

                    {['ready_for_execution', 'external_action_required'].includes(request.status) && <details className="privacy-execution">
                      <summary>Exécution contrôlée</summary>
                      <form onSubmit={(event) => executeRequest(event, request)}>
                        <p><strong>Action sensible :</strong> les suppressions et anonymisations approuvées seront exécutées. Les achats, consentements, rétractations et preuves conservées ne seront pas supprimés.</p>
                        <label>Motif d’exécution
                          <textarea rows="3" minLength="10" maxLength="2000" required value={executionDraft.reason || ''} onChange={(event) => updateExecutionDraft(request.id, 'reason', event.target.value)} />
                        </label>
                        <label>Recopier exactement « {expectedConfirmation} »
                          <input autoComplete="off" required value={executionDraft.confirmation || ''} onChange={(event) => updateExecutionDraft(request.id, 'confirmation', event.target.value)} />
                        </label>
                        <button type="submit" disabled={submitting || executionDraft.confirmation !== expectedConfirmation || (executionDraft.reason || '').trim().length < 10}>Exécuter le plan approuvé</button>
                      </form>
                    </details>}

                    <details className="privacy-events"><summary>Journal de traitement ({requestEvents.length})</summary><ul>{requestEvents.map((entry) => <li key={entry.id}><strong>{EVENT_LABELS[entry.event_type] || entry.event_type}</strong><span>{formatDate(entry.created_at)}</span></li>)}</ul></details>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
