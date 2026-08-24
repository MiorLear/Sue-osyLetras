import { expect, test } from '@playwright/test';

/**
 * El carrusel de bienvenida, y la lectura elegida de "works with touch".
 *
 * La decisión, tomada con el dueño antes de escribir código: los tres puntos
 * pasan a ser CONTROLES PULSABLES, y no se añade swipe. El hueco real de la
 * pantalla no es que falte un gesto, es que hay tres elementos con toda la
 * afordancia de un control —posición, forma, el activo resaltado— que hoy son
 * `<span>`: no salen en el árbol de accesibilidad, no se pueden tabular y no
 * responden al dedo. Añadir swipe encima introduciría el único gesto de toda la
 * app, descubrible por nadie y con dos caminos que mantener en vez de uno.
 *
 * Este spec es el contrato de esa decisión. CONTRATO PARA C2:
 *   - cada punto es un `<button type="button">`;
 *   - con `aria-label="Ir a la pantalla N de 3"` (N empezando en 1);
 *   - y el que corresponde a la vista actual lleva `aria-current="true"`.
 *
 * Va con `test.fail()` hasta que C2 los convierta. No hay test de swipe porque
 * no hay swipe: la ausencia de gesto es la decisión, no un olvido.
 */

const TOTAL = 3;
const punto = (n: number) => `Ir a la pantalla ${n} de ${TOTAL}`;

test.describe('carrusel del onboarding', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bienvenida a ExplorArte' })).toBeVisible();
  });

  test('cada punto es un botón que lleva a su pantalla', async ({ page }) => {
    test.fail();

    for (let n = 1; n <= TOTAL; n++) {
      await expect(page.getByRole('button', { name: punto(n) })).toBeVisible();
    }

    await page.getByRole('button', { name: punto(3) }).click();
    await expect(page.getByRole('heading', { name: '¿Cómo funciona?' })).toBeVisible();

    await page.getByRole('button', { name: punto(1) }).click();
    await expect(page.getByRole('heading', { name: 'Bienvenida a ExplorArte' })).toBeVisible();
  });

  test('el punto de la pantalla visible se anuncia como el actual', async ({ page }) => {
    test.fail();

    await expect(page.getByRole('button', { name: punto(1) })).toHaveAttribute('aria-current', 'true');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('button', { name: punto(2) })).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('button', { name: punto(1) })).not.toHaveAttribute('aria-current', 'true');
  });
});
