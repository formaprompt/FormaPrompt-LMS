import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { fetchActiveCourseAccess } from '../lib/courseAccess';
import { OFFICE_PURCHASES } from '../../supabase/functions/_shared/purchaseConfig.js';
import CommercialCheckout from './CommercialCheckout';

function OfficeCheckout({ offer }) {
  const { user } = useAuth();
  const [access, setAccess] = useState({ userId: null, courseId: null, active: false });

  useEffect(() => {
    let cancelled = false;
    if (!user) return () => { cancelled = true; };
    fetchActiveCourseAccess(user.id, offer.courseId)
      .then(({ data }) => {
        if (!cancelled) setAccess({ userId: user.id, courseId: offer.courseId, active: Boolean(data) });
      })
      .catch(() => {
        if (!cancelled) setAccess({ userId: user.id, courseId: offer.courseId, active: false });
      });
    return () => { cancelled = true; };
  }, [user, offer.courseId]);

  const accessResolved = Boolean(user)
    && access.userId === user.id
    && access.courseId === offer.courseId;

  return <CommercialCheckout
    courseId={offer.courseId}
    user={user}
    accessLoading={Boolean(user) && !accessResolved}
    hasActiveAccess={accessResolved && access.active}
    priceLabel={`${offer.amountTotal / 100} €`}
    activeAccessActions={<Link className="btn btn-primary" to={offer.resourcePath}>{offer.accessActionLabel}</Link>}
  />;
}

export default function OfficeEnrollment({ tool, course }) {
  const [modality, setModality] = useState('inter');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const toolId = tool.toLowerCase();
  const offer = OFFICE_PURCHASES[`${toolId}-${course.id}-${modality}`];

  return (
    <details className="office-enrollment" id={`${course.id}-inscription`}>
      <summary>Tarifs et inscription — {tool} {course.level}</summary>
      <p>14 heures pour chaque modalité. Choisissez votre accompagnement.</p>
      <fieldset className="office-modalities">
        <legend>Choisissez une modalité payable en ligne</legend>
        {[
          ['inter', 'Inter-entreprises — 690 € par participant'],
          ['individuel', 'Accompagnement individuel — 990 €'],
        ].map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name={`${toolId}-${course.id}-modality`}
              value={value}
              checked={modality === value}
              onChange={() => { setModality(value); setSelectedOffer(null); }}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <button className="btn btn-primary" type="button" onClick={() => setSelectedOffer(offer.courseId)}>
        Voir le tarif et s’inscrire
      </button>
      {selectedOffer && (
        <div className="office-checkout" role="region" aria-label={`Inscription ${tool} ${course.level} — ${modality}`}>
          <OfficeCheckout key={selectedOffer} offer={OFFICE_PURCHASES[selectedOffer]} />
        </div>
      )}
      <div className="office-intra">
        <p><strong>Intra-entreprise — 1 590 € / groupe jusqu’à 8 participants</strong></p>
        <p>La composition du groupe, les dates et l’organisation sont confirmées avec FormaPrompt.</p>
        <Link to="/contact" className="office-text-link">Demander un devis intra</Link>
      </div>
    </details>
  );
}
