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
  /** El atributo `d` del camino entero. */
  d: string;
  /**
   * Un `d` por tramo: `segments[i]` une la fase i con la i+1. El avance se
   * pinta tramo a tramo con estos, sin guiones ni `pathLength`: combinados con
   * `vector-effect="non-scaling-stroke"`, Chrome mide los guiones en pantalla y
   * no en el viewBox estirado, y la cola del camino salía pintada sin avance.
   */
  segments: string[];
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

  if (count <= 0) return { height: 0, points: [], d: '', segments: [] };

  const points: PathPoint[] = Array.from({ length: count }, (_, i) => ({
    // Los pares a la izquierda, para que el primero caiga donde empieza la lectura.
    x: i % 2 === 0 ? 50 - amp : 50 + amp,
    y: padTop + i * stride,
  }));

  // Bézier cúbica con los dos controles en el punto medio vertical: sale y
  // entra en vertical, y eso es lo que da la S limpia en vez de una diagonal.
  let d = `M ${points[0].x} ${points[0].y}`;
  const segments: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const midY = (from.y + to.y) / 2;
    const curve = `C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
    d += ` ${curve}`;
    segments.push(`M ${from.x} ${from.y} ${curve}`);
  }

  const height = padTop + (count - 1) * stride + node / 2 + 8 + labelHeight;
  return { height, points, d, segments };
}
