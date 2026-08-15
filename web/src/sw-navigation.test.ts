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

  // Un objeto guardado sin extensión no lo cubre la regla de "parece un
  // archivo", y devolverle el HTML del shell a una descarga se ve como un
  // archivo corrupto, no como un error.
  it('no responde /media/** con el shell, ni siquiera sin extensión', () => {
    expect(isDeniedNavigation('/media/tools/manual.pdf')).toBe(true);
    expect(isDeniedNavigation('/media/posts/9f1c8e2a')).toBe(true);
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
  // Hasta PWA-2.8 esto se garantizaba con "no hay ninguna estrategia de
  // runtime", que era cierto porque no había ninguna ruta. Ahora hay una, la de
  // medios, así que la garantía se afina: solo esa, y decidida por un predicado
  // que no puede casar con /api/ (lo fija media-origins.test.ts).
  it('la única estrategia de runtime es la caché de medios', () => {
    expect(swSource).toContain('new CacheFirst(');
    expect(swSource.match(/new CacheFirst\(/g)).toHaveLength(1);
    expect(swSource).toContain('isMediaUrl(url.href)');
  });

  it('no usa estrategias que revalidan contra la red por su cuenta', () => {
    for (const strategy of ['NetworkFirst', 'StaleWhileRevalidate', 'NetworkOnly']) {
      expect(swSource).not.toContain(strategy);
    }
  });

  // Safari manda Range siempre para <video>. Sin este plugin la respuesta
  // cacheada se devuelve entera, Safari la rechaza, y el video no reproduce sin
  // conexión aunque los bytes estén guardados.
  it('sirve rangos, y solo cachea respuestas completas', () => {
    expect(swSource).toContain('new RangeRequestsPlugin()');
    expect(swSource).toContain('statuses: [200]');
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
