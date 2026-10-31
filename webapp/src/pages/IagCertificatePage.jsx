import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { createIagCertificateApi } from '../lib/iagCertificateApi.js';
import { createIagCertificateDocumentController } from '../lib/iagCertificateDocumentController.js';
import IagCertificateDocument from '../components/IagCertificateDocument';
import './AttestationDocument.css';

export default function IagCertificatePage() {
  const { user, role } = useAuth();
  const { issuanceId } = useParams();
  return <IagCertificatePageContent key={`${user?.id || 'anonymous'}:${role || 'loading'}:${issuanceId}`} userId={user?.id} issuanceId={issuanceId} authorizationKey={role} supabase={supabase} />;
}
export function IagCertificatePageContent({ userId, issuanceId, authorizationKey, supabase:client }) {
  // authorizationKey only invalidates stale UI when role context changes.
  // It never authorizes a document: the SECURITY INVOKER RPC and existing RLS do.
  const controller = useMemo(() => createIagCertificateDocumentController(createIagCertificateApi(client, { userId }), issuanceId, authorizationKey), [client, userId, issuanceId, authorizationKey]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { if (userId) void controller.reload(); return controller.cancel; }, [controller, userId]);
  if (!userId) return <p>Connectez-vous pour consulter ce certificat.</p>;
  return <main className="attestation-page">
    <h1>Certificat IAG</h1>
    <div className="attestation-actions">
      <Link className="btn btn-outline" to="/dashboard">Retrouver mon espace</Link>
      <button type="button" className="btn btn-outline" disabled={state.loading} onClick={() => void controller.reload()}>Recharger</button>
      <button type="button" className="btn btn-primary" disabled={state.loading || !state.issuance || Boolean(state.error)} onClick={() => window.print()}>Imprimer ou enregistrer en PDF</button>
    </div>
    {state.loading ? <p role="status">Chargement du certificat…</p> : state.error ? <p className="attestation-error" role="alert">{state.error} <Link to="/contact">Contacter FormaPrompt</Link></p>
      : state.issuance && <IagCertificateDocument issuance={state.issuance} />}
  </main>;
}
