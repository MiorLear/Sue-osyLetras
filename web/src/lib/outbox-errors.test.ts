import { describe, expect, it } from 'vitest';
import { ApiError } from '@explorarte/shared';

import {
  BASE_RETRY_MS,
  JITTER_RATIO,
  MAX_ATTEMPTS,
  MAX_DETAIL_CHARS,
  MAX_RETRY_MS,
  classifyReplayError,
  nextDelayMs,
  orphanReason,
  resumePolicy,
} from '@/lib/outbox-errors';

// Decidir qué se hace con un cambio que no consigue salir. Es la parte del
// subsistema donde equivocarse cuesta el trabajo de una docente: un fallo
// tratado como definitivo lo tira, y uno definitivo tratado como pasajero deja
// la cola girando para siempre contra un servidor que ya dijo que no.

const httpError = (status: number, body = '') =>
  new ApiError(status, `PUT /x falló: ${status}`, body);

describe('outbox-errors · veredictos', () => {
  it('un 403 es la sesión muerta, no un cambio rechazado', () => {
    // La versión RN lo daba por permanente y lo apartaba. Con esa regla, una
    // cuenta revocada iría apartando la cola cambio a cambio y la docente
    // vería siete "no se pudo guardar" en vez de una pantalla de login.
    expect(classifyReplayError(httpError(403), 1).verdict).toBe('session');
    expect(classifyReplayError(httpError(401), 1).verdict).toBe('session');
  });

  it('la sesión muerta no se convierte en fallido por agotar intentos', () => {
    const failure = classifyReplayError(httpError(401), MAX_ATTEMPTS + 5);
    expect(failure.verdict).toBe('session');
    expect(failure.exhausted).toBe(false);
  });

  it('un fallo de transporte no gasta intento', () => {
    // `isOnline()` da true con alcanzabilidad desconocida, así que una tablet
    // enganchada a un punto de acceso sin salida sí corre pasadas. Si esto
    // contase, un aula sin internet mataría el trabajo sin que ningún servidor
    // lo hubiera rechazado nunca.
    expect(classifyReplayError(new TypeError('Failed to fetch'), 1).verdict).toBe('unreachable');
    expect(classifyReplayError(new TypeError('Failed to fetch'), MAX_ATTEMPTS).verdict).toBe(
      'unreachable',
    );
  });

  it('lo que puede funcionar más tarde se reintenta', () => {
    for (const status of [408, 425, 429, 500, 502, 503]) {
      expect(classifyReplayError(httpError(status), 1).verdict).toBe('retry');
    }
  });

  it('408 y 425 son transporte con número, no rechazos', () => {
    // Caían en `unknown` → no reintentable, que en una lectura solo significa
    // enseñar un error, pero en una escritura significa tirar el trabajo.
    expect(classifyReplayError(httpError(408), 1).verdict).toBe('retry');
    expect(classifyReplayError(httpError(425), 1).verdict).toBe('retry');
  });

  it('lo que el servidor no va a aceptar se aparta, con su motivo', () => {
    const cases: [number, string][] = [
      [400, 'El servidor no aceptó el cambio.'],
      [422, 'El servidor no aceptó el cambio.'],
      [404, 'El contenido ya no existe.'],
      [410, 'El contenido ya no existe.'],
      [409, 'Alguien más cambió esto mientras estabas sin conexión.'],
      [413, 'El archivo es demasiado grande para enviarlo.'],
    ];
    for (const [status, reason] of cases) {
      const failure = classifyReplayError(httpError(status), 1);
      expect(failure.verdict).toBe('dead');
      expect(failure.reason).toBe(reason);
    }
  });

  it('un 404 se lleva por delante lo que venía detrás en su cadena; un 409 no', () => {
    // La cadena es una entidad: si el servidor dice que ya no existe, lo
    // siguiente daría otro 404 y otra fila igual en la lista de fallidos.
    expect(classifyReplayError(httpError(404), 1).cascades).toBe(true);
    expect(classifyReplayError(httpError(410), 1).cascades).toBe(true);
    expect(classifyReplayError(httpError(409), 1).cascades).toBe(false);
    expect(classifyReplayError(httpError(400), 1).cascades).toBe(false);
  });

  it('agotar los intentos aparta el cambio, con su motivo propio', () => {
    const failure = classifyReplayError(httpError(500), MAX_ATTEMPTS);
    expect(failure.verdict).toBe('dead');
    expect(failure.exhausted).toBe(true);
    expect(failure.reason).toBe('No se pudo enviar tras varios intentos.');
  });

  it('el cuerpo del servidor se recorta y nunca llega a la pantalla', () => {
    // Un 502 de Render devuelve una página HTML entera.
    const html = '<html>' + 'x'.repeat(5000) + '</html>';
    const failure = classifyReplayError(httpError(502, html), 1);
    expect(failure.detail!.length).toBeLessThanOrEqual(MAX_DETAIL_CHARS);
    expect(failure.reason).not.toContain('<html>');
  });
});

describe('outbox-errors · escalera de espera', () => {
  const noJitter = () => 0.5; // rng 0.5 → jitter 0

  it('crece por tres y se topa a la media hora', () => {
    expect(nextDelayMs(1, undefined, noJitter)).toBe(BASE_RETRY_MS);
    expect(nextDelayMs(2, undefined, noJitter)).toBe(45_000);
    expect(nextDelayMs(3, undefined, noJitter)).toBe(135_000);
    expect(nextDelayMs(4, undefined, noJitter)).toBe(405_000);
    expect(nextDelayMs(7, undefined, noJitter)).toBe(MAX_RETRY_MS);
    expect(nextDelayMs(20, undefined, noJitter)).toBe(MAX_RETRY_MS);
  });

  it('la dispersión se queda dentro del ±25% y nunca baja de un segundo', () => {
    // Treinta tablets volviendo al mismo punto de acceso cuando suena el timbre
    // no pueden reintentar en formación.
    for (const rng of [() => 0, () => 1, () => 0.5]) {
      const delay = nextDelayMs(1, undefined, rng);
      expect(delay).toBeGreaterThanOrEqual(1_000);
      expect(delay).toBeLessThanOrEqual(BASE_RETRY_MS * (1 + JITTER_RATIO));
      expect(delay).toBeGreaterThanOrEqual(BASE_RETRY_MS * (1 - JITTER_RATIO));
    }
  });

  it('el Retry-After del servidor es un suelo, no una sugerencia', () => {
    expect(nextDelayMs(1, 120_000, noJitter)).toBe(120_000);
    // Y no rebaja la escalera si pide menos de lo que ya tocaba.
    expect(nextDelayMs(4, 1_000, noJitter)).toBe(405_000);
  });
});

describe('outbox-errors · reanudar lo que quedó en vuelo', () => {
  it('el me gusta se descarta y todo lo demás se reenvía', () => {
    // Es un interruptor: reenviarlo lo INVIERTE. Una reacción perdida es más
    // barata que una del revés, y la pantalla enseñará el estado real al
    // siguiente refresco.
    expect(resumePolicy('post.like')).toBe('drop');
    for (const kind of [
      'profile.update',
      'event.create',
      'event.update',
      'event.remove',
      'post.create',
      'post.comment',
    ]) {
      expect(resumePolicy(kind)).toBe('resend');
    }
  });

  it('los huérfanos dicen de quién dependían', () => {
    expect(orphanReason('post.create')).toBe('La publicación no se pudo crear.');
    expect(orphanReason('event.create')).toBe('El evento no se pudo crear.');
    expect(orphanReason('event.update')).toBe('El cambio del que dependía no se pudo enviar.');
  });
});
