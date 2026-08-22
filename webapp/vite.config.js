import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { cwd } from 'node:process';

const EXPECTED_PUBLIC_CONFIG = Object.freeze({
  supabaseUrl: 'https://crxodkbcukhjdejlcfpg.supabase.co',
  siteUrl: 'https://formaprompt.com',
});

function assertProductionPublicConfig(mode) {
  const env = loadEnv(mode, cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  const siteUrl = env.VITE_SITE_URL?.trim().replace(/\/$/, '');
  const isPublicKey = /^(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_publishable_[A-Za-z0-9_-]+)$/.test(supabaseKey || '');

  if (
    supabaseUrl !== EXPECTED_PUBLIC_CONFIG.supabaseUrl
    || siteUrl !== EXPECTED_PUBLIC_CONFIG.siteUrl
    || !isPublicKey
    || supabaseKey.startsWith('sb_secret_')
  ) {
    throw new Error(
      'Build FormaPrompt refusé : configuration publique Vite/Supabase absente ou incohérente.',
    );
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') assertProductionPublicConfig(mode);

  return {
    plugins: [
      react(),
      VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        // Les routes sont servies par l'hébergement. Ne jamais substituer
        // l'index mis en cache à une navigation : cela peut laisser l'URL et
        // le contenu en désaccord jusqu'au rechargement suivant.
        navigateFallback: null,
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
  };
});
