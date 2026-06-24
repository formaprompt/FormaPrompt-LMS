import { Link } from 'react-router-dom';
import './Privacy.css';

export default function Privacy() {
  return (
    <div className="container">
      <h1>Politique de confidentialité</h1>
      <p>Cette page décrit la manière dont FormaPrompt collecte, utilise et protège vos données personnelles, conformément au RGPD.</p>
      <h2>Collecte de données</h2>
      <p>Nous collectons uniquement les informations nécessaires à la gestion des comptes, aux inscriptions aux formations et à l’envoi de newsletters (si vous y avez souscrit). Les données sont stockées dans Supabase et ne sont jamais vendues à des tiers.</p>
      <h2>Utilisation des cookies</h2>
      <p>Des cookies sont utilisés pour améliorer votre expérience et pour les statistiques de visites. Vous pouvez accepter ou refuser ces cookies via le bandeau en bas de chaque page.</p>
      <h2>Droits des utilisateurs</h2>
      <p>Vous avez le droit d’accéder, de rectifier, de supprimer ou de limiter le traitement de vos données. Pour exercer ces droits, contactez <a href="mailto:contact@formaprompt.fr">contact@formaprompt.fr</a>.</p>
      <p>En continuant à utiliser le site, vous acceptez les termes de cette politique.</p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: "1rem" }}>Retour à l'accueil</Link>
    </div>
  );
}
