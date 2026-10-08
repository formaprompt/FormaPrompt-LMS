import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { CREATIVITY_PURCHASES } from '../../supabase/functions/_shared/purchaseConfig.js';

export default function CreativityDashboardSection({ userId, activeCourseIds = [] }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase.from('purchases').select('id, course_id, payment_status')
          .eq('user_id', userId).in('course_id', Object.keys(CREATIVITY_PURCHASES)).eq('payment_status', 'paid');
        if (!cancelled) setResult({ userId, purchases: error ? [] : data || [], error: Boolean(error) });
      } catch {
        if (!cancelled) setResult({ userId, purchases: [], error: true });
      }
    }
    if (userId) load();
    return () => { cancelled = true; };
  }, [userId]);
  if (result?.userId !== userId) return null;
  if (result.error) return <p role="status">Vos inscriptions IA et créativité ne peuvent pas être vérifiées pour le moment. <Link to="/contact">Contacter FormaPrompt</Link>.</p>;
  const purchases = result.purchases.filter(purchase => Object.hasOwn(CREATIVITY_PURCHASES, purchase.course_id) && !activeCourseIds.includes(purchase.course_id));
  if (!purchases.length) return null;
  return <section className="section" aria-labelledby="creativity-dashboard-title">
    <h2 id="creativity-dashboard-title">Vos inscriptions IA et créativité</h2>
    <div className="learner-course-grid">{purchases.map(purchase => <article key={purchase.id} className="learner-course-card">
      <h3>{CREATIVITY_PURCHASES[purchase.course_id].label}</h3>
      <p>{purchase.course_id === 'ia-creativite-individuel' ? 'Paiement enregistré. Votre calendrier de réservation sera disponible dès l’activation de votre droit.' : purchase.course_id === 'ia-creativite-groupe' ? 'Paiement enregistré. Le choix de session sera disponible dès l’activation de votre droit ; l’ouverture du groupe reste à confirmer.' : 'Paiement enregistré. Les dates et les participants sont convenus avec votre école ou association.'}</p>
      <Link to={`/paiement-reussi?course=${encodeURIComponent(purchase.course_id)}`} className="btn btn-primary">Retrouver mon inscription</Link>
    </article>)}</div>
  </section>;
}
