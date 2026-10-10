import { Link } from 'react-router-dom';
import './GuideClaude.css';

const assetRoot = '/assets/guides/claude/';
const captures = [
  ['01-interface.jpg', 'Nouvelle conversation Claude en plein écran, champ vide, modèle Sonnet 5.5 Moyen affiché et forfait Free.', 'Un exemple fictif : préparer une activité de bureautique de 20 minutes.'],
  ['02-consigne-crop.jpg', 'Consigne fictive complète structurée en quatre parties CROP pour une activité de bureautique de vingt minutes.', 'CROP : Contexte, Rôle, Objectif, Précisions. La capture montre la consigne avant envoi ; la demande a ensuite été envoyée.'],
  ['03-premiere-proposition.jpg', 'Début de la réponse Claude montrant la durée de vingt minutes, le statut non testé, l’objectif observable et le matériel.', 'Une première proposition réelle, à examiner avant utilisation.'],
  ['04-verification.jpg', 'Déroulé initial de quatre étapes avec leurs durées de trois, six, huit et trois minutes, puis aide pour les personnes plus lentes.', 'Relecture du déroulé : 3 + 6 + 8 + 3 = 20 minutes. Point à adapter : conserver titre, paragraphes et liste pour tous.'],
  ['05-relance.jpg', 'Demande d’adaptation saisie dans Claude : une minute de vérification à l’étape deux et un texte pré-saisi sans réduire les objectifs.', 'Relance réelle : ajouter une pause et maintenir les trois résultats essentiels. La capture montre la relance avant envoi ; elle a ensuite été envoyée.'],
  ['06-version-relue.jpg', 'Réponse révisée réelle avec quatre étapes, pause à l’étape deux et titre, paragraphes et liste maintenus pour tous.', '5 minutes de saisie + 1 minute de vérification ; total inchangé : 20 minutes. Activité relue, non testée en séance.'],
];

const cropPrompt = `Contexte : Je prépare une séance fictive de bureautique pour 8 adultes débutants. Ils savent ouvrir un document et saisir quelques lignes. Chaque personne dispose d'un ordinateur avec un traitement de texte. Aucun fichier personnel ne sera utilisé.

Rôle : Tu m'aides à concevoir une activité pédagogique simple et accessible, que je vérifierai avant de l'utiliser.

Objectif : Propose une fiche d'activité de 20 minutes pour créer une courte note d'information professionnelle et la rendre lisible : titre, paragraphes et liste à puces.

Précisions : Écris en français simple. Prévois un objectif observable, le matériel, un texte d'exercice entièrement fictif de 80 à 100 mots, 4 étapes avec leurs durées, une aide pour les personnes qui avancent plus lentement et 3 critères de réussite vérifiables. Les durées doivent totaliser 20 minutes. Reste neutre sur le logiciel : ne cite pas de boutons ou de menus précis. Présente la fiche directement dans la conversation. Ne présente pas cette activité comme testée et signale les points que le formateur doit vérifier.`;

function Capture({ index }) {
  const [file, alt, caption] = captures[index];
  return <figure className="claude-figure">
    <img src={`${assetRoot}${file}`} width="1680" height="1120" loading="lazy" alt={alt} />
    <figcaption><p>{caption}</p><a href={`${assetRoot}${file}`} target="_blank" rel="noopener noreferrer">Agrandir la capture {index + 1} (nouvel onglet)</a></figcaption>
  </figure>;
}

export default function GuideClaude() {
  return <div className="claude-guide">
    <p className="guides-lead">Claude est un assistant d’intelligence artificielle développé par Anthropic. Vous lui adressez une consigne pour obtenir une proposition, puis vous pouvez préciser la demande au fil de la conversation. Il peut aider à préparer un brouillon ; le professionnel reste responsable de sa vérification et de son utilisation.</p>

    <section id="decouvrir-claude"><h2>Découvrir Claude à partir d’un besoin concret</h2>
      <p>Ce guide s’adresse aux formateurs et aux personnes qui préparent des activités pour des adultes débutants. Nous suivons un seul exemple : créer une courte note d’information dans un traitement de texte, examiner la réponse de Claude, puis demander une adaptation.</p>
      <p>L’objectif est de savoir cadrer une demande, repérer les points à contrôler et améliorer une proposition. Vous pouvez suivre toutes les étapes avec le texte et les captures, sans regarder la vidéo. Pour reproduire l’essai, il faut savoir ouvrir un document et saisir quelques lignes, disposer d’un traitement de texte et accéder à Claude.</p>
      <p className="claude-observation">Essai du 10 octobre 2026 : compte Free, modèle Sonnet 5.5, effort Moyen observés dans l’interface. Ce relevé décrit cet essai ; les modèles, réglages et possibilités d’accès peuvent évoluer selon le compte.</p>
      <Capture index={0} />
      <p>Pour démarrer, ouvrez une conversation, saisissez votre demande, puis envoyez-la. Les précisions suivantes se font dans le même échange. La <a href="https://support.claude.com/en/articles/8114491-get-started-with-claude" target="_blank" rel="noopener noreferrer">documentation officielle de Claude (nouvel onglet)</a> présente ces premiers repères.</p>
    </section>

    <section id="consigne-crop"><h2>Préparer la consigne avec CROP</h2>
      <p>Le contexte décrit les huit adultes débutants et le matériel disponible. Le rôle fixe une aide à la conception, l’objectif nomme la fiche à produire, et les précisions donnent le format, la durée et les contrôles attendus.</p>
      <p>Voici la consigne utilisée dans cet essai. Elle repose entièrement sur une situation fictive.</p>
      <pre className="claude-prompt">{cropPrompt}</pre>
      <Capture index={1} />
      <p>Vous pouvez préparer votre propre demande dans le <Link to="/studio/">Studio FormaPrompt</Link> et approfondir la <Link to="/guides/prompt-engineering-professionnel-methode">méthode CROP</Link>. Remplacez le public et les contraintes par ceux de votre activité, sans saisir de données personnelles ou confidentielles.</p>
    </section>

    <section id="premiere-reponse"><h2>Examiner la première proposition</h2>
      <p>Claude produit une fiche avec un objectif observable, le matériel et un déroulé. Ce document constitue une première version à relire. Sa présentation claire ne prouve pas que l’activité convient à votre groupe.</p>
      <Capture index={2} />
      <p>Comparez la réponse à la consigne : texte fictif de 80 à 100 mots, quatre étapes, titre, paragraphes, liste à puces et trois critères vérifiables. Comptez les mots du texte d’exercice et vérifiez que les critères correspondent réellement aux productions demandées.</p>
    </section>

    <section id="verifier-adapter"><h2>Vérifier la durée et adapter l’aide</h2>
      <p>Dans le déroulé initial, les durées sont de 3, 6, 8 et 3 minutes : elles totalisent bien 20 minutes. Il n’y a donc pas d’écart de total à corriger ici. Il reste à vérifier la faisabilité : un adulte débutant peut avoir besoin de plus de temps pour saisir le texte et se repérer.</p>
      <Capture index={3} />
      <p>Le point à adapter concerne l’aide aux personnes qui avancent plus lentement. L’aide doit maintenir les trois résultats essentiels : un titre, des paragraphes et une liste à puces. Donner un texte pré-saisi permet de réduire la saisie tout en conservant le travail de mise en forme.</p>
      <p>La relance demande aussi une minute de vérification à l’étape 2. Elle doit être prise dans les six minutes déjà prévues, pour conserver le total de 20 minutes.</p>
      <Capture index={4} />
      <p>Cette adaptation illustre une relance ciblée : préciser l’écart pédagogique, nommer ce qui doit rester et indiquer la contrainte de durée. Une demande générale comme « améliore la fiche » rendrait la comparaison plus difficile.</p>
    </section>

    <section id="version-relue"><h2>Relire la version adaptée avant utilisation</h2>
      <p>La réponse révisée répartit l’étape 2 en 5 minutes de saisie et 1 minute de vérification. Le total reste de 20 minutes. Le texte pré-saisi maintient le titre, les paragraphes et la liste pour les personnes qui ont besoin d’aide.</p>
      <Capture index={5} />
      <p><strong>Cette activité a été relue ; elle n’a pas été testée auprès d’apprenants.</strong> Une relecture ne permet pas d’affirmer que le rythme conviendra à un groupe réel.</p>
      <ul className="claude-checks">
        <li>Essayer les étapes dans le traitement de texte utilisé et vérifier la faisabilité du temps prévu.</li>
        <li>Préparer le texte fictif et sa version pré-saisie, puis vérifier leur longueur et leur lisibilité.</li>
        <li>Vérifier que l’aide conserve les apprentissages et que les trois critères peuvent être observés.</li>
        <li>Adapter l’affichage, les consignes et l’accompagnement aux besoins d’accessibilité du groupe.</li>
      </ul>
      <p>Gardez les données de l’exercice fictives. Ne transmettez pas de fichiers personnels, de dossiers apprenants ou d’informations confidentielles à un outil non autorisé. Le formateur contrôle les contenus, décide des adaptations et assume leur utilisation.</p>
    </section>

    <section id="demonstration-video"><h2>Revoir la démonstration en vidéo</h2>
      <p>Claude — Démonstration de préparation d’une activité. La vidéo reprend l’échange présenté ci-dessus. Les sous-titres sont intégrés à l’image.</p>
      <video className="claude-video" controls preload="metadata" playsInline poster={`${assetRoot}01-interface.jpg`} aria-label="Claude — Démonstration de préparation d’une activité">
        <source src={`${assetRoot}claude-activite-bureautique-v3.mp4`} type="video/mp4" />
        Votre navigateur ne permet pas de lire cette vidéo. <a href={`${assetRoot}claude-activite-bureautique-v3.mp4`}>Ouvrir la vidéo</a>. Les étapes sont aussi expliquées dans le texte de cette page.
      </video>
      <p className="guides-training-link">Pour pratiquer sur des situations professionnelles accompagnées : <Link to="/formation-ia-generative">formation IA générative</Link> et <Link to="/formation-prompt-engineering">formation Prompt Engineering</Link>. Pour une question sur l’adaptation à votre public, <Link to="/contact">contactez FormaPrompt</Link>.</p>
    </section>
  </div>;
}
