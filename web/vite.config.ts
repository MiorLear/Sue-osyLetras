import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Alias @explorarte/shared straight to its TS source so the web app always uses
// the latest shared code without a separate build step during development.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest, not generateSW: the worker owns custom media routing and
      // a controlled update handshake that a generated worker cannot express.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // The manifest is a versioned file in public/, not generated here, so the
      // deployed JSON is the one that was reviewed.
      manifest: false,
      // The page decides when to activate a new worker (see UpdateToast).
      injectRegister: null,
      registerType: 'prompt',
      devOptions: {
        // Lets the worker be exercised with `npm run dev`.
        enabled: false,
        type: 'module',
      },
      injectManifest: {
        // Everything the shell needs for a cold offline start. Media and API
        // data are deliberately absent: media is runtime-cached by a later
        // ticket and API responses are never cached by the worker at all.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        // If admin screens become lazy chunks (SCALE-07), exclude them here:
        // the CMS is desktop-only and does not need to work offline.
        // globIgnores: ['assets/admin-*.js'],
      },
    }),
  ],
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
