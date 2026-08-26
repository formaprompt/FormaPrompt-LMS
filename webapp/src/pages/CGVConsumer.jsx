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
        <p className="legal-document__meta">CGV B2C — version 2026-08-26</p>

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
        <h3>Diagnostic IA Express</h3>
        <p>Le Diagnostic IA Express est une prestation ponctuelle de conseil et de diagnostic, réalisée principalement en visioconférence pendant 90 minutes. Elle analyse la situation, le métier ou les activités du client, ses tâches, ses outils, ses contraintes et ses objectifs afin d’identifier des opportunités d’utilisation de l’intelligence artificielle adaptées à son contexte.</p>
        <p>La prestation comprend notamment l’identification de trois opportunités prioritaires, une appréciation indicative de leur impact, de leur difficulté, de leur coût et de leurs risques, ainsi que la remise d’un Plan d’action IA FormaPrompt personnalisé.</p>
        <p>Elle ne comprend pas le développement complet d’un agent, l’installation complète de n8n, la réalisation complète d’une automatisation, la formation d’une équipe, un audit informatique complet, un audit juridique ou RGPD complet, ni un développement logiciel sur mesure.</p>

        <h2>4. Information précontractuelle et commande</h2>
        <p>Avant la commande, le client doit disposer des caractéristiques essentielles de la formation, du prix total, des modalités d’exécution et de paiement, de la date ou du délai d’exécution, des présentes CGV, du règlement intérieur et des informations relatives à la rétractation. Le dernier bouton de commande doit indiquer sans ambiguïté l’obligation de paiement.</p>
        <p>L’acceptation des CGV, la demande de commencement anticipé d’un service et les accords éventuellement nécessaires pour une composante qualifiée de contenu numérique sont des actions distinctes. Aucune case ne doit être précochée.</p>

        <h2>5. Prix et paiement</h2>
        <p>Les prix sont indiqués en euros. Situation fiscale actuelle : <strong>{FORMAPROMPT_TAX.statement}</strong>. Le prix total est présenté avant la commande. Les paiements directs en ligne sont traités par Stripe. FormaPrompt ne reçoit ni ne conserve le numéro complet de la carte.</p>
        <h3>Diagnostic IA Express</h3>
        <p>Le prix total du Diagnostic IA Express est de <strong>149 €</strong>. Il est payé intégralement lors de la commande en ligne. La commande n’est confirmée qu’après confirmation effective du paiement par Stripe et par le système FormaPrompt.</p>
        <p>Après confirmation du paiement, le client choisit son créneau parmi les disponibilités proposées. Le paiement ne fixe pas, à lui seul, la date du rendez-vous. La réservation d’un créneau ne vaut ni demande automatique d’exécution anticipée ni renonciation au droit légal de rétractation.</p>
        <h3>Contrat individuel de formation professionnelle</h3>
        <p>Lorsqu’un contrat relève des articles L6353-3 et suivants du Code du travail, aucune somme ne peut être exigée avant l’expiration du délai de dix jours. À son expiration, le paiement ne peut dépasser 30 % du prix convenu ; le solde est échelonné au fur et à mesure du déroulement de la formation.</p>

        <h2>6. Rétractation</h2>
        <h3>Contrat conclu à distance avec un consommateur</h3>
        <p>Lorsque le Code de la consommation s’applique, le consommateur dispose en principe de quatorze jours à compter de la conclusion du contrat pour se rétracter, sans avoir à motiver sa décision. Il peut écrire à {contact} ou adresser une déclaration dénuée d’ambiguïté à l’adresse de FormaPrompt.</p>
        <p>La fonctionnalité électronique <a href="/retractation">« Renoncer au contrat ici »</a> permet d’identifier le contrat, d’enregistrer la déclaration avec un horodatage serveur et de télécharger immédiatement un accusé durable.</p>
        <p>Pour le Diagnostic IA Express commandé en ligne, le contrat est conclu lorsque le paiement est confirmé et que la commande est enregistrée par FormaPrompt. Les règles commerciales d’annulation et de report sont distinctes du droit légal de rétractation et s’appliquent sans préjudice de celui-ci.</p>
        <h3>Contrat individuel de formation professionnelle</h3>
        <p>Lorsque l’article L6353-5 du Code du travail s’applique, le stagiaire dispose également de dix jours à compter de la signature du contrat pour se rétracter par lettre recommandée avec avis de réception. Le délai de quatorze jours ne remplace pas automatiquement ce régime spécifique lorsque les deux sont applicables.</p>
        <h3>Commencement avant la fin du délai</h3>
        <p>Le commencement anticipé d’un service exige une demande expresse. Il ne fait pas perdre à lui seul le droit de rétractation. Les conditions propres à une éventuelle composante de contenu numérique doivent être identifiées et recueillies séparément pour l’offre concernée.</p>
        <h3>Commencement anticipé du Diagnostic IA Express</h3>
        <p>Lorsque le client choisit un créneau impliquant que l’exécution du Diagnostic IA Express commence avant l’expiration de son délai légal de rétractation, FormaPrompt recueille, au moment de la réservation et avant tout commencement d’exécution, sa demande expresse de commencement anticipé.</p>
        <p>Le client reconnaît séparément qu’il perdra son droit de rétractation lorsque la prestation aura été entièrement exécutée, à condition que son exécution ait commencé avec sa demande expresse préalable. S’il ne souhaite pas demander le commencement anticipé, il peut choisir un créneau permettant à la prestation de commencer après l’expiration de son délai de rétractation. La simple réservation d’un créneau ne supprime pas automatiquement ce droit.</p>
        <p>Le questionnaire préparatoire peut être enregistré avant le rendez-vous. Son simple enregistrement ne déclenche aucune analyse automatisée ou humaine destinée au Diagnostic IA Express. Aucune analyse individualisée ne commence avant que l’exécution de la prestation soit juridiquement autorisée.</p>
        <h3>Rétractation après commencement d’exécution</h3>
        <p>Lorsque le client exerce son droit de rétractation après avoir expressément demandé le commencement de la prestation avant la fin du délai de rétractation, mais avant son exécution complète, il verse à FormaPrompt un montant correspondant aux services effectivement fournis jusqu’à la communication de sa décision. Ce montant est proportionné au prix total convenu et à la part de la prestation effectivement réalisée.</p>
        <p>Aucun montant correspondant à une exécution anticipée ne peut être exigé lorsque les informations ou la demande expresse prévues par la loi n’ont pas été correctement recueillies.</p>
        <h3>Exécution complète du Diagnostic IA Express</h3>
        <p>Le Diagnostic IA Express est entièrement exécuté lorsque le rendez-vous de 90 minutes a été réalisé et que le Plan d’action IA FormaPrompt personnalisé a été remis.</p>

        <h2>7. Annulation, report et interruption</h2>
        <p>Une annulation avant formation, une non-présentation, un abandon et une interruption sont traités séparément. Aucun barème ne prive le client d’un droit légal de rétractation ni des dispositions impératives applicables. Les conditions propres à l’offre figurent dans les conditions particulières communiquées avant l’engagement.</p>
        <h3>Diagnostic IA Express</h3>
        <p>Jusqu’à 24 heures avant l’heure prévue du rendez-vous, le client peut annuler sans frais et obtenir le remboursement intégral du prix payé, ou reporter sans frais son rendez-vous vers un créneau disponible.</p>
        <p>À moins de 24 heures de l’heure prévue du rendez-vous, le paiement reste acquis à FormaPrompt. Un report exceptionnel unique peut toutefois être accordé lorsque le client prévient FormaPrompt avant l’heure prévue du rendez-vous. Cette possibilité ne constitue pas un droit à plusieurs reports.</p>
        <p>En cas d’absence sans information préalable avant l’heure prévue du rendez-vous, le paiement reste acquis et aucun report automatique n’est dû. FormaPrompt peut exceptionnellement proposer un nouveau rendez-vous lorsqu’une situation particulière le justifie. Cette faculté commerciale discrétionnaire ne constitue pas un droit contractuel du client.</p>
        <p>Ces règles s’appliquent sans préjudice du droit légal de rétractation et des autres dispositions légales impératives applicables.</p>
        <p>Si FormaPrompt ne peut exécuter la prestation, il informe le client et propose un report accepté ou le remboursement des prestations non exécutées, sans préjudice des droits légaux.</p>
        <p>Lorsqu’un remboursement est dû en application des présentes conditions ou de la loi, il est effectué, sauf accord exprès contraire du client, au moyen du mode de paiement utilisé lors de la commande. Les remboursements résultant de l’exercice valable du droit de rétractation sont réalisés dans les délais légaux.</p>

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
