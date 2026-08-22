import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import EnrollmentLifecyclePanel from '../components/EnrollmentLifecyclePanel';
import { filterAdministrativeEnrollments } from '../lib/enrollmentLifecycle';
import './AdminEnrollments.css';

const COURSE_OPTIONS = {
  'formation-ia': { title: 'IA générative', durationMinutes: 600, priceAmountCents: 49700 },
  'formation-ia-act': { title: 'IA Act', durationMinutes: 240, priceAmountCents: 18700 },
  'formation-prompt-level-1': { title: 'Prompt Engineering – Niveau 1', durationMinutes: 420, priceAmountCents: 34300 },
};

const DOCUMENT_LABELS = {
  training_agreement: 'Convention ou contrat',
  convocation: 'Convocation',
  attendance_sheet: "Feuille d'émargement",
  completion_certificate: 'Attestation de fin de formation',
  satisfaction_questionnaire: 'Questionnaire de satisfaction',
};

const SOURCE_LABELS = {
  manual: 'Inscription manuelle',
  company: 'Entreprise',
  opco: 'OPCO',
  free: 'Gratuit',
};

function defaultDateTime(hoursFromNow) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function createInitialForm() {
  return {
    targetUserId: '',
    learnerEmail: '',
    learnerFirstName: '',
    learnerLastName: '',
    learnerJobTitle: '',
    learnerPhone: '',
    learnerAddressLine1: '',
    learnerPostalCode: '',
    learnerCity: '',
    organizationName: '',
    courseId: 'formation-ia',
    enrollmentSource: 'opco',
    fundingMode: 'opco',
    funderName: '',
    fundingReference: '',
    payerName: '',
    payerEmail: '',
    clientName: '',
    clientEmail: '',
    deliveryMode: 'remote',
    trainingLocation: '',
    remoteAccessDetails: '',
    startsAt: defaultDateTime(24 * 7),
    endsAt: defaultDateTime(24 * 7 + 10),
    durationMinutes: 600,
    priceAmountCents: 49700,
    administrativeNotes: '',
    updateReason: '',
  };
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Non renseigné';
}

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function AdminEnrollments() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [form, setForm] = useState(createInitialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionRunning, setActionRunning] = useState('');
  const [editingEnrollmentId, setEditingEnrollmentId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fundingFilter, setFundingFilter] = useState('');

  const canCreateLearner = role === 'admin';

  const loadData = useCallback(async () => {
    setLoading(true);
    const [profilesResult, enrollmentsResult] = await Promise.all([
      supabase.from('profiles').select('id, email, role').eq('role', 'user').order('email'),
      supabase
        .from('training_enrollments')
        .select(`
          *,
          profiles!training_enrollments_user_id_fkey(email),
          training_documents(id, document_type, status, visible_to_learner, generated_at),
          training_enrollment_events(id, event_type, reason, previous_state, new_state, rights_impact, created_at),
          training_amendments(id, amendment_number, effective_date, reason, change_summary, frozen_snapshot, created_at)
        `)
        .order('created_at', { ascending: false }),
    ]);

    if (profilesResult.error) setFeedback({ type: 'error', message: 'Chargement des apprenants impossible.' });
    if (enrollmentsResult.error) {
      setFeedback({ type: 'error', message: "Le module OF/OPCO n'est pas encore disponible dans Supabase." });
    }
    setProfiles(profilesResult.data || []);
    setEnrollments(enrollmentsResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user || !['admin', 'employee'].includes(role)) {
      navigate('/dashboard');
      return;
    }
    const loadTask = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(loadTask);
  }, [user, role, navigate, loadData]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === form.targetUserId),
    [profiles, form.targetUserId],
  );

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function selectLearner(userId) {
    const selected = profiles.find((profile) => profile.id === userId);
    setForm((current) => ({
      ...current,
      targetUserId: userId,
      learnerEmail: selected?.email || '',
    }));
  }

  function selectCourse(courseId) {
    const course = COURSE_OPTIONS[courseId];
    setForm((current) => ({
      ...current,
      courseId,
      durationMinutes: course.durationMinutes,
      priceAmountCents: course.priceAmountCents,
    }));
  }

  function startEditing(enrollment) {
    setEditingEnrollmentId(enrollment.id);
    setForm({
      targetUserId: enrollment.user_id,
      learnerEmail: enrollment.profiles?.email || '',
      learnerFirstName: enrollment.learner_first_name || '',
      learnerLastName: enrollment.learner_last_name || '',
      learnerJobTitle: enrollment.learner_job_title || '',
      learnerPhone: enrollment.learner_phone || '',
      learnerAddressLine1: enrollment.learner_address_line1 || '',
      learnerPostalCode: enrollment.learner_postal_code || '',
      learnerCity: enrollment.learner_city || '',
      organizationName: enrollment.organization_name || '',
      courseId: enrollment.course_id,
      enrollmentSource: enrollment.enrollment_source,
      fundingMode: enrollment.funding_mode,
      funderName: enrollment.funder_name || '',
      fundingReference: enrollment.funding_reference || '',
      payerName: enrollment.payer_name || '',
      payerEmail: enrollment.payer_email || '',
      clientName: enrollment.client_name || '',
      clientEmail: enrollment.client_email || '',
      deliveryMode: enrollment.delivery_mode,
      trainingLocation: enrollment.training_location || '',
      remoteAccessDetails: enrollment.remote_access_details || '',
      startsAt: toLocalDateTime(enrollment.starts_at),
      endsAt: toLocalDateTime(enrollment.ends_at),
      durationMinutes: enrollment.duration_minutes,
      priceAmountCents: enrollment.price_amount_cents ?? 0,
      administrativeNotes: enrollment.administrative_notes || '',
      updateReason: '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditing() {
    setEditingEnrollmentId('');
    setForm(createInitialForm());
  }

  async function submitEnrollment(event) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    const { data, error } = await supabase.functions.invoke('admin-manage-enrollment', {
      body: {
        action: editingEnrollmentId ? 'update_enrollment' : 'create_enrollment',
        enrollmentId: editingEnrollmentId || undefined,
        enrollment: {
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          durationMinutes: Number(form.durationMinutes),
          priceAmountCents: Number(form.priceAmountCents),
        },
      },
    });

    if (error || data?.error) {
      setFeedback({ type: 'error', message: data?.error || "L'inscription n'a pas pu être créée." });
      setSubmitting(false);
      return;
    }

    setFeedback({
      type: 'success',
      message: editingEnrollmentId
        ? 'Dossier actualisé ; les documents disponibles ont été régénérés.'
        : data.invited
        ? "Dossier créé, accès attribué et invitation envoyée à l'apprenant."
        : 'Dossier créé, accès attribué et documents essentiels préremplis.',
    });
    setEditingEnrollmentId('');
    setForm(createInitialForm());
    setSubmitting(false);
    await loadData();
  }

  async function runEnrollmentAction(enrollmentId, action, documentType) {
    const actionKey = `${action}:${enrollmentId}:${documentType || ''}`;
    setActionRunning(actionKey);
    setFeedback(null);
    const { data, error } = await supabase.functions.invoke('admin-manage-enrollment', {
      body: { action, enrollmentId, documentType },
    });
    if (error || data?.error) {
      setFeedback({ type: 'error', message: data?.error || "L'action n'a pas pu être réalisée." });
    } else {
      setFeedback({
        type: 'success',
        message: action === 'complete_enrollment'
          ? "Formation terminée et attestation générée."
          : 'Document actualisé avec les données du dossier.',
      });
      await loadData();
    }
    setActionRunning('');
  }

  async function runLifecycleAction(enrollmentId, action, payload) {
    const actionKey = `${action}:${enrollmentId}`;
    setActionRunning(actionKey);
    setFeedback(null);
    const { data, error } = await supabase.functions.invoke('admin-manage-enrollment', {
      body: { action, enrollmentId, ...payload },
    });
    if (error || data?.error) {
      setFeedback({ type: 'error', message: data?.error || "L'action administrative a échoué." });
    } else {
      setFeedback({
        type: 'success',
        message: data?.rightsReviewRequired
          ? 'Action enregistrée. Les droits pédagogiques sont inchangés et doivent être examinés séparément.'
          : 'Action enregistrée dans l’historique du dossier. Les droits pédagogiques sont inchangés.',
      });
      await loadData();
    }
    setActionRunning('');
    return !(error || data?.error);
  }

  const filteredEnrollments = useMemo(
    () => filterAdministrativeEnrollments(enrollments, { search, status: statusFilter, fundingStatus: fundingFilter }),
    [enrollments, search, statusFilter, fundingFilter],
  );

  if (!user || !['admin', 'employee'].includes(role)) return null;

  return (
    <main className="admin-enrollments container section">
      <header className="admin-enrollments__header">
        <div>
          <p className="admin-enrollments__eyebrow">Administration FormaPrompt</p>
          <h1>Dossiers OF, entreprise et OPCO</h1>
          <p>Une inscription validée attribue le droit LMS existant puis prépare les documents essentiels.</p>
        </div>
        <Link className="btn admin-enrollments__secondary" to="/admin">Retour à l’administration</Link>
      </header>

      {feedback && (
        <div className={`admin-enrollments__feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.message}
        </div>
      )}

      <section className="admin-enrollments__panel" aria-labelledby="new-enrollment-title">
        <h2 id="new-enrollment-title">{editingEnrollmentId ? 'Modifier le dossier' : 'Créer et valider une inscription'}</h2>
        <p className="admin-enrollments__notice">
          Renseignez uniquement les données nécessaires à l’accès, au financement et aux documents de formation.
        </p>
        <form className="admin-enrollments__form" onSubmit={submitEnrollment}>
          <fieldset>
            <legend>Apprenant</legend>
            <label>
              Compte existant
              <select value={form.targetUserId} disabled={Boolean(editingEnrollmentId)} onChange={(event) => selectLearner(event.target.value)}>
                <option value="">Nouvel apprenant à inviter</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.email}</option>)}
              </select>
            </label>
            {!form.targetUserId && !canCreateLearner && (
              <p className="admin-enrollments__field-note">Un employé doit sélectionner un compte existant. Seul l’administrateur peut envoyer une invitation.</p>
            )}
            <label>
              Adresse e-mail
              <input type="email" required maxLength="320" value={form.learnerEmail} readOnly={Boolean(selectedProfile)} onChange={(event) => updateField('learnerEmail', event.target.value)} />
            </label>
            <label>
              Prénom
              <input required maxLength="100" value={form.learnerFirstName} onChange={(event) => updateField('learnerFirstName', event.target.value)} />
            </label>
            <label>
              Nom
              <input required maxLength="120" value={form.learnerLastName} onChange={(event) => updateField('learnerLastName', event.target.value)} />
            </label>
            <label>
              Fonction <span>(facultatif)</span>
              <input maxLength="150" value={form.learnerJobTitle} onChange={(event) => updateField('learnerJobTitle', event.target.value)} />
            </label>
            <label>
              Téléphone <span>(uniquement si nécessaire)</span>
              <input type="tel" maxLength="30" value={form.learnerPhone} onChange={(event) => updateField('learnerPhone', event.target.value)} />
            </label>
          </fieldset>

          <fieldset>
            <legend>Formation et financement</legend>
            <label>
              Formation
              <select value={form.courseId} disabled={Boolean(editingEnrollmentId)} onChange={(event) => selectCourse(event.target.value)}>
                {Object.entries(COURSE_OPTIONS).map(([id, course]) => <option key={id} value={id}>{course.title}</option>)}
              </select>
            </label>
            <label>
              Origine de l’inscription
              <select value={form.enrollmentSource} onChange={(event) => updateField('enrollmentSource', event.target.value)}>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Mode de financement
              <select value={form.fundingMode} onChange={(event) => updateField('fundingMode', event.target.value)}>
                <option value="opco">OPCO</option>
                <option value="company">Entreprise</option>
                <option value="self_funded">Financement individuel</option>
                <option value="free">Gratuit</option>
                <option value="other">Autre</option>
              </select>
            </label>
            <label>
              Entreprise ou organisme <span>(facultatif)</span>
              <input maxLength="200" value={form.organizationName} onChange={(event) => updateField('organizationName', event.target.value)} />
            </label>
            <label>
              Organisme financeur <span>(facultatif)</span>
              <input maxLength="200" value={form.funderName} onChange={(event) => updateField('funderName', event.target.value)} />
            </label>
            <label>
              Numéro de dossier <span>(facultatif)</span>
              <input maxLength="120" value={form.fundingReference} onChange={(event) => updateField('fundingReference', event.target.value)} />
            </label>
            <label>Client contractuel <span>(facultatif)</span><input maxLength="200" value={form.clientName} onChange={(event) => updateField('clientName', event.target.value)} /></label>
            <label>E-mail client <span>(facultatif)</span><input type="email" maxLength="320" value={form.clientEmail} onChange={(event) => updateField('clientEmail', event.target.value)} /></label>
            <label>Payeur <span>(facultatif)</span><input maxLength="200" value={form.payerName} onChange={(event) => updateField('payerName', event.target.value)} /></label>
            <label>E-mail payeur <span>(facultatif)</span><input type="email" maxLength="320" value={form.payerEmail} onChange={(event) => updateField('payerEmail', event.target.value)} /></label>
            <label>
              Tarif en euros
              <input type="number" min="0" step="1" value={form.priceAmountCents / 100} onChange={(event) => updateField('priceAmountCents', Math.round(Number(event.target.value) * 100))} />
            </label>
          </fieldset>

          <fieldset>
            <legend>Dates et modalités</legend>
            <label>
              Début
              <input type="datetime-local" required value={form.startsAt} onChange={(event) => updateField('startsAt', event.target.value)} />
            </label>
            <label>
              Fin
              <input type="datetime-local" required value={form.endsAt} onChange={(event) => updateField('endsAt', event.target.value)} />
            </label>
            <label>
              Durée en minutes
              <input type="number" min="30" max="60000" required value={form.durationMinutes} onChange={(event) => updateField('durationMinutes', event.target.value)} />
            </label>
            <label>
              Modalité
              <select value={form.deliveryMode} onChange={(event) => updateField('deliveryMode', event.target.value)}>
                <option value="remote">Classe virtuelle</option>
                <option value="in_person">Présentiel</option>
                <option value="hybrid">Hybride</option>
              </select>
            </label>
            <label className="admin-enrollments__wide">
              Lieu <span>(si présentiel ou hybride)</span>
              <input maxLength="500" value={form.trainingLocation} onChange={(event) => updateField('trainingLocation', event.target.value)} />
            </label>
            <label className="admin-enrollments__wide">
              Consignes d’accès à distance <span>(facultatif)</span>
              <textarea rows="3" maxLength="1000" value={form.remoteAccessDetails} onChange={(event) => updateField('remoteAccessDetails', event.target.value)} />
            </label>
          </fieldset>

          <details className="admin-enrollments__optional">
            <summary>Adresse et notes administratives facultatives</summary>
            <div className="admin-enrollments__optional-grid">
              <label>Adresse<input maxLength="250" value={form.learnerAddressLine1} onChange={(event) => updateField('learnerAddressLine1', event.target.value)} /></label>
              <label>Code postal<input maxLength="20" value={form.learnerPostalCode} onChange={(event) => updateField('learnerPostalCode', event.target.value)} /></label>
              <label>Ville<input maxLength="120" value={form.learnerCity} onChange={(event) => updateField('learnerCity', event.target.value)} /></label>
              <label className="admin-enrollments__wide">Notes<textarea rows="3" maxLength="4000" value={form.administrativeNotes} onChange={(event) => updateField('administrativeNotes', event.target.value)} /></label>
              {editingEnrollmentId && <label className="admin-enrollments__wide">Motif de la modification<input required minLength="5" maxLength="2000" value={form.updateReason} onChange={(event) => updateField('updateReason', event.target.value)} /></label>}
            </div>
          </details>

          <div className="admin-enrollments__form-actions">
            <button className="btn btn-primary" type="submit" disabled={submitting || (!form.targetUserId && !canCreateLearner)}>
              {submitting
                ? (editingEnrollmentId ? 'Mise à jour du dossier…' : 'Création du dossier…')
                : (editingEnrollmentId ? 'Enregistrer et régénérer les documents' : 'Valider l’inscription et attribuer l’accès')}
            </button>
            {editingEnrollmentId && (
              <button className="btn admin-enrollments__secondary" type="button" disabled={submitting} onClick={cancelEditing}>
                Annuler la modification
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="admin-enrollments__panel" aria-labelledby="files-title">
        <h2 id="files-title">Dossiers de formation</h2>
        <div className="admin-enrollments__filters">
          <label>Rechercher<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, e-mail, organisme, référence…" /></label>
          <label>Statut<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tous</option><option value="validated">Validé</option><option value="in_progress">En cours</option><option value="completed">Terminé</option><option value="cancelled">Annulé</option><option value="abandoned">Abandonné</option></select></label>
          <label>Financement<select value={fundingFilter} onChange={(event) => setFundingFilter(event.target.value)}><option value="">Tous</option><option value="not_requested">Non demandé</option><option value="requested">Demandé</option><option value="under_review">En instruction</option><option value="partially_granted">Partiel</option><option value="granted">Accordé</option><option value="refused">Refusé</option></select></label>
        </div>
        {loading ? <p role="status">Chargement des dossiers…</p> : filteredEnrollments.length === 0 ? (
          <p>Aucun dossier administratif enregistré.</p>
        ) : (
          <div className="admin-enrollments__files">
            {filteredEnrollments.map((enrollment) => (
              <article key={enrollment.id} className="admin-enrollments__file">
                <header>
                  <div>
                    <h3>{enrollment.learner_first_name} {enrollment.learner_last_name}</h3>
                    <p>{enrollment.profiles?.email} · {COURSE_OPTIONS[enrollment.course_id]?.title || enrollment.course_id}</p>
                  </div>
                  <span className={`admin-enrollments__status is-${enrollment.status}`}>{enrollment.status}</span>
                </header>
                <dl>
                  <div><dt>Origine</dt><dd>{SOURCE_LABELS[enrollment.enrollment_source] || enrollment.enrollment_source}</dd></div>
                  <div><dt>Financement</dt><dd>{enrollment.funder_name || enrollment.funding_mode}</dd></div>
                  <div><dt>Dates</dt><dd>{formatDate(enrollment.starts_at)} → {formatDate(enrollment.ends_at)}</dd></div>
                  <div><dt>Accès LMS</dt><dd>{enrollment.course_access_id ? 'Attribué' : 'À vérifier'}</dd></div>
                </dl>
                {!['archived', 'cancelled', 'abandoned'].includes(enrollment.status) && (
                  <button
                    type="button"
                    className="btn admin-enrollments__secondary admin-enrollments__edit"
                    disabled={Boolean(actionRunning) || submitting}
                    onClick={() => startEditing(enrollment)}
                  >
                    Modifier les informations
                  </button>
                )}
                <div className="admin-enrollments__documents">
                  {(enrollment.training_documents || []).map((document) => (
                    <div key={document.id} className={`admin-enrollments__document is-${document.status}`}>
                      <div>
                        <strong>{DOCUMENT_LABELS[document.document_type]}</strong>
                        <span>{document.status === 'missing' ? 'Manquant ou non ouvert' : 'Disponible'}</span>
                      </div>
                      {document.status !== 'missing' && ['training_agreement', 'convocation', 'completion_certificate'].includes(document.document_type) && (
                        <Link to={`/dossiers/${enrollment.id}/documents/${document.document_type}`}>Ouvrir</Link>
                      )}
                      {document.status !== 'missing' && document.document_type === 'attendance_sheet' && (
                        <Link to="/admin/emargements">Ouvrir le suivi</Link>
                      )}
                      {document.status !== 'missing' && document.document_type === 'satisfaction_questionnaire' && (
                        <span>Suivi depuis l’espace apprenant</span>
                      )}
                      {['training_agreement', 'convocation', 'completion_certificate'].includes(document.document_type)
                        && document.status !== 'missing' && (
                        <button
                          type="button"
                          disabled={Boolean(actionRunning)}
                          onClick={() => runEnrollmentAction(enrollment.id, 'regenerate_document', document.document_type)}
                        >
                          {actionRunning === `regenerate_document:${enrollment.id}:${document.document_type}` ? 'Actualisation…' : 'Actualiser'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <EnrollmentLifecyclePanel
                  enrollment={enrollment}
                  profiles={profiles}
                  running={actionRunning}
                  onAction={runLifecycleAction}
                />
                {!['completed', 'archived', 'cancelled', 'abandoned'].includes(enrollment.status) && (
                  <button
                    type="button"
                    className="btn admin-enrollments__complete"
                    disabled={Boolean(actionRunning)}
                    onClick={() => runEnrollmentAction(enrollment.id, 'complete_enrollment')}
                  >
                    {actionRunning === `complete_enrollment:${enrollment.id}:` ? 'Finalisation…' : 'Marquer terminée et générer l’attestation'}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
