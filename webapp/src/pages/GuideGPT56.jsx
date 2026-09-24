import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  Gauge,
  Lightbulb,
  Rocket,
  Scale,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import SEO from '../components/SEO';
import { Link } from 'react-router-dom';
import './GuideGPT56.css';

const models = [
  {
    id: 'luna',
    name: 'Luna',
    label: 'La rapide',
    icon: Zap,
    color: 'violet',
    summary: 'Pour aller vite sur des demandes simples, courtes et bien cadrées.',
    bestFor: ['Corrections de texte', 'Petites modifications ciblées', 'Tâches répétitives'],
    avoid: 'Une analyse complexe ou une décision avec beaucoup de contraintes.',
  },
  {
    id: 'terra',
    name: 'Terra',
    label: "L'équilibrée",
    icon: Scale,
    color: 'teal',
    recommended: true,
    summary: 'Le meilleur point de départ pour la majorité des travaux professionnels.',
    bestFor: ['Création de pages web', 'Analyse de documents', 'Débogage courant'],
    avoid: 'Les problèmes exceptionnellement difficiles où la qualité prime sur le délai.',
  },
  {
    id: 'sol',
    name: 'Sol',
    label: 'La plus capable',
    icon: Sparkles,
    color: 'orange',
    summary: 'Pour les problèmes complexes qui demandent le maximum de discernement.',
    bestFor: ['Architecture importante', 'Enquête technique difficile', 'Travail à forts enjeux'],
    avoid: 'Les petites tâches évidentes : ce serait souvent disproportionné.',
  },
];

const efforts = [
  { id: 'none', short: 'Sans', time: 'Très rapide', description: 'Réponse directe, presque sans réflexion intermédiaire.', examples: 'Reformater, renommer, corriger une coquille.' },
  { id: 'low', short: 'Faible', time: 'Rapide', description: 'Un contrôle léger avant d’agir.', examples: 'Modifier une couleur, résumer un texte simple.' },
  { id: 'medium', short: 'Moyen', time: 'Équilibré', description: 'Assez de réflexion pour la plupart des demandes.', examples: 'Créer une page, améliorer un contenu, corriger un bug courant.', recommended: true },
  { id: 'high', short: 'Élevé', time: 'Plus long', description: 'Analyse approfondie et vérifications supplémentaires.', examples: 'Auditer un projet, concevoir une fonctionnalité, résoudre un bug difficile.' },
  { id: 'xhigh', short: 'Très élevé', time: 'Le plus long', description: 'Effort maximal pour les problèmes les plus exigeants.', examples: 'Migration sensible, diagnostic rare, choix d’architecture complexe.' },
];

const situations = {
  correction: {
    title: 'Corriger un texte',
    detail: 'Orthographe, reformulation courte',
    example: '« Corrige les fautes de ce paragraphe sans changer le ton. »',
    model: 'Luna',
    effort: 'Faible',
    reason: 'La demande est courte et le résultat facile à vérifier.',
  },
  simpleEmail: {
    title: 'Rédiger un e-mail simple',
    detail: 'Confirmation, rappel, réponse courte',
    example: '« Rédige un e-mail cordial pour confirmer notre rendez-vous de mardi à 10 h. »',
    model: 'Luna',
    effort: 'Faible',
    reason: 'Le message est court, son objectif est précis et il comporte peu d’enjeux.',
  },
  complexEmail: {
    title: 'Rédiger un e-mail complexe',
    detail: 'Réclamation, négociation, sujet sensible',
    example: '« Rédige une réponse diplomatique à un client mécontent, reconnais le retard et propose deux solutions sans admettre une faute juridique. »',
    model: 'Terra',
    effort: 'Élevé',
    reason: 'Le ton, les contraintes et les conséquences possibles demandent davantage de discernement.',
  },
  htmlPage: {
    title: 'Créer une page HTML',
    detail: 'Page vitrine claire et responsive',
    example: '« Crée une page HTML responsive et accessible pour présenter une formation à l’IA générative. »',
    model: 'Terra',
    effort: 'Moyen',
    reason: 'C’est le meilleur équilibre entre qualité, rapidité et ressources.',
  },
  documents: {
    title: 'Analyser des documents',
    detail: 'Comparer, résumer, faire ressortir les écarts',
    example: '« Compare ces trois programmes de formation et relève les objectifs, prérequis et modalités manquantes. »',
    model: 'Terra',
    effort: 'Moyen',
    reason: 'Il faut croiser plusieurs informations, mais la tâche reste structurée et vérifiable.',
  },
  application: {
    title: 'Coder une application',
    detail: 'Fonctionnalités liées et choix techniques',
    example: '« Construis une application de suivi des apprenants avec connexion, rôles, progression et tableau de bord responsive. »',
    model: 'Sol',
    effort: 'Élevé',
    reason: 'Une application complète exige de coordonner l’architecture, la sécurité, les données et l’interface.',
  },
  complexBug: {
    title: 'Résoudre un bug complexe',
    detail: 'Cause incertaine, plusieurs fichiers concernés',
    example: '« Trouve pourquoi les comptes apprenants perdent leur progression. »',
    model: 'Sol',
    effort: 'Élevé',
    reason: 'Il faut explorer plusieurs hypothèses et limiter le risque d’erreur.',
  },
  migration: {
    title: 'Préparer une migration sensible',
    detail: 'Données, sécurité, continuité de service',
    example: '« Prépare une migration complète sans perte de données. »',
    model: 'Sol',
    effort: 'Très élevé',
    reason: 'Le coût d’une erreur justifie davantage de temps et de vérifications.',
  },
};

export default function GuideGPT56() {
  const [situation, setSituation] = useState('htmlPage');
  const recommendation = useMemo(() => situations[situation], [situation]);

  return (
    <>
      <SEO
        title="Guide GPT-5.6 : choisir Sol, Terra ou Luna – FormaPrompt"
        description="Repère pédagogique sur la génération GPT-5.6 (juillet 2026) : choisir Sol, Terra ou Luna selon la tâche et l’effort de raisonnement."
        url="https://formaprompt.com/guide-gpt-5-6-codex"
      />

      <div className="gpt-guide">
        <section className="gpt-hero" aria-labelledby="gpt-title">
          <div className="gpt-orb gpt-orb-one" aria-hidden="true" />
          <div className="gpt-orb gpt-orb-two" aria-hidden="true" />
          <div className="container gpt-hero-inner">
            <p className="gpt-eyebrow"><BrainCircuit size={18} /> Le guide simple de FormaPrompt</p>
            <h1 id="gpt-title">GPT‑5.6 :<br /><span>un repère sur la génération précédente</span></h1>
            <p className="gpt-hero-lead">
              Ce guide conserve les exemples de choix entre Sol, Terra et Luna tels qu’ils étaient présentés en juillet 2026.
              Pour choisir dans la famille actuelle, consultez le <Link to="/guide-gpt-6-codex">guide GPT‑6</Link>.
            </p>
            <div className="gpt-equation" aria-label="Trois modèles multipliés par cinq niveaux d'effort">
              <div><strong>1</strong><span>Je choisis le moteur</span></div>
              <span className="gpt-plus">+</span>
              <div><strong>2</strong><span>Je règle son effort</span></div>
              <ArrowRight className="gpt-arrow" aria-hidden="true" />
              <div className="gpt-result"><Check size={22} /><span>Le bon compromis</span></div>
            </div>
            <a className="gpt-scroll-link" href="#choisir">Voir le choix conseillé <ChevronRight size={18} /></a>
          </div>
        </section>

        <div>
          <section className="gpt-surfaces-section" aria-labelledby="surfaces-title">
            <div className="container">
              <div className="gpt-section-heading">
                <span className="gpt-step">Mise à jour du 24 septembre 2026</span>
                <h2 id="surfaces-title">Un guide conservé pour comprendre les choix de 2026</h2>
                <p>Les exemples ci-dessous décrivent la famille GPT‑5.6 à la date de rédaction initiale. Ils ne garantissent pas que ces modèles ou réglages soient encore proposés dans votre interface.</p>
              </div>
              <div className="gpt-surface-summary">
                <Lightbulb size={24} />
                <p><strong>À retenir :</strong> la famille GPT‑6 comprend Astra, Sol et Luna ; elle ne comprend pas Terra. Les noms et niveaux visibles varient selon le produit et le compte. <Link to="/guide-gpt-6-codex">Voir le guide GPT‑6</Link>.</p>
              </div>
              <p className="gpt-current-note">Selon l’<a href="https://help.openai.com/en/articles/20001354-gpt-56-and-gpt-6-pro-in-chatgpt" target="_blank" rel="noreferrer">aide officielle OpenAI consultée le 24 septembre 2026</a>, GPT‑5.6 Sol peut alimenter Instant ainsi que plusieurs niveaux de raisonnement pour les forfaits éligibles ; GPT‑5.6 Luna est indiqué comme modèle par défaut pour Free et Go. Ces indications peuvent évoluer avec les déploiements.</p>
            </div>
          </section>

          <section className="gpt-section container" aria-labelledby="models-title">
            <div className="gpt-section-heading">
              <span className="gpt-step">Étape 1</span>
              <h2 id="models-title">Les trois modèles : choisissez le moteur</h2>
              <p>Dans cette génération précédente, les trois modèles répondaient à des besoins différents. Ces conseils sont des exemples pédagogiques datés.</p>
            </div>

            <div className="gpt-model-grid">
              {models.map((model) => {
                const Icon = model.icon;
                return (
                  <article className={`gpt-model-card ${model.color}`} key={model.id}>
                    {model.recommended && <span className="gpt-badge">Choix par défaut</span>}
                    <div className="gpt-model-icon"><Icon size={28} /></div>
                    <p className="gpt-model-family">GPT‑5.6</p>
                    <h3>{model.name}</h3>
                    <p className="gpt-model-label">{model.label}</p>
                    <p className="gpt-model-summary">{model.summary}</p>
                    <h4>À utiliser pour</h4>
                    <ul>
                      {model.bestFor.map((item) => <li key={item}><Check size={16} /> {item}</li>)}
                    </ul>
                    <div className="gpt-caution"><strong>À éviter si :</strong> {model.avoid}</div>
                  </article>
                );
              })}
            </div>

            <div className="gpt-memory-tip">
              <Lightbulb size={28} />
              <div><strong>Le moyen mnémotechnique</strong><p><b>Luna</b> sprinte, <b>Terra</b> travaille au quotidien, <b>Sol</b> s’attaque aux sommets.</p></div>
            </div>
          </section>

          <section className="gpt-effort-section" aria-labelledby="efforts-title">
            <div className="container">
              <div className="gpt-section-heading light">
                <span className="gpt-step">Étape 2</span>
                <h2 id="efforts-title">Les cinq niveaux : réglez le temps de réflexion</h2>
              <p>Ce réglage illustre l’effort de raisonnement consacré à une demande. Les niveaux réellement disponibles dépendent du modèle et du produit ; vérifiez les options affichées dans votre interface.</p>
              </div>

              <div className="gpt-analogy">
                <Gauge size={34} />
                <p><strong>Pensez aux vitesses d’une voiture :</strong> vous gardez le même moteur, mais vous adaptez le régime à la difficulté du terrain.</p>
              </div>

              <div className="gpt-effort-list">
                {efforts.map((effort, index) => (
                  <article className="gpt-effort-row" key={effort.id}>
                    <div className="gpt-effort-number">{index + 1}</div>
                    <div className="gpt-effort-name">
                      <h3>{effort.short}</h3>
                      <span><Clock3 size={15} /> {effort.time}</span>
                    </div>
                    <p>{effort.description}</p>
                    <p className="gpt-effort-example"><strong>Exemples :</strong> {effort.examples}</p>
                    {effort.recommended && <span className="gpt-effort-default">Bon départ</span>}
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="gpt-section container" id="choisir" aria-labelledby="chooser-title">
            <div className="gpt-section-heading">
              <span className="gpt-step">À vous de jouer</span>
              <h2 id="chooser-title">Que voulez-vous faire ?</h2>
              <p>Sélectionnez la situation la plus proche de votre besoin.</p>
            </div>

            <div className="gpt-chooser">
              <div className="gpt-choices" role="group" aria-label="Type de tâche">
                {Object.entries(situations).map(([key, item]) => (
                  <button
                    type="button"
                    key={key}
                    className={situation === key ? 'active' : ''}
                    onClick={() => setSituation(key)}
                    aria-pressed={situation === key}
                  >
                    <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>

              <div className="gpt-recommendation" aria-live="polite">
                <p className="gpt-reco-label"><Rocket size={18} /> Conseil de juillet 2026</p>
                <div className="gpt-reco-pills">
                  <span>GPT‑5.6 <strong>{recommendation.model}</strong></span>
                  <span>Effort <strong>{recommendation.effort}</strong></span>
                </div>
                <blockquote>{recommendation.example}</blockquote>
                <p>{recommendation.reason}</p>
              </div>
            </div>
          </section>

          <section className="gpt-section gpt-rules" aria-labelledby="rules-title">
            <div className="container">
              <div className="gpt-section-heading">
                <span className="gpt-step">L’essentiel</span>
                <h2 id="rules-title">Les quatre règles à retenir</h2>
              </div>
              <div className="gpt-rules-grid">
                <article><span>01</span><h3>Le repère de juillet 2026</h3><p><strong>Terra + Moyen</strong> servait alors de point de départ polyvalent.</p></article>
                <article><span>02</span><h3>Montez progressivement</h3><p>Si le résultat manque de profondeur, augmentez d’abord l’effort, puis passez à Sol.</p></article>
                <article><span>03</span><h3>Ne surdimensionnez pas</h3><p>Sol + Très élevé n’est pas automatiquement meilleur pour une tâche simple. Il sera surtout plus lent.</p></article>
                <article><span>04</span><h3>Le prompt reste essentiel</h3><p>Un objectif clair, du contexte et des critères précis comptent davantage qu’un réglage maximal.</p></article>
              </div>
            </div>
          </section>

          <section className="gpt-sources container" aria-labelledby="sources-title">
            <ShieldCheck size={26} />
            <div>
              <h2 id="sources-title">Une précision importante</h2>
              <p>
                Cette page documente les choix GPT‑5.6 présentés en juillet 2026. Elle ne décrit pas la disponibilité actuelle de ces modèles dans ChatGPT, Codex ou l’API. Pour un choix aujourd’hui, reportez-vous au guide GPT‑6 et vérifiez les options de votre compte.
              </p>
              <p className="gpt-source-links">
                Sources de la version initiale, consultées le 11 juillet 2026 :{' '}
                <a href="https://openai.com/index/gpt-5-6/" target="_blank" rel="noreferrer">annonce générale de GPT‑5.6</a>,{' '}
                <a href="https://help.openai.com/en/articles/20001354-gpt-56-in-chatgpt" target="_blank" rel="noreferrer">GPT‑5.6 dans ChatGPT</a>,{' '}
                <a href="https://developers.openai.com/api/docs/models/gpt-5.6-sol" target="_blank" rel="noreferrer">Sol</a>,{' '}
                <a href="https://developers.openai.com/api/docs/models/gpt-5.6-terra" target="_blank" rel="noreferrer">Terra</a> et{' '}
                <a href="https://developers.openai.com/api/docs/models/gpt-5.6-luna" target="_blank" rel="noreferrer">Luna</a>. Pour l’état de la famille actuelle, consultez le <a href="https://developers.openai.com/api/docs/models" target="_blank" rel="noreferrer">catalogue officiel des modèles</a>.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
