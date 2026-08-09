import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Accessibility,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Library,
  MonitorPlay,
  Sparkles,
  Users,
} from 'lucide-react'
import SEO from '../components/SEO'
import { useAuth } from '../contexts/useAuth'
import { supabase } from '../lib/supabaseClient'
import { fetchActiveCourseAccess } from '../lib/courseAccess'
import { getBookingUrl } from '../data/bookingCatalog'
import './FormationPrompt.css'

const COURSE_ID = 'formation-prompt-level-1'

const program = [
  {
    period: 'Matin · 4 h',
    title: 'Construire des demandes fiables et réutilisables',
    items: [
      'Comprendre les possibilités, les limites et les erreurs fréquentes de l’IA générative',
      'Définir l’objectif, le contexte, le public, les contraintes et le format attendu',
      'Utiliser des exemples, des critères de qualité et une méthode de vérification',
      'Atelier : améliorer progressivement un prompt imprécis',
    ],
  },
  {
    period: 'Après-midi · 3 h',
    title: 'Appliquer la méthode à des situations professionnelles',
    items: [
      'Rédiger, synthétiser et adapter un contenu à différents destinataires',
      'Créer une ressource pédagogique ou le cahier des charges d’une page HTML',
      'Enchaîner plusieurs prompts dans un processus de travail contrôlé',
      'Cas pratique final, restitution et évaluation des acquis',
    ],
  },
]

export default function FormationPrompt() {
  const { user } = useAuth()
  const [hasPurchased, setHasPurchased] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  useEffect(() => {
    async function checkPurchase() {
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await fetchActiveCourseAccess(user.id, COURSE_ID)

      if (!error && data) setHasPurchased(true)
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
        title="Formation Prompt Engineering – Niveau 1 | FormaPrompt"
        description="Formation de 7 heures pour apprendre à concevoir, tester et améliorer des prompts professionnels. Présentiel ou classe virtuelle."
        url="https://www.formaprompt.com/formation-prompt-engineering"
        image="https://www.formaprompt.com/assets/Formation%20prompt%20engineering.png"
      />

      <main className="prompt-page">
        <section className="prompt-hero">
          <div className="container prompt-hero-grid">
            <div>
              <p className="prompt-kicker">Formation professionnelle · Niveau 1</p>
              <h1>Formation Prompt Engineering – Niveau 1</h1>
              <p className="prompt-lead">
                Apprenez une méthode claire pour concevoir, tester et améliorer des prompts adaptés à vos usages
                professionnels, sans dépendre de formules toutes faites.
              </p>
              <div className="prompt-facts" aria-label="Informations principales">
                <span><Clock3 size={19} aria-hidden="true" /> 7 heures accompagnées</span>
                <span><MonitorPlay size={19} aria-hidden="true" /> Présentiel ou classe virtuelle</span>
                <span><Users size={19} aria-hidden="true" /> Tarif individuel</span>
              </div>
              <div className="prompt-actions">
                <a href="#inscription" className="btn btn-primary">Voir le tarif et s’inscrire</a>
                <a href="#programme" className="btn prompt-secondary-btn">Consulter le programme</a>
              </div>
            </div>
            <div className="prompt-hero-visual">
              <img src="/assets/Formation prompt engineering.png" alt="Illustration de la formation Prompt Engineering" />
            </div>
          </div>
        </section>

        <section className="container prompt-section">
          <div className="prompt-section-heading">
            <p className="prompt-kicker">Compétences visées</p>
            <h2>Passer d’un usage intuitif à une méthode de travail contrôlée</h2>
          </div>
          <div className="prompt-objectives">
            <article><Sparkles aria-hidden="true" /><h3>Structurer</h3><p>Formuler un objectif, un contexte, des contraintes et un résultat attendu.</p></article>
            <article><CheckCircle2 aria-hidden="true" /><h3>Évaluer</h3><p>Vérifier la pertinence, la fiabilité et l’adaptation d’une réponse.</p></article>
            <article><FileText aria-hidden="true" /><h3>Réutiliser</h3><p>Créer des modèles de prompts documentés et adaptables à son activité.</p></article>
          </div>
        </section>

        <section className="prompt-audience">
          <div className="container prompt-two-columns">
            <div>
              <Users size={34} aria-hidden="true" />
              <h2>Public visé</h2>
              <ul>
                <li>Salariés, indépendants et dirigeants utilisant l’IA générative</li>
                <li>Formateurs et responsables pédagogiques</li>
                <li>Fonctions administratives, communication, RH et support</li>
                <li>Toute personne souhaitant professionnaliser ses usages</li>
              </ul>
            </div>
            <div>
              <BookOpenCheck size={34} aria-hidden="true" />
              <h2>Prérequis et positionnement</h2>
              <p>Aucun prérequis technique. Une pratique occasionnelle d’un assistant d’IA est utile, mais non obligatoire.</p>
              <p>
                Un quiz préalable de 12 questions, allant de la découverte à des usages plus avancés, permet au
                formateur d’adapter les exemples et l’accompagnement. Il ne s’agit pas d’un examen.
              </p>
            </div>
          </div>
        </section>

        <section id="programme" className="container prompt-section">
          <div className="prompt-section-heading">
            <p className="prompt-kicker">Programme · 7 h</p>
            <h2>Une journée complète ou deux demi-journées</h2>
            <p>Le contenu est adapté au niveau initial et aux situations professionnelles des participants.</p>
          </div>
          <div className="prompt-program">
            {program.map((part) => (
              <article key={part.period}>
                <p className="prompt-period">{part.period}</p>
                <h3>{part.title}</h3>
                <ul>{part.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="prompt-methods">
          <div className="container">
            <div className="prompt-section-heading">
              <p className="prompt-kicker">Organisation pédagogique</p>
              <h2>Des exercices concrets et du temps pour le cas pratique final</h2>
            </div>
            <div className="prompt-method-grid">
              <article><strong>Présentiel</strong><span>1 journée : 4 h le matin et 3 h l’après-midi</span></article>
              <article><strong>Distanciel synchrone</strong><span>2 demi-journées de 3 h 30</span></article>
              <article><strong>Méthodes</strong><span>Démonstrations, essais guidés, analyse de réponses et ateliers</span></article>
              <article><strong>Évaluation</strong><span>Quiz initial, exercices progressifs, cas pratique final et restitution</span></article>
              <article><strong>Groupe ou entreprise</strong><span>Programme adapté et tarif établi sur devis</span></article>
            </div>
          </div>
        </section>

        <section className="container prompt-section">
          <div className="prompt-deliverables">
            <Library size={38} aria-hidden="true" />
            <div>
              <p className="prompt-kicker">Livrables</p>
              <h2>Une bibliothèque de prompts dans Notion</h2>
              <p>
                Vous retrouvez les prompts vus pendant la formation, leurs variables, leurs critères de contrôle et
                des exemples d’adaptation. La bibliothèque est conçue comme un support de travail, pas comme une
                collection de recettes figées.
              </p>
              <p>Sont également fournis : une trame de conception, une grille de vérification et les exercices corrigés.</p>
            </div>
          </div>
        </section>

        <section className="container prompt-section">
          <div className="prompt-accessibility">
            <Accessibility size={34} aria-hidden="true" />
            <div>
              <h2>Accessibilité</h2>
              <p>
                Contactez FormaPrompt avant l’inscription pour étudier les adaptations possibles liées à une situation
                de handicap ou à un besoin particulier.
              </p>
              <Link to="/contact">Échanger au sujet d’un aménagement</Link>
            </div>
          </div>
        </section>

        <section id="inscription" className="prompt-pricing">
          <div className="container prompt-pricing-grid">
            <div>
              <p className="prompt-kicker">Tarif individuel</p>
              <h2>Une formation accompagnée de 7 heures</h2>
              <p>
                Le tarif comprend le quiz de positionnement, les 7 heures avec le formateur, les exercices et les
                livrables pédagogiques. Pour un groupe ou une entreprise, demandez un devis adapté.
              </p>
              <Link to="/contact" className="prompt-text-link">Demander un devis pour un groupe</Link>
            </div>
            <div className="prompt-price-card">
              <p className="prompt-price">343 €</p>
              <p className="prompt-price-note">par apprenant · soit 49 € par heure</p>
              {!loading && hasPurchased ? (
                <div className="prompt-price-actions">
                  <Link to={`/course/${COURSE_ID}`} className="btn btn-primary">Accéder à ma formation</Link>
                  <Link to={getBookingUrl(COURSE_ID)} className="btn prompt-secondary-btn">Réserver mes 7 heures</Link>
                </div>
              ) : user ? (
                <button type="button" className="btn btn-primary" onClick={startCheckout} disabled={loading || checkoutLoading}>
                  {checkoutLoading ? 'Ouverture du paiement sécurisé…' : 'Acheter la formation – 343 €'}
                </button>
              ) : (
                <Link to="/login" className="btn btn-primary">Se connecter pour acheter</Link>
              )}
              {checkoutError && <p className="prompt-error" role="alert">{checkoutError}</p>}
              <p>Paiement sécurisé par Stripe. L’accès est activé après confirmation du paiement.</p>
              <p>
                Présentiel dans un rayon maximal de 100 km autour de Calais : déplacement inclus pour la journée
                complète ; participation unique de 30 € pour deux demi-journées, après validation de la distance.
              </p>
              <p>Au-delà de 100 km, la formation est proposée à distance ou sur devis.</p>
            </div>
          </div>
        </section>

        <section className="container prompt-level-two">
          <strong>Pour aller plus loin</strong>
          <p>Un futur Niveau 2 abordera les agents, les automatisations et l’utilisation des API.</p>
        </section>
      </main>
    </>
  )
}
