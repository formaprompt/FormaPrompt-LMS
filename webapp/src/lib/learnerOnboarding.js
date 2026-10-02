export const DEFAULT_ONBOARDING_CONFIG = Object.freeze({
  enabled: true,
  version: '1',
  title: 'Bien démarrer dans mon espace apprenant FormaPrompt',
  description: 'Retrouvez vos formations, leurs ressources et les étapes pour commencer ou reprendre votre apprentissage.',
  durationLabel: null,
  videoUrl: null,
  thumbnailUrl: null,
  captionsUrl: null,
  captionsEmbedded: false,
});

const CONFIG_PATH = '/config/learner-onboarding.json';
const STORAGE_PREFIX = 'formaprompt:onboarding-video-seen:';
const MEDIA_EXTENSIONS = {
  videoUrl: /\.(mp4|webm|ogv)$/i,
  thumbnailUrl: /\.(png|jpe?g|webp|avif)$/i,
  captionsUrl: /\.vtt$/i,
};

function cleanText(value, fallback, maximum) {
  return typeof value === 'string' && value.trim() && value.trim().length <= maximum
    ? value.trim()
    : fallback;
}

function publicMediaUrl(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) return null;
  const candidate = value.trim();
  if (!/^(?:\/(?!\/)|https:\/\/)/i.test(candidate) || /[\\\s?#]/.test(candidate)) return null;
  try {
    const origin = globalThis.location?.origin || 'https://formaprompt.com';
    const url = new URL(candidate, origin);
    if (url.origin !== origin || url.username || url.password || url.search || url.hash) return null;
    if (!candidate.startsWith('/') && url.protocol !== 'https:') return null;
    const path = decodeURIComponent(url.pathname);
    // L'accueil accepte uniquement des fichiers publics, jamais une passerelle
    // d'authentification, un stockage privé ou une URL signée de formation.
    if (!path.startsWith('/media/onboarding/')
      || /[\\?#]/.test(path) || path.includes('\0') || /%[0-9a-f]{2}/i.test(path)
      || /(?:^|\/)(?:api|auth|functions|storage|private[^/]*|paid[^/]*|protected[^/]*)(?:\/|$)/i.test(path)
      || !MEDIA_EXTENSIONS[field].test(path)) return null;
    return candidate;
  } catch {
    return null;
  }
}

export function normalizeLearnerOnboardingConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const config = {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_ONBOARDING_CONFIG.enabled,
    version: cleanText(source.version, DEFAULT_ONBOARDING_CONFIG.version, 80),
    title: cleanText(source.title, DEFAULT_ONBOARDING_CONFIG.title, 160),
    description: cleanText(source.description, DEFAULT_ONBOARDING_CONFIG.description, 1200),
    durationLabel: cleanText(source.durationLabel, null, 80),
    videoUrl: publicMediaUrl(source.videoUrl, 'videoUrl'),
    thumbnailUrl: publicMediaUrl(source.thumbnailUrl, 'thumbnailUrl'),
    captionsUrl: publicMediaUrl(source.captionsUrl, 'captionsUrl'),
    captionsEmbedded: source.captionsEmbedded === true,
  };
  if (!config.videoUrl) {
    config.durationLabel = null;
    config.thumbnailUrl = null;
    config.captionsUrl = null;
    config.captionsEmbedded = false;
  }
  return config;
}

export async function loadLearnerOnboardingConfig({ signal } = {}) {
  try {
    const response = await fetch(CONFIG_PATH, { cache: 'no-store', signal });
    if (!response.ok) return { ...DEFAULT_ONBOARDING_CONFIG };
    return normalizeLearnerOnboardingConfig(await response.json());
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return { ...DEFAULT_ONBOARDING_CONFIG };
  }
}

function storageKey(userId, version) {
  if (typeof userId !== 'string' || !userId.trim()
    || typeof version !== 'string' || !version.trim()) return null;
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(version)}`;
}

export function hasSeenOnboardingVideo(userId, version) {
  try {
    const key = storageKey(userId, version);
    return Boolean(key && globalThis.localStorage?.getItem(key) === 'seen');
  } catch {
    return false;
  }
}

export function markOnboardingVideoSeen(userId, version) {
  try {
    const key = storageKey(userId, version);
    if (!key || !globalThis.localStorage) return false;
    globalThis.localStorage.setItem(key, 'seen');
    return true;
  } catch {
    return false;
  }
}
