// Dónde va cada nodo del mapa de fases y por dónde pasa el camino.
//
// Puro y aparte del componente: la geometría se prueba con números, sin montar
// nada ni medir el DOM.
//
// La x va en tanto por ciento y la y en píxeles. Esa mezcla es deliberada: el
// SVG se dibuja con `preserveAspectRatio="none"` para que la x se estire con el
// ancho disponible, y `vector-effect="non-scaling-stroke"` mantiene el trazo a
// su grosor real pese a esa escala no uniforme. Es lo que evita tener que medir
// el contenedor con un ResizeObserver.

export interface PathPoint {
  /** 0–100, en porcentaje del ancho. */
  x: number;
  /** píxeles desde arriba. */
  y: number;
}

export interface PathGeometry {
  height: number;
  points: PathPoint[];
  /** El atributo `d`, con `pathLength=1` para que el avance sea una fracción exacta. */
  d: string;
}

export interface PathOptions {
  /** Distancia vertical entre centros. */
  stride?: number;
  /** Diámetro del nodo. */
  node?: number;
  /** Cuánto se desvía del centro, en porcentaje del ancho. */
  amp?: number;
  /** Alto reservado bajo el último nodo para su etiqueta. */
  labelHeight?: number;
  padTop?: number;
}

export const PATH_DEFAULTS: Required<PathOptions> = {
  stride: 132,
  node: 68,
  amp: 26,
  labelHeight: 52,
  padTop: 40,
};

/**
 * La serpiente, vertical a todos los tamaños.
 *
 * Horizontal se descartó: a 360px pediría scroll lateral, y hay una prueba de
 * extremo a extremo que falla cualquier página que se desborde más de 1px.
 */
export function pathGeometry(count: number, opts: PathOptions = {}): PathGeometry {
  const { stride, node, amp, labelHeight, padTop } = { ...PATH_DEFAULTS, ...opts };

  if (count <= 0) return { height: 0, points: [], d: '' };

  const points: PathPoint[] = Array.from({ length: count }, (_, i) => ({
    // Los pares a la izquierda, para que el primero caiga donde empieza la lectura.
    x: i % 2 === 0 ? 50 - amp : 50 + amp,
    y: padTop + i * stride,
  }));

  // Bézier cúbica con los dos controles en el punto medio vertical: sale y
  // entra en vertical, y eso es lo que da la S limpia en vez de una diagonal.
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const midY = (from.y + to.y) / 2;
    d += ` C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
  }

  const height = padTop + (count - 1) * stride + node / 2 + 8 + labelHeight;
  return { height, points, d };
}

/**
 * La fracción de camino recorrida.
 *
 * Con `pathLength={1}` en el SVG, esto es directamente el `strokeDashoffset`
 * que hay que restar: un número exacto, sin medir longitudes de curva.
 */
export function pathProgress(done: number, count: number): number {
  if (count <= 1) return done > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, done / (count - 1)));
}
