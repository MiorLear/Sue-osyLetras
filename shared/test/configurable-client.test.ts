import { afterEach, describe, expect, it, vi } from 'vitest';

import { createConfigurableApiClient } from '../src/api/configurable.js';
import { createApiClient } from '../src/api/index.js';

// El selector mock/http por modulo. Es config de desarrollo, pero si se
// equivoca la app habla con el backend equivocado sin avisar, asi que conviene
// tenerlo cubierto (MAINT-01).

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createConfigurableApiClient', () => {
  it('el mock requiere opt-in explicito y no toca la red', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const client = createConfigurableApiClient({ defaultMode: 'mock' });
    await client.emotions.list();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sin baseUrl ni opt-in falla en vez de activar el mock silenciosamente', () => {
    expect(() => createConfigurableApiClient()).toThrow(/baseUrl.*explicitly 'mock'/);
  });

  it('con baseUrl usa http por defecto', async () => {
    const fetchSpy = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = createConfigurableApiClient({ baseUrl: 'https://api.test' });
    await client.emotions.list();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('mockModules fuerza el mock solo en los modulos listados', async () => {
    const fetchSpy = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = createConfigurableApiClient({
      baseUrl: 'https://api.test',
      mockModules: ['emotions'],
    });
    await client.emotions.list();
    expect(fetchSpy).not.toHaveBeenCalled();

    await client.tools.get();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falla fuerte si un modulo resuelve a http sin baseUrl', () => {
    expect(() => createConfigurableApiClient({ defaultMode: 'http' })).toThrow(/baseUrl/);
  });

  it('propaga getToken al adaptador http', async () => {
    const fetchSpy = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = createConfigurableApiClient({
      baseUrl: 'https://api.test',
      getToken: () => 'tok-1',
    });
    await client.emotions.list();

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
  });

  it('propaga credentials y signal al adaptador http', async () => {
    const fetchSpy = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const controller = new AbortController();

    const client = createConfigurableApiClient({
      baseUrl: 'https://api.test',
      credentials: 'include',
      signal: controller.signal,
    });
    await client.emotions.list();

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect(init.signal).toBe(controller.signal);
  });
});

describe('createApiClient', () => {
  it('también exige elegir el modo explícitamente', () => {
    const withoutOptions = createApiClient as unknown as () => unknown;
    expect(() => withoutOptions()).toThrow(/mode must be explicitly/);
  });
});
