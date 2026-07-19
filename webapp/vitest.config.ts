import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/studio/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/studio/test/setup.ts'],
    testTimeout: 45_000,
    css: true,
  },
});
