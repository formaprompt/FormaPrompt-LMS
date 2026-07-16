import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Accessibility,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FileText,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import SEO from '../components/SEO'
import { useAuth } from '../contexts/useAuth'
import { getBookingUrl } from '../data/bookingCatalog'
import { supabase } from '../lib/supabaseClient'
import './FormationIA.css'

const COURSE_ID = 'formation-ia'

const objectives = [
  {
    title: 'Comprendre',
    description: "Expliquer simplement le fonctionnement général et les limites d'une IA générative.",
    icon: Sparkles,
  },
  {
    title: 'Identifier',
    description: 'Repérer les usages réellement utiles dans son contexte professionnel ou pédagogique.',
    icon: Target,
  },
  {
    title: 'Formuler',
    description: 'Structurer une demande claire, contextualisée et adaptée au résultat attendu.',
    icon: FileText,
  },
  {
    title: 'Produire',
    description: 'Rédiger, reformuler, synthétiser et organiser des contenus avec une validation humaine.',
    icon: BookOpenCheck,
  },
  {
    title: 'Vérifier',
    description: 'Contrôler les faits, les sources, les biais possibles et la qualité des réponses.',
    icon: CheckCircle2,
  },
  {
    title: 'Sécuriser',
    description: 'Protéger les données et construire des pratiques responsables adaptées à son activité.',
    icon: ShieldCheck,
  },
]

const program = [
  {
    number: '01',
    duration: '2 h',
    title: "Comprendre l'IA générative et ses usages",
    items: [
      "Définir simplement l'IA générative et le rôle des principaux assistants",
      'Distinguer moteur de recherche, chatbot et assistant IA',
      'Identifier les possibilités, les limites et les besoins professionnels pertinents',
    ],
  },
  {
    number: '02',
    duration: '2 h',
    title: 'Dialoguer avec une IA et structurer ses demandes',
    items: [
      'Préciser objectif, contexte, public, contraintes et format attendu',
      'Utiliser des exemples et demander des questions de clarification',
      'Analyser puis améliorer progressivement un premier résultat',
    ],
  },
  {
    number: '03',
    duration: '2 h',
    title: 'Produire des contenus professionnels',
    items: [
      'Rédiger, reformuler et adapter un contenu à différents destinataires',
      'Synthétiser une information et préparer une trame ou un support',
      'Comparer plusieurs propositions avant de choisir et finaliser un résultat',
    ],
  },
  {
    number: '04',
    duration: '2 h',
    title: "Vérifier, sécuriser et utiliser l'IA de façon responsable",
    items: [
      'Repérer les hallucinations, approximations et biais possibles',
      'Protéger les données personnelles, sensibles et confidentielles',
      'Aborder les sources, la propriété intellectuelle et la validation humaine',
    ],
  },
  {
    number: '05',
    duration: '2 h',
    title: "Mettre en pratique et préparer son plan d'utilisation",
    items: [
      'Réaliser un cas pratique adapté à son activité',
      'Présenter et justifier les choix effectués',
      "Construire un plan d'action individuel et identifier les prochaines étapes",
    ],
  },
]

export default function FormationIA() {
  const { user } = useAuth()
  const [hasPurchased, setHasPurchased] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  useEffect(() => {
    async function checkPurchase() {
      if (!user) {
        setHasPurchased(false)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', COURSE_ID)
        .limit(1)

      setHasPurchased(Boolean(data?.length))
      setLoading(false)
    }

    checkPurchase()
  }, [user])

  async function startCheckout() {
    if (!user || checkoutLoading) return

    setCheckoutLoading(true)
    setCheckoutError('')

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { course_id: COURSE_ID },
      })

      if (error) throw error
      if (data?.alreadyPurchased) {
        setHasPurchased(true)
        return
      }

      const checkoutUrl = new URL(data?.url)
      if (checkoutUrl.protocol !== 'https:') throw new Error('URL Stripe invalide.')
      window.location.assign(checkoutUrl.toString())
    } catch (error) {
      console.error('Ouverture de Stripe Checkout impossible :', error)
      setCheckoutError(
        'Le paiement ne peut pas être ouvert pour le moment. Réessayez dans quelques instants ou contactez FormaPrompt.',
      )
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <>
      <SEO
        title="Formation IA générative de 10 heures | FormaPrompt"
        description="Formation professionnelle de 10 heures pour comprendre l'IA générative, développer des usages concrets, vérifier les résultats et protéger les données."
        url="https://www.formaprompt.fr/formation-ia-generative"
        image="https://www.formaprompt.fr/assets/acculturation-ia.png"
      />

      <main className="generative-ai-page">
        <section className="generative-ai-hero">
          <div className="container generative-ai-hero-grid">
            <div>
              <p className="generative-ai-kicker">Formation professionnelle · Acculturation et pratique</p>
              <h1>IA générative : comprendre, pratiquer et sécuriser ses usages</h1>
              <p className="generative-ai-lead">
                Une formation accompagnée pour intégrer l&apos;IA dans son activité avec méthode, recul critique et
                validation humaine, à partir de situations professionnelles concrètes.
              </p>
              <div className="generative-ai-facts" aria-label="Informations principales">
                <span><Clock3 size={19} aria-hidden="true" /> 10 heures accompagnées</span>
                <span><MonitorPlay size={19} aria-hidden="true" /> Présentiel ou classe virtuelle</span>
                <span><Users size={19} aria-hidden="true" /> Tarif individuel : 497 €</span>
              </div>
              <div className="generative-ai-actions">
                <a href="#inscription" className="btn btn-primary">Voir le tarif et s&apos;inscrire</a>
                <a href="#programme" className="btn generative-ai-secondary-btn">Consulter le programme</a>
              </div>
            </div>
            <div className="generative-ai-hero-visual">
              <img
                src="/assets/acculturation-ia.png"
                alt="Illustration de la formation aux usages professionnels de l'IA générative"
              />
            </div>
          </div>
        </section>

        <section className="container generative-ai-section">
          <div className="generative-ai-introduction">
            <div>
              <p className="generative-ai-kicker">Finalité de la formation</p>
              <h2>Passer de la découverte à des usages professionnels maîtrisés</h2>
            </div>
            <div>
              <p>
                L&apos;objectif n&apos;est pas de présenter l&apos;IA comme une solution automatique. Les participants apprennent
                à choisir les usages pertinents, à formuler leurs demandes, à contrôler les résultats et à protéger
                les informations confiées aux outils.
              </p>
              <p>
                Les exemples et exercices sont adaptés au niveau initial, au métier et aux situations rencontrées
                par chaque participant.
              </p>
            </div>
          </div>
        </section>

        <section className="generative-ai-objectives-section">
          <div className="container">
            <div className="generative-ai-section-heading">
              <p className="generative-ai-kicker">Objectifs pédagogiques</p>
              <h2>Six compétences directement mobilisables</h2>
              <p>À l&apos;issue de la formation, le participant sera capable de :</p>
            </div>
            <div className="generative-ai-objectives">
              {objectives.map((objective) => {
                const Icon = objective.icon
                return (
                  <article key={objective.title}>
                    <Icon aria-hidden="true" />
                    <h3>{objective.title}</h3>
                    <p>{objective.description}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="container generative-ai-section">
          <div className="generative-ai-two-columns">
            <article>
              <Users size={36} aria-hidden="true" />
              <h2>Public visé</h2>
              <ul>
                <li>Salariés, indépendants, dirigeants et fonctions support</li>
                <li>Formateurs, responsables pédagogiques et professionnels de l&apos;accompagnement</li>
                <li>Adultes en reconversion ou en évolution professionnelle</li>
              </ul>
            </article>
            <article>
              <BookOpenCheck size={36} aria-hidden="true" />
              <h2>Prérequis et positionnement</h2>
              <p>Aucun prérequis technique en intelligence artificielle n&apos;est exigé.</p>
              <p>
                Il est nécessaire de savoir utiliser un ordinateur, un navigateur et les outils numériques courants.
                Un questionnaire initial permet d&apos;adapter les exemples et l&apos;accompagnement au niveau du participant.
              </p>
            </article>
          </div>
        </section>

        <section id="programme" className="generative-ai-program-section">
          <div className="container">
            <div className="generative-ai-section-heading">
              <p className="generative-ai-kicker">Programme · 10 h</p>
              <h2>Un parcours progressif en cinq modules</h2>
              <p>Chaque module associe des repères, une démonstration, une mise en pratique et un temps de retour.</p>
            </div>
            <div className="generative-ai-program">
              {program.map((module) => (
                <article key={module.number}>
                  <div className="generative-ai-module-meta">
                    <span aria-hidden="true">{module.number}</span>
                    <strong>{module.duration}</strong>
                  </div>
                  <div>
                    <h3>{module.title}</h3>
                    <ul>
                      {module.items.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="generative-ai-methods-section">
          <div className="container">
            <div className="generative-ai-section-heading">
              <p className="generative-ai-kicker">Organisation pédagogique</p>
              <h2>Deux modalités, un même volume d&apos;accompagnement</h2>
            </div>
            <div className="generative-ai-methods">
              <article>
                <Clock3 aria-hidden="true" />
                <strong>Durée et rythme</strong>
                <span>10 h : 2 séances de 5 h en présentiel ; 4 séances de 2 h 30 ou 3 séances de 4 h + 4 h + 2 h en classe virtuelle.</span>
              </article>
              <article>
                <MonitorPlay aria-hidden="true" />
                <strong>Méthodes</strong>
                <span>Apports courts, démonstrations, essais guidés, analyse de réponses et exercices progressifs.</span>
              </article>
              <article>
                <CheckCircle2 aria-hidden="true" />
                <strong>Évaluation</strong>
                <span>Positionnement initial, activités par module, cas pratique final et restitution.</span>
              </article>
              <article>
                <FileText aria-hidden="true" />
                <strong>Ressources</strong>
                <span>Aide-mémoire, guide de structuration, grille de vérification et ressources accessibles dans l&apos;espace apprenant.</span>
              </article>
            </div>
          </div>
        </section>

        <section className="container generative-ai-section generative-ai-support-grid">
          <article className="generative-ai-support-card">
            <ShieldCheck aria-hidden="true" />
            <div>
              <p className="generative-ai-kicker">Pratique responsable</p>
              <h2>Des contrôles intégrés aux exercices</h2>
              <p>
                Les activités rappellent les données à ne pas transmettre, les vérifications à effectuer et la place
                de la validation humaine avant toute utilisation professionnelle d&apos;un résultat.
              </p>
            </div>
          </article>
          <article className="generative-ai-support-card">
            <Accessibility aria-hidden="true" />
            <div>
              <p className="generative-ai-kicker">Accessibilité</p>
              <h2>Étudier les adaptations avant l&apos;inscription</h2>
              <p>
                Contactez FormaPrompt pour examiner les ajustements possibles concernant les supports, le rythme ou
                les modalités de participation.
              </p>
              <Link to="/contact">Échanger au sujet d&apos;un besoin particulier</Link>
            </div>
          </article>
        </section>

        <section id="inscription" className="generative-ai-pricing-section">
          <div className="container generative-ai-pricing-grid">
            <div>
              <p className="generative-ai-kicker">Tarif individuel</p>
              <h2>10 heures accompagnées et des ressources accessibles dans l&apos;espace apprenant</h2>
              <p>
                Le tarif comprend le positionnement initial, les cinq modules, les exercices, le cas pratique final et
                les ressources pédagogiques. Pour un groupe ou une entreprise, le programme et le tarif sont adaptés
                sur devis.
              </p>
              <Link to="/contact" className="generative-ai-text-link">Demander un devis pour un groupe</Link>
            </div>
            <div className="generative-ai-price-card">
              <p className="generative-ai-price">497 €</p>
              <p className="generative-ai-price-note">par apprenant · 10 heures accompagnées</p>
              {!loading && hasPurchased ? (
                <div className="generative-ai-price-actions">
                  <Link to={`/course/${COURSE_ID}`} className="btn btn-primary">Accéder à ma formation</Link>
                  <Link to={getBookingUrl(COURSE_ID)} className="btn generative-ai-secondary-btn">Réserver mes 10 heures</Link>
                </div>
              ) : user ? (
                <button type="button" className="btn btn-primary" onClick={startCheckout} disabled={loading || checkoutLoading}>
                  {checkoutLoading ? 'Ouverture du paiement sécurisé…' : loading ? 'Vérification de votre accès…' : 'Acheter la formation – 497 €'}
                </button>
              ) : (
                <Link to="/login" className="btn btn-primary">Se connecter pour acheter</Link>
              )}
              {checkoutError && <p className="generative-ai-error" role="alert">{checkoutError}</p>}
              <p>Paiement sécurisé par Stripe. L’accès est activé après confirmation du paiement.</p>
              <p>Présentiel possible dans un rayon maximal de 100 km autour de Calais, après validation de la distance.</p>
              <p>Une participation unique de 30 € est prévue pour le second déplacement en présentiel.</p>
              <p>Au-delà de 100 km, la formation est proposée à distance ou sur devis.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
