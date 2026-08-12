import { expect, test } from '@playwright/test';

const pages = [
  ['/mentions-legales', 'Mentions légales'],
  ['/cgv-particuliers', 'Conditions générales de vente — particuliers'],
  ['/cgv-professionnels', 'Conditions générales de vente — professionnels'],
  ['/politique-confidentialite', 'Politique de confidentialité'],
  ['/reglement-interieur', 'Règlement intérieur des stagiaires'],
  ['/informations-precontractuelles', 'Informations précontractuelles'],
  ['/retractation', 'Renoncer au contrat ici'],
] as const;

for (const [path, heading] of pages) {
  test(`${path} possède un titre unique et reste lisible`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
    await expect(page.getByText(/document préparatoire|publication après validation/i)).toHaveCount(0);
  });
}

test('le Footer relie les documents juridiques prioritaires', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'CGV particuliers' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'CGV professionnels' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Confidentialité' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Règlement intérieur' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Renoncer au contrat ici' })).toBeVisible();
});

for (const path of [
  '/formation-ia-generative',
  '/formation-prompt-engineering',
  '/formation-ia-act-conformite',
]) {
  test(`${path} conserve son parcours d’achat et la qualification commerciale`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('group', { name: /vous achetez cette formation/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /se connecter pour acheter/i })).toBeVisible();
    await expect(page.getByText('Inscription en ligne temporairement indisponible')).toHaveCount(0);
  });
}
