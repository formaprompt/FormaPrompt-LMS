import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Page d’accueil FormaPrompt', () => {
  test('charge les images principales de l’accueil et de la page À propos', async ({ page }) => {
    await page.goto('/');

    const heroImage = page.getByRole('img', { name: 'Session de formation FormaPrompt' });
    await expect.poll(() => heroImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    const audienceImage = page.getByRole('img', { name: 'Public visé par les formations FormaPrompt' });
    await audienceImage.scrollIntoViewIfNeeded();
    await expect.poll(() => audienceImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    await page.goto('/a-propos');
    const portrait = page.getByRole('img', { name: 'Thierry FREZARD, Formateur Expert' });
    await expect.poll(() => portrait.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  });

  test('annonce le Studio avec un SEO cohérent et un affichage accessible', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Formations en IA, Prompt Engineering et Bureautique',
    })).toBeVisible();
    await expect(page.getByRole('heading', {
      level: 2,
      name: 'Structurez vos prompts avec FormaPrompt Studio',
    })).toBeVisible();

    const studioLink = page.getByRole('link', { name: 'Essayer gratuitement le Studio' });
    await expect(studioLink).toHaveAttribute('href', '/studio');
    await expect(page.getByText('Seize cas d’usage pour écrire, transmettre, analyser, créer et construire.')).toBeVisible();
    await expect(page.getByText('Votre brouillon est conservé uniquement dans votre navigateur. Aucune saisie n’est envoyée à FormaPrompt ou à un fournisseur d’intelligence artificielle.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'thierry@formaprompt.com' })).toHaveAttribute(
      'href',
      'mailto:thierry@formaprompt.com',
    );

    await expect(page).toHaveTitle('FormaPrompt | Formations IA, prompts et bureautique');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Formations professionnelles en IA générative, prompt engineering et bureautique. Testez gratuitement FormaPrompt Studio pour structurer vos prompts.',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://formaprompt.com/');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://formaprompt.com/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://formaprompt.com/assets/logo-new.png',
    );

    const jsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() || '{}');
    expect(jsonLd['@graph'].map((entry: { '@type': string }) => entry['@type'])).toEqual([
      'EducationalOrganization',
      'WebSite',
      'WebApplication',
    ]);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBe(pageWidth.client);

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
  });
});
