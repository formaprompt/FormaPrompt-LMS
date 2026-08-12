import SEO from '../components/SEO';
import LegalDocument from '../components/LegalDocument';
import { SITE_CONFIG } from '../config/site';
import { FORMAPROMPT_TAX } from '../../supabase/functions/_shared/legalBusiness.js';

export default function PrecontractualInformation() {
  return (
    <>
      <SEO
        title="Informations précontractuelles – FormaPrompt"
        description="Informations à vérifier avant de commander ou signer une formation FormaPrompt."
        url={`${SITE_CONFIG.baseUrl}/informations-precontractuelles`}
      />
      <LegalDocument>
        <h1>Informations précontractuelles</h1>
        <p className="legal-document__meta">Version 2026-08-12 — cadre général à compléter par la fiche de chaque formation</p>
        <p>Avant de commander ou de signer, vérifiez la fiche de la formation et les conditions adaptées à votre situation.</p>

        <h2>1. Formation et bénéficiaire</h2>
        <ul>
          <li>intitulé, version et référence de l’offre ;</li>
          <li>identité du bénéficiaire, de l’acheteur et du financeur éventuel ;</li>
          <li>public visé, prérequis et besoins d’accessibilité ;</li>
          <li>objectifs, programme, durée et modalités pédagogiques ;</li>
          <li>positionnement, évaluations et documents remis en fin de formation.</li>
        </ul>

        <h2>2. Organisation</h2>
        <ul>
          <li>dates, horaires ou modalités de planification ;</li>
          <li>présentiel, classe virtuelle avec Google Meet ou Microsoft Teams, LMS ou parcours mixte ;</li>
          <li>moyens techniques requis, assistance et coordonnées de contact ;</li>
          <li>durée des séances, corrections et accompagnements limités dans le temps.</li>
        </ul>

        <h2>3. Accès à l’espace apprenant</h2>
        <p className="legal-document__callout">Sauf condition particulière indiquée lors de la commande, l’accès aux contenus LMS acquis est accordé sans limitation de durée prédéfinie. Il comprend les mises à jour que FormaPrompt met à disposition pour la formation concernée, tant que le service FormaPrompt et cette formation demeurent exploités.</p>
        <p>Cette règle ne constitue pas une garantie absolue ou perpétuelle et ne supprime pas les contrôles liés au statut de l’accès, à la sécurité, à une suspension ou à une révocation justifiée.</p>

        <h2>4. Prix, financement et documents</h2>
        <p>Le prix total, les échéances, le montant financé, le reste à charge et le débiteur doivent être indiqués avant l’engagement. Situation fiscale actuelle : <strong>{FORMAPROMPT_TAX.statement}</strong>. Selon la situation, les documents comprennent le devis, la convention, le contrat individuel, les CGV applicables, le règlement intérieur et la politique de confidentialité.</p>

        <h2>5. Rétractation et commencement</h2>
        <p>Pour un contrat à distance avec un consommateur, le délai de quatorze jours est présenté lorsqu’il s’applique. Pour un contrat individuel relevant de l’article L6353-3 du Code du travail, le délai spécifique de dix jours et ses règles de paiement sont indiqués séparément. L’un ne remplace pas automatiquement l’autre.</p>
        <p>Une demande de commencement anticipé d’un service et les accords éventuellement nécessaires pour une composante qualifiée de contenu numérique doivent être recueillis séparément, sans case précochée.</p>

        <h2>6. Documents à consulter</h2>
        <ul>
          <li><a href="/cgv-particuliers">CGV particuliers</a> ou <a href="/cgv-professionnels">CGV professionnels</a> ;</li>
          <li><a href="/reglement-interieur">règlement intérieur</a> ;</li>
          <li><a href="/politique-confidentialite">politique de confidentialité</a> ;</li>
          <li>conditions particulières et programme de la formation.</li>
        </ul>
      </LegalDocument>
    </>
  );
}
