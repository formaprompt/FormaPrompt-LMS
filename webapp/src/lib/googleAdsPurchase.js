import { getAdvertisingConsent, subscribeAdvertisingConsent } from './advertisingConsent.js';

export const ADS_CONFIRMATION_PATH = '/ads-purchase-confirmation.html';
export const ADS_CONFIRMATION_VERSION = 'formaprompt-ads-confirmation-v1';
export const ADS_PENDING_KEY = 'formaprompt_ads_pending_v1';
export const ADS_ATTEMPT_KEY = 'formaprompt_ads_attempt_v1';
export const ADS_SENT_KEY = 'formaprompt_ads_sent_v1';
export const ADS_CLICK_KEY = 'formaprompt_ads_click_v1';
const CLICK_REVOKED_KEY = 'formaprompt_ads_click_revoked_v1';
const RETENTION_MS = 150 * 86400000;
const CLICK_RETENTION_MS = 30 * 86400000;
const HANDOFF_MS = 60000;
const MAX_TRANSACTIONS = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLICK_NAMES = ['gclid', 'gbraid', 'wbraid'];
const validClick = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{10,256}$/.test(value);

// No Google SDK or commands in the LMS. Only the independent document loads Google.
export function createGoogleAdsPurchase({ window: win, document: doc, env = {},
  getConsent = () => 'unknown', subscribeConsent = () => () => {},
  storage: providedStorage, sessionStorage: providedSessionStorage,
  fetch: providedFetch, navigate, timeoutMs = 5000, now = () => Date.now() } = {}) {
  let storage;
  let session;
  try { storage = providedStorage || win?.localStorage; } catch { /* Fail closed below. */ }
  try { session = providedSessionStorage || win?.sessionStorage; } catch { /* Fail closed below. */ }
  const fetchDocument = providedFetch || win?.fetch?.bind(win);
  let revision = 0;
  let withdrawn = getConsent() === 'denied';
  const inflight = new Map();
  const enabled = () => Boolean(env.PROD && env.VITE_GOOGLE_ADS_PURCHASE_ENABLED === 'true'
    && win?.location?.origin === 'https://formaprompt.com');
  function clearClick() {
    withdrawn = true;
    try { storage?.removeItem(ADS_CLICK_KEY); } catch { /* Refusal still blocks handoff. */ }
    try { session?.removeItem(ADS_PENDING_KEY); session?.setItem(CLICK_REVOKED_KEY, 'true'); }
    catch { /* No Google code exists in this document. */ }
  }
  subscribeConsent((choice) => { revision += 1; if (choice !== 'granted') clearClick(); });
  function captureClick() {
    if (withdrawn || session?.getItem(CLICK_REVOKED_KEY) === 'true') return;
    const url = new URL(win.location.href);
    for (const name of CLICK_NAMES) {
      const values = url.searchParams.getAll(name);
      if (values.length === 1 && validClick(values[0])) {
        const existing = readClick();
        if (existing?.name === name && existing.value === values[0]) return;
        storage.setItem(ADS_CLICK_KEY, JSON.stringify({ version: 1, name, value: values[0], expires: now() + CLICK_RETENTION_MS }));
        return;
      }
    }
    readClick();
  }
  function readClick() {
    if (withdrawn || session?.getItem(CLICK_REVOKED_KEY) === 'true') return undefined;
    const raw = storage.getItem(ADS_CLICK_KEY);
    if (!raw) return undefined;
    try {
      const click = JSON.parse(raw);
      if (Object.keys(click).sort().join(',') === 'expires,name,value,version' && click.version === 1
        && CLICK_NAMES.includes(click.name) && validClick(click.value) && Number.isFinite(click.expires)
        && click.expires > now() && click.expires <= now() + CLICK_RETENTION_MS) return click;
    } catch { /* Expired or invalid attribution is ignored. */ }
    storage.removeItem(ADS_CLICK_KEY);
    return undefined;
  }
  async function init() {
    if (!enabled()) return { status: 'disabled' };
    if (getConsent() !== 'granted') {
      if (getConsent() === 'denied') clearClick();
      return { status: 'denied' };
    }
    try { captureClick(); return { status: 'dormant' }; }
    catch { return { status: 'unavailable' }; }
  }
  function registry(key) {
    const entries = JSON.parse(storage.getItem(key) || '[]');
    if (!Array.isArray(entries) || entries.some((entry) => !UUID.test(entry?.id || '') || !Number.isFinite(entry?.at))) throw new Error('Invalid advertising registry');
    return entries.filter((entry) => entry.at > now() - RETENTION_MS && entry.at <= now()).slice(-MAX_TRANSACTIONS);
  }
  const duplicate = (id) => [ADS_SENT_KEY, ADS_ATTEMPT_KEY].some((key) => registry(key).some((entry) => entry.id === id));
  async function preflight() {
    if (!fetchDocument) return false;
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchDocument(ADS_CONFIRMATION_PATH, { method: 'GET', cache: 'no-store', credentials: 'omit',
            referrerPolicy: 'no-referrer', redirect: 'error', signal: controller.signal });
          return response.ok && /\btext\/html\b/i.test(response.headers.get('content-type') || '')
            && (await response.text()).includes(`<meta name="formaprompt-ads-confirmation" content="${ADS_CONFIRMATION_VERSION}">`);
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Confirmation unavailable')); }, timeoutMs); }),
      ]);
    } catch { return false; }
    finally { clearTimeout(timer); }
  }
  function openConfirmation(url) {
    const meta = doc.createElement('meta');
    meta.name = 'referrer'; meta.content = 'no-referrer';
    doc.head.appendChild(meta);
    if (navigate) { navigate(url); return; }
    const link = doc.createElement('a');
    link.href = url; link.target = '_self'; link.rel = 'noreferrer'; link.referrerPolicy = 'no-referrer'; link.hidden = true;
    doc.body.appendChild(link); link.click(); link.remove();
  }
  async function send(receipt) {
    if (!enabled()) return { status: 'disabled' };
    if (getConsent() !== 'granted') return { status: 'denied' };
    if (receipt?.verified !== true || receipt?.livemode !== true || !UUID.test(receipt?.transaction_id || '')
      || !Number.isSafeInteger(receipt?.amount_total_cents) || receipt.amount_total_cents <= 0
      || !/^[a-z]{3}$/i.test(receipt?.currency || '')) return { status: 'ineligible' };
    const id = receipt.transaction_id;
    if (inflight.has(id)) return inflight.get(id);
    const operation = (async () => {
      const startRevision = revision;
      const startLocation = win.location.href;
      try {
        if (!doc || !session?.setItem || !session?.removeItem || !storage?.setItem || !storage?.getItem) return { status: 'unavailable' };
        if (duplicate(id)) return { status: 'duplicate' };
        if (!await preflight()) return { status: 'unavailable' };
        if (getConsent() !== 'granted' || revision !== startRevision) return { status: 'denied' };
        // This value stays in memory only: never interrupt an intervening learner navigation.
        if (win.location.href !== startLocation) return { status: 'cancelled' };
        if (duplicate(id)) return { status: 'duplicate' };
        const click = readClick();
        const url = new URL(ADS_CONFIRMATION_PATH, win.location.origin);
        if (click) url.searchParams.set(click.name, click.value);
        const at = now();
        const pending = { version: 1, transaction_id: id, amount_total_cents: receipt.amount_total_cents,
          currency: receipt.currency.toUpperCase(), expires: at + HANDOFF_MS };
        // One attempt per UUID prevents redirect loops after script/SDK errors or reloads.
        storage.setItem(ADS_ATTEMPT_KEY, JSON.stringify([...registry(ADS_ATTEMPT_KEY), { id, at }].slice(-MAX_TRANSACTIONS)));
        session.setItem(ADS_PENDING_KEY, JSON.stringify(pending));
        openConfirmation(url.href);
        return { status: 'handoff' };
      } catch {
        try { session?.removeItem(ADS_PENDING_KEY); } catch { /* Expiry invalidates incomplete handoff. */ }
        return { status: 'unavailable' };
      }
    })();
    inflight.set(id, operation);
    try { return await operation; } finally { inflight.delete(id); }
  }
  return { initGoogleAds: init, sendGoogleAdsPurchase: send, isGoogleAdsPurchaseEnabled: enabled };
}

const ads = createGoogleAdsPurchase({ window: typeof window === 'undefined' ? undefined : window,
  document: typeof document === 'undefined' ? undefined : document, env: import.meta.env || {},
  getConsent: getAdvertisingConsent, subscribeConsent: subscribeAdvertisingConsent });
export const { initGoogleAds, sendGoogleAdsPurchase, isGoogleAdsPurchaseEnabled } = ads;
