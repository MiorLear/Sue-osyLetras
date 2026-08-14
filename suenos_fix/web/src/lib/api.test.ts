import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// El cableado del cliente de API de la web: de donde sale el token y que pasa
// cuando el backend responde 401. Es el camino que se conserva tal cual en la
// migracion a PWA, asi que conviene tenerlo fijado (MAINT-01).

const assign = vi.fn();

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  localStorage.clear();
  assign.mockClear();

  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/main', assign },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Importa el modulo despues de fijar el entorno (lee import.meta.env al cargar). */
async function loadApi(env: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('@/lib/api');
}

/** fetch mockeado con la firma real, para poder inspeccionar url e init. */
function mockFetch(status = 200, body = '[]') {
  const spy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(body, { status }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

const headersOf = (init: RequestInit | undefined) => (init?.headers ?? {}) as Record<string, string>;

describe('api · modo', () => {
  it('sin VITE_API_URL trabaja contra el mock', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { api, usingMock } = await loadApi();
    expect(usingMock).toBe(true);

    await api.emotions.list();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('con VITE_API_URL habla con el backend real', async () => {
    const fetchSpy = mockFetch();

    const { api, usingMock } = await loadApi({ VITE_API_URL: 'https://api.test' });
    expect(usingMock).toBe(false);

    await api.emotions.list();
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.test/emotions');
  });

  it('VITE_API_MOCK_MODULES deja modulos sueltos en el mock', async () => {
    const fetchSpy = mockFetch();

    const { api } = await loadApi({
      VITE_API_URL: 'https://api.test',
      VITE_API_MOCK_MODULES: 'emotions, tools',
    });

    await api.emotions.list();
    await api.tools.get();
    expect(fetchSpy).not.toHaveBeenCalled();

    await api.learning.topics();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('api · sesion', () => {
  it('manda el token guardado en localStorage', async () => {
    const fetchSpy = mockFetch();
    localStorage.setItem('explorarte_token', 'tok-abc');

    const { api } = await loadApi({ VITE_API_URL: 'https://api.test' });
    await api.emotions.list();

    expect(headersOf(fetchSpy.mock.calls[0][1]).Authorization).toBe('Bearer tok-abc');
  });

  it('un 401 limpia la sesion y manda a /login', async () => {
    mockFetch(401, '');
    localStorage.setItem('explorarte_token', 'tok-abc');
    localStorage.setItem('explorarte_user', '{"id":1}');

    const { api } = await loadApi({ VITE_API_URL: 'https://api.test' });
    await expect(api.emotions.list()).rejects.toThrow();

    expect(localStorage.getItem('explorarte_token')).toBeNull();
    expect(localStorage.getItem('explorarte_user')).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('estando ya en /login no se redirige otra vez', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/login', assign },
    });
    mockFetch(401, '');

    const { api } = await loadApi({ VITE_API_URL: 'https://api.test' });
    await expect(api.emotions.list()).rejects.toThrow();

    expect(assign).not.toHaveBeenCalled();
  });
});
