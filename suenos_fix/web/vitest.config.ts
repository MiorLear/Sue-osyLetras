import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Arnes de tests de la app web. jsdom + fake-indexeddb: la migracion a PWA
// mueve el outbox y la cache offline a IndexedDB, asi que el entorno de test
// tiene que tener ambos desde ya (MAINT-01).
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@explorarte/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts'),
    },
  },
});
