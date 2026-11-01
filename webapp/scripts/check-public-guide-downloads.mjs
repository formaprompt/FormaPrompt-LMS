import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { guideDownloads } from '../src/data/guideDownloads.js';

const origin = process.env.GUIDES_PREVIEW_ORIGIN || 'http://127.0.0.1:4191';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const output = path.resolve('../output/playwright/public-guide-downloads');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
try {
  for (const [id, download] of Object.entries(guideDownloads)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const page = await context.newPage();
    await page.route('**/*', handler => new URL(handler.request().url()).origin === origin && handler.request().method() === 'GET' ? handler.continue() : handler.abort());
    const response = await context.request.get(`${origin}${download.href}`);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /^application\/pdf(?:;|$)/);
    const bytes = await response.body();
    const source = await readFile(path.resolve('public', download.href.slice(1)));
    const dist = await readFile(path.resolve('dist', download.href.slice(1)));
    assert.ok(source.equals(bytes) && source.equals(dist), 'PDF public, HTTP et dist différents');
    assert.ok(bytes.length > 50000);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    await page.goto(`${origin}/guides/${id}-guide-pratique`, { waitUntil: 'networkidle' });
    const reject = page.getByRole('button', { name: 'Refuser tout', exact: true });
    if (await reject.count()) await reject.click();
    const link = page.locator('.tool-guide-download a[download]');
    assert.equal(await link.getAttribute('href'), download.href);
    await link.focus();
    const downloading = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    const actualDownload = await downloading;
    assert.equal(actualDownload.suggestedFilename(), download.filename);
    const saved = path.join(output, download.filename);
    await actualDownload.saveAs(saved);
    assert.ok((await readFile(saved)).equals(source), 'Le téléchargement clavier ne correspond pas au PDF');
    await page.locator('.tool-guide-download').screenshot({ path: path.join(output, `${id}-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await link.scrollIntoViewIfNeeded();
    const bounds = await link.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, 'Bouton PDF hors écran mobile');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const axe = await new AxeBuilder({ page }).include('.tool-guide').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.equal(axe.violations.length, 0, JSON.stringify(axe.violations.map(item => item.id)));
    await page.locator('.tool-guide-download').screenshot({ path: path.join(output, `${id}-mobile.png`) });
    const prerender = await readFile(path.resolve('dist/guides', `${id}-guide-pratique.html`), 'utf8');
    assert.ok(prerender.includes(download.href) && prerender.includes('download='));
    const worker = await readFile('dist/sw.js', 'utf8');
    assert.ok(!worker.includes(path.basename(download.href)), 'PDF pré-caché par le service worker');
    report.push({ id, status: response.status(), mime: response.headers()['content-type'], bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), keyboardDownload: true, mobileBounds: bounds, axeViolations: 0, inPrerender: true, inDist: true, notPrecached: true });
    await context.close();
  }
  const headers = await readFile('dist/assets/guides/pdf/.htaccess', 'utf8');
  assert.match(headers, /AddType application\/pdf \.pdf/);
  assert.match(headers, /public, max-age=0, must-revalidate/);
  await writeFile(path.join(output, 'checks.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
