import { HelmetProvider } from 'react-helmet-async';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('parcours principal du Studio', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    clipboardWrite.mockReset();
    clipboardWrite.mockResolvedValue(undefined);
  });

  it('construit, diagnostique, améliore puis copie un prompt de courriel', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    renderStudio();

    expect(screen.getByRole('heading', { level: 1, name: /Construisez un prompt clair/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Cas d’usage' })).toHaveValue('professional-email');
    expect(
      screen.getByRole('note', {
        name: 'Avertissement sur les informations sensibles',
      }),
    ).toHaveTextContent('Ne saisissez aucune donnée personnelle');

    await user.type(
      screen.getByLabelText(/^Décrivez votre besoin/),
      'Préparer un rappel avant une classe virtuelle organisée la semaine prochaine.',
    );
    await user.type(
      screen.getByLabelText(/^À qui s’adresse le courriel \?/),
      'participants adultes inscrits à distance',
    );
    await user.type(
      screen.getByLabelText(/^Objectif du courriel/),
      'Rappeler les modalités pratiques et demander une confirmation de présence.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    const resultTitle = await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' });
    expect(resultTitle).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Contexte');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Rôle');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Objectif');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Précisions');

    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(initialScore).toBeGreaterThan(0);
    expect(screen.getAllByText('Éléments manquants')).toHaveLength(4);

    await user.type(
      screen.getByLabelText(/^Informations utiles et autorisées/),
      'La séance fictive débute à 9 h et le lien est disponible dans la convocation générique.',
    );
    expect(screen.getByText(/Vous avez modifié un champ/i)).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/^Critères de réussite/),
      'Le courriel reste inférieur à 180 mots et la demande de confirmation est explicite.',
    );
    await user.type(
      screen.getByLabelText(/^Éléments obligatoires/),
      'Objet, date fictive, heure, matériel conseillé et confirmation attendue.',
    );
    await user.type(
      screen.getByLabelText(/^Contraintes et éléments à éviter/),
      'Phrases courtes, aucun jargon, aucune donnée personnelle et aucune information inventée.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
    expect(screen.queryByText(/Vous avez modifié un champ/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copier le prompt' }));
    expect(clipboardWrite).toHaveBeenCalledOnce();
    expect(await screen.findByText('Le prompt a été copié dans le presse-papiers.')).toBeInTheDocument();
  });

  it('change de catégorie et construit un prompt de formation avec son propre diagnostic', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'training');

    expect(categorySelector).toHaveValue('training');
    expect(screen.getByText('Concevoir une activité, une séquence ou une ressource pédagogique.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Décrivez votre besoin/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Décrivez le besoin de formation/)).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/^Décrivez le besoin de formation/),
      'Préparer une séquence pour apprendre à structurer un tableau de suivi partagé.',
    );
    await user.type(
      screen.getByLabelText(/^Quel est le public visé \?/),
      'adultes débutants travaillant dans un service administratif',
    );
    await user.type(
      screen.getByLabelText(/^Objectif pédagogique/),
      'À l’issue de la séquence, les participants sauront construire et contrôler un tableau de suivi simple.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Objectif pédagogique');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('Livrable attendu');
    expect(screen.getByText(/formulaire Formation/)).toBeInTheDocument();

    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Acquis, prérequis ou difficultés de départ/),
      'Les participants savent saisir des données mais connaissent peu les formules et les contrôles.',
    );
    await user.type(
      screen.getByLabelText(/^Critères de réussite ou modalités d’évaluation/),
      'Le tableau respecte le modèle, les calculs sont exacts et les contrôles sont expliqués.',
    );
    await user.type(
      screen.getByLabelText(/^Étapes et éléments obligatoires/),
      'Démonstration, exercice guidé, activité autonome, correction et synthèse.',
    );
    await user.type(
      screen.getByLabelText(/^Contraintes et adaptations nécessaires/),
      'Consignes courtes, navigation au clavier, données fictives et aucun outil payant.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });

  it('construit et améliore un prompt pour une publication sur les réseaux sociaux', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'social-media');

    expect(categorySelector).toHaveValue('social-media');
    expect(screen.getByText('Préparer une publication adaptée à une plateforme, un public et un objectif.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Plateforme principale/)).toHaveValue('LinkedIn');

    await user.type(
      screen.getByLabelText(/^Décrivez le sujet et son contexte/),
      'Présenter une ressource gratuite consacrée à la rédaction de consignes professionnelles claires.',
    );
    await user.type(
      screen.getByLabelText(/^À quel public s’adresse la publication \?/),
      'responsables pédagogiques et formateurs indépendants débutants',
    );
    await user.type(
      screen.getByLabelText(/^Objectif de la publication/),
      'Expliquer l’utilité de la méthode et inviter les lecteurs à consulter la ressource.',
    );
    await user.type(
      screen.getByLabelText(/^Message essentiel à retenir/),
      'Une consigne structurée réduit les ambiguïtés et facilite la vérification du résultat.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('Plateforme : LinkedIn');
    expect(screen.getByText(/formulaire Réseaux sociaux/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Critères de réussite éditoriaux/),
      'Le sujet est compris immédiatement, le bénéfice est concret et l’action finale est explicite.',
    );
    await user.type(
      screen.getByLabelText(/^Action proposée au public/),
      'Consulter le guide puis tester la méthode sur une demande professionnelle.',
    );
    await user.type(
      screen.getByLabelText(/^Éléments obligatoires/),
      'Nom de la ressource, gratuité, méthode CROP et emplacement du lien.',
    );
    await user.type(
      screen.getByLabelText(/^Contraintes et éléments à éviter/),
      'Moins de 1 200 caractères, aucun chiffre inventé et trois mots-dièse maximum.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });

  it('construit et améliore une consigne pour la création d’une image', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'image-creation');

    expect(categorySelector).toHaveValue('image-creation');
    expect(screen.getByText('Structurer une consigne visuelle adaptée à un support et un public.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Format et ratio/)).toHaveValue('format horizontal 16:9');
    expect(screen.getByLabelText(/^Outil visé/)).toHaveValue('ChatGPT Images');

    await user.type(
      screen.getByLabelText(/^Sujet principal/),
      'Une personne adulte en reconversion utilisant un ordinateur portable.',
    );
    await user.type(
      screen.getByLabelText(/^Action ou posture/),
      'Assise face à l’écran, elle construit un tableau pendant qu’un formateur lui montre une étape.',
    );
    await user.type(
      screen.getByLabelText(/^Décor et environnement/),
      'Salle de formation lumineuse, mobilier sobre et arrière-plan ordonné.',
    );
    await user.type(
      screen.getByLabelText(/^À quel public l’image est-elle destinée \?/),
      'adultes débutants en reconversion découvrant les outils bureautiques',
    );
    await user.type(
      screen.getByLabelText(/^Objectif visuel/),
      'Transmettre une impression de progression accessible et d’accompagnement bienveillant.',
    );
    await user.type(screen.getByLabelText(/^Lumière/), 'Lumière naturelle douce venant de la gauche.');
    await user.type(screen.getByLabelText(/^Ambiance/), 'Ambiance rassurante, studieuse et positive.');
    await user.type(screen.getByLabelText(/^Couleurs et contrastes/), 'Verts et bleus sobres sur un fond clair.');
    await user.type(
      screen.getByLabelText(/^Éléments à éviter et contraintes/),
      'Aucun logo, aucun texte intégré et aucun visage identifiable.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Objectif visuel');
    expect(screen.getByText(/Le Studio ne crée aucune image/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Critères de réussite visuels/),
      'Le sujet est compris immédiatement, le décor reste discret et les contrastes sont suffisants.',
    );
    await user.type(
      screen.getByLabelText(/^Éléments obligatoires dans l’image/),
      'Ordinateur portable, interaction bienveillante et espace libre dans le tiers supérieur.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });
});
