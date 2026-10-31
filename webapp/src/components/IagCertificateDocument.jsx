import { publicDocumentProjection } from '../lib/iagCertificateDomain.js';
import { FORMATION_ORGANIZATION } from '../data/attestationConfig';
import '../pages/AttestationDocument.css';

function date(value) {
  return new Date(value).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', timeZone:'Europe/Paris' });
}
// Pure presentation of a row already authorized by server RLS (owner/staff).
export default function IagCertificateDocument({ issuance }) {
  let document;
  try { document = publicDocumentProjection(issuance); }
  catch { return <p role="alert">Ce certificat ne peut pas être affiché.</p>; }
  return <article className="attestation-paper" aria-label={document.title}>
    <header className="attestation-paper__header">
      <img src="/assets/logo-new.png" alt={FORMATION_ORGANIZATION.brandName} />
      <div><p>{document.organization.brandName}</p><p>{document.organization.legalName}</p></div>
      <dl><div><dt>Référence</dt><dd>{document.reference}</dd></div>
        <div><dt>Délivré le</dt><dd>{date(document.issuedAt)}</dd></div></dl>
    </header>
    <section className="attestation-paper__title"><h2>{document.title}</h2></section>
    <section className="attestation-paper__identity" aria-label="Apprenant et parcours">
      <div><strong>Apprenant</strong><span>{document.learnerName}</span></div>
      <div><strong>Formation</strong><span>{document.courseTitle}</span></div>
      <div><strong>Parcours terminé le</strong><span>{date(document.completedAt)}</span></div>
      <div><strong>Modalité</strong><span>E-learning autonome</span></div>
    </section>
    <section className="attestation-paper__section"><h3>Objectifs du parcours</h3>
      <ul>{document.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul></section>
    <section className="attestation-paper__result"><h3>Fin du parcours</h3>
      <p>Les 22 leçons du parcours sont déclarées terminées. Ce suivi d’avancement ne mesure pas un temps de présence.</p>
      {issuance.document_type === 'iag_success' && <p>La mention Réussite correspond aux trois travaux validés humainement avec les essais réels d’IA attendus. Aucun seuil de note ne déclenche cette mention.</p>}
      {document.initialReference && <p>Complément au certificat initial : {document.initialReference}.</p>}
    </section>
    <footer className="attestation-paper__footer"><p>{document.identityNotice}</p><p>{document.notice}</p></footer>
  </article>;
}
