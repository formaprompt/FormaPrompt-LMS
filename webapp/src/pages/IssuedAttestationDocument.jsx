import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AttestationPaper from '../components/AttestationPaper';
import { useAuth } from '../contexts/useAuth';
import { startIssuedAttestationRequest } from '../lib/issuedAttestationRequest.js';
import { supabase } from '../lib/supabaseClient';
import './AttestationDocument.css';

export default function IssuedAttestationDocument() {
  const { issuanceId } = useParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;
  useEffect(() => {
    if (!userId) navigate('/login', { replace: true });
  }, [navigate, userId]);
  if (!userId) return null;
  return <IssuedAttestationSession
    key={`${userId}:${role || ''}:${issuanceId}`}
    issuanceId={issuanceId} role={role} navigate={navigate}
  />;
}

function IssuedAttestationSession({ issuanceId, role, navigate }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    const request = startIssuedAttestationRequest(supabase, issuanceId, setResult);
    return request.cancel;
  }, [issuanceId]);
  const issuance = result?.issuance || null;
  const error = result?.error || '';
  const loading = result === null;
  const ready = !loading && !error && Boolean(issuance);

  return (
    <main className="attestation-page">
      <div className="attestation-actions">
        <button type="button" className="btn btn-primary" onClick={() => { if (ready) window.print(); }} disabled={!ready}>
          <Printer size={18} aria-hidden="true" /> Imprimer ou enregistrer en PDF
        </button>
        <button
          type="button"
          className="btn attestation-back-button"
          onClick={() => navigate(role === 'admin' || role === 'employee' ? '/admin?onglet=corrections' : '/dashboard')}
        >
          {role === 'admin' || role === 'employee' ? 'Retour aux évaluations' : 'Retour à mon espace'}
        </button>
      </div>

      {loading ? <p>Chargement de l’attestation…</p> : error ? (
        <p role="alert" className="attestation-error">{error}</p>
      ) : issuance && (
        <>
          <div className="attestation-issued-notice" role="status">
            <strong>Attestation délivrée et enregistrée</strong>
            <span>Son contenu et sa référence sont conservés dans votre dossier de formation.</span>
          </div>
          <AttestationPaper
            documentType={issuance.document_type}
            reference={issuance.reference}
            issuedAt={issuance.issued_at}
            snapshot={issuance.content_snapshot}
          />
        </>
      )}
    </main>
  );
}
