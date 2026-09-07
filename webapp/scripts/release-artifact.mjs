import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

export const canonicalOrigin = 'https://formaprompt.com';
const directoryRoutes = ['/studio/', '/formation-ia-generative', '/formation-prompt-engineering', '/formation-ia-act-conformite'];

export function publicRoutes(sitemap) {
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.ok(urls.length > 0, 'Sitemap vide');
  assert.equal(new Set(urls).size, urls.length, 'URL dupliquée dans le sitemap');
  for (const url of urls) {
    assert.equal(new URL(url).origin, canonicalOrigin, 'Origine incorrecte dans le sitemap');
    assert.notEqual(new URL(url).pathname, '/formation-ia-formateur', 'Ancienne URL dans le sitemap');
  }
  // La rétractation utilise le shell applicatif prévu par .htaccess.
  return [...new Set([...urls.map(url => new URL(url).pathname).filter(route => route !== '/retractation'),
    '/diagnostic-ia', '/faq', '/guide-gpt-5-6-codex'])];
}

export function outputForRoute(route) {
  if (route === '/') return 'index.html';
  if (directoryRoutes.includes(route)) return `${route.replace(/^\/|\/$/g, '')}/index.html`;
  assert.match(route, /^\/[a-z0-9/-]+$/, 'Route de pré-rendu invalide');
  return `${route.slice(1)}.html`;
}

export function createShells(initialHtml) {
  assert.match(initialHtml, /<div id="root"><\/div>/, 'Relancer npm run build : le shell initial doit être vierge');
  assert.match(initialHtml, /<script type="module"[^>]*src="\/assets\//, 'Script Vite absent du shell');
  return {
    publicShell: initialHtml,
    appShell: initialHtml.replace('<title>FormaPrompt</title>', '<title>Espace sécurisé – FormaPrompt</title>')
      .replace('</head>', '<meta name="robots" content="noindex, nofollow">\n</head>'),
  };
}

export function checkPublicHtml(html, route) {
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelectorAll('h1').length, 1, `H1 incorrect : ${route}`);
  assert.ok(document.querySelector('h1').textContent.trim(), `H1 vide : ${route}`);
  assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1, `Canonical dupliquée : ${route}`);
  assert.equal(document.querySelector('link[rel="canonical"]').href, `${canonicalOrigin}${route}`, `Canonical incorrecte : ${route}`);
  assert.ok(document.title && document.title !== 'FormaPrompt', `Title incomplet : ${route}`);
  assert.ok(document.querySelector('meta[name="description"]')?.content, `Description absente : ${route}`);
  assert.ok(!document.querySelector('meta[name="robots"]')?.content.includes('noindex'), `Page désindexée : ${route}`);
  assert.equal(document.querySelectorAll('a[href*="lab.formaprompt.com"]').length, 0, 'Lien public vers le Lab');
  return document;
}

export function checkSafeFile(name, text) {
  assert.ok(!/(^|\/)(?:\.env[^/]*|\.branches|supabase|node_modules|src|tests?|test-results)(\/|$)|\.(?:map|tsx?|jsx|py|ps1|md)$|\.test\./i.test(name), `Fichier exclu de la release : ${name}`);
  assert.ok(!/(?:sk_live_|sk_test_|sb_secret_|ghp_)[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text), `Secret détecté dans ${name}`);
  for (const token of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    assert.equal(JSON.parse(Buffer.from(token[1], 'base64url')).role, 'anon', `Jeton non public dans ${name}`);
  }
}

// Contrôle des cibles physiques, pas une simulation d'Apache.
export function checkApacheTargets(htaccess, files) {
  const targets = [...htaccess.matchAll(/^\s*(?:RewriteRule\s+\S+|ErrorDocument\s+404)\s+\/?([\w/-]+\.html)(?:\s|$)/gm)]
    .map(match => match[1]);
  for (const target of targets) assert.ok(files.has(target), `Cible Apache absente : ${target}`);
  assert.ok(targets.includes('404.html'), 'ErrorDocument absent');
  return [...new Set(targets)];
}

export async function verifyRelease(root = path.resolve('dist')) {
  const files = [];
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = prefix + entry.name;
      assert.ok(!entry.isSymbolicLink(), `Lien symbolique interdit : ${name}`);
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), `${name}/`);
      else files.push(name);
    }
  }
  await walk(root);
  files.sort();
  const inventory = [];
  const contents = new Map();
  for (const name of files) {
    const bytes = await readFile(path.join(root, name));
    const text = /\.(?:html|js|css|json|xml|txt|php|svg|webmanifest)$/.test(name) || name === '.htaccess' ? bytes.toString('utf8') : '';
    checkSafeFile(name, text);
    contents.set(name, text);
    inventory.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const required = ['index.html', 'contact.html', 'blog.html', 'app-shell.html', 'public-shell.html', '404.html', '.htaccess', 'sitemap.xml'];
  for (const name of required) assert.ok(contents.has(name), `Cible absente : ${name}`);
  const routes = publicRoutes(contents.get('sitemap.xml'));
  for (const route of routes) {
    const name = outputForRoute(route);
    assert.ok(contents.has(name), `Route sans pré-rendu : ${route}`);
    checkPublicHtml(contents.get(name), route);
  }
  for (const name of ['app-shell.html', 'public-shell.html']) {
    const document = new JSDOM(contents.get(name)).window.document;
    assert.equal(document.querySelector('#root')?.innerHTML, '', `Shell contaminé par un pré-rendu : ${name}`);
    assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 0, `Canonical parasite : ${name}`);
    assert.ok(document.querySelector('script[type="module"][src]'), `Script absent : ${name}`);
    if (name === 'app-shell.html') assert.match(document.querySelector('meta[name="robots"]')?.content || '', /noindex/);
  }
  assert.match(contents.get('404.html'), /noindex/);
  assert.match(contents.get('.htaccess'), /ErrorDocument 404 \/404\.html/);
  const apacheTargets = checkApacheTargets(contents.get('.htaccess'), new Set(files));
  let references = 0;
  function checkReference(reference, source) {
    if (/^(?:data:|https?:|#|\/\/)/.test(reference)) return;
    const base = new URL(source, `${canonicalOrigin}/`);
    const relative = decodeURIComponent(new URL(reference, base).pathname.slice(1));
    assert.ok(contents.has(relative), `Asset absent : ${source} → ${relative}`);
    references++;
  }
  for (const [name, text] of contents) {
    if (name.endsWith('.html')) {
      const document = new JSDOM(text).window.document;
      for (const element of document.querySelectorAll('script[src], img[src], link[rel="stylesheet"][href], link[rel="modulepreload"][href], link[rel="icon"][href]')) {
        checkReference(element.getAttribute('src') || element.getAttribute('href'), name);
      }
      for (const match of text.matchAll(/applicationScript\.src = '([^']+)'/g)) checkReference(match[1], name);
    }
    if (name.endsWith('.css')) for (const match of text.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) checkReference(match[1], name);
    if (name.endsWith('.js')) for (const match of text.matchAll(/(?:from\s*|import\s*\()["'](\.\.?\/[^"']+)["']/g)) checkReference(match[1], name);
  }
  for (const name of ['.htaccess', 'sitemap.xml', '404.html']) {
    assert.equal(contents.get(name).replaceAll('\r\n', '\n'), (await readFile(path.resolve('public', name), 'utf8')).replaceAll('\r\n', '\n'), `Copie public/dist différente : ${name}`);
  }
  const report = { gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), routes, apacheTargets, assetReferences: references, files: inventory };
  const reportDirectory = path.resolve('../output/release');
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(path.join(reportDirectory, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Release vérifiée : ${files.length} fichiers, ${routes.length} pré-rendus, ${references} références d'assets. Inventaire : ${reportDirectory}`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await verifyRelease();
