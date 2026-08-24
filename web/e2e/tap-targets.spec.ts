import { expect, test, type Page } from '@playwright/test';

import { esquinasFallidas, LADO_MINIMO } from './fixtures/hit-area';

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
}[] = [
  { ruta: '/', rol: 'button', nombre: 'Siguiente' },
  { ruta: '/', rol: 'button', nombre: 'Ir a la pantalla 1 de 3' },
  { ruta: '/', rol: 'button', nombre: 'Ir a la pantalla 2 de 3' },
  { ruta: '/', rol: 'button', nombre: 'Ir a la pantalla 3 de 3' },
  { ruta: '/login', rol: 'button', nombre: '¿Olvidaste tu contraseña?' },
  { ruta: '/login', rol: 'button', nombre: 'Registrarse' },
  { ruta: '/register', rol: 'button', nombre: 'Volver' },
  { ruta: '/register', rol: 'button', nombre: 'Lugar 1, San Salvador', prepara: preparaSugerencia },
  { ruta: '/forgot-password', rol: 'button', nombre: 'Por correo' },
  { ruta: '/forgot-password', rol: 'button', nombre: 'Por teléfono' },
  {
    ruta: '/forgot-password',
    rol: 'button',
    nombre: '¿No recibiste el código? Reenviar',
    prepara: async (page) => {
      await page.getByPlaceholder('correo@ejemplo.com').fill('maria@ejemplo.com');
      await page.getByRole('button', { name: 'Enviar código' }).click();
      await expect(page.getByText('Código enviado a')).toBeVisible();
    },
  },
  { ruta: '/pendiente', rol: 'button', nombre: 'Volver al inicio de sesión' },
  // La barra de tabs del teléfono (PWA-1.4) ya nació con `min-height: 44px`.
  { ruta: '/main', rol: 'button', nombre: 'Inicio' },
  { ruta: '/main', rol: 'button', nombre: 'Explora' },
  { ruta: '/main', rol: 'button', nombre: 'Comunidad' },
  { ruta: '/main', rol: 'button', nombre: 'Perfil' },
  { ruta: '/main', rol: 'button', nombre: 'Más' },
  { ruta: '/main', rol: 'button', nombre: 'Ir a mi perfil', nota: 'avatar de la barra superior' },
  { ruta: '/descargas', rol: 'button', nombre: 'Descargar todo para usar sin conexión' },
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

      const locator = page.getByRole(control.rol, { name: control.nombre, exact: true });
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
