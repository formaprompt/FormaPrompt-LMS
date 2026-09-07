import assert from 'node:assert/strict';
import test from 'node:test';
import { checkApacheTargets, checkPublicHtml, checkSafeFile, createShells, outputForRoute, publicRoutes } from './release-artifact.mjs';

const initialShell = '<html><head><title>FormaPrompt</title></head><body><div id="root"></div><script type="module" src="/assets/main.js"></script></body></html>';

test('les shells conservent le script Vite, sans contenu accueil ni canonical', () => {
  const { appShell, publicShell } = createShells(initialShell);
  assert.equal(publicShell, initialShell);
  assert.match(appShell, /noindex, nofollow/);
  assert.match(appShell, /\/assets\/main.js/);
  assert.throws(() => createShells(initialShell.replace('<div id="root"></div>', '<div id="root"><h1>Accueil</h1></div>')));
});

test('les chemins de sortie préservent les six pages et les cibles Apache', () => {
  assert.equal(outputForRoute('/'), 'index.html');
  assert.equal(outputForRoute('/studio/'), 'studio/index.html');
  for (const route of ['/formation-ia-generative', '/formation-prompt-engineering', '/formation-ia-act-conformite']) {
    assert.equal(outputForRoute(route), `${route.slice(1)}/index.html`);
  }
  for (const route of ['/contact', '/blog', '/formation-organismes', '/blog/comparatif']) {
    assert.equal(outputForRoute(route), `${route.slice(1)}.html`);
  }
  assert.throws(() => outputForRoute('/../secret'));
});

test('la liste publique refuse www, doublons et ancienne URL, sans pré-rendre les parcours privés', () => {
  const sitemap = '<loc>https://formaprompt.com/contact</loc><loc>https://formaprompt.com/retractation</loc>';
  assert.ok(publicRoutes(sitemap).includes('/contact'));
  assert.ok(!publicRoutes(sitemap).includes('/retractation'));
  assert.throws(() => publicRoutes(sitemap + sitemap));
  assert.throws(() => publicRoutes('<loc>https://www.formaprompt.com/contact</loc>'));
  assert.throws(() => publicRoutes('<loc>https://formaprompt.com/formation-ia-formateur</loc>'));
});

test('une page publique doit avoir un H1 et la canonical exacte, sans noindex', () => {
  const html = '<html><head><title>Contact</title><meta name="description" content="Contact"><link rel="canonical" href="https://formaprompt.com/contact"></head><body><h1>Contact</h1></body></html>';
  assert.doesNotThrow(() => checkPublicHtml(html, '/contact'));
  assert.throws(() => checkPublicHtml(html.replace('/contact"', '/contact/"'), '/contact'));
  assert.throws(() => checkPublicHtml(html.replace('</body>', '<h1>Autre titre</h1></body>'), '/contact'));
  assert.throws(() => checkPublicHtml(html.replace('</head>', '<meta name="robots" content="noindex"></head>'), '/contact'));
});

test('les fichiers techniques privés et secrets serveur sont refusés', () => {
  for (const name of ['.env', 'supabase/config.toml', '.branches/current', 'src/main.jsx', 'assets/test.test.js', 'assets/app.js.map']) {
    assert.throws(() => checkSafeFile(name, ''));
  }
  assert.throws(() => checkSafeFile('assets/app.js', 'sb_secret_' + 'x'.repeat(24)));
  assert.doesNotThrow(() => checkSafeFile('assets/app.js', 'sb_publishable_public_configuration'));
});

test('toute cible HTML littérale Apache doit exister, y compris le document 404', () => {
  const rules = 'RewriteRule ^contact$ contact.html [END]\nRewriteRule ^blog/[^/]+$ /public-shell.html [L]\nErrorDocument 404 /404.html';
  const files = new Set(['contact.html', 'public-shell.html', '404.html']);
  assert.deepEqual(checkApacheTargets(rules, files), [...files]);
  files.delete('contact.html');
  assert.throws(() => checkApacheTargets(rules, files), /Cible Apache absente/);
});
