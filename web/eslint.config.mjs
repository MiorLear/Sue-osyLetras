// ESLint (flat config) para la app web (Vite + React).
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    'node_modules/**',
    'dist/**',
    'public/**',
    'Desktop web app redesign/**',
    // Salidas de Playwright: HTML generado y trazas, no código nuestro.
    'playwright-report/**',
    'test-results/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Preexistente en varias rutas del CMS; se deja como aviso en vez de
      // reescribir los tipos en el PR de guardrails.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['vite.config.ts', 'vitest.config.ts', 'eslint.config.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // El arnés de Playwright corre en Node, no en el navegador: sin esto el
    // primer `process.env` del config es un `no-undef` y el lint se cae.
    // El código que se inyecta en la página (page.evaluate) sí es de navegador,
    // de ahí los dos conjuntos de globales.
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    // El service worker corre en ServiceWorkerGlobalScope, no en window.
    files: ['src/sw.ts'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
]);
