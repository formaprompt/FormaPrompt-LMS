import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('Page Diagnostic IA Express', () => {
  test('présente l’offre, le SEO et un CTA d’authentification sans checkout', async ({ page }) => {
    await page.goto('/diagnostic-ia')

    await expect(page.getByRole('heading', { level: 1, name: 'Diagnostic IA Express' })).toHaveCount(1)
    await expect(page.locator('.diagnostic-ia-price')).toHaveText('149 €')
    await expect(page.getByText('TVA non applicable - article 293 B du CGI')).toBeVisible()
    await expect(page.getByText('Installation complète de n8n')).toBeVisible()

    const heroCta = page.locator('.diagnostic-ia-hero').getByRole('link', { name: /Réserver mon Diagnostic IA Express - 149 €/i })
    await expect(heroCta).toHaveAttribute('href', '#reserver')
    await expect(page.getByText('Après paiement, vous choisissez votre créneau parmi mes disponibilités.')).toBeVisible()

    const cta = page.locator('.diagnostic-ia-price-card').getByRole('link', { name: /Réserver mon Diagnostic IA Express - 149 €/i })
    await expect(cta).toHaveAttribute('href', '/login?redirect=%2Fdiagnostic-ia%23reserver')
    await expect(page.locator('form')).toHaveCount(0)

    await expect(page).toHaveTitle('Diagnostic IA Express – Plan d’action personnalisé | FormaPrompt')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://formaprompt.com/diagnostic-ia')
    const jsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() || '{}')
    expect(jsonLd['@graph'].some((entry: { '@type': string }) => entry['@type'] === 'Service')).toBe(true)

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))
    expect(pageWidth.scroll).toBe(pageWidth.client)

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])

    await cta.click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdiagnostic-ia%23reserver$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Bon retour !' })).toBeVisible()
  })
})
