import { Link } from 'react-router-dom';
import { SITE_CONFIG } from '../config/site';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container grid grid-cols-4 footer-grid">
        <div className="footer-col">
          <Link to="/">
            <img src="/assets/logo-new.png" alt={`Logo ${SITE_CONFIG.name}`} style={{ height: '128px', objectFit: 'contain', marginBottom: '1rem' }} />
          </Link>
          <p className="footer-text">
            Des formations claires, progressives et concrètes pour mieux maîtriser l’IA, la bureautique et les outils numériques.
          </p>
        </div>
        
        <div className="footer-col">
          <h4>Formations</h4>
          <ul>
            <li><Link to="/formation-ia-generative">IA Générative</Link></li>
            <li><Link to="/formation-prompt-engineering">Prompt Engineering</Link></li>
            <li><Link to="/formation-bureautique">Bureautique Pro</Link></li>
            <li><Link to="/formation-organismes">Pour les OF</Link></li>
          </ul>
        </div>
        
        <div className="footer-col">
          <h4>Liens utiles</h4>
          <ul>
            <li><Link to="/a-propos">À propos</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
            <li><Link to="/contact">Contact / Devis</Link></li>
            <li><Link to="/mentions-legales">Mentions légales</Link></li>
            <li><Link to="/cgv-particuliers">CGV particuliers</Link></li>
            <li><Link to="/cgv-professionnels">CGV professionnels</Link></li>
            <li><Link to="/politique-confidentialite">Confidentialité</Link></li>
            <li><Link to="/reglement-interieur">Règlement intérieur</Link></li>
            <li><Link to="/informations-precontractuelles">Informations précontractuelles</Link></li>
            <li><Link to="/retractation">Renoncer au contrat ici</Link></li>
          </ul>
        </div>
        
        <div className="footer-col">
          <h4>Contact</h4>
          <p className="footer-text">Hauts-de-France (Calais)</p>
          <p className="footer-text"><a href={`mailto:${SITE_CONFIG.contactEmail}`}>{SITE_CONFIG.contactEmail}</a></p>
          <Link to="/contact" className="btn btn-primary" style={{marginTop: '1rem'}}>Me contacter</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <p>{`© ${new Date().getFullYear()} ${SITE_CONFIG.name}. Tous droits réservés.`}</p>
        </div>
      </div>
    </footer>
  );
}
