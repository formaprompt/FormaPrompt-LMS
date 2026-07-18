import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const host = '127.0.0.1';
const port = 4175;
const studioUrl = `http://${host}:${port}/studio`;
const outputPath = path.resolve('dist', 'studio', 'index.html');

const server = await preview({
  logLevel: 'error',
  preview: { host, port, strictPort: true },
});

let browser;

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.goto(studioUrl, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1, name: /construisez un prompt clair/i }).waitFor();

  const html = await page.content();
  const normalizedHtml = html.toLocaleLowerCase('fr');
  const requiredMarkers = [
    'formaprompt studio',
    'méthode crop',
    'application/ld+json',
    'courriel professionnel',
  ];

  for (const marker of requiredMarkers) {
    if (!normalizedHtml.includes(marker)) {
      throw new Error(`Le pré-rendu Studio ne contient pas le marqueur attendu : ${marker}`);
    }
  }

  let serializedHtml = html.trimStart().toLowerCase().startsWith('<!doctype')
    ? html
    : `<!doctype html>\n${html}`;

  const applicationScript = serializedHtml.match(
    /<script type="module" crossorigin="" src="([^"]+)"><\/script>/,
  );

  if (!applicationScript) {
    throw new Error("Le script principal de l'application est introuvable dans le pré-rendu Studio.");
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
    .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '');

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializedHtml, 'utf8');
  console.log(`Pré-rendu Studio créé : ${outputPath}`);
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => (error ? reject(error) : resolve()));
  });
}
