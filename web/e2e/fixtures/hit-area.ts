import type { Locator } from '@playwright/test';

/**
 * Estándar del proyecto para un objetivo táctil. Coincide con la guía de
 * Apple y con el criterio mejorado 2.5.5 (AAA) de WCAG; WCAG 2.2 AA exige 24px.
 */
export const LADO_MINIMO = 44;

/**
 * Comprueba que un control se puede pulsar en un cuadrado de 44×44 centrado en
 * él, tocando las CUATRO esquinas con `document.elementFromPoint`.
 *
 * Por qué no vale `boundingBox()`: la ampliación que va a usar el bloque —
 * `.hit-44` — crece con un pseudo-elemento, y un `::after` no existe en el
 * modelo de caja del elemento. Un botón de 24×24 con `.hit-44` seguiría
 * midiendo 24×24 para `boundingBox()` mientras el dedo ya acierta en 44. La
 * prueba de verdad es la del navegador: pinchar el punto y ver quién contesta.
 *
 * Y son las cuatro esquinas, no el centro: el centro acierta siempre. Lo que se
 * mide es si el rectángulo entero pertenece al control o si un vecino demasiado
 * cerca se ha quedado con media zona —el caso de dos `.hit-44` separados por
 * menos de 44px, donde el usuario pulsa "Video" y sale "Imagen".
 *
 * Cada esquina se mete hacia dentro lo que el propio `border-radius` recorta.
 * No es una concesión: el navegador NO entrega el clic en la esquina de un
 * botón redondeado, así que exigirla suspendería a todos los controles de la
 * app por tener las esquinas romas. Lo que interesa no es la esquina
 * geométrica, es que la zona llegue hasta ahí y no se la quede el vecino.
 */
export async function esquinasFallidas(control: Locator): Promise<string[]> {
  await control.scrollIntoViewIfNeeded();
  const caja = await control.boundingBox();
  if (!caja) return ['el control no tiene caja: ¿está oculto?'];

  const centro = { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2, lado: LADO_MINIMO };

  return control.evaluate((el, c: { x: number; y: number; lado: number }) => {
    const estilo = getComputedStyle(el);
    const pseudo = getComputedStyle(el, '::after');
    const numero = (valor: string) => parseFloat(valor) || 0;

    // Las cuatro esquinas detectan solapamientos, pero por sí solas no prueban
    // el tamaño: acercarlas para respetar un border-radius podría dejar pasar
    // un control de 38px. Primero se exige una caja real o un pseudo-elemento
    // de al menos 44px en ambos ejes; después se comprueba quién recibe el dedo.
    const caja = el.getBoundingClientRect();
    const cajaCumple = caja.width >= c.lado && caja.height >= c.lado;
    const pseudoAncho = numero(pseudo.width);
    const pseudoAlto = numero(pseudo.height);
    const pseudoCumple = pseudoAncho >= c.lado && pseudoAlto >= c.lado;
    const malas: string[] = [];
    if (!cajaCumple && !pseudoCumple) {
      malas.push(
        `caja ${Math.round(caja.width)}×${Math.round(caja.height)}px y pseudo ` +
          `${Math.round(pseudoAncho)}×${Math.round(pseudoAlto)}px; hacen falta ` +
          `${c.lado}×${c.lado}px en una misma zona`,
      );
    }
    // 0,3·r cubre de sobra lo que la curva recorta en cada eje (el valor exacto
    // es r·(1−1/√2)/√2 ≈ 0,21·r), y un píxel de suelo para el redondeo subpíxel.
    const dentro = (radio: string) => Math.max(1, Math.ceil(0.3 * (parseFloat(radio) || 0)));
    const m = c.lado / 2 - 1;

    const puntos: [string, number, number][] = [
      ['sup-izq', c.x - m + dentro(estilo.borderTopLeftRadius), c.y - m + dentro(estilo.borderTopLeftRadius)],
      ['sup-der', c.x + m - dentro(estilo.borderTopRightRadius), c.y - m + dentro(estilo.borderTopRightRadius)],
      ['inf-izq', c.x - m + dentro(estilo.borderBottomLeftRadius), c.y + m - dentro(estilo.borderBottomLeftRadius)],
      ['inf-der', c.x + m - dentro(estilo.borderBottomRightRadius), c.y + m - dentro(estilo.borderBottomRightRadius)],
    ];

    const describe = (n: Element | null) => {
      if (!n) return 'nada (fuera de la ventana)';
      const cls = (n.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0];
      return n.tagName.toLowerCase() + (cls ? `.${cls}` : '');
    };

    for (const [esquina, x, y] of puntos) {
      const alcanzado = document.elementFromPoint(x, y);
      // `el.contains(alcanzado)` y no la igualdad: dentro de un botón suele
      // haber un `<span>` con el icono, y pulsar el icono pulsa el botón. Lo
      // que NO vale es acertar en un ANCESTRO: ahí el clic no llega al control.
      if (!alcanzado || !el.contains(alcanzado)) {
        malas.push(`${esquina} (${Math.round(x)},${Math.round(y)}) → ${describe(alcanzado)}`);
      }
    }
    return malas;
  }, centro);
}
