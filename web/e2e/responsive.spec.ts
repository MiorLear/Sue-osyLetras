import { expect, test, type Page } from '@playwright/test';

import { crearEvento, PANTALLAS, type Pantalla } from './fixtures/pantallas';

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
 * - `/herramientas`: NO desborda a ningún ancho. Desde que es una biblioteca,
 *   cada estante se desliza de lado dentro de su propia fila (`overflow-x:
 *   auto`), así que los libros que no caben no empujan la página. Lo que antes
 *   era el problema —títulos recortados a 79px— lo mide ahora el test de
 *   legibilidad de más abajo.
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

test.describe('legibilidad del contenido denso en teléfono', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  /**
   * La Caja de herramientas es ahora una biblioteca. En el teléfono cada
   * estante se desliza de lado DENTRO de sí mismo (la página no), así que lo
   * que hay que cuidar es que el libro no se encoja para caber: la tapa guarda
   * su ancho y el título se lee debajo, y la tarjeta de bibliografía ocupa la
   * fila entera en vez de partirse en columnas estrechas.
   */
  test('Herramientas no encoge los libros para que quepan', async ({ page }) => {
    await page.goto('/herramientas');
    const estante = page.getByRole('region', { name: 'Recursos descargables' });
    await expect(estante).toBeVisible();
    const libro = estante.getByRole('button').first();
    const tapa = await libro.locator('.book-cover').boundingBox();
    expect(tapa?.width ?? 0).toBeGreaterThanOrEqual(110);
    // Cuatro libros no caben a 360: el estante se desliza, no se aprieta.
    const fila = estante.locator('.shelf__row');
    const desliza = await fila.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(desliza).toBe(true);

    const ficha = page.locator('.biblio__card').first();
    const ancho = (await ficha.boundingBox())?.width ?? 0;
    expect(ancho).toBeGreaterThanOrEqual(260);
  });

  /**
   * Antes esto medía la sangría del acordeón dentro de `/aprendiendo`. El
   * acordeón se mudó a `/aprendiendo/:topicId` y «Practicar autocuidado» pasó a
   * recorrerse como mapa de fases, así que el sujeto cambió; la intención —que
   * el teléfono no regale ancho en sangrías— es la misma, y ahora se mide donde
   * el contenido vive de verdad: el panel de una fase abierta.
   */
  test('Aprendiendo no regala ancho en la fase abierta', async ({ page }) => {
    await page.goto('/aprendiendo/autocuidado');
    await page.getByRole('button', { name: /Fase 1: Cuidando mis emociones/ }).click();
    const cuerpo = page.getByText(/Las emociones forman parte de nuestra vida diaria/i).first();
    await expect(cuerpo).toBeVisible();
    const panel = page.locator('.learning-path__panel > div');
    const sangria = await panel.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    expect(sangria).toBeLessThan(58);
    expect(sangria).toBeGreaterThanOrEqual(18);
  });

  test('el compositor de Comunidad conserva cabecera y acción con el teclado abierto', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 360, height: 360 });
    await page.goto('/comunidad');
    await expect(page.getByText('Maestra Ana').first()).toBeVisible();
    await page.getByRole('button', { name: 'Crear publicación' }).click();

    const dialogo = page.getByRole('dialog', { name: 'Crear publicación' });
    const titulo = dialogo.getByRole('heading', { name: 'Crear publicación' });
    const texto = dialogo.getByPlaceholder('¿Qué quieres compartir con la comunidad?');
    const publicar = dialogo.getByRole('button', { name: 'Publicar' });
    const cuerpo = dialogo.locator('.modal-body');
    await expect(titulo).toBeInViewport();
    await expect(texto).toHaveCSS('font-size', '16px');
    await expect(publicar).toBeInViewport();

    const pieAntes = await publicar.boundingBox();
    await cuerpo.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const pieDespues = await publicar.boundingBox();
    expect(pieAntes).not.toBeNull();
    expect(pieDespues).not.toBeNull();
    expect(Math.abs(pieDespues!.y - pieAntes!.y)).toBeLessThanOrEqual(0.5);

    const contratoSafeArea = await dialogo.getAttribute('style');
    expect(contratoSafeArea).toContain('safe-area-inset-top');
    expect(contratoSafeArea).toContain('safe-area-inset-right');
    expect(contratoSafeArea).toContain('safe-area-inset-bottom');
    expect(contratoSafeArea).toContain('safe-area-inset-left');
  });

  test('cada día del mes publica la fecha completa', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByText(/^Hoy ·/)).toBeVisible();
    const dia = page.getByRole('button', { name: 'Día', exact: true });
    const mes = page.getByRole('button', { name: 'Mes', exact: true });
    await expect(dia).toHaveAttribute('aria-pressed', 'true');
    await crearEvento(page, 'Evento accesible del mes');
    await mes.click();
    await expect(dia).toHaveAttribute('aria-pressed', 'false');
    await expect(mes).toHaveAttribute('aria-pressed', 'true');
    const hoy = page.getByRole('button', { name: /\. 1 evento$/i });
    await expect(hoy).toHaveAttribute('aria-current', 'date');
    await expect(hoy).toHaveAttribute('aria-pressed', 'true');
  });

  test('el nombre del día avisa cuando su evento sigue pendiente', async ({ page, context }) => {
    await page.goto('/calendar');
    await expect(page.getByText(/^Hoy ·/)).toBeVisible();
    await context.setOffline(true);
    await crearEvento(page, 'Evento mensual sin conexión');
    await page.getByRole('button', { name: 'Mes', exact: true }).click();
    await expect(page.getByRole('button', { name: /\. 1 evento, 1 pendiente de enviar$/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
