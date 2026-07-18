import { launch } from 'chrome-launcher';
import { mkdir, writeFile } from 'node:fs/promises';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { preview } from 'vite';

const host = '127.0.0.1';
const port = 4176;
const studioUrl = `http://${host}:${port}/studio/`;
const minimumScore = 0.95;
const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
const auditFailures = [];

const server = await preview({
  logLevel: 'error',
  preview: { host, port, strictPort: true },
});

const chrome = await launch({
  chromeFlags: ['--headless', '--disable-gpu', '--no-first-run'],
});

async function runAudit(label, config) {
  const result = await lighthouse(
    studioUrl,
    {
      port: chrome.port,
      logLevel: 'error',
      output: 'json',
      onlyCategories: categories,
    },
    config,
  );

  if (!result) {
    throw new Error(`Lighthouse n'a produit aucun résultat pour ${label}.`);
  }

  await mkdir('.lighthouse', { recursive: true });
  await writeFile(`.lighthouse/studio-${label.toLocaleLowerCase('fr')}.json`, result.report, 'utf8');

  const scores = Object.fromEntries(
    categories.map((category) => [category, result.lhr.categories[category].score]),
  );

  console.log(`${label} : ${categories.map((category) => `${category} ${Math.round(scores[category] * 100)}`).join(' | ')}`);

  const metricIds = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
  ];
  console.log(
    `${label} — métriques : ${metricIds.map((id) => `${result.lhr.audits[id].title} ${result.lhr.audits[id].displayValue}`).join(' | ')}`,
  );

  const opportunities = Object.values(result.lhr.audits)
    .filter((audit) => audit.details?.type === 'opportunity' && audit.score !== null && audit.score < 1)
    .sort((first, second) => (second.details?.overallSavingsMs ?? 0) - (first.details?.overallSavingsMs ?? 0))
    .slice(0, 5);
  for (const opportunity of opportunities) {
    console.log(`${label} — piste : ${opportunity.title} (${opportunity.displayValue ?? 'à contrôler'})`);
  }

  const insufficient = categories.filter((category) => scores[category] < minimumScore);
  if (insufficient.length > 0) {
    auditFailures.push(`${label} : ${insufficient.join(', ')}`);
  }
}

try {
  await runAudit('Mobile');
  await runAudit('Ordinateur', desktopConfig);

  if (auditFailures.length > 0) {
    throw new Error(`Score inférieur à 95 — ${auditFailures.join(' ; ')}.`);
  }
} finally {
  try {
    await chrome.kill();
  } catch (error) {
    console.warn(`Chrome a été arrêté, mais son dossier temporaire n'a pas pu être supprimé : ${error.code ?? error.message}`);
  }
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => (error ? reject(error) : resolve()));
  });
}
