import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  Gauge,
  ShieldAlert,
  Target,
  Workflow,
} from 'lucide-react'
import SEO from '../components/SEO'
import { useAuth } from '../contexts/useAuth'
import { createServiceStructuredData } from '../lib/seoStructuredData'
import './DiagnosticIA.css'

const PAGE_URL = 'https://formaprompt.com/diagnostic-ia'
const PAGE_DESCRIPTION = "Diagnostic IA Express de 90 minutes : analysez vos tâches, choisissez trois opportunités IA prioritaires et repartez avec un plan d'action adapté."
const LOGIN_REDIRECT = `/login?redirect=${encodeURIComponent('/diagnostic-ia#reserver')}`

const audiences = [
  'Indépendants',
  'Formateurs et consultants',
  'Dirigeants de TPE',
  'Petites équipes',
  'Organismes de formation',
  'Particuliers avec un besoin professionnel ou organisationnel',
]

const priorities = [
  { icon: Gauge, title: 'Gain potentiel', text: 'Le temps, la régularité ou la qualité que l’usage peut améliorer.' },
  { icon: Workflow, title: 'Difficulté', text: 'L’effort nécessaire pour tester puis intégrer la solution dans vos pratiques.' },
  { icon: CircleDollarSign, title: 'Coût indicatif', text: 'Les outils ou ressources à prévoir, sans engager une solution surdimensionnée.' },
  { icon: ShieldAlert, title: 'Risques', text: 'Les données, contrôles humains et limites à prendre en compte avant d’agir.' },
]

const excludedServices = [
  'Développement complet d’un agent',
  'Installation complète de n8n',
  'Création complète d’une automatisation',
  'Formation d’une équipe',
  'Audit informatique complet',
  'Audit juridique ou RGPD complet',
  'Développement logiciel sur mesure',
]

const serviceStructuredData = createServiceStructuredData({
  name: 'Diagnostic IA Express',
  description: PAGE_DESCRIPTION,
  url: PAGE_URL,
  serviceType: 'Diagnostic et conseil en usages professionnels de l’intelligence artificielle',
  audience: audiences.join(', '),
  price: '149',
  priceCurrency: 'EUR',
})

function ReservationEntry() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <button className="btn diagnostic-ia-cta" type="button" disabled aria-describedby="diagnostic-payment-status">
        Vérification de votre session…
      </button>
    )
  }

  if (!user) {
    return (
      <Link className="btn diagnostic-ia-cta" to={LOGIN_REDIRECT} aria-describedby="diagnostic-payment-status">
        Réserver mon Diagnostic IA Express - 149 €
        <ArrowRight size={20} aria-hidden="true" />
      </Link>
    )
  }

  return (
    <button className="btn diagnostic-ia-cta" type="button" disabled aria-describedby="diagnostic-payment-status">
      Réserver mon Diagnostic IA Express - 149 €
    </button>
  )
}

export default function DiagnosticIA() {
  return (
    <>
      <SEO
        title="Diagnostic IA Express – Plan d’action personnalisé | FormaPrompt"
        description={PAGE_DESCRIPTION}
        url={PAGE_URL}
        image="https://formaprompt.com/assets/logo-new.png"
        jsonLd={serviceStructuredData}
      />

      <div className="diagnostic-ia-page">
        <section className="diagnostic-ia-hero">
          <div className="container diagnostic-ia-hero-grid">
            <div>
              <p className="diagnostic-ia-kicker">Diagnostic individuel · à distance</p>
              <h1>Diagnostic IA Express</h1>
              <p className="diagnostic-ia-promise">
                Identifiez en 90 minutes où l&apos;IA peut réellement vous faire gagner du temps - et repartez avec un plan d&apos;action adapté à votre activité.
              </p>
              <p className="diagnostic-ia-hero-note">
                Nous partons de votre métier, de vos tâches et de vos contraintes. Pas d&apos;une démonstration générique de ChatGPT.
              </p>
              <div className="diagnostic-ia-hero-actions">
                <a className="btn diagnostic-ia-hero-primary" href="#reserver">
                  Réserver mon Diagnostic IA Express - 149 €
                  <ArrowRight size={19} aria-hidden="true" />
                </a>
                <a className="btn diagnostic-ia-hero-link" href="#deroulement">
                  Comprendre le déroulement
                </a>
              </div>
            </div>

            <aside className="diagnostic-ia-summary" aria-label="Informations essentielles">
              <span className="diagnostic-ia-summary-badge">En visioconférence</span>
              <dl>
                <div><dt>Durée</dt><dd>90 minutes</dd></div>
                <div><dt>Tarif payé</dt><dd>149 €</dd></div>
                <div><dt>Restitution</dt><dd>Plan d&apos;action personnalisé</dd></div>
              </dl>
              <p>Un seul diagnostic est proposé par jour afin de préserver le temps d&apos;analyse et de restitution.</p>
            </aside>
          </div>
        </section>

        <section className="container diagnostic-ia-section diagnostic-ia-introduction">
          <div>
            <p className="diagnostic-ia-kicker">Partir du travail réel</p>
            <h2>L&apos;outil vient après le besoin</h2>
          </div>
          <div>
            <p>
              Copier quelques prompts ne suffit pas à structurer un usage professionnel de l&apos;IA. Une tâche peut sembler automatisable et pourtant demander trop de contrôle, exposer des données ou déplacer le problème au lieu de le résoudre.
            </p>
            <p>
              Le diagnostic examine vos outils actuels, vos documents, vos contraintes et vos objectifs. Il sert à choisir où commencer, mais aussi à identifier ce qu&apos;il vaut mieux ne pas automatiser.
            </p>
          </div>
        </section>

        <section className="diagnostic-ia-audience-section">
          <div className="container">
            <div className="diagnostic-ia-section-heading">
              <p className="diagnostic-ia-kicker">Pour qui ?</p>
              <h2>Pour les professionnels et les particuliers qui veulent cadrer un besoin concret</h2>
              <p>Le diagnostic est pertinent si vous manquez de temps, hésitez entre plusieurs outils ou souhaitez éviter une automatisation inutilement complexe.</p>
            </div>
            <ul className="diagnostic-ia-audience-list" aria-label="Public concerné">
              {audiences.map((audience) => <li key={audience}><CheckCircle2 size={18} aria-hidden="true" />{audience}</li>)}
            </ul>
          </div>
        </section>

        <section id="deroulement" className="container diagnostic-ia-section">
          <div className="diagnostic-ia-section-heading">
            <p className="diagnostic-ia-kicker">Avant, pendant, après</p>
            <h2>Un parcours court, avec un résultat exploitable</h2>
          </div>
          <div className="diagnostic-ia-timeline">
            <article>
              <span className="diagnostic-ia-step">1</span>
              <CalendarClock aria-hidden="true" />
              <h3>Avant : préciser le contexte</h3>
              <p>Après le paiement et la réservation, un questionnaire court rassemble les éléments utiles : activité, outils, tâches répétitives, difficultés et objectif recherché.</p>
            </article>
            <article>
              <span className="diagnostic-ia-step">2</span>
              <BriefcaseBusiness aria-hidden="true" />
              <h3>Pendant : analyser et prioriser</h3>
              <p>Nous cartographions vos tâches, repérons les opportunités, retenons trois priorités et examinons les risques, les contrôles humains et les tâches à ne pas automatiser.</p>
            </article>
            <article>
              <span className="diagnostic-ia-step">3</span>
              <FileCheck2 aria-hidden="true" />
              <h3>Après : décider quoi tester</h3>
              <p>Vous recevez un Plan d&apos;action IA FormaPrompt personnalisé : premier workflow recommandé, points de vigilance et étapes réalistes pour les 30 jours suivants.</p>
            </article>
          </div>
        </section>

        <section className="diagnostic-ia-priorities-section">
          <div className="container diagnostic-ia-priorities-grid">
            <div>
              <p className="diagnostic-ia-kicker">Trois opportunités prioritaires</p>
              <h2>Comparer les idées avant d&apos;investir du temps</h2>
              <p>
                Chaque opportunité retenue est replacée dans votre contexte. Le but n&apos;est pas de produire une liste d&apos;outils, mais de distinguer les essais utiles des projets trop coûteux, trop fragiles ou prématurés.
              </p>
            </div>
            <div className="diagnostic-ia-priority-cards">
              {priorities.map(({ icon: Icon, title, text }) => (
                <article key={title}>
                  <Icon aria-hidden="true" />
                  <div><h3>{title}</h3><p>{text}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container diagnostic-ia-section diagnostic-ia-plan-grid">
          <article className="diagnostic-ia-plan-card">
            <Target aria-hidden="true" />
            <div>
              <p className="diagnostic-ia-kicker">Votre restitution</p>
              <h2>Plan d&apos;action IA FormaPrompt personnalisé</h2>
              <p>La synthèse reprend votre situation, votre potentiel IA indicatif, les trois opportunités retenues, leur impact, leur difficulté, leur coût indicatif et les points de vigilance.</p>
              <p>Elle propose également un premier workflow et un plan d&apos;action sur 30 jours. Ce potentiel reste une estimation de cadrage, pas une garantie de gain.</p>
            </div>
          </article>
          <article className="diagnostic-ia-caution-card">
            <ShieldAlert aria-hidden="true" />
            <div>
              <p className="diagnostic-ia-kicker">Savoir renoncer</p>
              <h2>Tout ne doit pas être automatisé</h2>
              <p>Une décision sensible, une relation humaine, un document confidentiel ou une tâche rare peuvent demander plus de contrôle que l&apos;IA n&apos;apporte de valeur. Ces limites font partie du diagnostic.</p>
            </div>
          </article>
        </section>

        <section className="diagnostic-ia-limits-section">
          <div className="container diagnostic-ia-limits-grid">
            <div>
              <p className="diagnostic-ia-kicker">Périmètre de la prestation</p>
              <h2>Ce diagnostic cadre la suite, il ne la réalise pas à votre place</h2>
              <p>Il peut déboucher sur des recommandations, mais il ne constitue ni un projet informatique complet ni une consultation juridique.</p>
            </div>
            <ul>
              {excludedServices.map((service) => <li key={service}>{service}</li>)}
            </ul>
          </div>
        </section>

        <section id="reserver" className="diagnostic-ia-booking-section">
          <div className="container diagnostic-ia-booking-grid">
            <div>
              <p className="diagnostic-ia-kicker">Diagnostic IA Express</p>
              <h2>90 minutes pour choisir un premier cap réaliste</h2>
              <p>Format principal : visioconférence. La réservation du créneau interviendra après confirmation du paiement.</p>
              <p className="diagnostic-ia-booking-note">Après paiement, vous choisissez votre créneau parmi mes disponibilités.</p>
              <p className="diagnostic-ia-accessibility">
                Un besoin d&apos;adaptation ou une question avant de vous engager ? <Link to="/contact">Contactez FormaPrompt</Link>.
              </p>
            </div>
            <div className="diagnostic-ia-price-card">
              <p className="diagnostic-ia-price">149 €</p>
              <p className="diagnostic-ia-tax">TVA non applicable - article 293 B du CGI</p>
              <ReservationEntry />
              <p id="diagnostic-payment-status" className="diagnostic-ia-payment-status">
                Le paiement en ligne n&apos;est pas encore activé sur cette page. La connexion prépare votre accès FormaPrompt ; aucun paiement n&apos;est déclenché à cette étape.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
