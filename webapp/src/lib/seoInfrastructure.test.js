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
  assert.ok(urls.includes('https://formaprompt.com/diagnostic-ia'));
  assert.ok(urls.includes('https://formaprompt.com/faq'));
  assert.ok(!urls.includes('https://formaprompt.com/formation-ia-formateur'));
  assert.ok(!urls.includes('https://formaprompt.com/retractation'));
});

test('la page Diagnostic IA est routée et accessible depuis la navigation principale', async () => {
  const [app, header] = await Promise.all([
    readProjectFile('src/App.jsx'),
    readProjectFile('src/components/Header.jsx'),
  ]);

  assert.match(app, /path="diagnostic-ia"/);
  assert.match(header, /to="\/diagnostic-ia"/);
  assert.match(header, />Diagnostic IA<\/Link>/);
});

test('la restitution Diagnostic reste privée, protégée et absente du pré-rendu public', async () => {
  const [app, dashboard, sitemap, prerenderScript, page, printStyles] = await Promise.all([
    readProjectFile('src/App.jsx'),
    readProjectFile('src/pages/Dashboard.jsx'),
    readProjectFile('public/sitemap.xml'),
    readProjectFile('scripts/prerender-studio.mjs'),
    readProjectFile('src/pages/DiagnosticRestitution.jsx'),
    readProjectFile('src/pages/DiagnosticRestitution.css'),
  ]);

  assert.match(app, /path="diagnostic-ia\/restitution" element={<RequireAuth><DiagnosticRestitution \/><\/RequireAuth>}/);
  assert.match(dashboard, /<DiagnosticDashboardSection/);
  assert.match(dashboard, /fetchClientDiagnostics\(supabase, user\.id\)/);
  assert.match(page, /robots="noindex, nofollow"/);
  assert.doesNotMatch(sitemap, /diagnostic-ia\/restitution/);
  assert.doesNotMatch(prerenderScript, /route: '\/diagnostic-ia\/restitution'/);
  assert.match(printStyles, /@media print/);
  assert.match(printStyles, /@page \{ size: A4;/);
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
  assert.match(htaccess, /diagnostic-ia\/\(\?:confirmation\|reserver\|questionnaire\|restitution\).*app-shell\.html \[END\]/);
  assert.match(htaccess, /ErrorDocument 404 \/404\.html/);
  assert.match(htaccess, /\[R=404,L\]/);
});

test('la règle Apache Diagnostic couvre les quatre routes profondes sans élargir le fallback', async () => {
  const htaccess = await readProjectFile('public/.htaccess');
  const routeRule = htaccess.match(/RewriteRule \^(diagnostic-ia\/\(\?:([^)]+)\)\/\?\$) app-shell\.html \[END\]/);
  assert.ok(routeRule, 'Règle Diagnostic privée absente');
  const matcher = new RegExp(`^${routeRule[1]}$`);

  for (const route of ['confirmation', 'reserver', 'questionnaire', 'restitution']) {
    assert.equal(matcher.test(`diagnostic-ia/${route}`), true, `${route} doit servir app-shell.html`);
  }
  assert.equal(matcher.test('diagnostic-ia'), false);
  assert.equal(matcher.test('diagnostic-ia/inconnue'), false);
  assert.match(htaccess, /RewriteRule \^\(\?:admin\|course\|parcours\|attestations\|dossiers\)\(\?:\/\.\*\)\?\$ \/app-shell\.html \[L\]/);
  assert.match(htaccess, /RewriteRule \^ - \[R=404,L\]/);
});

test('robots.txt publie le sitemap sans masquer les directives noindex', async () => {
  const robots = await readProjectFile('public/robots.txt');

  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/formaprompt\.com\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Disallow:/);
});
