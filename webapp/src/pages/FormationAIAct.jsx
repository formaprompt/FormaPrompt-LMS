import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Accessibility,
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  CheckCircle,
  Clock,
  MonitorPlay,
  ShieldCheck,
  Users,
} from 'lucide-react';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import './FormationAIAct.css';

const officialSources = [
  {
    label: 'Règlement (UE) 2024/1689 – EUR-Lex',
    href: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=fr',
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
      "Comprendre l'obligation de maîtrise de l'IA prévue à l'article 4",
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
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    async function checkPurchase() {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('course_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', 'formation-ia-act')
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .limit(1);

      if (!error && data?.length > 0) setHasPurchased(true);
      setLoading(false);
    }

    checkPurchase();
  }, [user]);

  async function startCheckout() {
    if (!user || checkoutLoading) return;

    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { course_id: 'formation-ia-act' },
      });

      if (error) throw error;
      if (data?.alreadyPurchased) {
        setHasPurchased(true);
        return;
      }

      const checkoutUrl = new URL(data?.url);
      if (checkoutUrl.protocol !== 'https:') throw new Error('URL Stripe invalide.');
      window.location.assign(checkoutUrl.toString());
    } catch (error) {
      console.error('Ouverture de Stripe Checkout impossible :', error);
      setCheckoutError(
        "Le paiement ne peut pas être ouvert pour le moment. Vérifiez votre connexion ou réessayez dans quelques instants.",
      );
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <>
      <SEO
        title="Formation AI Act : acculturation et préparation à la conformité – FormaPrompt"
        description="Formation estimée à 4 h 45 pour comprendre l'AI Act, acculturer les équipes et préparer un premier plan d'action avant l'application générale du 2 août 2026."
        url="https://formaprompt.com/formation-ia-act-conformite"
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

              <div className="ai-act-key-facts" aria-label="Informations principales">
                <span><Clock size={19} aria-hidden="true" /> 4 h 45 estimées</span>
                <span><MonitorPlay size={19} aria-hidden="true" /> Classe virtuelle ou présentiel</span>
                <span><CalendarClock size={19} aria-hidden="true" /> Repère : 2 août 2026</span>
              </div>

              <div className="ai-act-hero-actions">
                <a href="#inscription" className="btn btn-primary">Voir le tarif et s'inscrire</a>
                <a href="#programme" className="btn ai-act-secondary-btn">Consulter le programme</a>
              </div>
            </div>

            <aside className="ai-act-deadline-card" aria-label="Repères réglementaires">
              <ShieldCheck size={44} aria-hidden="true" />
              <p className="ai-act-deadline-label">Échéance-clé</p>
              <p className="ai-act-deadline-date">2 août 2026</p>
              <p>
                Date d'application générale de nombreuses dispositions du règlement, avec des exceptions et
                des périodes transitoires selon les obligations concernées.
              </p>
              <div className="ai-act-already-active">
                <CheckCircle size={20} aria-hidden="true" />
                <span>L'obligation de maîtrise de l'IA de l'article 4 s'applique depuis le 2 février 2025.</span>
              </div>
            </aside>
          </div>
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
            <p className="ai-act-kicker">Programme – 4 h guidées + 45 min d’e-learning</p>
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
              <article><strong>Durée</strong><span>4 h 45 estimées : 45 min d’e-learning et 4 h avec le formateur</span></article>
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
                La formation comprend le quiz préalable, environ 45 minutes d’e-learning et 4 heures guidées avec
                le formateur, en classe virtuelle ou en présentiel dans les conditions précisées ci-dessous.
              </p>
            </div>
            <div className="ai-act-price-card">
              <p className="ai-act-old-price">Tarif habituel : <span>320 €</span></p>
              <p className="ai-act-price">187 €</p>
              <p className="ai-act-price-note">Tarif promotionnel</p>
              {!loading && hasPurchased ? (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <Link to="/course/formation-ia-act" className="btn btn-primary">
                    Accéder à ma formation
                  </Link>
                  <Link to="/reservation-formation" className="btn ai-act-secondary-btn">
                    Réserver mes 4 heures
                  </Link>
                </div>
              ) : user ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={startCheckout}
                  disabled={loading || checkoutLoading}
                >
                  {checkoutLoading ? 'Ouverture du paiement sécurisé…' : 'Acheter la formation – 187 €'}
                </button>
              ) : (
                <Link to="/login" className="btn btn-primary">
                  Se connecter pour acheter
                </Link>
              )}
              {checkoutError && (
                <p className="ai-act-checkout-error" role="alert">{checkoutError}</p>
              )}
              <p className="ai-act-contact-note">
                Paiement sécurisé par Stripe. L'accès est activé automatiquement après confirmation.
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
            <p className="ai-act-sources-title">Sources officielles consultées :</p>
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
