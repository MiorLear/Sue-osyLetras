import { defineConfig } from '@playwright/test';
import { fileURLToPath, URL } from 'node:url';

// Puerta de navegador real para la app web. Existe porque el criterio "no
// desborda a 360/390/414" no se verifica a ojo: alguien mira una pantalla en
// DevTools, la ve bien, y la siguiente persona rompe otra.
//
// Ruta absoluta y no relativa: `storageState` la resuelve contra el cwd del
// proceso, y el cwd cambia según se lance `npm run e2e` desde web/ o
// `npm --prefix web run e2e` desde la raíz.
export const ARCHIVO_SESION = fileURLToPath(new URL('./e2e/.auth/docente.json', import.meta.url));

const CI = !!process.env.CI;
const PUERTO = 4173;
const baseURL = `http://127.0.0.1:${PUERTO}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  // Un `.only` olvidado en un commit deja la puerta abierta sin que nadie lo
  // note: en local es cómodo, en CI es un check verde que no probó nada.
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // El informe HTML es el que se sube como artefacto; el de GitHub es el que
  // pone la anotación en la línea del fichero dentro del PR. En local ninguno
  // de los dos cuenta lo que está pasando mientras pasa, de ahí `list`.
  reporter: CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    // Solo en el reintento: la traza cuesta tiempo y disco, y el 99% de las
    // pasadas son verdes.
    trace: 'on-first-retry',
    // Bloqueado POR DEFECTO. `sw.ts` hace `clientsClaim()`, así que el worker
    // toma el control en la primera carga y se pone a precachear en paralelo
    // con las medidas de ancho: el layout se mide mientras la página compite
    // por la red consigo misma y el resultado parpadea. El único spec que
    // necesita el worker de verdad —el recorrido offline— lo reactiva él solo.
    serviceWorkers: 'block',
  },

  projects: [
    {
      // Inicia sesión una vez por pasada y deja la sesión en disco, en vez de
      // repetir el login en cada uno de los ~50 tests.
      name: 'setup',
      testMatch: /auth\.setup\.ts$/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts$/,
      use: { browserName: 'chromium', storageState: ARCHIVO_SESION },
    },
    {
      // WebKit solo para lo etiquetado @ios: el zoom automático de 16px al
      // enfocar un input y el recorte de la tarjeta con el teclado abierto son
      // comportamientos de Safari. Probarlos únicamente en Chromium es no
      // probarlos. Lo demás sería pagar el doble por la misma información.
      name: 'webkit',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts$/,
      grep: /@ios/,
      use: { browserName: 'webkit', storageState: ARCHIVO_SESION },
    },
  ],

  webServer: {
    // `preview`, no `dev`: `vite.config.ts` tiene `devOptions.enabled: false`,
    // así que en desarrollo no se registra ningún service worker y el recorrido
    // offline sería imposible de escribir. Además `preview` sirve el mismo
    // bundle minificado que se despliega, que es el que hay que medir.
    //
    // El `build` queda fuera de este comando a propósito: en CI es un paso
    // aparte, para que compilar no se descuente del timeout del primer test.
    //
    // `--host 127.0.0.1` no es decoración: `vite preview` escucha en "localhost"
    // y en Windows eso resuelve solo a ::1, así que la sonda de Playwright
    // contra 127.0.0.1 agota los dos minutos sin conectar nunca. Fijar el host
    // hace que el arnés arranque igual en Windows y en el runner de Linux.
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
