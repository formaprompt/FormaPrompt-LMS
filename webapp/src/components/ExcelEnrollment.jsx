import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { fetchActiveCourseAccess } from '../lib/courseAccess';
import { EXCEL_PURCHASES } from '../../supabase/functions/_shared/purchaseConfig.js';
import CommercialCheckout from './CommercialCheckout';

function ExcelCheckout({ offer }) {
  const { user } = useAuth();
  const [access, setAccess] = useState({ userId: null, active: false });
  useEffect(() => {
    let cancelled = false;
    if (!user) return () => { cancelled = true; };
    fetchActiveCourseAccess(user.id, offer.courseId)
      .then(({ data }) => { if (!cancelled) setAccess({ userId: user.id, active: Boolean(data) }); })
      .catch(() => { if (!cancelled) setAccess({ userId: user.id, active: false }); });
    return () => { cancelled = true; };
  }, [user, offer.courseId]);
  return <CommercialCheckout
    courseId={offer.courseId}
    user={user}
    accessLoading={Boolean(user) && access.userId !== user.id}
    hasActiveAccess={Boolean(user) && access.userId === user.id && access.active}
    priceLabel={`${offer.amountTotal / 100} €`}
    activeAccessActions={<Link className="btn btn-primary" to={`/paiement-reussi?course=${offer.courseId}`}>Consulter mon inscription Excel</Link>}
  />;
}

export default function ExcelEnrollment({ course }) {
  const [modality, setModality] = useState('inter');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const offer = EXCEL_PURCHASES[`excel-${course.id}-${modality}`];
  return (
    <details className="excel-enrollment" id={`${course.id}-inscription`}>
      <summary>Tarifs et inscription — {course.level}</summary>
      <p>14 heures pour chaque modalité. Choisissez votre accompagnement.</p>
      <fieldset className="excel-modalities">
        <legend>Modalité — Excel {course.level}</legend>
        {['inter', 'individuel'].map((value) => (
          <label key={value}>
            <input type="radio" name={`excel-modalite-${course.id}`} value={value} checked={modality === value}
              onChange={() => { setModality(value); setSelectedOffer(null); }} />
            <span>{value === 'inter' ? 'Inter-entreprises — 690 € / participant' : 'Individuel — 990 €'}</span>
          </label>
        ))}
      </fieldset>
      <button className="btn btn-primary" type="button" onClick={() => setSelectedOffer(offer.courseId)}>
        Voir le tarif et s’inscrire
      </button>
      {selectedOffer && <div className="excel-checkout" role="region" aria-label={`Inscription Excel ${course.level} — ${modality}`}>
        <ExcelCheckout key={selectedOffer} offer={EXCEL_PURCHASES[selectedOffer]} />
      </div>}
      <div className="excel-intra">
        <p><strong>Intra-entreprise — 1 590 € / groupe jusqu’à 8 participants</strong></p>
        <p>Précisons ensemble les dates, le lieu, les adaptations et les éventuels frais de déplacement.</p>
        <Link to="/contact" className="excel-text-link">Demander un devis</Link>
      </div>
    </details>
  );
}
