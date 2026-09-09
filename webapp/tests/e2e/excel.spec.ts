import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('chaque niveau affiche la modalité choisie avant toute redirection Stripe', async ({ page }) => {
  const checkoutRequests: string[] = [];
  await page.route('**/functions/v1/create-checkout', async (route) => {
    checkoutRequests.push(route.request().url());
    await route.abort();
  });
  await page.goto('/formation-excel');
  // Le HTML pré-rendu peut recevoir un clic natif avant son remplacement par React.
  // Attendre le montage évite que l'ouverture de l'accordéon soit perdue à ce moment.
  await expect.poll(() => page.locator('#initiation .excel-enrollment summary').evaluate((element) =>
    Object.keys(element).some((key) => key.startsWith('__reactProps$')),
  )).toBe(true);
  for (const level of ['initiation', 'perfectionnement', 'avance']) {
    const card = page.locator(`#${level}`);
    await card.locator('.excel-enrollment summary').click();
    await expect(card.getByText('Intra-entreprise — 1 590 € / groupe jusqu’à 8 participants')).toBeVisible();
    await expect(card.getByRole('link', { name: 'Demander un devis', exact: true })).toHaveAttribute('href', '/contact');
    for (const [modality, amount] of [['Inter-entreprises', '690'], ['Individuel', '990']]) {
      await card.getByRole('radio', { name: new RegExp(modality) }).check();
      await card.getByRole('button', { name: 'Voir le tarif et s’inscrire' }).click();
      const recap = card.getByRole('region', { name: /^Récapitulatif de votre formation Excel/ });
      await expect(recap.getByText(modality, { exact: true })).toBeVisible();
      await expect(recap).toContainText('14 heures');
      await expect(recap).toContainText(amount);
      await expect(card.getByRole('link', { name: new RegExp(`Se connecter pour acheter.*${amount}`) })).toHaveAttribute('href', '/login');
    }
  }
  expect(checkoutRequests).toEqual([]);
});

test('Bureautique mène à Excel, puis au contact existant', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if (page.viewportSize()!.width <= 1200) {
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await expect(page.getByRole('button', { name: 'Fermer le menu' })).toHaveAttribute('aria-expanded', 'true');
  }
  await page.getByRole('button', { name: /^Formations/ }).click();
  await page.getByRole('link', { name: 'Bureautique', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Formations Bureautique');
  await page.getByRole('link', { name: 'Découvrir les 3 niveaux Excel' }).click();
  await expect(page).toHaveURL(/\/formation-excel$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page).toHaveTitle('Formations Excel : Initiation, Perfectionnement, Avancé | FormaPrompt');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://formaprompt.com/formation-excel');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /14 h par niveau/);
  await page.getByRole('link', { name: 'Voir le niveau perfectionnement', exact: true }).click();
  const intermediate = page.locator('#perfectionnement');
  const disclosure = intermediate.locator('details:not(.excel-enrollment) > summary');
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(intermediate.locator('details:not(.excel-enrollment)')).toHaveAttribute('open', '');
  await expect(disclosure).toBeFocused();
  expect(await disclosure.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  await expect(intermediate.locator('ol')).toContainText('RECHERCHEV et RECHERCHEH');
  await expect(intermediate.locator('ol')).toContainText('RECHERCHEX');
  await intermediate.locator('.excel-enrollment summary').click();
  await intermediate.getByRole('button', { name: 'Voir le tarif et s’inscrire' }).click();
  await expect(intermediate.getByRole('link', { name: /Se connecter pour acheter.*690/ })).toHaveAttribute('href', '/login');
  await intermediate.getByRole('radio', { name: /Individuel/ }).check();
  await intermediate.getByRole('button', { name: 'Voir le tarif et s’inscrire' }).click();
  await expect(intermediate.getByRole('link', { name: /Se connecter pour acheter.*990/ })).toHaveAttribute('href', '/login');
  await intermediate.getByRole('link', { name: 'Demander un devis', exact: true }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Excel reste lisible, accessible et sans liens locaux cassés', async ({ page }, testInfo) => {
  await page.goto('/formation-excel');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const width of [320, 390, 768, 1365]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Débordement à ${width}px`).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`excel-${width}.png`), fullPage: true });
  }
  for (const summary of await page.locator('.excel-page summary').all()) await summary.click();
  for (const width of [320, 390, 768, 1365]) {
    await page.setViewportSize({ width, height: 900 });
    for (const level of ['initiation', 'perfectionnement', 'avance']) {
      const card = page.locator(`#${level}`);
      for (const modality of ['Inter-entreprises', 'Individuel']) {
        await card.getByRole('radio', { name: new RegExp(modality) }).check();
        await card.getByRole('button', { name: 'Voir le tarif et s’inscrire' }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Récapitulatif ${level} ${modality} à ${width}px`).toBe(true);
      }
    }
  }
  const missingAnchors = await page.locator('.excel-page a[href^="#"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')).filter((href) => !document.getElementById(href!.slice(1))),
  );
  expect(missingAnchors).toEqual([]);
  const results = await new AxeBuilder({ page }).include('.excel-page').analyze();
  expect(results.violations).toEqual([]);
  const breadcrumb = await page.locator('script[type="application/ld+json"][data-formaprompt-seo]').textContent();
  expect(JSON.parse(breadcrumb!).itemListElement[2].item).toBe('https://formaprompt.com/formation-excel');
  await page.getByRole('link', { name: 'Toutes les formations bureautiques' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Formations Bureautique');
});
