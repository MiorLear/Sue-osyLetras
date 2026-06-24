import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Alias @explorarte/shared straight to its TS source so the web app always uses
// the latest shared code without a separate build step during development.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@explorarte/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    fs: {
      // allow importing from the sibling shared/ folder
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
  },
});
