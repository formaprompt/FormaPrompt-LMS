import SEO from '../components/SEO';
import LegalDocument from '../components/LegalDocument';
import { SITE_CONFIG } from '../config/site';

export default function InternalRules() {
  return (
    <>
      <SEO
        title="Règlement intérieur des stagiaires – FormaPrompt"
        description="Règlement intérieur applicable aux stagiaires FormaPrompt."
        url={`${SITE_CONFIG.baseUrl}/reglement-interieur`}
      />
      <LegalDocument>
        <h1>Règlement intérieur des stagiaires</h1>
        <p className="legal-document__meta">Version 2026-08-12 — applicable à compter de sa communication au stagiaire</p>

        <h2>1. Objet et champ</h2>
        <p>Ce règlement fixe les principales règles de santé, de sécurité et de discipline applicables aux stagiaires accueillis par Thierry FREZARD EI — FormaPrompt, en présentiel, en classe virtuelle, à distance et dans l’espace apprenant.</p>
        <p>Lorsque la formation a lieu dans un établissement doté de son propre règlement, les règles de santé et de sécurité de cet établissement s’appliquent.</p>

        <h2>2. Sécurité et déroulement</h2>
        <p>Le stagiaire respecte les consignes de sécurité, d’évacuation et d’utilisation des équipements. Il signale sans délai un accident, un danger ou un dysfonctionnement sérieux. Il respecte les horaires, modalités de connexion, pauses et consignes pédagogiques communiqués.</p>
        <p>Un handicap, une difficulté technique, un problème de santé ou un besoin d’adaptation fait l’objet d’un examen individualisé et ne constitue pas en lui-même une faute disciplinaire.</p>

        <h2>3. Respect des personnes</h2>
        <p>Les échanges doivent rester respectueux. Les violences, menaces, intimidations, harcèlements, agissements sexistes, discriminations, propos racistes, antisémites ou xénophobes, humiliations et attaques personnelles sont incompatibles avec la formation.</p>
        <p>Tout signalement est examiné de manière factuelle, avec confidentialité dans la limite des besoins de l’instruction, respect du contradictoire et protection contre les représailles.</p>

        <h2>4. Outils numériques et espace apprenant</h2>
        <p>Les identifiants sont personnels. Il est interdit de transmettre son compte, d’accéder aux données d’un tiers, de contourner une mesure de sécurité, d’introduire un code malveillant ou d’extraire massivement des ressources.</p>
        <p>Une classe virtuelle, l’image, la voix ou les travaux d’une personne ne sont pas enregistrés ou diffusés sans information et base légitime. Les exercices utilisant un service d’intelligence artificielle doivent employer des données fictives, anonymisées ou généralisées.</p>

        <h2>5. Propriété des ressources et travaux</h2>
        <p>Les ressources sont utilisées dans les limites de la licence communiquée. Le stagiaire conserve ses droits sur ses productions originales, sous réserve des éléments FormaPrompt ou de tiers incorporés. Toute publication nominative requiert l’autorisation nécessaire.</p>

        <h2>6. Signalement et mesure conservatoire</h2>
        <p>Un incident peut être signalé à <a href={`mailto:${SITE_CONFIG.contactEmail}`}>{SITE_CONFIG.contactEmail}</a> en décrivant les faits utiles. Une suspension conservatoire peut être décidée pour protéger les personnes, les données ou la session. Elle est temporaire, reliée à l’incident et ne préjuge pas de la décision finale.</p>

        <h2>7. Discipline et droits du stagiaire</h2>
        <p>Aucune sanction pécuniaire n’est prononcée. Une décision disciplinaire est humaine, individualisée et proportionnée ; elle n’est pas automatiquement progressive. Elle reste distincte de sa conséquence technique éventuelle sur le droit d’accès.</p>
        <p>Le stagiaire est informé des griefs. Lorsque la mesure envisagée affecte sa présence ou la continuité de sa formation, il reçoit une convocation, peut être assisté, présente ses observations et reçoit une décision écrite et motivée dans les délais applicables.</p>
        <p>Le système FormaPrompt conserve séparément l’incident, l’instruction, l’entretien éventuel, la décision, la conséquence sur l’accès et le journal des actions administratives.</p>

        <h2>8. Employeur et financeur</h2>
        <p>Lorsqu’une sanction est prononcée, l’employeur et le financeur sont informés dans les cas prévus par les textes, en limitant les informations au nécessaire.</p>

        <h2>9. Communication et version</h2>
        <p>Le présent règlement est porté à la connaissance des bénéficiaires avant leur inscription définitive et reste accessible sur le site. La version applicable est celle communiquée au stagiaire pour la formation concernée.</p>
      </LegalDocument>
    </>
  );
}
