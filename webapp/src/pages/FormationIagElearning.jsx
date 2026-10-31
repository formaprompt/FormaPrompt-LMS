import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenCheck, Clock3, FileText, MessageSquareText, CheckCircle2 } from 'lucide-react';
import SEO from '../components/SEO';
import CommercialCheckout from '../components/CommercialCheckout';
import { useAuth } from '../contexts/useAuth';
import { fetchCourseAccessEntitlement } from '../lib/courseAccess';
import { hasUsableCourseAccess } from '../../supabase/functions/_shared/paidCourseAccess.js';
import { getPurchaseConfig } from '../../supabase/functions/_shared/purchaseConfig.js';
import { IAG_COURSE_ID } from '../../supabase/functions/_shared/iagPositioning.js';
import './FormationIA.css';
import './FormationIagElearning.css';

// Public programme titles only. The lesson bodies and resources remain private.
const modules = [
  { title: 'Prendre ses repères et formuler une demande', lessons: ['Repérer le bon usage', 'Construire une demande avec CROP', 'Corriger sans tout recommencer'] },
  { title: 'Écrire un courriel et comparer les assistants', lessons: ['Écrire et améliorer un courriel avec Mistral', 'Écrire et améliorer un courriel avec Claude', 'Écrire et améliorer un courriel avec Gemini', 'Écrire et améliorer un courriel avec Copilot', 'Écrire et améliorer un courriel avec Perplexity', 'Écrire et améliorer un courriel avec ChatGPT', 'Écrire et améliorer un courriel avec DeepSeek'] },
  { title: 'Rechercher et vérifier une information', lessons: ['Formuler une recherche', 'Vérifier une affirmation', 'Restituer une incertitude'] },
  { title: 'Lire et travailler sur des documents', lessons: ['Résumer sans ajouter', 'Extraire et structurer', 'Adapter au lecteur'] },
  { title: 'Organiser son travail', lessons: ['Prioriser avec contraintes — contrôler un planning Copilot', 'Passer des notes aux actions'] },
  { title: 'Préparer et contrôler un visuel', lessons: ['Préparer un visuel utile', 'Créer une image et contrôler une affiche'] },
  { title: 'Décomposer une tâche et décider de la suite', lessons: ['Décomposer un processus manuel', 'Tester, constater et arrêter'] },
];

const objectives = [
  ['Formuler une demande claire', 'Donner un contexte, un rôle, un objectif et des précisions avec CROP, puis corriger un point sans tout refaire.'],
  ['Écrire un texte adapté', 'Préparer un courriel professionnel, comparer plusieurs propositions et garder un ton qui vous ressemble.'],
  ['Vérifier avant d’utiliser', 'Contrôler une affirmation, retrouver une source et signaler ce qui reste incertain.'],
  ['Organiser des informations', 'Résumer un document sans ajout, structurer des notes ou vérifier un planning et une affiche.'],
];

export default function FormationIagElearning() {
  const { user } = useAuth();
  return <FormationIagContent key={user?.id || 'anonymous'} user={user} />;
}

function FormationIagContent({ user }) {
  const userId = user?.id;
  const [access, setAccess] = useState(() => ({ loading: Boolean(userId), row: null, error: '' }));
  useEffect(() => {
    if (!userId) return;
    let current = true;
    fetchCourseAccessEntitlement({ userId, courseId: IAG_COURSE_ID }).then(({ data, error }) => {
      if (current) setAccess({ loading: false, row: error ? null : data, error: error ? 'Votre accès ne peut pas être vérifié pour le moment.' : '' });
    }).catch(() => {
      if (current) setAccess({ loading: false, row: null, error: 'Votre accès ne peut pas être vérifié pour le moment.' });
    });
    return () => { current = false; };
  }, [userId]);
  const active = hasUsableCourseAccess(access.row);
  const unavailableRight = access.row && !active;
  const purchase = getPurchaseConfig(IAG_COURSE_ID);
  return <>
    <SEO title="IA générative en e-learning | FormaPrompt" description="22 leçons à votre rythme, des exercices et trois corrections écrites pour apprendre à utiliser et vérifier l'IA générative." url="https://formaprompt.com/formation-ia-generative-elearning" />
    <div className="generative-ai-page iag-elearning-page">
      <section className="generative-ai-hero">
        <div className="container generative-ai-hero-grid">
          <div>
            <p className="generative-ai-kicker">IA générative — e-learning · Pour débuter</p>
            <h1>Utiliser l’IA avec méthode et garder le contrôle</h1>
            <p className="generative-ai-lead">Un courriel à rédiger, une information à vérifier, un document à résumer : apprenez à expliquer ce que vous attendez de l’IA, à vérifier sa réponse et à corriger ce qui ne convient pas.</p>
            <p>22 leçons en ligne, des démonstrations et des exercices concrets, avec trois travaux corrigés par Thierry FREZARD. Vous avancez à votre rythme.</p>
            <div className="generative-ai-actions">
              {active ? <Link className="btn btn-primary" to={`/course/${IAG_COURSE_ID}`}>Accéder à ma formation</Link>
                : <a className="btn btn-primary" href="#inscription">{access.loading ? 'Vérification de votre accès…' : access.error || unavailableRight ? 'Vérifier mon accès' : 'M’inscrire à la formation'}</a>}
              <a className="btn generative-ai-secondary-btn" href="#programme">Voir les 22 leçons</a>
            </div>
            <p className="iag-hero-price">79 € jusqu’au 31 décembre 2026 inclus, puis 99 € · Paiement unique</p>
          </div>
          <div className="generative-ai-hero-visual">
            <img src="/assets/acculturation-ia.png" alt="Illustration FormaPrompt des usages de l’IA au travail" width="1137" height="983" />
          </div>
        </div>
      </section>

      <section className="container iag-facts" aria-label="Les repères de la formation">
        {[[Clock3, 'Environ 13 heures', 'Temps de travail estimé'], [BookOpenCheck, '22 leçons', 'À votre rythme'], [FileText, 'Outils gratuits', 'Exercices en version gratuite'], [MessageSquareText, '3 travaux corrigés', 'Retours écrits personnalisés']].map(([Icon, title, detail]) => <article key={title}><Icon aria-hidden="true" /><h2>{title}</h2><p>{detail}</p></article>)}
      </section>

      <section className="container generative-ai-section">
        <div className="generative-ai-two-columns">
          <div><p className="generative-ai-kicker">À qui s’adresse ce parcours ?</p><h2>Partir de tâches que vous connaissez déjà</h2></div>
          <div><p>Pour les adultes qui débutent avec l’IA : salariés, indépendants, formateurs ou toute personne qui rédige, recherche et organise des informations au quotidien. Aucun savoir en programmation n’est nécessaire.</p><p>Prévoyez un ordinateur, une connexion Internet et un navigateur. Vous devez pouvoir copier-coller un texte et conserver vos essais. Les activités utilisent les versions gratuites des outils : aucun abonnement IA payant n’est demandé.</p><p>Vous travaillez sur des situations fictives, sans confier de données personnelles ou confidentielles aux assistants.</p></div>
        </div>
      </section>

      <section className="generative-ai-objectives-section">
        <div className="container"><div className="generative-ai-section-heading"><p className="generative-ai-kicker">Ce que vous saurez faire</p><h2>Des usages simples, des résultats à vérifier</h2></div>
          <div className="generative-ai-objectives">{objectives.map(([title, description]) => <article key={title}><CheckCircle2 aria-hidden="true" /><h3>{title}</h3><p>{description}</p></article>)}</div>
        </div>
      </section>

      <section id="programme" className="container generative-ai-section" aria-labelledby="iag-programme-title">
        <div className="generative-ai-section-heading"><p className="generative-ai-kicker">Le programme</p><h2 id="iag-programme-title">22 leçons, en sept étapes</h2><p>Découvrez les explications écrites et les vidéos, essayez par vous-même, puis comparez et améliorez votre résultat.</p></div>
        <div className="iag-programme">{modules.map((module, index) => <details key={module.title} open={index === 0}><summary><span>Étape {index + 1}</span><h3>{module.title}</h3><span>{module.lessons.length} leçons</span></summary><ol start={modules.slice(0, index).reduce((sum, item) => sum + item.lessons.length, 1)}>{module.lessons.map(title => <li key={title}>{title}</li>)}</ol></details>)}</div>
      </section>

      <section className="iag-tinted-section">
        <div className="container generative-ai-section"><div className="generative-ai-section-heading"><p className="generative-ai-kicker">Après votre inscription</p><h2>Un parcours autonome, avec des retours sur vos travaux</h2></div>
          <ol className="iag-journey"><li><h3>Faites le point pour commencer</h3><p>Avant l’accès aux leçons, le questionnaire de départ est obligatoire. Six questions permettent de repérer ce qui vous aidera à commencer. Ce questionnaire n’est pas noté et ne demande aucun niveau minimal.</p></li><li><h3>Regardez, essayez et vérifiez</h3><p>Alternez leçons et exercices, conservez vos demandes et vos réponses, puis contrôlez ce qui a été produit. FormaPrompt Studio reste facultatif, mais conseillé !</p></li><li><h3>Envoyez vos trois travaux</h3><p>Un courriel professionnel ; une recherche et un travail sur documents ; un projet final avec des essais réels sur deux assistants texte.</p></li><li><h3>Recevez un retour et reprenez votre travail</h3><p>Trois corrections écrites personnalisées sont comprises. Chaque retour est prévu sous deux jours calendaires après réception, week-ends et jours fériés compris. Une nouvelle remise du même travail est incluse pour chacun des trois travaux.</p></li></ol>
          <p>Chaque travail est noté sur 20. La décision de validation du formateur est distincte de cette note. Aucune visioconférence n’est comprise.</p>
        </div>
      </section>

      <section className="container generative-ai-section" aria-labelledby="iag-access-assistance-title">
        <div className="generative-ai-section-heading"><h2 id="iag-access-assistance-title">Accès et assistance</h2></div>
        <h3>Accès au parcours e-learning</h3>
        <p>Votre accès à la formation est activé immédiatement après confirmation du paiement, hors incident technique. Le questionnaire de départ est obligatoire avant l’accès aux leçons. Si votre formation n’apparaît pas dans votre espace apprenant, contactez <a href="mailto:thierry@formaprompt.com">thierry@formaprompt.com</a>.</p>
        <h3>Assistance</h3>
        <p>Pour une difficulté de connexion ou une question sur votre parcours, contactez Thierry FREZARD à <a href="mailto:thierry@formaprompt.com">thierry@formaprompt.com</a>. Une réponse vous est apportée sous deux jours ouvrés. Les corrections des travaux restent prévues sous deux jours calendaires après réception.</p>
      </section>

      <section className="container generative-ai-section" aria-labelledby="iag-certificates-title">
        <div className="generative-ai-section-heading"><p className="generative-ai-kicker">Les certificats FormaPrompt</p><h2 id="iag-certificates-title">Distinguer la fin du parcours et la réussite</h2></div>
        <div className="iag-certificate-grid"><article className="card"><h3>Certificat de fin de formation</h3><p>Avec un accès actif, après le questionnaire de départ et la déclaration de votre identité, vous pouvez le demander lorsque les 22 leçons sont indiquées comme terminées. Il ne vaut pas validation automatique de vos compétences.</p></article><article className="card"><h3>Certificat de réussite</h3><p>La mention Réussite est ajoutée après les trois validations humaines du formateur et les essais réels attendus, dont deux assistants texte pour le projet final. Aucun seuil de note ne la déclenche automatiquement.</p></article></div>
      </section>

      <section id="inscription" className="iag-pricing-section" aria-labelledby="iag-price-title">
        <div className="container iag-pricing-grid"><div><p className="generative-ai-kicker">La formation complète</p><h2 id="iag-price-title">Un paiement unique</h2><p className="iag-price">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(purchase.amountTotal / 100)}</p><p>79 € jusqu’au 31 décembre 2026 inclus, puis 99 € à partir du 1er janvier 2027.</p><ul><li>Les 22 leçons, vidéos, supports et exercices.</li><li>Trois corrections écrites et une nouvelle remise par travail.</li><li>Les certificats selon les conditions indiquées ci-dessus.</li></ul><p>Accès sans limitation de durée prédéfinie tant que le service et la formation sont exploités.</p><p>Vous préférez une formation accompagnée ? <Link to="/formation-ia-generative">Découvrez le parcours de 10 heures à 497 €.</Link></p></div>
          <div className="iag-checkout-card">{access.error ? <p role="alert">{access.error}</p> : unavailableRight ? <p>Un accès existe déjà pour ce compte. <Link to="/contact">Contactez FormaPrompt pour vérifier sa situation.</Link></p> : <CommercialCheckout courseId={IAG_COURSE_ID} purchaseConfig={purchase} user={user} accessLoading={access.loading} hasActiveAccess={active} activeAccessActions={<Link className="btn btn-primary" to={`/course/${IAG_COURSE_ID}`}>Accéder à ma formation</Link>} priceLabel={new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(purchase.amountTotal / 100)} />}</div>
        </div>
      </section>

      <section className="container generative-ai-section iag-faq" aria-labelledby="iag-faq-title"><div className="generative-ai-section-heading"><p className="generative-ai-kicker">Questions pratiques</p><h2 id="iag-faq-title">Avant de commencer</h2></div>
        <details><summary>Faut-il déjà connaître les outils d’IA ?</summary><p>Non. Le parcours commence par les usages, la formulation d’une demande et la vérification des réponses. Vous apprendrez progressivement à comparer plusieurs assistants.</p></details>
        <details><summary>Faut-il un abonnement payant à un assistant ?</summary><p>Non. Les exercices sont prévus avec les versions gratuites. Leurs limites peuvent varier ; vous pouvez fractionner vos essais et conserver vos textes pour reprendre plus tard.</p></details>
        <details><summary>Comment adapter le parcours à mes besoins ?</summary><p>Les supports écrits et les transcriptions accompagnent les leçons. Utilisez les sous-titres disponibles, agrandissez le texte et fractionnez votre travail. <Link to="/contact">Contactez FormaPrompt pour préparer une adaptation.</Link></p></details>
        <details><summary>Où retrouver ma formation après inscription ?</summary><p>Connectez-vous à votre espace apprenant. Si votre accès est actif, le bouton « Accéder à ma formation » vous conduit directement au parcours.</p></details>
      </section>
    </div>
  </>;
}

