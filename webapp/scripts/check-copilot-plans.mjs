import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.GUIDES_PREVIEW_ORIGIN || 'http://127.0.0.1:4187';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const route = '/guides/copilot-guide-pratique';
const output = path.resolve('../output/playwright/copilot-plans');
await mkdir(output, { recursive: true });
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const unpublished = ['/guides/claude-guide-pratique', '/guides/copilot-guide-pratique'];
const published = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname).filter(item => !unpublished.includes(item));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.route('**/*', handler => new URL(handler.request().url()).origin === origin && handler.request().method() === 'GET' ? handler.continue() : handler.abort());
  await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
  const reject = page.getByRole('button', { name: 'Refuser tout', exact: true });
  if (await reject.count()) await reject.click();
  assert.equal(await page.locator('.copilot-plan-table').count(), 2, 'Deux tableaux particuliers / professionnels attendus');
  assert.equal(await page.locator('h1').count(), 1);
  const desktopAxe = await new AxeBuilder({ page }).include('.tool-guide-copilot').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  await page.locator('#copilot-abonnements').screenshot({ path: path.join(output, 'comparatif-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  const widths = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
  assert.equal(widths.content, widths.viewport, 'Débordement mobile');
  const mobileAxe = await new AxeBuilder({ page }).include('.tool-guide-copilot').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  await page.locator('#copilot-abonnements').screenshot({ path: path.join(output, 'comparatif-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const rewritten = await page.evaluate(({ published, unpublished }) => {
    const results = [];
    document.querySelectorAll('.tool-guide-copilot details').forEach(item => { item.open = true; });
    document.querySelectorAll('a[href]').forEach(link => {
      const url = new URL(link.href, location.href);
      if (['127.0.0.1', 'localhost', 'formaprompt.com'].includes(url.hostname)) {
        const old = link.href;
        if (unpublished.includes(url.pathname.replace(/\/$/, ''))) {
          link.removeAttribute('href');
          results.push({ old, replacement: null });
        } else if (published.includes(url.pathname)) {
          link.href = `https://formaprompt.com${url.pathname}${url.search}${url.hash}`;
          results.push({ old, replacement: link.href });
        } else {
          link.removeAttribute('href');
          results.push({ old, replacement: null });
        }
      }
    });
    return results;
  }, { published, unpublished });
  const pdf = path.resolve('../output/pdf/guide-copilot-formaprompt-apercu.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#475569">FormaPrompt · Aperçu avant publication · <span class="pageNumber"></span>/<span class="totalPages"></span></div>', margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' } });
  const report = { widths, desktopViolations: desktopAxe.violations.map(item => ({ id: item.id, impact: item.impact })), mobileViolations: mobileAxe.violations.map(item => ({ id: item.id, impact: item.impact })), rewritten, pdf };
  await writeFile(path.join(output, 'checks.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.equal(desktopAxe.violations.length + mobileAxe.violations.length, 0, 'Violation accessibilité détectée');
} finally {
  await browser.close();
}
