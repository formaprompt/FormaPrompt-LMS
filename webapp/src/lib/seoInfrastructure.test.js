import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readProjectFile = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('le sitemap ne contient que des URL canoniques publiques et uniques', async () => {
  const sitemap = await readProjectFile('public/sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

  assert.ok(urls.length >= 20);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every((url) => url.startsWith('https://formaprompt.com/')));
  assert.ok(urls.every((url) => !url.includes('www.formaprompt.com')));
  assert.ok(urls.includes('https://formaprompt.com/studio/'));
  assert.ok(urls.includes('https://formaprompt.com/formation-organismes'));
  assert.ok(urls.includes('https://formaprompt.com/faq'));
  assert.ok(!urls.includes('https://formaprompt.com/formation-ia-formateur'));
  assert.ok(!urls.includes('https://formaprompt.com/retractation'));
});

test("chaque URL du sitemap dispose d'une configuration de pré-rendu", async () => {
  const [sitemap, prerenderScript] = await Promise.all([
    readProjectFile('public/sitemap.xml'),
    readProjectFile('scripts/prerender-studio.mjs'),
  ]);
  const paths = [...sitemap.matchAll(/<loc>https:\/\/formaprompt\.com([^<]*)<\/loc>/g)]
    .map((match) => match[1] || '/');

  for (const path of paths) {
    assert.ok(prerenderScript.includes(`route: '${path}'`), `Pré-rendu absent pour ${path}`);
  }
});

test('Apache consolide le domaine, conserve les routes privées et renvoie de vraies 404', async () => {
  const htaccess = await readProjectFile('public/.htaccess');

  assert.match(htaccess, /www\\\.formaprompt\\\.com/);
  assert.match(htaccess, /https:\/\/formaprompt\.com%\{REQUEST_URI\}/);
  assert.match(htaccess, /formation-ia-formateur.*formation-organismes/);
  assert.match(htaccess, /app-shell\.html/);
  assert.match(htaccess, /ErrorDocument 404 \/404\.html/);
  assert.match(htaccess, /\[R=404,L\]/);
});

test('robots.txt publie le sitemap sans masquer les directives noindex', async () => {
  const robots = await readProjectFile('public/robots.txt');

  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/formaprompt\.com\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Disallow:/);
});
