import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin = 'http://127.0.0.1:4187';
const root = path.resolve('..');
const screenshots = path.join(root, 'output', 'playwright', 'tool-guides');
const pdfs = path.join(root, 'output', 'pdf');
await mkdir(screenshots, { recursive: true });
await mkdir(pdfs, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
try {
  for (const tool of ['claude', 'copilot']) {
    const route = `/guides/${tool}-guide-pratique`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/*', routeHandler => {
      const req = routeHandler.request();
      if (new URL(req.url()).origin === origin && req.method() === 'GET') return routeHandler.continue();
      return routeHandler.abort();
    });
    await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { level: 1 }).waitFor();
    const reject = page.getByRole('button', { name: 'Refuser tout', exact: true });
    if (await reject.count()) await reject.click();
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://formaprompt.com${route}`);
    assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), `https://formaprompt.com${route}`);
    assert.ok((await page.title()).includes(tool === 'claude' ? 'Claude' : 'Copilot'));
    assert.equal(await page.locator('.tool-guide-panels details').count(), 4);
    for (let index = 0; index < 4; index++) {
      const button = page.locator('.gpt-choices button').nth(index);
      await button.focus();
      await page.keyboard.press('Enter');
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator(`#${tool}-case-${index}`).getAttribute('open'), '');
      await page.locator(`#${tool}-case-${index}`).getByRole('button', { name: 'Copier la consigne' }).click();
      assert.ok((await page.evaluate(() => navigator.clipboard.readText())).includes('Contexte :'));
      await page.getByRole('status').filter({ hasText: 'Consigne copiée' }).last().waitFor();
    }
    await page.locator('.gpt-choices button').first().click();
    const desktopAxe = await new AxeBuilder({ page }).include('.tool-guide').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const desktopWidth = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(desktopWidth.scroll <= desktopWidth.width, 'Débordement desktop');
    await page.screenshot({ path: path.join(screenshots, `${tool}-desktop.png`), fullPage: true });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(screenshots, `${tool}-desktop-hero.png`) });
    await page.locator('.gpt-chooser').screenshot({ path: path.join(screenshots, `${tool}-desktop-cas.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    const mobileWidth = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(mobileWidth.scroll <= mobileWidth.width, 'Débordement mobile');
    const mobileAxe = await new AxeBuilder({ page }).include('.tool-guide').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await page.screenshot({ path: path.join(screenshots, `${tool}-mobile.png`), fullPage: true });
    await page.screenshot({ path: path.join(screenshots, `${tool}-mobile-hero.png`) });
    await page.locator('.gpt-chooser').screenshot({ path: path.join(screenshots, `${tool}-mobile-cas.png`) });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { document.querySelectorAll('.tool-guide details').forEach(detail => { detail.open = true; }); });
    await page.pdf({ path: path.join(pdfs, `guide-${tool}-formaprompt-apercu.pdf`), format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#475569">FormaPrompt · Aperçu local du 31 octobre 2026 · <span class="pageNumber"></span>/<span class="totalPages"></span></div>', margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' } });
    console.log(`${tool}: interactions, copie, largeurs et PDF contrôlés ; axe desktop=${desktopAxe.violations.length}, mobile=${mobileAxe.violations.length}`);
    assert.deepEqual(pageErrors, []);
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJs.newPage();
    await staticPage.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
    const summaries = staticPage.locator('.tool-guide-panels summary');
    assert.equal(await summaries.count(), 4, 'Consignes absentes sans JavaScript');
    await summaries.nth(3).click();
    assert.equal(await staticPage.locator(`#${tool}-case-3`).getAttribute('open'), '', 'Accordéon inutilisable sans JavaScript');
    report.push({ tool, route, desktopWidth, mobileWidth, pageErrors, noJavaScript: '4 cas présents, ouverture native vérifiée', desktopViolations: desktopAxe.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(node => node.target) })), mobileViolations: mobileAxe.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(node => node.target) })) });
    await noJs.close();
    await context.close();
  }
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  assert.ok(sitemap.includes('/guides/claude-guide-pratique') && sitemap.includes('/guides/copilot-guide-pratique'));
  await writeFile(path.join(screenshots, 'checks.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.ok(report.every(item => !item.desktopViolations.length && !item.mobileViolations.length), 'Échec accessibilité');
} finally {
  await browser.close();
}
