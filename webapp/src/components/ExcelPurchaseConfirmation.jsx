import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import SEO from './SEO';

export default function ExcelPurchaseConfirmation({ offer }) {
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const status = !user ? 'login' : result?.userId === user.id ? result.status : 'checking';
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    let timer;
    let attempts = 0;
    async function verifyPurchase() {
      try {
        const { data, error } = await supabase.from('purchases')
          .select('id, course_id, payment_status')
          .eq('user_id', user.id).eq('course_id', offer.courseId).maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (data?.payment_status === 'paid') {
          setResult({ userId: user.id, status: 'paid' });
        } else if (data || ++attempts >= 10) {
          setResult({ userId: user.id, status: 'pending' });
        } else {
          timer = window.setTimeout(verifyPurchase, 1500);
        }
      } catch {
        if (!cancelled) setResult({ userId: user.id, status: 'error' });
      }
    }
    verifyPurchase();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [user, offer.courseId]);

  return <>
    <SEO title="Votre inscription Excel – FormaPrompt" description="Vérification de votre inscription Excel FormaPrompt."
      url="https://formaprompt.com/paiement-reussi" robots="noindex, nofollow" />
    <section className="container section" aria-live="polite">
      <h1>{status === 'paid' ? 'Votre inscription Excel est enregistrée' : 'Vérification de votre inscription Excel'}</h1>
      <p className="mb-3">{offer.label} · 14 heures</p>
      {status === 'paid' ? <>
        <p className="mb-3">Votre achat est confirmé. Nous pouvons préparer avec vous l’organisation de la formation et les dates des séances.</p>
        <p className="mb-3">Les supports en ligne et la réservation des séances Excel sur le site sont en préparation. Contactez FormaPrompt pour organiser votre accompagnement.</p>
        <Link to="/contact" className="btn btn-primary">Organiser ma formation Excel</Link>
      </> : status === 'login' ? <>
        <p className="mb-3">Connectez-vous avec le compte utilisé lors de l’achat pour vérifier votre inscription.</p>
        <Link to={`/login?redirect=${encodeURIComponent(`/paiement-reussi?course=${offer.courseId}`)}`} className="btn btn-primary">Se connecter</Link>
      </> : <p className="mb-3">{status === 'checking' ? 'Nous vérifions la confirmation du paiement.'
        : 'La confirmation de votre achat n’est pas disponible pour le moment. Si vous avez déjà payé, ne relancez pas le paiement ; contactez FormaPrompt.'}</p>}
      <p className="mt-4"><Link to="/formation-excel">Retour aux formations Excel</Link></p>
    </section>
  </>;
}
