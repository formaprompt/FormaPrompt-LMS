export const AUDIENCE_COOKIE = 'formaprompt_audience_v1';
// Proposition technique provisoire, à valider avant toute activation de GA4.
export const AUDIENCE_DAYS = 150;

export function createAudienceConsent({ document: doc, window: win } = {}) {
  const listeners = new Set();
  let deniedInMemory = false;
  function getAudienceConsent() {
    if (deniedInMemory) return 'denied';
    try {
      const value = doc?.cookie?.split(';').map((part) => part.trim())
        .find((part) => part.startsWith(`${AUDIENCE_COOKIE}=`))?.split('=')[1];
      return value === 'v1.granted' ? 'granted' : value === 'v1.denied' ? 'denied' : 'unknown';
    } catch { return 'unknown'; }
  }
  function clearAudienceCookies() {
    try {
      for (const part of (doc?.cookie || '').split(';')) {
        const name = part.trim().split('=')[0];
        if (!/^_ga(?:_|$)/.test(name)) continue;
        for (const domain of ['', win?.location?.hostname, '.formaprompt.com']) {
          doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}${win?.location?.protocol === 'https:' ? '; Secure' : ''}`;
        }
      }
    } catch { /* Cookie restrictions never prevent immediate refusal. */ }
  }
  function setAudienceConsent(choice) {
    if (!doc || !['granted', 'denied'].includes(choice)) return;
    deniedInMemory = choice === 'denied';
    try {
      doc.cookie = `${AUDIENCE_COOKIE}=v1.${choice}; Max-Age=${AUDIENCE_DAYS * 86400}; Path=/; SameSite=Lax${win?.location?.protocol === 'https:' ? '; Secure' : ''}`;
    } catch { /* A grant must be readable from the cookie before it can be used. */ }
    if (choice === 'denied') clearAudienceCookies();
    listeners.forEach((listener) => { try { listener(getAudienceConsent()); } catch { /* Notify remaining subscribers. */ } });
  }
  return { getAudienceConsent, setAudienceConsent, clearAudienceCookies,
    subscribeAudienceConsent(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}

const consent = createAudienceConsent({ document: typeof document === 'undefined' ? undefined : document,
  window: typeof window === 'undefined' ? undefined : window });
export const { getAudienceConsent, setAudienceConsent, subscribeAudienceConsent, clearAudienceCookies } = consent;
