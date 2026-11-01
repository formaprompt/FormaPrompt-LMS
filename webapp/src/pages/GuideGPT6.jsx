import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BrainCircuit, Check, ChevronRight, Download, Gauge, Lightbulb, ShieldCheck, Sparkles, Zap, ScanEye } from 'lucide-react';
import SEO from '../components/SEO';
import './GuideGPT56.css';
import './GuideGPT6.css';

const models = [
  {
    name: 'Luna', family: 'GPT‑6', icon: Zap, color: 'violet', label: 'Pour les tâches ciblées et répétées',
    summary: 'Un choix rapide pour extraire, classer ou transformer des informations avec une consigne précise.',
    examples: ['Corriger quelques phrases', 'Classer des notes', 'Reformater une liste'],
    caution: 'Contrôlez les omissions. Si la tâche exige de nombreux arbitrages, comparez avec Sol ou Astra.',
  },
  {
    name: 'Terra', family: 'GPT‑6.1', icon: ScanEye, color: 'blue', label: 'Pour rédiger et comprendre les supports visuels',
    summary: 'Un modèle rapide pour écrire clairement, interpréter des images et travailler dans les applications prises en charge.',
    examples: ['Adapter un support de formation', 'Interpréter un graphique', 'Préparer un document dans une application'],
    caution: 'Vérifiez les chiffres lus dans une image. Les actions possibles dépendent des outils et des autorisations.',
  },
  {
    name: 'Sol', family: 'GPT‑6.1', icon: BrainCircuit, color: 'teal', label: 'Pour les travaux complexes et suivis',
    summary: 'À envisager pour coordonner du code, des documents et des applications, avec un coût inférieur à Astra dans l’API.',
    examples: ['Créer une page web avec des contrôles', 'Corriger un bug impliquant plusieurs fichiers', 'Préparer un dossier à partir de plusieurs documents'],
    caution: 'Comparez le résultat au besoin réel. Le tarif API ne permet pas de déduire votre consommation d’abonnement.',
  },
  {
    name: 'Astra', family: 'GPT‑6', icon: Sparkles, color: 'orange', label: 'Pour les tâches les plus exigeantes',
    summary: 'Le modèle le plus capable de cette sélection pour les analyses difficiles et les travaux qui demandent un jugement soutenu.',
    examples: ['Analyser un dossier complexe', 'Étudier une architecture', 'Investiguer un incident difficile'],
    caution: 'Un modèle plus capable ne dispense pas de vérifier les sources et de valider les décisions importantes.',
  },
];

const situations = [
  {
    title: 'Corriger un texte court', detail: 'Orthographe et formulation', model: 'GPT‑6 Luna', effort: 'Faible, si disponible',
    example: 'Contexte : ce paragraphe présente une formation pour adultes. Rôle : correcteur. Objectif : corriger les fautes. Précisions : conserve le sens et le ton ; affiche uniquement le texte corrigé.',
    reason: 'La demande est ciblée et facile à contrôler.', check: 'Comparez avec l’original : noms, dates et sens doivent être conservés.',
  },
  {
    title: 'Préparer une activité de formation', detail: 'Objectifs, consignes et évaluation', model: 'GPT‑6.1 Terra', effort: 'Réglage par défaut',
    example: 'Contexte : atelier fictif de 30 minutes pour adultes débutants sur Excel. Rôle : formateur en bureautique. Objectif : faire utiliser SOMME. Précisions : fournis un petit tableau fictif, les consignes, un corrigé et deux critères de réussite ; respecte les 30 minutes.',
    reason: 'Terra est une piste pour rédiger et adapter un support. Il faut ensuite essayer l’activité.', check: 'Testez la formule, la durée et la correspondance entre consignes, corrigé et critères.',
  },
  {
    title: 'Lire un graphique', detail: 'Données visibles et limites', model: 'GPT‑6.1 Terra', effort: 'Réglage par défaut',
    example: 'Contexte : ce graphique fictif sera utilisé dans un support de formation. Rôle : relecteur. Objectif : expliquer ce qu’il montre. Précisions : cite les valeurs et les unités visibles, distingue observation et interprétation ; écris « illisible » si un chiffre ne peut pas être lu.',
    reason: 'Terra est adapté à la compréhension visuelle. La lecture d’une image peut cependant comporter des erreurs.', check: 'Contrôlez chaque valeur, l’échelle, les unités et la légende sur l’image originale.',
  },
  {
    title: 'Créer une page web', detail: 'Contenu, mobile et accessibilité', model: 'GPT‑6.1 Sol', effort: 'Réglage par défaut',
    example: 'Contexte : page de présentation d’une formation, à partir du programme fourni. Rôle : développeur web. Objectif : préparer une page responsive. Précisions : reprends seulement les informations fournies, signale les manques, vérifie les titres, les contrastes et le clavier ; prépare un aperçu local avant publication.',
    reason: 'Sol permet d’aborder un travail qui combine code, contenu et vérifications.', check: 'Essayez la page sur mobile et au clavier, puis vérifiez son contenu contre le programme.',
  },
  {
    title: 'Analyser un dossier délicat', detail: 'Sources nombreuses et contradictions', model: 'GPT‑6 Astra', effort: 'Élevé, si nécessaire',
    example: 'Contexte : comparaison de trois documents de projet anonymisés. Rôle : analyste. Objectif : relever les contradictions. Précisions : cite le document et le passage pour chaque écart, sépare faits et hypothèses, indique les informations manquantes ; ne prends aucune décision à ma place.',
    reason: 'Astra est une piste lorsque les documents demandent des recoupements et des arbitrages difficiles.', check: 'Retrouvez chaque passage cité et faites valider les conséquences par la personne compétente.',
  },
];

export default function GuideGPT6() {
  const [selected, setSelected] = useState(1);
  const recommendation = situations[selected];

  return (
    <>
      <SEO
        title="GPT-6 et GPT-6.1 : choisir Astra, Sol, Terra ou Luna – FormaPrompt"
        description="Comparez GPT-6 Astra, GPT-6.1 Sol, GPT-6.1 Terra et GPT-6 Luna : usages, effort de raisonnement, exemples CROP et contrôles dans Work, Codex et l’API."
        url="https://formaprompt.com/guide-gpt-6-codex"
      />
      <div className="gpt-guide gpt6-guide">
        <section className="gpt-hero" aria-labelledby="gpt6-title">
          <div className="container gpt-hero-inner">
            <p className="gpt-eyebrow"><BrainCircuit size={18} aria-hidden="true" /> Guide pratique FormaPrompt</p>
            <h1 id="gpt6-title">GPT‑6 et GPT‑6.1 :<br /><span>choisir Astra, Sol, Terra ou Luna</span></h1>
            <p className="gpt-hero-lead">Une activité à rédiger, un graphique à lire ou un dossier à examiner : partez du travail à réaliser, puis comparez le résultat à vos critères.</p>
            <p className="gpt6-update">Guide actualisé le <time dateTime="2026-11-01">1er novembre 2026</time></p>
            <div className="gpt-equation" aria-label="Définir la tâche, choisir le modèle et ajuster l’effort">
              <div><strong>1</strong><span>Définir la tâche</span></div>
              <span className="gpt-plus" aria-hidden="true">+</span>
              <div><strong>2</strong><span>Choisir le modèle</span></div>
              <ArrowRight className="gpt-arrow" aria-hidden="true" />
              <div className="gpt-result"><Check size={22} aria-hidden="true" /><span>Ajuster l’effort</span></div>
            </div>
            <a className="gpt-scroll-link" href="#gpt6-choisir">Voir des exemples <ChevronRight size={18} aria-hidden="true" /></a>
          </div>
        </section>

        <section className="gpt-section container" aria-labelledby="gpt6-models">
          <div className="gpt-section-heading">
            <span className="gpt-step">Les modèles</span>
            <h2 id="gpt6-models">Quatre choix selon le travail à réaliser</h2>
            <p>Le catalogue officiel distingue <strong>GPT‑6 Astra, GPT‑6.1 Sol, GPT‑6.1 Terra et GPT‑6 Luna</strong>. Sol et Terra portent ici la version 6.1. Les exemples sont des pistes à tester sur vos propres tâches.</p>
          </div>
          <div className="gpt-model-grid">
            {models.map((model) => {
              const Icon = model.icon;
              return (
                <article className={`gpt-model-card ${model.color}`} key={model.name}>
                  <div className="gpt-model-icon"><Icon size={28} aria-hidden="true" /></div>
                  <p className="gpt-model-family">{model.family}</p>
                  <h3>{model.name}</h3>
                  <p className="gpt-model-label">{model.label}</p>
                  <p className="gpt-model-summary">{model.summary}</p>
                  <h4>Exemples d’utilisation</h4>
                  <ul>{model.examples.map((item) => <li key={item}><Check size={16} aria-hidden="true" /> {item}</li>)}</ul>
                  <div className="gpt-caution"><strong>Point de vigilance :</strong> {model.caution}</div>
                </article>
              );
            })}
          </div>
          <div className="gpt-memory-tip"><Lightbulb size={28} aria-hidden="true" /><div><strong>Un repère simple</strong><p>Luna pour une tâche ciblée ; Terra pour la rédaction et les supports visuels ; Sol pour un travail complexe suivi ; Astra pour les situations les plus exigeantes. Vérifiez ce choix sur un exemple connu.</p></div></div>
        </section>

        <section className="gpt-effort-section" aria-labelledby="gpt6-effort">
          <div className="container">
            <div className="gpt-section-heading light">
              <span className="gpt-step">Le réglage</span>
              <h2 id="gpt6-effort">Ajuster l’effort de raisonnement</h2>
              <p>Un effort plus élevé peut aider à traiter un problème complexe. Il demande généralement davantage de temps et de tokens, les unités de texte consommées par le modèle. La longueur souhaitée reste une consigne à préciser séparément.</p>
            </div>
            <div className="gpt-analogy"><Gauge size={34} aria-hidden="true" /><p><strong>Commencez avec le réglage par défaut de votre produit.</strong> Si des contraintes restent oubliées, précisez la demande, puis essayez un effort supérieur et comparez les résultats.</p></div>
            <div className="gpt-effort-list">
              <article className="gpt-effort-row"><div className="gpt-effort-number">1</div><div className="gpt-effort-name"><h3>Faible</h3></div><p>Une piste pour une tâche courte et facile à contrôler.</p><p className="gpt-effort-example">Exemple : corriger une phrase.</p></article>
              <article className="gpt-effort-row"><div className="gpt-effort-number">2</div><div className="gpt-effort-name"><h3>Moyen</h3></div><p>Un repère pour une demande structurée avec plusieurs consignes.</p><p className="gpt-effort-example">Exemple : préparer un exercice de formation.</p></article>
              <article className="gpt-effort-row"><div className="gpt-effort-number">3</div><div className="gpt-effort-name"><h3>Élevé</h3></div><p>À essayer si le problème nécessite davantage d’analyse.</p><p className="gpt-effort-example">Exemple : chercher des contradictions entre documents.</p></article>
            </div>
            <details className="gpt6-advanced">
              <summary>Comprendre les réglages avancés</summary>
              <p>Dans l’API, Astra et Sol 6.1 proposent <code>low</code>, <code>medium</code>, <code>high</code>, <code>xhigh</code> et <code>max</code>. Terra 6.1 et Luna proposent aussi <code>none</code>. Les intitulés visibles dans une application peuvent différer.</p>
              <p>Le mode Ultra de Work et Codex fait intervenir des sous-agents. Il ne correspond pas simplement au réglage <code>max</code> de l’API. Consultez les options réellement disponibles dans votre compte.</p>
            </details>
          </div>
        </section>

        <section className="gpt-section container" id="gpt6-choisir" aria-labelledby="gpt6-examples">
          <div className="gpt-section-heading"><span className="gpt-step">Cas concrets</span><h2 id="gpt6-examples">Choisissez une situation proche de la vôtre</h2><p>Chaque exemple suit CROP : Contexte, Rôle, Objectif et Précisions. Essayez avec des données fictives ou des documents que vous êtes autorisé à utiliser.</p></div>
          <div className="gpt-chooser">
            <div className="gpt-choices" role="group" aria-label="Type de tâche">
              {situations.map((item, index) => <button type="button" key={item.title} className={selected === index ? 'active' : ''} aria-pressed={selected === index} aria-controls="gpt6-recommendation" onClick={() => setSelected(index)}><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight size={18} aria-hidden="true" /></button>)}
            </div>
            <div className="gpt-recommendation" id="gpt6-recommendation" aria-live="polite" aria-atomic="true">
              <p className="gpt-reco-label">Un choix possible</p>
              <div className="gpt-reco-pills"><span><strong>{recommendation.model}</strong></span><span>Effort : <strong>{recommendation.effort}</strong></span></div>
              <blockquote>{recommendation.example}</blockquote>
              <p>{recommendation.reason}</p>
              <p className="gpt6-check"><strong>À vérifier :</strong> {recommendation.check}</p>
            </div>
          </div>
          <p className="gpt6-practice">Pour comparer deux réglages, gardez la même consigne et les mêmes sources. Repérez un écart précis, corrigez-le, puis décidez si le gain justifie le temps et la consommation supplémentaires.</p>
        </section>

        <section className="gpt-surfaces-section" aria-labelledby="gpt6-access">
          <div className="container">
            <div className="gpt-section-heading"><span className="gpt-step">Votre interface</span><h2 id="gpt6-access">Modèle, abonnement et effort : trois repères distincts</h2><p>Le modèle traite la demande. L’abonnement et les réglages de l’organisation déterminent les accès et les limites. L’effort règle la place donnée au raisonnement.</p></div>
            <div className="gpt-surfaces-grid">
              <article><h3>ChatGPT Work et Codex</h3><p>Les recommandations de ce guide concernent principalement ces espaces. Ouvrez le sélecteur ou les réglages avancés pour voir les modèles et les efforts accessibles à votre compte.</p></article>
              <article><h3>Conversations ChatGPT classiques</h3><p>Le sélecteur et les noms affichés peuvent être différents. La documentation Work et Codex ne suffit pas à confirmer les modèles de ChatGPT classique : vérifiez votre interface et son aide dédiée.</p></article>
              <article><h3>API OpenAI</h3><p>Le développeur choisit un identifiant de modèle et ses paramètres dans son application. Les tarifs et les limites API ne se transposent pas directement à un abonnement Work ou Codex.</p></article>
            </div>
          </div>
        </section>

        <section className="gpt-sources container" aria-labelledby="gpt6-sources">
          <ShieldCheck size={26} aria-hidden="true" />
          <div>
            <h2 id="gpt6-sources">Disponibilité et sources</h2>
            <p>La présence d’un modèle dans le catalogue API ne garantit pas sa disponibilité dans chaque application. Vérifiez les choix affichés dans votre produit avant de retenir un réglage.</p>
            <p className="gpt-source-links">Sources officielles consultées le 1er novembre 2026 : <a href="https://developers.openai.com/api/docs/models" target="_blank" rel="noreferrer">catalogue OpenAI</a>, <a href="https://developers.openai.com/api/docs/models/gpt-6-astra" target="_blank" rel="noreferrer">GPT‑6 Astra</a>, <a href="https://developers.openai.com/api/docs/models/gpt-6.1-sol" target="_blank" rel="noreferrer">GPT‑6.1 Sol</a>, <a href="https://developers.openai.com/api/docs/models/gpt-6.1-terra" target="_blank" rel="noreferrer">GPT‑6.1 Terra</a>, <a href="https://developers.openai.com/api/docs/models/gpt-6-luna" target="_blank" rel="noreferrer">GPT‑6 Luna</a>, <a href="https://developers.openai.com/api/docs/guides/latest-model" target="_blank" rel="noreferrer">guide GPT‑6 pour l’API</a> et <a href="https://learn.chatgpt.com/docs/models" target="_blank" rel="noreferrer">choix des modèles dans Work et Codex</a>.</p>
            <p>Pour une comparaison avec d’autres outils, lire <Link to="/blog/gpt-6-astra-comparatif-claude-gemini-manus">notre article sur GPT‑6 Astra</Link>. L’ancien <Link to="/guide-gpt-5-6-codex">guide GPT‑5.6</Link> reste accessible comme repère sur la génération précédente.</p>
          </div>
        </section>

        <section className="gpt6-download tool-guide-download container" aria-labelledby="gpt6-download-title">
          <div>
            <p className="gpt-step">À conserver</p>
            <h2 id="gpt6-download-title"><Download size={26} aria-hidden="true" /> Télécharger le guide en PDF</h2>
            <p>Conservez les quatre modèles, les repères de raisonnement et les cinq exemples CROP dans un document de quatre pages, avec les sources et les liens vers FormaPrompt.</p>
            <a className="btn btn-primary gpt6-download-link" href="/assets/guides/pdf/guide-gpt-6-gpt-6-1-formaprompt.pdf" download="guide-gpt-6-gpt-6-1-formaprompt.pdf">
              <Download size={20} aria-hidden="true" /> Télécharger le guide PDF <span>(PDF, 4 pages)</span>
            </a>
            <p className="tool-guide-download-note">Le PDF correspond aux informations datées de ce guide. Les modèles et les interfaces peuvent évoluer.</p>
          </div>
        </section>
      </div>
    </>
  );
}
