import { beforeEach, describe, expect, it } from 'vitest';

import {
  ANONYMOUS_SCOPE,
  DB_NAME,
  DB_VERSION,
  STORES,
  USER_SCOPED_STORES,
  clearAllUserData,
  clearEverything,
  closeDb,
  getAllByUser,
  getRecord,
  openDb,
  putRecord,
  scopedKey,
  unscopeKey,
  userKeyRange,
  withTx,
  type ApiCacheRecord,
  type OutboxRecord,
} from '@/lib/idb';

// El cimiento de todo el estado offline. Lo que se prueba aqui es lo que el
// resto de la capa da por hecho: que los stores existen con sus indices, que
// las claves llevan la identidad del usuario dentro, y que cerrar sesion borra
// exactamente las filas de esa usuaria y ninguna otra (tablets compartidas).

beforeEach(async () => {
  await clearEverything();
});

describe('idb · esquema', () => {
  it('abre la base con los seis stores versionados', async () => {
    const db = await openDb();
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(
      ['apiCache', 'deadLetter', 'idMap', 'mediaIndex', 'meta', 'outbox'].sort(),
    );
  });

  it('crea el indice by-user en todos los stores con dueño', async () => {
    await withTx(USER_SCOPED_STORES, 'readonly', (tx) => {
      for (const store of USER_SCOPED_STORES) {
        expect([...tx.objectStore(store).indexNames]).toContain('by-user');
      }
    });
  });

  it('mediaIndex no esta scopeado por usuario, a proposito', () => {
    // Los medios son publicos y sin autenticacion: compartir una descarga
    // entre las docentes de una tablet es seguro y es justamente lo que se
    // quiere. Solo por eso puede enrutarlos el service worker.
    expect(USER_SCOPED_STORES).not.toContain(STORES.mediaIndex);
  });

  it('el outbox conserva el orden de llegada con seq autoincremental', async () => {
    const make = (id: string): OutboxRecord => ({
      id,
      userId: 'u1',
      kind: 'event.create',
      payload: {},
      chainKey: `event:${id}`,
      createdAt: Date.now(),
      attempts: 0,
      nextAttemptAt: 0,
      status: 'pending',
    });
    await putRecord(STORES.outbox, make('a'));
    await putRecord(STORES.outbox, make('b'));

    const rows = await getAllByUser<OutboxRecord>(STORES.outbox, 'u1');
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(rows[0].seq).toBeLessThan(rows[1].seq!);
  });

  it('reabre despues de closeDb() sin perder datos', async () => {
    await putRecord(STORES.meta, {
      id: scopedKey(ANONYMOUS_SCOPE, 'installPrompt'),
      userId: ANONYMOUS_SCOPE,
      name: 'installPrompt',
      value: 'dismissed',
      updatedAt: 1,
    });
    closeDb();
    const row = await getRecord<{ value: unknown }>(
      STORES.meta,
      scopedKey(ANONYMOUS_SCOPE, 'installPrompt'),
    );
    expect(row?.value).toBe('dismissed');
  });
});

describe('idb · migración v1 → v2', () => {
  // El índice viejo `by-nextAttemptAt` no llevaba la usuaria dentro, así que
  // recorrerlo devolvía "lo que toca reintentar" de todas las docentes de la
  // tablet. Se sustituye por el compuesto. La migración tiene que llegar sin
  // perder lo que ya hubiera guardado.
  function openV1(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const apiCache = db.createObjectStore(STORES.apiCache, { keyPath: 'id' });
        apiCache.createIndex('by-user', 'userId');
        apiCache.createIndex('by-fetchedAt', 'fetchedAt');
        const mediaIndex = db.createObjectStore(STORES.mediaIndex, { keyPath: 'id' });
        mediaIndex.createIndex('by-url', 'url');
        const outbox = db.createObjectStore(STORES.outbox, {
          keyPath: 'seq',
          autoIncrement: true,
        });
        outbox.createIndex('by-user', 'userId');
        outbox.createIndex('by-id', 'id', { unique: true });
        outbox.createIndex('by-nextAttemptAt', 'nextAttemptAt');
        const deadLetter = db.createObjectStore(STORES.deadLetter, {
          keyPath: 'seq',
          autoIncrement: true,
        });
        deadLetter.createIndex('by-user', 'userId');
        const idMap = db.createObjectStore(STORES.idMap, { keyPath: 'id' });
        idMap.createIndex('by-user', 'userId');
        const meta = db.createObjectStore(STORES.meta, { keyPath: 'id' });
        meta.createIndex('by-user', 'userId');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  beforeEach(async () => {
    closeDb();
    await new Promise<void>((resolve) => {
      const del = indexedDB.deleteDatabase(DB_NAME);
      del.onsuccess = () => resolve();
      del.onerror = () => resolve();
      del.onblocked = () => resolve();
    });
  });

  it('sube a v2, cambia el índice inseguro por el compuesto y no pierde datos', async () => {
    const v1 = await openV1();
    await new Promise<void>((resolve, reject) => {
      const tx = v1.transaction(STORES.outbox, 'readwrite');
      tx.objectStore(STORES.outbox).put({
        id: 'm-vieja',
        userId: 'ana',
        kind: 'profile.update',
        payload: { input: { name: 'Ana' } },
        chainKey: 'profile',
        createdAt: 1,
        attempts: 2,
        nextAttemptAt: 3,
        status: 'pending',
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    v1.close();

    const db = await openDb();
    expect(db.version).toBe(2);
    await withTx(STORES.outbox, 'readonly', (tx) => {
      const names = [...tx.objectStore(STORES.outbox).indexNames];
      expect(names).not.toContain('by-nextAttemptAt');
      expect(names).toContain('by-user-nextAttemptAt');
    });

    const rows = await getAllByUser<OutboxRecord>(STORES.outbox, 'ana');
    expect(rows).toHaveLength(1);
    expect(rows[0].attempts).toBe(2);
    expect(rows[0].chainKey).toBe('profile');
  });
});

describe('idb · claves con identidad de usuario', () => {
  it('scopedKey/unscopeKey hacen round-trip', () => {
    const k = scopedKey('u-42', 'emotions:list');
    expect(unscopeKey(k)).toEqual({ userId: 'u-42', key: 'emotions:list' });
  });

  it('claves iguales de usuarias distintas no colisionan', () => {
    expect(scopedKey('ana', 'tools')).not.toBe(scopedKey('bea', 'tools'));
  });

  it('una clave no puede escaparse de su namespace', () => {
    // El separador es U+0001, que no puede aparecer en un id ni en una
    // cacheKey, asi que no hay forma de fabricar "bea<sep>tools" desde ana.
    const forged = scopedKey('ana', 'x');
    expect(unscopeKey(forged)!.userId).toBe('ana');
  });

  it('userKeyRange cubre solo las claves de una usuaria', () => {
    const range = userKeyRange('ana');
    expect(range.includes(scopedKey('ana', 'tools'))).toBe(true);
    expect(range.includes(scopedKey('bea', 'tools'))).toBe(false);
  });
});

describe('idb · clearAllUserData', () => {
  const entry = (userId: string, key: string): ApiCacheRecord => ({
    id: scopedKey(userId, key),
    userId,
    cacheKey: key,
    data: { hello: userId },
    fetchedAt: Date.now(),
  });

  beforeEach(async () => {
    await putRecord(STORES.apiCache, entry('ana', 'tools'));
    await putRecord(STORES.apiCache, entry('bea', 'tools'));
    await putRecord(STORES.outbox, {
      id: 'm1',
      userId: 'ana',
      kind: 'profile.update',
      payload: {},
      chainKey: 'profile',
      createdAt: 0,
      attempts: 0,
      nextAttemptAt: 0,
      status: 'pending',
    } satisfies OutboxRecord);
    await putRecord(STORES.outbox, {
      id: 'm2',
      userId: 'bea',
      kind: 'profile.update',
      payload: {},
      chainKey: 'profile',
      createdAt: 0,
      attempts: 0,
      nextAttemptAt: 0,
      status: 'pending',
    } satisfies OutboxRecord);
    await putRecord(STORES.idMap, {
      id: scopedKey('ana', 'tmp-1'),
      userId: 'ana',
      tempId: 'tmp-1',
      entity: 'event',
      serverId: 's-1',
      mappedAt: 0,
    });
    await putRecord(STORES.deadLetter, {
      id: 'd1',
      userId: 'ana',
      kind: 'post.create',
      payload: {},
      chainKey: 'post:1',
      createdAt: 0,
      attempts: 5,
      nextAttemptAt: 0,
      failedAt: 0,
      reason: 'gone',
    });
    await putRecord(STORES.meta, {
      id: scopedKey('ana', 'lastSync'),
      userId: 'ana',
      name: 'lastSync',
      value: 1,
      updatedAt: 0,
    });
    await putRecord(STORES.mediaIndex, {
      id: 'video-1',
      url: 'https://cdn/e.mp4',
      sizeBytes: 10,
      downloadedAt: 0,
    });
  });

  it('vacia todos los stores con dueño de una sola llamada', async () => {
    await clearAllUserData('ana');
    for (const store of USER_SCOPED_STORES) {
      await expect(getAllByUser(store, 'ana')).resolves.toEqual([]);
    }
  });

  it('no toca los datos de las demas usuarias', async () => {
    await clearAllUserData('ana');
    await expect(getAllByUser<ApiCacheRecord>(STORES.apiCache, 'bea')).resolves.toHaveLength(1);
    await expect(getAllByUser<OutboxRecord>(STORES.outbox, 'bea')).resolves.toHaveLength(1);
  });

  it('conserva los medios descargados (son publicos, se comparten)', async () => {
    await clearAllUserData('ana');
    await expect(getRecord(STORES.mediaIndex, 'video-1')).resolves.toBeDefined();
  });

  it('es idempotente y no falla con una usuaria sin datos', async () => {
    await expect(clearAllUserData('sin-datos')).resolves.toBeUndefined();
    await expect(clearAllUserData('ana')).resolves.toBeUndefined();
    await expect(clearAllUserData('ana')).resolves.toBeUndefined();
  });
});
