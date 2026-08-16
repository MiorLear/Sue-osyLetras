import { classifyError, type OfflineErrorCode } from '@/lib/offline-errors';

// Qué hacer cuando un cambio de la bandeja no consigue salir.
//
// Módulo puro a propósito: sin IndexedDB, sin React y sin red. Cada decisión
// del replay es una función con sus entradas a la vista, así que la tabla
// entera se prueba sin abrir la base de datos.
//
// La semántica HTTP no se reimplementa aquí: la única fuente de verdad es
// `classifyError()` de offline-errors.ts. Lo que se añade encima es lo que ella
// no puede saber porque no va de la petición sino de la cola: cuántos intentos
// lleva la fila, si al morir se lleva por delante al resto de su cadena, y qué
// se le dice a la docente.
//
// Nota sobre el puerto: `classify()` de src/lib/mutation-queue.ts NO se porta.
// Choca con la versión web justo en el 403, y portarlo sería un fallo de
// pérdida de datos: en esta API un 403 es la sesión muerta en cualquier
// endpoint, así que una cuenta revocada iría apartando la cola cambio a cambio
// —siete peticiones a un servidor que ya dijo que no— y la docente vería siete
// "no se pudo guardar" en vez de una pantalla de login.

export type ReplayVerdict =
  /** 401/403: la sesión murió. Se corta la pasada sin escribir nada. */
  | 'session'
  /** No llegamos al servidor. Se corta la pasada y NO se gasta intento. */
  | 'unreachable'
  /** Podría funcionar más tarde. Cuenta intento y reprograma solo su cadena. */
  | 'retry'
  /** El servidor no lo va a aceptar nunca, o se acabaron los intentos. */
  | 'dead';

/** Cuántas veces se reintenta un cambio antes de apartarlo. */
export const MAX_ATTEMPTS = 8;

export const BASE_RETRY_MS = 15_000;
export const RETRY_FACTOR = 3;
export const MAX_RETRY_MS = 30 * 60_000;
export const JITTER_RATIO = 0.25;

/** Una fila que lleva un mes sin poder salir pasa a la lista de fallidos. */
export const OUTBOX_TTL_MS = 30 * 24 * 60 * 60_000;

/** Y una fallida se borra al trimestre. */
export const DEAD_LETTER_TTL_MS = 90 * 24 * 60 * 60_000;

/** Lo que dijo el servidor se guarda recortado: un 502 de Render trae una
 *  página HTML entera, y eso no puede ocupar IndexedDB fila a fila. */
export const MAX_DETAIL_CHARS = 200;

export interface ReplayFailure {
  verdict: ReplayVerdict;
  /** El código de offline-errors, sin volver a derivarlo. */
  code: OfflineErrorCode;
  status?: number;
  /** En español y de un conjunto CERRADO: es lo que lee la docente. */
  reason: string;
  /** Lo que dijo el servidor, recortado. Para quien depure, no para la pantalla. */
  detail?: string;
  /** Suelo que pidió el propio servidor (Retry-After de un 429). */
  retryAfterMs?: number;
  /** True cuando muere por agotar intentos y no por un rechazo explícito. */
  exhausted: boolean;
  /** True cuando esta muerte se lleva por delante al resto de su cadena. */
  cascades: boolean;
}

const REASONS = {
  exhausted: 'No se pudo enviar tras varios intentos.',
  rejected: 'El servidor no aceptó el cambio.',
  gone: 'El contenido ya no existe.',
  conflict: 'Alguien más cambió esto mientras estabas sin conexión.',
  tooLarge: 'El archivo es demasiado grande para enviarlo.',
  forbidden: 'No tienes permiso para hacer este cambio.',
  unreadable: 'Este cambio se guardó con una versión anterior de la app y ya no se puede enviar.',
  stale: 'Este cambio llevaba demasiado tiempo sin poder enviarse.',
} as const;

function reasonFor(status: number | undefined): { reason: string; cascades: boolean } {
  switch (status) {
    case 404:
    case 410:
      // La cadena es una entidad y el servidor acaba de decir que no existe:
      // lo que venga detrás daría el mismo 404 y otra fila igual en la lista.
      return { reason: REASONS.gone, cascades: true };
    case 409:
      return { reason: REASONS.conflict, cascades: false };
    case 413:
      return { reason: REASONS.tooLarge, cascades: false };
    default:
      return { reason: REASONS.rejected, cascades: false };
  }
}

/**
 * Ordena un fallo en lo que el replay tiene que hacer con él.
 *
 * `attempts` ya incluye este fallo: el motor incrementa y después clasifica.
 */
export function classifyReplayError(err: unknown, attempts: number): ReplayFailure {
  const kind = classifyError(err);
  const detail = kind.detail?.slice(0, MAX_DETAIL_CHARS);
  const base = { code: kind.code, status: kind.status, detail };

  if (kind.fatalToSession) {
    return { ...base, verdict: 'session', reason: REASONS.forbidden, exhausted: false, cascades: false };
  }

  // Un fallo de transporte no dice de quién es la culpa, así que no gasta
  // presupuesto: el motor comprueba si hay salida antes de darlo por culpa del
  // servidor. Sin esto, ocho fallos en un aula sin internet matarían el trabajo
  // de la docente sin que ningún servidor lo hubiera rechazado jamás.
  if (kind.code === 'network' && kind.status === undefined) {
    return { ...base, verdict: 'unreachable', reason: REASONS.rejected, exhausted: false, cascades: false };
  }

  if (kind.retryable) {
    if (attempts >= MAX_ATTEMPTS) {
      return { ...base, verdict: 'dead', reason: REASONS.exhausted, exhausted: true, cascades: false };
    }
    return {
      ...base,
      verdict: 'retry',
      reason: REASONS.rejected,
      exhausted: false,
      cascades: false,
      retryAfterMs:
        kind.retryAfterSeconds === undefined ? undefined : kind.retryAfterSeconds * 1000,
    };
  }

  const { reason, cascades } = reasonFor(kind.status);
  return { ...base, verdict: 'dead', reason, exhausted: false, cascades };
}

/**
 * Espera hasta el siguiente intento: escalera con tope y ±25 % de dispersión.
 *
 * La dispersión no es adorno: treinta tablets que vuelven al mismo punto de
 * acceso cuando suena el timbre no pueden reintentar en formación. Y al ser por
 * fila, además descorrelaciona las cadenas dentro de una misma tablet, que no
 * cuesta nada.
 *
 * `Retry-After` de un 429 es un SUELO, no una sugerencia: el servidor pidió
 * esperar y la dispersión no puede quedar por debajo de lo que pidió.
 */
export function nextDelayMs(
  attempts: number,
  retryAfterMs?: number,
  rng: () => number = Math.random,
): number {
  const base = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * RETRY_FACTOR ** Math.max(0, attempts - 1));
  const jitter = base * JITTER_RATIO * (rng() * 2 - 1);
  const ladder = Math.max(1_000, Math.round(base + jitter));
  return retryAfterMs ? Math.max(ladder, retryAfterMs) : ladder;
}

/** El instante del siguiente intento, ya en epoch ms. */
export function nextAttemptAt(
  attempts: number,
  retryAfterMs?: number,
  now: number = Date.now(),
  rng?: () => number,
): number {
  return now + nextDelayMs(attempts, retryAfterMs, rng);
}

export type ResumePolicy = 'resend' | 'drop';

/**
 * Qué hacer con una fila que quedó "en vuelo" porque su pestaña murió a mitad
 * de despacho. No sabemos si el servidor llegó a recibirla.
 *
 * Se reenvía todo menos el "me gusta", que es un interruptor: reenviarlo lo
 * INVIERTE. Una reacción perdida es más barata que una reacción del revés, y la
 * pantalla enseñará el estado real en el siguiente refresco. Cerrarlo del todo
 * pide un `PUT /posts/{id}/like {liked}` en el servidor; queda anotado.
 */
export function resumePolicy(kind: string): ResumePolicy {
  return kind === 'post.like' ? 'drop' : 'resend';
}

/** Por qué se apartó algo que dependía de un alta que no salió. */
export function orphanReason(parentKind: string): string {
  if (parentKind === 'post.create') return 'La publicación no se pudo crear.';
  if (parentKind === 'event.create') return 'El evento no se pudo crear.';
  return 'El cambio del que dependía no se pudo enviar.';
}

/** Por qué se apartó algo que llevaba demasiado tiempo esperando. */
export function staleReason(): string {
  return REASONS.stale;
}

/** Por qué se apartó una fila que esta versión de la app ya no sabe leer. */
export function unreadableReason(): string {
  return REASONS.unreadable;
}
