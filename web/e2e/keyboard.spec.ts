import { expect, test, type Page } from '@playwright/test';

import { necesitaSinSesion, SIN_SESION } from './fixtures/pantallas';

/**
 * Las cinco pantallas de entrada con el teclado abierto.
 *
 * NO SE PUEDE SIMULAR UN TECLADO DE VERDAD, y prefiero decirlo a fingirlo:
 * Playwright no abre el teclado virtual del sistema, `visualViewport` no se
 * encoge y no hay API para provocarlo. Un test que dijera "con el teclado
 * abierto" y no lo tuviera sería peor que no tenerlo, porque daría por cubierto
 * un caso que nadie probó.
 *
 * Lo que sí se puede reproducir es su EFECTO, que es lo que rompe la pantalla:
 * el alto útil se queda en un tercio. De ahí el viewport de 360×360 —un iPhone
 * de 844px con el teclado y la barra de Safari puestos deja algo así— y de ahí
 * las tres preguntas que se hacen aquí:
 *
 *   1. ¿La tarjeta sigue empezando dentro de la pantalla? Con `align-items:
 *      center` y el contenido más alto que el contenedor, el sobrante se va
 *      MITAD ARRIBA Y MITAD ABAJO, y hacia arriba no se puede scrollear: el
 *      título y el primer campo quedan cortados para siempre.
 *   2. ¿Se llega al botón de envío?
 *   3. ¿Los campos miden 16px? Por debajo de 16, Safari hace zoom solo al
 *      enfocarlos, y ESE zoom es el "desbordamiento" que la docente describe.
 *
 * Va etiquetado @ios porque las tres son conductas de Safari; el proyecto
 * webkit del config existe para esta etiqueta.
 */

interface PantallaAuth {
  nombre: string;
  ruta: string;
  /** Botón que cierra el paso; el que tiene que quedar al alcance. */
  envio: string;
  /** Si la pantalla tiene campos de texto que Safari puede ampliar. */
  conCampos: boolean;
  prepara?: (page: Page) => Promise<void>;
}

const PANTALLAS_AUTH: PantallaAuth[] = [
  { nombre: 'Onboarding', ruta: '/', envio: 'Siguiente', conCampos: false },
  { nombre: 'Login', ruta: '/login', envio: 'Iniciar sesión', conCampos: true },
  {
    nombre: 'Registro',
    ruta: '/register',
    envio: 'Siguiente',
    conCampos: true,
    // El paso 0 solo ofrece los tres métodos; los campos viven en el siguiente.
    prepara: async (page) => {
      await page.getByRole('button', { name: /Correo y contraseña/ }).click();
      await expect(page.getByPlaceholder('Mínimo 8 caracteres')).toBeVisible();
    },
  },
  { nombre: 'Recuperar contraseña', ruta: '/forgot-password', envio: 'Enviar enlace', conCampos: true },
  { nombre: 'Cuenta sin acceso', ruta: '/pendiente', envio: 'Volver al inicio de sesión', conCampos: false },
];

async function abrir(page: Page, pantalla: PantallaAuth): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pantalla.ruta);
  await expect(page.locator('.auth-card')).toBeVisible();
  await pantalla.prepara?.(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test.describe('con el alto de un teclado abierto', { tag: '@ios' }, () => {
  test.use({ viewport: { width: 360, height: 360 }, hasTouch: true });

  for (const pantalla of PANTALLAS_AUTH) {
    test.describe(() => {
      if (necesitaSinSesion(pantalla.ruta)) test.use({ storageState: SIN_SESION });
      test(`${pantalla.nombre}: la tarjeta no se recorta por arriba`, async ({ page }) => {
        await abrir(page, pantalla);
        const caja = await page.locator('.auth-card').boundingBox();
        const layout = await page.locator('.auth-card').evaluate((card) => ({
          viewport: window.innerWidth,
          shellAlign: getComputedStyle(card.parentElement!).alignItems,
          marginBlock: getComputedStyle(card).marginBlock,
        }));
        expect(caja).not.toBeNull();
        expect(
          caja!.y,
          `${pantalla.nombre}: la tarjeta empieza en y=${Math.round(caja!.y)}. ` +
            `Viewport ${layout.viewport}px, align-items ${layout.shellAlign}, margen ${layout.marginBlock}. ` +
            'Todo lo que quede por encima de 0 es inalcanzable: hacia arriba no hay scroll.',
        ).toBeGreaterThanOrEqual(0);
      });

      test(`${pantalla.nombre}: se llega al botón "${pantalla.envio}"`, async ({ page }) => {
        await abrir(page, pantalla);
        const boton = page.getByRole('button', { name: pantalla.envio, exact: true });
        await boton.scrollIntoViewIfNeeded();
        await expect(boton).toBeInViewport();
      });

      if (pantalla.conCampos) {
        test(`${pantalla.nombre}: los campos miden 16px o más`, async ({ page }) => {
          await abrir(page, pantalla);
          const tamanos = await page
            .locator('.input')
            .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));

          expect(tamanos.length, 'la pantalla dice tener campos y no se encontró ninguno').toBeGreaterThan(0);
          expect(
            Math.min(...tamanos),
            `${pantalla.nombre}: campos a ${tamanos.join('/')}px. Por debajo de 16, Safari amplía la ` +
              'página al enfocar y ya no se vuelve del zoom.',
          ).toBeGreaterThanOrEqual(16);
        });
      }
    });
  }

  test('Registro: las sugerencias de ubicación no consumen más de 30dvh', async ({ page }) => {
    await page.route('https://photon.komoot.io/api/**', (route) =>
      route.fulfill({
        json: {
          features: Array.from({ length: 6 }, (_, i) => ({
            properties: { name: `Lugar ${i + 1}`, city: 'San Salvador', countrycode: 'sv' },
          })),
        },
      }),
    );
    await page.goto('/register');
    await page.getByRole('button', { name: /Correo y contraseña/ }).click();
    await page.getByPlaceholder('correo@ejemplo.com').fill('nueva@ejemplo.com');
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('segura123');
    await page.getByPlaceholder('Repite tu contraseña').fill('segura123');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByPlaceholder('Busca tu ubicación').fill('San');

    const panel = page.getByRole('group', { name: 'Sugerencias de ubicación' });
    await expect(panel.getByRole('button', { name: 'Lugar 1, San Salvador' })).toBeVisible();
    const caja = await panel.boundingBox();
    expect(caja).not.toBeNull();
    expect(caja!.height).toBeLessThanOrEqual(108);
  });
});
