// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// El hook cache-first que usan todas las pantallas de contenido: pinta lo
// cacheado al instante y revalida solo si hay red. Es la pieza que decide que
// ve la usuaria sin conexion, asi que su comportamiento tiene que sobrevivir
// literal al port a IndexedDB (MAINT-01).

const cache = new Map<string, unknown>();
let online = true;

vi.mock('@/lib/offline-cache', () => ({
  readCache: vi.fn(async (key: string) => cache.get(key)),
  writeCache: vi.fn(async (key: string, data: unknown) => {
    cache.set(key, data);
  }),
  readAllCached: vi.fn(async () => ({})),
}));

vi.mock('@/lib/useNetworkStatus', () => ({
  useIsOnline: () => online,
}));

const { useOfflineAsync } = await import('@/lib/useOfflineAsync');

beforeEach(() => {
  cache.clear();
  online = true;
});

describe('useOfflineAsync · cache-first', () => {
  it('pinta lo cacheado antes de que responda la red', async () => {
    cache.set('tools', { from: 'cache' });
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
    expect(cache.get('tools')).toEqual({ from: 'red' });
  });
});

describe('useOfflineAsync · sin conexion', () => {
  it('no llama al loader y sirve la cache', async () => {
    online = false;
    cache.set('tools', { from: 'cache' });
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
    cache.set('tools', { from: 'cache' });
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
    cache.set('a', { k: 'a' });
    cache.set('b', { k: 'b' });
    online = false;

    const { result, rerender } = renderHook(({ key }) => useOfflineAsync(key, async () => ({})), {
      initialProps: { key: 'a' },
    });

    await waitFor(() => expect(result.current.data).toEqual({ k: 'a' }));
    rerender({ key: 'b' });
    await waitFor(() => expect(result.current.data).toEqual({ k: 'b' }));
  });
});

describe('useOfflineAsync · deuda conocida', () => {
  // Ver AUDIT.md §6 (BUG-09). No se arregla aqui; el test queda escrito para
  // que el fix tenga con que verificarse.
  it.skip('BUG-09: la pantalla deberia poder distinguir "offline sin cache" de un fallo real', async () => {
    online = false;
    const { result } = renderHook(() => useOfflineAsync('tools', async () => ({})));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Hoy el hook solo entrega un Error generico con un mensaje que hay que
    // parsear a mano; deberia exponer una causa tipada.
    expect((result.current.error as { code?: string }).code).toBe('offline-empty');
  });
});
