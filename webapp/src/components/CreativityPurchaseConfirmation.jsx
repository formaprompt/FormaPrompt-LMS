import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import SEO from './SEO';

export default function CreativityPurchaseConfirmation({ offer }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const status = !user ? 'login' : result?.userId === user.id ? result.status : 'checking';
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    let timer;
    let attempts = 0;
    async function verifyPurchase() {
      try {
        const { data, error } = await supabase.from('purchases').select('id, course_id, payment_status')
          .eq('user_id', user.id).eq('course_id', offer.courseId).maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (data?.payment_status === 'refunded') setResult({ userId: user.id, status: 'refunded' });
        else if (data?.payment_status === 'paid') setResult({ userId: user.id, status: 'paid' });
        else if (data || ++attempts >= 10) setResult({ userId: user.id, status: data ? 'unavailable' : 'pending' });
        else timer = window.setTimeout(verifyPurchase, 1500);
      } catch {
        if (!cancelled) setResult({ userId: user.id, status: 'error' });
      }
    }
    verifyPurchase();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [user, offer.courseId]);
  const redirect = `/paiement-reussi?${searchParams.toString()}`;
  return <>
    <SEO title="Votre inscription IA et créativité | FormaPrompt" description="Vérification de votre paiement pour la formation IA et créativité."
      url="https://formaprompt.com/paiement-reussi" robots="noindex, nofollow" />
    <section className="container section" aria-live="polite">
      <h1>{status === 'paid' ? 'Votre paiement est confirmé' : status === 'refunded' ? 'Votre paiement a été remboursé' : 'Vérification de votre inscription IA et créativité'}</h1>
      <p className="mb-3">{offer.label} · 14 heures</p>
      {status === 'paid' ? <>
        <p className="mb-3">{offer.courseId === 'ia-creativite-groupe' ? 'Votre achat est enregistré. Dès l’activation de votre droit, choisissez une session dans votre espace apprenant ; son ouverture reste conditionnelle, dans le respect du choix effectué lors de la commande.' : offer.courseId === 'ia-creativite-individuel' ? 'Votre achat est enregistré. Le calendrier de réservation de vos 14 heures est disponible dans votre espace apprenant dès l’activation de votre droit, dans le respect du choix effectué lors de la commande.' : 'Votre achat est enregistré. Les dates, les horaires et l’organisation sont convenus avec Thierry FREZARD, dans le respect du choix effectué lors de la commande.'}</p>
        {offer.groupOpeningMessage && <>
          <p className="mb-3">Votre paiement ne vaut pas confirmation de l’ouverture du groupe. Thierry FREZARD suit les inscriptions et confirme l’ouverture de la session.</p>
          <p className="mb-3">{offer.groupOpeningMessage}</p>
        </>}
        {offer.organizationRequired && <p className="mb-3">Le forfait couvre un groupe de votre école ou association, jusqu’à six personnes. Nous convenons ensuite des dates et de la liste des participants.</p>}
        <Link to={offer.courseId === 'ia-creativite-groupe' ? '/dashboard#creativity-group-sessions' : offer.courseId === 'ia-creativite-individuel' ? '/dashboard' : '/contact'} className="btn btn-primary">{offer.courseId === 'ia-creativite-groupe' ? 'Choisir ma session de groupe' : offer.courseId === 'ia-creativite-individuel' ? 'Retrouver mon calendrier de réservation' : 'Organiser ma formation'}</Link>
      </> : status === 'refunded' ? <>
        <p className="mb-3">Le remboursement de cet achat est enregistré. Contactez FormaPrompt si vous souhaitez des précisions.</p>
        <Link to="/contact" className="btn btn-primary">Contacter FormaPrompt</Link>
      </> : status === 'login' ? <>
        <p className="mb-3">Connectez-vous avec le compte utilisé lors de l’achat pour vérifier le paiement.</p>
        <Link to={`/login?redirect=${encodeURIComponent(redirect)}`} className="btn btn-primary">Se connecter</Link>
      </> : <>
        <p className="mb-3">{status === 'checking' ? 'Nous vérifions le paiement enregistré côté serveur.' : 'Le paiement n’est pas confirmé dans votre compte pour le moment. Si vous avez déjà payé, ne relancez pas le paiement ; contactez FormaPrompt.'}</p>
        <Link to="/contact" className="btn btn-primary">Contacter FormaPrompt</Link>
      </>}
      <p className="mt-4"><Link to="/dashboard">Consulter mon espace apprenant</Link>{' · '}<Link to="/formation-ia-creativite">Retour au programme IA et créativité</Link></p>
    </section>
  </>;
}
