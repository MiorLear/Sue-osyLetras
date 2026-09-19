import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El contraste de los botones sólidos, calculado y no revisado a ojo.
 *
 * El cliente pidió revisar el botón "Iniciar sesión" en su estado activo: el
 * gradiente de marca arranca en #2fa7a0, que con texto blanco da 2,9:1 y no
 * llega al 4,5:1 que la WCAG 2.1 AA exige para 15px en negrita (no cuenta como
 * texto grande: eso empieza en 18,66px en negrita). Este test fija el arreglo
 * para que nadie devuelva el token claro al botón sin enterarse.
 */

// Normalizado a LF: el repo se edita desde Windows y git reescribe los finales.
const css = (name: string) =>
  readFileSync(path.resolve(import.meta.dirname, name), 'utf8').replace(/\r\n/g, '\n');

const tokens = css('tokens.css');
const global = css('global.css');

/** Luminancia relativa de un #rrggbb, según WCAG 2.1. */
function luminance(hex: string): number {
  const channel = (byte: number) => {
    const c = byte / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const n = parseInt(hex.replace('#', ''), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Los dos extremos de `linear-gradient(..., #aaa, #bbb)`. */
function stops(declaration: string): string[] {
  const line = tokens.split('\n').find((l) => l.trim().startsWith(declaration + ':')) ?? '';
  return line.match(/#[0-9a-f]{6}/gi) ?? [];
}

describe('contraste de los botones sólidos', () => {
  it('el gradiente de los botones aguanta texto blanco en todo su recorrido', () => {
    const ends = stops('--brand-gradient-strong');
    expect(ends).toHaveLength(2);
    for (const end of ends) {
      expect(ratio(end, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('el botón primario usa ese gradiente, no el de las cabeceras', () => {
    const rule = global.match(/\.btn-primary \{[^}]+\}/)?.[0] ?? '';
    expect(rule).toContain('var(--brand-gradient-strong)');
  });

  // Documenta por qué existe el token fuerte: el original no da la talla para
  // texto pequeño, y por eso se queda solo en cabeceras con texto grande.
  it('el gradiente de marca original seguiría sin dar la talla', () => {
    const [lightest] = stops('--brand-gradient');
    expect(ratio(lightest, '#ffffff')).toBeLessThan(4.5);
  });

  it('el botón deshabilitado sigue siendo legible', () => {
    const disabled = tokens.match(/--disabled:\s*(#[0-9a-f]{6})/i)?.[1] ?? '';
    const rule = global.match(/\.btn-primary:disabled \{[^}]+\}/)?.[0] ?? '';
    const color = rule.match(/color:\s*(#[0-9a-f]{6})/i)?.[1] ?? '';
    expect(disabled).toBeTruthy();
    expect(color).toBeTruthy();
    expect(ratio(disabled, color)).toBeGreaterThanOrEqual(4.5);
  });
});
