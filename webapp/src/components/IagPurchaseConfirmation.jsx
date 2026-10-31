import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { fetchActiveCourseAccess } from '../lib/courseAccess';
import { checkoutReference } from '../lib/iagPurchaseConfirmation.js';
import { IAG_COURSE_ID } from '../../supabase/functions/_shared/iagPositioning.js';

export default function IagPurchaseConfirmation() {
  const { user } = useAuth(); const [params] = useSearchParams();
  // Ces paramètres guident le texte ; seul le droit serveur peut ouvrir le cours.
  const reconciliationRequired = params.get('verification') === 'requise';
  const reference = reconciliationRequired ? checkoutReference(params.get('reference')) : null;
  const deferred = !reconciliationRequired && ['deferred_after_withdrawal_period', 'deferred_beneficiary_assignment'].includes(params.get('activation'));
  const userId = user?.id || '';
  return <PurchaseConfirmationSession key={`${userId}:${deferred}:${reconciliationRequired}:${reference || ''}`} userId={userId} deferred={deferred} reconciliationRequired={reconciliationRequired} reference={reference} />;
}

function PurchaseConfirmationSession({ userId, deferred, reconciliationRequired, reference }) {
  const [currentStatus, setStatus] = useState(() => !userId ? 'login' : deferred ? 'deferred' : 'checking');
  useEffect(() => {
    if (!userId || deferred) return;
    let current = true; let timer; let attempts = 0;
    async function check() {
      attempts += 1;
      try {
        const { data, error } = await fetchActiveCourseAccess(userId, IAG_COURSE_ID);
        if (!current) return;
        if (error) setStatus('error');
        else if (data) setStatus('active');
        else if (reconciliationRequired) setStatus('reconciliation');
        else if (attempts >= 10) setStatus('pending');
        else timer = window.setTimeout(check, 1500);
      } catch { if (current) setStatus('error'); }
    }
    check();
    return () => { current = false; window.clearTimeout(timer); };
  }, [userId, deferred, reconciliationRequired]);
  const status = reconciliationRequired && currentStatus === 'checking' ? 'reconciliation' : currentStatus;
  const texts = {
    checking: 'Vérification de votre accès en cours.',
    login: 'Connectez-vous avec le compte utilisé pour vérifier votre accès.',
    deferred: 'Vous avez choisi un accès différé ou un achat pour un bénéficiaire. Retrouvez son suivi dans votre espace ; aucun second paiement n’est nécessaire.',
    active: 'Votre accès à la formation IAG e-learning est actif.',
    pending: 'Votre accès n’est pas encore confirmé. Ne recommencez pas le paiement pour le moment. Si cette situation persiste, contactez FormaPrompt.',
    reconciliation: 'L’état de votre paiement reste à vérifier. Ne recommencez pas le paiement pour le moment. Si cette situation persiste, contactez FormaPrompt.',
    error: 'La vérification de votre accès est indisponible. Ne recommencez pas le paiement pour le moment. Si cette situation persiste, contactez FormaPrompt.',
  };
  const needsSupport = ['reconciliation', 'pending', 'error'].includes(status);
  return <section className="container section" aria-labelledby="iag-confirm-title">
    <h1 id="iag-confirm-title">Votre formation IAG e-learning</h1>
    <p role="status" aria-live="polite" aria-atomic="true">{texts[status]}</p>
    {needsSupport && <>
      {reference && <p>Référence à indiquer à FormaPrompt : <code>{reference}</code></p>}
      <p><Link to="/contact">Contacter FormaPrompt</Link></p>
    </>}
    {status === 'active' ? <Link className="btn btn-primary" to={`/course/${IAG_COURSE_ID}`}>Commencer par mon questionnaire de départ</Link> : <Link className="btn btn-primary" to={status === 'login' ? '/login' : '/dashboard'}>{status === 'login' ? 'Se connecter' : 'Mon espace apprenant'}</Link>}
  </section>;
}
