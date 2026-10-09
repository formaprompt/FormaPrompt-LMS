import SEO from '../components/SEO';
import LegalDocument from '../components/LegalDocument';
import { SITE_CONFIG } from '../config/site';
import { STUDIO_PRIVACY_COPY } from '../config/studioPrivacy';
import AiActChallengePrivacyNotice from '../components/AiActChallengePrivacyNotice';

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
        <p className="legal-document__meta">Version locale 2026-10-09 — complément Challenge à valider avant publication</p>

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
        <section id="ai-act-challenge" aria-labelledby="challenge-privacy-heading">
          <h3 id="challenge-privacy-heading">AI ACT CHALLENGE — suivi pédagogique</h3>
          <AiActChallengePrivacyNotice expanded policyLink={false} />
          <p>Pour le jeu facultatif, sa reprise, les retours pédagogiques et les statistiques individuelles consultées par les formateurs habilités, la base proposée est l’article 6, paragraphe 1 f), du RGPD : l’intérêt légitime de FormaPrompt à accompagner les apprentissages. La mise en balance examine la nécessité des données, les attentes des apprenants, le risque de surveillance ou de classement et les garanties prévues. Le jeu n’étant pas nécessaire à l’attestation, l’exécution du contrat n’est pas retenue automatiquement comme base. Les contrats réels, l’alternative pédagogique et la procédure d’opposition doivent être vérifiés avant publication ; cette préparation locale ne constitue pas une validation juridique.</p>
          <p>Les statistiques individuelles restent des données personnelles et suivent la même finalité et la même durée que le jeu. Seuls des agrégats dont l’anonymat est effectivement démontré peuvent sortir de ce cadre ; un identifiant remplacé, une moyenne de petit groupe ou un tableau sans nom ne suffisent pas. Aucun dispositif d’agrégation anonyme supplémentaire n’est annoncé ici.</p>
          <p>La règle de gestion retenue pour le jeu est de 12 mois après la fin effective vérifiée de la formation ; elle ne repose pas sur une autorisation générale de conserver toutes les données pendant 24 mois. Sa compatibilité avec les contrats et exigences des financeurs reste à confirmer. Les pièces contractuelles et les justificatifs nécessaires suivent une conservation distincte, avec accès restreint, motif et durée propres. Conserver un identifiant ou remplacer un nom ne suffit pas à rendre des résultats anonymes.</p>
          <p>Les preuves minimales de réalisation, la gestion des demandes de droits et les journaux de sécurité sont des finalités distinctes du jeu : leur base et leur durée sont examinées séparément. Une obligation légale ne sera retenue que si le texte applicable et les données nécessaires sont identifiés ; une conservation pour la défense de droits doit également être justifiée. Les durées des archives, des copies de travail et des sauvegardes, ainsi que leur suppression après restauration, doivent être arrêtées avant mise en service.</p>
          <p>Le marqueur minimal de restriction poursuit une finalité distincte : respecter l’opposition et la limitation prévues aux articles 21 et 18 du RGPD, sur la base proposée de l’article 6, paragraphe 1 c). Il comprend l’identifiant du compte, l’état de restriction et les références minimales de demande et décision nécessaires à sa gestion et à sa revue ; il ne conserve pas les réponses ou le quota du jeu. Une opposition fondée sur la situation particulière est examinée humainement ; une limitation peut s’appliquer pendant la vérification des motifs légitimes. Ce marqueur n’expire pas automatiquement avec les données pédagogiques : sa nécessité est réexaminée, notamment selon le maintien du compte et la possibilité de ce suivi. Sa suppression ou la levée de la restriction doit être justifiée et documentée, sans assimiler silence ou inactivité à un retrait de la demande.</p>
          <p>Le projet Supabase est configuré en région Paris. Les contrats de sous-traitance, sous-traitants ultérieurs, accès de support et garanties des éventuels transferts hors de l’Espace économique européen applicables à ce projet n’ont pas été vérifiés dans cette préparation. Aucune absence de transfert ni couverture contractuelle particulière n’est garantie. Ces éléments et les moyens d’obtenir les garanties doivent être précisés avant publication.</p>
        </section>

        <h2>4. Classes virtuelles</h2>
        <p>FormaPrompt utilise <strong>Google Meet</strong> et <strong>Microsoft Teams</strong>. Le service retenu est indiqué dans la convocation ou les informations de séance. Les identifiants de réunion, horaires, métadonnées de connexion et flux audio, vidéo ou de partage nécessaires à la séance peuvent être traités par le fournisseur concerné.</p>
        <p>Aucun enregistrement, aucune transcription et aucune prise de notes automatisée ne sont présumés. Une future captation constituerait un traitement distinct nécessitant une information préalable, une finalité, une base juridique, des accès et une durée propres.</p>

        <h2>5. Incidents, discipline et journal d’audit</h2>
        <p>FormaPrompt traite les signalements disciplinaires : faits, personnes concernées, mesures conservatoires, convocations, observations, décisions et conséquences sur les accès. Ces informations sont réservées aux administrateurs habilités et ne sont pas accessibles aux autres apprenants.</p>
        <p>Le journal d’audit conserve les actions administratives sensibles, leur auteur, leur cible, leur motif et les états avant/après. Il est protégé contre les modifications et suppressions ordinaires, sans être présenté comme infalsifiable.</p>
        <p>Les pièces disciplinaires ne sont pas téléversées dans le service actuel. Toute ouverture future d’un stockage documentaire privé fera l’objet d’une information et de règles d’accès et de conservation adaptées.</p>

        <h2>6. Stockages dans le navigateur et traceurs</h2>
        <p>La session Supabase utilise un stockage technique nécessaire à l’authentification. {STUDIO_PRIVACY_COPY.storage} {STUDIO_PRIVACY_COPY.safeSituation}</p>
        <p>Lorsqu'elle est activée, la mesure des ventes Google Ads nécessite votre accord explicite dans la bannière. Avant cet accord, aucun script ni signal publicitaire Google n'est chargé par ce dispositif. Le refus n'empêche pas la navigation, la connexion ou l'achat. La préférence est conservée 150 jours ; un ancien accord relatif aux stockages techniques ne vaut pas accord publicitaire.</p>
        <p>Cette mesure sert à relier les achats confirmés aux annonces FormaPrompt. Google reçoit le montant, la devise et un identifiant de transaction opaque, ainsi que les informations techniques nécessaires à la mesure. Les adresses de pages transmises sont réduites au domaine, sans paramètres, fragments ni identifiants de session. Ce dispositif n'envoie ni nom, adresse électronique, téléphone, identifiant de compte ou données de carte ; il n'active ni conversions avancées, ni remarketing, ni personnalisation publicitaire. L'accord publicitaire ne vaut pas accord pour la mesure d'audience.</p>
        <p>Lorsqu'elle est activée après votre accord distinct, la mesure d'audience Google Analytics sert à comprendre la consultation des pages publiques. Avant cet accord, aucun script ni signal Analytics n'est chargé par ce dispositif. Les espaces de connexion, de compte, d'administration et de formation, les documents, les réservations et les confirmations de paiement sont exclus. Seules les pages publiques expressément autorisées peuvent être mesurées, avec une adresse sans paramètres ni fragments et un titre fixe. Aucun nom, adresse électronique, identifiant de compte, contenu de formulaire ou lien privé n'est transmis par cette mesure. Elle ne mesure pas les achats et n'active pas la personnalisation publicitaire.</p>
        <p>Les choix publicitaire et d'audience sont séparés et facultatifs. Vous pouvez refuser les deux ou ne retenir qu'une mesure. Le retrait de l'accord d'audience bloque les nouvelles mesures, supprime les cookies Analytics accessibles sur ce site et recharge la page lorsque la mesure a été chargée, sans supprimer votre connexion. Il n'efface pas les données déjà reçues par Google.</p>
        <p>Le choix d'audience est conservé 150 jours. Les cookies Analytics sont limités à la session et protégés pour une connexion HTTPS. Google utilise des identifiants de mesure générés par ses cookies et les informations techniques nécessaires à ces requêtes ; aucun identifiant de compte FormaPrompt n'est fourni. La propriété Google conserve les données d'événement pendant 2 mois et les données utilisateur pendant 14 mois, avec réinitialisation de cette dernière durée lors d'une nouvelle activité. Ces réglages ne limitent pas la plupart des rapports agrégés.</p>
        <p>Vous pouvez changer votre choix ou retirer votre accord à tout moment via « Gérer mes cookies » dans le pied de page. Le retrait arrête les nouvelles conversions, supprime les cookies publicitaires Google Ads accessibles sur ce site et recharge la page si la mesure a été chargée, sans supprimer les informations nécessaires à votre connexion. Un registre local des transactions déjà transmises évite leur renvoi ; il est utilisé uniquement avec votre accord et limité à 1 000 transactions. Ses entrées expirent après 150 jours et sont nettoyées à la prochaine utilisation autorisée. Google utilise aussi l'identifiant de transaction pour limiter les doublons. Le retrait n'efface pas rétroactivement les données déjà reçues par Google.</p>

        <h2>7. Prestataires et transferts</h2>
        <ul>
          <li><strong>Supabase</strong> : base, authentification, fonctions et journaux ; projet configuré en région Paris.</li>
          <li><strong>Stripe</strong> : paiement, facturation éventuelle, sécurité et prévention de la fraude.</li>
          <li><strong>IONOS</strong> : hébergement du site et journaux techniques.</li>
          <li><strong>Google Meet et Microsoft Teams</strong> : fourniture des classes virtuelles selon le compte utilisé.</li>
          <li><strong>Google Ads</strong> : mesure des ventes après une annonce, uniquement sur consentement lorsque ce dispositif est activé. Consultez les <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">informations de confidentialité de Google</a> pour ses traitements et transferts.</li>
          <li><strong>Google Analytics</strong> : mesure des consultations de pages publiques lorsqu'elle est activée après un accord d'audience distinct. Les <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">informations de confidentialité de Google</a> décrivent ses traitements et transferts.</li>
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
