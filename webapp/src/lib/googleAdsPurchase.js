import { getAdvertisingConsent, subscribeAdvertisingConsent } from './advertisingConsent.js';

const TAG_ID = 'AW-18489285500';
const SEND_TO = `${TAG_ID}/WOz2COeP5I0dEPy2sPBE`;
const SENT_KEY = 'formaprompt_ads_sent_v1';
const RETENTION_MS = 150 * 86400 * 1000;
const MAX_TRANSACTIONS = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' };

// Omit all query parameters (including click IDs), hashes and private route identifiers.
export function sanitizeAdvertisingUrl(value, origin) {
  try {
    const url = new URL(value, origin);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    return `${url.origin}/`;
  } catch { return ''; }
}

export function createGoogleAdsPurchase({ window: win, document: doc, env = {},
  getConsent = () => 'unknown', subscribeConsent = () => () => {}, loadScript,
  storage: providedStorage, timeoutMs = 8000, now = () => Date.now(),
  reload = () => win?.location?.reload() } = {}) {
  let storage;
  try { storage = providedStorage || win?.localStorage; } catch { /* Blocked browser storage. */ }
  let loading;
  let loaded = false;
  let ready = false;
  let revision = 0;
  let attempted = false;
  let withdrawalReloaded = false;
  const inflight = new Map();
  const sent = new Set();
  const enabled = () => Boolean(env.PROD && env.VITE_GOOGLE_ADS_PURCHASE_ENABLED === 'true'
    && ['formaprompt.com', 'www.formaprompt.com'].includes(win?.location?.hostname));
  const command = (...args) => win.gtag(...args);
  const page = () => ({ page_title: 'FormaPrompt', page_location: sanitizeAdvertisingUrl(win?.location?.href),
    page_referrer: sanitizeAdvertisingUrl(doc?.referrer, win?.location?.origin) });
  subscribeConsent((choice) => {
    revision += 1;
    if (choice !== 'granted' && attempted && !withdrawalReloaded) {
      withdrawalReloaded = true;
      // A fresh page with the persisted refusal unloads the third-party tag completely.
      // Do not send a denied consent update, which could create a cookieless ping.
      try { reload(); } catch { /* Sending remains blocked locally even if reload is unavailable. */ }
    }
  });
  const defaultLoad = () => new Promise((resolve, reject) => {
    const existing = doc.querySelector(`script[src*="googletagmanager.com/gtag/js"]`);
    if (existing) {
      if (existing.dataset?.formapromptLoaded === 'true' || win.google_tag_manager?.[TAG_ID]) resolve();
      else {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
      }
      return;
    }
    const script = doc.createElement('script');
    script.id = 'formaprompt-google-ads';
    script.async = true;
    script.referrerPolicy = 'origin';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${TAG_ID}`;
    script.onload = () => { script.dataset.formapromptLoaded = 'true'; resolve(); };
    script.onerror = reject;
    doc.head.appendChild(script);
  });
  function configure() {
    if (win.__formapromptGoogleAdsConfigured) { ready = true; return; }
    command('consent', 'update', { ...DENIED, ad_storage: 'granted', ad_user_data: 'granted' });
    command('js', new Date());
    command('config', TAG_ID, { ...page(), send_page_view: false,
      allow_google_signals: false, allow_ad_personalization_signals: false, allow_interest_groups: false });
    ready = true;
    win.__formapromptGoogleAdsConfigured = true;
  }
  async function init() {
    try {
      if (!enabled()) return { status: 'disabled' };
      if (getConsent() !== 'granted') return { status: 'denied' };
      if (!doc || !win) return { status: 'unavailable' };
      if (withdrawalReloaded) return { status: 'denied' };
      if (ready) return { status: 'ready' };
      if (win.__formapromptGoogleAdsConfigured) { ready = true; attempted = true; return { status: 'ready' }; }
      if (loaded) { configure(); return { status: 'ready' }; }
      if (!loading) {
        const startRevision = revision;
        win.dataLayer = win.dataLayer || [];
        win.gtag = win.gtag || function () { win.dataLayer.push(arguments); };
        command('consent', 'default', DENIED);
        command('set', 'ads_data_redaction', true);
        command('set', 'url_passthrough', false);
        command('set', page());
        attempted = true;
        loading = (async () => {
          let timer;
          try {
            await Promise.race([(loadScript || defaultLoad)(), new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('Tag unavailable')), timeoutMs);
            })]);
            loaded = true;
            if (getConsent() !== 'granted' || revision !== startRevision) return { status: 'denied' };
            configure();
            return { status: 'ready' };
          } catch { return { status: 'unavailable' }; }
          finally { clearTimeout(timer); }
        })();
      }
      return loading;
    } catch { return { status: 'unavailable' }; }
  }
  function registry() {
    if (!storage?.getItem || !storage?.setItem) throw new Error('Registry unavailable');
    const entries = JSON.parse(storage.getItem(SENT_KEY) || '[]');
    if (!Array.isArray(entries) || entries.some((entry) => !UUID.test(entry?.id || '') || !Number.isFinite(entry?.at))) {
      throw new Error('Invalid registry');
    }
    const current = entries.filter((entry) => entry.at > now() - RETENTION_MS && entry.at <= now()).slice(-MAX_TRANSACTIONS);
    if (current.length !== entries.length) storage.setItem(SENT_KEY, JSON.stringify(current));
    return current;
  }
  function previouslySent(id) {
    return sent.has(id) || registry().some((entry) => entry.id === id);
  }
  async function send(receipt) {
    if (!enabled()) return { status: 'disabled' };
    if (getConsent() !== 'granted') return { status: 'denied' };
    if (receipt?.verified !== true || receipt?.livemode !== true || !UUID.test(receipt?.transaction_id || '')
      || !Number.isSafeInteger(receipt?.amount_total_cents) || receipt.amount_total_cents <= 0
      || !/^[a-z]{3}$/i.test(receipt?.currency || '')) return { status: 'ineligible' };
    const id = receipt.transaction_id;
    try { if (previouslySent(id)) return { status: 'duplicate' }; }
    catch { return { status: 'unavailable' }; }
    if (inflight.has(id)) return inflight.get(id);
    const operation = (async () => {
      const startRevision = revision;
      const result = await init();
      if (result.status !== 'ready') return result;
      if (getConsent() !== 'granted' || revision !== startRevision) return { status: 'denied' };
      try {
        if (previouslySent(id)) return { status: 'duplicate' };
        const entries = registry();
        storage.setItem(SENT_KEY, JSON.stringify([...entries, { id, at: now() }].slice(-MAX_TRANSACTIONS)));
        try {
          command('event', 'conversion', { send_to: SEND_TO, value: receipt.amount_total_cents / 100,
            currency: receipt.currency.toUpperCase(), transaction_id: id, ...page() });
        } catch {
          storage.setItem(SENT_KEY, JSON.stringify(entries));
          return { status: 'unavailable' };
        }
        sent.add(id);
        if (sent.size > MAX_TRANSACTIONS) sent.delete(sent.values().next().value);
        return { status: 'sent' };
      } catch { return { status: 'unavailable' }; }
    })();
    inflight.set(id, operation);
    try { return await operation; } finally { inflight.delete(id); }
  }
  return { initGoogleAds: init, sendGoogleAdsPurchase: send, isGoogleAdsPurchaseEnabled: enabled };
}

const ads = createGoogleAdsPurchase({
  window: typeof window === 'undefined' ? undefined : window,
  document: typeof document === 'undefined' ? undefined : document,
  env: import.meta.env || {}, getConsent: getAdvertisingConsent, subscribeConsent: subscribeAdvertisingConsent,
});
export const { initGoogleAds, sendGoogleAdsPurchase, isGoogleAdsPurchaseEnabled } = ads;
