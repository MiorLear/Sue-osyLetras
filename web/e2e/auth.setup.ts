import { expect, test as setup } from '@playwright/test';

import { ARCHIVO_SESION } from '../playwright.config';

// Sin `VITE_API_URL` la app arranca contra el cliente simulado
// (`shared/src/api/mock/index.ts`), que resuelve la cuenta por correo y acepta
// cualquier contraseña para un correo del seed. Por eso el login va por la UI y
// no inyectando el token a mano: si algún día el flujo de entrada se rompe, el
// arnés entero se pone rojo en el primer paso en vez de medir pantallas a las
// que la docente ya no podía llegar.
const CORREO_DOCENTE = 'maria@ejemplo.com';
const CONTRASENA = 'cualquier-cosa';

// La franja de instalación se ancla abajo y se pone justo encima del FAB y de
// la barra de tabs. Aparece en cuanto hay sesión, así que sin posponerla estaría
// en pantalla en las ~50 medidas de ancho y de zona táctil, tapando controles y
// añadiendo un elemento fijo a cada captura.
const CLAVE_SNOOZE = 'explorarte.install.snoozed-until';
// Una fecha fija y absurdamente lejana en vez de `Date.now() + n días`: el
// fichero de sesión se regenera en cada pasada, pero si alguien lo reutiliza a
// mano no quiero que la diferencia entre verde y rojo sea cuántos días pasaron.
const SNOOZE_HASTA_2100 = String(Date.UTC(2100, 0, 1));

setup('inicia sesión como docente y guarda la sesión', async ({ page }) => {
  await page.goto('/login');

  await page.getByPlaceholder('correo@ejemplo.com').fill(CORREO_DOCENTE);
  await page.getByPlaceholder('Tu contraseña').fill(CONTRASENA);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page).toHaveURL(/\/main$/);

  await page.evaluate(
    ([clave, valor]) => localStorage.setItem(clave, valor),
    [CLAVE_SNOOZE, SNOOZE_HASTA_2100],
  );

  // Se comprueba que la semilla hace su trabajo en vez de darlo por hecho: si
  // la clave cambia de nombre en `InstallPrompt.tsx`, el fallo tiene que salir
  // aquí y decir por qué, no repartido por veinte medidas de ancho que de
  // pronto tienen 60px de más abajo.
  await page.reload();
  await expect(page.locator('.install-banner')).toHaveCount(0);

  // La sesión vive en IndexedDB desde PWA-4.1. El valor por defecto de
  // storageState solo guarda cookies/localStorage y dejaría a los proyectos
  // dependientes desconectados aunque el login de setup hubiera funcionado.
  await page.context().storageState({ path: ARCHIVO_SESION, indexedDB: true });
});
