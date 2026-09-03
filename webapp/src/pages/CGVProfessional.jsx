import SEO from '../components/SEO';
import LegalDocument from '../components/LegalDocument';
import { SITE_CONFIG } from '../config/site';
import { FORMAPROMPT_TAX } from '../../supabase/functions/_shared/legalBusiness.js';

export default function CGVProfessional() {
  return (
    <>
      <SEO
        title="CGV professionnels – FormaPrompt"
        description="Conditions générales de vente FormaPrompt applicables aux entreprises et organismes professionnels."
        url={`${SITE_CONFIG.baseUrl}/cgv-professionnels`}
      />
      <LegalDocument>
        <h1>Conditions générales de vente — professionnels</h1>
        <p className="legal-document__meta">CGV B2B — version 2026-08-26</p>

        <h2>1. Prestataire et champ d’application</h2>
        <p><strong>Thierry FREZARD EI — FormaPrompt</strong>, 6 rue Webster, 62100 Calais — SIREN 511 151 615 — SIRET 511 151 615 00016 — déclaration d’activité n° 32620346362 auprès du préfet de région Hauts-de-France. Cet enregistrement ne vaut pas agrément de l’État. Contact : <a href={`mailto:${SITE_CONFIG.contactEmail}`}>{SITE_CONFIG.contactEmail}</a>.</p>
        <p>Ces conditions concernent les entreprises, personnes morales, organismes de formation et autres professionnels agissant pour leur activité. Le client contractuel, le payeur et le bénéficiaire peuvent être différents et sont identifiés dans les documents contractuels.</p>

        <h2>2. Documents contractuels</h2>
        <p>La commande est formée par l’acceptation du devis ou du bon de commande et, lorsqu’elle est requise, par la signature d’une convention de formation ou d’un contrat de sous-traitance. Les conditions particulières priment sur les présentes CGV, puis viennent la convention, les CGV et les annexes intégrées au contrat.</p>
        <h3>Diagnostic IA Express</h3>
        <p>Par exception aux dispositions relatives au devis, à la convention et au paiement différé, le Diagnostic IA Express peut être commandé directement en ligne. Cette exception ne modifie pas les modalités de commande ou de paiement applicables aux autres formations et prestations FormaPrompt.</p>
        <p>Le Diagnostic IA Express est une prestation ponctuelle de conseil et de diagnostic, réalisée principalement en visioconférence pendant 90 minutes. Elle analyse la situation, le métier ou les activités du client, ses tâches, ses outils, ses contraintes et ses objectifs afin d’identifier des opportunités d’utilisation de l’intelligence artificielle adaptées à son contexte.</p>
        <p>La prestation comprend notamment l’identification de trois opportunités prioritaires, une appréciation indicative de leur impact, de leur difficulté, de leur coût et de leurs risques, ainsi que la remise d’un Plan d’action IA FormaPrompt personnalisé. Elle ne comprend pas le développement complet d’un agent, l’installation complète de n8n, la réalisation complète d’une automatisation, la formation d’une équipe, un audit informatique complet, un audit juridique ou RGPD complet, ni un développement logiciel sur mesure.</p>

        <h2>3. Informations sur les bénéficiaires</h2>
        <p>Le client transmet uniquement les informations nécessaires à l’inscription, à l’organisation et au suivi. Il informe les bénéficiaires de cette transmission et leur remet les informations, le règlement intérieur et la politique de confidentialité fournis par FormaPrompt.</p>

        <h2>4. Prix, facturation et financement</h2>
        <p>Les prix et les échéances figurent dans le devis ou la convention. Situation fiscale actuelle : <strong>{FORMAPROMPT_TAX.statement}</strong>. Sauf condition particulière, les factures sont payables à trente jours. Les pénalités de retard et l’indemnité forfaitaire de 40 euros pour frais de recouvrement s’appliquent dans les conditions légales aux clients professionnels.</p>
        <p>Lorsqu’un financement est envisagé, le prix total, le montant financé, le reste à charge et le débiteur réel doivent être identifiés. La subrogation ou le paiement direct n’est appliqué que s’il est expressément accepté.</p>
        <h3>Diagnostic IA Express</h3>
        <p>Le prix total du Diagnostic IA Express est de <strong>149 €</strong>. Situation fiscale actuelle : <strong>{FORMAPROMPT_TAX.statement}</strong>. Le paiement est intégralement exigible lors de la commande en ligne. La commande est confirmée après confirmation effective du paiement par Stripe et par le système FormaPrompt.</p>
        <p>Après confirmation du paiement, le client choisit son créneau parmi les disponibilités proposées.</p>

        <h2>5. Planification et accès</h2>
        <p className="legal-document__callout">Sauf condition particulière indiquée lors de la commande, l’accès aux contenus LMS acquis est accordé sans limitation de durée prédéfinie. Il comprend les mises à jour que FormaPrompt met à disposition pour la formation concernée, tant que le service FormaPrompt et cette formation demeurent exploités.</p>
        <p>Les accès sont personnels. Les séances, corrections et accompagnements limités dans le temps conservent la durée prévue au contrat. Cette règle n’est pas une garantie absolue ou perpétuelle et ne neutralise pas une suspension, une révocation ou une cessation légalement ou contractuellement fondée.</p>

        <h2>6. Annulation, interruption et report</h2>
        <p>Toute annulation est transmise par écrit. Son traitement dépend des conditions particulières, des prestations exécutées et, le cas échéant, des règles du financeur. Aucun montant de 100 % n’est automatiquement exigible dans toutes les situations.</p>
        <h3>Diagnostic IA Express</h3>
        <p>Jusqu’à 24 heures avant l’heure prévue du rendez-vous, le client peut annuler sans frais et obtenir le remboursement intégral du prix payé, ou reporter sans frais son rendez-vous vers un créneau disponible.</p>
        <p>À moins de 24 heures de l’heure prévue du rendez-vous, le paiement reste acquis à FormaPrompt. Un report exceptionnel unique peut être accordé si le client prévient FormaPrompt avant l’heure prévue du rendez-vous. Cette possibilité ne constitue pas un droit à plusieurs reports.</p>
        <p>En cas d’absence sans information préalable avant l’heure prévue du rendez-vous, le paiement reste acquis et aucun report automatique n’est dû. FormaPrompt conserve la faculté d’accorder exceptionnellement un nouveau rendez-vous lorsqu’une situation particulière le justifie. Cette faculté commerciale discrétionnaire ne constitue pas un droit contractuel du client.</p>
        <p>Ces règles s’appliquent sous réserve des dispositions légales impératives éventuellement applicables.</p>
        <p>En cas d’impossibilité d’exécution, FormaPrompt informe le client et propose un report. Sans accord, les prestations non exécutées ne sont pas facturées ou sont remboursées si elles ont été payées.</p>

        <h2>7. Discipline</h2>
        <p>Les bénéficiaires sont soumis au règlement intérieur. Une mesure conservatoire temporaire ne constitue pas une sanction définitive. Toute sanction susceptible d’affecter la présence ou la continuité de la formation respecte la procédure disciplinaire et reste distincte de sa conséquence technique sur l’accès.</p>

        <h2>8. Confidentialité, propriété intellectuelle et données</h2>
        <p>Chaque partie protège les informations confidentielles reçues. Les ressources FormaPrompt sont réservées à l’utilisation prévue au contrat et ne peuvent être transmises à un tiers sans autorisation.</p>
        <p>Les rôles et responsabilités concernant les données des bénéficiaires sont précisés dans la convention lorsque cela est nécessaire. Les informations générales figurent dans la <a href="/politique-confidentialite">politique de confidentialité</a>.</p>

        <h2>9. Responsabilité et différends</h2>
        <p>FormaPrompt exécute les prestations convenues avec diligence. Les objectifs pédagogiques ne constituent pas une garantie de résultat professionnel, commercial ou financier. Les parties recherchent une solution amiable avant toute action. Le droit français s’applique et les règles légales déterminent la juridiction compétente sauf clause particulière valablement convenue.</p>
        <p>Les éventuelles dispositions impératives du Code de la consommation rendues applicables à certains contrats conclus entre professionnels demeurent réservées.</p>
      </LegalDocument>
    </>
  );
}
