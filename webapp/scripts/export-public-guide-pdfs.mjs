import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { guideDownloads } from '../src/data/guideDownloads.js';

const origin = process.env.GUIDES_PREVIEW_ORIGIN || 'http://127.0.0.1:4191';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
try {
  for (const [id, download] of Object.entries(guideDownloads)) {
    assert.match(download.href, /^\/assets\/guides\/pdf\/[a-z0-9-]+\.pdf$/);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.route('**/*', handler => new URL(handler.request().url()).origin === origin && handler.request().method() === 'GET' ? handler.continue() : handler.abort());
    const article = `https://formaprompt.com/guides/${id}-guide-pratique`;
    await page.goto(`${origin}/guides/${id}-guide-pratique`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.evaluate(() => {
      document.querySelectorAll('.tool-guide details').forEach(item => { item.open = true; });
      document.querySelectorAll('.tool-guide-download').forEach(item => item.remove());
      const returnBlock = document.querySelector('.tool-guide-pdf-return');
      const home = document.createElement('a');
      home.href = 'https://formaprompt.com/';
      home.textContent = 'Accueil FormaPrompt';
      returnBlock.append(document.createElement('br'), home);
      document.querySelectorAll('a[href]').forEach(link => {
        const url = new URL(link.href, location.href);
        if (['127.0.0.1', 'localhost'].includes(url.hostname)) {
          const pathname = url.pathname === '/studio' ? '/studio/' : url.pathname;
          link.href = `https://formaprompt.com${pathname}${url.search}${url.hash}`;
        }
      });
    });
    const target = path.resolve('public', download.href.slice(1));
    await mkdir(path.dirname(target), { recursive: true });
    if (id === 'claude') {
      await page.addStyleTag({ content: '@media print { .claude-team-plans { break-before: page; } .claude-price-date + p { break-inside: avoid; } }' });
    }
    await page.pdf({ path: target, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#475569">FormaPrompt · formaprompt.com · <span class="pageNumber"></span>/<span class="totalPages"></span></div>', margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' } });
    const distTarget = path.resolve('dist', download.href.slice(1));
    await mkdir(path.dirname(distTarget), { recursive: true });
    await copyFile(target, distTarget);
    const output = path.resolve('../output/pdf', download.filename);
    await copyFile(target, output);
    const bytes = await readFile(target);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    report.push({ id, article, href: download.href, source: target, dist: distTarget, output, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    await context.close();
  }
  await writeFile(path.resolve('../output/public-guide-pdfs.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
