import SEO from '../components/SEO';
import LegalDocument from '../components/LegalDocument';
import { SITE_CONFIG } from '../config/site';
import { STUDIO_PRIVACY_COPY } from '../config/studioPrivacy';

export default function Privacy() {
  return (
    <>
      <SEO
        title="Politique de confidentialité – FormaPrompt"
        description="Traitements de données personnelles réalisés par FormaPrompt pour le site, les comptes et les formations."
        url={`${SITE_CONFIG.baseUrl}/politique-confidentialite`}
      />
      <LegalDocument>
        <h1>Politique de confidentialité</h1>
        <p className="legal-document__meta">Version 2026-08-12</p>

        <h2>1. Responsable du traitement</h2>
        <p><strong>Thierry FREZARD EI — FormaPrompt</strong>, 6 rue Webster, 62100 Calais, France. Pour toute question ou demande relative à vos droits : <a href={`mailto:${SITE_CONFIG.contactEmail}`}>{SITE_CONFIG.contactEmail}</a>.</p>
        <p>FormaPrompt limite les données aux besoins du service, ne les vend pas et réserve leur accès aux personnes et prestataires habilités. La consultation de cette politique ou la poursuite de la navigation ne vaut pas consentement.</p>

        <h2>2. Site, contact et compte</h2>
        <h3>Navigation, hébergement et sécurité</h3>
        <p>Les requêtes, données techniques, journaux d’erreur et informations de sécurité nécessaires au fonctionnement du site peuvent être traités par FormaPrompt, IONOS et Supabase afin de servir le site, prévenir les abus et diagnostiquer les incidents.</p>
        <h3>Compte et authentification</h3>
        <p>Supabase Auth traite notamment l’adresse électronique, l’identifiant, le rôle et les événements de connexion pour créer et sécuriser le compte, permettre sa récupération et appliquer les droits d’accès. Les informations techniques de session sont conservées dans le navigateur pour maintenir la connexion.</p>
        <h3>Contact et réclamations</h3>
        <p>Le nom, l’adresse électronique, l’objet, le message et les échanges sont utilisés pour répondre, préparer une proposition et suivre une réclamation.</p>

        <h2>3. Commandes et formations</h2>
        <h3>Commandes et paiements</h3>
        <p>FormaPrompt traite l’utilisateur, la formation, le montant, le statut et les identifiants techniques Stripe nécessaires au rapprochement du paiement. Stripe traite directement les données de carte, d’authentification et de prévention de la fraude. FormaPrompt ne conserve pas le numéro complet de la carte.</p>
        <h3>Administration OF, entreprise ou OPCO</h3>
        <p>Selon le dossier, FormaPrompt traite l’identité, les coordonnées, l’organisme, le financeur, les références de prise en charge, les dates, modalités, prix, notes strictement nécessaires et documents contractuels afin d’inscrire le bénéficiaire, organiser la prestation, gérer le financement et produire les documents administratifs.</p>
        <h3>Positionnement, progression et évaluations</h3>
        <p>Les réponses, scores, niveaux, modules consultés, dates de progression, exercices, projets, évaluations, corrections et échanges pédagogiques permettent d’adapter le parcours, d’accompagner l’apprenant, d’évaluer les acquis et de justifier la réalisation.</p>
        <h3>Présence, documents et satisfaction</h3>
        <p>Les séances, heures, confirmations, signatures dessinées, journaux de correction, attestations et documents de fin de formation servent à établir la présence et les preuves de formation. Les réponses de satisfaction servent à améliorer les prestations. Un témoignage nominatif ou public nécessite une autorisation distincte lorsque celle-ci est requise.</p>

        <h2>4. Classes virtuelles</h2>
        <p>FormaPrompt utilise <strong>Google Meet</strong> et <strong>Microsoft Teams</strong>. Le service retenu est indiqué dans la convocation ou les informations de séance. Les identifiants de réunion, horaires, métadonnées de connexion et flux audio, vidéo ou de partage nécessaires à la séance peuvent être traités par le fournisseur concerné.</p>
        <p>Aucun enregistrement, aucune transcription et aucune prise de notes automatisée ne sont présumés. Une future captation constituerait un traitement distinct nécessitant une information préalable, une finalité, une base juridique, des accès et une durée propres.</p>

        <h2>5. Incidents, discipline et journal d’audit</h2>
        <p>FormaPrompt traite les signalements disciplinaires : faits, personnes concernées, mesures conservatoires, convocations, observations, décisions et conséquences sur les accès. Ces informations sont réservées aux administrateurs habilités et ne sont pas accessibles aux autres apprenants.</p>
        <p>Le journal d’audit conserve les actions administratives sensibles, leur auteur, leur cible, leur motif et les états avant/après. Il est protégé contre les modifications et suppressions ordinaires, sans être présenté comme infalsifiable.</p>
        <p>Les pièces disciplinaires ne sont pas téléversées dans le service actuel. Toute ouverture future d’un stockage documentaire privé fera l’objet d’une information et de règles d’accès et de conservation adaptées.</p>

        <h2>6. Stockages dans le navigateur et traceurs</h2>
        <p>La session Supabase utilise un stockage technique nécessaire à l’authentification. {STUDIO_PRIVACY_COPY.storage} {STUDIO_PRIVACY_COPY.safeSituation}</p>
        <p>L’audit du 10 août 2026 n’a détecté aucun tag Google Analytics, Google Tag Manager ni mesure d’audience active dans le frontal. La préférence affichée par la bannière est conservée 150 jours. Avant toute activation d’un traceur non essentiel, FormaPrompt devra informer l’utilisateur, recueillir son choix et rendre le refus et le retrait aussi simples que l’acceptation.</p>

        <h2>7. Prestataires et transferts</h2>
        <ul>
          <li><strong>Supabase</strong> : base, authentification, fonctions et journaux ; projet configuré en région Paris.</li>
          <li><strong>Stripe</strong> : paiement, facturation éventuelle, sécurité et prévention de la fraude.</li>
          <li><strong>IONOS</strong> : hébergement du site et journaux techniques.</li>
          <li><strong>Google Meet et Microsoft Teams</strong> : fourniture des classes virtuelles selon le compte utilisé.</li>
        </ul>
        <p>Les conditions et mécanismes de transfert applicables dépendent des services et comptes effectivement utilisés. La localisation européenne du projet Supabase ne suffit pas, à elle seule, à exclure tout transfert.</p>

        <h2>8. Durées de conservation</h2>
        <p>Les données sont conservées pendant la durée nécessaire à la finalité, puis supprimées, anonymisées ou archivées lorsqu’une obligation légale, contractuelle ou la défense de droits le justifie. Les pièces comptables sont conservées pendant la durée légale applicable. FormaPrompt n’applique aucune suppression automatique fondée sur une durée arbitraire aux comptes, preuves pédagogiques, documents OF/OPCO, incidents ou journaux d’audit.</p>

        <h2>9. Vos droits</h2>
        <p>Selon le traitement et sa base juridique, vous pouvez demander l’accès, la rectification, l’effacement, la limitation, la portabilité ou vous opposer au traitement. Vous pouvez retirer un consentement à tout moment sans remettre en cause les traitements antérieurs.</p>
        <p>Adressez votre demande à <a href={`mailto:${SITE_CONFIG.contactEmail}`}>{SITE_CONFIG.contactEmail}</a>. Une preuve d’identité n’est demandée qu’en cas de doute raisonnable et de manière proportionnée. Vous pouvez aussi saisir la <a href="https://www.cnil.fr/" target="_blank" rel="noopener noreferrer">CNIL</a>.</p>

        <h2>10. Sécurité et version</h2>
        <p>FormaPrompt applique des contrôles d’accès, des politiques par utilisateur, une séparation des rôles, le chiffrement des échanges et une journalisation adaptée. En cas de violation, l’incident est documenté et les notifications requises sont évaluées.</p>
        <p>Chaque version publiée reçoit une date et un identifiant. Les versions nécessaires à la preuve d’une commande ou d’une information sont archivées.</p>
      </LegalDocument>
    </>
  );
}
