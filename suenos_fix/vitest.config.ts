import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Arnes de tests de la app movil. Cubre src/lib/ — la logica offline que se va
// a portar a IndexedDB en la migracion a PWA (MAINT-01). Corre en Node: los
// modulos nativos (AsyncStorage, expo-file-system) se mockean por test, asi no
// hace falta ni dispositivo ni Metro.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
});
