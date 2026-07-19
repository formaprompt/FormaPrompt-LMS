import { AlertTriangle, ArrowRight, BookOpenCheck, CheckCircle2, ClipboardCheck, Layers3 } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { CategorySelector } from './components/CategorySelector';
import { PromptResult } from './components/PromptResult';
import { StudioForm } from './components/StudioForm';
import {
  getAvailableStudioCategory,
  studioCategoryCatalog,
  studioCategoryFamilies,
} from './categories/registry';
import { calculateCategoryScore } from './engine/scoreCategory';
import type { StudioCategoryId, StudioResult } from './types';
import './studio.css';

const studioFaq = [
  {
    question: 'Le Studio enregistre-t-il mes informations ?',
    answer: 'Non. Cette première version fonctionne dans votre navigateur, sans compte et sans stockage. La saisie disparaît lorsque vous quittez ou rechargez la page.',
  },
  {
    question: 'Le score garantit-il un bon résultat ?',
    answer: 'Non. Le score est un repère pédagogique fondé sur la grille CROP. Il mesure la présence d’informations utiles, pas la vérité ni la qualité finale du contenu obtenu.',
  },
  {
    question: 'Puis-je saisir un contenu réel ou un dossier concernant une personne ?',
    answer: 'Non. Utilisez une situation fictive, générique ou anonymisée. Ne saisissez aucune donnée personnelle, confidentielle, médicale, financière ou sensible.',
  },
  {
    question: 'À quoi sert la méthode CROP ?',
    answer: 'Elle aide à structurer une demande autour du Contexte, du Rôle, de l’Objectif et des Précisions afin de réduire les ambiguïtés et de faciliter la vérification du résultat.',
  },
];

const studioStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'FormaPrompt Studio — Structurer un prompt avec la méthode CROP',
      url: 'https://www.formaprompt.com/studio',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Navigateur web',
      inLanguage: 'fr-FR',
      isAccessibleForFree: true,
      description: 'Outil pédagogique gratuit pour structurer et diagnostiquer des prompts de courriels, documents, articles, recherches, analyses, productivité, code, bureautique, formations, présentations, marketing, publications, images et vidéos avec la méthode CROP.',
      provider: {
        '@type': 'Organization',
        name: 'FormaPrompt',
        url: 'https://www.formaprompt.com',
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: studioFaq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.formaprompt.com/' },
        { '@type': 'ListItem', position: 2, name: 'Studio', item: 'https://www.formaprompt.com/studio' },
      ],
    },
  ],
};

export default function StudioPage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<StudioCategoryId>('professional-email');
  const [result, setResult] = useState<StudioResult<FieldValues> | null>(null);
  const [isResultStale, setIsResultStale] = useState(false);
  const category = getAvailableStudioCategory(selectedCategoryId);

  const selectCategory = (categoryId: StudioCategoryId) => {
    if (!getAvailableStudioCategory(categoryId)) return;
    setSelectedCategoryId(categoryId);
    setResult(null);
    setIsResultStale(false);
  };

  const markResultAsStale = useCallback(() => {
    setIsResultStale((current) => (result ? true : current));
  }, [result]);

  if (!category) return null;

  const buildResult = (values: FieldValues) => {
    setResult({
      values,
      prompt: category.buildPrompt(values),
      diagnostic: calculateCategoryScore(category, values),
    });
    setIsResultStale(false);
  };

  return (
    <div className="studio-page">
      <SEO
        title="FormaPrompt Studio – Structurer un prompt avec la méthode CROP"
        description="Structurez gratuitement vos prompts de courriels, documents, articles, recherches, analyses, productivité, code, bureautique, formations, présentations, marketing, publications, images et vidéos avec la méthode CROP, un score expliqué et des recommandations."
        url="https://www.formaprompt.com/studio"
        image="https://www.formaprompt.com/assets/photo%20page%20d'accueil.png"
        type="website"
        jsonLd={studioStructuredData}
      />

      <section className="studio-hero">
        <nav className="container studio-breadcrumb" aria-label="Fil d’Ariane">
          <Link to="/">Accueil</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Studio</span>
        </nav>
        <div className="container studio-hero-layout">
          <div>
            <p className="studio-kicker">FormaPrompt Studio 2026</p>
            <h1>Construisez un prompt clair pour vos usages professionnels</h1>
            <p className="studio-hero-introduction">
              Choisissez un cas d’usage, suivez les quatre repères CROP et repartez avec un prompt structuré,
              un score de qualité expliqué et des recommandations d’amélioration concrètes.
            </p>
            <a href="#outil-studio" className="btn btn-primary studio-hero-action">
              Commencer gratuitement <ArrowRight aria-hidden="true" />
            </a>
          </div>
          <aside className="studio-hero-panel" aria-label="Fonctionnement du Studio">
            <Layers3 aria-hidden="true" />
            <h2>Un diagnostic déterministe</h2>
            <ul>
              <li><CheckCircle2 aria-hidden="true" /> Aucun appel à un fournisseur externe</li>
              <li><CheckCircle2 aria-hidden="true" /> Aucune saisie enregistrée</li>
              <li><CheckCircle2 aria-hidden="true" /> Une grille CROP documentée sur 100 points</li>
            </ul>
          </aside>
        </div>
      </section>

      <section id="outil-studio" className="studio-tool-section" aria-labelledby="studio-tool-title">
        <div className="container studio-tool-container">
          <div className="studio-section-heading">
            <p className="studio-eyebrow">Outil public</p>
            <h2 id="studio-tool-title">Préparez votre prompt pas à pas</h2>
            <p>Les champs obligatoires permettent de construire le prompt. Les champs facultatifs améliorent son diagnostic.</p>
          </div>

          <div className="studio-privacy-warning" role="note" aria-label="Avertissement sur les informations sensibles">
            <AlertTriangle aria-hidden="true" />
            <div>
              <h3>Protégez vos informations</h3>
              <p>{category.messages.privacy}</p>
            </div>
          </div>

          <CategorySelector
            categories={studioCategoryCatalog}
            families={studioCategoryFamilies}
            value={selectedCategoryId}
            onChange={selectCategory}
          />

          <StudioForm
            key={category.id}
            category={category}
            hasResult={Boolean(result)}
            onSubmit={buildResult}
            onValuesChange={markResultAsStale}
          />

          {result && (
            <PromptResult
              prompt={result.prompt}
              diagnostic={result.diagnostic}
              isStale={isResultStale}
              resultHelp={category.messages.resultHelp}
              recommendations={category.recommendations}
            />
          )}
        </div>
      </section>

      <section className="studio-method-section" aria-labelledby="crop-title">
        <div className="container">
          <div className="studio-section-heading">
            <p className="studio-eyebrow">Méthode pédagogique</p>
            <h2 id="crop-title">Comprendre la méthode CROP</h2>
            <p>Chaque partie répond à une question simple et contribue au score de qualité.</p>
          </div>
          <div className="studio-crop-grid">
            {category.scoreRules.map((rule) => (
              <article key={rule.id}>
                <strong>{rule.label.slice(0, 1)}</strong>
                <h3>{rule.label}</h3>
                <p>{rule.description}</p>
                <span>{`${rule.maxPoints} points`}</span>
              </article>
            ))}
          </div>
          <p className="studio-score-disclaimer">
            Le score mesure la présence et le niveau de détail des informations demandées. Il ne vérifie ni leur vérité,
            ni la qualité d’une réponse future et ne constitue pas une mesure scientifique.
          </p>
        </div>
      </section>

      <section className="studio-example-section" aria-labelledby="before-after-title">
        <div className="container">
          <div className="studio-section-heading">
            <p className="studio-eyebrow">Exemple avant-après</p>
            <h2 id="before-after-title">Passer d’une demande vague à une consigne vérifiable</h2>
          </div>
          <div className="studio-before-after">
            <article className="is-before">
              <span>Avant</span>
              <h3>Demande imprécise</h3>
              <blockquote>{category.beforeAfter.vagueRequest}</blockquote>
              <p>{category.beforeAfter.missingDescription}</p>
            </article>
            <article className="is-after">
              <span>Après</span>
              <h3>Prompt structuré</h3>
              <blockquote>{category.beforeAfter.structuredPrompt}</blockquote>
              <p>{category.beforeAfter.benefit}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="studio-use-cases-section" aria-labelledby="examples-title">
        <div className="container">
          <div className="studio-section-heading">
            <p className="studio-eyebrow">Idées de départ</p>
            <h2 id="examples-title">Exemples de prompts à préparer</h2>
          </div>
          <div className="studio-use-case-grid">
            {category.examples.map((example) => (
              <article key={example.title}>
                <ClipboardCheck aria-hidden="true" />
                <h3>{example.title}</h3>
                <p>{example.description}</p>
                <details className="studio-prompt-example">
                  <summary>Lire le prompt complet</summary>
                  <pre><code>{example.prompt}</code></pre>
                </details>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="studio-faq-section" aria-labelledby="studio-faq-title">
        <div className="container studio-narrow-container">
          <div className="studio-section-heading">
            <p className="studio-eyebrow">Questions fréquentes</p>
            <h2 id="studio-faq-title">FAQ du Studio</h2>
          </div>
          <div className="studio-faq-list">
            {studioFaq.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="studio-resources-section" aria-labelledby="studio-resources-title">
        <div className="container studio-resources-layout">
          <BookOpenCheck aria-hidden="true" />
          <div>
            <h2 id="studio-resources-title">Approfondir avec FormaPrompt</h2>
            <p>Le Studio complète les parcours pédagogiques et les ressources consacrés aux usages professionnels responsables.</p>
            <div className="studio-internal-links">
              <Link to="/formation-prompt-engineering">Formation Prompt Engineering</Link>
              <Link to="/formation-ia-generative">Formation IA générative</Link>
              <Link to="/blog">Ressources et articles</Link>
              <Link to="/dashboard">Accéder à l’espace apprenant</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
