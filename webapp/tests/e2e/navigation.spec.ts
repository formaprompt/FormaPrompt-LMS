import { expect, test, type Page } from '@playwright/test';

async function acceptCookies(page: Page) {
  const button = page.getByRole('button', { name: "J'accepte" });
  if (await button.isVisible()) await button.click();
}

async function openMainMenuOnMobile(page: Page, projectName: string) {
  if (projectName !== 'mobile') return;
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
}

async function revealResourcesOnDesktop(page: Page, projectName: string) {
  if (projectName === 'mobile') return;
  await page.locator('#primary-navigation').getByText('Ressources', { exact: true }).hover();
}

test.describe('Navigation au premier clic', () => {
  test('protège une URL profonde du parcours apprenant', async ({ page }) => {
    await page.goto('/parcours/introduction-prompt-engineering/definir-un-role');

    await expect(page).toHaveURL(/\/login\?redirect=/);
    await expect(page.getByRole('heading', { level: 1, name: 'Bon retour !' })).toBeVisible();
  });

  test('enchaîne les pages publiques, le retour navigateur et une URL profonde', async ({ page }, testInfo) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/');
    await acceptCookies(page);

    await page.getByRole('link', { name: 'Essayer gratuitement le Studio' }).click();
    await expect(page).toHaveURL(/\/studio\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: /Construisez un prompt clair/i })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: /Formations en IA/i })).toBeVisible();

    await page.getByRole('link', { name: 'Découvrir la formation 10 h' }).click();
    await expect(page).toHaveURL(/\/formation-ia-generative$/);
    await expect(page.getByRole('heading', { level: 1, name: /IA générative/i })).toBeVisible();

    await openMainMenuOnMobile(page, testInfo.project.name);
    await revealResourcesOnDesktop(page, testInfo.project.name);
    await page.getByRole('link', { name: 'Blog', exact: true }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Le Blog FormaPrompt' })).toBeVisible();

    await page.goto('/formation-prompt-engineering');
    await expect(page.getByRole('heading', { level: 1, name: /Prompt Engineering/i })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('ferme le menu mobile après le premier clic, y compris après défilement', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Contrôle réservé au projet mobile.');
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/');
    await acceptCookies(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await page.getByRole('link', { name: 'Studio', exact: true }).click();

    await expect(page).toHaveURL(/\/studio\/?$/);
    await expect(page.getByRole('button', { name: 'Ouvrir le menu' })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('heading', { level: 1, name: /Construisez un prompt clair/i })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: /Formations en IA/i })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
