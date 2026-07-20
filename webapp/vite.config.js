import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/blog\/[^/?#]+\/?$/],
      },
      manifest: {
        name: 'FormaPrompt',
        short_name: 'FormaPrompt',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#047857',
        icons: [
          {
            src: '/assets/logo-new.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/assets/logo-new.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});
