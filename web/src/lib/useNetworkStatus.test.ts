import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// El caso que motiva el sondeo: navigator.onLine dice `true` con el wifi del
// colegio detras de un portal cautivo, y ahi es justo donde mostrar "sin
// conexion, contenido guardado" importa mas. El sondeo cruza origen contra la
// API, asi que CORS lo hace honesto: el portal puede responder 200, pero no
// puede firmar Access-Control-Allow-Origin para nuestro origen.

vi.stubEnv('VITE_API_URL', 'https://api.explorarte.test');

const { __resetNetworkStatus, checkReachability, isOnline, useIsOnline, useNetworkStatus } =
  await import('@/lib/useNetworkStatus');

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  setOnLine(true);
  __resetNetworkStatus();
});

afterEach(() => {
  __resetNetworkStatus();
  vi.unstubAllGlobals();
});

describe('useNetworkStatus · navigator.onLine', () => {
  it('reporta offline cuando el navegador dice que no hay enlace', async () => {
    setOnLine(false);
    vi.stubGlobal('fetch', vi.fn());
    __resetNetworkStatus();

    const { result } = renderHook(() => useIsOnline());
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('no gasta un fetch si ya sabemos que no hay enlace', async () => {
    setOnLine(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    __resetNetworkStatus();

    await checkReachability(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('vuelve a online tras el evento `online` si el sondeo pasa', async () => {
    setOnLine(false);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })));
    __resetNetworkStatus();

    const { result } = renderHook(() => useIsOnline());
    await waitFor(() => expect(result.current).toBe(false));

    setOnLine(true);
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('pasa a offline con el evento `offline` sin esperar al sondeo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })));
    const { result } = renderHook(() => useIsOnline());
    await waitFor(() => expect(result.current).toBe(true));

    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    await waitFor(() => expect(result.current).toBe(false));
  });
});

describe('useNetworkStatus · portal cautivo', () => {
  it('trata como offline un sondeo que rebota en CORS aunque onLine sea true', async () => {
    // Lo que hace fetch cuando el portal responde sin CORS: rechaza con
    // TypeError, no resuelve con un status.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    __resetNetworkStatus();

    expect(navigator.onLine).toBe(true);
    const { result } = renderHook(() => useIsOnline());
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('trata como offline un sondeo que expira', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ),
    );
    __resetNetworkStatus();

    await expect(checkReachability(true)).resolves.toBe(false);
  }, 10_000);

  it('cualquier respuesta que pase CORS cuenta como alcanzable, incluso un 503', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    __resetNetworkStatus();

    // Se prueba el camino hasta el backend, no la salud del endpoint.
    await expect(checkReachability(true)).resolves.toBe(true);
    expect(isOnline()).toBe(true);
  });
});

describe('useNetworkStatus · economia de sondeos', () => {
  it('no repite el sondeo mientras el resultado sigue fresco', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    __resetNetworkStatus();

    await checkReachability(true);
    await checkReachability();
    await checkReachability();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('las llamadas concurrentes comparten una sola peticion', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    __resetNetworkStatus();

    await Promise.all([checkReachability(true), checkReachability(true), checkReachability(true)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sondea la API, no el propio origen (el SW podria mentir)', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    __resetNetworkStatus();

    await checkReachability(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.explorarte.test/actuator/health');
    expect(init.mode).toBe('cors');
    expect(init.cache).toBe('no-store');
  });
});

describe('useNetworkStatus · forma del hook', () => {
  it('mientras el primer sondeo corre asume online, no parpadea el banner', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    __resetNetworkStatus();

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.online).toBe(true);
    expect(result.current.reachable).toBe('unknown');
  });

  it('expone el detalle para un "comprobando conexion"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })));
    __resetNetworkStatus();

    const { result } = renderHook(() => useNetworkStatus());
    await waitFor(() => expect(result.current.reachable).toBe('reachable'));
    expect(result.current.connected).toBe(true);
    expect(result.current.checking).toBe(false);
    expect(result.current.lastCheckedAt).toBeTypeOf('number');
  });
});
