import SEO from '../components/SEO';
import { SITE_CONFIG } from '../config/site';

export default function CGV() {
  return (
    <>
      <SEO
        title="Conditions Générales de Vente – FormaPrompt"
        description="Conditions Générales de Vente (CGV) des formations FormaPrompt."
        url={`${SITE_CONFIG.baseUrl}/cgv`}
        image={`${SITE_CONFIG.baseUrl}/assets/photo page d'accueil.png`}
      />
      <div className="container section">
      <h1 className="mb-4">Conditions Générales de Vente (CGV)</h1>
      <p className="mb-4 text-gray-600">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>

      <div className="card mb-4">
        <h2>Article 1 : Préambule</h2>
        <p className="mb-2">Les présentes Conditions Générales de Vente (ci-après « CGV ») s'appliquent à toutes les prestations de formation engagées par <strong>Thierry FREZARD EI</strong> (ci-après « le Prestataire » ou « l'Organisme de Formation »), enregistré sous le numéro de déclaration d'activité 32620346362 auprès du préfet de région Hauts-de-France (cet enregistrement ne vaut pas agrément de l'État), et le Client (ci-après « le Client » ou « le Stagiaire »).</p>
        <p className="mb-2">Les coordonnées de l'Organisme de Formation sont les suivantes :</p>
        <ul className="list-disc pl-5 mb-2">
          <li><strong>Siège :</strong> 6 rue Webster, 62100 CALAIS, France</li>
          <li><strong>SIRET :</strong> 511 151 615 00016</li>
          <li><strong>Courriel :</strong> <a href={`mailto:${SITE_CONFIG.contactEmail}`} className="text-blue-500 hover:underline">{SITE_CONFIG.contactEmail}</a></li>
          <li><strong>Téléphone :</strong> <a href="tel:+33612195381" className="text-blue-500 hover:underline">+33 (0)6 12 19 53 81</a></li>
        </ul>
      </div>

      <div className="card mb-4">
        <h2>Article 2 : Objet et Champ d'application</h2>
        <p className="mb-2">Les présentes CGV définissent les conditions dans lesquelles le Prestataire s'engage à réaliser les formations proposées (en présentiel, en distanciel synchrone, ou en ligne/e-learning) à destination des particuliers, entreprises ou autres professionnels.</p>
        <p className="mb-2">Toute commande ou validation d'inscription implique l'acceptation sans réserve par le Client et son adhésion pleine et entière aux présentes CGV.</p>
      </div>

      <div className="card mb-4">
        <h2>Article 3 : Contractualisation</h2>
        <p className="mb-2"><strong>Pour les Entreprises (B2B) :</strong> Toute prestation de formation fait l'objet d'une <em>Convention de formation professionnelle continue</em> établie selon les dispositions légales en vigueur. La convention est retournée signée par le Client préalablement au début de la formation.</p>
        <p className="mb-2"><strong>Pour les Particuliers (B2C) :</strong> Un <em>Contrat de formation professionnelle</em> est établi. L'inscription n'est définitive qu'à compter de la signature de ce contrat par les deux parties et après expiration du délai de rétractation (le cas échéant).</p>
        <p className="mb-2"><strong>Pour les formations en ligne (e-learning auto-financées) :</strong> La validation de la commande en ligne via la plateforme et le paiement (Stripe, PayPal) valent conclusion du contrat d'achat de la prestation e-learning.</p>
      </div>

      <div className="card mb-4">
        <h2>Article 4 : Tarifs et Modalités de paiement</h2>
        <p className="mb-2">Les prix des formations sont indiqués en euros et ne sont pas assujettis à la TVA (TVA non applicable, article 293 B du CGI).</p>
        <ul className="list-disc pl-5 mb-2">
          <li><strong>Achat de formations en ligne :</strong> Le règlement est exigible intégralement à la commande. Les paiements s'effectuent par carte bancaire via les plateformes sécurisées Stripe ou PayPal.</li>
          <li><strong>Formations intra/inter-entreprises :</strong> Sauf accord contraire, le règlement s'effectue par virement bancaire ou chèque à réception de la facture, ou selon l'échéancier défini dans la convention de formation.</li>
        </ul>
        <p className="mb-2"><strong>Prise en charge OPCO / Pôle Emploi :</strong> Si le Client bénéficie d'un financement (sous réserve de certification Qualiopi via sous-traitance), il lui appartient de faire la demande de prise en charge avant le début de la formation. En cas de non-règlement par l'organisme financeur, le Client sera redevable de l'intégralité du coût de la formation.</p>
      </div>

      <div className="card mb-4">
        <h2>Article 5 : Droit de rétractation (Particuliers)</h2>
        <p className="mb-2">Conformément à l'article L6353-5 du Code du travail, dans le cadre d'un contrat de formation professionnelle, le Client particulier dispose d'un délai de <strong>14 jours</strong> à compter de la signature du contrat pour se rétracter par lettre recommandée avec avis de réception.</p>
        <p className="mb-2"><strong>Exception pour les contenus numériques (E-learning) :</strong> Le droit de rétractation ne s'applique pas si l'exécution de la formation en ligne a commencé (accès aux modules) avec l'accord préalable exprès du consommateur et renoncement exprès à son droit de rétractation (Article L221-28 du Code de la consommation).</p>
      </div>

      <div className="card mb-4">
        <h2>Article 6 : Annulation, Report ou Remplacement</h2>
        <p className="mb-2"><strong>Du fait du Client :</strong> Toute annulation doit faire l'objet d'une notification écrite.</p>
        <ul className="list-disc pl-5 mb-2">
          <li>Annulation intervenant plus de 14 jours avant le début de la formation : aucune pénalité.</li>
          <li>Annulation intervenant moins de 14 jours avant le début : le Prestataire se réserve le droit de facturer un dédit (voir conditions spécifiques dans la convention/contrat).</li>
        </ul>
        <p className="mb-2"><strong>Du fait de l'Organisme de formation :</strong> Le Prestataire se réserve le droit d'annuler ou de reporter une session de formation en cas de force majeure ou de nombre d'inscrits insuffisant. Les sommes versées seront alors intégralement remboursées sans autre indemnité.</p>
      </div>

      <div className="card mb-4">
        <h2>Article 7 : Propriété intellectuelle</h2>
        <p className="mb-2">Les supports de formation, documents, méthodes et outils pédagogiques mis à la disposition des Stagiaires sont la propriété exclusive de Thierry FREZARD EI. Toute reproduction, représentation, ou diffusion, en tout ou partie, à des tiers, est strictement interdite sans l'autorisation expresse du Prestataire.</p>
      </div>

      <div className="card mb-4">
        <h2>Article 8 : Confidentialité et Données Personnelles (RGPD)</h2>
        <p className="mb-2">Les informations à caractère personnel communiquées par le Client à {SITE_CONFIG.legalBusinessName} sont utiles pour le traitement de l'inscription ainsi que pour la constitution d'un fichier clientèle pour des prospections commerciales. Conformément à la loi Informatique et Libertés et au RGPD, le Client dispose d'un droit d'accès, de rectification et de suppression des données le concernant en écrivant à : <a href={`mailto:${SITE_CONFIG.contactEmail}`} className="text-blue-500 hover:underline">{SITE_CONFIG.contactEmail}</a>.</p>
      </div>

      <div className="card mb-4">
        <h2>Article 9 : Litiges et Médiation de la consommation</h2>
        <p className="mb-2">Les présentes CGV sont soumises à la loi française.</p>
        <p className="mb-2">
          En cas de litige entre le professionnel et le consommateur, ceux-ci s'efforceront de trouver une solution amiable. 
          À défaut d'accord amiable, le consommateur a la possibilité de saisir gratuitement le médiateur de la consommation dont relève le professionnel, à savoir :
        </p>
        <p className="mb-2"><strong>CM2C</strong></p>
        <p className="mb-2">49 rue de Ponthieu, 75 008 PARIS</p>
        <p className="mb-2">Tel : 01 89 47 00 14</p>
        <p className="mb-2">Site internet : <a href="https://www.cm2c.net/declarer-un-litige.php" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">https://www.cm2c.net/declarer-un-litige.php</a></p>
        <p className="mb-2">Courriel : <a href="mailto:litiges@cm2c.net" className="text-blue-500 hover:underline">litiges@cm2c.net</a></p>
        <p className="mb-2">À défaut de résolution amiable, tout litige relèvera de la compétence des tribunaux compétents du siège social de Thierry FREZARD EI (sauf disposition légale contraire en matière de droit de la consommation).</p>
      </div>
    </div>
    </>
  );
}
