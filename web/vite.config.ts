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
        // `mjs` por el worker de pdf.js, que Vite emite con esa extensión: sin
        // él en el precache, un libro ya descargado no se podría leer sin red.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,webmanifest,woff2}'],
        // El worker de pdf.js pasa de 1 MB; el tope por defecto (2 MiB) queda justo.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Ya son chunks perezosos, asi que la salida que este comentario
        // anticipaba esta tomada: el CMS es de escritorio y no necesita
        // funcionar sin conexion. Precachearlo solo gastaba datos de la docente
        // en seis pantallas que nunca abre.
        globIgnores: ['assets/Admin*.js'],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Sin esto no habia ni una sola division: las 22 rutas, la consola de
        // admin y firebase/auth vivian en un unico index-*.js de 657 KB que
        // toda visita descargaba entera antes de pintar nada.
        manualChunks(id) {
          // Vite normaliza los ids a barras normales, tambien en Windows.
          const path = id;
          // El CMS NO se agrupa a mano. Se intento, y el resultado fue peor:
          // Rollup metia en ese chunk tambien codigo compartido que el entry
          // necesita, asi que el entry acababa importandolo de forma ESTATICA.
          // Sin conexion eso era fatal — el chunk no esta precacheado a
          // proposito, la peticion fallaba al arrancar y la app se quedaba
          // clavada en el esqueleto. Lo caza offline.spec.ts. Dejando que
          // Rollup nombre los chunks perezosos (Admin*.js), cada pantalla del
          // CMS va por su lado y nada de eso cuelga del arranque.
          if (path.includes('/node_modules/firebase/') || path.includes('/node_modules/@firebase/')) {
            return 'firebase';
          }
          if (
            path.includes('/node_modules/react/') ||
            path.includes('/node_modules/react-dom/') ||
            path.includes('/node_modules/react-router') ||
            path.includes('/node_modules/scheduler/')
          ) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
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
