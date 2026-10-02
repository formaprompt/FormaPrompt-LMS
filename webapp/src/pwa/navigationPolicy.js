// Fonctions autonomes : Workbox les sérialise dans le worker généré.
export function matchesDocumentNavigation({ request, url }) {
  return request.mode === 'navigate' && url.origin === self.location.origin;
}

export function fetchDocumentFromNetwork({ request }) {
  // Workbox ignore fetchOptions sur les navigations : modifier la requête ici.
  // Aucun fallback vers une ancienne page, aucune interception des API/médias.
  return fetch(request, { cache: 'no-store' });
}
