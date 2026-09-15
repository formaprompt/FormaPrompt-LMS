import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import {
  adminBookingResponsePath,
  adminCorrectionPath,
  groupProgressByCourse,
  LEARNER_RECORD_COURSE_LABELS,
  learnerDirectoryPath,
} from '../lib/adminLearnerRecord';
import { fetchAdminLearnerRecord } from '../lib/adminLearnerRecordApi';
import './AdminLearnerRecord.css';

const ACCESS_LABELS = { active: 'Actif', suspended: 'Suspendu', revoked: 'Révoqué', refunded: 'Remboursé', expired: 'Expiré' };
const ENROLLMENT_LABELS = { draft: 'Brouillon', pending: 'En attente', validated: 'Validé', in_progress: 'En cours', completed: 'Terminé', archived: 'Archivé', cancelled: 'Annulé', abandoned: 'Abandonné' };
const DOCUMENT_LABELS = { training_agreement: 'Convention ou contrat', convocation: 'Convocation', attendance_sheet: "Feuille d'émargement", completion_certificate: 'Attestation de fin de formation', satisfaction_questionnaire: 'Questionnaire de satisfaction' };
const REQUEST_STATUS_LABELS = { pending_distance: 'Distance à vérifier', awaiting_travel_payment: 'Paiement déplacement attendu', confirmed: 'Confirmée', rejected: 'Refusée', cancelled: 'Annulée', completed: 'Terminée', new: 'Nouvelle', processing: 'En traitement', awaiting_client: 'Réponse attendue', quote_sent: 'Devis envoyé', follow_up: 'À relancer', won: 'Gagnée', lost: 'Perdue' };
const DOCUMENT_STATUS_LABELS = { missing: 'Non disponible', ready: 'Disponible', completed: 'Terminé', archived: 'Archivé' };
const PURCHASE_STATUS_LABELS = { paid: 'Payé', pending: 'En attente', failed: 'Échoué', refunded: 'Remboursé', partially_refunded: 'Partiellement remboursé', disputed: 'Paiement contesté', chargeback: 'Rétrofacturation', granted_by_admin: 'Accès offert' };
const ACCOUNT_ROLE_LABELS = { user: 'Apprenant', admin: 'Administrateur', employee: 'Employé' };

function courseLabel(courseId, fallback) {
  return LEARNER_RECORD_COURSE_LABELS[courseId] || fallback || courseId || 'Formation non renseignée';
}

function formatDate(value, withTime = false) {
  if (!value) return 'Non renseigné';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Non renseigné';
  return new Intl.DateTimeFormat('fr-FR', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(parsed);
}

function formatMoney(cents, currency) {
  if (!Number.isInteger(cents) || !currency) return 'Non renseigné';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return 'Non renseigné';
  }
}

function EmptyState({ children = 'Non renseigné' }) {
  return <p className="learner-record__empty">{children}</p>;
}

function lessonCount(value, adjective = '') {
  return `${value} ${value === 1 ? 'leçon' : 'leçons'}${adjective ? ` ${adjective}${value === 1 ? '' : 's'}` : ''}`;
}

export function AdminLearnerRecordView({ record, returnSearch = '', returnPage = 0 }) {
  const progress = useMemo(() => groupProgressByCourse(record.progress), [record.progress]);
  const requests = [...(record.bookingRequests || []).map((item) => ({ ...item, kind: 'Réservation' })), ...(record.commercialRequests || []).map((item) => ({ ...item, kind: 'Demande commerciale' }))]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const printableDocumentTypes = new Set(['training_agreement', 'convocation', 'completion_certificate']);
  const documents = [...(record.documents || []).map((item) => ({ ...item, kind: DOCUMENT_LABELS[item.documentType] || item.documentType, href: item.status !== 'missing' && printableDocumentTypes.has(item.documentType) ? `/dossiers/${item.enrollmentId}/documents/${item.documentType}` : null })), ...(record.attestations || []).map((item) => ({ ...item, kind: item.documentType === 'competences' ? 'Attestation de compétences' : 'Attestation de réalisation', href: `/attestations/${item.id}`, generatedAt: item.issuedAt }))];
  const acquisitions = [
    ...(record.purchases || []).map((item) => ({ ...item, kind: 'purchase', occurredAt: item.purchasedAt })),
    ...(record.gifts || []).map((item) => ({ ...item, kind: 'gift', occurredAt: item.grantedAt })),
  ].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

  return (
    <main className="learner-record container section">
      <nav className="learner-record__back" aria-label="Retour"><Link to={learnerDirectoryPath(returnSearch, returnPage)}>← Retour aux apprenants{returnSearch ? ` : ${returnSearch}` : ''}</Link></nav>
      <header className="learner-record__hero">
        <div><p className="learner-record__eyebrow">Fiche apprenant</p><h1>{record.identity.fullName || 'Nom non renseigné'}</h1><p>{record.identity.email || 'Adresse e-mail non renseignée'}</p></div>
        <dl><div><dt>Rôle</dt><dd>{ACCOUNT_ROLE_LABELS[record.identity.role] || 'Non renseigné'}</dd></div><div><dt>Entreprise</dt><dd>{record.identity.organizationName || 'Non renseigné'}</dd></div><div><dt>Compte créé</dt><dd>{formatDate(record.identity.createdAt)}</dd></div></dl>
      </header>

      <section className="learner-record__section" aria-labelledby="formations-title"><h2 id="formations-title">Formations et droits</h2>
        {(record.enrollments?.length || record.rights?.length) ? <div className="learner-record__cards">
          {(record.enrollments || []).map((item) => <article key={`enrollment-${item.id}`}><span className="learner-record__type">Inscription</span><h3>{courseLabel(item.courseId)}</h3><p><strong>{ENROLLMENT_LABELS[item.status] || item.status}</strong></p><p>{formatDate(item.startsAt)} - {formatDate(item.endsAt)}</p></article>)}
          {(record.rights || []).map((item) => { const expired = item.status === 'active' && item.expiresAt && new Date(item.expiresAt) <= new Date(); return <article key={`right-${item.id}`}><span className="learner-record__type">Droit LMS</span><h3>{courseLabel(item.courseId)}</h3><p><strong>{expired ? 'Expiré' : (ACCESS_LABELS[item.status] || item.status)}</strong></p><p>Échéance : {item.expiresAt ? formatDate(item.expiresAt) : 'sans limitation de durée prédéfinie'}</p></article>; })}
        </div> : <EmptyState />}
      </section>

      <section className="learner-record__section" aria-labelledby="acquisitions-title"><h2 id="acquisitions-title">Achats et accès offerts</h2>
        {acquisitions.length ? <div className="learner-record__cards">{acquisitions.map((item) => item.kind === 'gift' ? (
          <article key={`gift-${item.id}`}><span className="learner-record__type">Accès offert</span><h3>{courseLabel(item.courseId)}</h3><p className="learner-record__metric learner-record__metric--money">Offert</p><p>{ACCESS_LABELS[item.status] || item.status}</p><small>Attribué le {formatDate(item.grantedAt)}</small></article>
        ) : (
          <article key={`purchase-${item.id}`}><span className="learner-record__type">Achat</span><h3>{courseLabel(item.courseId)}</h3><p className="learner-record__metric learner-record__metric--money">{formatMoney(item.amountPaid, item.currency)}</p><p><strong>{PURCHASE_STATUS_LABELS[item.paymentStatus] || 'Statut non renseigné'}</strong></p>{Number.isInteger(item.discountAmount) && item.discountAmount > 0 && <><p>Prix avant remise : {formatMoney(item.originalAmount, item.currency)}</p><p>Remise : {formatMoney(item.discountAmount, item.currency)}</p><p>Code promotionnel : {item.promotionCode || 'Non renseigné'}</p></>}{Number.isInteger(item.refundedAmount) && item.refundedAmount > 0 && <><p>Remboursé : {formatMoney(item.refundedAmount, item.currency)}</p><p>Net : {formatMoney(item.netAmount, item.currency)}</p></>}<small>Acheté le {formatDate(item.purchasedAt)}</small></article>
        ))}</div> : <EmptyState>Aucun achat ou accès offert enregistré</EmptyState>}
      </section>

      <section className="learner-record__section" aria-labelledby="progress-title"><h2 id="progress-title">Progression</h2>
        {progress.length ? <div className="learner-record__cards">{progress.map((item) => <article key={item.courseId}><h3>{courseLabel(item.courseId)}</h3><p className="learner-record__metric">{lessonCount(item.completed, 'terminée')}</p><p>{lessonCount(item.visited)} avec une activité enregistrée</p><small>Dernière activité : {formatDate(item.lastViewedAt, true)}</small></article>)}</div> : <EmptyState>Aucune progression enregistrée</EmptyState>}
        <h3 className="learner-record__subheading">Corrections à traiter</h3>
        {record.pendingCorrections?.length ? <ul className="learner-record__list">{record.pendingCorrections.map((item) => <li key={`${item.kind}-${item.submissionId}`}><div><strong>{item.kind === 'final_project' ? 'Projet final à évaluer' : 'Exercice à corriger'}</strong><span>{courseLabel(item.courseId)}{item.exerciseId ? ` - Exercice ${item.exerciseId}` : ''}</span><small>Remis le {formatDate(item.submittedAt, true)}</small></div><Link to={adminCorrectionPath(item)}>{item.kind === 'final_project' ? 'Évaluer' : 'Corriger'}</Link></li>)}</ul> : <EmptyState>Aucune correction en attente du formateur</EmptyState>}
      </section>

      <section className="learner-record__section" aria-labelledby="requests-title"><h2 id="requests-title">Demandes</h2>
        {requests.length ? <ul className="learner-record__list">{requests.map((item) => <li key={`${item.kind}-${item.id}`}><div><strong>{item.kind}</strong><span>{courseLabel(item.courseId)}{item.subject ? ` - ${item.subject}` : ''}</span></div><div><span className="learner-record__status">{REQUEST_STATUS_LABELS[item.status] || 'Statut non renseigné'}</span><small>{formatDate(item.createdAt, true)}</small>{item.kind === 'Réservation' && item.needsTrainerResponse && <Link to={adminBookingResponsePath(item.id)}>Voir et répondre</Link>}</div></li>)}</ul> : <EmptyState>Aucune demande reliée par identifiant apprenant</EmptyState>}
      </section>

      <section className="learner-record__section" aria-labelledby="reviews-title"><h2 id="reviews-title">Avis</h2>
        {record.reviews?.length ? <div className="learner-record__disclosures">{record.reviews.map((item) => <details key={item.id}><summary><span><strong>{courseLabel(item.courseId, item.courseName)}</strong> - {item.ratingOverall ?? 'Note non renseignée'}{item.ratingOverall != null ? '/5' : ''}</span><small>{formatDate(item.createdAt)}</small></summary><p>{item.isPublished ? 'Publié' : 'Non publié'} - consentement de publication : {item.consentMarketing ? 'oui' : 'non'}</p><p><strong>Témoignage :</strong> {item.publicTestimonial || 'Non renseigné'}</p><p><strong>Retour confidentiel :</strong> {item.privateFeedback || 'Non renseigné'}</p></details>)}</div> : <EmptyState>Aucun avis nominativement relié</EmptyState>}
      </section>

      <section className="learner-record__section" aria-labelledby="documents-title"><h2 id="documents-title">Documents</h2>
        {documents.length ? <ul className="learner-record__list">{documents.map((item) => <li key={`${item.kind}-${item.id}`}><div><strong>{item.kind}</strong><span>{courseLabel(item.courseId)}</span></div><div>{item.status && <span>{DOCUMENT_STATUS_LABELS[item.status] || 'Statut non renseigné'}</span>}<small>{formatDate(item.generatedAt)}</small>{item.href && <Link to={item.href}>Ouvrir</Link>}</div></li>)}</ul> : <EmptyState>Aucun document enregistré</EmptyState>}
      </section>

      <section className="learner-record__section" aria-labelledby="notes-title"><h2 id="notes-title">Notes internes existantes</h2>
        {record.notes?.length ? <div className="learner-record__disclosures">{record.notes.map((item) => <details key={item.enrollmentId}><summary><strong>{courseLabel(item.courseId)}</strong><small>Mise à jour : {formatDate(item.updatedAt, true)}</small></summary><p>{item.note}</p></details>)}</div> : <EmptyState>Aucune note interne enregistrée</EmptyState>}
      </section>
    </main>
  );
}

export default function AdminLearnerRecord() {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, role } = useAuth();
  const [state, setState] = useState({ userId: null, status: 'loading', record: null, message: '' });

  useEffect(() => {
    if (!user || role !== 'admin') return;
    let active = true;
    fetchAdminLearnerRecord(userId)
      .then((record) => active && setState({ userId, status: 'ready', record, message: '' }))
      .catch((error) => {
        console.error('Chargement de la fiche apprenant impossible :', error);
        if (active) setState({ userId, status: 'error', record: null, message: 'La fiche apprenant ne peut pas être chargée pour le moment.' });
      });
    return () => { active = false; };
  }, [role, user, userId]);

  if (!user) return null;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;
  if (state.userId !== userId || state.status === 'loading') return <main className="container section"><p role="status">Chargement de la fiche apprenant…</p></main>;
  if (state.status === 'error') return <main className="container section learner-record"><div className="learner-record__error" role="alert"><h1>Fiche indisponible</h1><p>{state.message}</p><button className="btn" type="button" onClick={() => window.location.reload()}>Réessayer</button> <Link to="/admin">Retour à l’administration</Link></div></main>;
  const requestedReturnPage = Number.parseInt(searchParams.get('retourPage') || '1', 10);
  const returnPage = Number.isInteger(requestedReturnPage) && requestedReturnPage > 0 ? requestedReturnPage - 1 : 0;
  return <AdminLearnerRecordView record={state.record} returnSearch={(searchParams.get('retourRecherche') || '').slice(0, 200)} returnPage={returnPage} />;
}
