import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { guideDownloads } from '../src/data/guideDownloads.js';

// Export local ciblé : ne régénère pas les PDF Claude et Copilot.
const origin = process.env.GEMINI_PREVIEW_ORIGIN || 'http://127.0.0.1:4198';
const route = '/guides/gemini-guide-pratique';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route('**/*', handler => new URL(handler.request().url()).origin === origin && handler.request().method() === 'GET' ? handler.continue() : handler.abort());
  await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1 }).waitFor();
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://formaprompt.com${route}`);
  // Pré-rendu de la seule nouvelle page, sans changement au sitemap partagé.
  await mkdir('dist/guides', { recursive: true });
  await writeFile(`dist${route}.html`, `<!doctype html>\n${await page.locator('html').evaluate(el => el.outerHTML)}`);
  if (process.argv.includes('--prerender-only')) {
    console.log('Pré-rendu Gemini créé ; PDF validés conservés.');
  } else {
  await page.evaluate(() => {
    document.querySelectorAll('.tool-guide details').forEach(item => { item.open = true; });
    document.querySelectorAll('.tool-guide-download').forEach(item => item.remove());
    document.querySelectorAll('a[href]').forEach(link => {
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin) link.href = `https://formaprompt.com${url.pathname}${url.search}${url.hash}`;
    });
  });
  const download = guideDownloads.gemini;
  const target = path.resolve('public', download.href.slice(1));
  await mkdir(path.dirname(target), { recursive: true });
  await mkdir('../output/pdf', { recursive: true });
  await page.pdf({ path: target, format: 'A4', tagged: true, printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#475569">FormaPrompt · formaprompt.com · <span class="pageNumber"></span>/<span class="totalPages"></span></div>', margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' } });
  await mkdir(path.resolve('dist', path.dirname(download.href.slice(1))), { recursive: true });
  await copyFile(target, path.resolve('dist', download.href.slice(1)));
  await copyFile(target, path.resolve('../output/pdf', download.filename));
  assert.equal((await readFile(target)).subarray(0, 5).toString(), '%PDF-');
  console.log(`PDF Gemini et pré-rendu local créés : ${target}`);
  }
} finally { await browser.close(); }
