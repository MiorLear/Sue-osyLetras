import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readAllCached, readCache, writeCache } from '@/lib/offline-cache';

// La cache JSON que alimenta a las pantallas offline. Se testea el contrato que
// hay que preservar al portarla a IndexedDB (MAINT-01): namespace de claves,
// tolerancia a datos corruptos y a fallos del almacenamiento.

const PREFIX = 'offline-data-v1:';

let store: Record<string, string>;
let failNext: string | null = null;

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => {
      if (failNext === 'getItem') throw new Error('storage down');
      return store[k] ?? null;
    }),
    setItem: vi.fn(async (k: string, v: string) => {
      if (failNext === 'setItem') throw new Error('quota exceeded');
      store[k] = v;
    }),
    getAllKeys: vi.fn(async () => {
      if (failNext === 'getAllKeys') throw new Error('storage down');
      return Object.keys(store);
    }),
    multiGet: vi.fn(async (keys: string[]) => keys.map((k) => [k, store[k] ?? null] as const)),
  },
}));

beforeEach(() => {
  store = {};
  failNext = null;
});

describe('offline-cache', () => {
  it('namespacea y versiona las claves', async () => {
    await writeCache('emotions:list', [{ id: 1 }]);
    expect(Object.keys(store)).toEqual([`${PREFIX}emotions:list`]);
  });

  it('hace round-trip de los datos', async () => {
    await writeCache('tools', { downloadables: [{ id: 'a' }] });
    await expect(readCache('tools')).resolves.toEqual({ downloadables: [{ id: 'a' }] });
  });

  it('devuelve undefined si no hay nada cacheado', async () => {
    await expect(readCache('nada')).resolves.toBeUndefined();
  });

  it('devuelve undefined en vez de tirar si el valor esta corrupto', async () => {
    store[`${PREFIX}tools`] = '{roto';
    await expect(readCache('tools')).resolves.toBeUndefined();
  });

  it('se traga un fallo de escritura (best-effort, no rompe la pantalla)', async () => {
    failNext = 'setItem';
    await expect(writeCache('tools', { a: 1 })).resolves.toBeUndefined();
  });

  it('se traga un fallo de lectura', async () => {
    failNext = 'getItem';
    await expect(readCache('tools')).resolves.toBeUndefined();
  });
});

describe('offline-cache · readAllCached', () => {
  it('devuelve solo las entradas del namespace, sin el prefijo', async () => {
    await writeCache('emotions:list', [1]);
    await writeCache('tools', { a: 1 });
    store['otra-cosa'] = '"ajeno"';
    store['offline-mutations-v1'] = '[]';

    await expect(readAllCached()).resolves.toEqual({ 'emotions:list': [1], tools: { a: 1 } });
  });

  it('salta las entradas corruptas y conserva el resto', async () => {
    await writeCache('tools', { a: 1 });
    store[`${PREFIX}emotions:list`] = '{roto';

    await expect(readAllCached()).resolves.toEqual({ tools: { a: 1 } });
  });

  it('devuelve {} si el almacenamiento falla', async () => {
    failNext = 'getAllKeys';
    await expect(readAllCached()).resolves.toEqual({});
  });
});
