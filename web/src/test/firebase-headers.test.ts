import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const hosting = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '../../firebase.json'), 'utf8'),
).hosting as { headers: HeaderRule[] };

const rules = hosting.headers;
const indexOfSource = (source: string) => rules.findIndex((r) => r.source === source);
const headerOf = (source: string, key: string) =>
  rules.find((r) => r.source === source)?.headers.find((h) => h.key === key)?.value;

const IMMUTABLE_GLOB = '**/*.@(js|css|svg|png|jpg|jpeg|woff2)';

// El fallo que no tiene vuelta atrás: ese glob atrapa /sw.js. Si le cae
// max-age=31536000,immutable, el navegador deja de pedir el archivo y la
// usuaria queda clavada en un service worker viejo para siempre — no se
// arregla con un deploy, porque el deploy nunca se descarga.
describe('firebase.json no puede convertirse en una bomba de caché', () => {
  it('el glob immutable sigue ahí y sigue atrapando /sw.js', () => {
    const glob = rules.find((r) => r.source === IMMUTABLE_GLOB);
    expect(glob).toBeDefined();
    expect(glob!.headers[0].value).toContain('immutable');
    // La alternancia incluye `js`, así que /sw.js encaja: por eso las reglas
    // no-cache tienen que ir antes.
    expect(IMMUTABLE_GLOB).toContain('js|');
  });

  it.each(['/sw.js', '/manifest.webmanifest', '/index.html'])(
    '%s va antes del glob immutable y con no-cache',
    (source) => {
      const at = indexOfSource(source);
      expect(at, `falta la regla de ${source}`).toBeGreaterThanOrEqual(0);
      expect(at).toBeLessThan(indexOfSource(IMMUTABLE_GLOB));
      expect(headerOf(source, 'Cache-Control')).toContain('no-cache');
    },
  );
});

describe('cabeceras de seguridad (PWA-1.7 / SEC-12)', () => {
  const csp = headerOf('**', 'Content-Security-Policy') ?? '';

  it('sirve una CSP con script-src cerrado a self', () => {
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('permite la API y Supabase donde hace falta, y nada más', () => {
    expect(csp).toMatch(/connect-src [^;]*'self'/);
    expect(csp).toContain('https://*.supabase.co');
    // Las fuentes son propias desde PWA-1.3: ningún origen de Google.
    expect(csp).not.toContain('googleapis.com');
    expect(csp).toContain("font-src 'self'");
  });

  it('bloquea el enmarcado y fija la política de referrer', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(headerOf('**', 'X-Frame-Options')).toBe('DENY');
    expect(headerOf('**', 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('la regla de seguridad no pisa el Cache-Control de nadie', () => {
    const keys = rules.find((r) => r.source === '**')!.headers.map((h) => h.key);
    expect(keys).not.toContain('Cache-Control');
  });
});
