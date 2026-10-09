import { getAudienceConsent, subscribeAudienceConsent, clearAudienceCookies } from './audienceConsent.js';

const ORIGIN = 'https://formaprompt.com';
const PUBLIC_PAGES = new Map(Object.entries({
  '/': 'FormaPrompt — Formations professionnelles',
  '/formation-ia-generative': 'Formation IA générative — FormaPrompt',
  '/formation-ia-act-conformite': 'Formation AI Act — FormaPrompt',
  '/formation-prompt-engineering': 'Formation Prompt Engineering — FormaPrompt',
  '/formation-agents-ia-workflows': 'Formation agents IA et workflows — FormaPrompt',
  '/formation-ia-creativite': 'Formation IA et créativité — FormaPrompt',
  '/formation-bureautique': 'Formation bureautique — FormaPrompt',
  '/formation-excel': 'Formation Excel — FormaPrompt',
  '/formation-word': 'Formation Word — FormaPrompt',
  '/formation-powerpoint': 'Formation PowerPoint — FormaPrompt',
  '/formation-organismes': 'Formations pour organismes — FormaPrompt',
  '/diagnostic-ia': 'Diagnostic IA — FormaPrompt',
  '/a-propos': 'À propos — FormaPrompt',
  '/blog': 'Blog — FormaPrompt',
  '/guides': 'Guides — FormaPrompt',
  '/guide-gpt-5-6-codex': 'Guide GPT et Codex — FormaPrompt',
  '/guide-gpt-6-codex': 'Guide GPT et Codex — FormaPrompt',
  '/contact': 'Contact — FormaPrompt',
  '/mentions-legales': 'Mentions légales — FormaPrompt',
  '/privacy': 'Confidentialité — FormaPrompt',
  '/politique-confidentialite': 'Confidentialité — FormaPrompt',
  '/cgv': 'Conditions générales de vente — FormaPrompt',
  '/cgv-particuliers': 'Conditions générales particuliers — FormaPrompt',
  '/cgv-professionnels': 'Conditions générales professionnels — FormaPrompt',
  '/reglement-interieur': 'Règlement intérieur — FormaPrompt',
  '/informations-precontractuelles': 'Informations précontractuelles — FormaPrompt',
  '/faq': 'Questions fréquentes — FormaPrompt',
}));

export function getPublicAnalyticsPage(pathname) {
  // Exact matching deliberately excludes unknown slugs, identifiers and encoded paths.
  const title = PUBLIC_PAGES.get(pathname);
  return title ? { path: pathname, title, url: `${ORIGIN}${pathname}` } : null;
}

export function createGoogleAnalytics({ window: win, document: doc, env = {},
  getConsent = () => 'unknown', subscribeConsent = () => () => {},
  getAuthState = () => ({ loading: true, user: null }), clearCookies = () => {} } = {}) {
  const id = env.VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID;
  const enabled = () => env.PROD === true && env.VITE_GOOGLE_ANALYTICS_ENABLED === 'true'
    && env.VITE_GOOGLE_ANALYTICS_PRIVACY_REVIEWED === 'true'
    && /^G-[A-Z0-9]+$/.test(id || '') && win?.location?.origin === ORIGIN;
  let current = null;
  let inserted = false;
  let ready = false;
  let stopped = false;
  let configured = false;
  let lastView = null;
  let script;
  function eligible() {
    try {
      const auth = getAuthState();
      return enabled() && !stopped && current?.page && getConsent() === 'granted'
        && auth?.loading === false && !auth.user && !win.location.search && !win.location.hash
        && !hasStoredSession();
    } catch { return false; }
  }
  function hasStoredSession() {
    // A same-origin SDK could read persisted authentication data, even on public pages.
    for (const storage of [win.localStorage, win.sessionStorage]) {
      if (!storage) continue;
      for (let index = 0; index < storage.length; index += 1) {
        if (/^sb-.*-auth-token(?:\.|$)/.test(storage.key(index) || '')) return true;
      }
    }
    return false;
  }
  function stopAudienceMeasurement() {
    stopped = true;
    if (win && /^G-[A-Z0-9]+$/.test(id || '')) win[`ga-disable-${id}`] = true;
    if (script) { script.onload = null; script.onerror = null; }
    // Removing a script cannot unload an SDK. The route boundary replaces the document.
    try { clearCookies(); } catch { /* Blocking emissions does not depend on cleanup. */ }
  }
  function command() { win.formapromptAudienceLayer.push(arguments); }
  function sendCurrentPage() {
    if (!ready || !eligible()) return;
    const { page, key } = current;
    if (lastView === key) return;
    if (!configured) {
      command('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied' });
      command('js', new Date());
      // Enhanced measurement (including history, clicks and downloads) MUST also be
      // disabled in the GA4 stream before the environment flag can be enabled.
      command('config', id, { send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, cookie_expires: 0, cookie_update: false,
        cookie_flags: 'SameSite=Lax;Secure',
        page_location: page.url, page_title: page.title, page_referrer: '' });
      configured = true;
    }
    command('event', 'page_view', { send_to: id, page_location: page.url,
      page_title: page.title, page_referrer: '' });
    lastView = key;
  }
  function updateAnalyticsPage(pathname, navigationKey) {
    const page = getPublicAnalyticsPage(pathname);
    current = { page, navigationKey, key: navigationKey === undefined ? pathname : `${pathname}:${navigationKey}` };
    if (!eligible()) {
      if (inserted) stopAudienceMeasurement();
      return { status: 'ineligible' };
    }
    if (ready) { sendCurrentPage(); return { status: 'ready' }; }
    if (inserted) return { status: 'loading' };
    if (!doc?.head || !doc.createElement) return { status: 'unavailable' };
    try {
      win.formapromptAudienceLayer = [];
      win[`ga-disable-${id}`] = false;
      script = doc.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${id}&l=formapromptAudienceLayer`;
      script.onload = () => { if (!eligible()) { stopAudienceMeasurement(); return; } ready = true; sendCurrentPage(); };
      script.onerror = () => { stopAudienceMeasurement(); };
      inserted = true;
      doc.head.appendChild(script);
      return { status: 'loading' };
    } catch { stopAudienceMeasurement(); return { status: 'unavailable' }; }
  }
  subscribeConsent((choice) => {
    if (choice !== 'granted') { if (inserted) stopAudienceMeasurement(); return; }
    if (current?.page) updateAnalyticsPage(current.page.path, current.navigationKey);
  });
  return { updateAnalyticsPage, stopAudienceMeasurement,
    isAnalyticsDocumentLoaded: () => inserted, getPublicAnalyticsPage };
}

let currentAuth = { loading: true, user: null };
const analytics = createGoogleAnalytics({ window: typeof window === 'undefined' ? undefined : window,
  document: typeof document === 'undefined' ? undefined : document, env: import.meta.env || {},
  getConsent: getAudienceConsent, subscribeConsent: subscribeAudienceConsent,
  getAuthState: () => currentAuth, clearCookies: clearAudienceCookies });
export function updateAnalyticsPage(pathname, navigationKey, authState) {
  if (authState) currentAuth = authState;
  return analytics.updateAnalyticsPage(pathname, navigationKey);
}
export const { stopAudienceMeasurement, isAnalyticsDocumentLoaded } = analytics;
