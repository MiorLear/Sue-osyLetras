import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@explorarte/shared';

import {
  OfflineEmptyError,
  SessionExpiredError,
  __resetDeadSession,
  classifyError,
  isDeadSession,
  onDeadSession,
  problemDetail,
  reportDeadSession,
} from '@/lib/offline-errors';
import { clearEverything, STORES, getAllByUser } from '@/lib/idb';
import { setCacheUser, writeCache, readCache } from '@/lib/offline-cache';

// La Ola 1 movió todos los errores 4xx/5xx a application/problem+json y añadió
// códigos nuevos. Lo que se prueba aquí es la línea que de verdad importa: un
// 403 significa sesión muerta y hay que purgar, mientras que un fallo de red se
// reintenta conservando la caché. El tratamiento es opuesto.

beforeEach(async () => {
  __resetDeadSession();
  setCacheUser(null);
  localStorage.clear();
  await clearEverything();
});

const problem = (status: number, body: object) =>
  new ApiError(status, `GET /x failed: ${status}`, JSON.stringify(body));

describe('offline-errors · problemDetail', () => {
  it('lee el cuerpo RFC 7807 conservando `detail`', () => {
    const err = problem(409, { title: 'Conflict', detail: 'El evento ya existe', status: 409 });
    expect(problemDetail(err)?.detail).toBe('El evento ya existe');
  });

  it('tolera un cuerpo que no es JSON', () => {
    expect(problemDetail(new ApiError(500, 'boom', '<html>502</html>'))).toBeNull();
  });

  it('devuelve null para lo que no es un ApiError', () => {
    expect(problemDetail(new TypeError('Failed to fetch'))).toBeNull();
  });
});

describe('offline-errors · 403 es sesión muerta, no fallo de red', () => {
  it('clasifica el 403 como fatal y no reintentable', () => {
    const kind = classifyError(problem(403, { code: 'ACCOUNT_REJECTED' }));
    expect(kind.code).toBe('session-expired');
    expect(kind.fatalToSession).toBe(true);
    expect(kind.retryable).toBe(false);
  });

  it('un 403 en CUALQUIER endpoint cuenta, no solo en /auth', () => {
    for (const err of [problem(403, {}), problem(403, { code: 'TOKEN_REVOKED' })]) {
      expect(isDeadSession(err)).toBe(true);
    }
  });

  it('un fallo de transporte es reintentable y no toca la sesión', () => {
    const kind = classifyError(new TypeError('Failed to fetch'));
    expect(kind.code).toBe('network');
    expect(kind.retryable).toBe(true);
    expect(kind.fatalToSession).toBe(false);
  });

  it('los dos no se confunden: es lo que distingue purgar de reintentar', () => {
    expect(isDeadSession(problem(403, {}))).toBe(true);
    expect(isDeadSession(new TypeError('Failed to fetch'))).toBe(false);
    expect(isDeadSession(problem(500, {}))).toBe(false);
  });
});

describe('offline-errors · códigos de la Ola 1', () => {
  it('429 es reintentable y expone el Retry-After', () => {
    const kind = classifyError(problem(429, { retryAfterSeconds: 42, detail: 'demasiados' }));
    expect(kind.code).toBe('rate-limited');
    expect(kind.retryable).toBe(true);
    expect(kind.retryAfterSeconds).toBe(42);
  });

  it('409 es conflicto y no se reintenta a ciegas', () => {
    const kind = classifyError(problem(409, { detail: 'ya existe' }));
    expect(kind.code).toBe('conflict');
    expect(kind.retryable).toBe(false);
    expect(kind.detail).toBe('ya existe');
  });

  it('5xx es reintentable', () => {
    expect(classifyError(problem(503, {})).retryable).toBe(true);
  });

  it('401 también cierra la sesión', () => {
    expect(classifyError(problem(401, {})).fatalToSession).toBe(true);
  });

  it('reconoce sus propios errores tipados', () => {
    expect(classifyError(new OfflineEmptyError()).code).toBe('offline-empty');
    expect(classifyError(new SessionExpiredError()).code).toBe('session-expired');
  });
});

describe('offline-errors · reportDeadSession', () => {
  it('purga la caché de esa usuaria antes de mandarla a login', async () => {
    setCacheUser('ana');
    await writeCache('profile', { nombre: 'Ana' });
    await expect(readCache('profile')).resolves.toEqual({ nombre: 'Ana' });

    const handler = vi.fn();
    onDeadSession(handler);
    await reportDeadSession('ACCOUNT_REJECTED');

    await expect(readCache('profile')).resolves.toBeUndefined();
    expect(handler).toHaveBeenCalledWith('ACCOUNT_REJECTED');
  });

  it('no arrastra a las demás usuarias de la tablet', async () => {
    setCacheUser('bea');
    await writeCache('profile', { nombre: 'Bea' });
    setCacheUser('ana');
    await writeCache('profile', { nombre: 'Ana' });

    onDeadSession(vi.fn());
    await reportDeadSession();

    setCacheUser('bea');
    await expect(readCache('profile')).resolves.toEqual({ nombre: 'Bea' });
  });

  it('varios 403 a la vez colapsan en una sola purga', async () => {
    setCacheUser('ana');
    await writeCache('profile', { nombre: 'Ana' });

    const handler = vi.fn();
    onDeadSession(handler);
    await Promise.all([reportDeadSession(), reportDeadSession(), reportDeadSession()]);

    expect(handler).toHaveBeenCalledTimes(1);
    await expect(getAllByUser(STORES.apiCache, 'ana')).resolves.toEqual([]);
  });
});
