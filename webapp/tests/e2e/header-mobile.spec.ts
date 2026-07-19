import { expect, test } from '@playwright/test';

test('le menu mobile reste utilisable au-dessus des barres du navigateur', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Contrôle réservé au projet mobile.');

  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');

  const cookieButton = page.getByRole('button', { name: "J'accepte" });
  if (await cookieButton.isVisible()) await cookieButton.click();

  const menuButton = page.locator('.mobile-menu-btn');
  await expect(menuButton).toHaveAccessibleName('Ouvrir le menu');
  await menuButton.click();

  await expect(page.getByRole('link', { name: 'Studio', exact: true })).toBeVisible();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

  const navigation = page.locator('#primary-navigation');
  const navigationStyles = await navigation.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      overscrollBehavior: styles.overscrollBehavior,
      paddingBottom: Number.parseFloat(styles.paddingBottom),
      bodyOverflow: window.getComputedStyle(document.body).overflow,
    };
  });

  expect(navigationStyles.overscrollBehavior).toBe('contain');
  expect(navigationStyles.paddingBottom).toBeGreaterThanOrEqual(80);
  expect(navigationStyles.bodyOverflow).toBe('hidden');

  await navigation.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  const loginButton = page.getByRole('link', { name: 'Se connecter' });
  const loginBox = await loginButton.boundingBox();
  expect(loginBox).not.toBeNull();
  expect((loginBox?.y ?? 0) + (loginBox?.height ?? 0)).toBeLessThanOrEqual(660);

  await page.keyboard.press('Escape');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(menuButton).toHaveAccessibleName('Ouvrir le menu');
  await expect(navigation).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.getComputedStyle(document.body).overflow)).not.toBe('hidden');
});
