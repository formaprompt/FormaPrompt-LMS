import { registerSW } from 'virtual:pwa-register';

const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function registerFormaPromptServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

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
