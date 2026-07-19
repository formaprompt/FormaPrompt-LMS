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

    await page.getByLabel('Cas d’usage').selectOption('image-creation');
    await expect(page.getByLabel('Sujet principal')).toBeVisible();

    const imageCreationResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(imageCreationResults.violations).toEqual([]);
  });
});
