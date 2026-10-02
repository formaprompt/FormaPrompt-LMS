export const ADVERTISING_COOKIE = 'formaprompt_advertising_v1';
export const ADVERTISING_DAYS = 150;
const PREFERENCES_EVENT = 'formaprompt:advertising-preferences';

export function createAdvertisingConsent({ document: doc, window: win } = {}) {
  const listeners = new Set();
  let deniedInMemory = false;
  function get() {
    if (deniedInMemory) return 'denied';
    try {
      const value = doc?.cookie?.split(';').map((part) => part.trim())
        .find((part) => part.startsWith(`${ADVERTISING_COOKIE}=`))?.split('=')[1];
      return value === 'v1.granted' ? 'granted' : value === 'v1.denied' ? 'denied' : 'unknown';
    } catch { return 'unknown'; }
  }
  function clearAdvertisingCookies() {
    for (const part of (doc?.cookie || '').split(';')) {
      const name = part.trim().split('=')[0];
      if (!/^_gcl(?:_|$)/.test(name)) continue;
      for (const domain of ['', win?.location?.hostname, '.formaprompt.com']) {
        doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
      }
    }
  }
  function set(choice) {
    if (!doc || !['granted', 'denied'].includes(choice)) return;
    deniedInMemory = choice === 'denied';
    try {
      doc.cookie = `${ADVERTISING_COOKIE}=v1.${choice}; Max-Age=${ADVERTISING_DAYS * 86400}; Path=/; SameSite=Lax${win?.location?.protocol === 'https:' ? '; Secure' : ''}`;
      if (choice !== 'granted') clearAdvertisingCookies();
    } catch { /* An unavailable cookie store must never turn refusal into agreement. */ }
    listeners.forEach((listener) => { try { listener(get()); } catch { /* Other subscribers still receive the choice. */ } });
  }
  return {
    getAdvertisingConsent: get,
    setAdvertisingConsent: set,
    subscribeAdvertisingConsent(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    requestAdvertisingPreferences() { win?.dispatchEvent(new win.Event(PREFERENCES_EVENT)); },
    subscribeAdvertisingPreferences(listener) {
      win?.addEventListener(PREFERENCES_EVENT, listener);
      return () => win?.removeEventListener(PREFERENCES_EVENT, listener);
    },
  };
}

const consent = createAdvertisingConsent({
  document: typeof document === 'undefined' ? undefined : document,
  window: typeof window === 'undefined' ? undefined : window,
});
export const { getAdvertisingConsent, setAdvertisingConsent, subscribeAdvertisingConsent,
  requestAdvertisingPreferences, subscribeAdvertisingPreferences } = consent;
