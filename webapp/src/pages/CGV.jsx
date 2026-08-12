import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import LegalDocument from '../components/LegalDocument';
import { SITE_CONFIG } from '../config/site';

export default function CGV() {
  return (
    <>
      <SEO
        title="Conditions générales de vente – FormaPrompt"
        description="Choisissez les conditions de vente FormaPrompt adaptées à votre situation : particulier ou professionnel."
        url={`${SITE_CONFIG.baseUrl}/cgv`}
      />
      <LegalDocument>
        <h1>Conditions générales de vente</h1>
        <p className="legal-document__meta">Les conditions applicables dépendent de la qualité de l’acheteur.</p>
        <section>
          <h2>Vous achetez à titre personnel</h2>
          <p>Consultez les conditions destinées aux consommateurs. Un contrat individuel distinct est établi lorsqu’une personne physique entreprend une formation professionnelle à titre individuel et à ses frais dans le champ des articles L6353-3 et suivants du Code du travail.</p>
          <Link className="btn btn-primary" to="/cgv-particuliers">Consulter les CGV particuliers</Link>
        </section>
        <section>
          <h2>Vous achetez pour une activité professionnelle</h2>
          <p>Ces conditions concernent notamment les entreprises, organismes de formation et autres clients professionnels.</p>
          <Link className="btn btn-primary" to="/cgv-professionnels">Consulter les CGV professionnels</Link>
        </section>
      </LegalDocument>
    </>
  );
}
