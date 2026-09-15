import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { fetchActiveCourseAccess } from '../lib/courseAccess';
import SEO from './SEO';

export default function BureautiquePurchaseConfirmation({ offer }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const status = !user ? 'login' : result?.userId === user.id ? result.status : 'checking';
  const activationDeferred = [
    'deferred_after_withdrawal_period',
    'deferred_beneficiary_assignment',
  ].includes(searchParams.get('activation'));
  const family = offer.courseId.startsWith('excel-') ? 'Excel' : offer.tool === 'word' ? 'Word' : 'PowerPoint';
  const landingPath = offer.tool ? `/formation-${offer.tool}` : '/formation-excel';
  const confirmationPath = `/paiement-reussi?${searchParams.toString()}`;

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    let timer;
    let attempts = 0;
    async function verifyPurchase() {
      try {
        const [{ data, error }, { data: access, error: accessError }] = await Promise.all([
          supabase.from('purchases')
            .select('id, course_id, payment_status')
            .eq('user_id', user.id).eq('course_id', offer.courseId).maybeSingle(),
          fetchActiveCourseAccess(user.id, offer.courseId),
        ]);
        if (cancelled) return;
        if (error || accessError) throw error || accessError;
        if (data?.payment_status === 'paid') {
          if (access) setResult({ userId: user.id, status: 'active' });
          else if (activationDeferred) setResult({ userId: user.id, status: 'deferred' });
          else if (++attempts >= 10) setResult({ userId: user.id, status: 'pending' });
          else timer = window.setTimeout(verifyPurchase, 1500);
        } else if (data || ++attempts >= 10) {
          setResult({ userId: user.id, status: data ? 'unavailable' : 'pending' });
        } else {
          timer = window.setTimeout(verifyPurchase, 1500);
        }
      } catch {
        if (!cancelled) setResult({ userId: user.id, status: 'error' });
      }
    }
    verifyPurchase();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activationDeferred, user, offer.courseId]);

  return <>
    <SEO title={`Votre inscription ${family} – FormaPrompt`} description={`Vérification de votre inscription ${family} FormaPrompt.`}
      url="https://formaprompt.com/paiement-reussi" robots="noindex, nofollow" />
    <section className="container section" aria-live="polite">
      <h1>{status === 'active' ? `Votre inscription ${family} est enregistrée` : `Vérification de votre inscription ${family}`}</h1>
      <p className="mb-3">{offer.label} · 14 heures</p>
      {status === 'active' ? <>
        <p className="mb-3">Votre achat est confirmé et votre accès aux exercices est actif. La formation reste accompagnée par le formateur.</p>
        <Link to={offer.resourcePath} className="btn btn-primary">{offer.accessActionLabel}</Link>
      </> : status === 'deferred' ? <>
        <p className="mb-3">Votre achat est confirmé. L’accès aux exercices sera activé selon le choix effectué lors de la commande.</p>
        <Link to="/dashboard" className="btn btn-primary">Consulter mon espace apprenant</Link>
      </> : status === 'login' ? <>
        <p className="mb-3">Connectez-vous avec le compte utilisé lors de l’achat pour vérifier votre inscription.</p>
        <Link to={`/login?redirect=${encodeURIComponent(confirmationPath)}`} className="btn btn-primary">Se connecter</Link>
      </> : <>
        <p className="mb-3">{status === 'checking' ? 'Nous vérifions la confirmation du paiement.'
          : 'La confirmation ou l’activation de votre achat n’est pas disponible pour le moment. Si vous avez déjà payé, ne relancez pas le paiement ; consultez votre espace apprenant ou contactez FormaPrompt.'}</p>
        <Link to="/dashboard" className="btn btn-primary">Consulter mon espace apprenant</Link>
      </>}
      <p className="mt-4"><Link to={landingPath}>Retour aux formations {family}</Link></p>
    </section>
  </>;
}
