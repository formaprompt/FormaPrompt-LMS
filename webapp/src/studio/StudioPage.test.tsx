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

  it('construit et améliore un prompt pour un document professionnel', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'professional-documents');

    expect(categorySelector).toHaveValue('professional-documents');
    expect(screen.getByText(/Préparer un rapport, un compte rendu, une procédure/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Écrire' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Type de document/)).toHaveValue('rapport professionnel');

    await user.type(
      screen.getByLabelText(/^Sujet et contexte du document/),
      'Formaliser un processus fictif de validation interne utilisé par plusieurs services.',
    );
    await user.type(
      screen.getByLabelText(/^Lecteur ou destinataire du document/),
      'responsables de service découvrant le nouveau processus interne',
    );
    await user.type(
      screen.getByLabelText(/^Objectif du document/),
      'Expliquer chaque étape afin que les responsables puissent appliquer le processus sans ambiguïté.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('Type de document : rapport professionnel');
    expect(screen.getByText(/formulaire Documents professionnels/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Informations sources autorisées/),
      'Le processus comprend trois validations, une réponse sous deux jours ouvrés et un suivi dans un tableau fictif.',
    );
    await user.type(
      screen.getByLabelText(/^Résultat ou action attendue après lecture/),
      'Chaque responsable identifie son intervention, son délai et le contrôle à réaliser.',
    );
    await user.type(
      screen.getByLabelText(/^Sections et informations obligatoires/),
      'Objectif, périmètre, responsabilités, étapes, délais et points de contrôle.',
    );
    await user.type(
      screen.getByLabelText(/^Contraintes et éléments à éviter/),
      'Phrases courtes, aucun jargon non expliqué et aucune information inventée.',
    );
    await user.type(
      screen.getByLabelText(/^Critères de vérification avant utilisation/),
      'Toutes les étapes sont présentes et chaque délai correspond aux informations fournies.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });

  it('construit et améliore un article éditorial sourcé et daté', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'editorial-content');

    expect(categorySelector).toHaveValue('editorial-content');
    expect(screen.getByText('Préparer un article de blog, technique, d’actualité ou de fond avec un angle et des sources explicites.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Écrire' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Type d’article ou de contenu/), 'article d’actualité ou de veille');

    await user.type(
      screen.getByLabelText(/^Sujet, contexte et besoin éditorial/),
      'Article de veille consacré à une évolution technique récente susceptible de modifier les pratiques professionnelles.',
    );
    await user.type(
      screen.getByLabelText(/^Lectorat, niveau et attentes/),
      'responsables de petites structures, non spécialistes et lecteurs sur téléphone',
    );
    await user.type(
      screen.getByLabelText(/^Objectif éditorial et valeur apportée au lecteur/),
      'Permettre au lecteur de comprendre ce qui est confirmé et les vérifications à effectuer avant toute décision.',
    );
    await user.type(
      screen.getByLabelText(/^Angle éditorial et idée directrice/),
      'Distinguer les faits confirmés, les annonces attribuées et les conséquences encore incertaines.',
    );
    await user.type(
      screen.getByLabelText(/^Plan, progression et éléments obligatoires/),
      'Contexte, faits confirmés, points encore incertains, conséquences possibles puis liste de contrôle.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('Distingue la date de publication de la date réelle des événements');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('N’invente aucun fait, chiffre, date, citation, source');
    expect(screen.getByText(/formulaire Articles et contenus éditoriaux/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Média, rubrique et ligne éditoriale/),
      'Rubrique de veille professionnelle, ton factuel et lecture majoritairement réalisée sur téléphone.',
    );
    await user.type(
      screen.getByLabelText(/^Sources, citations et informations incertaines/),
      'Prioriser les sources officielles, attribuer chaque déclaration et signaler les informations non confirmées.',
    );
    await user.type(
      screen.getByLabelText(/^Période couverte, dates et actualisation/),
      'Dater chaque annonce, chaque événement et chaque consultation, puis indiquer la date de dernière vérification.',
    );
    await user.type(
      screen.getByLabelText(/^Intentions de recherche et contraintes SEO/),
      'Répondre clairement à la question principale sans répéter artificiellement les mots-clés.',
    );
    await user.type(
      screen.getByLabelText(/^Liens internes, externes et ancres/),
      'Lien interne vers la ressource associée et liens externes uniquement vers les sources primaires.',
    );
    await user.type(
      screen.getByLabelText(/^Relecture et validation avant publication/),
      'Contrôle des faits, dates, liens et formulations incertaines par le responsable éditorial.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });

  it('construit et améliore un prompt d’analyse et de synthèse', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'analysis-synthesis');

    expect(categorySelector).toHaveValue('analysis-synthesis');
    expect(screen.getByText('Examiner des informations et produire une synthèse vérifiable.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Analyser' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Type d’analyse/)).toHaveValue('analyse thématique structurée');

    await user.type(
      screen.getByLabelText(/^Sujet et contexte de l’analyse/),
      'Comparer plusieurs retours anonymisés sur l’utilisation d’une procédure fictive.',
    );
    await user.type(
      screen.getByLabelText(/^Destinataire de la synthèse/),
      'responsables pédagogiques connaissant le processus mais pas les retours détaillés',
    );
    await user.type(
      screen.getByLabelText(/^Question principale à traiter/),
      'Quelles difficultés reviennent le plus souvent et quels points nécessitent une clarification prioritaire ?',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Objectif d’analyse');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('Distingue explicitement les faits');
    expect(screen.getByText(/formulaire Analyse et synthèse/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Périmètre, période et limites des sources/),
      'Cinq retours anonymisés recueillis sur un mois, limités à la phase de validation.',
    );
    await user.type(
      screen.getByLabelText(/^Usage attendu de la synthèse/),
      'Prioriser les explications à revoir avant la prochaine diffusion de la procédure fictive.',
    );
    await user.type(
      screen.getByLabelText(/^Critères ou axes d’analyse/),
      'Fréquence, étape concernée, impact sur le délai et clarté de la consigne.',
    );
    await user.type(
      screen.getByLabelText(/^Incertitudes et contradictions à signaler/),
      'Signaler les cas isolés, les périodes non comparables et les causes non démontrées.',
    );
    await user.type(
      screen.getByLabelText(/^Contraintes et éléments à éviter/),
      'Aucune cause supposée et aucune recommandation sans appui dans les sources.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });

  it('construit et améliore un prompt pour une tâche bureautique', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'office-data');

    expect(categorySelector).toHaveValue('office-data');
    expect(screen.getByText('Préparer un traitement de données, un tableau ou une automatisation bureautique.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Outil et version visés/)).toHaveValue('Microsoft Excel pour Microsoft 365');

    await user.type(
      screen.getByLabelText(/^Situation et besoin bureautique/),
      'Fiabiliser un tableau de suivi fictif afin de réduire les erreurs de saisie.',
    );
    await user.type(
      screen.getByLabelText(/^Structure du document ou des données de départ/),
      'Une feuille Suivi avec les colonnes Date, Catégorie, Statut et Montant fictif.',
    );
    await user.type(
      screen.getByLabelText(/^Résultat attendu/),
      'Créer une liste contrôlée pour le statut, signaler les doublons et produire un total mensuel vérifiable.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('Microsoft Excel pour Microsoft 365');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('Travaille sur une copie');
    expect(screen.getByText(/formulaire Bureautique et données/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Critères de réussite/),
      'Aucune valeur hors liste, doublons signalés et total identique à un calcul manuel.',
    );
    await user.type(
      screen.getByLabelText(/^Règles de structure, de calcul ou de mise en forme/),
      'Conserver les colonnes existantes, ajouter les contrôles à droite et ne jamais fusionner les cellules.',
    );
    await user.type(
      screen.getByLabelText(/^Contraintes et éléments à éviter/),
      'Aucune macro, conserver le fichier source intact et utiliser uniquement des fonctions compatibles.',
    );
    await user.type(
      screen.getByLabelText(/^Méthode de vérification et cas de test/),
      'Tester une ligne valide, un doublon, une valeur vide et comparer le total à un calcul manuel.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });

  it('construit et améliore un prompt pour une présentation', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'presentation');

    expect(categorySelector).toHaveValue('presentation');
    expect(screen.getByText('Structurer un diaporama, son message, sa progression visuelle et sa prise de parole.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Transmettre' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Durée de prise de parole/)).toHaveValue('10 minutes de présentation puis questions');
    expect(screen.getByLabelText(/^Application ou outil visé/)).toHaveValue('Microsoft PowerPoint');

    await user.selectOptions(
      screen.getByLabelText(/^Qui doit réaliser la présentation/),
      'rédiger une consigne optimisée à transmettre à une application de présentation',
    );
    await user.selectOptions(screen.getByLabelText(/^Application ou outil visé/), 'Gamma');

    await user.type(
      screen.getByLabelText(/^Sujet, situation et enjeux de la présentation/),
      'Présenter les résultats anonymisés d’un projet fictif lors d’une réunion mensuelle.',
    );
    await user.type(
      screen.getByLabelText(/^Public, niveau et attentes/),
      'responsables de service connaissant le projet et attendant une recommandation claire',
    );
    await user.type(
      screen.getByLabelText(/^Message central à retenir/),
      'La simplification proposée réduit les étapes inutiles sans supprimer les contrôles essentiels.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('diapositive par diapositive');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('N’invente aucun chiffre');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('cartes ou sections courtes');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('consigne finale autonome');
    expect(screen.getByText(/formulaire Présentation/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Documents et informations disponibles/),
      'Une synthèse anonymisée, trois indicateurs validés et une chronologie vérifiée.',
    );
    await user.type(
      screen.getByLabelText(/^Résultat attendu auprès du public/),
      'Valider les deux prochaines étapes et désigner les personnes responsables de leur suivi.',
    );
    await user.type(
      screen.getByLabelText(/^Contenus et éléments obligatoires/),
      'Contexte, trois résultats validés, limites, recommandation et décision attendue.',
    );
    await user.type(
      screen.getByLabelText(/^Sources, citations et informations à ne pas inventer/),
      'Utiliser seulement les indicateurs fournis et signaler toute information manquante.',
    );
    await user.type(
      screen.getByLabelText(/^Lisibilité et accessibilité/),
      'Contraste renforcé, texte court et aucune information portée uniquement par la couleur.',
    );
    await user.type(
      screen.getByLabelText(/^Contrôles avant présentation/),
      'Contrôler chaque source et effectuer une répétition chronométrée avant la réunion.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });

  it('construit et améliore un prompt de marketing et communication', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'marketing-communication');

    expect(categorySelector).toHaveValue('marketing-communication');
    expect(screen.getByText('Cadrer un contenu, une campagne ou un argumentaire crédible et adapté à son public.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Écrire' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Type de contenu marketing ou de communication/)).toHaveValue('page de présentation d’une offre ou d’un service');

    await user.type(
      screen.getByLabelText(/^Situation et contexte de communication/),
      'Présenter une nouvelle ressource professionnelle fictive sur le site FormaPrompt.',
    );
    await user.type(
      screen.getByLabelText(/^Offre, service, ressource ou sujet à présenter/),
      'Un guide pratique gratuit proposant une méthode en quatre étapes et des exemples fictifs.',
    );
    await user.type(
      screen.getByLabelText(/^Public visé, besoins et freins/),
      'responsables pédagogiques connaissant leur besoin mais disposant de peu de temps',
    );
    await user.type(
      screen.getByLabelText(/^Message central à retenir/),
      'Cette ressource aide à préciser une demande professionnelle avant de transmettre la consigne.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('N’invente aucun chiffre');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('pression artificielle');
    expect(screen.getByText(/formulaire Marketing et communication/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Action ou résultat attendu auprès du public/),
      'Consulter la page détaillée puis décider librement si la ressource répond au besoin.',
    );
    await user.type(
      screen.getByLabelText(/^Proposition de valeur et bénéfice concret/),
      'Une méthode courte et réutilisable qui aide à repérer les imprécisions avant utilisation.',
    );
    await user.type(
      screen.getByLabelText(/^Preuves et informations vérifiables disponibles/),
      'Contenu validé, accès gratuit confirmé et exemples fictifs relus ; aucun témoignage disponible.',
    );
    await user.type(
      screen.getByLabelText(/^Règles de marque, vocabulaire et identité/),
      'Ton pédagogique, vouvoiement, phrases courtes et aucune promesse excessive.',
    );
    await user.type(
      screen.getByLabelText(/^Contraintes éthiques, réglementaires et mentions obligatoires/),
      'Aucune fausse urgence et consentement requis pour tout envoi de courriel.',
    );
    await user.type(
      screen.getByLabelText(/^Indicateurs de réussite/),
      'Compréhension du message lors d’une relecture test.',
    );
    await user.type(
      screen.getByLabelText(/^Contraintes éditoriales et éléments à éviter/),
      'Six cents mots maximum, aucune comparaison non sourcée et aucun superlatif.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });

  it('construit et améliore un prompt de recherche traçable', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'research');

    expect(categorySelector).toHaveValue('research');
    expect(screen.getByText('Cadrer une recherche documentaire, vérifier les sources et produire une restitution traçable.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Analyser' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Type de recherche/)).toHaveValue('recherche documentaire générale');

    await user.type(
      screen.getByLabelText(/^Sujet et contexte de la recherche/),
      'Actualiser un support pédagogique fictif à partir d’informations publiques récentes.',
    );
    await user.type(
      screen.getByLabelText(/^Destinataire de la recherche/),
      'formateurs généralistes connaissant le sujet mais pas ses évolutions récentes',
    );
    await user.type(
      screen.getByLabelText(/^Question principale de recherche/),
      'Quelles évolutions vérifiées depuis 2024 modifient cette pratique et quels points restent incertains ?',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Objectif de recherche');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('N’invente aucune source');
    expect(screen.getByText(/formulaire Recherche/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Informations déjà connues ou restant à vérifier/),
      'Une recommandation générale est connue, mais sa date et son périmètre doivent être confirmés.',
    );
    await user.type(
      screen.getByLabelText(/^Usage attendu des résultats/),
      'Décider quels passages du support fictif doivent être actualisés.',
    );
    await user.type(screen.getByLabelText(/^Périmètre géographique/), 'France et Union européenne.');
    await user.type(screen.getByLabelText(/^Période et actualité attendue/), 'Publications depuis janvier 2024.');
    await user.type(
      screen.getByLabelText(/^Exigences et exclusions relatives aux sources/),
      'Auteur et date identifiables, document primaire recherché et aucune source anonyme utilisée seule.',
    );
    await user.type(
      screen.getByLabelText(/^Stratégie, sous-questions et mots-clés/),
      'Rechercher la définition officielle, la chronologie, les acteurs concernés et les exceptions.',
    );
    await user.type(
      screen.getByLabelText(/^Contradictions, lacunes et incertitudes/),
      'Comparer les dates et périmètres des sources divergentes et isoler les points impossibles à trancher.',
    );
    await user.type(
      screen.getByLabelText(/^Contraintes et éléments à éviter/),
      'Moins de 1 200 mots et aucune affirmation sans référence vérifiable.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });

  it('construit et améliore un prompt de productivité contrôlé', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'productivity');

    expect(categorySelector).toHaveValue('productivity');
    expect(screen.getByText('Organiser une tâche, simplifier un processus et définir des contrôles humains.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Construire' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Type de besoin de productivité/)).toHaveValue('organisation et priorisation d’une charge de travail');

    await user.type(
      screen.getByLabelText(/^Situation de travail et difficulté rencontrée/),
      'Une petite équipe fictive prépare plusieurs livrables, mais les priorités changent trop tard.',
    );
    await user.type(
      screen.getByLabelText(/^Personnes concernées et niveau d’autonomie/),
      'trois personnes polyvalentes dont une valide les priorités',
    );
    await user.type(
      screen.getByLabelText(/^Amélioration principale recherchée/),
      'Construire une méthode hebdomadaire qui clarifie les priorités et rend les blocages visibles.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('N’affirme jamais avoir exécuté une action');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('validations humaines');
    expect(screen.getByText(/formulaire Productivité/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Méthode actuelle, points utiles et irritants/),
      'Les demandes arrivent par plusieurs canaux et les priorités sont confirmées tardivement sans revue intermédiaire.',
    );
    await user.type(
      screen.getByLabelText(/^Résultat observable attendu/),
      'Chaque personne connaît ses trois priorités, leur échéance et le point de validation prévu.',
    );
    await user.type(
      screen.getByLabelText(/^Fréquence, volume et variations de charge/),
      'Revue chaque lundi avec quinze tâches actives.',
    );
    await user.type(
      screen.getByLabelText(/^Informations d’entrée et ressources nécessaires/),
      'Liste des demandes, échéances confirmées, charge disponible et critères d’urgence.',
    );
    await user.type(
      screen.getByLabelText(/^Outils et environnement disponibles/),
      'Agenda partagé et tableau de tâches existant ; aucun nouvel outil payant.',
    );
    await user.type(
      screen.getByLabelText(/^Échéances, priorités et règles d’arbitrage/),
      'Engagements datés avant les améliorations internes ; arbitrage par le responsable.',
    );
    await user.type(
      screen.getByLabelText(/^Étapes, dépendances et responsabilités à préserver/),
      'Vérifier, prioriser, affecter un responsable, réaliser, relire puis valider avant diffusion.',
    );
    await user.type(
      screen.getByLabelText(/^Critères de réussite et indicateurs utiles/),
      'Priorités validées avant mardi et aucune tâche sans responsable.',
    );
    await user.type(
      screen.getByLabelText(/^Validations et contrôles humains obligatoires/),
      'Le responsable valide les priorités et toute communication externe avant envoi.',
    );
    await user.type(
      screen.getByLabelText(/^Risques, contraintes et actions interdites/),
      'Aucune suppression, dépense ou communication externe sans confirmation humaine.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });

  it('construit et améliore un prompt de code testable', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'code');

    expect(categorySelector).toHaveValue('code');
    expect(screen.getByText('Cadrer une création, une correction ou une revue de code avec des tests explicites.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Construire' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Type de besoin technique/)).toHaveValue('création d’une fonctionnalité ciblée');

    await user.type(
      screen.getByLabelText(/^Contexte technique et problème rencontré/),
      'Dans une application fictive, un formulaire perd les valeurs lorsqu’une validation échoue.',
    );
    await user.type(
      screen.getByLabelText(/^Utilisateurs concernés et situation d’usage/),
      'adultes débutants utilisant le formulaire sur téléphone et ordinateur',
    );
    await user.type(
      screen.getByLabelText(/^Comportement technique attendu/),
      'Conserver les valeurs saisies, afficher l’erreur concernée et placer le focus sur la première erreur.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('N’invente pas d’API');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('N’affirme jamais avoir modifié un fichier');
    expect(screen.getByText(/formulaire Code/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Projet existant et comportements à préserver/),
      'Application React et Vite existante, validations Zod et styles partagés à réutiliser sans modifier le service de données.',
    );
    await user.type(
      screen.getByLabelText(/^Résultat observable et condition de réussite/),
      'Après une erreur, les valeurs restent visibles, le message est annoncé et aucun envoi n’est déclenché.',
    );
    const technologyStack = screen.getByLabelText(/^Langage, framework et versions/);
    await user.clear(technologyStack);
    await user.type(technologyStack, 'TypeScript strict, React 19, Vite 5, React Hook Form et Zod.');
    await user.type(
      screen.getByLabelText(/^Environnement d’exécution et plateformes visées/),
      'Navigateurs récents sur téléphone et ordinateur Windows.',
    );
    await user.type(
      screen.getByLabelText(/^Entrées, sorties et formats de données/),
      'Objet fictif avec champs texte ; sortie contenant statut, erreurs et valeurs normalisées.',
    );
    await user.type(
      screen.getByLabelText(/^Règles fonctionnelles et cas limites/),
      'Conserver les champs valides, refuser une chaîne vide et ne jamais envoyer si une erreur subsiste.',
    );
    await user.type(
      screen.getByLabelText(/^Qualité, performance, accessibilité et maintenabilité/),
      'TypeScript strict, navigation clavier, messages annoncés et fonctions courtes.',
    );
    await user.type(
      screen.getByLabelText(/^Contraintes et dépendances autorisées/),
      'Réutiliser Zod et React Hook Form, sans nouvelle dépendance ni modification du service.',
    );
    await user.type(
      screen.getByLabelText(/^Tests et commandes de validation/),
      'Test unitaire de validation, test du focus sur erreur et parcours clavier.',
    );
    await user.type(
      screen.getByLabelText(/^Sécurité et protection des données/),
      'Aucune clé dans le navigateur, données fictives et validation des entrées.',
    );
    await user.type(
      screen.getByLabelText(/^Erreurs, états vides et solutions de repli/),
      'Message sous le champ invalide, conservation de la saisie et possibilité de réessayer.',
    );
    await user.click(screen.getByRole('button', { name: 'Recalculer le score et le prompt' }));

    const improvedScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);
    expect(improvedScore).toBeGreaterThan(initialScore);
  });

  it('construit et améliore un storyboard vidéo accessible et vérifiable', async () => {
    const user = userEvent.setup();
    renderStudio();

    const categorySelector = screen.getByRole('combobox', { name: 'Cas d’usage' });
    await user.selectOptions(categorySelector, 'video');

    expect(categorySelector).toHaveValue('video');
    expect(screen.getByText('Structurer un scénario, un storyboard ou un brief vidéo adapté au public, au format et à l’outil.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Créer' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Durée cible/)).toHaveValue('entre 1 et 3 minutes');
    expect(screen.getByLabelText(/^Format et ratio/)).toHaveValue('horizontal 16:9 pour écran et plateforme vidéo');

    await user.type(
      screen.getByLabelText(/^Sujet, situation et usage prévu de la vidéo/),
      'Courte vidéo intégrée à une formation pour expliquer comment vérifier une source avant de la citer.',
    );
    await user.type(
      screen.getByLabelText(/^Public, niveau et contexte de visionnage/),
      'adultes débutants regardant la vidéo sur téléphone dans leur espace apprenant',
    );
    await user.type(
      screen.getByLabelText(/^Objectif de la vidéo et effet attendu/),
      'Permettre au public d’appliquer une vérification simple en trois étapes avant de partager une information.',
    );
    await user.type(
      screen.getByLabelText(/^Message essentiel à retenir/),
      'Une source doit être identifiée, datée et recoupée avant d’être présentée comme fiable.',
    );
    await user.type(
      screen.getByLabelText(/^Progression narrative et rythme/),
      'Question concrète, erreur fréquente, méthode en trois étapes puis rappel final.',
    );

    await user.click(screen.getByRole('button', { name: 'Construire mon prompt' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toHaveFocus();
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('## Adaptation à la production et à l’outil');
    expect(screen.getByLabelText('Prompt final à copier')).toHaveTextContent('N’affirme jamais avoir tourné, monté, créé');
    expect(screen.getByText(/formulaire Vidéo/)).toBeInTheDocument();
    const initialScore = Number(screen.getByLabelText(/Score de qualité :/).querySelector('strong')?.textContent);

    await user.type(
      screen.getByLabelText(/^Informations, documents et médias disponibles/),
      'Procédure validée, captures fictives, charte autorisée et liste des sources officielles à citer.',
    );
    await user.type(
      screen.getByLabelText(/^Scènes, plans, actions et transitions/),
      'Plan d’ensemble, gros plan sur trois indices fictifs puis écran final récapitulatif.',
    );
    await user.type(
      screen.getByLabelText(/^Narration, dialogues et textes à l’écran/),
      'Voix posée, phrases courtes et trois mots-clés affichés successivement.',
    );
    await user.type(
      screen.getByLabelText(/^Direction visuelle, cadrages et mouvements/),
      'Style pédagogique sobre, plans stables, contraste élevé et aucun effet décoratif rapide.',
    );
    await user.type(
      screen.getByLabelText(/^Voix, musique, bruitages et silences/),
      'Voix claire, musique discrète autorisée et silences entre les étapes.',
    );
    await user.type(
      screen.getByLabelText(/^Contrôles humains avant diffusion/),
      'Validation du script, test sans le son sur téléphone et contrôle des faits et des droits.',
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
