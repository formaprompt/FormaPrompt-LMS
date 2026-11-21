import path from 'node:path';
import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const origin = process.env.GUIDES_PREVIEW_ORIGIN || 'http://127.0.0.1:4191';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const route = '/guide-gpt-6-codex';
const target = 'assets/guides/pdf/guide-gpt-6-gpt-6-1-formaprompt.pdf';
const dist = path.resolve('dist');
const serveBuilt = route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin || route.request().method() !== 'GET') return route.abort();
  const asset = path.posix.extname(url.pathname) ? url.pathname : '/index.html';
  const target = path.resolve(dist, '.' + asset);
  assert.ok(target.startsWith(dist + path.sep));
  return route.fulfill({ path: target });
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await page.route('**/*', serveBuilt);
  await page.goto(origin + route);
  await page.locator('#gpt62-models').waitFor();
  await page.evaluate(() => {
    const guide = document.querySelector('.gpt6-guide');
    for (const el of document.querySelectorAll('header, footer, .gpt-scroll-link')) {
      if (!guide.contains(el) || el.classList.contains('gpt-scroll-link')) el.remove();
    }
    guide.querySelectorAll('details').forEach(d => { d.open = true; });
    guide.querySelectorAll('a[href]').forEach(a => {
      const url = new URL(a.href);
      if (url.origin === location.origin && url.pathname !== location.pathname) a.href = 'https://formaprompt.com' + url.pathname + url.search + url.hash;
    });
    const back = document.createElement('a');
    back.href = 'https://formaprompt.com/guide-gpt-6-codex';
    back.textContent = 'Lire le guide en ligne sur FormaPrompt';
    document.querySelector('.gpt-sources > div').append(back);
  });
  const buttons = page.locator('.gpt-choices button');
  const count = await buttons.count();
  assert.ok(count > 0);
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    await button.click();
    const label = await button.locator('strong').innerText();
    await page.evaluate(text => {
      const copy = document.querySelector('.gpt-recommendation').cloneNode(true);
      copy.removeAttribute('id');
      copy.removeAttribute('aria-live');
      const heading = document.createElement('h3');
      heading.textContent = text;
      copy.prepend(heading);
      document.querySelector('#gpt6-choisir').append(copy);
    }, label);
  }
  await page.addStyleTag({ content: '@media print { :root{color-scheme:light!important} body{background:white!important} .gpt-chooser,.gpt-equation,[class*="cookie"],.advertising-consent,.gpt6-download {display:none!important} .gpt-hero,.gpt-effort-section{background:#fff!important;color:#111827!important} .gpt-effort-section h2,.gpt-effort-section h3,.gpt-effort-section p,.gpt-effort-section span{color:#111827!important} .gpt6-guide .gpt-recommendation{margin-bottom:12px;break-inside:avoid} .gpt-model-card,.gpt-surfaces-grid article,.gpt-effort-row{break-inside:avoid} .gpt-section,.gpt-hero{padding-top:18px!important;padding-bottom:18px!important} .gpt-hero{min-height:0!important;display:block!important}.gpt-hero::before{display:none}.gpt-hero-inner{padding-block:12px!important}.gpt-hero h1{font-size:38px!important;color:#10233f!important}.gpt-hero h1 span,.gpt-hero-lead a{color:#125c59!important}.gpt-hero-lead,.gpt6-update{color:#3b5064!important}.gpt6-guide .gpt-recommendation{padding:12px 16px!important;background:#edf7f5!important;border:1px solid #b7d6d2!important;color:#10233f!important}.gpt6-guide .gpt-recommendation :is(h3,p,span,strong,blockquote){color:#10233f!important}.gpt6-guide .gpt-recommendation blockquote{margin:.6rem 0;padding:.6rem;font-size:.95rem} }' });
  await page.emulateMedia({ media: 'print' });
  await page.locator('.advertising-consent').waitFor({ state: 'hidden' });
  await mkdir('../output/pdf', { recursive: true });
  const output = '../output/pdf/guide-gpt-6-6-1-6-2-formaprompt.pdf';
  await page.pdf({ path: output, format: 'A4', printBackground: true, margin: { top: '13mm', bottom: '14mm', left: '12mm', right: '12mm' } });
  const bytes = await readFile(output);
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  await copyFile(output, 'public/' + target);
  await copyFile(output, 'dist/' + target);
  console.log(JSON.stringify({ output, target, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }));
} finally { await browser.close(); }
