import { Link } from 'react-router-dom';
import './LegalDocument.css';

const LEGAL_LINKS = [
  ['/mentions-legales', 'Mentions légales'],
  ['/cgv-particuliers', 'CGV particuliers'],
  ['/cgv-professionnels', 'CGV professionnels'],
  ['/politique-confidentialite', 'Confidentialité'],
  ['/reglement-interieur', 'Règlement intérieur'],
  ['/informations-precontractuelles', 'Informations précontractuelles'],
  ['/retractation', 'Renoncer au contrat ici'],
];

export function LegalNavigation() {
  return (
    <nav className="legal-nav" aria-label="Documents juridiques FormaPrompt">
      <ul>
        {LEGAL_LINKS.map(([to, label]) => (
          <li key={to}><Link to={to}>{label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}

export default function LegalDocument({ children }) {
  return (
    <div className="legal-page">
      <div className="container legal-page__container">
        <LegalNavigation />
        <article className="legal-document">{children}</article>
      </div>
    </div>
  );
}
