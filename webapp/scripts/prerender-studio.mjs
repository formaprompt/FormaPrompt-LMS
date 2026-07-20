import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const host = '127.0.0.1';
const port = 4175;
const pages = [
  {
    name: 'Studio',
    url: `http://${host}:${port}/studio`,
    outputPath: path.resolve('dist', 'studio', 'index.html'),
    heading: /construisez un prompt clair/i,
    markers: [
      'formaprompt studio',
      'méthode crop',
      'application/ld+json',
      'courriel professionnel',
    ],
  },
  {
    name: 'Article générateurs de prompts 2026',
    url: `http://${host}:${port}/blog/meilleur-generateur-prompts-comparatif-2026`,
    outputPath: path.resolve('dist', 'blog', 'meilleur-generateur-prompts-comparatif-2026.html'),
    heading: /quel est le meilleur générateur de prompts en 2026/i,
    markers: [
      'meilleur générateur de prompts en 2026 : comparatif',
      'https://www.formaprompt.com/blog/meilleur-generateur-prompts-comparatif-2026',
      'https://schema.org',
      'comparatif des générateurs de prompts en 2026',
    ],
  },
  {
    name: 'Accueil',
    url: `http://${host}:${port}/`,
    outputPath: path.resolve('dist', 'index.html'),
    heading: /formations en ia, prompt engineering et bureautique/i,
    markers: [
      'formaprompt studio',
      'educationalorganization',
      'webapplication',
      'https://formaprompt.com/',
    ],
  },
];

const server = await preview({
  logLevel: 'error',
  preview: { host, port, strictPort: true },
});

let browser;

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const pageConfig of pages) {
    const page = await browser.newPage();
    await page.goto(pageConfig.url, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: pageConfig.heading }).waitFor();
    await page.waitForFunction(() => Boolean(document.querySelector('link[rel="canonical"]')));

    const html = await page.content();
    const normalizedHtml = html.toLocaleLowerCase('fr');

    for (const marker of pageConfig.markers) {
      if (!normalizedHtml.includes(marker)) {
        throw new Error(`Le pré-rendu ${pageConfig.name} ne contient pas le marqueur attendu : ${marker}`);
      }
    }

    let serializedHtml = html.trimStart().toLowerCase().startsWith('<!doctype')
      ? html
      : `<!doctype html>\n${html}`;

    const applicationScript = serializedHtml.match(
      /<script type="module" crossorigin="" src="([^"]+)"><\/script>/,
    );

    if (!applicationScript) {
      throw new Error(`Le script principal de l'application est introuvable dans le pré-rendu ${pageConfig.name}.`);
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

    serializedHtml = serializedHtml
      .replace(applicationScript[0], delayedApplicationScript)
      .replace('<title>FormaPrompt</title>', '')
      .replace(/<link rel="canonical"\s*\/?>\s*/g, '')
      .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '');

    await mkdir(path.dirname(pageConfig.outputPath), { recursive: true });
    await writeFile(pageConfig.outputPath, serializedHtml, 'utf8');
    console.log(`Pré-rendu ${pageConfig.name} créé : ${pageConfig.outputPath}`);
    await page.close();
  }
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => (error ? reject(error) : resolve()));
  });
}
