import { defineConfig } from 'vitest/config';

// Los tests viven en test/ y no en src/ a proposito: tsconfig.json compila
// "src" con rootDir "src", asi que meterlos ahi los emitiria dentro de dist/.
// vitest y sus dependencias se resuelven desde el node_modules de la raiz —
// shared/ no tiene instalacion propia (se compila via el postinstall de raiz).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    restoreMocks: true,
  },
});
