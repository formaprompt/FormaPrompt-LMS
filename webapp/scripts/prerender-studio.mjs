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
      'https://formaprompt.com/studio/',
      'https://formaprompt.com/assets/logo-new.png',
    ],
  },
  {
    name: 'Article générateurs de prompts 2026',
    url: `http://${host}:${port}/blog/meilleur-generateur-prompts-comparatif-2026`,
    outputPath: path.resolve('dist', 'blog', 'meilleur-generateur-prompts-comparatif-2026.html'),
    heading: /quel est le meilleur générateur de prompts en 2026/i,
    markers: [
      'meilleur générateur de prompts en 2026 : comparatif',
      'https://formaprompt.com/blog/meilleur-generateur-prompts-comparatif-2026',
      'https://schema.org',
      'comparatif des générateurs de prompts en 2026',
    ],
  },
  {
    name: 'Formation IA générative',
    url: `http://${host}:${port}/formation-ia-generative`,
    outputPath: path.resolve('dist', 'formation-ia-generative', 'index.html'),
    heading: /ia générative : comprendre, pratiquer et sécuriser ses usages/i,
    markers: [
      'formation ia générative de 10 heures',
      '10 heures accompagnées',
      'https://formaprompt.com/formation-ia-generative',
    ],
  },
  {
    name: 'Formation Prompt Engineering',
    url: `http://${host}:${port}/formation-prompt-engineering`,
    outputPath: path.resolve('dist', 'formation-prompt-engineering', 'index.html'),
    heading: /formation prompt engineering.*niveau 1/i,
    markers: [
      'formation prompt engineering',
      '7 heures accompagnées',
      'https://formaprompt.com/formation-prompt-engineering',
    ],
  },
  {
    name: 'Formation AI Act',
    url: `http://${host}:${port}/formation-ia-act-conformite`,
    outputPath: path.resolve('dist', 'formation-ia-act-conformite', 'index.html'),
    heading: /ia : acculturation et préparation à la conformité ai act/i,
    markers: [
      'formation ai act',
      '4 h 45 estimées',
      'https://formaprompt.com/formation-ia-act-conformite',
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
