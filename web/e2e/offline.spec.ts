import { expect, test } from '@playwright/test';

/**
 * El recorrido que PWA-5.0 va a exigir igualmente: escribir sin conexión en un
 * navegador de verdad y ver que el cambio sale solo cuando la red vuelve.
 *
 * Único spec con el service worker permitido. En los demás está bloqueado
 * porque `clientsClaim()` hace que tome el control en la primera carga y se
 * ponga a precachear a la vez que se miden anchos; aquí es justo al revés: sin
 * worker no hay nada que probar.
 *
 * Funciona contra el cliente simulado por una razón concreta: en modo mock
 * `probeUrl()` devuelve null (`src/lib/useNetworkStatus.ts`), así que la app no
 * sondea nada y `navigator.onLine` es toda la verdad — que es exactamente lo
 * que `context.setOffline()` controla. Con `VITE_API_URL` puesto haría falta
 * además cortar el sondeo, y el test dejaría de ser sobre la bandeja de salida
 * para pasar a ser sobre el detector de red.
 */

test.describe('escribir sin conexión', () => {
  test.use({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 }, hasTouch: true });

  test('un evento creado sin red se marca "Sin enviar" y sale al reconectar', async ({
    page,
    context,
  }) => {
    const titulo = 'Sesión escrita sin conexión';

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/calendar');

    // Que el worker exista no basta: hasta que CONTROLA la página, cortar la
    // red deja a la pestaña sin nada que la sirva y el test mediría otra cosa.
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    // Y que termine de precachear, para no cortar la red a mitad de descarga.
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/^Hoy ·/)).toBeVisible();

    await context.setOffline(true);
    // Una mutación en el documento ya cargado no demuestra que la PWA pueda
    // arrancar sin red: seguiría pasando aunque el precache estuviera roto.
    // Recargar obliga al service worker a servir el shell y sus recursos.
    await page.reload();
    await expect(page.getByText(/^Hoy ·/)).toBeVisible();
    // Chromium no vuelve a emitir `offline` al documento nuevo cuando la
    // navegación la respondió un service worker. La red sigue cortada de verdad;
    // se repone solo la señal que el detector de la app escucha en un dispositivo.
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByText(/^Sin conexión/)).toBeVisible();

    await page.getByRole('button', { name: 'Nuevo evento' }).click();
    await page.getByPlaceholder('Nombre del evento').fill(titulo);
    await page.getByRole('button', { name: 'Guardar evento' }).click();

    // Lo que la docente necesita saber es "¿se guardó o no?". La respuesta es
    // que sí, y que todavía no ha salido; por eso lleva texto y no solo color.
    await expect(page.getByText(titulo)).toBeVisible();
    // `exact` separa el badge del enlace de navegación "Cambios sin enviar".
    // La ambigüedad importa: un locator estricto que encuentra los dos no está
    // comprobando ninguno, aunque a una persona le parezcan textos distintos.
    await expect(page.getByText('Sin enviar', { exact: true })).toBeVisible();

    await context.setOffline(false);
    // Pareja de la reposición anterior: Playwright tampoco emite `online` si
    // su Navigator nunca cambió de valor, aunque la red del contexto sí vuelva.
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // La bandeja se vacía sola: el planificador escucha el evento `online`. Si
    // la marca no desaparece, el trabajo se quedó en la tablet.
    await expect(page.getByText('Sin enviar', { exact: true })).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText(titulo)).toBeVisible();
  });
});
