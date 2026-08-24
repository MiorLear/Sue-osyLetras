import { expect, test, type Page } from '@playwright/test';

import { PANTALLAS, type Pantalla } from './fixtures/pantallas';

// La regla medible de "no desborda". Tres anchos que cubren el parque real de
// teléfonos: el suelo (360, el Android barato del aula), el medio (390) y el
// grande (414). Viewport EXPLÍCITO y nunca `devices['iPhone 12']`: los perfiles
// de dispositivo traen `isMobile` y su propio `deviceScaleFactor`, y con eso los
// números de un proyecto dejan de ser comparables con los de otro.
const ANCHOS = [
  { nombre: '360×740', width: 360, height: 740 },
  { nombre: '390×844', width: 390, height: 844 },
  { nombre: '414×896', width: 414, height: 896 },
];

/**
 * Rutas que HOY desbordan, con los anchos en los que lo hacen.
 *
 * Está vacío, y eso es un hallazgo, no un olvido. La planificación daba por
 * desbordadas dos pantallas y las dos se midieron aquí antes de marcarlas:
 *
 * - `/herramientas`: NO desborda a ningún ancho. La rejilla `1fr 1fr` sí
 *   estrangula la fila de medios, pero `.media-row__body` ya trae
 *   `min-width: 0` y `.media-row__title` es `nowrap` + elipsis, así que el
 *   exceso lo absorbe el recorte del texto en vez de empujar la página. El
 *   título útil se queda en 79px a 360, 109 a 390 y 133 a 414 (a "Herramientas
 *   para facilitación" le hacen falta 178). Es un problema real de LEGIBILIDAD
 *   y sigue siendo trabajo de C1+C2, pero `scrollWidth` no lo ve y no se puede
 *   fingir que sí.
 * - `/calendar` a 360: tampoco desborda. `.page-head` no lleva `flex-shrink: 0`
 *   ni `white-space: nowrap`, así que "Mi Calendario" parte en dos líneas y el
 *   bloque se queda en 165px de ancho; el botón "Nuevo evento" cabe al lado.
 *   Medido en las tres vistas (día, semana y mes) y con un evento creado.
 *
 * Cuando alguna vuelva a desbordar —o cuando aparezca una nueva— se añade aquí
 * con `test.fail()` y no con `test.skip()`: un skip es silencio, y el día que
 * la pantalla se arregla nadie se entera. `test.fail()` se pone rojo *cuando el
 * test empieza a pasar*, así que el commit que arregla la pantalla está
 * obligado a venir a borrar su línea. La lista es el pendiente, y se vacía sola.
 */
const DESBORDAN_HOY: Record<string, number[]> = {};

/**
 * Qué elemento se sale, con su selector y su borde derecho.
 *
 * Sin esto el fallo dice "algo desborda 12px" y la siguiente persona lo mira,
 * no sabe por dónde empezar, y lo salta. Con esto dice qué nodo y cuánto, y
 * arreglarlo pasa a ser más barato que ignorarlo.
 */
async function culpables(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limite = document.documentElement.clientWidth;
    const selector = (nodo: Element): string => {
      const partes: string[] = [];
      let n: Element | null = nodo;
      for (let i = 0; n && i < 4; i++) {
        let p = n.tagName.toLowerCase();
        if (n.id) p += `#${n.id}`;
        const clases = (n.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
        if (clases.length) p += '.' + clases.join('.');
        partes.unshift(p);
        n = n.parentElement;
      }
      return partes.join(' > ');
    };

    const fuera: { sel: string; right: number }[] = [];
    for (const nodo of Array.from(document.querySelectorAll('*'))) {
      const r = nodo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > limite + 1) fuera.push({ sel: selector(nodo), right: Math.round(r.right) });
    }
    fuera.sort((a, b) => b.right - a.right);
    // Ocho basta para reconocer el patrón; la lista entera de una rejilla rota
    // son cien nodos que dicen lo mismo.
    return fuera.slice(0, 8).map((f) => `  · ${f.sel} → right ${f.right}px (límite ${limite}px)`);
  });
}

async function sinDesbordamiento(page: Page, contexto: string): Promise<void> {
  // Las fuentes cambian el ancho de un título largo, así que medir antes de que
  // estén listas es medir otra página.
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const exceso = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const culpas = exceso > 1 ? await culpables(page) : [];
  const mensaje =
    `${contexto}: la página desborda ${exceso}px en horizontal.\n` +
    (culpas.length ? culpas.join('\n') : '  (ningún elemento suelto: mira los márgenes negativos)');

  // La tolerancia de 1px no es pereza: el redondeo subpíxel de un `1fr` deja
  // sobras de 0,5px que aparecen y desaparecen según el ancho, y es la causa
  // número uno de una suite de desbordamiento que parpadea y acaba ignorada.
  expect(exceso, mensaje).toBeLessThanOrEqual(1);
}

async function abrir(page: Page, pantalla: Pantalla): Promise<void> {
  // Nada de animaciones mientras se mide: un panel a medio entrar tiene un
  // ancho que no es el suyo. Y ningún `waitForTimeout` en todo el fichero — se
  // espera a hechos (el ancla, las fuentes), no al reloj.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pantalla.ruta);
  await expect(pantalla.ancla(page)).toBeVisible();
  await pantalla.prepara?.(page);
}

for (const ancho of ANCHOS) {
  test.describe(`a ${ancho.nombre}`, () => {
    test.use({
      viewport: { width: ancho.width, height: ancho.height },
      // Un teléfono tiene pantalla táctil, y hay CSS que depende de
      // `(pointer: coarse)`. Sin esto se mediría un escritorio estrecho.
      hasTouch: true,
    });

    for (const pantalla of PANTALLAS) {
      test(`${pantalla.nombre} no desborda`, async ({ page }) => {
        if (DESBORDAN_HOY[pantalla.ruta]?.includes(ancho.width)) test.fail();

        await abrir(page, pantalla);
        await sinDesbordamiento(page, `${pantalla.nombre} @ ${ancho.nombre}`);

        for (const variante of pantalla.variantes ?? []) {
          await variante.activa(page);
          await sinDesbordamiento(page, `${pantalla.nombre} · ${variante.nombre} @ ${ancho.nombre}`);
        }
      });
    }
  });
}
