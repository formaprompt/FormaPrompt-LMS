import { registerSW } from 'virtual:pwa-register';

const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function registerFormaPromptServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  let pageRefreshStarted = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pageRefreshStarted) return;

    pageRefreshStarted = true;
    window.location.reload();
  });

  registerSW({
    immediate: true,
    onRegisteredSW(_serviceWorkerUrl, registration) {
      if (!registration) return;

      registration.update().catch(() => {});
      window.setInterval(() => {
        registration.update().catch(() => {});
      }, UPDATE_INTERVAL_MS);
    },
  });
}
