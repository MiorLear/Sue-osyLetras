import { useEffect } from 'react';

import {
  nextDueAt,
  refreshCounts,
  replayPass,
  resetBackoff,
  subscribeOutbox,
  sweepStale,
} from '@/lib/outbox';
import { isOnline, subscribeNetwork } from '@/lib/useNetworkStatus';

// Cuándo se intenta vaciar la bandeja de salida.
//
// El único disparador de la versión RN era que la bandera de conexión cambiara
// (BUG-07), así que una tablet que arrancaba YA conectada con cambios en cola
// no reintentaba nunca, y un error pasajero del servidor dejaba el trabajo
// varado hasta el siguiente cambio de conectividad — que en un aula con wifi
// estable puede no llegar en toda la mañana.
//
// La regla es la contraria: mientras haya trabajo pendiente, siempre hay un
// intento programado. En web esto tiene que ser la garantía, y no Background
// Sync, porque Safari no lo implementa ni va a hacerlo.

export type FlushReason = 'start' | 'online' | 'foreground' | 'timer' | 'enqueue' | 'manual';

export interface SchedulerHandle {
  stop(): void;
}

/** Cambiar de pestaña no puede martillear la API. */
const FOREGROUND_THROTTLE_MS = 10_000;

/**
 * Suelo y techo del temporizador. El techo no es por prisa: un `setTimeout` de
 * media hora no sobrevive de forma fiable a que el sistema suspenda la tablet,
 * y volver a mirar cada cinco minutos también recoge lo que otra pestaña haya
 * encolado mientras tanto.
 */
const MIN_TIMER_MS = 1_000;
const MAX_TIMER_MS = 5 * 60_000;

let starts = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let unsubscribes: (() => void)[] = [];
let lastForegroundFlush = 0;
let wasOnline: boolean | null = null;

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * Arma el siguiente intento a partir de los DATOS: el instante más cercano en
 * que alguna fila vuelve a poder salir.
 *
 * Es la diferencia con el `retryStep` global de RN, donde el backoff era una
 * propiedad del proceso: allí una cadena atascada en el tope de cinco minutos
 * retrasaba a una recién encolada que debía salir en quince segundos. Aquí manda
 * la fila más urgente.
 */
async function rearm(): Promise<void> {
  clearTimer();
  if (!isOnline()) return; // sin conexión no se programa nada: ya lo hará el evento
  const due = await nextDueAt();
  if (due === null) return; // cola vacía: no queda ningún temporizador vivo
  const delay = Math.min(MAX_TIMER_MS, Math.max(MIN_TIMER_MS, due - Date.now()));
  timer = setTimeout(() => {
    timer = null;
    flushNow('timer');
  }, delay);
}

let chain: Promise<unknown> = Promise.resolve();

/** Serializa las pasadas para que dos disparadores a la vez no se pisen. */
function enqueueRun(work: () => Promise<unknown>): void {
  chain = chain.then(work).catch(() => undefined);
}

/**
 * Un intento ahora.
 *
 * `online`, `foreground` y `manual` reinician la espera de todas las filas —las
 * condiciones cambiaron, así que no tiene sentido que nadie siga esperando— pero
 * nunca los intentos ya gastados.
 */
export function flushNow(reason: FlushReason): void {
  enqueueRun(async () => {
    if (reason === 'online' || reason === 'foreground' || reason === 'manual') {
      await resetBackoff();
    }
    const result = await replayPass();
    // Tras una sesión muerta viene una redirección al login y el planificador se
    // desmonta con el layout; y sin salida a la red, martillear un punto de
    // acceso muerto solo gasta batería. En ambos casos se espera al evento.
    if (result.stopped === 'session' || result.stopped === 'unreachable') {
      clearTimer();
      return;
    }
    await rearm();
  });
}

function onVisibilityChange(): void {
  if (document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (now - lastForegroundFlush < FOREGROUND_THROTTLE_MS) return;
  lastForegroundFlush = now;
  flushNow('foreground');
}

function onNetworkChange(): void {
  const online = isOnline();
  const reconnected = wasOnline === false && online;
  wasOnline = online;
  if (!online) {
    // El temporizador no corre sin conexión; lo rearma la reconexión.
    clearTimer();
    return;
  }
  if (reconnected) flushNow('online');
}

/**
 * Enciende la escalera. Idempotente: `StrictMode` monta los efectos dos veces
 * en desarrollo, y dos juegos de listeners serían dos pasadas por evento.
 */
export function startOutboxScheduler(): SchedulerHandle {
  starts += 1;
  if (starts === 1) {
    wasOnline = isOnline();
    unsubscribes = [
      // No al evento `online` crudo: ese se emite cuando sube el enlace, antes
      // de saber si hay salida, así que disparar ahí quema una petición contra
      // el portal cautivo de turno. Esta suscripción ya incorpora el sondeo.
      subscribeNetwork(onNetworkChange),
      subscribeOutbox(() => void rearm()),
    ];
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    enqueueRun(async () => {
      await sweepStale();
      await refreshCounts();
    });
    flushNow('start');
  }

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      starts = Math.max(0, starts - 1);
      if (starts > 0) return;
      clearTimer();
      for (const off of unsubscribes) off();
      unsubscribes = [];
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      wasOnline = null;
      lastForegroundFlush = 0;
    },
  };
}

/**
 * Monta la escalera mientras la docente esté dentro.
 *
 * Va en `TabsLayout` —detrás de RequireAuth— y no en `main.tsx`, aunque el
 * ticket dijera lo segundo. En `main.tsx` correría también en `/login`, donde
 * `getCacheUser()` devuelve el ámbito anónimo: una pasada disparada entre el
 * `signOut()` y la redirección leería `@anonymous`. Hoy sería inofensivo, pero
 * es justo la clase de ventana por la que un fallo de ámbito se convierte en
 * una fuga entre docentes de una tablet compartida, y aquí el ámbito es un
 * requisito de seguridad. Es el mismo razonamiento, ya escrito y aceptado, por
 * el que `useContentSync` vive en este layout.
 *
 * Consecuencia asumida: con la sesión caducada y la docente en `/login` no se
 * intenta nada. Es correcto — no hay token válido con el que mandar — y por eso
 * la bandeja tiene que sobrevivir a la purga: replican al volver a entrar.
 */
export function useOutboxReplay(): void {
  useEffect(() => {
    const handle = startOutboxScheduler();
    return () => handle.stop();
  }, []);
}

/** Solo para tests. */
export function __resetScheduler(): void {
  clearTimer();
  for (const off of unsubscribes) off();
  unsubscribes = [];
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
  starts = 0;
  wasOnline = null;
  lastForegroundFlush = 0;
  chain = Promise.resolve();
}
