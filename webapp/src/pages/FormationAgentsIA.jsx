import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import CourseSummary from '../components/CourseSummary';
import { SITE_CONFIG } from '../config/site';
import './FormationIA.css';
import './FormationAgentsIA.css';

// Programme officiel V1.0 VALIDÉ du 14/08/2026, sections 2 à 14.
// Offre locale de 28 h : tarifs proposés par Thierry le 09/09, sans paiement ni droit LMS.
const title = 'Agents IA & Workflows - De l’assistant à l’automatisation professionnelle';
const canonical = `${SITE_CONFIG.baseUrl}/formation-agents-ia-workflows`;
const description = 'Formation Agents IA & Workflows : 28 heures en distanciel synchrone pour choisir, construire et tester une automatisation encadrée avec CADRES. Sur devis.';
const objectives = [
  'Analyser un processus, ses acteurs, ses données, ses décisions et ses risques.',
  'Choisir le niveau d’automatisation selon sa valeur, son coût, sa maintenance et son risque.',
  'Identifier et connecter les ressources utiles dans un périmètre autorisé.',
  'Concevoir et construire un workflow lisible, contrôlable et adapté aux données disponibles.',
  'Intégrer un modèle d’IA uniquement lorsqu’il apporte une valeur pertinente.',
  'Concevoir un agent encadré : mission, outils, permissions, limites et conditions d’arrêt.',
  'Sécuriser les actions et les données, notamment face aux instructions malveillantes.',
  'Tester, tracer, corriger et améliorer la solution sans complexité inutile.',
];
const days = [
  {
    title: 'J1 — Je choisis',
    items: [
      'Comparer assistant IA, planification, automatisation native, workflow, agent et intervention humaine.',
      'Décider avec CADRES et la roue de décision : valeur, fréquence, coût, maintenance et risque.',
      'Cartographier un processus de l’entreprise fictive Tout Va Bien — Conseil & Formation.',
      'Démarrer le projet professionnel individuel et une première version du Dossier CADRES.',
    ],
    result: 'Une cartographie du processus et un premier choix argumenté, avant toute connexion technique.',
  },
  {
    title: 'J2 — Je connecte',
    items: [
      'Comprendre les échanges entre applications : API, données JSON, authentification et webhooks.',
      'Construire un premier workflow avec n8n Community : déclenchement, transformation et sortie observable.',
      'Ajouter conditions, contrôles de format, traitement des données manquantes et conditions d’arrêt.',
      'Transposer les connexions utiles au projet CADRES en vérifiant accès et dépendances.',
    ],
    result: 'Un workflow simple et contrôlé, testé avec un cas normal et un cas incomplet.',
  },
  {
    title: 'J3 — Je rends intelligent',
    items: [
      'Distinguer une règle déterministe d’un traitement par un modèle de langage (LLM).',
      'Structurer les instructions avec CROP et contrôler les sorties mêlant données et documents.',
      'Situer le RAG (recherche dans des sources) et MCP (connexion aux outils) dans un usage encadré.',
      'Définir mission, permissions, supervision humaine et arrêt d’un agent ; enrichir le projet seulement si cela est utile.',
    ],
    result: 'Un prototype enrichi ou une décision argumentée de conserver une solution moins autonome.',
  },
  {
    title: 'J4 — Je sécurise et je teste',
    items: [
      'Définir les permissions minimales, protéger les données et contrôler les actions sensibles.',
      'Prévoir traces, erreurs, reprises et prévention des actions répétées ; examiner coût et maintenance.',
      'Traiter les incidents du scénario « Tout va mal chez Tout Va Bien » : corriger, arrêter ou faire intervenir une personne.',
      'Finaliser le projet, restituer les décisions et formaliser « Mes 3 prochaines actions ».',
    ],
    result: 'Un projet documenté, un journal de tests et des décisions de correction ou d’arrêt justifiées.',
  },
];

export default function FormationAgentsIA() {
  return (
    <div className="generative-ai-page agents-ia-page">
      <SEO title="Formation Agents IA & Workflows · 28 h à distance | FormaPrompt"
        description={description} url={canonical} image={SITE_CONFIG.assets.logo}
        jsonLd={{
          '@context': 'https://schema.org', '@type': 'Course', name: title,
          description, url: canonical, inLanguage: 'fr-FR', timeRequired: 'PT28H',
          educationalLevel: 'Intermédiaire',
          coursePrerequisites: 'Usage courant d’un assistant IA, aisance avec navigateur et fichiers, ordinateur et accès adaptés. Aucune programmation requise.',
          provider: { '@type': 'EducationalOrganization', name: SITE_CONFIG.name, url: SITE_CONFIG.urls.home },
        }} />

      <section className="generative-ai-hero">
        <div className="container generative-ai-hero-grid">
          <div>
            <p className="generative-ai-kicker">Formation professionnelle · Distanciel synchrone</p>
            <h1>{title}</h1>
            <p className="generative-ai-lead">Choisir ce qui mérite d’être automatisé, relier les bons outils et garder le contrôle des actions. Un parcours accompagné pour construire une solution proportionnée à votre activité, puis la tester et la documenter.</p>
            <div className="generative-ai-actions">
              <Link to="/contact" className="btn btn-primary">Demander un devis</Link>
              <a href="#programme" className="btn generative-ai-secondary-btn">Consulter les quatre journées</a>
            </div>
          </div>
          <CourseSummary id="agents-ia-summary" items={[
            { label: 'Durée', value: '28 heures · 4 journées de 7 heures, hors pauses' },
            { label: 'Modalité', value: 'À distance, en direct avec le formateur' },
            { label: 'Niveau', value: 'Intermédiaire · sans programmation requise' },
            { label: 'Formules', value: 'Individuel, inter, groupe constitué ou intra · exonéré de TVA' },
          ]} />
        </div>
      </section>

      <section className="container generative-ai-section" aria-labelledby="agents-public">
        <div className="generative-ai-two-columns">
          <article>
            <h2 id="agents-public">À qui s’adresse cette formation ?</h2>
            <ul>
              <li>Dirigeants et managers de TPE-PME.</li>
              <li>Professionnels des fonctions support et chefs de projet.</li>
              <li>Formateurs, consultants et responsables pédagogiques.</li>
              <li>Référents IA ou transformation numérique.</li>
            </ul>
            <p>Elle est aussi ouverte aux professionnels utilisant déjà un assistant IA et souhaitant faire évoluer un processus de travail.</p>
          </article>
          <article>
            <h2>Les prérequis</h2>
            <ul>
              <li>Savoir formuler une demande à un assistant IA, analyser sa réponse et la corriger.</li>
              <li>Être à l’aise avec un navigateur, la gestion de fichiers et les outils numériques courants.</li>
              <li>Disposer d’un ordinateur, d’une connexion stable et des accès adaptés aux outils de la session.</li>
            </ul>
            <p>Aucune compétence en programmation n’est requise. Le positionnement préalable vérifie vos acquis, votre projet et les adaptations utiles.</p>
            <p>J1 fait partie de la formation complète ; ce n’est pas une journée à avoir suivie auparavant.</p>
          </article>
        </div>
      </section>

      <section className="generative-ai-objectives-section" aria-labelledby="agents-objectifs">
        <div className="container">
          <h2 id="agents-objectifs">Ce que vous apprendrez à faire</h2>
          <ol className="agents-ia-objectives">{objectives.map(objective => <li key={objective}>{objective}</li>)}</ol>
          <p>Un agent n’est pas une obligation. Conserver une intervention humaine ou choisir une solution plus simple est recevable lorsque le besoin et les risques le justifient.</p>
        </div>
      </section>

      <section id="programme" className="generative-ai-program-section" aria-labelledby="agents-programme">
        <div className="container">
          <div className="generative-ai-section-heading">
            <p className="generative-ai-kicker">Programme · 28 heures</p>
            <h2 id="agents-programme">Quatre journées, un projet professionnel</h2>
            <p>CADRES accompagne le parcours : Cadrer, Analyser, Décider, Relier, Encadrer, Simuler. Vous choisissez le niveau utile avant de connecter les ressources.</p>
          </div>
          <div className="generative-ai-program">
            {days.map((day, index) => <article key={day.title}>
              <div className="generative-ai-module-meta"><span aria-hidden="true">0{index + 1}</span><strong>7 heures</strong></div>
              <div><h3>{day.title}</h3><ul>{day.items.map(item => <li key={item}>{item}</li>)}</ul><p><strong>Production attendue :</strong> {day.result}</p></div>
            </article>)}
          </div>
        </div>
      </section>

      <section className="container generative-ai-section" aria-labelledby="agents-methodes">
        <div className="generative-ai-two-columns">
          <article>
            <h2 id="agents-methodes">Pratiquer avec un accompagnement en direct</h2>
            <p>Formation animée par <Link to="/a-propos">Thierry FREZARD</Link>.</p>
            <p>Environ 65 à 70 % du temps est consacré aux manipulations, analyses, simulations et au projet. Apports courts, démonstrations, essais guidés et retours du formateur alternent pendant les quatre journées.</p>
            <p>n8n Community est l’outil principal pour relier les étapes d’un workflow. Make et Zapier servent à la comparaison et à la transposition. Les comptes et outils compatibles sont précisés avant la session.</p>
            <p>Les exercices utilisent des données fictives, génériques ou anonymisées. Des solutions de remplacement sont prévues en cas d’indisponibilité d’un outil ou du réseau.</p>
          </article>
          <article>
            <h2>Les livrables du parcours</h2>
            <ul>
              <li>Supports des quatre journées, carnet apprenant et roue de décision avec alternative numérique.</li>
              <li>Fiches d’activités, modèles, données fictives et grilles de vérification.</li>
              <li>Projet professionnel et Dossier CADRES individuel de 5 à 8 pages.</li>
              <li>Journal de tests, incidents, corrections et décisions d’arrêt.</li>
              <li>Plan d’action « Mes 3 prochaines actions ».</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="generative-ai-program-section" aria-labelledby="agents-evaluation">
        <div className="container generative-ai-introduction">
          <h2 id="agents-evaluation">Évaluer les choix, les réalisations et les contrôles</h2>
          <div>
            <p>L’évaluation s’appuie sur les productions intermédiaires, le projet CADRES, le scénario d’incidents et une restitution individuelle. Le positionnement initial est distinct de cette évaluation.</p>
            <p>La grille finale couvre les huit compétences du programme sur 100 points. Le seuil de validation est de 70/100, avec correction obligatoire de toute erreur critique de sécurité, de permissions ou de traitement des données, même si ce seuil est atteint.</p>
            <p>La complexité technique ne donne aucun bonus. Une décision argumentée de ne pas automatiser est recevable.</p>
            <p>Une attestation de fin de formation et les résultats utiles sont remis selon les preuves disponibles et la procédure FormaPrompt. Le parcours ne promet pas de certification externe.</p>
          </div>
        </div>
      </section>

      <section className="generative-ai-objectives-section" aria-labelledby="agents-tarifs">
        <div className="container">
          <div className="generative-ai-section-heading">
            <h2 id="agents-tarifs">Les formules en distanciel</h2>
            <p>Pour le parcours de 28 heures. Exonéré de TVA. Contactez FormaPrompt pour préparer le devis et l’organisation de votre formation.</p>
          </div>
          <div className="generative-ai-objectives agents-ia-tariffs">
            <article>
              <h3>Individuel</h3>
              <p className="agents-ia-price">1 370 €</p>
              <p>Pour un apprenant.</p>
            </article>
            <article>
              <h3>Inter-entreprises</h3>
              <p className="agents-ia-price">990 € par personne</p>
              <p>Deux participants minimum par session.</p>
            </article>
            <article>
              <h3>Groupe constitué</h3>
              <p className="agents-ia-price">1 790 € pour le groupe</p>
              <p>Forfait total pour les 28 heures, de 2 à 8 participants. Une société ou un particulier peut constituer son groupe.</p>
            </article>
            <article>
              <h3>Intra-entreprise</h3>
              <p className="agents-ia-price">Sur devis</p>
              <p>Deux participants minimum.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="container generative-ai-section" aria-labelledby="agents-accessibilite">
        <div className="generative-ai-two-columns">
          <article>
            <h2 id="agents-accessibilite">Accessibilité et adaptations</h2>
            <p>Signalez vos besoins avant la session via le contact FormaPrompt. Nous examinons avec vous les adaptations des supports, consignes orales et écrites, manipulations, rythme et restitution, ainsi que les limites des services tiers.</p>
            <Link to="/contact">Échanger sur un besoin d’accessibilité</Link>
          </article>
          <article>
            <h2>Organiser votre formation sur devis</h2>
            <p>Indiquez « Agents IA & Workflows » dans votre demande, votre activité, le processus envisagé et les besoins du groupe, sans transmettre de données confidentielles.</p>
            <p>La formule retenue, le montant du devis, le calendrier, les horaires et les modalités d’accès sont confirmés avant toute inscription ferme, dans les documents de la session. Une demande de devis ne vaut pas inscription.</p>
            <Link to="/contact" className="btn btn-primary">Demander un devis pour cette formation</Link>
          </article>
        </div>
      </section>
    </div>
  );
}
