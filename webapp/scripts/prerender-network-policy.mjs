const PUBLIC_CALENDAR_ENDPOINT = 'https://crxodkbcukhjdejlcfpg.supabase.co/functions/v1/get-unified-availability';

// A public read uses POST transport, but build-time prerender must never call it live.
export function classifyPrerenderRequest({ method, url, postData }) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return 'allow';
  if (method !== 'POST' || url !== PUBLIC_CALENDAR_ENDPOINT) return 'block_mutation';
  try {
    const payload = JSON.parse(postData);
    if (payload && !Array.isArray(payload)
      && Object.keys(payload).length === 2
      && payload.purpose === 'public_calendar'
      && typeof payload.month === 'string'
      && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(payload.month)) {
      return 'unavailable_calendar';
    }
  } catch { /* Malformed requests remain blocked mutations. */ }
  return 'block_mutation';
}

export const unavailableCalendarResponse = Object.freeze({
  status: 503,
  contentType: 'application/json',
  headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify({ code: 'CALENDAR_UNAVAILABLE', error: 'Disponibilités temporairement indisponibles. Réessayez plus tard.' }),
});
