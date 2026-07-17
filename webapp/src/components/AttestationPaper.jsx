import { formatAttestationDuration } from '../lib/attestationDossier';

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'En attente de délivrance';
}

export default function AttestationPaper({ documentType, reference, issuedAt, snapshot, isDraft = false }) {
  if (!snapshot) return null;
  const organization = snapshot.organization || {};

  return (
    <article className={`attestation-paper ${isDraft ? 'is-draft' : ''}`}>
      {isDraft && <div className="attestation-watermark" aria-hidden="true">BROUILLON</div>}

      <header className="attestation-paper__header">
        <img src="/assets/logo-new.png" alt="FormaPrompt" />
        <div>
          <p>{organization.legalName}</p>
          <span>{organization.address}</span>
          <span>SIRET : {organization.siret}</span>
        </div>
        <dl>
          <div><dt>Référence</dt><dd>{reference || 'Attribuée à la délivrance'}</dd></div>
          <div><dt>Délivrée le</dt><dd>{formatDate(issuedAt)}</dd></div>
        </dl>
      </header>

      <section className="attestation-paper__title">
        <p>Action de formation professionnelle</p>
        <h1>{snapshot.title}</h1>
        {documentType === 'competences' && (
          <span>Évaluation des acquis – formation non certifiante</span>
        )}
      </section>

      <p className="attestation-paper__statement">
        Je soussigné <strong>{organization.trainerName}</strong>, formateur et responsable de
        l’organisme {organization.brandName}, atteste que :
      </p>

      <section className="attestation-paper__identity" aria-label="Identité et formation">
        <div><strong>Apprenant</strong><span>{snapshot.learnerName}</span></div>
        <div><strong>Formation</strong><span>{snapshot.courseTitle}</span></div>
        <div><strong>Nature de l’action</strong><span>{snapshot.nature}</span></div>
        <div><strong>Période</strong><span>{snapshot.period}</span></div>
        <div><strong>Modalité</strong><span>{snapshot.deliveryMode}</span></div>
        <div>
          <strong>Durée</strong>
          <span>
            {formatAttestationDuration(snapshot.attendedMinutes)} réellement suivie
            {snapshot.plannedMinutes > 0
              ? ` sur ${formatAttestationDuration(snapshot.plannedMinutes)} planifiées`
              : ''}
          </span>
        </div>
      </section>

      <section className="attestation-paper__section">
        <h2>Objectifs pédagogiques</h2>
        <ul>
          {(snapshot.objectives || []).map((objective) => <li key={objective}>{objective}</li>)}
        </ul>
      </section>

      {documentType === 'realisation' ? (
        <section className="attestation-paper__result">
          <h2>Réalisation de la formation</h2>
          <p>
            Les {snapshot.sessionCount} séances planifiées disposent d’un émargement apprenant
            et d’une validation du formateur. La durée indiquée correspond au temps réellement suivi et
            constaté dans les feuilles d’émargement.
          </p>
        </section>
      ) : (
        <section className="attestation-paper__section attestation-paper__evaluation">
          <div className="attestation-paper__evaluation-heading">
            <h2>Résultats de l’évaluation des acquis</h2>
            <strong>{snapshot.evaluation?.statusLabel || 'Évaluation en attente'}</strong>
          </div>
          <table>
            <thead><tr><th>Critère évalué</th><th>Niveau observé</th></tr></thead>
            <tbody>
              {(snapshot.evaluation?.criteria || []).map((criterion) => (
                <tr key={criterion.id}><td>{criterion.label}</td><td>{criterion.level}</td></tr>
              ))}
            </tbody>
          </table>
          {snapshot.evaluation && (
            <div className="attestation-paper__feedback">
              <p><strong>Appréciation :</strong> {snapshot.evaluation.appreciation}</p>
              <p><strong>Axes de progrès :</strong> {snapshot.evaluation.improvementAreas}</p>
            </div>
          )}
          <p className="attestation-paper__non-certifying">
            Cette attestation décrit le résultat d’une évaluation interne. Elle ne constitue ni un diplôme,
            ni un titre professionnel, ni une certification enregistrée au RNCP ou au Répertoire spécifique.
          </p>
        </section>
      )}

      <section className="attestation-paper__signature">
        <div>
          <span>Fait à Calais, le {formatDate(issuedAt)}</span>
          <strong>{organization.trainerName}</strong>
          <small>Formateur et responsable pédagogique</small>
        </div>
        <div className="attestation-paper__signature-box"><span>Signature</span></div>
      </section>

      <footer className="attestation-paper__footer">
        <p>
          Enregistrée sous le numéro {organization.activityDeclarationNumber}.
          Cet enregistrement ne vaut pas agrément de l’État.
        </p>
        <p>{organization.email} · {organization.website}</p>
        <details>
          <summary>Références internes de traçabilité</summary>
          <span>Réservation : {snapshot.traceability?.bookingId || '—'}</span>
          <span>Remise finale : {snapshot.traceability?.submissionId || '—'}</span>
          <span>Évaluation : {snapshot.traceability?.reviewId || '—'}</span>
          <span>Émargements : {(snapshot.traceability?.attendanceIds || []).join(', ') || '—'}</span>
        </details>
      </footer>
    </article>
  );
}
