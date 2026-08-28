import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import {
  accessAuditSentence,
  buildAdministrativeIdentityMap,
  createAccessActionTarget,
  filterAdministrativeAccesses,
  isAccessActionTargetConsistent,
} from '../lib/accessAdministration';
import {
  COURSE_ACCESS_STATUS_HELP,
  COURSE_ACCESS_STATUS_LABELS,
  isCourseAccessOpen,
} from '../lib/courseAccessLifecycle';
import './AdminAccessIncidents.css';

const COURSE_LABELS = {
  'formation-ia': 'Formation IA générative',
  'formation-ia-act': 'IA Act – acculturation et conformité',
  'formation-prompt-level-1': 'Prompt Engineering – Niveau 1',
};

const INCIDENT_STATUS_LABELS = {
  reported: 'Signalé',
  under_review: 'En cours d’instruction',
  conservatory_measure: 'Mesure conservatoire',
  hearing_pending: 'Entretien à organiser',
  decision_pending: 'Décision attendue',
  closed: 'Clôturé',
};

const OUTCOME_LABELS = {
  none: 'Aucune décision',
  no_action: 'Classement sans suite',
  warning: 'Avertissement',
  reprimand: 'Blâme',
  temporary_exclusion: 'Exclusion temporaire',
  permanent_exclusion: 'Exclusion définitive',
  other: 'Autre décision',
};

const SEVERITY_LABELS = {
  low: 'Faible',
  medium: 'Modérée',
  high: 'Élevée',
  critical: 'Critique',
};

const ACTION_LABELS = {
  suspend: 'Suspendre l’accès',
  reactivate: 'Réactiver l’accès',
  revoke: 'Révoquer l’accès',
  restore: 'Restaurer l’accès',
};

function localDateTime(value = new Date()) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value) {
  return value
    ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Non renseigné';
}

function createIncidentForm(access) {
  return {
    learnerUserId: access?.user_id || '',
    courseId: access?.course_id || 'formation-ia',
    occurredAt: localDateTime(),
    categoryId: '',
    factualDescription: '',
    severity: 'medium',
  };
}

function createHearingForm() {
  return {
    scheduledAt: localDateTime(Date.now() + 7 * 24 * 60 * 60 * 1000),
    convocationSentAt: '',
    meetingMode: 'remote',
    meetingProvider: 'google_meet',
    externalMeetingUrl: '',
    learnerObservations: '',
    assistanceDetails: '',
    meetingMinutes: '',
    reason: 'Traçabilité de l’entretien disciplinaire',
  };
}

export default function AdminAccessIncidents() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const firstDialogFieldRef = useRef(null);
  const [section, setSection] = useState('accesses');
  const [profiles, setProfiles] = useState([]);
  const [trainingIdentities, setTrainingIdentities] = useState([]);
  const [positioningIdentities, setPositioningIdentities] = useState([]);
  const [accesses, setAccesses] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [accessAction, setAccessAction] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [suspensionEndsAt, setSuspensionEndsAt] = useState('');
  const [linkedIncidentId, setLinkedIncidentId] = useState('');
  const [incidentForm, setIncidentForm] = useState(createIncidentForm());
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [incidentDrafts, setIncidentDrafts] = useState({});
  const [hearingIncident, setHearingIncident] = useState(null);
  const [hearingForm, setHearingForm] = useState(createHearingForm());
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user || role !== 'admin') return;
    setLoading(true);
    const [
      profilesResult,
      trainingIdentitiesResult,
      positioningIdentitiesResult,
      accessesResult,
      incidentsResult,
      categoriesResult,
      auditResult,
    ] = await Promise.all([
      supabase.from('profiles').select('id, email, role').order('email'),
      supabase
        .from('training_enrollments')
        .select('user_id, learner_first_name, learner_last_name, updated_at')
        .order('updated_at', { ascending: false }),
      supabase
        .from('course_positioning_assessments')
        .select('user_id, learner_name, submitted_at')
        .order('submitted_at', { ascending: false }),
      supabase
        .from('course_access')
        .select('id, user_id, course_id, status, access_source, granted_at, expires_at, status_changed_at, suspension_ends_at')
        .order('status_changed_at', { ascending: false }),
      supabase
        .from('disciplinary_incidents')
        .select('*, incident_categories(label), disciplinary_hearings(*)')
        .order('reported_at', { ascending: false }),
      supabase.from('incident_categories').select('id, label, is_active, display_order').eq('is_active', true).order('display_order'),
      supabase
        .from('audit_log')
        .select('id, actor_user_id, action_type, target_type, target_id, target_user_id, course_id, previous_state, new_state, reason, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(250),
    ]);

    const error = profilesResult.error || trainingIdentitiesResult.error
      || positioningIdentitiesResult.error || accessesResult.error || incidentsResult.error
      || categoriesResult.error || auditResult.error;
    if (error) {
      console.error('Chargement accès et incidents impossible :', error);
      setFeedback({ type: 'error', message: 'Les données administratives ne peuvent pas être chargées.' });
    } else {
      setProfiles(profilesResult.data || []);
      setTrainingIdentities(trainingIdentitiesResult.data || []);
      setPositioningIdentities(positioningIdentitiesResult.data || []);
      setAccesses(accessesResult.data || []);
      setIncidents(incidentsResult.data || []);
      setCategories(categoriesResult.data || []);
      setAuditEntries(auditResult.data || []);
      setIncidentDrafts(Object.fromEntries((incidentsResult.data || []).map((incident) => [incident.id, {
        incidentStatus: incident.incident_status,
        measuresTaken: incident.measures_taken || '',
        disciplinaryOutcome: incident.disciplinary_outcome,
        decisionSummary: incident.decision_summary || '',
        correctiveActionReference: incident.corrective_action_reference || '',
        reason: '',
      }])));
    }
    setLoading(false);
  }, [role, user]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    const loadTimer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadData, navigate, user]);

  useEffect(() => {
    if (accessAction || incidentDialogOpen || hearingIncident) firstDialogFieldRef.current?.focus();
  }, [accessAction, hearingIncident, incidentDialogOpen]);

  useEffect(() => {
    if (!accessAction && !incidentDialogOpen && !hearingIncident) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setAccessAction(null);
      setIncidentDialogOpen(false);
      setHearingIncident(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [accessAction, hearingIncident, incidentDialogOpen]);

  const identityByUserId = useMemo(
    () => buildAdministrativeIdentityMap(profiles, trainingIdentities, positioningIdentities),
    [positioningIdentities, profiles, trainingIdentities],
  );

  const learnerProfiles = useMemo(
    () => profiles.filter((profile) => profile.role === 'user'),
    [profiles],
  );

  const filteredAccesses = useMemo(
    () => filterAdministrativeAccesses(
      accesses,
      identityByUserId,
      search,
      COURSE_LABELS,
      COURSE_ACCESS_STATUS_LABELS,
    ),
    [accesses, identityByUserId, search],
  );

  const selectedAccess = accessAction
    ? accesses.find((access) => access.id === accessAction.accessId)
    : null;

  const selectedAccessIsConsistent = isAccessActionTargetConsistent(accessAction, selectedAccess);
  const selectedIdentity = selectedAccessIsConsistent
    ? identityByUserId.get(selectedAccess.user_id)
    : null;

  const matchingIncidents = selectedAccessIsConsistent
    ? incidents.filter((incident) => incident.learner_user_id === selectedAccess.user_id
      && incident.course_id === selectedAccess.course_id)
    : [];

  function openAccessAction(type, access) {
    setAccessAction(createAccessActionTarget(type, access));
    setActionReason('');
    setSuspensionEndsAt('');
    setLinkedIncidentId('');
    setFeedback(null);
  }

  function openIncidentDialog(access) {
    const nextForm = createIncidentForm(access);
    nextForm.categoryId = categories[0]?.id || '';
    setIncidentForm(nextForm);
    setIncidentDialogOpen(true);
    setFeedback(null);
  }

  async function submitAccessAction(event) {
    event.preventDefault();
    if (!accessAction || !selectedAccessIsConsistent) {
      setAccessAction(null);
      setFeedback({ type: 'error', message: 'La cible de cette action a changé. Rechargez les accès puis recommencez.' });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('admin_change_course_access', {
      p_access_id: selectedAccess.id,
      p_expected_user_id: selectedAccess.user_id,
      p_expected_course_id: selectedAccess.course_id,
      p_action: accessAction.type,
      p_reason: actionReason.trim(),
      p_suspension_ends_at: accessAction.type === 'suspend' && suspensionEndsAt
        ? new Date(suspensionEndsAt).toISOString()
        : null,
      p_incident_id: linkedIncidentId || null,
    });
    setSubmitting(false);
    if (error) {
      setFeedback({ type: 'error', message: error.message });
      return;
    }
    if (!data?.ok) {
      setAccessAction(null);
      setFeedback({ type: 'error', message: data?.message || 'La modification a été refusée car la cible est incohérente.' });
      await loadData();
      return;
    }
    setAccessAction(null);
    setFeedback({ type: 'success', message: `${ACTION_LABELS[accessAction.type]} : action enregistrée et journalisée.` });
    await loadData();
  }

  async function submitIncident(event) {
    event.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.rpc('admin_create_disciplinary_incident', {
      p_learner_user_id: incidentForm.learnerUserId,
      p_course_id: incidentForm.courseId,
      p_occurred_at: new Date(incidentForm.occurredAt).toISOString(),
      p_category_id: incidentForm.categoryId,
      p_factual_description: incidentForm.factualDescription.trim(),
      p_severity: incidentForm.severity,
      p_booking_request_id: null,
      p_responsible_admin_id: user.id,
    });
    setSubmitting(false);
    if (error) {
      setFeedback({ type: 'error', message: error.message });
      return;
    }
    setIncidentDialogOpen(false);
    setSection('incidents');
    setFeedback({ type: 'success', message: 'Incident créé et journalisé. Aucune sanction automatique n’a été appliquée.' });
    await loadData();
  }

  function updateIncidentDraft(incidentId, field, value) {
    setIncidentDrafts((current) => ({
      ...current,
      [incidentId]: { ...current[incidentId], [field]: value },
    }));
  }

  async function saveIncident(incident) {
    const draft = incidentDrafts[incident.id];
    setSubmitting(true);
    const { error } = await supabase.rpc('admin_update_disciplinary_incident', {
      p_incident_id: incident.id,
      p_reason: draft.reason.trim(),
      p_incident_status: draft.incidentStatus,
      p_measures_taken: draft.measuresTaken.trim() || null,
      p_disciplinary_outcome: draft.disciplinaryOutcome,
      p_decision_summary: draft.decisionSummary.trim() || null,
      p_corrective_action_reference: draft.correctiveActionReference.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setFeedback({ type: 'error', message: error.message });
      return;
    }
    setFeedback({ type: 'success', message: 'Dossier disciplinaire mis à jour et journalisé.' });
    await loadData();
  }

  async function saveHearing(event) {
    event.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.rpc('admin_save_disciplinary_hearing', {
      p_incident_id: hearingIncident.id,
      p_reason: hearingForm.reason.trim(),
      p_scheduled_at: new Date(hearingForm.scheduledAt).toISOString(),
      p_meeting_mode: hearingForm.meetingMode,
      p_convocation_sent_at: hearingForm.convocationSentAt ? new Date(hearingForm.convocationSentAt).toISOString() : null,
      p_meeting_provider: hearingForm.meetingMode === 'remote' ? hearingForm.meetingProvider : null,
      p_external_meeting_url: hearingForm.externalMeetingUrl.trim() || null,
      p_learner_observations: hearingForm.learnerObservations.trim() || null,
      p_assistance_details: hearingForm.assistanceDetails.trim() || null,
      p_meeting_minutes: hearingForm.meetingMinutes.trim() || null,
      p_hearing_id: null,
    });
    setSubmitting(false);
    if (error) {
      setFeedback({ type: 'error', message: error.message });
      return;
    }
    setHearingIncident(null);
    setFeedback({ type: 'success', message: 'Entretien disciplinaire enregistré et journalisé.' });
    await loadData();
  }

  if (!user) return null;
  if (role !== 'admin') {
    return (
      <main className="container access-admin-page">
        <div className="access-admin-alert" role="alert">
          Cette section est exclusivement réservée au rôle administrateur.
        </div>
        <Link to="/admin" className="btn">Retour à l’administration</Link>
      </main>
    );
  }

  return (
    <main className="container access-admin-page">
      <header className="access-admin-header">
        <div>
          <p className="access-admin-eyebrow">Administration sensible</p>
          <h1>Accès apprenants & incidents</h1>
          <p>Gérez les droits sans supprimer la progression, puis instruisez séparément les éventuels incidents.</p>
        </div>
        <Link to="/admin" className="btn access-admin-secondary">Retour à l’administration</Link>
      </header>

      {feedback && (
        <div className={`access-admin-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.message}
        </div>
      )}

      <nav className="access-admin-tabs" aria-label="Accès et discipline">
        <button type="button" className={section === 'accesses' ? 'is-active' : ''} onClick={() => setSection('accesses')}>
          Accès apprenants
        </button>
        <button type="button" className={section === 'incidents' ? 'is-active' : ''} onClick={() => setSection('incidents')}>
          Incidents & discipline ({incidents.length})
        </button>
      </nav>

      {loading ? <p>Chargement…</p> : section === 'accesses' ? (
        <section aria-labelledby="access-list-title">
          <div className="access-admin-toolbar">
            <div>
              <h2 id="access-list-title">Droits d’accès</h2>
              <p>Une échéance vide n’annule jamais le contrôle du statut.</p>
            </div>
            <label>
              Rechercher un apprenant ou une formation
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setAccessAction(null);
                }}
              />
            </label>
          </div>

          <details className="access-status-help">
            <summary>Signification du statut</summary>
            <dl>
              {Object.entries(COURSE_ACCESS_STATUS_LABELS).map(([status, label]) => (
                <div key={status}>
                  <dt>{label}</dt>
                  <dd>{COURSE_ACCESS_STATUS_HELP[status]}</dd>
                </div>
              ))}
            </dl>
          </details>

          <div className="access-card-list">
            {filteredAccesses.map((access) => {
              const learner = identityByUserId.get(access.user_id) || {
                fullName: 'Nom non renseigné',
                email: 'Adresse e-mail non renseignée',
              };
              const accessIsOpen = isCourseAccessOpen(access);
              const closedByExpiredDeadline = access.status === 'active' && !accessIsOpen;
              const history = auditEntries.filter((entry) => entry.target_type === 'course_access' && entry.target_id === access.id);
              const relatedIncidents = incidents.filter((incident) => incident.learner_user_id === access.user_id && incident.course_id === access.course_id);
              return (
                <article key={access.id} className="access-card">
                  <header>
                    <div>
                      <h3>{learner.fullName}</h3>
                      <p className="access-learner-email">{learner.email}</p>
                      <p>{COURSE_LABELS[access.course_id] || access.course_id}</p>
                    </div>
                    <span className={`access-status-badge is-${access.status}`}>
                      {COURSE_ACCESS_STATUS_LABELS[access.status] || access.status}
                    </span>
                  </header>
                  <dl>
                    <div><dt>Origine</dt><dd>{access.access_source}</dd></div>
                    <div>
                      <dt>Accès effectif</dt>
                      <dd className={`access-effective-status is-${accessIsOpen ? 'open' : 'closed'}`}>
                        {accessIsOpen ? 'Ouvert' : 'Fermé'}
                        {closedByExpiredDeadline && ' — échéance dépassée'}
                      </dd>
                    </div>
                    <div><dt>Échéance</dt><dd>{access.expires_at ? formatDate(access.expires_at) : 'Aucune échéance prédéfinie'}</dd></div>
                    {access.suspension_ends_at && (
                      <div className="access-suspension-end">
                        <dt>Fin indicative de suspension</dt>
                        <dd>{formatDate(access.suspension_ends_at)}<small>Ne réactive jamais automatiquement l’accès.</small></dd>
                      </div>
                    )}
                    <div><dt>Dernier changement</dt><dd>{formatDate(access.status_changed_at || access.granted_at)}</dd></div>
                    <div><dt>Incidents associés</dt><dd>{relatedIncidents.length}</dd></div>
                  </dl>
                  <div className="access-card-actions">
                    {access.status === 'active' && <button type="button" onClick={() => openAccessAction('suspend', access)}>Suspendre</button>}
                    {access.status === 'suspended' && <button type="button" onClick={() => openAccessAction('reactivate', access)}>Réactiver</button>}
                    {access.status === 'revoked' && <button type="button" onClick={() => openAccessAction('restore', access)}>Restaurer l’accès</button>}
                    {['active', 'suspended'].includes(access.status) && <button type="button" className="is-danger" onClick={() => openAccessAction('revoke', access)}>Révoquer</button>}
                    {['refunded', 'expired'].includes(access.status) && <p className="access-no-action">Aucune action disponible dans ce cockpit.</p>}
                    <button type="button" onClick={() => openIncidentDialog(access)}>Créer un incident</button>
                  </div>
                  <details className="access-history">
                    <summary>Historique sensible ({history.length})</summary>
                    {history.length === 0 ? <p>Aucun événement disponible.</p> : (
                      <ol>
                        {history.map((entry) => (
                          <li key={entry.id}>
                            <strong>{formatDate(entry.created_at)}</strong>
                            <span>{learner.fullName} — {learner.email}</span>
                            <p>{accessAuditSentence(entry.action_type, COURSE_LABELS[access.course_id] || access.course_id)}</p>
                            <p>
                              Par : {identityByUserId.get(entry.actor_user_id)?.fullName || 'Administrateur'}
                              {' — '}
                              {identityByUserId.get(entry.actor_user_id)?.email || 'Compte administrateur non disponible'}
                            </p>
                            {entry.reason && <p>Motif : {entry.reason}</p>}
                          </li>
                        ))}
                      </ol>
                    )}
                  </details>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section aria-labelledby="incident-list-title">
          <div className="access-admin-toolbar">
            <div>
              <h2 id="incident-list-title">Registre des incidents</h2>
              <p>La catégorie et la gravité n’entraînent jamais automatiquement une sanction.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => openIncidentDialog(null)}>Créer un incident</button>
          </div>

          <div className="incident-card-list">
            {incidents.length === 0 ? <p>Aucun incident enregistré.</p> : incidents.map((incident) => {
              const draft = incidentDrafts[incident.id] || {};
              const learner = identityByUserId.get(incident.learner_user_id);
              return (
                <article key={incident.id} className="incident-card">
                  <header>
                    <div>
                      <p className="incident-reference">Dossier {incident.id.slice(0, 8).toUpperCase()}</p>
                      <h3>{learner?.fullName || 'Nom non renseigné'}</h3>
                      <p>{learner?.email || 'Adresse e-mail non renseignée'}</p>
                      <p>{COURSE_LABELS[incident.course_id] || incident.course_id}</p>
                    </div>
                    <div className="incident-badges">
                      <span>{INCIDENT_STATUS_LABELS[incident.incident_status]}</span>
                      <span className={`is-${incident.severity}`}>{SEVERITY_LABELS[incident.severity]}</span>
                    </div>
                  </header>
                  <dl>
                    <div><dt>Catégorie</dt><dd>{incident.incident_categories?.label || incident.category_id}</dd></div>
                    <div><dt>Faits</dt><dd>{formatDate(incident.occurred_at)}</dd></div>
                    <div><dt>Signalement</dt><dd>{formatDate(incident.reported_at)}</dd></div>
                    <div><dt>Décision</dt><dd>{OUTCOME_LABELS[incident.disciplinary_outcome]}</dd></div>
                  </dl>
                  <section className="incident-facts" aria-label="Description factuelle">
                    <h4>Description factuelle</h4>
                    <p>{incident.factual_description}</p>
                  </section>

                  <div className="incident-workflow-grid">
                    <label>État du dossier
                      <select value={draft.incidentStatus || 'reported'} onChange={(event) => updateIncidentDraft(incident.id, 'incidentStatus', event.target.value)}>
                        {Object.entries(INCIDENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label>Décision humaine
                      <select value={draft.disciplinaryOutcome || 'none'} onChange={(event) => updateIncidentDraft(incident.id, 'disciplinaryOutcome', event.target.value)}>
                        {Object.entries(OUTCOME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label className="is-wide">Mesures prises
                      <textarea rows="3" maxLength="5000" value={draft.measuresTaken || ''} onChange={(event) => updateIncidentDraft(incident.id, 'measuresTaken', event.target.value)} />
                    </label>
                    <label className="is-wide">Décision motivée
                      <textarea rows="4" maxLength="10000" value={draft.decisionSummary || ''} onChange={(event) => updateIncidentDraft(incident.id, 'decisionSummary', event.target.value)} />
                    </label>
                    <label>Référence action corrective (Sprint 1.1)
                      <input maxLength="200" value={draft.correctiveActionReference || ''} onChange={(event) => updateIncidentDraft(incident.id, 'correctiveActionReference', event.target.value)} />
                    </label>
                    <label>Motif de cette modification
                      <input required minLength="5" maxLength="2000" value={draft.reason || ''} onChange={(event) => updateIncidentDraft(incident.id, 'reason', event.target.value)} />
                    </label>
                  </div>
                  <div className="incident-actions">
                    <button type="button" disabled={submitting || !draft.reason?.trim()} onClick={() => saveIncident(incident)}>Enregistrer le suivi</button>
                    <button type="button" onClick={() => { setHearingIncident(incident); setHearingForm(createHearingForm()); }}>Tracer un entretien</button>
                  </div>
                  {(incident.disciplinary_hearings || []).length > 0 && (
                    <details>
                      <summary>Entretiens enregistrés ({incident.disciplinary_hearings.length})</summary>
                      <ul>{incident.disciplinary_hearings.map((hearing) => <li key={hearing.id}>{formatDate(hearing.scheduled_at)} · {hearing.meeting_mode === 'remote' ? 'Distanciel' : 'Présentiel'}</li>)}</ul>
                    </details>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {accessAction && selectedAccessIsConsistent && (
        <div className="access-dialog-backdrop" role="presentation">
          <section className="access-dialog" role="dialog" aria-modal="true" aria-labelledby="access-action-title">
            <form onSubmit={submitAccessAction}>
              <h2 id="access-action-title">{ACTION_LABELS[accessAction.type]}</h2>
              <p>Vous êtes sur le point de <strong>{ACTION_LABELS[accessAction.type].toLowerCase()}</strong> pour :</p>
              <section className="access-dialog-target" aria-label="Accès concerné">
                <h3>{selectedIdentity?.fullName || 'Nom non renseigné'}</h3>
                <p>{selectedIdentity?.email || 'Adresse e-mail non renseignée'}</p>
                <dl>
                  <div><dt>Formation</dt><dd>{COURSE_LABELS[selectedAccess.course_id] || selectedAccess.course_id}</dd></div>
                  <div><dt>Statut actuel</dt><dd>{COURSE_ACCESS_STATUS_LABELS[selectedAccess.status] || selectedAccess.status}</dd></div>
                </dl>
              </section>
              {accessAction.type === 'revoke' && (
                <div className="access-dialog-warning">
                  Cette action retirera l’accès de l’apprenant à cette formation. Les données pédagogiques et l’historique seront conservés conformément aux règles applicables.
                </div>
              )}
              {accessAction.type === 'suspend' && (
                <div className="access-dialog-information">
                  La suspension est temporaire et réversible. Lorsqu’elle est liée à un incident, une mesure conservatoire n’est pas une sanction définitive.
                </div>
              )}
              {accessAction.type === 'restore' && (
                <div className="access-dialog-information">
                  Décision manuelle exceptionnelle et journalisée. Aucune réactivation automatique. La révocation restera visible dans l’historique.
                </div>
              )}
              <label>Motif obligatoire
                <textarea ref={firstDialogFieldRef} required minLength="5" maxLength="2000" rows="4" value={actionReason} onChange={(event) => setActionReason(event.target.value)} />
              </label>
              {accessAction.type === 'suspend' && (
                <label>Fin prévue facultative
                  <input type="datetime-local" value={suspensionEndsAt} onChange={(event) => setSuspensionEndsAt(event.target.value)} />
                </label>
              )}
              <label>Incident associé facultatif
                <select value={linkedIncidentId} onChange={(event) => setLinkedIncidentId(event.target.value)}>
                  <option value="">Aucun incident associé</option>
                  {matchingIncidents.map((incident) => <option key={incident.id} value={incident.id}>{incident.id.slice(0, 8)} · {INCIDENT_STATUS_LABELS[incident.incident_status]}</option>)}
                </select>
              </label>
              <div className="access-dialog-actions">
                <button type="button" onClick={() => setAccessAction(null)}>Annuler</button>
                <button type="submit" className={accessAction.type === 'revoke' ? 'is-danger' : ''} disabled={submitting || actionReason.trim().length < 5}>
                  {submitting
                    ? 'Enregistrement…'
                    : `${ACTION_LABELS[accessAction.type]} de ${selectedIdentity?.email || 'l’apprenant identifié ci-dessus'}`}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {incidentDialogOpen && (
        <div className="access-dialog-backdrop" role="presentation">
          <section className="access-dialog" role="dialog" aria-modal="true" aria-labelledby="incident-create-title">
            <form onSubmit={submitIncident}>
              <h2 id="incident-create-title">Créer un incident</h2>
              <p className="access-dialog-information">Décrivez uniquement les faits nécessaires. Aucune sanction ne sera créée automatiquement.</p>
              <label>Apprenant
                <select ref={firstDialogFieldRef} required value={incidentForm.learnerUserId} onChange={(event) => setIncidentForm({ ...incidentForm, learnerUserId: event.target.value })}>
                  <option value="">Sélectionner</option>
                  {learnerProfiles.map((profile) => {
                    const identity = identityByUserId.get(profile.id);
                    return (
                      <option key={profile.id} value={profile.id}>
                        {identity?.fullName || 'Nom non renseigné'} — {identity?.email || profile.email}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>Formation
                <select value={incidentForm.courseId} onChange={(event) => setIncidentForm({ ...incidentForm, courseId: event.target.value })}>
                  {Object.entries(COURSE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>Date et heure des faits
                <input type="datetime-local" required value={incidentForm.occurredAt} onChange={(event) => setIncidentForm({ ...incidentForm, occurredAt: event.target.value })} />
              </label>
              <label>Catégorie
                <select required value={incidentForm.categoryId} onChange={(event) => setIncidentForm({ ...incidentForm, categoryId: event.target.value })}>
                  <option value="">Sélectionner</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                </select>
              </label>
              <label>Gravité appréciée
                <select value={incidentForm.severity} onChange={(event) => setIncidentForm({ ...incidentForm, severity: event.target.value })}>
                  {Object.entries(SEVERITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>Description factuelle
                <textarea required minLength="10" maxLength="10000" rows="6" value={incidentForm.factualDescription} onChange={(event) => setIncidentForm({ ...incidentForm, factualDescription: event.target.value })} />
              </label>
              <div className="access-dialog-actions">
                <button type="button" onClick={() => setIncidentDialogOpen(false)}>Annuler</button>
                <button type="submit" disabled={submitting}>Créer et journaliser</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {hearingIncident && (
        <div className="access-dialog-backdrop" role="presentation">
          <section className="access-dialog" role="dialog" aria-modal="true" aria-labelledby="hearing-title">
            <form onSubmit={saveHearing}>
              <h2 id="hearing-title">Tracer l’entretien disciplinaire</h2>
              <label>Date de l’entretien
                <input ref={firstDialogFieldRef} type="datetime-local" required value={hearingForm.scheduledAt} onChange={(event) => setHearingForm({ ...hearingForm, scheduledAt: event.target.value })} />
              </label>
              <label>Convocation envoyée le
                <input type="datetime-local" value={hearingForm.convocationSentAt} onChange={(event) => setHearingForm({ ...hearingForm, convocationSentAt: event.target.value })} />
              </label>
              <label>Modalité
                <select value={hearingForm.meetingMode} onChange={(event) => setHearingForm({ ...hearingForm, meetingMode: event.target.value })}>
                  <option value="remote">Distanciel</option><option value="in_person">Présentiel</option>
                </select>
              </label>
              {hearingForm.meetingMode === 'remote' && <>
                <label>Outil externe
                  <select value={hearingForm.meetingProvider} onChange={(event) => setHearingForm({ ...hearingForm, meetingProvider: event.target.value })}>
                    <option value="google_meet">Google Meet</option><option value="microsoft_teams">Microsoft Teams</option><option value="other">Autre</option>
                  </select>
                </label>
                <label>Lien externe facultatif
                  <input type="url" maxLength="2000" value={hearingForm.externalMeetingUrl} onChange={(event) => setHearingForm({ ...hearingForm, externalMeetingUrl: event.target.value })} />
                </label>
              </>}
              <label>Observations de l’apprenant
                <textarea rows="4" maxLength="10000" value={hearingForm.learnerObservations} onChange={(event) => setHearingForm({ ...hearingForm, learnerObservations: event.target.value })} />
              </label>
              <label>Assistance éventuelle
                <textarea rows="2" maxLength="3000" value={hearingForm.assistanceDetails} onChange={(event) => setHearingForm({ ...hearingForm, assistanceDetails: event.target.value })} />
              </label>
              <label>Compte rendu
                <textarea rows="5" maxLength="15000" value={hearingForm.meetingMinutes} onChange={(event) => setHearingForm({ ...hearingForm, meetingMinutes: event.target.value })} />
              </label>
              <label>Motif de l’enregistrement
                <input required minLength="5" maxLength="2000" value={hearingForm.reason} onChange={(event) => setHearingForm({ ...hearingForm, reason: event.target.value })} />
              </label>
              <div className="access-dialog-actions">
                <button type="button" onClick={() => setHearingIncident(null)}>Annuler</button>
                <button type="submit" disabled={submitting}>Enregistrer l’entretien</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
