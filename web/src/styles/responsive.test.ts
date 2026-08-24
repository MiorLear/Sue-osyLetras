import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Normalizado a LF: el repo se edita desde Windows y git reescribe los finales.
const css = readFileSync(path.resolve(import.meta.dirname, './global.css'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

function ruleFrom(source: string, selector: string) {
  const start = source.indexOf(selector);
  expect(start, `No se encontró ${selector}`).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf('}', start) + 1);
}

function mediaBlock(query: string) {
  const marker = `@media ${query}`;
  const start = css.indexOf(marker);
  expect(start, `No se encontró ${marker}`).toBeGreaterThanOrEqual(0);
  const openingBrace = css.indexOf('{', start);
  let depth = 0;

  for (let index = openingBrace; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(openingBrace + 1, index);
  }

  throw new Error(`El bloque ${marker} no cierra sus llaves`);
}

describe('contrato responsive compartido', () => {
  it('evita el zoom de iOS solo en pantallas móviles o táctiles', () => {
    const mobile = mediaBlock('(max-width: 760px)');
    const coarse = mediaBlock('(pointer: coarse)');

    expect(ruleFrom(mobile, '.input,\n  .select-native {')).toContain('font-size: 16px');
    expect(ruleFrom(coarse, '.input,\n  .select-native {')).toContain('font-size: 16px');
    expect(ruleFrom(css, '.input {')).toContain('font-size: 14px');
    expect(ruleFrom(css, '.select-native {')).toContain('font-size: 14px');
  });

  it('centra auth de forma segura y conserva los fallbacks de viewport', () => {
    const authShell = ruleFrom(css, '.auth-shell {');
    const mobile = mediaBlock('(max-width: 760px)');
    const mobileAuthShell = ruleFrom(mobile, '.auth-shell {');
    const mobileAuthCard = ruleFrom(mobile, '.auth-card {');

    expect(authShell).toContain('min-height: 100vh');
    expect(authShell).toContain('min-height: 100dvh');
    expect(authShell).toContain('overflow-y: auto');
    expect(mobileAuthShell).toContain('align-items: flex-start');
    expect(mobileAuthShell).not.toContain('align-items: center');
    expect(mobileAuthCard).toContain('margin-block: auto');
  });

  it('permite que las filas de medios se adapten sin desbordar', () => {
    expect(ruleFrom(css, '.media-row {')).toContain('flex-wrap: wrap');
    const body = ruleFrom(css, '.media-row__body {');
    expect(body).toContain('flex: 1 1 130px');
    expect(body).toContain('min-width: 0');
  });

  it('reduce el título legacy en teléfonos estrechos', () => {
    const narrow = mediaBlock('(max-width: 520px)');
    expect(ruleFrom(narrow, '.page-head h1 {')).toContain('font-size: clamp(24px, 7vw, 34px)');
  });

  it('publica un cuerpo de modal desplazable y alturas vh/dvh', () => {
    const modal = ruleFrom(css, '.modal-card {');
    const adminModal = ruleFrom(css, '.modal-card--admin {');
    const body = ruleFrom(css, '.modal-body {');

    expect(modal).toContain('max-height: 88vh');
    expect(modal).toContain('max-height: 88dvh');
    expect(adminModal).toContain('max-height: 92vh');
    expect(adminModal).toContain('max-height: 92dvh');
    expect(body).toContain('overflow-y: auto');
    expect(body).toContain('flex: 1');
    expect(body).toContain('min-height: 0');
    expect(body).toContain('overscroll-behavior: contain');
  });

  it('publica el FAB respetando navegación y safe area', () => {
    const fab = ruleFrom(css, '.fab {');
    expect(fab).toContain('position: fixed');
    expect(fab).toContain(
      'bottom: calc(30px + var(--bottom-nav-height, 0px) + env(safe-area-inset-bottom, 0px))',
    );
    expect(fab).toContain('right: 30px');
  });

  it('publica dos estrategias explícitas para objetivos de 44px', () => {
    const hit = ruleFrom(css, '.hit-44 {');
    const hitPseudo = ruleFrom(css, '.hit-44::after {');
    const tap = ruleFrom(css, '.tap-44 {');

    expect(hit).toContain('position: relative');
    expect(hitPseudo).toContain('width: 44px');
    expect(hitPseudo).toContain('height: 44px');
    expect(hitPseudo).toContain('transform: translate(-50%, -50%)');
    expect(tap).toContain('min-width: 44px');
    expect(tap).toContain('min-height: 44px');
    expect(tap).toContain('display: inline-flex');
    expect(tap).toContain('align-items: center');
    expect(tap).toContain('justify-content: center');
    expect(css).toContain(
      'hit-44 solo sirve para controles aislados y que no usen ya ::after; no usar dos a menos de 44px.',
    );
  });
});
