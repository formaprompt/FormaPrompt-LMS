import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function acceptCookieNotice(page: import('@playwright/test').Page) {
  const acceptButton = page.getByRole('button', { name: "J'accepte" });
  if (await acceptButton.isVisible()) await acceptButton.click();
}

test.describe('FormaPrompt Studio', () => {
  test('parcours clavier, diagnostic, amélioration et copie', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Construisez un prompt clair pour vos usages professionnels',
    })).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Passer au contenu principal' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    await acceptCookieNotice(page);

    await page.getByLabel('Décrivez votre besoin').fill(
      'Préparer un rappel avant une classe virtuelle fictive organisée la semaine prochaine.',
    );
    await page.getByLabel('À qui s’adresse le courriel ?').fill(
      'participants adultes inscrits à distance',
    );
    await page.getByLabel('Objectif du courriel').fill(
      'Rappeler les modalités pratiques et demander une confirmation de présence.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(initialScore).toBeGreaterThan(0);
    await expect(page.getByLabel('Prompt final à copier')).toContainText('## Contexte');

    await page.getByLabel('Informations utiles et autorisées').fill(
      'La séance fictive débute à 9 h et le lien est disponible dans la convocation générique.',
    );
    await page.getByLabel('Critères de réussite').fill(
      'Le message reste inférieur à 180 mots et la demande de confirmation est explicite.',
    );
    await page.getByLabel('Éléments obligatoires').fill(
      'Objet, date fictive, heure, matériel conseillé et confirmation attendue.',
    );
    await page.getByLabel('Contraintes et éléments à éviter').fill(
      'Phrases courtes, aucun jargon, aucune donnée personnelle et aucune information inventée.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    await page.getByRole('button', { name: 'Copier le prompt' }).click();
    await expect(page.getByText('Le prompt a été copié dans le presse-papiers.')).toBeVisible();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('## Précisions');

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Formation et produit un prompt pédagogique structuré', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('training');
    await expect(page.getByText('Concevoir une activité, une séquence ou une ressource pédagogique.')).toBeVisible();
    await expect(page.getByLabel('Décrivez le besoin de formation')).toBeVisible();
    await expect(page.getByLabel('Décrivez votre besoin')).toHaveCount(0);

    await page.getByLabel('Décrivez le besoin de formation').fill(
      'Préparer une séquence permettant de construire et de fiabiliser un tableau de suivi partagé.',
    );
    await page.getByLabel('Quel est le public visé ?').fill(
      'adultes débutants travaillant dans un service administratif',
    );
    await page.getByLabel('Objectif pédagogique').fill(
      'À l’issue de la séquence, les participants sauront construire et contrôler un tableau de suivi simple.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('## Objectif pédagogique');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Acquis, prérequis ou difficultés de départ').fill(
      'Les participants savent saisir des données mais connaissent peu les formules et les contrôles.',
    );
    await page.getByLabel('Critères de réussite ou modalités d’évaluation').fill(
      'Le tableau respecte le modèle, les calculs sont exacts et les contrôles sont expliqués.',
    );
    await page.getByLabel('Étapes et éléments obligatoires').fill(
      'Démonstration, exercice guidé, activité autonome, correction et synthèse.',
    );
    await page.getByLabel('Contraintes et adaptations nécessaires').fill(
      'Consignes courtes, navigation au clavier, données fictives et aucun outil payant.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Réseaux sociaux et produit un prompt éditorial structuré', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('social-media');
    await expect(page.getByText('Préparer une publication adaptée à une plateforme, un public et un objectif.')).toBeVisible();
    await expect(page.getByLabel('Plateforme principale')).toHaveValue('LinkedIn');

    await page.getByLabel('Décrivez le sujet et son contexte').fill(
      'Présenter une ressource gratuite consacrée à la rédaction de consignes professionnelles claires.',
    );
    await page.getByLabel('À quel public s’adresse la publication ?').fill(
      'responsables pédagogiques et formateurs indépendants débutants',
    );
    await page.getByLabel('Objectif de la publication').fill(
      'Expliquer l’utilité de la méthode et inviter les lecteurs à consulter la ressource.',
    );
    await page.getByLabel('Message essentiel à retenir').fill(
      'Une consigne structurée réduit les ambiguïtés et facilite la vérification du résultat.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('Plateforme : LinkedIn');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Critères de réussite éditoriaux').fill(
      'Le sujet est compris immédiatement, le bénéfice est concret et l’action finale est explicite.',
    );
    await page.getByLabel('Action proposée au public').fill(
      'Consulter le guide puis tester la méthode sur une demande professionnelle.',
    );
    await page.getByLabel('Éléments obligatoires').fill(
      'Nom de la ressource, gratuité, méthode CROP et emplacement du lien.',
    );
    await page.getByLabel('Contraintes et éléments à éviter').fill(
      'Moins de 1 200 caractères, aucun chiffre inventé et trois mots-dièse maximum.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Documents professionnels et produit un document structuré', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('professional-documents');
    await expect(page.getByText(/Préparer un rapport, un compte rendu, une procédure/)).toBeVisible();
    await expect(page.getByLabel('Type de document')).toHaveValue('rapport professionnel');

    await page.getByLabel('Sujet et contexte du document').fill(
      'Formaliser un processus fictif de validation interne utilisé par plusieurs services.',
    );
    await page.getByLabel('Lecteur ou destinataire du document').fill(
      'responsables de service découvrant le nouveau processus interne',
    );
    await page.getByLabel('Objectif du document').fill(
      'Expliquer chaque étape afin que les responsables puissent appliquer le processus sans ambiguïté.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('Type de document : rapport professionnel');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Informations sources autorisées').fill(
      'Le processus comprend trois validations, une réponse sous deux jours ouvrés et un suivi dans un tableau fictif.',
    );
    await page.getByLabel('Résultat ou action attendue après lecture').fill(
      'Chaque responsable identifie son intervention, son délai et le contrôle à réaliser.',
    );
    await page.getByLabel('Sections et informations obligatoires').fill(
      'Objectif, périmètre, responsabilités, étapes, délais et points de contrôle.',
    );
    await page.getByLabel('Contraintes et éléments à éviter').fill(
      'Phrases courtes, aucun jargon non expliqué et aucune information inventée.',
    );
    await page.getByLabel('Critères de vérification avant utilisation').fill(
      'Toutes les étapes sont présentes et chaque délai correspond aux informations fournies.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Articles et contenus éditoriaux et produit un article sourcé', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('editorial-content');
    await expect(page.getByText('Préparer un article de blog, technique, d’actualité ou de fond avec un angle et des sources explicites.')).toBeVisible();
    await page.getByLabel('Type d’article ou de contenu').selectOption('article d’actualité ou de veille');

    await page.getByLabel('Sujet, contexte et besoin éditorial').fill(
      'Article de veille consacré à une évolution technique récente susceptible de modifier les pratiques professionnelles.',
    );
    await page.getByLabel('Lectorat, niveau et attentes').fill(
      'Responsables de petites structures, non spécialistes et lecteurs sur téléphone.',
    );
    await page.getByLabel('Objectif éditorial et valeur apportée au lecteur').fill(
      'Permettre au lecteur de comprendre ce qui est confirmé et les vérifications à effectuer avant toute décision.',
    );
    await page.getByLabel('Angle éditorial et idée directrice').fill(
      'Distinguer les faits confirmés, les annonces attribuées et les conséquences encore incertaines.',
    );
    await page.getByLabel('Plan, progression et éléments obligatoires').fill(
      'Contexte, faits confirmés, points encore incertains, conséquences possibles puis liste de contrôle.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('Distingue la date de publication de la date réelle des événements');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('N’invente aucun fait, chiffre, date, citation, source');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Média, rubrique et ligne éditoriale').fill(
      'Rubrique de veille professionnelle, ton factuel et lecture majoritairement réalisée sur téléphone.',
    );
    await page.getByLabel('Sources, citations et informations incertaines').fill(
      'Prioriser les sources officielles, attribuer chaque déclaration et signaler les informations non confirmées.',
    );
    await page.getByLabel('Période couverte, dates et actualisation').fill(
      'Dater chaque annonce, chaque événement et chaque consultation, puis indiquer la date de dernière vérification.',
    );
    await page.getByLabel('Intentions de recherche et contraintes SEO').fill(
      'Répondre clairement à la question principale sans répéter artificiellement les mots-clés.',
    );
    await page.getByLabel('Liens internes, externes et ancres').fill(
      'Lien interne vers la ressource associée et liens externes uniquement vers les sources primaires.',
    );
    await page.getByLabel('Relecture et validation avant publication').fill(
      'Contrôle des faits, dates, liens et formulations incertaines par le responsable éditorial.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Analyse et synthèse et produit une restitution traçable', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('analysis-synthesis');
    await expect(page.getByText('Examiner des informations et produire une synthèse vérifiable.')).toBeVisible();
    await expect(page.getByLabel('Type d’analyse')).toHaveValue('analyse thématique structurée');

    await page.getByLabel('Sujet et contexte de l’analyse').fill(
      'Comparer plusieurs retours anonymisés sur l’utilisation d’une procédure fictive.',
    );
    await page.getByLabel('Destinataire de la synthèse').fill(
      'responsables pédagogiques connaissant le processus mais pas les retours détaillés',
    );
    await page.getByLabel('Question principale à traiter').fill(
      'Quelles difficultés reviennent le plus souvent et quels points nécessitent une clarification prioritaire ?',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('## Objectif d’analyse');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('Distingue explicitement les faits');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Périmètre, période et limites des sources').fill(
      'Cinq retours anonymisés recueillis sur un mois, limités à la phase de validation.',
    );
    await page.getByLabel('Usage attendu de la synthèse').fill(
      'Prioriser les explications à revoir avant la prochaine diffusion de la procédure fictive.',
    );
    await page.getByLabel('Critères ou axes d’analyse').fill(
      'Fréquence, étape concernée, impact sur le délai et clarté de la consigne.',
    );
    await page.getByLabel('Incertitudes et contradictions à signaler').fill(
      'Signaler les cas isolés, les périodes non comparables et les causes non démontrées.',
    );
    await page.getByLabel('Contraintes et éléments à éviter').fill(
      'Aucune cause supposée et aucune recommandation sans appui dans les sources.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Bureautique et données et produit une procédure vérifiable', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('office-data');
    await expect(page.getByText('Préparer un traitement de données, un tableau ou une automatisation bureautique.')).toBeVisible();
    await expect(page.getByLabel('Outil et version visés')).toHaveValue('Microsoft Excel pour Microsoft 365');

    await page.getByLabel('Situation et besoin bureautique').fill(
      'Fiabiliser un tableau de suivi fictif afin de réduire les erreurs de saisie.',
    );
    await page.getByLabel('Structure du document ou des données de départ').fill(
      'Une feuille Suivi avec les colonnes Date, Catégorie, Statut et Montant fictif.',
    );
    await page.getByLabel('Résultat attendu').fill(
      'Créer une liste contrôlée pour le statut, signaler les doublons et produire un total mensuel vérifiable.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('Microsoft Excel pour Microsoft 365');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('Travaille sur une copie');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Critères de réussite').fill(
      'Aucune valeur hors liste, doublons signalés et total identique à un calcul manuel.',
    );
    await page.getByLabel('Règles de structure, de calcul ou de mise en forme').fill(
      'Conserver les colonnes existantes, ajouter les contrôles à droite et ne jamais fusionner les cellules.',
    );
    await page.getByLabel('Contraintes et éléments à éviter').fill(
      'Aucune macro, conserver le fichier source intact et utiliser uniquement des fonctions compatibles.',
    );
    await page.getByLabel('Méthode de vérification et cas de test').fill(
      'Tester une ligne valide, un doublon, une valeur vide et comparer le total à un calcul manuel.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Présentation et produit un plan de diaporama vérifiable', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('presentation');
    await expect(page.getByText('Structurer un diaporama, son message, sa progression visuelle et sa prise de parole.')).toBeVisible();
    await expect(page.getByLabel('Durée de prise de parole')).toHaveValue('10 minutes de présentation puis questions');
    await expect(page.getByLabel('Application ou outil visé')).toHaveValue('Microsoft PowerPoint');

    await page.getByLabel('Qui doit réaliser la présentation ?').selectOption(
      'créer directement une présentation ou un fichier éditable si cette capacité est disponible',
    );
    await page.getByLabel('Application ou outil visé').selectOption('Prezi');

    await page.getByLabel('Sujet, situation et enjeux de la présentation').fill(
      'Présenter les résultats anonymisés d’un projet fictif lors d’une réunion mensuelle.',
    );
    await page.getByLabel('Public, niveau et attentes').fill(
      'Responsables de service connaissant le projet et attendant une recommandation claire.',
    );
    await page.getByLabel('Message central à retenir').fill(
      'La simplification proposée réduit les étapes inutiles sans supprimer les contrôles essentiels.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('diapositive par diapositive');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('N’invente aucun chiffre');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('zones du canevas');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('indique clairement cette limite');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Documents et informations disponibles').fill(
      'Une synthèse anonymisée, trois indicateurs validés et une chronologie vérifiée.',
    );
    await page.getByLabel('Résultat attendu auprès du public').fill(
      'Valider les deux prochaines étapes et désigner les personnes responsables de leur suivi.',
    );
    await page.getByLabel('Contenus et éléments obligatoires').fill(
      'Contexte, trois résultats validés, limites, recommandation et décision attendue.',
    );
    await page.getByLabel('Sources, citations et informations à ne pas inventer').fill(
      'Utiliser seulement les indicateurs fournis et signaler toute information manquante.',
    );
    await page.getByLabel('Lisibilité et accessibilité').fill(
      'Contraste renforcé, texte court et aucune information portée uniquement par la couleur.',
    );
    await page.getByLabel('Contrôles avant présentation').fill(
      'Contrôler chaque source et effectuer une répétition chronométrée avant la réunion.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Marketing et communication et produit un contenu responsable', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('marketing-communication');
    await expect(page.getByText('Cadrer un contenu, une campagne ou un argumentaire crédible et adapté à son public.')).toBeVisible();
    await expect(page.getByLabel('Type de contenu marketing ou de communication')).toHaveValue('page de présentation d’une offre ou d’un service');

    await page.getByLabel('Situation et contexte de communication').fill(
      'Présenter une nouvelle ressource professionnelle fictive sur le site FormaPrompt.',
    );
    await page.getByLabel('Offre, service, ressource ou sujet à présenter').fill(
      'Un guide pratique gratuit proposant une méthode en quatre étapes et des exemples fictifs.',
    );
    await page.getByLabel('Public visé, besoins et freins').fill(
      'Responsables pédagogiques connaissant leur besoin mais disposant de peu de temps.',
    );
    await page.getByLabel('Message central à retenir').fill(
      'Cette ressource aide à préciser une demande professionnelle avant de transmettre la consigne.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('N’invente aucun chiffre');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('pression artificielle');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Action ou résultat attendu auprès du public').fill(
      'Consulter la page détaillée puis décider librement si la ressource répond au besoin.',
    );
    await page.getByLabel('Proposition de valeur et bénéfice concret').fill(
      'Une méthode courte et réutilisable qui aide à repérer les imprécisions avant utilisation.',
    );
    await page.getByLabel('Preuves et informations vérifiables disponibles').fill(
      'Contenu validé, accès gratuit confirmé et exemples fictifs relus ; aucun témoignage disponible.',
    );
    await page.getByLabel('Règles de marque, vocabulaire et identité').fill(
      'Ton pédagogique, vouvoiement, phrases courtes et aucune promesse excessive.',
    );
    await page.getByLabel('Contraintes éthiques, réglementaires et mentions obligatoires').fill(
      'Aucune fausse urgence et consentement requis pour tout envoi de courriel.',
    );
    await page.getByLabel('Indicateurs de réussite').fill(
      'Compréhension du message lors d’une relecture test.',
    );
    await page.getByLabel('Contraintes éditoriales et éléments à éviter').fill(
      'Six cents mots maximum, aucune comparaison non sourcée et aucun superlatif.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Recherche et produit une méthode traçable', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('research');
    await expect(page.getByText('Cadrer une recherche documentaire, vérifier les sources et produire une restitution traçable.')).toBeVisible();
    await expect(page.getByLabel('Type de recherche')).toHaveValue('recherche documentaire générale');

    await page.getByLabel('Sujet et contexte de la recherche').fill(
      'Actualiser un support pédagogique fictif à partir d’informations publiques récentes.',
    );
    await page.getByLabel('Destinataire de la recherche').fill(
      'Formateurs généralistes connaissant le sujet mais pas ses évolutions récentes.',
    );
    await page.getByLabel('Question principale de recherche').fill(
      'Quelles évolutions vérifiées depuis 2024 modifient cette pratique et quels points restent incertains ?',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('## Objectif de recherche');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('N’invente aucune source');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Informations déjà connues ou restant à vérifier').fill(
      'Une recommandation générale est connue, mais sa date et son périmètre doivent être confirmés.',
    );
    await page.getByLabel('Usage attendu des résultats').fill(
      'Décider quels passages du support fictif doivent être actualisés.',
    );
    await page.getByLabel('Périmètre géographique').fill('France et Union européenne.');
    await page.getByLabel('Période et actualité attendue').fill('Publications depuis janvier 2024.');
    await page.getByLabel('Exigences et exclusions relatives aux sources').fill(
      'Auteur et date identifiables, document primaire recherché et aucune source anonyme utilisée seule.',
    );
    await page.getByLabel('Stratégie, sous-questions et mots-clés').fill(
      'Rechercher la définition officielle, la chronologie, les acteurs concernés et les exceptions.',
    );
    await page.getByLabel('Contradictions, lacunes et incertitudes').fill(
      'Comparer les dates et périmètres des sources divergentes et isoler les points impossibles à trancher.',
    );
    await page.getByLabel('Contraintes et éléments à éviter').fill(
      'Moins de 1 200 mots et aucune affirmation sans référence vérifiable.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Productivité et produit un processus contrôlé', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('productivity');
    await expect(page.getByText('Organiser une tâche, simplifier un processus et définir des contrôles humains.')).toBeVisible();
    await expect(page.getByLabel('Type de besoin de productivité')).toHaveValue('organisation et priorisation d’une charge de travail');

    await page.getByLabel('Situation de travail et difficulté rencontrée').fill(
      'Une petite équipe fictive prépare plusieurs livrables, mais les priorités changent trop tard.',
    );
    await page.getByLabel('Personnes concernées et niveau d’autonomie').fill(
      'Trois personnes polyvalentes dont une valide les priorités.',
    );
    await page.getByLabel('Amélioration principale recherchée').fill(
      'Construire une méthode hebdomadaire qui clarifie les priorités et rend les blocages visibles.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('N’affirme jamais avoir exécuté une action');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('validations humaines');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Méthode actuelle, points utiles et irritants').fill(
      'Les demandes arrivent par plusieurs canaux et les priorités sont confirmées tardivement sans revue intermédiaire.',
    );
    await page.getByLabel('Résultat observable attendu').fill(
      'Chaque personne connaît ses trois priorités, leur échéance et le point de validation prévu.',
    );
    await page.getByLabel('Fréquence, volume et variations de charge').fill(
      'Revue chaque lundi avec quinze tâches actives.',
    );
    await page.getByLabel('Informations d’entrée et ressources nécessaires').fill(
      'Liste des demandes, échéances confirmées, charge disponible et critères d’urgence.',
    );
    await page.getByLabel('Outils et environnement disponibles').fill(
      'Agenda partagé et tableau de tâches existant ; aucun nouvel outil payant.',
    );
    await page.getByLabel('Échéances, priorités et règles d’arbitrage').fill(
      'Engagements datés avant les améliorations internes ; arbitrage par le responsable.',
    );
    await page.getByLabel('Étapes, dépendances et responsabilités à préserver').fill(
      'Vérifier, prioriser, affecter un responsable, réaliser, relire puis valider avant diffusion.',
    );
    await page.getByLabel('Critères de réussite et indicateurs utiles').fill(
      'Priorités validées avant mardi et aucune tâche sans responsable.',
    );
    await page.getByLabel('Validations et contrôles humains obligatoires').fill(
      'Le responsable valide les priorités et toute communication externe avant envoi.',
    );
    await page.getByLabel('Risques, contraintes et actions interdites').fill(
      'Aucune suppression, dépense ou communication externe sans confirmation humaine.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Code et produit une consigne technique testable', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('code');
    await expect(page.getByText('Cadrer une création, une correction ou une revue de code avec des tests explicites.')).toBeVisible();
    await expect(page.getByLabel('Type de besoin technique')).toHaveValue('création d’une fonctionnalité ciblée');

    await page.getByLabel('Contexte technique et problème rencontré').fill(
      'Dans une application fictive, un formulaire perd les valeurs lorsqu’une validation échoue.',
    );
    await page.getByLabel('Utilisateurs concernés et situation d’usage').fill(
      'Adultes débutants utilisant le formulaire sur téléphone et ordinateur.',
    );
    await page.getByLabel('Comportement technique attendu').fill(
      'Conserver les valeurs saisies, afficher l’erreur concernée et placer le focus sur la première erreur.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('N’invente pas d’API');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('N’affirme jamais avoir modifié un fichier');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Projet existant et comportements à préserver').fill(
      'Application React et Vite existante, validations Zod et styles partagés à réutiliser sans modifier le service de données.',
    );
    await page.getByLabel('Résultat observable et condition de réussite').fill(
      'Après une erreur, les valeurs restent visibles, le message est annoncé et aucun envoi n’est déclenché.',
    );
    await page.getByLabel('Langage, framework et versions').fill(
      'TypeScript strict, React 19, Vite 5, React Hook Form et Zod.',
    );
    await page.getByLabel('Environnement d’exécution et plateformes visées').fill(
      'Navigateurs récents sur téléphone et ordinateur Windows.',
    );
    await page.getByLabel('Entrées, sorties et formats de données').fill(
      'Objet fictif avec champs texte ; sortie contenant statut, erreurs et valeurs normalisées.',
    );
    await page.getByLabel('Règles fonctionnelles et cas limites').fill(
      'Conserver les champs valides, refuser une chaîne vide et ne jamais envoyer si une erreur subsiste.',
    );
    await page.getByLabel('Qualité, performance, accessibilité et maintenabilité').fill(
      'TypeScript strict, navigation clavier, messages annoncés et fonctions courtes.',
    );
    await page.getByLabel('Contraintes et dépendances autorisées').fill(
      'Réutiliser Zod et React Hook Form, sans nouvelle dépendance ni modification du service.',
    );
    await page.getByLabel('Tests et commandes de validation').fill(
      'Test unitaire de validation, test du focus sur erreur et parcours clavier.',
    );
    await page.getByLabel('Sécurité et protection des données').fill(
      'Aucune clé dans le navigateur, données fictives et validation des entrées.',
    );
    await page.getByLabel('Erreurs, états vides et solutions de repli').fill(
      'Message sous le champ invalide, conservation de la saisie et possibilité de réessayer.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Vidéo et produit un storyboard accessible et vérifiable', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('video');
    await expect(page.getByText('Structurer un scénario, un storyboard ou un brief vidéo adapté au public, au format et à l’outil.')).toBeVisible();
    await expect(page.getByLabel('Durée cible')).toHaveValue('entre 1 et 3 minutes');
    await expect(page.getByLabel('Format et ratio')).toHaveValue('horizontal 16:9 pour écran et plateforme vidéo');

    await page.getByLabel('Sujet, situation et usage prévu de la vidéo').fill(
      'Courte vidéo intégrée à une formation pour expliquer comment vérifier une source avant de la citer.',
    );
    await page.getByLabel('Public, niveau et contexte de visionnage').fill(
      'Adultes débutants regardant la vidéo sur téléphone dans leur espace apprenant.',
    );
    await page.getByLabel('Objectif de la vidéo et effet attendu').fill(
      'Permettre au public d’appliquer une vérification simple en trois étapes avant de partager une information.',
    );
    await page.getByLabel('Message essentiel à retenir').fill(
      'Une source doit être identifiée, datée et recoupée avant d’être présentée comme fiable.',
    );
    await page.getByLabel('Progression narrative et rythme').fill(
      'Question concrète, erreur fréquente, méthode en trois étapes puis rappel final.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('## Adaptation à la production et à l’outil');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('N’affirme jamais avoir tourné, monté, créé');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Informations, documents et médias disponibles').fill(
      'Procédure validée, captures fictives, charte autorisée et liste des sources officielles à citer.',
    );
    await page.getByLabel('Scènes, plans, actions et transitions').fill(
      'Plan d’ensemble, gros plan sur trois indices fictifs puis écran final récapitulatif.',
    );
    await page.getByLabel('Narration, dialogues et textes à l’écran').fill(
      'Voix posée, phrases courtes et trois mots-clés affichés successivement.',
    );
    await page.getByLabel('Direction visuelle, cadrages et mouvements').fill(
      'Style pédagogique sobre, plans stables, contraste élevé et aucun effet décoratif rapide.',
    );
    await page.getByLabel('Voix, musique, bruitages et silences').fill(
      'Voix claire, musique discrète autorisée et silences entre les étapes.',
    );
    await page.getByLabel('Contrôles humains avant diffusion').fill(
      'Validation du script, test sans le son sur téléphone et contrôle des faits et des droits.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Création d’image et produit une consigne visuelle structurée', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('image-creation');
    await expect(page.getByText('Structurer une consigne visuelle adaptée à un support et un public.')).toBeVisible();
    await expect(page.getByLabel('Format et ratio')).toHaveValue('format horizontal 16:9');
    await expect(page.getByLabel('Outil visé')).toHaveValue('ChatGPT Images');

    await page.getByLabel('Sujet principal').fill(
      'Une personne adulte en reconversion utilisant un ordinateur portable.',
    );
    await page.getByLabel('Action ou posture').fill(
      'Assise face à l’écran, elle construit un tableau pendant qu’un formateur lui montre une étape.',
    );
    await page.getByLabel('Décor et environnement').fill(
      'Salle de formation lumineuse, mobilier sobre et arrière-plan ordonné.',
    );
    await page.getByLabel('À quel public l’image est-elle destinée ?').fill(
      'adultes débutants en reconversion découvrant les outils bureautiques',
    );
    await page.getByLabel('Objectif visuel').fill(
      'Transmettre une impression de progression accessible et d’accompagnement bienveillant.',
    );
    await page.getByLabel('Lumière').fill('Lumière naturelle douce venant de la gauche.');
    await page.getByLabel('Ambiance').fill('Ambiance rassurante, studieuse et positive.');
    await page.getByLabel('Couleurs et contrastes').fill('Verts et bleus sobres sur un fond clair.');
    await page.getByLabel('Éléments à éviter et contraintes').fill(
      'Aucun logo, aucun texte intégré et aucun visage identifiable.',
    );
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('## Objectif visuel');
    const initialScore = Number(await page.locator('.studio-score-value strong').innerText());

    await page.getByLabel('Critères de réussite visuels').fill(
      'Le sujet est compris immédiatement, le décor reste discret et les contrastes sont suffisants.',
    );
    await page.getByLabel('Éléments obligatoires dans l’image').fill(
      'Ordinateur portable, interaction bienveillante et espace libre dans le tiers supérieur.',
    );
    await page.getByRole('button', { name: 'Recalculer le score et le prompt' }).click();

    const improvedScore = Number(await page.locator('.studio-score-value strong').innerText());
    expect(improvedScore).toBeGreaterThan(initialScore);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);
  });

  test('sélectionne Audio et produit un script accessible avec contrôle des droits', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('audio');
    await expect(page.getByText('Structurer un podcast, une voix off, une interview ou un contenu sonore accessible et vérifiable.')).toBeVisible();
    await expect(page.getByLabel('Durée cible')).toHaveValue('entre 3 et 10 minutes');

    await page.getByLabel('Sujet, situation et usage prévu du contenu audio').fill('Capsule intégrée à une formation pour expliquer comment vérifier une source avant de la citer.');
    await page.getByLabel('Public et conditions d’écoute').fill('Adultes débutants écoutant la capsule sur téléphone depuis leur espace apprenant.');
    await page.getByLabel('Objectif auprès du public').fill('Permettre au public d’appliquer une vérification simple en trois étapes après l’écoute.');
    await page.getByLabel('Message essentiel à retenir').fill('Une source doit être identifiée, datée et recoupée avant d’être présentée comme fiable.');
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('## Règles de préparation');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('ne clones jamais la voix');
    await expect(page.getByText(/Le Studio n’enregistre, ne synthétise, ne monte et ne publie aucun fichier audio/)).toBeVisible();
  });

  test('sélectionne Agent IA et produit une spécification avec contrôles humains', async ({ page }) => {
    await page.goto('/studio');
    await acceptCookieNotice(page);

    await page.getByLabel('Cas d’usage').selectOption('ai-agent');
    await expect(page.getByText('Cadrer la mission, l’autonomie, les outils, les données et les contrôles humains d’un futur agent.')).toBeVisible();
    await expect(page.getByLabel('Niveau d’autonomie maximal')).toHaveValue('proposer uniquement, sans exécuter d’action externe');

    await page.getByLabel('Situation, besoin et problème à résoudre').fill('Une équipe prépare des réponses à partir d’une base documentaire validée et souhaite mieux tracer les contrôles humains.');
    await page.getByLabel('Utilisateurs et personnes responsables').fill('Une équipe support débutante supervisée par un responsable de service.');
    await page.getByLabel('Mission précise et limitée').fill('Préparer un brouillon sourcé sans envoyer de message, modifier un document ni décider à la place du responsable.');
    await page.getByRole('button', { name: 'Construire mon prompt' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Votre prompt structuré' })).toBeFocused();
    await expect(page.getByLabel('Prompt final à copier')).toContainText('## Garde-fous obligatoires');
    await expect(page.getByLabel('Prompt final à copier')).toContainText('Tu n’exécutes aucune action');
    await expect(page.getByText(/Le Studio ne vérifie aucun accès/)).toBeVisible();
  });

  test('respecte les contrôles WCAG automatisables', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Construisez un prompt clair pour vos usages professionnels',
    })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('training');
    await expect(page.getByLabel('Décrivez le besoin de formation')).toBeVisible();

    const trainingResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(trainingResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('social-media');
    await expect(page.getByLabel('Décrivez le sujet et son contexte')).toBeVisible();

    const socialMediaResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(socialMediaResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('professional-documents');
    await expect(page.getByLabel('Sujet et contexte du document')).toBeVisible();

    const professionalDocumentsResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(professionalDocumentsResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('editorial-content');
    await expect(page.getByLabel('Sujet, contexte et besoin éditorial')).toBeVisible();

    const editorialContentResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(editorialContentResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('analysis-synthesis');
    await expect(page.getByLabel('Sujet et contexte de l’analyse')).toBeVisible();

    const analysisSynthesisResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(analysisSynthesisResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('office-data');
    await expect(page.getByLabel('Situation et besoin bureautique')).toBeVisible();

    const officeDataResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(officeDataResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('presentation');
    await expect(page.getByLabel('Sujet, situation et enjeux de la présentation')).toBeVisible();

    const presentationResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(presentationResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('marketing-communication');
    await expect(page.getByLabel('Situation et contexte de communication')).toBeVisible();

    const marketingCommunicationResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(marketingCommunicationResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('research');
    await expect(page.getByLabel('Sujet et contexte de la recherche')).toBeVisible();

    const researchResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(researchResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('productivity');
    await expect(page.getByLabel('Situation de travail et difficulté rencontrée')).toBeVisible();

    const productivityResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(productivityResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('code');
    await expect(page.getByLabel('Contexte technique et problème rencontré')).toBeVisible();

    const codeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(codeResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('video');
    await expect(page.getByLabel('Sujet, situation et usage prévu de la vidéo')).toBeVisible();

    const videoResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(videoResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('image-creation');
    await expect(page.getByLabel('Sujet principal')).toBeVisible();

    const imageCreationResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(imageCreationResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('audio');
    await expect(page.getByLabel('Sujet, situation et usage prévu du contenu audio')).toBeVisible();

    const audioResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(audioResults.violations).toEqual([]);

    await page.getByLabel('Cas d’usage').selectOption('ai-agent');
    await expect(page.getByLabel('Situation, besoin et problème à résoudre')).toBeVisible();

    const aiAgentResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(aiAgentResults.violations).toEqual([]);
  });
});
