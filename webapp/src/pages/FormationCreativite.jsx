import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import CourseSummary from '../components/CourseSummary';
import CreativityEnrollment from '../components/CreativityEnrollment';
import { CREATIVITY_PURCHASES } from '../../supabase/functions/_shared/purchaseConfig.js';
import { SITE_CONFIG } from '../config/site';
import './FormationIA.css';
import './FormationCreativite.css';

const title = 'Explorer l’IA au service de la créativité';
const canonical = `${SITE_CONFIG.baseUrl}/formation-ia-creativite`;
const image = `${SITE_CONFIG.baseUrl}/assets/formation-ia-creativite.webp`;
const description = 'Formation IA et créativité de 14 heures pour artistes et créateurs : explorer, comparer et retravailler des propositions à partir de votre pratique et de votre projet.';
const offerPrice = id => `${new Intl.NumberFormat('fr-FR').format(CREATIVITY_PURCHASES[id].amountTotal / 100).replace(/\u202f/g, ' ')} €`;
const objectives = [
  'Cadrer une intention artistique, le rôle de l’IA et les limites de son usage.',
  'Structurer une demande avec CROP : Contexte, Rôle, Objectif, Précisions.',
  'Explorer plusieurs pistes et comparer ce que les aides de l’IA apportent au projet.',
  'Sélectionner et retravailler des propositions en exerçant son jugement artistique.',
  'Expliquer ses choix et vérifier les points sensibles avant de partager une production.',
];
const sessions = [
  { title: 'Situer les usages et poser son projet', items: ['Repérer des usages de l’IA dans différentes pratiques créatives.', 'Définir une intention, un besoin et les limites à respecter.', 'Essayer une première aide de l’IA pour le dialogue, la recherche ou la préparation.'] },
  { title: 'Formuler des demandes et ouvrir des pistes', items: ['Construire et ajuster ses demandes avec la méthode CROP.', 'Produire des variations et comparer leurs effets.', 'Relever des défis courts pour repérer les clichés et chercher d’autres directions.'] },
  { title: 'Comparer, analyser et reprendre', items: ['Comparer différentes aides de l’IA selon le projet et les outils accessibles.', 'Développer un fragment, une étude ou un prototype lié à son intention.', 'Analyser les propositions, sélectionner ce qui est utile et le retravailler.'] },
  { title: 'Contrôler, présenter et poursuivre', items: ['Finaliser le fragment ou prototype travaillé pendant le parcours.', 'Contrôler les points sensibles avant un éventuel partage.', 'Présenter ses choix et construire un plan d’usage autonome adapté à sa pratique.'] },
];

export default function FormationCreativite() {
  return (
    <div className="generative-ai-page creativity-page">
      <SEO title="Formation IA et créativité · 14 h | FormaPrompt" description={description} url={canonical} image={image}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Course', name: title, description, url: canonical,
          image, inLanguage: 'fr-FR', timeRequired: 'PT14H',
          coursePrerequisites: 'Une pratique artistique et les bases numériques. Aucun prérequis en IA.',
          provider: { '@type': 'EducationalOrganization', name: SITE_CONFIG.name, url: SITE_CONFIG.urls.home } }} />

      <section className="generative-ai-hero">
        <div className="container generative-ai-hero-grid">
          <div>
            <p className="generative-ai-kicker">Formation · Artistes et créateurs</p>
            <h1>{title}</h1>
            <p className="generative-ai-lead">Explorer des usages concrets de l’IA à partir de votre pratique et de votre projet, tout en gardant la maîtrise de vos choix artistiques.</p>
            <div className="generative-ai-actions">
              <a href="#inscription" className="btn btn-primary">Choisir ma formule</a>
              <a href="#programme" className="btn generative-ai-secondary-btn">Consulter le programme</a>
            </div>
          </div>
          <figure className="creativity-hero-visual">
            <img src="/assets/formation-ia-creativite-768.webp" width="1536" height="1024"
              srcSet="/assets/formation-ia-creativite-768.webp 768w, /assets/formation-ia-creativite.webp 1536w"
              sizes="(max-width: 800px) 100vw, 42vw"
              alt="Atelier créatif mêlant pratiques artistiques, carnet de recherche et outils numériques" fetchPriority="high" />
            <figcaption>Illustration générée avec l’IA</figcaption>
          </figure>
        </div>
        <div className="container creativity-summary">
          <CourseSummary id="creativity-summary" items={[
            { label: 'Durée', value: '14 heures · 4 séances de 3 h 30, pauses en plus' },
            { label: 'Formateur', value: 'Thierry FREZARD' },
            { label: 'Modalités', value: 'Présentiel à Calais ou classe virtuelle accompagnée' },
            { label: 'Prérequis', value: 'Pratique artistique et bases numériques · aucun prérequis IA' },
            { label: 'Accompagnement', value: 'Petit groupe jusqu’à 6 personnes ou individuel personnalisé' },
          ]} />
        </div>
      </section>

      <section className="container generative-ai-section" aria-labelledby="creativity-public">
        <div className="generative-ai-two-columns">
          <article>
            <h2 id="creativity-public">Pour les artistes et créateurs de toutes disciplines</h2>
            <p>Vidéo et cinéma, arts vivants, dessin et bande dessinée, peinture, sculpture et céramique, photographie, écriture, musique et son, danse, textile, installations, créations numériques ou hybrides… Cette liste reste ouverte.</p>
            <p>La démarche artistique humaine reste au centre. L’IA peut soutenir le dialogue, la recherche, la préparation, la comparaison ou des propositions à retravailler. Le parcours ne se limite pas à la génération d’images.</p>
          </article>
          <article>
            <h2>Partir de votre pratique</h2>
            <p>Aucun prérequis en IA n’est demandé. Une pratique artistique et les bases numériques sont nécessaires. Un accompagnement numérique est possible : nous examinons les besoins avant la session.</p>
            <p>Un questionnaire préalable permet d’adapter les exercices à votre discipline, votre rôle, votre niveau, votre projet, vos outils et vos limites. Si vous n’avez pas encore de projet, un cas vous est proposé.</p>
          </article>
        </div>
      </section>

      <section className="generative-ai-objectives-section" aria-labelledby="creativity-objectives">
        <div className="container">
          <h2 id="creativity-objectives">Ce que vous apprendrez à faire</h2>
          <ol className="creativity-objectives">{objectives.map(objective => <li key={objective}>{objective}</li>)}</ol>
          <p>Vous travaillez sur un fragment, une étude ou un prototype lié à votre projet. L’objectif est d’apprendre une démarche réutilisable ; une œuvre achevée n’est pas un résultat garanti.</p>
        </div>
      </section>

      <section id="programme" className="generative-ai-program-section" aria-labelledby="creativity-programme">
        <div className="container">
          <div className="generative-ai-section-heading">
            <p className="generative-ai-kicker">Programme · 14 heures</p>
            <h2 id="creativity-programme">Quatre séances pour explorer et décider</h2>
            <p>Chaque séance dure 3 h 30. Les pauses s’ajoutent au temps pédagogique. Aucun travail n’est imposé entre les séances.</p>
          </div>
          <div className="generative-ai-program">{sessions.map((session, index) => (
            <article key={session.title}>
              <div className="generative-ai-module-meta"><span aria-hidden="true">0{index + 1}</span><strong>3 h 30</strong></div>
              <div><h3>Séance {index + 1} — {session.title}</h3><ul>{session.items.map(item => <li key={item}>{item}</li>)}</ul></div>
            </article>
          ))}</div>
        </div>
      </section>

      <section className="container generative-ai-section" aria-labelledby="creativity-methodes">
        <div className="generative-ai-two-columns">
          <article>
            <h2 id="creativity-methodes">Pratiquer avec un accompagnement</h2>
            <p>Formation animée par <Link to="/a-propos">Thierry FREZARD</Link>. Démonstrations, exercices personnels, défis courts, comparaison critique, échanges et corrections accompagnent votre progression.</p>
            <p>Les outils sont choisis selon les usages et le projet. Le parcours ne vise pas la maîtrise de tous les logiciels. Des exercices sont accessibles sans achat obligatoire ; les abonnements et outils payants ne sont pas inclus.</p>
          </article>
          <article>
            <h2>Évaluer la démarche et les compétences</h2>
            <p>L’évaluation porte sur le processus, les compétences mobilisées, les traces des essais et la restitution des choix. Elle ne juge pas la valeur artistique de la production.</p>
            <p>Le bilan de satisfaction est distinct de l’évaluation des acquis.</p>
          </article>
        </div>
      </section>

      <section className="generative-ai-objectives-section" aria-labelledby="creativity-limites">
        <div className="container generative-ai-introduction">
          <h2 id="creativity-limites">Garder la maîtrise de ses choix</h2>
          <div>
            <p>Les inquiétudes liées aux métiers, à l’uniformisation des créations, aux droits, aux voix et aux images ont leur place dans les échanges. Vous pouvez définir ce que vous acceptez d’explorer et ce que vous souhaitez préserver.</p>
            <p>Vous pouvez aussi retenir une aide par dialogue ou décider de limiter l’usage de l’IA.</p>
            <p>Avant de partager, vous repérez les points à vérifier : sources et conditions d’utilisation, droits sur les éléments utilisés, accord des personnes concernées et données personnelles ou confidentielles. Les limites des outils font partie de l’analyse.</p>
          </div>
        </div>
      </section>

      <section className="container generative-ai-section" aria-labelledby="creativity-tarifs">
        <div className="generative-ai-section-heading">
          <p className="generative-ai-kicker">Les formules · 14 heures</p>
          <h2 id="creativity-tarifs">Choisir votre accompagnement</h2>
          <p>TVA non applicable. Tarifs pour le parcours de 14 heures.</p>
        </div>
        <div className="creativity-pricing">
          <article><h3>Groupe ouvert</h3><p className="creativity-price">{offerPrice('ia-creativite-groupe')} par personne</p><p>Petit groupe de 6 personnes maximum, avec un seuil prévu de 4 participants.</p><p>{CREATIVITY_PURCHASES['ia-creativite-groupe'].groupOpeningMessage}</p></article>
          <article><h3>Individuel</h3><p className="creativity-price">{offerPrice('ia-creativite-individuel')} pour les 14 heures</p><p>Un parcours entièrement personnalisé autour de votre pratique et de votre projet.</p></article>
          <article><h3>École ou association</h3><p className="creativity-price">{offerPrice('ia-creativite-ecole-association')} pour le groupe</p><p>Groupe constitué par votre école ou association. Forfait pour les 14 heures, jusqu’à 6 personnes. Les locaux sont fournis par la structure.</p></article>
        </div>
        <p className="creativity-price-note">Les abonnements et outils payants ne sont pas inclus. Les exercices ne nécessitent pas d’achat obligatoire.</p>
      </section>

      <CreativityEnrollment />
      <section className="generative-ai-program-section" aria-labelledby="creativity-organisation">
        <div className="container generative-ai-section generative-ai-two-columns">
          <article>
            <h2 id="creativity-organisation">Organiser votre formation</h2>
            <p>En présentiel à Calais ou en classe virtuelle accompagnée. Pour une école ou une association, l’organisation dans les locaux fournis par la structure est à convenir.</p>
            <p>Indiquez « IA et créativité », votre pratique et la formule souhaitée dans votre demande, sans transmettre de documents confidentiels.</p>
            <p>Les tarifs de formation sont fixes. Dès l’activation de votre droit après commande, choisissez une session pour le groupe ouvert ou réservez vos horaires individuels dans votre espace apprenant. Pour votre école ou association, les dates et les participants sont convenus avec Thierry FREZARD. Les adaptations peuvent être préparées avec lui pour chaque formule.</p>
            <Link to="/contact" className="btn btn-primary">Préparer l’organisation de ma formation</Link>
          </article>
          <article>
            <h2>Accessibilité et adaptations</h2>
            <p>Signalez vos besoins avant la session. Nous examinons avec vous les adaptations des supports, consignes, manipulations, du rythme et de la restitution, ainsi que les limites des services tiers.</p>
            <Link to="/contact">Échanger sur un besoin d’accessibilité</Link>
          </article>
        </div>
      </section>
    </div>
  );
}
