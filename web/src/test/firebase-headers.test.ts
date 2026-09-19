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

const IMMUTABLE_GLOB = '/assets/**';

describe('contrato del proyecto de producción', () => {
  const project = JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, '../../.firebaserc'), 'utf8'),
  ) as { projects: Record<string, string> };
  const productionEnv = readFileSync(
    path.resolve(import.meta.dirname, '../../.env.production'),
    'utf8',
  );
  const rewrites = (hosting as unknown as {
    rewrites: { source: string; run?: { serviceId: string; region: string } }[];
  }).rewrites;

  it('apunta al proyecto Firebase real y usa el proxy del mismo origen', () => {
    expect(project.projects.default).toBe('explorarte-6335b');
    expect(project.projects.production).toBe('explorarte-6335b');
    expect(productionEnv).toMatch(/^VITE_API_URL=\/api$/m);
  });

  it.each(['/api/**', '/media/**'])('%s llega al Cloud Run de producción', (source) => {
    expect(rewrites.find((rewrite) => rewrite.source === source)?.run).toEqual({
      serviceId: 'explorarte-api',
      region: 'us-east4',
    });
  });
});

describe('firebase.json no puede convertirse en una bomba de caché', () => {
  it('solo los assets con hash reciben cache immutable', () => {
    const glob = rules.find((r) => r.source === IMMUTABLE_GLOB);
    expect(glob).toBeDefined();
    expect(glob!.headers[0].value).toContain('immutable');
    expect(IMMUTABLE_GLOB).not.toContain('sw.js');
  });

  it.each(['/', '/sw.js', '/manifest.webmanifest', '/index.html'])(
    '%s se sirve con no-cache',
    (source) => {
      const at = indexOfSource(source);
      expect(at, `falta la regla de ${source}`).toBeGreaterThanOrEqual(0);
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
    // Las fuentes son propias desde PWA-1.3: ningún origen de Google Fonts.
    expect(csp).not.toContain('fonts.googleapis.com');
    expect(csp).not.toContain('fonts.gstatic.com');
    expect(csp).toContain("font-src 'self'");
  });

  // GCP-04: una URL canónica de medios responde 302 hacia Cloud Storage, y la
  // CSP se aplica a la URL FINAL de la redirección. Sin esta entrada las fotos
  // y los videos se rompen en silencio: no hay error de red, solo una violación
  // en la consola. render.yaml ya lo tiene; este es el que cuenta en producción.
  it('deja pasar los medios que llegan por redirección a Cloud Storage', () => {
    const directive = (name: string) =>
      csp.split(';').find((d) => d.trim().startsWith(`${name} `)) ?? '';
    expect(directive('img-src')).toContain('https://storage.googleapis.com');
    expect(directive('media-src')).toContain('https://storage.googleapis.com');
  });

  // Y el principio de esa redirección, que es lo que el navegador pide primero.
  // La app se sirve en explorarte.app, pero APP_MEDIA_PUBLIC_BASE_URL apunta a
  // explorarte-6335b.web.app, así que la URL guardada de cada archivo es de otro
  // origen: sin esta entrada, las 13 de producción se bloquean en silencio y la
  // pantalla queda sin video y sin foto, sin un solo error de red. Las dos
  // tienen que estar mientras convivan URLs viejas y nuevas.
  it('deja pasar el dominio donde viven las URLs de medios ya guardadas', () => {
    const directive = (name: string) =>
      csp.split(';').find((d) => d.trim().startsWith(`${name} `)) ?? '';
    for (const name of ['img-src', 'media-src', 'connect-src']) {
      expect(directive(name), name).toContain('https://explorarte-6335b.web.app');
    }
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
