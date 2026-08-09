import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import './TrainingDocument.css';

const TYPE_LABELS = {
  training_agreement: 'Convention ou contrat de formation',
  convocation: 'Convocation',
  completion_certificate: 'Attestation de fin de formation',
};

const FUNDING_LABELS = {
  self_funded: 'Financement individuel',
  company: 'Financement entreprise',
  opco: 'Financement OPCO',
  free: 'Gratuit',
  other: 'Autre financement',
};

const DELIVERY_LABELS = {
  remote: 'Classe virtuelle',
  in_person: 'Présentiel',
  hybrid: 'Hybride',
};

function formatDate(value, includeTime = false) {
  if (!value) return 'Non renseigné';
  return new Date(value).toLocaleString('fr-FR', includeTime
    ? { dateStyle: 'long', timeStyle: 'short' }
    : { dateStyle: 'long' });
}

function formatDuration(minutes) {
  const hours = Math.floor(Number(minutes || 0) / 60);
  const remaining = Number(minutes || 0) % 60;
  return `${hours} h${remaining ? ` ${remaining} min` : ''}`;
}

function formatPrice(cents) {
  if (cents == null) return 'Sur devis';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export default function TrainingDocument() {
  const { enrollmentId, documentType } = useParams();
  const { user, role } = useAuth();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadDocument() {
      const { data, error: loadError } = await supabase
        .from('training_documents')
        .select('id, enrollment_id, document_type, status, content_snapshot, generated_at')
        .eq('enrollment_id', enrollmentId)
        .eq('document_type', documentType)
        .maybeSingle();
      if (!active) return;
      if (loadError || !data || data.status === 'missing') {
        setError("Ce document est introuvable, n'est pas encore disponible ou ne vous est pas destiné.");
      } else {
        setDocument(data);
      }
      setLoading(false);
    }
    if (user) loadDocument();
    return () => { active = false; };
  }, [user, enrollmentId, documentType]);

  if (!user) return null;
  const backPath = ['admin', 'employee'].includes(role) ? '/admin/dossiers' : '/dashboard';
  const snapshot = document?.content_snapshot;

  return (
    <main className="training-document-page">
      <div className="training-document-actions">
        <Link className="btn training-document-back" to={backPath}>Retour</Link>
        {document && <button className="btn btn-primary" type="button" onClick={() => window.print()}>Imprimer ou enregistrer en PDF</button>}
      </div>

      {loading ? <p role="status">Chargement du document…</p> : error ? <p className="training-document-error" role="alert">{error}</p> : (
        <article className="training-document-paper">
          <header>
            <div>
              <p className="training-document-brand">FormaPrompt</p>
              <h1>{snapshot.title || TYPE_LABELS[document.document_type]}</h1>
            </div>
            <dl className="training-document-reference">
              <div><dt>Dossier</dt><dd>{snapshot.enrollment.id.slice(0, 8).toUpperCase()}</dd></div>
              <div><dt>Généré le</dt><dd>{formatDate(snapshot.generatedAt)}</dd></div>
            </dl>
          </header>

          <section>
            <h2>Prestataire de formation</h2>
            <p><strong>{snapshot.provider.legalName}</strong> — {snapshot.provider.tradeName}</p>
            <p>{snapshot.provider.address}</p>
            <p>SIRET : {snapshot.provider.siret} · Déclaration d’activité : {snapshot.provider.activityDeclaration}</p>
            <p>{snapshot.provider.email} · {snapshot.provider.phone}</p>
          </section>

          <section className="training-document-columns">
            <div>
              <h2>Apprenant</h2>
              <p><strong>{snapshot.learner.fullName}</strong></p>
              <p>{snapshot.learner.email}</p>
              {snapshot.learner.jobTitle && <p>{snapshot.learner.jobTitle}</p>}
              {snapshot.learner.addressLine1 && <p>{snapshot.learner.addressLine1}<br />{snapshot.learner.postalCode} {snapshot.learner.city}</p>}
            </div>
            <div>
              <h2>Entreprise et financement</h2>
              <p>{snapshot.client.organizationName || 'Inscription individuelle'}</p>
              <p>{FUNDING_LABELS[snapshot.client.fundingMode] || snapshot.client.fundingMode}</p>
              {snapshot.client.funderName && <p>Financeur : {snapshot.client.funderName}</p>}
              {snapshot.client.fundingReference && <p>Dossier : {snapshot.client.fundingReference}</p>}
            </div>
          </section>

          <section>
            <h2>Action de formation</h2>
            <h3>{snapshot.course.title}</h3>
            <dl className="training-document-details">
              <div><dt>Durée</dt><dd>{formatDuration(snapshot.course.durationMinutes)}</dd></div>
              <div><dt>Tarif</dt><dd>{formatPrice(snapshot.course.priceAmountCents)}</dd></div>
              <div><dt>Début</dt><dd>{formatDate(snapshot.course.startsAt, true)}</dd></div>
              <div><dt>Fin</dt><dd>{formatDate(snapshot.course.endsAt, true)}</dd></div>
              <div><dt>Modalité</dt><dd>{DELIVERY_LABELS[snapshot.course.deliveryMode] || snapshot.course.deliveryMode}</dd></div>
              <div><dt>Lieu</dt><dd>{snapshot.course.location || (snapshot.course.deliveryMode === 'remote' ? 'À distance' : 'À confirmer')}</dd></div>
            </dl>
            {snapshot.course.remoteAccessDetails && <p className="training-document-callout"><strong>Accès :</strong> {snapshot.course.remoteAccessDetails}</p>}
            <h3>Objectifs</h3>
            <ul>{snapshot.course.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
          </section>

          {document.document_type === 'training_agreement' && (
            <>
              <section>
                <h2>Conditions essentielles</h2>
                {snapshot.clauses.map((clause) => <p key={clause}>{clause}</p>)}
              </section>
              <section className="training-document-signatures">
                <div><strong>Pour FormaPrompt</strong><span>Date et signature</span></div>
                <div><strong>Le client ou l’apprenant</strong><span>Date et signature précédée de la mention « Lu et approuvé »</span></div>
              </section>
            </>
          )}

          {document.document_type === 'convocation' && (
            <section>
              <h2>Consignes</h2>
              <p>{snapshot.instructions}</p>
              <p>En cas de besoin d’adaptation lié à l’accessibilité, contactez FormaPrompt avant la formation.</p>
            </section>
          )}

          {document.document_type === 'completion_certificate' && (
            <>
              <section className="training-document-certificate">
                <p>{snapshot.completion.statement}</p>
                <p>Formation déclarée terminée le {formatDate(snapshot.completion.completedAt)}.</p>
              </section>
              <section className="training-document-signatures">
                <div><strong>Le prestataire de formation</strong><span>Thierry FREZARD</span></div>
              </section>
            </>
          )}

          <footer>
            Document prérempli à partir du dossier FormaPrompt. Vérifier les informations avant signature ou transmission.
          </footer>
        </article>
      )}
    </main>
  );
}
