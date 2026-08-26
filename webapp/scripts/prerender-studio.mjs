import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const host = '127.0.0.1';
const port = 4175;
const canonicalOrigin = 'https://formaprompt.com';

const publicPages = [
  { name: 'Studio', route: '/studio/', canonical: `${canonicalOrigin}/studio/` },
  { name: 'Formation IA générative', route: '/formation-ia-generative' },
  { name: 'Formation IA Act', route: '/formation-ia-act-conformite' },
  { name: 'Formation Prompt Engineering', route: '/formation-prompt-engineering' },
  { name: 'Formation bureautique', route: '/formation-bureautique' },
  { name: 'Formation organismes', route: '/formation-organismes' },
  { name: 'Diagnostic IA Express', route: '/diagnostic-ia' },
  { name: 'À propos', route: '/a-propos' },
  { name: 'Blog', route: '/blog' },
  { name: 'Article générateurs de prompts 2026', route: '/blog/meilleur-generateur-prompts-comparatif-2026' },
  { name: 'Contact', route: '/contact' },
  { name: 'Disponibilités', route: '/disponibilites' },
  { name: 'FAQ', route: '/faq' },
  { name: 'Guide GPT-5.6', route: '/guide-gpt-5-6-codex' },
  { name: 'Mentions légales', route: '/mentions-legales' },
  { name: 'Conditions générales de vente', route: '/cgv' },
  { name: 'CGV particuliers', route: '/cgv-particuliers' },
  { name: 'CGV professionnels', route: '/cgv-professionnels' },
  { name: 'Politique de confidentialité', route: '/politique-confidentialite' },
  { name: 'Règlement intérieur', route: '/reglement-interieur' },
  { name: 'Informations précontractuelles', route: '/informations-precontractuelles' },
  // L'accueil est écrit en dernier car Vite l'utilise comme fallback pendant le pré-rendu.
  { name: 'Accueil', route: '/', canonical: `${canonicalOrigin}/` },
].map((page) => ({
  ...page,
  canonical: page.canonical ?? `${canonicalOrigin}${page.route}`,
}));

function outputPathFor(route) {
  if (route === '/') return path.resolve('dist', 'index.html');
  if (route === '/studio/') return path.resolve('dist', 'studio', 'index.html');
  return path.resolve('dist', `${route.slice(1)}.html`);
}

function delayApplicationScript(html, pageName) {
  const applicationScript = html.match(
    /<script type="module" crossorigin(?:="")? src="([^"]+)"><\/script>/,
  );

  if (!applicationScript) {
    throw new Error(`Le script principal de l'application est introuvable dans le pré-rendu ${pageName}.`);
  }

  const applicationScriptUrl = applicationScript[1];
  const delayedApplicationScript = `<script>
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const applicationScript = document.createElement('script');
      applicationScript.type = 'module';
      applicationScript.src = '${applicationScriptUrl}';
      document.head.appendChild(applicationScript);
    }));
  </script>`;

  return html.replace(applicationScript[0], delayedApplicationScript);
}

const server = await preview({
  logLevel: 'error',
  preview: { host, port, strictPort: true },
});

let browser;

try {
  const initialShellPath = path.resolve('dist', 'index.html');
  const initialShell = await readFile(initialShellPath, 'utf8');
  await writeFile(path.resolve('dist', 'public-shell.html'), initialShell, 'utf8');
  const privateAppShell = initialShell
    .replace('<title>FormaPrompt</title>', '<title>Espace sécurisé – FormaPrompt</title>')
    .replace('</head>', '  <meta name="robots" content="noindex, nofollow">\n  </head>');
  await writeFile(path.resolve('dist', 'app-shell.html'), privateAppShell, 'utf8');

  browser = await chromium.launch({ channel: 'chrome', headless: true });

  for (const pageConfig of publicPages) {
    const page = await browser.newPage();
    await page.goto(`http://${host}:${port}${pageConfig.route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      (expectedCanonical) => document.querySelector('link[rel="canonical"]')?.href === expectedCanonical,
      pageConfig.canonical,
    );
    await page.locator('h1').first().waitFor({ state: 'visible' });

    const metadata = await page.evaluate(() => ({
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      description: document.querySelector('meta[name="description"]')?.content,
      robots: document.querySelector('meta[name="robots"]')?.content,
      title: document.title,
    }));

    if (metadata.canonical !== pageConfig.canonical) {
      throw new Error(`Canonical incorrecte pour ${pageConfig.name} : ${metadata.canonical ?? 'absente'}.`);
    }
    if (!metadata.title || metadata.title === 'FormaPrompt' || !metadata.description) {
      throw new Error(`Métadonnées incomplètes pour ${pageConfig.name}.`);
    }
    if (metadata.robots?.includes('noindex')) {
      throw new Error(`La page publique ${pageConfig.name} ne doit pas être en noindex.`);
    }

    const renderedHtml = await page.content();
    let serializedHtml = renderedHtml.trimStart().toLowerCase().startsWith('<!doctype')
      ? renderedHtml
      : `<!doctype html>\n${renderedHtml}`;

    serializedHtml = delayApplicationScript(serializedHtml, pageConfig.name)
      .replace('<title>FormaPrompt</title>', '')
      .replace(/<link rel="canonical"\s*\/?>\s*/g, '')
      .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '');

    const outputPath = outputPathFor(pageConfig.route);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serializedHtml, 'utf8');
    console.log(`Pré-rendu créé : ${pageConfig.name} -> ${outputPath}`);
    await page.close();
  }
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => (error ? reject(error) : resolve()));
  });
}
