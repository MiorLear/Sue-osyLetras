import { expect, test, type Locator, type Page } from '@playwright/test';

import { esquinasFallidas, LADO_MINIMO } from './fixtures/hit-area';
import { crearEvento } from './fixtures/pantallas';

async function abrirPrimerHilo(page: Page): Promise<void> {
  await expect(page.getByText('Maestra Ana').first()).toBeVisible();
  await page.getByRole('button', { name: /Comentarios \(/ }).first().click();
  // `scrollIntoViewIfNeeded` considera visible lo que queda detrás de una
  // barra fija; centrarlo hace que el hit-test mida el control, no la barra.
  await page.getByRole('button', { name: 'Enviar comentario' }).evaluate((el) =>
    el.scrollIntoView({ block: 'center' }),
  );
}

async function abrirCompositor(page: Page): Promise<void> {
  await expect(page.getByText('Maestra Ana').first()).toBeVisible();
  await page.getByRole('button', { name: 'Crear publicación' }).click();
}

async function adjuntarImagen(page: Page): Promise<void> {
  await abrirCompositor(page);
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: 'aula.png',
    mimeType: 'image/png',
    buffer: Buffer.from('imagen de prueba'),
  });
  await expect(page.getByRole('button', { name: 'Quitar adjunto' })).toBeVisible();
}

async function crearTarea(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Nuevo evento' }).click();
  await page.getByPlaceholder('Nombre del evento').fill('Tarea táctil');
  await page.getByRole('combobox').first().selectOption('tarea');
  await page.getByRole('button', { name: 'Guardar evento' }).click();
  await expect(page.getByRole('button', { name: 'Marcar como completada: Tarea táctil' })).toBeVisible();
}

async function abrirDetalleEvento(page: Page): Promise<void> {
  await crearEvento(page, 'Evento táctil');
  await page.getByRole('button', { name: /Evento táctil/ }).click();
}

async function abrirHojaMas(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Más' }).click();
  await expect(page.getByRole('dialog', { name: 'Más secciones' })).toBeVisible();
}

const hojaMas = (page: Page): Locator => page.getByRole('dialog', { name: 'Más secciones' });

async function preparaSugerencia(page: Page): Promise<void> {
  await page.route('https://photon.komoot.io/api/**', (route) =>
    route.fulfill({
      json: {
        features: [{ properties: { name: 'Lugar 1', city: 'San Salvador', countrycode: 'sv' } }],
      },
    }),
  );
  await page.getByRole('button', { name: /Correo y contraseña/ }).click();
  await page.getByPlaceholder('correo@ejemplo.com').fill('nueva@ejemplo.com');
  await page.getByPlaceholder('Mínimo 8 caracteres').fill('segura123');
  await page.getByPlaceholder('Repite tu contraseña').fill('segura123');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByPlaceholder('Busca tu ubicación').fill('San');
  await expect(page.getByRole('group', { name: 'Sugerencias de ubicación' })).toBeVisible();
}

/**
 * Zonas táctiles de 44×44.
 *
 * La lista es explícita —(ruta, rol, nombre)— y no "todos los botones de la
 * app" a propósito: la lista ES la documentación de qué se auditó. Un bucle
 * sobre `page.getByRole('button')` da un número que sube y baja solo, no dice
 * qué control concreto se revisó, y el día que alguien añade un botón pequeño
 * la suite se pone roja en un sitio que nadie eligió mirar.
 *
 * De momento solo están los controles que YA cumplen: sirven de red para que no
 * se rompan al mover CSS. C2, C3 y C4 amplían esta tabla con los controles que
 * cada uno agranda (los enlaces de Login, el botón de volver de Register y de
 * EmotionDetail, las seis zonas de Comunidad, las cinco del calendario y el
 * botón de cámara de Perfil), y ese crecimiento es la prueba de que el ticket
 * hizo lo que dijo.
 */
const CONTROLES: {
  ruta: string;
  rol: 'button' | 'link';
  nombre: string;
  nota?: string;
  prepara?: (page: Page) => Promise<void>;
  scope?: (page: Page) => Locator;
}[] = [
  { ruta: '/', rol: 'button', nombre: 'Siguiente' },
  // Dos pantallas desde que el cliente pidió quitar "¿Cómo funciona?".
  { ruta: '/', rol: 'button', nombre: 'Ir a la pantalla 1 de 2' },
  { ruta: '/', rol: 'button', nombre: 'Ir a la pantalla 2 de 2' },
  { ruta: '/login', rol: 'button', nombre: '¿Olvidaste tu contraseña?' },
  { ruta: '/login', rol: 'button', nombre: 'Crear mi cuenta' },
  { ruta: '/register', rol: 'button', nombre: 'Volver' },
  { ruta: '/register', rol: 'button', nombre: 'Lugar 1, San Salvador', prepara: preparaSugerencia },
  {
    ruta: '/forgot-password',
    rol: 'button',
    nombre: '¿No recibiste el correo? Reenviar enlace',
    prepara: async (page) => {
      await page.getByPlaceholder('correo@ejemplo.com').fill('maria@ejemplo.com');
      await page.getByRole('button', { name: 'Enviar enlace' }).click();
      await expect(page.getByText('Revisa tu correo')).toBeVisible();
    },
  },
  { ruta: '/pendiente', rol: 'button', nombre: 'Volver al inicio de sesión' },
  { ruta: '/emociones/alegria', rol: 'button', nombre: 'Volver' },
  // Aprendiendo: el nodo del mapa, el botón de completar una fase y los tres
  // controles del mazo de tarjetas.
  {
    ruta: '/aprendiendo/autocuidado',
    rol: 'button',
    nombre: 'Fase 1: Cuidando mis emociones. En curso',
    nota: 'nodo del mapa',
  },
  {
    ruta: '/aprendiendo/autocuidado',
    rol: 'button',
    nombre: 'Marcar esta fase como completada',
    prepara: async (page) => {
      await page.getByRole('button', { name: /Fase 1:/ }).click();
    },
  },
  { ruta: '/aprendiendo/aula', rol: 'button', nombre: 'Tarjeta siguiente' },
  { ruta: '/aprendiendo/aula', rol: 'button', nombre: 'Tarjeta anterior' },
  // Los puntos solo se dibujan hasta ocho tarjetas; pasadas esas se cambian por
  // un contador de texto. «Aprendiendo » en el aula da nueve, así que el punto
  // se audita en el tema que sí los enseña.
  { ruta: '/aprendiendo/salud-mental', rol: 'button', nombre: 'Tarjeta 2 de 6', nota: 'punto del mazo' },
  // La barra de tabs del teléfono (PWA-1.4) ya nació con `min-height: 44px`.
  // Las pestañas son Inicio y los tres módulos de ExplorArte: el documento de
  // estructura los marca como principales y antes dos vivían detrás de "Más".
  { ruta: '/main', rol: 'button', nombre: 'Inicio' },
  { ruta: '/main', rol: 'button', nombre: 'Emociones' },
  { ruta: '/main', rol: 'button', nombre: 'Herramientas' },
  { ruta: '/main', rol: 'button', nombre: 'Aprendiendo' },
  { ruta: '/main', rol: 'button', nombre: 'Más' },
  // Comunidad y Perfil ya no son pestaña, pero siguen teniendo que ser
  // alcanzables con el dedo desde la hoja de "Más".
  { ruta: '/main', rol: 'button', nombre: 'Comunidad', prepara: abrirHojaMas, scope: hojaMas },
  { ruta: '/main', rol: 'button', nombre: 'Perfil', prepara: abrirHojaMas, scope: hojaMas },
  { ruta: '/main', rol: 'button', nombre: 'Ir a mi perfil', nota: 'avatar de la barra superior' },
  { ruta: '/descargas', rol: 'button', nombre: 'Descargar todo para usar sin conexión' },
  { ruta: '/comunidad', rol: 'button', nombre: 'Crear publicación' },
  {
    ruta: '/comunidad', rol: 'button', nombre: 'Comentarios (2)',
    // Hay una acción por publicación; se audita la tarjeta nombrada, no una
    // coincidencia arbitraria de toda la página.
    scope: (page) => page.getByRole('article').filter({ hasText: 'Maestra Ana' }),
  },
  {
    ruta: '/comunidad', rol: 'button', nombre: 'Me gusta',
    scope: (page) => page.getByRole('article').filter({ hasText: 'Maestra Ana' }),
  },
  { ruta: '/comunidad', rol: 'button', nombre: 'Enviar comentario', prepara: abrirPrimerHilo },
  { ruta: '/comunidad', rol: 'button', nombre: 'Cerrar compositor', prepara: abrirCompositor },
  { ruta: '/comunidad', rol: 'button', nombre: 'Imagen', prepara: abrirCompositor },
  { ruta: '/comunidad', rol: 'button', nombre: 'Video', prepara: abrirCompositor },
  { ruta: '/comunidad', rol: 'button', nombre: 'Quitar adjunto', prepara: adjuntarImagen },
  { ruta: '/calendar', rol: 'button', nombre: 'Día' },
  { ruta: '/calendar', rol: 'button', nombre: 'Semana' },
  { ruta: '/calendar', rol: 'button', nombre: 'Mes' },
  { ruta: '/calendar', rol: 'button', nombre: 'Cerrar modal', prepara: (page) => page.getByRole('button', { name: 'Nuevo evento' }).click() },
  { ruta: '/calendar', rol: 'button', nombre: 'Cancelar', prepara: (page) => page.getByRole('button', { name: 'Nuevo evento' }).click() },
  { ruta: '/calendar', rol: 'button', nombre: 'Guardar evento', prepara: (page) => page.getByRole('button', { name: 'Nuevo evento' }).click() },
  { ruta: '/calendar', rol: 'button', nombre: 'Editar', prepara: abrirDetalleEvento },
  { ruta: '/calendar', rol: 'button', nombre: 'Eliminar', prepara: abrirDetalleEvento },
  { ruta: '/calendar', rol: 'button', nombre: 'Cerrar', prepara: abrirDetalleEvento },
  { ruta: '/calendar', rol: 'button', nombre: 'Marcar como completada: Tarea táctil', prepara: crearTarea },
  { ruta: '/profile', rol: 'button', nombre: 'Cambiar foto de perfil' },
];

test.describe(`zonas táctiles de ${LADO_MINIMO}px`, () => {
  // 390 es el ancho medio: ni el peor caso ni el cómodo. Una zona táctil que
  // falla aquí falla en todas partes.
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const control of CONTROLES) {
    const etiqueta = control.nota ? `${control.nombre} (${control.nota})` : control.nombre;
    test(`${control.ruta} · ${etiqueta}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(control.ruta);
      await control.prepara?.(page);

      const raiz = control.scope?.(page) ?? page;
      const locator = raiz.getByRole(control.rol, { name: control.nombre, exact: true });
      await expect(locator).toHaveCount(1);
      await expect(locator).toBeVisible();

      const fallos = await esquinasFallidas(locator);
      expect(
        fallos,
        `${control.ruta} · ${etiqueta}: estas esquinas del cuadrado de ${LADO_MINIMO}px no ` +
          `pertenecen al control, así que el dedo falla ahí:\n  ${fallos.join('\n  ')}`,
      ).toEqual([]);
    });
  }
});
