import { expect, test } from '@playwright/test';

test.describe('compositor accesible de Comunidad', { tag: '@ios' }, () => {
  test.use({ viewport: { width: 360, height: 360 }, hasTouch: true });

  test('encierra el foco, cierra con Escape y lo devuelve al FAB', async ({ page }) => {
    await page.goto('/comunidad');
    await expect(page.getByText('Maestra Ana').first()).toBeVisible();
    const fab = page.getByRole('button', { name: 'Crear publicación' });
    await fab.click();

    const dialogo = page.getByRole('dialog', { name: 'Crear publicación' });
    const texto = dialogo.getByPlaceholder('¿Qué quieres compartir con la comunidad?');
    await expect(texto).toBeFocused();

    await texto.fill('Una experiencia del aula');
    await dialogo.getByRole('button', { name: 'Publicar' }).focus();
    await page.keyboard.press('Tab');
    await expect(dialogo.getByRole('button', { name: 'Cerrar compositor' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialogo.getByRole('button', { name: 'Publicar' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
    await expect(fab).toBeFocused();
  });
});
