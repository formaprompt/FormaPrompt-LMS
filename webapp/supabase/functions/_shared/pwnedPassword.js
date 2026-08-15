const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const DEFAULT_TIMEOUT_MS = 4_000;

export function validatePasswordSecurityPolicy(password) {
  if (typeof password !== 'string') return 'Le mot de passe est requis.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Le mot de passe ne peut pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`;
  }
  if (/^[\s\u00A0]+$/u.test(password)) return 'Le mot de passe ne peut pas contenir uniquement des espaces.';
  return null;
}

export async function sha1Hex(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function findPwnedPasswordCount(rangeResponse, expectedSuffix) {
  if (typeof rangeResponse !== 'string' || !/^[0-9A-F]{35}$/i.test(expectedSuffix)) return 0;
  for (const line of rangeResponse.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator !== 35) continue;
    const suffix = line.slice(0, separator).toUpperCase();
    const count = Number.parseInt(line.slice(separator + 1).trim(), 10);
    if (suffix === expectedSuffix.toUpperCase() && Number.isSafeInteger(count) && count > 0) return count;
  }
  return 0;
}

export async function checkPwnedPassword(password, options = {}) {
  const policyError = validatePasswordSecurityPolicy(password);
  if (policyError) return { status: 'invalid', message: policyError };

  const fullHash = await sha1Hex(password);
  const prefix = fullHash.slice(0, 5);
  const suffix = fullHash.slice(5);
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (options.fetchImpl || fetch)(`${HIBP_RANGE_URL}${prefix}`, {
      method: 'GET',
      headers: {
        'Add-Padding': 'true',
        'User-Agent': 'FormaPrompt-Password-Security',
      },
      signal: controller.signal,
    });
    if (!response.ok) return { status: 'unavailable', code: 'hibp_http_error' };
    const count = findPwnedPasswordCount(await response.text(), suffix);
    return count > 0 ? { status: 'compromised', count } : { status: 'safe' };
  } catch {
    return { status: 'unavailable', code: 'hibp_unreachable' };
  } finally {
    clearTimeout(timeoutId);
  }
}
