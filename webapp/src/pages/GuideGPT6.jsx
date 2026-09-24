import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BrainCircuit, Check, ChevronRight, Gauge, Lightbulb, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import SEO from '../components/SEO';
import './GuideGPT56.css';

const models = [
  {
    name: 'Luna', icon: Zap, color: 'violet', label: 'Pour aller vite',
    summary: 'Un choix pour les demandes simples, courtes et répétées.',
    examples: ['Corriger quelques phrases', 'Classer des notes', 'Reformater une liste'],
    caution: 'Si plusieurs contraintes se croisent, relisez attentivement ou passez à Sol.',
  },
  {
    name: 'Sol', icon: BrainCircuit, color: 'teal', label: 'Le point de départ polyvalent',
    summary: 'Un équilibre pour le travail courant, la rédaction structurée et le code.',
    examples: ['Préparer un support de formation', 'Créer une page web', 'Corriger un bug courant'],
    caution: 'Pour un problème particulièrement difficile, examinez si Astra est utile.',
  },
  {
    name: 'Astra', icon: Sparkles, color: 'orange', label: 'Pour les tâches très exigeantes',
    summary: 'À envisager quand le raisonnement et les vérifications demandent davantage de profondeur.',
    examples: ['Analyser un dossier complexe', 'Étudier une architecture', 'Investiguer un incident difficile'],
    caution: 'Sur une tâche simple, commencez par un modèle plus léger.',
  },
];

const situations = [
  { title: 'Corriger un texte court', detail: 'Orthographe et formulation', model: 'Luna', effort: 'Faible', example: '« Corrige ce paragraphe sans changer le sens ni le ton. »', reason: 'La demande est courte et le résultat se vérifie facilement.' },
  { title: 'Préparer une activité de formation', detail: 'Objectifs, consignes et évaluation', model: 'Sol', effort: 'Moyen', example: '« Propose un exercice guidé de 30 minutes pour débuter avec les formules Excel, avec consignes et critères de réussite. »', reason: 'Il faut articuler plusieurs éléments pédagogiques sans complexité exceptionnelle.' },
  { title: 'Créer une page web', detail: 'Contenu, mobile et accessibilité', model: 'Sol', effort: 'Moyen', example: '« Crée une page responsive qui présente cette formation, ses prérequis et ses modalités, puis vérifie les contrastes et les titres. »', reason: 'Le code et le contenu demandent un travail structuré et contrôlable.' },
  { title: 'Analyser un dossier délicat', detail: 'Sources nombreuses et conséquences importantes', model: 'Astra', effort: 'Élevé', example: '« Compare ces documents, relève les contradictions et indique les points qui restent à vérifier. »', reason: 'La tâche exige de croiser les sources et de rendre les incertitudes visibles.' },
];

export default function GuideGPT6() {
  const [selected, setSelected] = useState(1);
  const recommendation = situations[selected];

  return (
    <>
      <SEO
        title="GPT-6 : choisir Astra, Sol ou Luna selon votre tâche – FormaPrompt"
        description="Guide pratique GPT-6 : quand choisir Astra, Sol ou Luna, comment ajuster l’effort de raisonnement et vérifier la disponibilité dans votre interface."
        url="https://formaprompt.com/guide-gpt-6-codex"
      />
      <div className="gpt-guide">
        <section className="gpt-hero" aria-labelledby="gpt6-title">
          <div className="container gpt-hero-inner">
            <p className="gpt-eyebrow"><BrainCircuit size={18} /> Guide pratique FormaPrompt</p>
            <h1 id="gpt6-title">GPT‑6 :<br /><span>quel modèle choisir pour votre travail ?</span></h1>
            <p className="gpt-hero-lead">Astra, Sol et Luna répondent à des besoins différents. Partez de la tâche à réaliser, puis ajustez l’effort de raisonnement si votre outil le permet.</p>
            <div className="gpt-equation" aria-label="Choisir un modèle, puis ajuster l’effort selon la tâche">
              <div><strong>1</strong><span>Définir la tâche</span></div>
              <span className="gpt-plus">+</span>
              <div><strong>2</strong><span>Choisir le modèle</span></div>
              <ArrowRight className="gpt-arrow" aria-hidden="true" />
              <div className="gpt-result"><Check size={22} /><span>Ajuster l’effort</span></div>
            </div>
            <a className="gpt-scroll-link" href="#gpt6-choisir">Voir des exemples <ChevronRight size={18} /></a>
          </div>
        </section>

        <section className="gpt-section container" aria-labelledby="gpt6-models">
          <div className="gpt-section-heading">
            <span className="gpt-step">Les modèles</span>
            <h2 id="gpt6-models">Trois choix, selon la difficulté de la tâche</h2>
            <p>Le catalogue officiel d’OpenAI présente Astra, Sol et Luna dans la famille GPT‑6. Les exemples ci-dessous sont des conseils d’usage, pas une garantie de résultat.</p>
          </div>
          <div className="gpt-model-grid">
            {models.map((model) => {
              const Icon = model.icon;
              return (
                <article className={`gpt-model-card ${model.color}`} key={model.name}>
                  {model.name === 'Sol' && <span className="gpt-badge">Bon départ</span>}
                  <div className="gpt-model-icon"><Icon size={28} /></div>
                  <p className="gpt-model-family">GPT‑6</p>
                  <h3>{model.name}</h3>
                  <p className="gpt-model-label">{model.label}</p>
                  <p className="gpt-model-summary">{model.summary}</p>
                  <h4>Exemples d’utilisation</h4>
                  <ul>{model.examples.map((item) => <li key={item}><Check size={16} /> {item}</li>)}</ul>
                  <div className="gpt-caution"><strong>Point de vigilance :</strong> {model.caution}</div>
                </article>
              );
            })}
          </div>
          <div className="gpt-memory-tip"><Lightbulb size={28} /><div><strong>Un repère simple</strong><p>Luna pour une demande courte, Sol pour un travail courant, Astra quand la difficulté justifie une analyse plus poussée.</p></div></div>
        </section>

        <section className="gpt-effort-section" aria-labelledby="gpt6-effort">
          <div className="container">
            <div className="gpt-section-heading light">
              <span className="gpt-step">Le réglage</span>
              <h2 id="gpt6-effort">Ajuster l’effort de raisonnement</h2>
              <p>Quand ce réglage est proposé, un effort plus élevé laisse davantage de place à l’analyse. Il peut aussi rallonger la réponse. Les niveaux disponibles et leurs noms varient selon le modèle, le produit et votre accès.</p>
            </div>
            <div className="gpt-analogy"><Gauge size={34} /><p><strong>Commencez avec un effort modéré.</strong> Si la réponse oublie des contraintes ou si le sujet comporte des conséquences importantes, augmentez l’effort et demandez des vérifications précises.</p></div>
            <div className="gpt-effort-list">
              <article className="gpt-effort-row"><div className="gpt-effort-number">1</div><div className="gpt-effort-name"><h3>Faible</h3></div><p>Pour une tâche courte et facile à contrôler.</p><p className="gpt-effort-example">Exemple : corriger une phrase.</p></article>
              <article className="gpt-effort-row"><div className="gpt-effort-number">2</div><div className="gpt-effort-name"><h3>Moyen</h3></div><p>Pour une demande avec plusieurs consignes.</p><p className="gpt-effort-example">Exemple : préparer un exercice de formation.</p></article>
              <article className="gpt-effort-row"><div className="gpt-effort-number">3</div><div className="gpt-effort-name"><h3>Élevé</h3></div><p>Pour croiser des sources ou traiter un problème difficile.</p><p className="gpt-effort-example">Exemple : analyser des contradictions entre documents.</p></article>
            </div>
          </div>
        </section>

        <section className="gpt-section container" id="gpt6-choisir" aria-labelledby="gpt6-examples">
          <div className="gpt-section-heading"><span className="gpt-step">Cas concrets</span><h2 id="gpt6-examples">Choisissez une situation proche de la vôtre</h2><p>Ces associations sont indicatives. La qualité de la consigne et le contrôle du résultat restent essentiels.</p></div>
          <div className="gpt-chooser">
            <div className="gpt-choices" role="group" aria-label="Type de tâche">
              {situations.map((item, index) => <button type="button" key={item.title} className={selected === index ? 'active' : ''} aria-pressed={selected === index} onClick={() => setSelected(index)}><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight size={18} /></button>)}
            </div>
            <div className="gpt-recommendation" aria-live="polite">
              <p className="gpt-reco-label">Un choix possible</p>
              <div className="gpt-reco-pills"><span>GPT‑6 <strong>{recommendation.model}</strong></span><span>Effort <strong>{recommendation.effort}</strong></span></div>
              <blockquote>{recommendation.example}</blockquote>
              <p>{recommendation.reason}</p>
            </div>
          </div>
        </section>

        <section className="gpt-sources container" aria-labelledby="gpt6-sources">
          <ShieldCheck size={26} />
          <div>
            <h2 id="gpt6-sources">Disponibilité et sources</h2>
            <p>Le catalogue des modèles confirme la famille GPT‑6. Dans ChatGPT Work et Codex, les choix dépendent de l’accès et du déploiement. La présence d’un modèle dans l’API ne signifie pas qu’il apparaît dans toutes les interfaces. Vérifiez le sélecteur de votre produit avant de retenir un réglage ; Sol et Luna ne sont pas annoncés pour les conversations ChatGPT classiques dans la documentation Work et Codex.</p>
            <p className="gpt-source-links">Sources officielles consultées le 24 septembre 2026 : <a href="https://developers.openai.com/api/docs/models" target="_blank" rel="noreferrer">catalogue OpenAI</a>, <a href="https://developers.openai.com/api/docs/guides/latest-model" target="_blank" rel="noreferrer">guide de choix des modèles</a> et <a href="https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex" target="_blank" rel="noreferrer">ChatGPT Work et Codex</a>.</p>
            <p>Pour une comparaison avec d’autres outils, lire <Link to="/blog/gpt-6-astra-comparatif-claude-gemini-manus">notre article sur GPT‑6 Astra</Link>. L’ancien <Link to="/guide-gpt-5-6-codex">guide GPT‑5.6</Link> reste accessible comme repère sur la génération précédente.</p>
          </div>
        </section>
      </div>
    </>
  );
}
