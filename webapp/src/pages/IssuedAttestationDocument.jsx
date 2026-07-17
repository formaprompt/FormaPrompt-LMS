import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AttestationPaper from '../components/AttestationPaper';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import './AttestationDocument.css';

export default function IssuedAttestationDocument() {
  const { issuanceId } = useParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [issuance, setIssuance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    async function loadIssuance() {
      setLoading(true);
      setError('');
      const { data, error: loadError } = await supabase
        .from('course_attestation_issuances')
        .select('id, reference, user_id, course_id, document_type, content_snapshot, issued_at')
        .eq('id', issuanceId)
        .maybeSingle();

      if (loadError || !data) {
        console.error("Chargement de l’attestation délivrée impossible :", loadError);
        setError("Cette attestation est introuvable ou vous n’êtes pas autorisé à la consulter.");
      } else {
        setIssuance(data);
      }
      setLoading(false);
    }

    loadIssuance();
  }, [issuanceId, navigate, user]);

  if (!user) return null;

  return (
    <main className="attestation-page">
      <div className="attestation-actions">
        <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!issuance}>
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
