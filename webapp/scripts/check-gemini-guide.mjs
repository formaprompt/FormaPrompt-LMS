import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.GEMINI_PREVIEW_ORIGIN || 'http://127.0.0.1:4198';
const captureScreenshots = process.env.GEMINI_CAPTURE_SCREENSHOTS !== '0';
const output = path.resolve('../output/playwright/gemini');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
try {
  for (const tool of ['gemini', 'claude', 'copilot']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', handler => new URL(handler.request().url()).origin === origin && handler.request().method() === 'GET' ? handler.continue() : handler.abort());
    await page.goto(`${origin}/guides/${tool}-guide-pratique`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { level: 1 }).waitFor();
    const reject = page.getByRole('button', { name: 'Refuser tout', exact: true });
    if (await reject.count()) await reject.click();
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://formaprompt.com/guides/${tool}-guide-pratique`);
    assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), `https://formaprompt.com/guides/${tool}-guide-pratique`);
    const count = tool === 'gemini' ? 5 : 4;
    assert.equal(await page.locator('.tool-guide-panels details').count(), count);
    for (let i = 0; i < count; i++) {
      const button = page.locator('.gpt-choices button').nth(i);
      const panel = page.locator(`#${tool}-case-${i}`);
      await button.focus();
      await page.keyboard.press('Enter');
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await panel.getAttribute('open'), '');
      await panel.locator('summary').focus();
      await page.keyboard.press('Enter');
      assert.equal(await panel.getAttribute('open'), null);
      await button.focus();
      await page.keyboard.press('Enter');
      if (tool === 'gemini') {
        assert.equal(await panel.getAttribute('open'), '', 'Le même choix doit rouvrir le cas Gemini');
      } else {
        assert.equal(await panel.getAttribute('open'), null, 'Le comportement existant Claude/Copilot doit rester inchangé');
        await panel.locator('summary').focus();
        await page.keyboard.press('Enter');
        assert.equal(await panel.getAttribute('open'), '', 'Le summary natif reste utilisable');
      }
      await panel.getByRole('button', { name: 'Copier la consigne' }).click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      for (const label of ['Contexte', 'Rôle', 'Objectif', 'Précisions']) assert.ok(copied.includes(`${label} :`));
    }
    const checks = [];
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(dimensions.scroll <= dimensions.width, `Débordement ${tool} à ${width}`);
      if (tool === 'gemini' || width === 1440) {
        const axe = await new AxeBuilder({ page }).include('.tool-guide').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        checks.push({ ...dimensions, violations: axe.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(n => n.target) })) });
        assert.equal(axe.violations.length, 0, `Accessibilité ${tool} à ${width}`);
      }
      if (captureScreenshots && tool === 'gemini' && [1440, 390].includes(width)) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, `gemini-${width}-hero.png`) });
        await page.screenshot({ path: path.join(output, `gemini-${width}-page.png`), fullPage: true });
        await page.locator('#gemini-offres').screenshot({ path: path.join(output, `gemini-${width}-offres.png`) });
        await page.locator('.gpt-chooser').screenshot({ path: path.join(output, `gemini-${width}-cas.png`) });
      }
    }
    assert.deepEqual(errors, []);
    report.push({ tool, cases: count, keyboard: tool === 'gemini' ? 'Enter : sélection, fermeture native, réouverture même choix activée explicitement' : 'Enter : sélection et fermeture native ; même choix reste fermé comme avant ; réouverture native par summary', copy: 'CROP complet pour chaque cas', errors, checks });
    await context.close();
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const page = await noJs.newPage();
  await page.goto(`${origin}/guides/gemini-guide-pratique.html`);
  assert.equal(await page.locator('.tool-guide-panels summary').count(), 5);
  await page.locator('#gemini-case-4 summary').click();
  assert.equal(await page.locator('#gemini-case-4').getAttribute('open'), '');
  await noJs.close();
  const sitemap = await readFile('public/sitemap.xml', 'utf8');
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, 47, 'Sitemap partagé préservé avec Gemini');
  await writeFile(path.join(output, 'checks.json'), JSON.stringify({ report, noJavaScript: '5 cas présents ; ouverture native vérifiée', sitemap: '47 URL, 46 URL existantes préservées' }, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
