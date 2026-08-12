import SEO from '../components/SEO';
import LegalDocument from '../components/LegalDocument';
import { SITE_CONFIG } from '../config/site';
import { FORMAPROMPT_TAX } from '../../supabase/functions/_shared/legalBusiness.js';

const contact = <a href={`mailto:${SITE_CONFIG.contactEmail}`}>{SITE_CONFIG.contactEmail}</a>;

export default function CGVConsumer() {
  return (
    <>
      <SEO
        title="CGV particuliers – FormaPrompt"
        description="Conditions générales de vente FormaPrompt applicables aux consommateurs."
        url={`${SITE_CONFIG.baseUrl}/cgv-particuliers`}
      />
      <LegalDocument>
        <h1>Conditions générales de vente — particuliers</h1>
        <p className="legal-document__meta">CGV B2C — version 2026-08-12</p>

        <h2>1. Identité de FormaPrompt</h2>
        <p><strong>Thierry FREZARD EI</strong>, exploitant FormaPrompt, 6 rue Webster, 62100 Calais, France — SIREN 511 151 615 — SIRET 511 151 615 00016 — déclaration d’activité n° 32620346362 auprès du préfet de région Hauts-de-France. Cet enregistrement ne vaut pas agrément de l’État.</p>
        <p>Contact : {contact} — +33 (0)6 12 19 53 81.</p>
        <p>FormaPrompt est assuré en responsabilité civile professionnelle auprès de WAKAM par l’intermédiaire de Simplis pour son activité de formation. L’attestation contrôlée est valable du 18 avril 2026 au 17 avril 2027, sous réserve du maintien du contrat.</p>

        <h2>2. Champ d’application</h2>
        <p>Ces CGV s’appliquent aux personnes physiques qui commandent à distance à des fins étrangères à leur activité professionnelle. Elles ne s’appliquent pas aux entreprises, organismes de formation ou autres clients professionnels.</p>
        <p>Lorsqu’une personne entreprend une formation professionnelle à titre individuel et à ses frais dans le champ de l’article L6353-3 du Code du travail, un contrat individuel écrit distinct complète ces CGV. Ce parcours contractuel ne peut pas être remplacé par une acceptation générique dans Stripe Checkout.</p>

        <h2>3. Nature des prestations</h2>
        <p>Les formations FormaPrompt peuvent associer un accès à l’espace apprenant, des ressources numériques, des exercices, des évaluations, des corrections, du tutorat, une classe virtuelle ou une séance en présentiel. Une formation mixte n’est pas automatiquement qualifiée dans son ensemble de contenu numérique sans support matériel.</p>
        <p className="legal-document__callout">Sauf condition particulière indiquée lors de la commande, l’accès aux contenus LMS acquis est accordé sans limitation de durée prédéfinie. Il comprend les mises à jour que FormaPrompt met à disposition pour la formation concernée, tant que le service FormaPrompt et cette formation demeurent exploités.</p>
        <p>Cette formulation ne constitue pas une garantie absolue ou perpétuelle. Les séances, corrections et accompagnements limités dans le temps conservent la durée indiquée dans l’offre.</p>

        <h2>4. Information précontractuelle et commande</h2>
        <p>Avant la commande, le client doit disposer des caractéristiques essentielles de la formation, du prix total, des modalités d’exécution et de paiement, de la date ou du délai d’exécution, des présentes CGV, du règlement intérieur et des informations relatives à la rétractation. Le dernier bouton de commande doit indiquer sans ambiguïté l’obligation de paiement.</p>
        <p>L’acceptation des CGV, la demande de commencement anticipé d’un service et les accords éventuellement nécessaires pour une composante qualifiée de contenu numérique sont des actions distinctes. Aucune case ne doit être précochée.</p>

        <h2>5. Prix et paiement</h2>
        <p>Les prix sont indiqués en euros. Situation fiscale actuelle : <strong>{FORMAPROMPT_TAX.statement}</strong>. Le prix total est présenté avant la commande. Les paiements directs en ligne sont traités par Stripe. FormaPrompt ne reçoit ni ne conserve le numéro complet de la carte.</p>
        <h3>Contrat individuel de formation professionnelle</h3>
        <p>Lorsqu’un contrat relève des articles L6353-3 et suivants du Code du travail, aucune somme ne peut être exigée avant l’expiration du délai de dix jours. À son expiration, le paiement ne peut dépasser 30 % du prix convenu ; le solde est échelonné au fur et à mesure du déroulement de la formation.</p>

        <h2>6. Rétractation</h2>
        <h3>Contrat conclu à distance avec un consommateur</h3>
        <p>Lorsque le Code de la consommation s’applique, le consommateur dispose en principe de quatorze jours à compter de la conclusion du contrat pour se rétracter, sans avoir à motiver sa décision. Il peut écrire à {contact} ou adresser une déclaration dénuée d’ambiguïté à l’adresse de FormaPrompt.</p>
        <p>La fonctionnalité électronique <a href="/retractation">« Renoncer au contrat ici »</a> permet d’identifier le contrat, d’enregistrer la déclaration avec un horodatage serveur et de télécharger immédiatement un accusé durable.</p>
        <h3>Contrat individuel de formation professionnelle</h3>
        <p>Lorsque l’article L6353-5 du Code du travail s’applique, le stagiaire dispose également de dix jours à compter de la signature du contrat pour se rétracter par lettre recommandée avec avis de réception. Le délai de quatorze jours ne remplace pas automatiquement ce régime spécifique lorsque les deux sont applicables.</p>
        <h3>Commencement avant la fin du délai</h3>
        <p>Le commencement anticipé d’un service exige une demande expresse. Il ne fait pas perdre à lui seul le droit de rétractation. Les conditions propres à une éventuelle composante de contenu numérique doivent être identifiées et recueillies séparément pour l’offre concernée.</p>

        <h2>7. Annulation, report et interruption</h2>
        <p>Une annulation avant formation, une non-présentation, un abandon et une interruption sont traités séparément. Aucun barème ne prive le client d’un droit légal de rétractation ni des dispositions impératives applicables. Les conditions propres à l’offre figurent dans les conditions particulières communiquées avant l’engagement.</p>
        <p>Si FormaPrompt ne peut exécuter la prestation, il informe le client et propose un report accepté ou le remboursement des prestations non exécutées, sans préjudice des droits légaux.</p>

        <h2>8. Espace apprenant et discipline</h2>
        <p>Le compte et les accès sont personnels. Une mesure conservatoire temporaire est distincte d’une sanction définitive. Un incident disciplinaire ne déclenche pas automatiquement une suppression technique : l’apprenant est informé des griefs, peut présenter ses observations et la décision humaine est tracée.</p>

        <h2>9. Propriété intellectuelle et données personnelles</h2>
        <p>Les ressources sont réservées à l’usage personnel du bénéficiaire. Leur reproduction, diffusion ou mise à disposition de tiers est interdite sauf autorisation ou exception légale.</p>
        <p>Les traitements nécessaires à la commande, au paiement et au suivi de la formation sont décrits dans la <a href="/politique-confidentialite">politique de confidentialité</a>.</p>

        <h2>10. Réclamations et médiation</h2>
        <p>Toute réclamation peut être adressée à {contact} ou à l’adresse postale de FormaPrompt. Après une réclamation écrite préalable restée sans solution satisfaisante, le consommateur peut saisir gratuitement :</p>
        <p><strong>CM2C — Centre de la Médiation de la Consommation de Conciliateurs de Justice</strong><br />49 rue de Ponthieu, 75008 Paris<br />Téléphone : 01 89 47 00 14<br /><a href="https://www.cm2c.net/" target="_blank" rel="noopener noreferrer">www.cm2c.net</a></p>
        <p>L’adhésion FormaPrompt est valable jusqu’au 21 juillet 2028.</p>

        <h2>11. Droit applicable</h2>
        <p>Les présentes conditions sont soumises au droit français sans priver le consommateur des dispositions impératives qui lui sont applicables. Les juridictions compétentes sont déterminées selon les règles légales.</p>
      </LegalDocument>
    </>
  );
}
