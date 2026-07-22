import { HelmetProvider } from 'react-helmet-async';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { professionalEmailCategory } from './categories/professionalEmail';
import { studioCategoryCatalog } from './categories/registry';
import { STUDIO_DRAFT_KEY } from './draft';
import { calculateCategoryScore } from './engine/scoreCategory';
import StudioPage from './StudioPage';

const clipboardWrite = vi.fn<(text: string) => Promise<void>>();

function renderStudio() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <StudioPage />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

async function chooseCategory(user: UserEvent, label: string) {
  const button = screen.getByRole('button', { name: label, pressed: false });
  await user.click(button);
}

describe('Sprint 1 UX du Studio', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clipboardWrite.mockReset();
    clipboardWrite.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('affiche les cinq familles, les 16 catégories et les quatre raccourcis populaires', () => {
    const { container } = renderStudio();

    expect(screen.getByRole('heading', { name: 'Que souhaitez-vous préparer ?' })).toBeInTheDocument();
    for (const family of ['Écrire', 'Transmettre', 'Analyser', 'Créer', 'Construire']) {
      expect(screen.getByRole('button', { name: family })).toHaveAttribute('aria-pressed', 'false');
    }
    expect(container.querySelectorAll('.studio-category-card')).toHaveLength(16);
    expect(within(screen.getByRole('region', { name: 'Les plus utilisés' })).getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByText(/prochainement|bientôt disponible/i)).not.toBeInTheDocument();
  });

  it('sélectionne une catégorie avec son identifiant historique puis affiche le résumé compact', async () => {
    const user = userEvent.setup();
    renderStudio();

    await chooseCategory(user, 'Formation');

    expect(screen.getAllByRole('heading', { name: 'Formation' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Changer de cas d’usage' })).toBeInTheDocument();
    expect(await screen.findByLabelText(/^Décrivez le besoin de formation/)).toBeInTheDocument();
    await waitFor(() => expect(document.getElementById('studio-form-start')).toHaveFocus());
    expect(JSON.parse(window.localStorage.getItem(STUDIO_DRAFT_KEY) ?? '{}')).toMatchObject({ categoryId: 'training' });
  });

  it('permet la sélection au clavier avec Entrée et Espace', async () => {
    const user = userEvent.setup();
    renderStudio();

    const emailCard = screen.getByRole('button', { name: 'Courriel professionnel', pressed: false });
    emailCard.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText(/^Décrivez votre besoin/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Changer de cas d’usage' }));
    const trainingCard = screen.getByRole('button', { name: 'Formation', pressed: false });
    trainingCard.focus();
    await user.keyboard(' ');
    expect(screen.getByLabelText(/^Décrivez le besoin de formation/)).toBeInTheDocument();
  });

  it.each([
    ['rapport', 'Documents professionnels'],
    ['ARTICLE', 'Articles et contenus éditoriaux'],
    ['LinkedIn', 'Réseaux sociaux'],
    ['publicite', 'Marketing et communication'],
    ['PowerPoint', 'Présentation'],
    ['Excel', 'Bureautique et données'],
    ['resume', 'Analyse et synthèse'],
    ['podcast', 'Audio'],
    ['programmation', 'Code'],
    ['agent', 'Agent IA'],
  ])('recherche « %s » sans dépendre de la casse ou des accents', async (query, expectedCategory) => {
    const user = userEvent.setup();
    renderStudio();
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher un cas d’usage' }), query);
    expect(screen.getByRole('button', { name: expectedCategory, pressed: false })).toBeInTheDocument();
  });

  it('affiche l’absence de résultat et permet d’effacer le filtre', async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher un cas d’usage' }), 'terme introuvable xyz');
    expect(screen.getByText('Aucun cas d’usage ne correspond à votre recherche. Essayez un terme plus général.')).toBeInTheDocument();
    const noResults = screen.getByText('Aucun cas d’usage ne correspond à votre recherche. Essayez un terme plus général.').parentElement;
    expect(noResults).not.toBeNull();
    await user.click(within(noResults as HTMLElement).getByRole('button', { name: 'Effacer la recherche' }));
    expect(screen.getByRole('button', { name: 'Formation', pressed: false })).toBeInTheDocument();
  });

  it('préremplit un exemple sans générer puis protège une saisie existante', async () => {
    const user = userEvent.setup();
    renderStudio();
    await chooseCategory(user, 'Réseaux sociaux');

    await user.click(await screen.findByRole('button', { name: 'Rédiger un post LinkedIn' }));
    const contextField = screen.getByLabelText(/^Décrivez le sujet et son contexte/);
    expect(contextField).toHaveValue('Rédiger un post LinkedIn sur [SUJET].');
    expect(screen.queryByRole('heading', { name: 'Votre prompt structuré' })).not.toBeInTheDocument();

    await user.clear(contextField);
    await user.type(contextField, 'Mon texte déjà renseigné');
    await user.click(screen.getByRole('button', { name: 'Créer une publication Facebook' }));
    expect(screen.getByText(/Certains champs concernés contiennent déjà du texte/)).toBeInTheDocument();
    expect(contextField).toHaveValue('Mon texte déjà renseigné');
    await user.click(screen.getByRole('button', { name: 'Remplacer avec ce modèle' }));
    expect(contextField).toHaveValue('Préparer une publication Facebook claire et accessible.');
    await user.type(contextField, ' Texte modifiable.');
    expect((contextField as HTMLInputElement).value).toContain('Texte modifiable');
  });

  it('actualise la prévisualisation, le score et les conseils sans générer le résultat', async () => {
    const user = userEvent.setup();
    renderStudio();
    await chooseCategory(user, 'Courriel professionnel');
    await user.click(screen.getByRole('button', { name: /Score actuel.*Voir mon prompt en cours/ }));

    const preview = screen.getByLabelText('Prévisualisation du prompt en cours');
    const initialScore = Number(screen.getByLabelText(/^Score actuel : \d+ sur 100$/).getAttribute('aria-label')?.match(/\d+/)?.[0]);
    expect(preview).toHaveTextContent('Objectif à compléter');
    expect(screen.getAllByRole('button', { name: 'Compléter ce point' })).toHaveLength(3);

    fireEvent.change(screen.getByLabelText(/^Décrivez votre besoin/), {
      target: { value: 'Préparer un courriel fictif pour rappeler une prochaine étape professionnelle.' },
    });

    await waitFor(() => {
      expect(preview).toHaveTextContent('Préparer un courriel fictif pour rappeler une prochaine étape professionnelle.');
      const updatedScore = Number(screen.getByLabelText(/^Score actuel : \d+ sur 100$/).getAttribute('aria-label')?.match(/\d+/)?.[0]);
      expect(updatedScore).toBeGreaterThan(initialScore);
    }, { timeout: 2_000 });
    expect(screen.queryByRole('heading', { name: 'Votre prompt structuré' })).not.toBeInTheDocument();
  });

  it('sauvegarde, restaure et supprime un brouillon local sans appel réseau', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const firstRender = renderStudio();
    await chooseCategory(user, 'Courriel professionnel');
    await user.type(screen.getByLabelText(/^Décrivez votre besoin/), 'Préparer un message professionnel fictif suffisamment détaillé.');
    await user.click(screen.getByRole('button', { name: /Score actuel.*Voir mon prompt en cours/ }));

    const previewBeforeReload = screen.getByLabelText('Prévisualisation du prompt en cours').textContent;
    const scoreBeforeReload = screen.getByLabelText(/^Score actuel : \d+ sur 100$/).getAttribute('aria-label');

    await waitFor(() => {
      const savedDraft = JSON.parse(window.localStorage.getItem(STUDIO_DRAFT_KEY) ?? '{}');
      expect(savedDraft.values?.need).toBe('Préparer un message professionnel fictif suffisamment détaillé.');
    }, { timeout: 2_000 });
    expect(fetchSpy).not.toHaveBeenCalled();
    firstRender.unmount();

    renderStudio();
    expect(await screen.findByText('Votre brouillon a été restauré depuis ce navigateur.')).toBeInTheDocument();
    expect(await screen.findByLabelText(/^Décrivez votre besoin/)).toHaveValue('Préparer un message professionnel fictif suffisamment détaillé.');
    expect(screen.getByLabelText('Prévisualisation du prompt en cours').textContent?.replace(/\s+/g, ' ').trim())
      .toBe(previewBeforeReload?.replace(/\s+/g, ' ').trim());
    expect(screen.getByLabelText(/^Score actuel : \d+ sur 100$/)).toHaveAttribute('aria-label', scoreBeforeReload);
    await user.type(screen.getByLabelText(/^Décrivez votre besoin/), ' Suite modifiable.');
    expect((screen.getByLabelText(/^Décrivez votre besoin/) as HTMLTextAreaElement).value).toContain('Suite modifiable');
    await user.click(screen.getByRole('button', { name: 'Effacer mon brouillon' }));
    expect(window.localStorage.getItem(STUDIO_DRAFT_KEY)).toBeNull();
    expect(screen.getByText('Le brouillon a été supprimé de ce navigateur.')).toBeInTheDocument();

    cleanup();
    renderStudio();
    expect(screen.queryByLabelText(/^Décrivez votre besoin/)).not.toBeInTheDocument();
  });

  it('ignore et retire un brouillon corrompu', () => {
    window.localStorage.setItem(STUDIO_DRAFT_KEY, '{donnée invalide');
    renderStudio();
    expect(window.localStorage.getItem(STUDIO_DRAFT_KEY)).toBeNull();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Que souhaitez-vous préparer ?' })).toBeInTheDocument();
  });

  it('conserve le moteur, le score et le prompt pour les mêmes données puis copie le résultat', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    renderStudio();
    await chooseCategory(user, 'Courriel professionnel');

    const values = {
      ...professionalEmailCategory.defaultValues,
      need: 'Préparer un rappel avant une classe virtuelle organisée la semaine prochaine.',
      recipient: 'participants adultes inscrits à distance',
      objective: 'Rappeler les modalités pratiques et demander une confirmation de présence.',
    };
    await user.type(screen.getByLabelText(/^Décrivez votre besoin/), values.need);
    await user.type(screen.getByLabelText(/^À qui s’adresse le courriel \?/), values.recipient);
    await user.type(screen.getByLabelText(/^Objectif du courriel/), values.objective);
    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect((await screen.findByLabelText('Prompt final à copier')).textContent).toBe(professionalEmailCategory.buildPrompt(values));
    expect(screen.getByLabelText(/Score de qualité :/)).toHaveTextContent(String(calculateCategoryScore(professionalEmailCategory, values).total));
    await user.click(screen.getByRole('button', { name: 'Copier le prompt' }));
    expect(clipboardWrite).toHaveBeenCalledWith(professionalEmailCategory.buildPrompt(values));
    expect(screen.getByText('Prompt copié dans le presse-papiers.')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Tester dans mon IA' }));
    await user.click(screen.getByRole('button', { name: /^ChatGPT/ }));
    const externalLink = await screen.findByRole('link', { name: /Rouvrir ChatGPT/ });
    expect(externalLink).toHaveAttribute('href', 'https://chatgpt.com/');
    expect(externalLink.getAttribute('href')).not.toContain(encodeURIComponent(values.need));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
    expect(screen.getByText(/Votre prompt a été copié.*s’ouvre dans un nouvel onglet/)).toBeInTheDocument();
  });

  it('propose une solution de repli lorsque la copie échoue', async () => {
    const user = userEvent.setup();
    const failingClipboard = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: failingClipboard },
    });
    renderStudio();
    await chooseCategory(user, 'Courriel professionnel');
    await user.type(screen.getByLabelText(/^Décrivez votre besoin/), 'Préparer un rappel professionnel pour une situation fictive suffisamment détaillée.');
    await user.type(screen.getByLabelText(/^À qui s’adresse le courriel \?/), 'participants adultes à une formation fictive');
    await user.type(screen.getByLabelText(/^Objectif du courriel/), 'Rappeler les modalités pratiques et demander une confirmation explicite.');
    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));
    await user.click(screen.getByRole('button', { name: 'Copier le prompt' }));
    expect(await screen.findByRole('button', { name: 'Sélectionner le prompt pour le copier manuellement' })).toBeInTheDocument();
  });

  it('n’ouvre pas le service externe si sa copie échoue et propose un lien manuel', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const failingClipboard = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: failingClipboard },
    });
    renderStudio();
    await chooseCategory(user, 'Courriel professionnel');
    await user.type(await screen.findByLabelText(/^Décrivez votre besoin/), 'Préparer un rappel professionnel générique suffisamment détaillé.');
    await user.type(await screen.findByLabelText(/^À qui s’adresse le courriel \?/), 'participants adultes à une formation');
    await user.type(await screen.findByLabelText(/^Objectif du courriel/), 'Rappeler les modalités pratiques et demander une confirmation explicite.');
    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));
    await user.click(await screen.findByRole('button', { name: 'Tester dans mon IA' }));
    await user.click(screen.getByRole('button', { name: /^ChatGPT/ }));

    await waitFor(() => expect(failingClipboard).toHaveBeenCalled(), { timeout: 2_000 });
    await waitFor(() => {
      expect(document.querySelector('.studio-external-status')).toHaveTextContent('La copie a échoué');
      expect(document.querySelector('.studio-external-status')).toHaveTextContent('lien ci-dessous');
    }, { timeout: 5_000 });
    expect(screen.getByRole('link', { name: /Ouvrir ChatGPT manuellement/ })).toHaveAttribute('href', 'https://chatgpt.com/');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('relie les erreurs aux champs et annonce la progression', async () => {
    const user = userEvent.setup();
    renderStudio();
    await chooseCategory(user, 'Courriel professionnel');
    expect(screen.getByText(/Étape en cours : Contexte/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));
    const field = screen.getByLabelText(/^Décrivez votre besoin/);
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    const errorId = field.getAttribute('aria-errormessage');
    const error = errorId ? document.getElementById(errorId) : null;
    expect(error).not.toBeNull();
    expect(field.getAttribute('aria-describedby')).toContain(error?.id);
  });

  it('centralise les descriptions, mots-clés et cinq exemples des 16 identifiants existants', () => {
    expect(studioCategoryCatalog).toHaveLength(16);
    expect(new Set(studioCategoryCatalog.map((category) => category.id)).size).toBe(16);
    for (const category of studioCategoryCatalog) {
      expect(category.description.length).toBeGreaterThan(20);
      expect(category.keywords.length).toBeGreaterThan(2);
      expect(category.examples).toHaveLength(5);
    }
    const guidedModels = studioCategoryCatalog.flatMap((category) => category.examples.filter((example) => example.template));
    expect(guidedModels).toHaveLength(4);
    for (const model of guidedModels) {
      expect(model.template?.variables.length).toBeGreaterThanOrEqual(5);
      expect(model.template?.variables.every((variable) => model.template?.text.includes(variable.token))).toBe(true);
    }
  });
});
