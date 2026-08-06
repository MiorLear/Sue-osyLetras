// ESLint (flat config) para la app movil Expo / React Native.
// web/ y shared/ tienen su propia config: cada proyecto se lintea por separado,
// igual que se typechequea por separado (ver MAINT-03).
import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  globalIgnores([
    'node_modules/**',
    'dist/**',
    '.expo/**',
    'web/**',
    'shared/**',
    'design-reference/**',
    '.claude/**',
    'android/**',
    'ios/**',
  ]),
  expoConfig,
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    rules: {
      // El resolver de import/ no entiende el alias @/* ni los subpaths de
      // Expo; el typecheck ya cubre los imports rotos.
      'import/no-unresolved': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    // El plugin @typescript-eslint solo esta registrado para ficheros TS en la
    // config de Expo, asi que la regla tiene que vivir en un bloque TS.
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Preexistente en el codigo actual: se deja como aviso para no reescribir
      // medio repo en el PR de guardrails. Subirla a "error" es seguimiento.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    // Los tests corren en Node bajo Vitest, no en el runtime de RN.
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
]);
