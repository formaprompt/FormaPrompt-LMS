// Local packaging only. Never imports secrets, invokes the CLI or deploys anything.
import { readFile, writeFile, mkdir, realpath, lstat, access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = ['iagPrivateCourseCatalog.js', 'iagPrivateResourceAllowlist.js', 'iagResourceImportReceipt.js'];
export const edgeEntries = Object.freeze(['paid-course-content', 'create-checkout', 'stripe-webhook-ai-act', 'validate-course-promotion', 'admin-grant-course']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (parent, child) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
async function absent(target) { try { await access(target); } catch (e) { if (e.code === 'ENOENT') return; throw e; } throw new Error('Destination already exists.'); }
async function noGitAncestor(target) {
  for (let p = target; ; p = path.dirname(p)) {
    if (await lstat(path.join(p, '.git')).catch(e => { if (e.code === 'ENOENT') return null; throw e; })) throw new Error('Private bundle must remain outside every Git checkout.');
    if (p === path.dirname(p)) return;
  }
}

export async function assemble({ overlay, destination, productionSnapshot, sourceRoot = root }) {
  const repo = await realpath(sourceRoot);
  const privateRoot = await realpath(overlay);
  const parent = await realpath(path.dirname(path.resolve(destination)));
  const dest = path.join(parent, path.basename(destination));
  if (within(repo, dest) || within(repo, privateRoot) || within(privateRoot, dest)) throw new Error('Private overlay and output must remain external and separate.');
  await noGitAncestor(parent);
  await absent(dest);
  const manifest = JSON.parse(await readFile(path.join(privateRoot, 'OVERLAY-MANIFEST.json'), 'utf8'));
  if (manifest.schema !== 'iag-private-overlay-v1' || manifest.status !== 'NOT_IMPORTED' || manifest.files?.length !== 3) throw new Error('Unverified overlay manifest.');
  const overlayBytes = new Map();
  for (const name of names) {
    const row = manifest.files.find(x => x.path === name);
    const file = path.join(privateRoot, name);
    if ((await lstat(file)).isSymbolicLink()) throw new Error('Overlay symlinks forbidden.');
    const bytes = await readFile(file);
    if (!row || bytes.length !== row.bytes || sha(bytes) !== row.sha256) throw new Error('Overlay hash mismatch.');
    overlayBytes.set(name, bytes);
  }
  const receipt = overlayBytes.get('iagResourceImportReceipt.js').toString();
  if (!/status:\s*'NOT_IMPORTED'/.test(receipt) || /status:\s*'VERIFIED_IMPORT'/.test(receipt)) throw new Error('Only the unpromoted receipt belongs in this preparation.');
  if (!productionSnapshot) throw new Error('Production preservation snapshot required.');
  const snapshotBytes = await readFile(productionSnapshot);
  const snapshot = JSON.parse(snapshotBytes);
  const productionConfig = snapshot.files?.filter(x => x.name === 'functions/_shared/purchaseConfig.js');
  if (snapshot.slug !== 'create-checkout' || productionConfig?.length !== 1) throw new Error('Production source identity mismatch.');
  const messagePattern = /groupOpeningMessage:\s*'[^']*'/g;
  const productionMessages = productionConfig[0].content.match(messagePattern);
  if (productionMessages?.length !== 1) throw new Error('Production preservation field missing or ambiguous.');
  // Build only the five explicit function entrypoints and their local static imports.
  const functions = path.join(repo, 'supabase/functions');
  const pending = edgeEntries.map(name => `${name}/index.ts`);
  const files = new Map();
  while (pending.length) {
    const relative = pending.pop();
    if (files.has(relative)) continue;
    const src = path.resolve(functions, relative);
    if (!within(functions, src) || !within(functions, await realpath(src)) || (await lstat(src)).isSymbolicLink()) throw new Error('Function import escaped its source tree.');
    let bytes = overlayBytes.get(relative.startsWith('_shared/') ? relative.slice(8) : '') ?? await readFile(src);
    if (relative === '_shared/purchaseConfig.js') {
      const text = bytes.toString();
      if (text.match(messagePattern)?.length !== 1) throw new Error('Local preservation field missing or ambiguous.');
      bytes = Buffer.from(text.replace(messagePattern, () => productionMessages[0]));
    }
    files.set(relative, bytes);
    for (const m of bytes.toString().matchAll(/(?:from\s*|import\s*\(?)['"](\.[^'"]+)['"]/g)) {
      pending.push(path.posix.normalize(path.posix.join(path.posix.dirname(relative), m[1])));
    }
  }
  if (!names.every(name => files.has(`_shared/${name}`))) throw new Error('Private overlay is not part of the bundle.');
  await mkdir(dest, { mode: 0o700 });
  const rows = [];
  for (const [relative, bytes] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const target = path.join(dest, 'supabase/functions', relative);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
    rows.push({ path: `supabase/functions/${relative}`, bytes: bytes.length, sha256: sha(bytes) });
  }
  // Deployment configuration and environment selection stay with the coordinator.
  const report = { schema: 'iag-private-edge-bundle-v1', entries: edgeEntries, receipt: 'NOT_IMPORTED', deploymentPerformed: false, mediaReviewRequired: true,
    productionPreservation: { field: 'groupOpeningMessage', sourceSlug: snapshot.slug, sourceVersion: snapshot.version, snapshotSha256: sha(snapshotBytes), productionFieldSha256: sha(productionMessages[0]), checkoutUnchanged: true }, files: rows };
  await writeFile(path.join(dest, 'BUNDLE-MANIFEST.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [overlay, destination, productionSnapshot] = process.argv.slice(2);
  if (!overlay || !destination || !productionSnapshot) throw new Error('Usage: node scripts/iag-edge-private-bundle.mjs <private-overlay> <external-new-output> <readonly-create-checkout-snapshot.json>');
  const report = await assemble({ overlay, destination, productionSnapshot });
  console.log(JSON.stringify({ status: 'PREPARED_NOT_DEPLOYED', files: report.files.length, receipt: report.receipt }));
}
