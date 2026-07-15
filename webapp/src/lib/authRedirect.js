const DEFAULT_PUBLIC_SITE_URL = 'https://formaprompt.com';

function getPublicSiteUrl() {
  const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();
  const candidate = configuredSiteUrl || DEFAULT_PUBLIC_SITE_URL;

  try {
    return new URL(candidate).origin;
  } catch {
    return DEFAULT_PUBLIC_SITE_URL;
  }
}

export function getAuthRedirectUrl(pathname) {
  return new URL(pathname, `${getPublicSiteUrl()}/`).toString();
}
