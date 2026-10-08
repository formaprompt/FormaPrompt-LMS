import { useAuth } from '../contexts/useAuth';
import { Link } from 'react-router-dom';
import CommercialCheckout from './CommercialCheckout';
import { CREATIVITY_PURCHASES } from '../../supabase/functions/_shared/purchaseConfig.js';

export default function CreativityEnrollment() {
  const { user } = useAuth();
  return <section id="inscription" className="container generative-ai-section" aria-labelledby="creativity-inscription">
    <h2 id="creativity-inscription">Inscription et paiement à prix fixe</h2>
    <p>La formation comprend 14 heures accompagnées. Les abonnements et outils payants ne sont pas inclus. Les choix de session ou d’horaires sont disponibles dans votre espace apprenant dès l’activation de votre droit.</p>
    <div className="creativity-pricing creativity-enrollment">
      {Object.values(CREATIVITY_PURCHASES).map(offer => <article key={offer.courseId}>
        <h3>{offer.label.split(' — ')[1]}</h3>
        <p className="creativity-price">{new Intl.NumberFormat('fr-FR').format(offer.amountTotal / 100)} €{offer.modality === 'groupe' ? ' par personne' : offer.organizationRequired ? ' pour le groupe' : ' pour les 14 heures'}</p>
        <p>{offer.courseId === 'ia-creativite-groupe' ? 'Choisissez ensuite une session de groupe publiée. Son ouverture reste à confirmer par Thierry FREZARD.' : offer.courseId === 'ia-creativite-individuel' ? 'Réservez ensuite votre modalité et vos horaires dans le calendrier des 14 heures individuelles.' : 'Les dates et les participants sont convenus ensuite avec votre école ou association.'}</p>
        {offer.groupOpeningMessage && <p>{offer.groupOpeningMessage}</p>}
        {offer.checkoutEnabled ? <CommercialCheckout courseId={offer.courseId} user={user} accessLoading={false} hasActiveAccess={false}
          priceLabel={`${offer.amountTotal / 100} €`} /> : <p role="status">{offer.checkoutUnavailableMessage}</p>}
      </article>)}
    </div>
    <p className="creativity-price-note">TVA non applicable. Pour préparer votre organisation ou signaler un besoin d’adaptation, <Link to="/contact">contactez FormaPrompt</Link>.</p>
  </section>;
}
