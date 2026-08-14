import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, createHttpClient } from '../src/api/http/index.js';

// El adaptador HTTP es el unico punto por el que las dos apps hablan con el
// backend: el header de autenticacion, la clasificacion de errores por status y
// el gancho de sesion expirada (401) se comparten entre movil y web. Cubrirlo
// aqui evita duplicar la prueba en los dos frontends (MAINT-01).

function mockFetch(responses: Response[] | Response) {
  const list = Array.isArray(responses) ? responses : [responses];
  const spy = vi.fn(async () => list.shift() ?? new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createHttpClient · request', () => {
  it('normaliza la barra final del baseUrl', async () => {
    const fetchSpy = mockFetch(json({ id: 'a' }));
    const client = createHttpClient({ baseUrl: 'https://api.test/' });
    await client.emotions.list();

    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.test/emotions');
  });

  it('manda el bearer cuando hay token', async () => {
    const fetchSpy = mockFetch(json([]));
    const client = createHttpClient({ baseUrl: 'https://api.test', getToken: () => 'tok-123' });
    await client.emotions.list();

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('no manda header de autenticacion cuando no hay token', async () => {
    const fetchSpy = mockFetch(json([]));
    const client = createHttpClient({ baseUrl: 'https://api.test', getToken: () => null });
    await client.emotions.list();

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('serializa el body como JSON', async () => {
    const fetchSpy = mockFetch(json({ token: 't', user: {} }));
    const client = createHttpClient({ baseUrl: 'https://api.test' });
    await client.auth.login({ email: 'a@b.c', password: 'x' } as never);

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.c', password: 'x' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('trata el 204 como respuesta vacia', async () => {
    mockFetch(new Response(null, { status: 204 }));
    const client = createHttpClient({ baseUrl: 'https://api.test' });
    await expect(client.events.remove('e-1')).resolves.toBeUndefined();
  });
});

describe('createHttpClient · errores', () => {
  it('lanza ApiError con el status y el cuerpo', async () => {
    mockFetch(new Response('evento no encontrado', { status: 404 }));
    const client = createHttpClient({ baseUrl: 'https://api.test' });

    const error = await client.events.remove('e-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).body).toBe('evento no encontrado');
  });

  it('llama a onUnauthorized en un 401 y sigue lanzando', async () => {
    mockFetch(new Response('', { status: 401 }));
    const onUnauthorized = vi.fn();
    const client = createHttpClient({ baseUrl: 'https://api.test', onUnauthorized });

    await expect(client.emotions.list()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('no llama a onUnauthorized en un 403', async () => {
    mockFetch(new Response('', { status: 403 }));
    const onUnauthorized = vi.fn();
    const client = createHttpClient({ baseUrl: 'https://api.test', onUnauthorized });

    await expect(client.emotions.list()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
