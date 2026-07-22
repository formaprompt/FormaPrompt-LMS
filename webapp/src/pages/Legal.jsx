import SEO from '../components/SEO';
import { SITE_CONFIG } from '../config/site';

export default function Legal() {
  return (
    <>
      <SEO
        title="Mentions légales – FormaPrompt"
        description="Informations légales et politique de confidentialité de FormaPrompt."
        url={`${SITE_CONFIG.baseUrl}/mentions-legales`}
        image={`${SITE_CONFIG.baseUrl}/assets/photo page d'accueil.png`}
      />
      <div className="container section">
      <h1 className="mb-4">Mentions Légales et Politique de Confidentialité</h1>
      
      <div className="card mb-4">
        <h2>1. Éditeur du site</h2>
        <p className="mb-2"><strong>Statut juridique :</strong> Entreprise Individuelle (EI)</p>
        <p className="mb-2"><strong>Nom officiel de l'entreprise :</strong> {SITE_CONFIG.legalBusinessName}</p>
        <p className="mb-2"><strong>Adresse :</strong> 6 rue Webster, 62100 CALAIS, France</p>
        <p className="mb-2"><strong>SIRET :</strong> 511 151 615 00016</p>
        <p className="mb-2"><strong>SIREN :</strong> 511 151 615</p>
        <p className="mb-2"><strong>Code APE / NAF :</strong> 4791A</p>
        <p className="mb-2"><strong>Numéro de TVA intracommunautaire :</strong> TVA non applicable - article 293 B du CGI</p>
      </div>

      <div className="card mb-4">
        <h2>2. Responsable de la publication</h2>
        <p className="mb-2"><strong>Nom du responsable :</strong> {SITE_CONFIG.responsibleName}</p>
      </div>

      <div className="card mb-4">
        <h2>3. Activité de formation</h2>
        <p className="mb-2"><strong>Numéro de déclaration d'activité (NDA) :</strong> 32620346362</p>
        <p className="mb-2"><strong>Certification Qualiopi :</strong> Non (Sous-traitance uniquement)</p>
        <p className="mb-2"><strong>Zone d'intervention :</strong> Hauts-de-France, distanciel</p>
      </div>

      <div className="card mb-4">
        <h2>4. Hébergement du site</h2>
        <p className="mb-2"><strong>Nom de l'hébergeur :</strong> Ionos</p>
        <p className="mb-2"><strong>Adresse de l'hébergeur :</strong> IONOS SARL, 7 place de la Gare, BP 70109, 57200 Sarreguemines Cedex, France</p>
      </div>

      <div className="card mb-4">
        <h2>5. Propriété intellectuelle</h2>
        <p className="mb-2">Tous les éléments du site internet FormaPrompt (textes, images, vidéos, logos, etc.) sont la propriété exclusive de Thierry FREZARD EI, sauf mention contraire. Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site est interdite, sauf autorisation écrite préalable.</p>
      </div>

      <div className="card mb-4">
        <h2>6. Responsabilité</h2>
        <p className="mb-2">Thierry FREZARD EI s'efforce de fournir sur le site des informations aussi précises que possible. Toutefois, il ne pourra être tenu responsable des omissions, des inexactitudes et des carences dans la mise à jour, qu'elles soient de son fait ou du fait des tiers partenaires qui lui fournissent ces informations.</p>
      </div>

      <div className="card mb-4">
        <h2>7. Données personnelles (RGPD)</h2>
        <p className="mb-2"><strong>Responsable du traitement :</strong> Thierry FREZARD</p>
        <p className="mb-2"><strong>Finalités du traitement :</strong> Les données collectées (nom, email, etc.) sont utilisées pour gérer les demandes de contact, les inscriptions, la facturation, le suivi pédagogique et les justificatifs qualité. Les tests de positionnement préalables enregistrent notamment l'identité de l'apprenant, la formation, les réponses, le résultat et la date de réalisation.</p>
        <p className="mb-2"><strong>Base juridique :</strong> Selon le traitement concerné, les données sont traitées sur la base du consentement, de l'exécution du contrat de formation ou du respect des obligations légales, réglementaires et qualité applicables au prestataire.</p>
        <p className="mb-2"><strong>Caractère obligatoire :</strong> Les données requises lors d'une commande ou d'une demande de contact sont nécessaires pour leur traitement. Les données facultatives seront expressément mentionnées.</p>
        <p className="mb-2"><strong>Destinataires des données :</strong> Les données sont accessibles uniquement à Thierry FREZARD EI, aux personnes habilitées pour le suivi pédagogique et, dans la stricte limite nécessaire, aux prestataires techniques agissant pour FormaPrompt. Elles ne sont pas vendues à des tiers.</p>
        <p className="mb-2"><strong>Durée de conservation :</strong> Les données sont conservées pendant la durée nécessaire à leur finalité. Les résultats de positionnement sont conservés pour le suivi de la formation puis archivés pendant la durée nécessaire à la justification des engagements contractuels et qualité. Les pièces comptables peuvent être conservées 10 ans.</p>
        <p className="mb-2"><strong>Droits des personnes :</strong> Conformément à la réglementation (RGPD et loi Informatique et Libertés), vous disposez d'un droit d'accès, de rectification, de portabilité, d'effacement de vos données ou d'une limitation du traitement. Vous pouvez exercer ce droit en nous contactant à l'adresse électronique : <a href={`mailto:${SITE_CONFIG.contactEmail}`} className="text-blue-500 hover:underline">{SITE_CONFIG.contactEmail}</a>.</p>
        <p className="mb-2">Vous avez également le droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr).</p>
      </div>

      <div className="card mb-4">
        <h2>8. Cookies</h2>
        <p className="mb-2">Ce site utilise des cookies essentiels au bon fonctionnement (comme la gestion de session avec Supabase). Nous pouvons également utiliser des cookies statistiques anonymisés pour analyser l'audience de notre site, sous réserve de votre consentement recueilli via notre bannière de cookies.</p>
        <p className="mb-2">Vous pouvez à tout moment modifier vos préférences ou retirer votre consentement depuis les paramètres de votre navigateur.</p>
      </div>

      <div className="card mb-4">
        <h2>9. Contact</h2>
        <p className="mb-2"><strong>Courriel :</strong> <a href={`mailto:${SITE_CONFIG.contactEmail}`} className="text-blue-500 hover:underline">{SITE_CONFIG.contactEmail}</a></p>
        <p className="mb-2"><strong>Téléphone :</strong> <a href="tel:+33612195381" className="text-blue-500 hover:underline">+33 (0)6 12 19 53 81</a></p>
      </div>

      <div className="card mb-4">
        <h2>10. Médiation de la consommation</h2>
        <p className="mb-2">
          Conformément aux dispositions du Code de la consommation concernant « le processus de médiation des litiges de la consommation », après nous avoir sollicités et à défaut de réponse vous satisfaisant, vous avez la possibilité de recourir gratuitement à une procédure de médiation de la consommation auprès de :
        </p>
        <p className="mb-2"><strong>CM2C</strong></p>
        <p className="mb-2">49 rue de Ponthieu<br/>75 008 PARIS</p>
        <p className="mb-2"><strong>Tel :</strong> 01 89 47 00 14</p>
        <p className="mb-2"><strong>Site internet :</strong> <a href="https://www.cm2c.net/declarer-un-litige.php" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">https://www.cm2c.net/declarer-un-litige.php</a></p>
        <p className="mb-2"><strong>Courriel :</strong> <a href="mailto:litiges@cm2c.net" className="text-blue-500 hover:underline">litiges@cm2c.net</a></p>
      </div>
    </div>
    </>
  );
}
