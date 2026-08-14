import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearEverything, closeDb, STORES, getAllByUser, type ApiCacheRecord } from '@/lib/idb';
import {
  cacheAge,
  clearUserCache,
  getCacheUser,
  readAllCached,
  readAllCachedEntries,
  readCache,
  readCacheEntry,
  removeCache,
  setCacheUser,
  writeCache,
} from '@/lib/offline-cache';

// La caché JSON que alimenta las pantallas offline. Se conserva el contrato de
// la versión RN (src/lib/offline-cache.test.ts) y se le añade lo que el port a
// IndexedDB tenía que arreglar: namespacing por usuaria y fetchedAt.

beforeEach(async () => {
  setCacheUser(null);
  localStorage.clear();
  await clearEverything();
});

describe('offline-cache · contrato heredado de la versión RN', () => {
  it('hace round-trip de los datos', async () => {
    await writeCache('tools', { downloadables: [{ id: 'a' }] });
    await expect(readCache('tools')).resolves.toEqual({ downloadables: [{ id: 'a' }] });
  });

  it('devuelve undefined si no hay nada cacheado', async () => {
    await expect(readCache('nada')).resolves.toBeUndefined();
  });

  it('readAllCached devuelve las entradas por cacheKey, sin prefijo', async () => {
    setCacheUser('ana');
    await writeCache('emotions:list', [1]);
    await writeCache('tools', { a: 1 });

    await expect(readAllCached()).resolves.toEqual({ 'emotions:list': [1], tools: { a: 1 } });
  });

  it('se traga un fallo de escritura (best-effort, no rompe la pantalla)', async () => {
    closeDb();
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    await expect(writeCache('tools', { a: 1 })).resolves.toBeUndefined();
    vi.restoreAllMocks();
    closeDb();
  });

  it('se traga un fallo de lectura', async () => {
    closeDb();
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('storage down');
    });
    await expect(readCache('tools')).resolves.toBeUndefined();
    await expect(readAllCached()).resolves.toEqual({});
    vi.restoreAllMocks();
    closeDb();
  });
});

describe('offline-cache · namespacing por usuaria (tablet compartida)', () => {
  it('una usuaria no lee lo que cacheó otra bajo la misma clave', async () => {
    setCacheUser('ana');
    await writeCache('profile', { nombre: 'Ana' });

    setCacheUser('bea');
    await expect(readCache('profile')).resolves.toBeUndefined();

    await writeCache('profile', { nombre: 'Bea' });
    await expect(readCache('profile')).resolves.toEqual({ nombre: 'Bea' });

    setCacheUser('ana');
    await expect(readCache('profile')).resolves.toEqual({ nombre: 'Ana' });
  });

  it('readAllCached solo ve las filas de la usuaria activa', async () => {
    setCacheUser('ana');
    await writeCache('tools', { de: 'ana' });
    setCacheUser('bea');
    await writeCache('events', { de: 'bea' });

    await expect(readAllCached()).resolves.toEqual({ events: { de: 'bea' } });
    setCacheUser('ana');
    await expect(readAllCached()).resolves.toEqual({ tools: { de: 'ana' } });
  });

  it('toda clave escrita lleva el userId dentro', async () => {
    setCacheUser('ana');
    await writeCache('emotions:list', [1]);
    await writeCache('tools', { a: 1 });

    const rows = await getAllByUser<ApiCacheRecord>(STORES.apiCache, 'ana');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.userId).toBe('ana');
      expect(row.id.startsWith('ana')).toBe(true);
      expect(row.id).not.toBe(row.cacheKey);
    }
  });

  it('el tráfico anónimo (pre-login) tiene su propio scope', async () => {
    expect(getCacheUser()).toBe('@anonymous');
    await writeCache('emotions:list', [{ id: 'publica' }]);

    // Quien inicie sesión después no hereda lo que se buscó en el login.
    setCacheUser('ana');
    await expect(readCache('emotions:list')).resolves.toBeUndefined();
  });

  it('deriva la usuaria del perfil persistido si nadie llamó a setCacheUser', async () => {
    // Tras un reload, la primera lectura ocurre antes de que ningún provider
    // haya podido fijar el scope; sale de localStorage, como AuthContext.
    localStorage.setItem('explorarte_user', JSON.stringify({ id: 'u-77', name: 'Ana' }));
    expect(getCacheUser()).toBe('u-77');

    await writeCache('profile', { nombre: 'Ana' });
    const rows = await getAllByUser<ApiCacheRecord>(STORES.apiCache, 'u-77');
    expect(rows).toHaveLength(1);
  });

  it('cae a anónimo si el perfil persistido está corrupto', () => {
    localStorage.setItem('explorarte_user', '{roto');
    expect(getCacheUser()).toBe('@anonymous');
  });

  it('normaliza un id numérico a string para que la clave sea estable', async () => {
    localStorage.setItem('explorarte_user', JSON.stringify({ id: 42 }));
    expect(getCacheUser()).toBe('42');
  });
});

describe('offline-cache · fetchedAt', () => {
  it('cada entrada guarda cuándo se trajo de la red', async () => {
    const before = Date.now();
    await writeCache('tools', { a: 1 });
    const entry = await readCacheEntry('tools');

    expect(entry?.data).toEqual({ a: 1 });
    expect(entry?.fetchedAt).toBeGreaterThanOrEqual(before);
    expect(entry?.fetchedAt).toBeLessThanOrEqual(Date.now());
  });

  it('expone la edad del dato', async () => {
    // Se mueve Date.now, no los timers: vi.useFakeTimers() congela también el
    // bucle interno de fake-indexeddb y deja las transacciones colgadas.
    const clock = vi.spyOn(Date, 'now');
    try {
      clock.mockReturnValue(1_700_000_000_000);
      await writeCache('tools', { a: 1 });
      clock.mockReturnValue(1_700_000_000_000 + 2 * 60 * 60 * 1000);
      await expect(cacheAge('tools')).resolves.toBe(2 * 60 * 60 * 1000);
    } finally {
      clock.mockRestore();
    }
  });

  it('la edad es undefined si no hay nada cacheado', async () => {
    await expect(cacheAge('nada')).resolves.toBeUndefined();
  });

  it('reescribir refresca fetchedAt', async () => {
    const clock = vi.spyOn(Date, 'now');
    try {
      clock.mockReturnValue(1_700_000_000_000);
      await writeCache('tools', { v: 1 });
      const first = (await readCacheEntry('tools'))!.fetchedAt;

      clock.mockReturnValue(1_700_000_000_000 + 60 * 60 * 1000);
      await writeCache('tools', { v: 2 });
      const second = (await readCacheEntry('tools'))!.fetchedAt;

      expect(second).toBeGreaterThan(first);
    } finally {
      clock.mockRestore();
    }
  });

  it('readAllCachedEntries conserva las marcas de tiempo', async () => {
    await writeCache('tools', { a: 1 });
    const all = await readAllCachedEntries();
    expect(all.tools.data).toEqual({ a: 1 });
    expect(all.tools.fetchedAt).toBeTypeOf('number');
  });
});

describe('offline-cache · cierre de sesión', () => {
  it('borra todas las entradas de esa usuaria', async () => {
    setCacheUser('ana');
    await writeCache('profile', { nombre: 'Ana' });
    await writeCache('tools', { a: 1 });

    await clearUserCache();
    await expect(readAllCached()).resolves.toEqual({});
    await expect(readCache('profile')).resolves.toBeUndefined();
  });

  it('no arrastra los datos de las demás', async () => {
    setCacheUser('ana');
    await writeCache('profile', { nombre: 'Ana' });
    setCacheUser('bea');
    await writeCache('profile', { nombre: 'Bea' });

    setCacheUser('ana');
    await clearUserCache();

    setCacheUser('bea');
    await expect(readCache('profile')).resolves.toEqual({ nombre: 'Bea' });
  });

  it('puede purgar a una usuaria concreta sin ser la activa', async () => {
    setCacheUser('ana');
    await writeCache('profile', { nombre: 'Ana' });
    setCacheUser('bea');

    await clearUserCache('ana');

    setCacheUser('ana');
    await expect(readCache('profile')).resolves.toBeUndefined();
  });
});

describe('offline-cache · removeCache', () => {
  it('quita una sola clave y deja el resto', async () => {
    await writeCache('tools', { a: 1 });
    await writeCache('events', { b: 2 });

    await removeCache('tools');

    await expect(readCache('tools')).resolves.toBeUndefined();
    await expect(readCache('events')).resolves.toEqual({ b: 2 });
  });
});
