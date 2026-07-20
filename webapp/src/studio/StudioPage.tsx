import { ArrowRight, BookOpenCheck, CheckCircle2, ClipboardCheck, Layers3, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { CategorySelector } from './components/CategorySelector';
import { DraftNotice } from './components/DraftNotice';
import { PromptResult } from './components/PromptResult';
import { StudioForm } from './components/StudioForm';
import { StudioProgress } from './components/StudioProgress';
import { loadStudioCategory } from './categories/loadCategory';
import { studioCategoryCatalog, studioCategoryFamilies } from './categories/registry';
import { calculateCategoryScore } from './engine/scoreCategory';
import { clearStudioDraft, loadStudioDraft, saveStudioDraft, STUDIO_DRAFT_VERSION } from './draft';
import { studioLandingContent } from './landingContent';
import { calculateStudioProgress } from './progress';
import type { StudioCategoryConfig, StudioCategoryFamilyId, StudioCategoryId, StudioResult } from './types';
import './studio.css';

const studioUrl = 'https://formaprompt.com/studio/';
const studioImageUrl = 'https://formaprompt.com/assets/logo-new.png';

const studioFaq = [
  {
    question: 'Le Studio enregistre-t-il mes informations ?',
    answer: 'Le Studio conserve automatiquement un brouillon uniquement dans votre navigateur. Aucune saisie n’est envoyée à un serveur et vous pouvez effacer ce brouillon à tout moment.',
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
      url: studioUrl,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Navigateur web',
      inLanguage: 'fr-FR',
      isAccessibleForFree: true,
      description: 'Outil pédagogique gratuit pour structurer et diagnostiquer des prompts de courriels, documents, articles, recherches, analyses, productivité, code, bureautique, formations, présentations, marketing, publications, images, vidéos, contenus audio et agents avec la méthode CROP.',
      provider: {
        '@type': 'Organization',
        name: 'FormaPrompt',
        url: 'https://formaprompt.com/',
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
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://formaprompt.com/' },
        { '@type': 'ListItem', position: 2, name: 'Studio', item: studioUrl },
      ],
    },
  ],
};

export default function StudioPage() {
  const [restoredDraft] = useState(() => loadStudioDraft());
  const [selectedCategoryId, setSelectedCategoryId] = useState<StudioCategoryId | null>(restoredDraft?.categoryId ?? null);
  const [activeFamily, setActiveFamily] = useState<StudioCategoryFamilyId | null>(restoredDraft?.activeFamily ?? null);
  const [initialValues, setInitialValues] = useState<FieldValues | undefined>(restoredDraft?.values);
  const [currentValues, setCurrentValues] = useState<FieldValues>(restoredDraft?.values ?? {});
  const [draftStatus, setDraftStatus] = useState<'restored' | 'deleted' | null>(restoredDraft ? 'restored' : null);
  const [category, setCategory] = useState<StudioCategoryConfig<FieldValues> | null>(null);
  const [isCategoryLoading, setIsCategoryLoading] = useState(Boolean(restoredDraft));
  const [result, setResult] = useState<StudioResult<FieldValues> | null>(null);
  const [isResultStale, setIsResultStale] = useState(false);
  const [selectionAnnouncement, setSelectionAnnouncement] = useState('');
  const draftTimerRef = useRef<number | null>(null);
  const categoryRequestRef = useRef(0);
  const shouldFocusFormRef = useRef(false);
  const contentScoreRules = category?.scoreRules ?? studioLandingContent.scoreRules;
  const contentBeforeAfter = category?.beforeAfter ?? studioLandingContent.beforeAfter;
  const contentExamples = category?.examples ?? studioLandingContent.examples;

  const persistDraft = useCallback((draftCategory: StudioCategoryConfig<FieldValues>, family: StudioCategoryFamilyId | null, values: FieldValues) => {
    const progress = calculateStudioProgress(draftCategory, values, false);
    saveStudioDraft({
      version: STUDIO_DRAFT_VERSION,
      updatedAt: new Date().toISOString(),
      categoryId: draftCategory.id,
      activeFamily: family,
      values: Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
      progress,
    });
  }, []);

  const selectCategory = async (categoryId: StudioCategoryId, family: StudioCategoryFamilyId | null) => {
    const requestId = ++categoryRequestRef.current;
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    setSelectedCategoryId(categoryId);
    setActiveFamily(family);
    setCategory(null);
    setIsCategoryLoading(true);
    setInitialValues(undefined);
    setCurrentValues({});
    setResult(null);
    setIsResultStale(false);
    setDraftStatus(null);
    try {
      const nextCategory = await loadStudioCategory(categoryId);
      if (categoryRequestRef.current !== requestId) return;
      setCategory(nextCategory);
      setCurrentValues(nextCategory.defaultValues);
      setSelectionAnnouncement(`${nextCategory.label} sélectionné. Le formulaire a été adapté.`);
      shouldFocusFormRef.current = true;
      persistDraft(nextCategory, family, nextCategory.defaultValues);
    } catch {
      if (categoryRequestRef.current !== requestId) return;
      setSelectedCategoryId(null);
      setSelectionAnnouncement('Le formulaire n’a pas pu être préparé. Réessayez en sélectionnant le cas d’usage.');
    } finally {
      if (categoryRequestRef.current === requestId) setIsCategoryLoading(false);
    }
  };

  useEffect(() => {
    if (!restoredDraft) return;
    const requestId = ++categoryRequestRef.current;
    loadStudioCategory(restoredDraft.categoryId)
      .then((restoredCategory) => {
        if (categoryRequestRef.current !== requestId) return;
        setCategory(restoredCategory);
      })
      .catch(() => {
        if (categoryRequestRef.current !== requestId) return;
        clearStudioDraft();
        setSelectedCategoryId(null);
        setInitialValues(undefined);
        setCurrentValues({});
        setDraftStatus(null);
        setSelectionAnnouncement('Le brouillon local n’a pas pu être restauré et a été ignoré.');
      })
      .finally(() => {
        if (categoryRequestRef.current === requestId) setIsCategoryLoading(false);
      });
  }, [restoredDraft]);

  const handleValuesChange = useCallback((values: FieldValues) => {
    setCurrentValues(values);
    setIsResultStale((current) => (result ? true : current));
    if (!selectedCategoryId || !category) return;
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => {
      const progress = calculateStudioProgress(category, values, Boolean(result));
      saveStudioDraft({
        version: STUDIO_DRAFT_VERSION,
        updatedAt: new Date().toISOString(),
        categoryId: selectedCategoryId,
        activeFamily,
        values: Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
        progress,
      });
    }, 650);
  }, [activeFamily, category, result, selectedCategoryId]);

  useEffect(() => () => {
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
  }, []);

  useEffect(() => {
    if (!selectedCategoryId || !shouldFocusFormRef.current) return;
    shouldFocusFormRef.current = false;
    window.requestAnimationFrame(() => {
      document.getElementById('studio-form-start')?.focus({ preventScroll: true });
      document.getElementById('studio-form')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }, [selectedCategoryId]);

  const progress = useMemo(() => {
    if (!category) return { activeStep: 1, completedSections: [] };
    return calculateStudioProgress(category, currentValues, Boolean(result) && !isResultStale);
  }, [category, currentValues, isResultStale, result]);

  const removeDraft = useCallback(() => {
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    clearStudioDraft();
    setDraftStatus('deleted');
  }, []);

  const restartStudio = () => {
    categoryRequestRef.current += 1;
    removeDraft();
    setSelectedCategoryId(null);
    setActiveFamily(null);
    setCategory(null);
    setIsCategoryLoading(false);
    setInitialValues(undefined);
    setCurrentValues({});
    setResult(null);
    setIsResultStale(false);
    setSelectionAnnouncement('Le Studio est prêt pour un nouveau cas d’usage.');
  };

  const editInformation = () => {
    document.getElementById('studio-form-start')?.focus({ preventScroll: true });
    document.getElementById('studio-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const buildResult = (values: FieldValues) => {
    if (!category) return;
    setResult({
      values,
      prompt: category.buildPrompt(values),
      diagnostic: calculateCategoryScore(category, values),
    });
    setIsResultStale(false);
    handleValuesChange(values);
  };

  return (
    <div className="studio-page">
      <SEO
        title="FormaPrompt Studio – Structurer un prompt avec la méthode CROP"
        description="Structurez gratuitement vos prompts de courriels, documents, articles, recherches, analyses, productivité, code, bureautique, formations, présentations, marketing, publications, images, vidéos, contenus audio et agents avec la méthode CROP, un score expliqué et des recommandations."
        url={studioUrl}
        image={studioImageUrl}
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
              <li><CheckCircle2 aria-hidden="true" /> Brouillon conservé uniquement dans ce navigateur</li>
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

          <CategorySelector
            categories={studioCategoryCatalog}
            families={studioCategoryFamilies}
            value={selectedCategoryId}
            initialFamily={activeFamily}
            onChange={selectCategory}
            onFamilyChange={setActiveFamily}
          />

          <p className="studio-selection-announcement sr-only" aria-live="polite">{selectionAnnouncement}</p>

          {isCategoryLoading && (
            <div className="studio-category-loading" role="status">
              <span aria-hidden="true" /> Préparation du formulaire…
            </div>
          )}

          {category && (
            <>
              <StudioProgress progress={progress} />

              <div className="studio-privacy-warning" role="note" aria-label="Avertissement sur les informations sensibles">
                <ShieldCheck aria-hidden="true" />
                <div>
                  <h3>Préservez la confidentialité</h3>
                  <p>Ne saisissez pas de données personnelles, confidentielles, médicales, financières ou sensibles. Votre brouillon est conservé uniquement dans ce navigateur.</p>
                  <small>{category.messages.privacy}</small>
                </div>
              </div>

              <DraftNotice status={draftStatus} onClear={removeDraft} />

              <StudioForm
                key={category.id}
                category={category}
                examples={studioCategoryCatalog.find((item) => item.id === category.id)?.examples ?? []}
                initialValues={initialValues}
                hasResult={Boolean(result)}
                onSubmit={buildResult}
                onValuesChange={handleValuesChange}
              />
            </>
          )}

          {result && category && (
            <PromptResult
              prompt={result.prompt}
              diagnostic={result.diagnostic}
              isStale={isResultStale}
              resultHelp={category.messages.resultHelp}
              recommendations={category.recommendations}
              onEdit={editInformation}
              onRestart={restartStudio}
              onClearDraft={removeDraft}
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
            {contentScoreRules.map((rule) => (
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
              <blockquote>{contentBeforeAfter.vagueRequest}</blockquote>
              <p>{contentBeforeAfter.missingDescription}</p>
            </article>
            <article className="is-after">
              <span>Après</span>
              <h3>Prompt structuré</h3>
              <blockquote>{contentBeforeAfter.structuredPrompt}</blockquote>
              <p>{contentBeforeAfter.benefit}</p>
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
            {contentExamples.map((example) => (
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
