import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDeniedNavigation } from './sw-navigation';

const root = path.resolve(import.meta.dirname, '..');
const swSource = readFileSync(path.join(root, 'src/sw.ts'), 'utf8');
const viteConfig = readFileSync(path.join(root, 'vite.config.ts'), 'utf8');

describe('navegación del service worker', () => {
  it('devuelve el shell para las rutas de la app', () => {
    for (const route of ['/', '/main', '/emociones/12', '/comunidad', '/admin/usuarios']) {
      expect(isDeniedNavigation(route)).toBe(false);
    }
  });

  it('no responde /api/** con el shell', () => {
    expect(isDeniedNavigation('/api/emotions')).toBe(true);
    expect(isDeniedNavigation('/api/auth/login')).toBe(true);
  });

  it('no responde /.well-known/** con el shell', () => {
    expect(isDeniedNavigation('/.well-known/assetlinks.json')).toBe(true);
  });

  it('deja pasar los archivos reales', () => {
    expect(isDeniedNavigation('/manifest.webmanifest')).toBe(true);
    expect(isDeniedNavigation('/icons/icon-192.png')).toBe(true);
    expect(isDeniedNavigation('/assets/index-abc123.js')).toBe(true);
  });
});

// Esta es la invariante que el lote no puede fallar: cada GET a /api/ lleva
// Authorization: Bearer y Spring no manda Vary: Authorization, así que una ruta
// de Workbox keyeada por URL le serviría el perfil de una docente a otra en la
// tablet compartida del aula. Las lecturas offline viven en la página.
describe('el service worker nunca cachea la API', () => {
  it('no registra estrategias de caché de runtime', () => {
    for (const strategy of [
      'NetworkFirst',
      'CacheFirst',
      'StaleWhileRevalidate',
      'NetworkOnly',
      'workbox-strategies',
    ]) {
      expect(swSource).not.toContain(strategy);
    }
  });

  it('no menciona /api/ salvo para excluirla', () => {
    const apiLines = swSource
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('/api/'))
      .filter((line) => !line.startsWith('*') && !line.startsWith('//'))
      .map((line) => line.trim());
    // La única mención en código vivo debe ser la del denylist importado.
    expect(apiLines).toEqual([]);
  });

  it('vite.config.ts no configura runtimeCaching', () => {
    expect(viteConfig).not.toContain('runtimeCaching');
    expect(viteConfig).toContain("strategies: 'injectManifest'");
  });

  it('no activa skipWaiting automáticamente', () => {
    // skipWaiting solo puede aparecer dentro del handler del mensaje.
    const calls = swSource.match(/self\.skipWaiting\(\)/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(swSource).toContain("type === 'SKIP_WAITING'");
  });
});
