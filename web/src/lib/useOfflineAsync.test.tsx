import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@explorarte/shared';

// El hook cache-first que usan todas las pantallas de contenido. Los cinco
// primeros bloques son el contrato de la version RN portado tal cual
// (src/lib/useOfflineAsync.test.tsx): lo que hace es lo que ve la usuaria sin
// conexion, y tenia que sobrevivir literal al port a IndexedDB.
//
// Los dos ultimos son BUG-09: la edad del dato y la distincion entre "sin
// conexion y sin nada cacheado" y un fallo real. El test que estaba con it.skip
// en la version RN esta aqui activo.

const cache = new Map<string, { data: unknown; fetchedAt: number }>();
let online = true;

vi.mock('@/lib/useNetworkStatus', () => ({
  useIsOnline: () => online,
}));

vi.mock('@/lib/offline-cache', () => ({
  readCacheEntry: vi.fn(async (key: string) => cache.get(key)),
  readCache: vi.fn(async (key: string) => cache.get(key)?.data),
  writeCache: vi.fn(async (key: string, data: unknown) => {
    cache.set(key, { data, fetchedAt: Date.now() });
  }),
  readAllCached: vi.fn(async () => ({})),
  clearUserCache: vi.fn(async () => {}),
  getCacheUser: vi.fn(() => 'ana'),
}));

const { useOfflineAsync, formatCacheAge } = await import('@/lib/useOfflineAsync');
const { OfflineEmptyError, SessionExpiredError, __resetDeadSession, onDeadSession } = await import(
  '@/lib/offline-errors'
);

/** Seeds the cache as if it had been written `agoMs` ago. */
function seed(key: string, data: unknown, agoMs = 0) {
  cache.set(key, { data, fetchedAt: Date.now() - agoMs });
}

beforeEach(() => {
  cache.clear();
  online = true;
  __resetDeadSession();
  onDeadSession(() => {});
});

describe('useOfflineAsync · cache-first', () => {
  it('pinta lo cacheado antes de que responda la red', async () => {
    seed('tools', { from: 'cache' });
    let resolveLoader: (v: unknown) => void = () => {};
    const loader = vi.fn(() => new Promise((r) => (resolveLoader = r)));

    const { result } = renderHook(() => useOfflineAsync('tools', loader));

    await waitFor(() => expect(result.current.data).toEqual({ from: 'cache' }));
    expect(result.current.loading).toBe(false);

    await act(async () => {
      resolveLoader({ from: 'red' });
    });
    await waitFor(() => expect(result.current.data).toEqual({ from: 'red' }));
  });

  it('guarda en cache lo que devuelve la red', async () => {
    const { result } = renderHook(() => useOfflineAsync('tools', async () => ({ from: 'red' })));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(cache.get('tools')?.data).toEqual({ from: 'red' });
  });
});

describe('useOfflineAsync · sin conexion', () => {
  it('no llama al loader y sirve la cache', async () => {
    online = false;
    seed('tools', { from: 'cache' });
    const loader = vi.fn(async () => ({ from: 'red' }));

    const { result } = renderHook(() => useOfflineAsync('tools', loader));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loader).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({ from: 'cache' });
    expect(result.current.error).toBeNull();
  });

  it('sin conexion y sin cache deja un error para que la pantalla muestre su vacio', async () => {
    online = false;
    const { result } = renderHook(() => useOfflineAsync('tools', async () => ({ from: 'red' })));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeUndefined();
    expect((result.current.error as Error).message).toBe('offline: no cached content');
  });
});

describe('useOfflineAsync · fallo de revalidacion', () => {
  it('con cache, conserva los datos y no propaga el error', async () => {
    seed('tools', { from: 'cache' });
    const { result } = renderHook(() =>
      useOfflineAsync('tools', async () => {
        throw new Error('500');
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ from: 'cache' });
    expect(result.current.error).toBeNull();
  });

  it('sin cache, propaga el error', async () => {
    const { result } = renderHook(() =>
      useOfflineAsync('tools', async () => {
        throw new Error('500');
      }),
    );

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect((result.current.error as Error).message).toBe('500');
  });
});

describe('useOfflineAsync · re-ejecucion', () => {
  it('reload() vuelve a pedir a la red', async () => {
    const loader = vi.fn(async () => ({ n: loader.mock.calls.length }));
    const { result } = renderHook(() => useOfflineAsync('tools', loader));

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      result.current.reload();
    });
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
  });

  it('cambiar de clave recarga con la cache de la nueva clave', async () => {
    seed('a', { k: 'a' });
    seed('b', { k: 'b' });
    online = false;

    const { result, rerender } = renderHook(({ key }) => useOfflineAsync(key, async () => ({})), {
      initialProps: { key: 'a' },
    });

    await waitFor(() => expect(result.current.data).toEqual({ k: 'a' }));
    rerender({ key: 'b' });
    await waitFor(() => expect(result.current.data).toEqual({ k: 'b' }));
  });

  it('revalida al reconectar', async () => {
    online = false;
    seed('tools', { from: 'cache' });
    const loader = vi.fn(async () => ({ from: 'red' }));

    const { result, rerender } = renderHook(() => useOfflineAsync('tools', loader));
    await waitFor(() => expect(result.current.data).toEqual({ from: 'cache' }));
    expect(loader).not.toHaveBeenCalled();

    online = true;
    rerender();
    await waitFor(() => expect(result.current.data).toEqual({ from: 'red' }));
  });
});

// ── BUG-09 ───────────────────────────────────────────────────────────────────

describe('useOfflineAsync · BUG-09 · distinguir los modos de fallo', () => {
  it('"offline sin cache" trae una causa tipada, no un mensaje que parsear', async () => {
    // Este es el test que en la version RN estaba con it.skip describiendo el
    // comportamiento correcto. Aqui pasa.
    online = false;
    const { result } = renderHook(() => useOfflineAsync('tools', async () => ({})));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect((result.current.error as { code?: string }).code).toBe('offline-empty');
    expect(result.current.error).toBeInstanceOf(OfflineEmptyError);
    expect(result.current.status).toBe('offline-empty');
  });

  it('un fallo real no se confunde con estar sin conexion', async () => {
    const { result } = renderHook(() =>
      useOfflineAsync('tools', async () => {
        throw new Error('500');
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect((result.current.error as { code?: string }).code).toBeUndefined();
    expect(result.current.error).not.toBeInstanceOf(OfflineEmptyError);
    expect(result.current.status).toBe('error');
  });

  it('status resume el estado sin que la pantalla desmonte data/loading/error', async () => {
    const { result } = renderHook(() => useOfflineAsync('tools', async () => ({ ok: true })));
    await waitFor(() => expect(result.current.status).toBe('fresh'));
  });

  it('sin datos y sin error, status es empty y no un falso fallo', async () => {
    const { result } = renderHook(() => useOfflineAsync('tools', async () => undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBe('empty');
  });
});

describe('useOfflineAsync · BUG-09 · edad del dato', () => {
  it('expone fetchedAt y la edad de lo cacheado', async () => {
    online = false;
    seed('tools', { from: 'cache' }, 3 * 60 * 60 * 1000);

    const { result } = renderHook(() => useOfflineAsync('tools', async () => ({})));
    await waitFor(() => expect(result.current.data).toEqual({ from: 'cache' }));

    expect(result.current.fetchedAt).toBeTypeOf('number');
    expect(result.current.ageMs).toBeGreaterThanOrEqual(3 * 60 * 60 * 1000);
    expect(result.current.fromCache).toBe(true);
  });

  it('marca como stale lo que supera maxAgeMs', async () => {
    online = false;
    seed('tools', { from: 'cache' }, 48 * 60 * 60 * 1000);

    const { result } = renderHook(() => useOfflineAsync('tools', async () => ({})));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isStale).toBe(true);
    expect(result.current.status).toBe('stale');
  });

  it('no marca como stale lo recien traido', async () => {
    seed('tools', { from: 'cache' }, 1000);
    const { result } = renderHook(() => useOfflineAsync('tools', async () => ({ from: 'red' })));
    await waitFor(() => expect(result.current.data).toEqual({ from: 'red' }));

    expect(result.current.isStale).toBe(false);
    expect(result.current.fromCache).toBe(false);
    expect(result.current.status).toBe('fresh');
  });

  it('respeta un maxAgeMs a medida', async () => {
    online = false;
    seed('tools', { from: 'cache' }, 10 * 60 * 1000);

    const { result } = renderHook(() =>
      useOfflineAsync('tools', async () => ({}), [], { maxAgeMs: 5 * 60 * 1000 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isStale).toBe(true);
  });

  it('con hardMaxAgeMs, lo demasiado viejo no se muestra', async () => {
    online = false;
    seed('tools', { from: 'cache' }, 30 * 24 * 60 * 60 * 1000);

    const { result } = renderHook(() =>
      useOfflineAsync('tools', async () => ({}), [], {
        hardMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeUndefined();
    expect(result.current.status).toBe('offline-empty');
  });

  it('formatCacheAge da a las pantallas una forma unica de decirlo', () => {
    expect(formatCacheAge(undefined)).toBeNull();
    expect(formatCacheAge(30_000)).toBe('hace un momento');
    expect(formatCacheAge(5 * 60_000)).toBe('hace 5 min');
    expect(formatCacheAge(3 * 60 * 60_000)).toBe('hace 3 h');
    expect(formatCacheAge(24 * 60 * 60_000)).toBe('hace 1 día');
    expect(formatCacheAge(3 * 24 * 60 * 60_000)).toBe('hace 3 días');
  });
});

describe('useOfflineAsync · sesion muerta (403)', () => {
  const forbidden = () =>
    new ApiError(403, 'GET /me failed: 403', JSON.stringify({ code: 'ACCOUNT_REJECTED' }));

  it('un 403 no se trata como fallo de red: purga en vez de reintentar', async () => {
    const onDead = vi.fn();
    onDeadSession(onDead);

    const { result } = renderHook(() =>
      useOfflineAsync('profile', async () => {
        throw forbidden();
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('session-expired'));
    expect(result.current.error).toBeInstanceOf(SessionExpiredError);
    await waitFor(() => expect(onDead).toHaveBeenCalled());
  });

  it('descarta los datos cacheados: en tablet compartida no pueden quedarse en pantalla', async () => {
    onDeadSession(vi.fn());
    seed('profile', { nombre: 'Ana' });

    const { result } = renderHook(() =>
      useOfflineAsync('profile', async () => {
        throw forbidden();
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('session-expired'));
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchedAt).toBeUndefined();
  });

  it('un 500 con cache sigue siendo silencioso: la distincion importa', async () => {
    onDeadSession(vi.fn());
    seed('profile', { nombre: 'Ana' });

    const { result } = renderHook(() =>
      useOfflineAsync('profile', async () => {
        throw new ApiError(500, 'GET /me failed: 500', '');
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ nombre: 'Ana' });
    expect(result.current.error).toBeNull();
  });
});
