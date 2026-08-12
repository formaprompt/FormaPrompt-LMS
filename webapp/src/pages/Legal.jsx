import SEO from '../components/SEO';
import LegalDocument from '../components/LegalDocument';
import { SITE_CONFIG } from '../config/site';
import { FORMAPROMPT_TAX } from '../../supabase/functions/_shared/legalBusiness.js';

export default function Legal() {
  return (
    <>
      <SEO
        title="Mentions légales – FormaPrompt"
        description="Identité de l’éditeur, hébergement, contact et informations légales de FormaPrompt."
        url={`${SITE_CONFIG.baseUrl}/mentions-legales`}
      />
      <LegalDocument>
        <h1>Mentions légales</h1>
        <p className="legal-document__meta">Version 2026-08-12</p>

        <h2>1. Éditeur du site</h2>
        <p><strong>{SITE_CONFIG.legalBusinessName}</strong>, entreprise individuelle exploitant FormaPrompt.</p>
        <ul>
          <li>Adresse : 6 rue Webster, 62100 Calais, France</li>
          <li>SIREN : 511 151 615</li>
          <li>SIRET : 511 151 615 00016</li>
          <li>Code APE / NAF : 4791A</li>
          <li>{FORMAPROMPT_TAX.statement}</li>
          <li>Courriel : <a href={`mailto:${SITE_CONFIG.contactEmail}`}>{SITE_CONFIG.contactEmail}</a></li>
          <li>Téléphone : <a href="tel:+33612195381">+33 (0)6 12 19 53 81</a></li>
        </ul>

        <h2>2. Directeur de la publication</h2>
        <p>{SITE_CONFIG.responsibleName}</p>

        <h2>3. Activité de formation</h2>
        <p>Déclaration d’activité n° 32620346362 auprès du préfet de région Hauts-de-France. Cet enregistrement ne vaut pas agrément de l’État.</p>

        <h2>4. Hébergement</h2>
        <p><strong>IONOS SARL</strong>, 7 place de la Gare, BP 70109, 57200 Sarreguemines Cedex, France.</p>

        <h2>5. Propriété intellectuelle</h2>
        <p>Les textes, ressources pédagogiques, éléments graphiques, vidéos, logos et autres contenus du site sont protégés par les droits de leurs titulaires. Toute reproduction, adaptation, diffusion ou exploitation non autorisée est interdite, sous réserve des exceptions légales.</p>

        <h2>6. Responsabilité</h2>
        <p>FormaPrompt apporte un soin raisonnable à l’exactitude et à la mise à jour du site. Les informations générales ne remplacent pas un conseil adapté à une situation particulière. Les modalités et engagements applicables à une formation figurent dans l’offre et les documents contractuels correspondants.</p>

        <h2>7. Données personnelles</h2>
        <p>Les informations sur les traitements, les prestataires et l’exercice des droits figurent dans la <a href="/politique-confidentialite">politique de confidentialité</a>.</p>

        <h2>8. Médiation de la consommation</h2>
        <p>Après une réclamation écrite préalable restée sans solution satisfaisante, le consommateur peut saisir gratuitement :</p>
        <p><strong>CM2C — Centre de la Médiation de la Consommation de Conciliateurs de Justice</strong><br />49 rue de Ponthieu, 75008 Paris<br />Téléphone : 01 89 47 00 14<br /><a href="https://www.cm2c.net/" target="_blank" rel="noopener noreferrer">www.cm2c.net</a></p>
        <p>L’adhésion FormaPrompt est valable jusqu’au 21 juillet 2028.</p>
      </LegalDocument>
    </>
  );
}
