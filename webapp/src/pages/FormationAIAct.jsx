import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Accessibility,
  AlertTriangle,
  BookOpenCheck,
  CheckCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';
import SEO from '../components/SEO';
import CourseSummary from '../components/CourseSummary';
import CommercialCheckout from '../components/CommercialCheckout';
import { useAuth } from '../contexts/useAuth';
import { fetchActiveCourseAccess } from '../lib/courseAccess';
import { getBookingUrl } from '../data/bookingCatalog';
import { SITE_CONFIG } from '../config/site';
import './FormationAIAct.css';

const officialSources = [
  {
    label: 'AI Omnibus entré en vigueur le 27 juillet 2026 - Commission européenne',
    href: 'https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force',
  },
  {
    label: 'Calendrier actualisé - AI Act Service Desk',
    href: 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/timeline/timeline-implementation-eu-ai-act',
  },
  {
    label: 'Article 4 actuel - AI Act Service Desk',
    href: 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-4',
  },
  {
    label: 'AI Act consolidé au 27 juillet 2026 - EUR-Lex',
    href: 'https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02024R1689-20260727',
  },
  {
    label: "Calendrier d'application – Commission européenne",
    href: 'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai',
  },
  {
    label: "Questions-réponses sur la maîtrise de l'IA – Commission européenne",
    href: 'https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers',
  },
];

const applicationTimeline = [
  ['2 février 2025', "Premières interdictions et dispositions générales, dont la maîtrise de l'IA."],
  ['2 août 2025', "Gouvernance et obligations relatives aux modèles d'IA à usage général."],
  ['27 juillet 2026', "Entrée en vigueur du règlement modificatif (UE) 2026/1744 (AI Omnibus)."],
  ['2 août 2026', "Application générale, notamment transparence (article 50), sous réserve des exceptions et transitions."],
  ['2 décembre 2026', "Nouvelles interdictions visant les contenus sexuels non consentis et pédocriminels générés par IA ; échéance transitoire de l'article 50(2) pour certains systèmes déjà commercialisés avant le 2 août 2026."],
  ['2 décembre 2027', "Règles relatives aux systèmes d'IA à haut risque de l'annexe III."],
  ['2 août 2028', "Règles relatives aux systèmes d'IA à haut risque intégrés aux produits réglementés de l'annexe I."],
];

const modules = [
  {
    number: '01',
    title: "Comprendre l'IA et son cadre européen",
    duration: '1 h',
    items: [
      "Repères simples sur les systèmes d'IA et l'IA générative",
      "Calendrier progressif d'application de l'AI Act",
      'Rôles possibles : fournisseur, déployeur et autres opérateurs',
    ],
  },
  {
    number: '02',
    title: 'Identifier les usages et les niveaux de vigilance',
    duration: '1 h',
    items: [
      "Cartographie des outils et des usages de l'IA",
      'Pratiques interdites, transparence et systèmes à haut risque',
      'Données personnelles, confidentialité et validation humaine',
    ],
  },
  {
    number: '03',
    title: "Organiser l'acculturation des équipes",
    duration: '1 h',
    items: [
      "Comprendre les mesures adaptées de soutien à la maîtrise de l'IA (article 4 actuel)",
      'Adapter le niveau de formation aux fonctions et aux usages',
      'Tracer les actions réalisées sans collecter de données inutiles',
    ],
  },
  {
    number: '04',
    title: "Préparer un plan d'action réaliste",
    duration: '1 h',
    items: [
      'Prioriser les actions à court terme',
      'Définir des règles internes et des responsabilités',
      'Repérer les sujets qui exigent un avis juridique ou technique spécialisé',
    ],
  },
];

export default function FormationAIAct() {
  const { user } = useAuth();
  const [hasPurchased, setHasPurchased] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkPurchase() {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await fetchActiveCourseAccess(user.id, 'formation-ia-act');

      if (!error && data) setHasPurchased(true);
      setLoading(false);
    }

    checkPurchase();
  }, [user]);

  return (
    <>
      <SEO
        title="Formation AI Act : acculturation IA pour les équipes | FormaPrompt"
        description="Formation AI Act : comprendre le cadre européen, repérer les usages à encadrer et préparer un premier plan d’action adapté à l’organisation."
        url={`${SITE_CONFIG.baseUrl}/formation-ia-act-conformite`}
        image="https://formaprompt.com/assets/IA%20ACT%20Blog.png"
      />

      <main className="ai-act-page">
        <section className="ai-act-hero">
          <div className="container ai-act-hero-grid">
            <div>
              <p className="ai-act-kicker">Formation professionnelle multimodale</p>
              <h1>IA : acculturation et préparation à la conformité AI Act</h1>
              <p className="ai-act-lead">
                Comprendre les règles essentielles, repérer les usages à encadrer et construire un premier plan
                d'action adapté à votre organisation.
              </p>

              <CourseSummary
                id="formation-ai-act-summary"
                items={[
                  { label: 'Durée', value: '4 h 45 estimées, dont 4 heures guidées' },
                  { label: 'Public', value: 'Dirigeants, équipes support, référents IA et formateurs' },
                  { label: 'Modalités', value: 'Classe virtuelle ou présentiel' },
                  { label: 'Objectif', value: 'Préparer un premier plan d’action adapté à l’organisation' },
                  { label: 'Tarif individuel', value: '187 € par apprenant, tarif promotionnel' },
                ]}
              />

              <div className="ai-act-hero-actions">
                <a href="#inscription" className="btn btn-primary">Voir le tarif et s'inscrire</a>
                <a href="#programme" className="btn ai-act-secondary-btn">Consulter le programme</a>
              </div>
            </div>

            <aside className="ai-act-deadline-card" aria-label="Repères réglementaires">
              <ShieldCheck size={44} aria-hidden="true" />
              <p className="ai-act-deadline-label">Application générale</p>
              <p className="ai-act-deadline-date">2 août 2026</p>
              <p>
                Date d'application générale de nombreuses dispositions du règlement, avec des exceptions et
                des périodes transitoires selon les obligations concernées.
              </p>
              <div className="ai-act-already-active">
                <CheckCircle size={20} aria-hidden="true" />
                <span>Article 4 applicable depuis le 2 février 2025, modifié le 27 juillet 2026 : soutenir la maîtrise de l'IA par des mesures adaptées, sans garantir un niveau individuel particulier.</span>
              </div>
            </aside>
          </div>
        </section>

        <section className="container ai-act-section" aria-labelledby="ai-act-calendar-title">
          <div className="ai-act-section-heading">
            <p className="ai-act-kicker">Repères vérifiés le 2 novembre 2026</p>
            <h2 id="ai-act-calendar-title">Un calendrier d'application progressif</h2>
            <p>Le modificatif (UE) 2026/1744 est entré en vigueur le 27 juillet 2026. Les échéances ci-dessous intègrent ce texte adopté ; l'obligation précise reste à vérifier pour chaque système et chaque rôle.</p>
          </div>
          <ol className="ai-act-check-list">
            {applicationTimeline.map(([date, description]) => (
              <li key={date}><strong>{date} :</strong> {description}</li>
            ))}
          </ol>
          <p>Les exigences spécifiques de supervision humaine des articles 14 et 26 concernent les systèmes à haut risque selon leur calendrier et leurs conditions d'application. Elles se distinguent des mesures générales de l'article 4.</p>
        </section>

        <section className="container ai-act-section">
          <div className="ai-act-section-heading">
            <p className="ai-act-kicker">Finalité de la formation</p>
            <h2>Passer des textes à une première démarche concrète</h2>
            <p>
              Cette formation d'acculturation donne des repères opérationnels aux structures qui utilisent ou
              envisagent d'utiliser des systèmes d'IA. Elle aide à poser les bonnes questions et à identifier
              les sujets qui nécessitent une expertise complémentaire.
            </p>
            <p>
              Pour développer des usages professionnels à encadrer, découvrez la{' '}
              <Link to="/formation-ia-generative">formation IA générative</Link>.
            </p>
            <p>
              <strong>Pour aller plus loin :</strong>{' '}
              <Link to="/guides/checklist-ai-act-organisme-formation">la checklist AI Act pour un organisme de formation</Link>.
            </p>
          </div>

          <div className="ai-act-objectives-grid">
            <article>
              <BookOpenCheck size={30} aria-hidden="true" />
              <h3>Comprendre</h3>
              <p>Identifier les grands principes, les acteurs et le calendrier progressif de l'AI Act.</p>
            </article>
            <article>
              <ShieldCheck size={30} aria-hidden="true" />
              <h3>Repérer</h3>
              <p>Reconnaître les usages qui demandent davantage de vigilance ou une analyse spécialisée.</p>
            </article>
            <article>
              <CheckCircle size={30} aria-hidden="true" />
              <h3>Agir</h3>
              <p>Ébaucher une cartographie des usages et un plan d'acculturation adapté aux équipes.</p>
            </article>
          </div>
        </section>

        <section className="ai-act-audience-section">
          <div className="container ai-act-two-columns">
            <div>
              <Users size={36} aria-hidden="true" />
              <h2>Public visé</h2>
              <ul className="ai-act-check-list">
                <li>Dirigeants de TPE et PME</li>
                <li>Managers, équipes RH et fonctions support</li>
                <li>Référents numériques, qualité, RGPD ou IA</li>
                <li>Formateurs et responsables pédagogiques</li>
                <li>Salariés amenés à utiliser des outils d'IA</li>
              </ul>
            </div>
            <div>
              <BookOpenCheck size={36} aria-hidden="true" />
              <h2>Prérequis</h2>
              <p>
                Aucun prérequis juridique ou technique. Il suffit de savoir utiliser un navigateur et de
                disposer d'un ordinateur connecté à Internet.
              </p>
              <p>
                Un quiz de positionnement est proposé avant le premier contenu afin d'identifier votre niveau
                de départ. Il ne s'agit pas d'un examen.
              </p>
            </div>
          </div>
        </section>

        <section id="programme" className="container ai-act-section">
          <div className="ai-act-section-heading">
            <p className="ai-act-kicker">Programme – 4 h guidées, pour une durée totale estimée à 4 h 45</p>
            <h2>Quatre étapes pour structurer votre préparation</h2>
          </div>
          <div className="ai-act-modules">
            {modules.map((module) => (
              <article key={module.number} className="ai-act-module-card">
                <div className="ai-act-module-number">{module.number}</div>
                <div>
                  <div className="ai-act-module-title-row">
                    <h3>{module.title}</h3>
                    <span>{module.duration}</span>
                  </div>
                  <ul>
                    {module.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ai-act-method-section">
          <div className="container">
            <div className="ai-act-section-heading">
              <p className="ai-act-kicker">Modalités pédagogiques</p>
              <h2>Un parcours court, guidé et applicable</h2>
            </div>
            <div className="ai-act-method-grid">
              <article><strong>Durée</strong><span>4 h 45 estimées, dont 4 h avec le formateur</span></article>
              <article><strong>Modalités</strong><span>Classe virtuelle en 1 × 4 h, 2 × 2 h ou 4 × 1 h ; présentiel en 1 × 4 h ou 2 × 2 h</span></article>
              <article><strong>Méthodes</strong><span>Vidéos sous-titrées, échanges guidés, exemples et exercices pratiques</span></article>
              <article><strong>Évaluation</strong><span>Quiz préalable, activités d'application et plan d'action</span></article>
              <article><strong>Résultat attendu</strong><span>Une première feuille de route à faire valider selon votre contexte</span></article>
            </div>
          </div>
        </section>

        <section className="container ai-act-section">
          <div className="ai-act-accessibility-card">
            <Accessibility size={34} aria-hidden="true" />
            <div>
              <h2>Accessibilité</h2>
              <p>
                La première vidéo est sous-titrée. Pour étudier une adaptation liée à une situation de handicap,
                contactez FormaPrompt avant l'inscription afin d'identifier les aménagements possibles.
              </p>
              <Link to="/contact">Contacter FormaPrompt au sujet de l'accessibilité</Link>
            </div>
          </div>
        </section>

        <section id="inscription" className="ai-act-pricing-section">
          <div className="container ai-act-pricing-grid">
            <div>
              <p className="ai-act-kicker">Tarif promotionnel</p>
              <h2>Accéder au parcours complet</h2>
              <p>
                La formation comprend le quiz préalable et 4 heures guidées avec le formateur, en classe virtuelle
                ou en présentiel. Sa durée totale estimée est de 4 h 45.
              </p>
            </div>
            <div className="ai-act-price-card">
              <p className="ai-act-old-price">Tarif habituel : <span>320 €</span></p>
              <p className="ai-act-price">187 €</p>
              <p className="ai-act-price-note">Tarif promotionnel</p>
              <CommercialCheckout
                courseId="formation-ia-act"
                user={user}
                accessLoading={loading}
                hasActiveAccess={hasPurchased}
                priceLabel="187 €"
                activeAccessActions={(
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <Link to="/course/formation-ia-act" className="btn btn-primary">
                      Accéder à ma formation
                    </Link>
                    <Link to={getBookingUrl('formation-ia-act')} className="btn ai-act-secondary-btn">
                      Réserver mes 4 heures
                    </Link>
                  </div>
                )}
              />
              <p className="ai-act-contact-note">
                Lorsqu’il est disponible, le paiement est sécurisé par Stripe et suit le parcours contractuel affiché avant la redirection.
              </p>
              <p className="ai-act-contact-note">
                Avant tout achat, consultez les <Link to="/cgv-particuliers">CGV particuliers</Link>, le{' '}
                <Link to="/reglement-interieur">règlement intérieur</Link> et les{' '}
                <Link to="/informations-precontractuelles">informations précontractuelles</Link>.
              </p>
              <p className="ai-act-contact-note">
                En présentiel dans un rayon maximal de 100 km autour de Calais : déplacement inclus pour 1 × 4 h ;
                participation unique de 30 € pour 2 × 2 h, demandée seulement après validation de la distance.
              </p>
              <p className="ai-act-contact-note">
                Votre numéro de téléphone est demandé au paiement afin que le formateur puisse vous contacter pour
                personnaliser la formation. Il n'est pas utilisé à des fins commerciales sans votre accord.
              </p>
            </div>
          </div>
        </section>

        <section className="container ai-act-legal-note">
          <AlertTriangle size={28} aria-hidden="true" />
          <div>
            <h2>Portée de cette formation</h2>
            <p>
              Cette action constitue une formation d'acculturation et de préparation. Elle ne remplace pas un
              audit de conformité, un conseil juridique ou l'analyse d'un système d'IA particulier. Les obligations
              applicables dépendent notamment du rôle de l'organisation, de l'usage et du niveau de risque du système.
            </p>
            <p className="ai-act-sources-title">Sources officielles consultées le 2 novembre 2026 :</p>
            <ul>
              {officialSources.map((source) => (
                <li key={source.href}>
                  <a href={source.href} target="_blank" rel="noreferrer">{source.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
