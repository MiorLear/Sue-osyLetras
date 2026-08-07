import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const FONT_FILES = [
  'hanken-grotesk-latin.woff2',
  'newsreader-latin.woff2',
  'newsreader-italic-latin.woff2',
];

describe('fuentes auto-hospedadas', () => {
  it('los woff2 están versionados en public/fonts', () => {
    for (const file of FONT_FILES) {
      const full = path.join(root, 'public/fonts', file);
      expect(existsSync(full), `falta ${file}`).toBe(true);
      // Firma de woff2: sin esto el navegador ignora la fuente en silencio.
      expect(readFileSync(full).subarray(0, 4).toString('ascii')).toBe('wOF2');
    }
  });

  it('fonts.css declara las dos familias del sistema de diseño', () => {
    const css = read('src/styles/fonts.css');
    for (const file of FONT_FILES) expect(css).toContain(`/fonts/${file}`);
    expect(css).toContain("font-family: 'Hanken Grotesk'");
    expect(css).toContain("font-family: 'Newsreader'");
    expect(css).toContain('font-style: italic');
  });

  it('global.css importa fonts.css antes que los tokens', () => {
    const css = read('src/styles/global.css');
    expect(css.indexOf("@import './fonts.css'")).toBe(0);
  });
});

// Requisito de SEC-12/PWA-1.7: sin orígenes de terceros no hay nada que
// permitir en la CSP, y el arranque en frío deja de depender de Google.
describe('no queda ninguna dependencia de Google Fonts', () => {
  const sources = [
    'index.html',
    'src/styles/global.css',
    'src/styles/fonts.css',
    'src/styles/tokens.css',
  ];

  it.each(sources)('%s no apunta a un dominio de Google', (file) => {
    const text = read(file);
    expect(text).not.toContain('fonts.googleapis.com');
    expect(text).not.toContain('fonts.gstatic.com');
  });

  it('ningún archivo de src/ referencia googleapis', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
      );
    const offenders = walk(path.join(root, 'src'))
      .filter((f) => /\.(ts|tsx|css|html)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => readFileSync(f, 'utf8').includes('googleapis.com'));
    expect(offenders).toEqual([]);
  });
});
