import { expect, type Locator, type Page } from '@playwright/test';

/**
 * La tabla única de pantallas del arnés.
 *
 * Vive aparte de los specs porque la misma lista la recorren varias puertas
 * distintas, y una lista duplicada es una lista que se queda a medias: la
 * pantalla nueva se añade a la copia que el autor tenía delante y las demás
 * siguen creyendo que no existe.
 *
 * Las de admin quedan fuera a propósito: la consola es de escritorio por
 * diseño —lo dice hasta la nota de `globIgnores` en `vite.config.ts`— y medirla
 * a 360px sería exigirle un criterio que nadie le pidió.
 */
export interface Pantalla {
  /** Cómo se llama en el título del test. */
  nombre: string;
  ruta: string;
  /**
   * Algo que solo existe cuando la pantalla terminó de pintar SUS DATOS, no su
   * esqueleto. El cliente simulado mete 120ms de latencia artificial
   * (`shared/src/api/mock/index.ts`), así que medir el ancho nada más navegar
   * mide el estado de carga, que casi siempre cabe.
   */
  ancla: (page: Page) => Locator;
  /** Deja la pantalla en el estado que merece la pena medir. */
  prepara?: (page: Page) => Promise<void>;
  /** Otros estados de la MISMA ruta que también hay que medir. */
  variantes?: { nombre: string; activa: (page: Page) => Promise<void> }[];
}

/**
 * Crea un evento para hoy desde el modal del calendario.
 *
 * El calendario arranca vacío y no es un descuido del seed: sus `EVENTS` son de
 * junio de 2026 y ya estamos en agosto. Sin crear nada, las tres vistas miden
 * una rejilla sin contenido, que es justo el caso que no desborda nunca.
 */
export async function crearEvento(page: Page, titulo: string): Promise<void> {
  await page.getByRole('button', { name: 'Nuevo evento' }).click();
  await page.getByPlaceholder('Nombre del evento').fill(titulo);
  await page.getByRole('button', { name: 'Guardar evento' }).click();
  await expect(page.locator('.modal-card')).toHaveCount(0);
  // El aviso emergente es un elemento fijo más en la página. Esperar a que se
  // vaya solo cuesta unos segundos y evita medir anchos con un rótulo encima.
  await expect(page.locator('.toaster .toast')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(titulo)).toBeVisible();
}

async function cambiarVista(page: Page, boton: string): Promise<void> {
  await page.getByRole('button', { name: boton, exact: true }).click();
}

export const PANTALLAS: Pantalla[] = [
  // ── antes de iniciar sesión ────────────────────────────────────────────────
  // Estas cinco no están protegidas por `RequireAuth`, así que se ven igual con
  // la sesión guardada puesta; es lo que permite medirlas en la misma pasada.
  {
    nombre: 'Onboarding',
    ruta: '/',
    ancla: (page) => page.getByRole('heading', { name: 'Bienvenida a ExplorArte' }),
    // Una sola variante: la tercera pantalla ("¿Cómo funciona?") la quitó el
    // cliente porque pedía demasiado antes de dejar entrar a la docente, y en
    // la segunda el botón ya dice "Comenzar", no "Siguiente".
    variantes: [
      { nombre: '¿Qué encontrarás en ExplorArte?', activa: (page) => page.getByRole('button', { name: 'Siguiente' }).click() },
    ],
  },
  {
    nombre: 'Login',
    ruta: '/login',
    ancla: (page) => page.getByRole('heading', { name: 'Inicia sesión en ExplorArte' }),
  },
  {
    nombre: 'Registro',
    ruta: '/register',
    ancla: (page) => page.getByRole('heading', { name: 'Crear cuenta' }),
    variantes: [
      {
        nombre: 'paso de correo',
        activa: async (page) => {
          await page.getByRole('button', { name: /Correo y contraseña/ }).click();
          await expect(page.getByPlaceholder('Mínimo 8 caracteres')).toBeVisible();
        },
      },
    ],
  },
  {
    nombre: 'Recuperar contraseña',
    ruta: '/forgot-password',
    ancla: (page) => page.getByRole('heading', { name: 'Recuperar contraseña' }),
  },
  {
    nombre: 'Cuenta sin acceso',
    ruta: '/pendiente',
    ancla: (page) => page.getByRole('heading', { name: 'Tu cuenta no tiene acceso' }),
  },

  // ── con sesión ─────────────────────────────────────────────────────────────
  {
    nombre: 'Inicio',
    ruta: '/main',
    ancla: (page) => page.getByText('Explora según tu necesidad'),
  },
  {
    nombre: 'Biblioteca de emociones',
    ruta: '/emociones',
    ancla: (page) => page.getByText('Alegría').first(),
  },
  {
    nombre: 'Detalle de emoción',
    ruta: '/emociones/alegria',
    ancla: (page) => page.getByText('¿Qué es esta emoción?'),
  },
  {
    nombre: 'Caja de herramientas',
    ruta: '/herramientas',
    ancla: (page) => page.getByText('Manual ExplorArte').first(),
  },
  {
    nombre: 'Aprendiendo',
    ruta: '/aprendiendo',
    ancla: (page) => page.getByText('Practicar autocuidado'),
  },
  {
    nombre: 'Comunidad',
    ruta: '/comunidad',
    ancla: (page) => page.getByText('Maestra Ana').first(),
    variantes: [
      {
        nombre: 'compositor abierto',
        activa: async (page) => {
          // El clic real también comprueba que la barra inferior no intercepta
          // el FAB: disparar el evento por código ocultaría justo esa regresión.
          await page.getByRole('button', { name: 'Crear publicación' }).click();
          await expect(page.getByPlaceholder('¿Qué quieres compartir con la comunidad?')).toBeVisible();
        },
      },
    ],
  },
  {
    nombre: 'Calendario',
    ruta: '/calendar',
    ancla: (page) => page.getByText(/^Hoy ·/),
    prepara: (page) => crearEvento(page, 'Sesión de lectura de prueba'),
    variantes: [
      { nombre: 'vista semana', activa: (page) => cambiarVista(page, 'Semana') },
      { nombre: 'vista mes', activa: (page) => cambiarVista(page, 'Mes') },
    ],
  },
  {
    nombre: 'Descargas',
    ruta: '/descargas',
    ancla: (page) => page.getByText(/archivos? guardados?/),
  },
  {
    nombre: 'Perfil',
    ruta: '/profile',
    ancla: (page) => page.getByText('Información personal'),
  },
  {
    nombre: 'Sobre ExplorArte',
    ruta: '/sobre',
    ancla: (page) => page.getByText('¿Qué es ExplorArte?'),
  },
  {
    nombre: 'Cambios sin enviar',
    ruta: '/sync-problemas',
    ancla: (page) => page.getByText('Todo se guardó. No hay cambios pendientes de revisar.'),
  },
];
