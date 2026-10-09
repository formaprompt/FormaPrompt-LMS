import { SITE_CONFIG } from '../config/site';

export default function AiActChallengePrivacyNotice({ expanded = false, policyLink = true }) {
  return <aside className="aac-card" aria-label="Confidentialité du Challenge">
    <h3>Vos données dans ce jeu</h3>
    <p>FormaPrompt conserve vos choix, progression, scores, dates et version du questionnaire pour reprendre vos tentatives et vous accompagner. Votre identité dans le dossier de formation permet aux formateurs habilités pour la formation AI Act et aux administrateurs habilités de suivre votre parcours. Les autres apprenants n’y ont pas accès.</p>
    <p>Les données sont hébergées dans Supabase. Les réponses et résultats ne sont transmis ni à un fournisseur d’IA ni à Google Analytics. Le score est formatif, non certifiant, et ne conditionne pas votre attestation.</p>
    <p>Le jeu est facultatif. Vous pouvez ne pas y participer sans bloquer votre attestation. La base proposée pour cette version locale est l’intérêt légitime pédagogique de FormaPrompt : permettre la reprise du jeu, le retour sur vos réponses et l’accompagnement par les formateurs habilités, y compris après la formation pendant la durée indiquée ci-dessous. Cette base doit être validée avant publication.</p>
    <p>Conservation : pendant votre formation, puis 12 mois après sa fin effective vérifiée.</p>
    <details open={expanded}>
      <summary>Conservation et droits</summary>
      <p>Cette règle couvre les réponses, résultats, le compteur de tentatives et les traces techniques du jeu. Jouer, sauvegarder une réponse, terminer une tentative ou consulter un résultat ne prolonge pas cette échéance.</p>
      <p>Une reprise réelle de la formation peut conduire à une nouvelle date de fin documentée. La simple connexion ou le maintien de votre accès ne valent pas reprise de formation.</p>
      <p>En cas d’abandon ou d’interruption définitive, la date de clôture doit être établie après examen du dossier. La seule inactivité ne vaut pas fin de formation.</p>
      <p>Vous pouvez vous opposer à ce suivi en contactant FormaPrompt et en indiquant votre situation particulière. La demande est examinée par une personne ; elle n’entraîne pas automatiquement une suspension ou un effacement dans l’application. Vous pouvez demander un accompagnement pédagogique sans utiliser ce jeu. Le refus du jeu et l’exercice de vos droits ne bloquent pas votre attestation.</p>
      <p>Lorsqu’une restriction est décidée et enregistrée par un administrateur habilité, les nouvelles tentatives et modifications du jeu sont bloquées et vos données sont exclues des vues et statistiques des formateurs. La consultation de vos propres résultats reste possible selon vos droits d’accès ; une copie peut être demandée à FormaPrompt.</p>
      <p>Pour respecter cette opposition ou limitation, un marqueur minimal lié à votre compte peut être conservé séparément, sans réponse, score ni compteur de tentatives, même après l’effacement du jeu. Il est réexaminé périodiquement et conservé tant qu’il est nécessaire au respect de la restriction. L’inactivité ou une date de revue passée ne réactivent pas la collecte ; la levée nécessite une décision humaine documentée.</p>
      <p>L’effacement à échéance nécessite une procédure contrôlée. Les exceptions de conservation doivent être justifiées séparément. Aucune suppression automatique de données réelles n’est activée. Les documents contractuels et justificatifs de formation suivent leurs règles propres.</p>
      <p>Pour demander l’accès, la rectification, l’effacement, la limitation ou exercer votre droit d’opposition : Thierry FREZARD EI — FormaPrompt, <a href={`mailto:${SITE_CONFIG.contactEmail}`}>{SITE_CONFIG.contactEmail}</a>. Réponse sous un mois ; une prolongation motivée de deux mois peut être nécessaire selon la complexité ou le nombre de demandes. Vous pouvez aussi saisir la <a href="https://www.cnil.fr/" target="_blank" rel="noopener noreferrer">CNIL</a>.</p>
    </details>
    {policyLink && <p><a href="/politique-confidentialite#ai-act-challenge">Consulter la politique de confidentialité du Challenge</a></p>}
  </aside>;
}
