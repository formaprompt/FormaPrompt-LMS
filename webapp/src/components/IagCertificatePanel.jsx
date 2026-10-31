import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { createIagCertificateApi } from '../lib/iagCertificateApi.js';
import { createIagCertificateController } from '../lib/iagCertificateController.js';
import IagCertificateDocument from './IagCertificateDocument';

export default function IagCertificatePanel({ userId, supabase, onIssued }) {
  if (!userId) return <p>Connectez-vous pour retrouver vos certificats.</p>;
  return <CertificateSession key={userId} userId={userId} supabase={supabase} onIssued={onIssued} />;
}
function IdentityForm({ identity, busy, save }) {
  const [firstName, setFirstName] = useState(identity?.firstName || '');
  const [lastName, setLastName] = useState(identity?.lastName || '');
  const [confirmed, setConfirmed] = useState(false);
  return <form onSubmit={event => { event.preventDefault(); if (confirmed && !busy) void save({ firstName, lastName }); }}>
    <fieldset disabled={busy}>
      <legend>Identité du certificat</legend>
      <p>Déclarez le prénom et le nom à inscrire sur vos certificats. Cette déclaration est liée à votre compte ; elle ne constitue pas une vérification officielle d’identité.</p>
      <label>Prénom <input name="given-name" autoComplete="given-name" required maxLength={100} value={firstName} onChange={event => setFirstName(event.target.value)} /></label>
      <label>Nom <input name="family-name" autoComplete="family-name" required maxLength={100} value={lastName} onChange={event => setLastName(event.target.value)} /></label>
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required /> Je confirme cette identité déclarée pour mes certificats.</label>
      <p>Après la première délivrance, une demande de rectification passe par <Link to="/contact">FormaPrompt</Link>. Aucun certificat délivré n’est réécrit.</p>
      <button type="submit" className="btn btn-outline" disabled={!confirmed || busy}>Enregistrer ma déclaration</button>
    </fieldset>
  </form>;
}
function CertificateSession({ userId, supabase, onIssued }) {
  const controller = useMemo(() => createIagCertificateController(createIagCertificateApi(supabase, { userId })), [supabase, userId]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { void controller.reload(); return controller.cancel; }, [controller]);
  async function issue(type) {
    const document = await controller.issueCertificate(type);
    if (document) onIssued?.(document);
  }
  return <section aria-label="Certificats IAG">
    <h2>Vos certificats</h2>
    <p>Le certificat de fin correspond aux 22 leçons terminées. La mention Réussite exige en plus les trois validations humaines et les essais réels attendus ; elle ne dépend pas d’un seuil de note.</p>
    {state.loading ? <p role="status">Chargement des certificats…</p> : state.error ? <p role="alert">{state.error} <Link to="/contact">Contacter FormaPrompt</Link></p> : <>
      {state.identity?.locked ? <p>Identité déclarée : {state.identity.firstName} {state.identity.lastName}. Pour une rectification, <Link to="/contact">contactez FormaPrompt</Link>.</p>
        : <IdentityForm key={state.identity?.id || 'new'} identity={state.identity} busy={state.busy} save={controller.declareIdentity} />}
      <div className="attestation-actions">
        <button type="button" className="btn btn-primary" disabled={state.busy || !state.identity} onClick={() => void issue('iag_completion')}>Demander le certificat de fin</button>
        <button type="button" className="btn btn-outline" disabled={state.busy || !state.identity} onClick={() => void issue('iag_success')}>Demander la mention Réussite</button>
      </div>
      {state.busy && <p role="status">Vérification de votre demande…</p>}
      {state.documents.map(document => <div key={document.id}>
        <p><Link to={`/course/formation-ia-generative-elearning/certificats/${document.id}`}>Consulter et imprimer le document {document.reference}</Link></p>
        <IagCertificateDocument issuance={document} />
      </div>)}
    </>}
    <button type="button" className="btn btn-outline" disabled={state.loading || state.busy} onClick={() => void controller.reload()}>Recharger les certificats</button>
  </section>;
}
