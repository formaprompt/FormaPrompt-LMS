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
      name: 'Construisez un prompt clair pour votre courriel professionnel',
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

  test('respecte les contrôles WCAG automatisables', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Construisez un prompt clair pour votre courriel professionnel',
    })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
