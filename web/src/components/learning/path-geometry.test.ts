import { describe, expect, it } from 'vitest';

import { PATH_DEFAULTS, pathGeometry } from '@/components/learning/path-geometry';

describe('pathGeometry', () => {
  it('coloca un nodo por fase', () => {
    for (const n of [1, 2, 3, 7]) {
      expect(pathGeometry(n).points).toHaveLength(n);
    }
  });

  it('alterna los lados, empezando por la izquierda', () => {
    const { points } = pathGeometry(4);
    expect(points.map((p) => p.x)).toEqual([
      50 - PATH_DEFAULTS.amp,
      50 + PATH_DEFAULTS.amp,
      50 - PATH_DEFAULTS.amp,
      50 + PATH_DEFAULTS.amp,
    ]);
  });

  it('separa los centros por el paso indicado', () => {
    const { points } = pathGeometry(3);
    expect(points[1].y - points[0].y).toBe(PATH_DEFAULTS.stride);
    expect(points[0].y).toBe(PATH_DEFAULTS.padTop);
  });

  it('el atributo d arranca en M y trae una curva por tramo', () => {
    const { d } = pathGeometry(4);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.match(/C /g)).toHaveLength(3);
  });

  it('trae un tramo por cada par de fases vecinas, que arranca en la primera', () => {
    const { points, segments } = pathGeometry(4);
    expect(segments).toHaveLength(3);
    segments.forEach((seg, i) => {
      expect(seg.startsWith(`M ${points[i].x} ${points[i].y} C `)).toBe(true);
      expect(seg.endsWith(`${points[i + 1].x} ${points[i + 1].y}`)).toBe(true);
    });
  });

  it('con una sola fase no hay curva que dibujar', () => {
    const { d } = pathGeometry(1);
    expect(d.startsWith('M ')).toBe(true);
    expect(d).not.toContain('C ');
  });

  it('el alto reserva sitio para la etiqueta de la última fase', () => {
    const { height } = pathGeometry(3);
    expect(height).toBe(
      PATH_DEFAULTS.padTop + 2 * PATH_DEFAULTS.stride + PATH_DEFAULTS.node / 2 + 8 + PATH_DEFAULTS.labelHeight,
    );
  });

  /**
   * A 360px de viewport el contenido mide 324px (la página gasta 18 de padding
   * a cada lado). Una etiqueta que se saliera de ahí desbordaría la página, y
   * hay una prueba de navegador que falla cualquier desbordamiento mayor de 1px.
   */
  it('las etiquetas caben a 360px sin desbordar', () => {
    const ancho = 324;
    const label = 112; // el valor de --path-label en móvil
    const { points } = pathGeometry(3, { amp: 24 });
    for (const p of points) {
      const centro = (p.x / 100) * ancho;
      expect(centro - label / 2).toBeGreaterThanOrEqual(0);
      expect(centro + label / 2).toBeLessThanOrEqual(ancho);
    }
  });

  it('sin fases no devuelve nada que dibujar', () => {
    expect(pathGeometry(0)).toEqual({ height: 0, points: [], d: '', segments: [] });
  });
});
