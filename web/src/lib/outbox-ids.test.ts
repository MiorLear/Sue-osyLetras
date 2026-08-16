import { beforeEach, describe, expect, it } from 'vitest';

import { cacheKeys } from '@/lib/cache-keys';
import {
  STORES,
  clearEverything,
  getAllByUser,
  scopedKey,
  withTx,
  type ApiCacheRecord,
  type IdMapRecord,
  type OutboxRecord,
} from '@/lib/idb';
import { readCacheEntry, setCacheUser, writeCache } from '@/lib/offline-cache';
import {
  ID_MAP_LIMIT,
  ID_MAP_MAX_AGE_MS,
  isTempEventId,
  isTempPostId,
  newTempEventId,
  newTempPostId,
  resolveEventId,
  resolvePostId,
  type CreatedRow,
} from '@/lib/outbox-ids';
import {
  __resetOutbox,
  applyRemapInTx,
  enqueueEventUpdate,
  enqueuePostComment,
  enqueuePostLike,
  listPending,
} from '@/lib/outbox';

// Lo que hace posible que una docente publique sin conexión y le dé "me gusta"
// a su propia publicación: el "me gusta" tiene que salir después del alta,
// contra un id que cuando ella lo pulsó todavía no existía. Es BUG-06.

const ANA = 'ana';

beforeEach(async () => {
  await clearEverything();
  __resetOutbox();
  setCacheUser(ANA);
});

const remap = (
  entity: 'event' | 'post',
  tempId: string | number,
  serverId: string,
  created: CreatedRow,
) =>
  withTx([STORES.outbox, STORES.idMap, STORES.apiCache], 'readwrite', (tx) =>
    applyRemapInTx(tx, ANA, entity, tempId, serverId, created),
  );

describe('outbox-ids · acuñación', () => {
  it('un id de evento provisional se reconoce a simple vista', () => {
    const id = newTempEventId();
    expect(id.startsWith('tmp-')).toBe(true);
    expect(isTempEventId(id)).toBe(true);
    expect(isTempEventId('sesion-marzo')).toBe(false);
  });

  it('un id de publicación provisional está por encima del suelo', () => {
    expect(isTempPostId(newTempPostId())).toBe(true);
    expect(isTempPostId(42)).toBe(false);
  });

  it('dos publicaciones en el mismo milisegundo no comparten id', () => {
    // Si colisionaran, un id provisional apuntaría a dos publicaciones del
    // servidor y los "me gusta" de una se pegarían a la otra.
    const ids = new Set(Array.from({ length: 50 }, () => newTempPostId()));
    expect(ids.size).toBe(50);
  });

  it('sin mapeo, resolver devuelve el mismo id', async () => {
    await expect(resolveEventId('tmp-x')).resolves.toBe('tmp-x');
    await expect(resolvePostId(1e12 + 5)).resolves.toBe(1e12 + 5);
    await expect(resolveEventId('e-real')).resolves.toBe('e-real');
  });
});

describe('outbox-ids · remapeo tras el alta', () => {
  it('el me gusta y el comentario encolados salen con el id de verdad', async () => {
    const temp = newTempPostId();
    await enqueuePostLike(temp);
    await enqueuePostComment(temp, { text: 'qué ilusión' });

    await remap('post', temp, '88', { id: 88 });

    const pending = await listPending();
    expect(pending.map((p) => p.mutation)).toEqual([
      { kind: 'post.like', postId: 88 },
      { kind: 'post.comment', postId: 88, input: { text: 'qué ilusión' } },
    ]);
    expect(pending.every((p) => p.chainKey === 'post:88')).toBe(true);
  });

  it('la edición y el borrado de un evento salen con el id de verdad', async () => {
    const temp = newTempEventId();
    await enqueueEventUpdate(temp, { title: 'Corregido' });

    await remap('event', temp, 'e-99', { id: 'e-99' });

    const pending = await listPending();
    expect(pending[0].mutation).toEqual({
      kind: 'event.update',
      targetId: 'e-99',
      input: { title: 'Corregido' },
    });
    expect(pending[0].chainKey).toBe('event:e-99');
  });

  it('un cambio encolado DESPUÉS del alta ya sincronizada apunta al id real', async () => {
    // Este es el fallo que arrastra la versión RN: allí solo se miraba si el
    // alta seguía pendiente, así que una edición posterior salía contra `tmp-…`
    // y daba 404 para siempre.
    const temp = newTempEventId();
    await remap('event', temp, 'e-99', { id: 'e-99' });

    await enqueueEventUpdate(temp, { title: 'Tarde pero bien' });

    const pending = await listPending();
    expect(pending[0].mutation).toMatchObject({ targetId: 'e-99' });
  });

  it('dos me gusta a ambos lados del sync se siguen anulando', async () => {
    // Sin reescribir el chainKey junto al payload, el segundo caería en otra
    // cadena, no se anularía con el primero, y el servidor acabaría con la
    // reacción puesta mientras la pantalla la enseña quitada.
    const temp = newTempPostId();
    await enqueuePostLike(temp);
    await remap('post', temp, '88', { id: 88 });
    await enqueuePostLike(temp);

    await expect(listPending()).resolves.toEqual([]);
  });
});

describe('outbox-ids · costura con la caché', () => {
  it('sustituye la fila provisional por la del servidor, sin duplicar', async () => {
    const temp = newTempEventId();
    await writeCache(cacheKeys.events(), [
      { id: 'e-1', title: 'Antigua' },
      { id: temp, title: 'Recién creada' },
    ]);

    await remap('event', temp, 'e-99', { id: 'e-99', title: 'Recién creada' });

    const entry = await readCacheEntry<{ id: string }[]>(cacheKeys.events());
    expect(entry!.data.map((e) => e.id)).toEqual(['e-1', 'e-99']);
  });

  it('coser dos veces no deja la fila repetida', async () => {
    const temp = newTempEventId();
    await writeCache(cacheKeys.events(), [{ id: temp, title: 'X' }]);
    await remap('event', temp, 'e-99', { id: 'e-99', title: 'X' });
    await remap('event', temp, 'e-99', { id: 'e-99', title: 'X' });

    const entry = await readCacheEntry<{ id: string }[]>(cacheKeys.events());
    expect(entry!.data).toHaveLength(1);
  });

  it('una publicación etiquetada se cose en todas las listas donde vive', async () => {
    const temp = newTempPostId();
    await writeCache(cacheKeys.posts(undefined), [{ id: temp, text: 'hola' }]);
    await writeCache(cacheKeys.posts('alegria'), [{ id: temp, text: 'hola' }]);
    await writeCache(cacheKeys.events(), [{ id: 'e-1' }]);

    await remap('post', temp, '88', { id: 88, text: 'hola' });

    for (const key of [cacheKeys.posts(undefined), cacheKeys.posts('alegria')]) {
      const entry = await readCacheEntry<{ id: number }[]>(key);
      expect(entry!.data.map((p) => p.id)).toEqual([88]);
    }
    // Y no toca listas de otra cosa.
    const events = await readCacheEntry<{ id: string }[]>(cacheKeys.events());
    expect(events!.data).toEqual([{ id: 'e-1' }]);
  });

  it('no rejuvenece la caché al coser', async () => {
    // Mentir sobre la edad rompe el aviso de "esto es de hace tres días".
    const temp = newTempEventId();
    await writeCache(cacheKeys.events(), [{ id: temp }]);
    const before = (await readCacheEntry(cacheKeys.events()))!.fetchedAt;

    await remap('event', temp, 'e-99', { id: 'e-99' });

    const after = (await readCacheEntry(cacheKeys.events()))!.fetchedAt;
    expect(after).toBe(before);
  });
});

describe('outbox-ids · poda del mapa', () => {
  const seed = async (count: number, mappedAt: (i: number) => number) => {
    for (let i = 0; i < count; i += 1) {
      await withTx(STORES.idMap, 'readwrite', (tx) => {
        tx.objectStore(STORES.idMap).put({
          id: scopedKey(ANA, `event:tmp-${i}`),
          userId: ANA,
          tempId: `tmp-${i}`,
          entity: 'event',
          serverId: `e-${i}`,
          mappedAt: mappedAt(i),
        } satisfies IdMapRecord);
      });
    }
  };

  it('se queda con los más recientes cuando pasa del límite', async () => {
    await seed(ID_MAP_LIMIT + 10, (i) => Date.now() - (ID_MAP_LIMIT + 10 - i) * 1000);
    await remap('event', 'tmp-nuevo', 'e-nuevo', { id: 'e-nuevo' });

    const rows = await getAllByUser<IdMapRecord>(STORES.idMap, ANA);
    expect(rows).toHaveLength(ID_MAP_LIMIT);
    // El más viejo se fue; el recién mapeado está.
    expect(rows.some((r) => r.tempId === 'tmp-0')).toBe(false);
    expect(rows.some((r) => r.tempId === 'tmp-nuevo')).toBe(true);
  });

  it('descarta los caducados aunque quepan de sobra', async () => {
    await seed(3, () => Date.now() - ID_MAP_MAX_AGE_MS - 60_000);
    await remap('event', 'tmp-nuevo', 'e-nuevo', { id: 'e-nuevo' });

    const rows = await getAllByUser<IdMapRecord>(STORES.idMap, ANA);
    expect(rows.map((r) => r.tempId)).toEqual(['tmp-nuevo']);
  });

  it('no toca el mapa de otra usuaria de la misma tablet', async () => {
    setCacheUser('bea');
    await withTx(STORES.idMap, 'readwrite', (tx) => {
      tx.objectStore(STORES.idMap).put({
        id: scopedKey('bea', 'event:tmp-b'),
        userId: 'bea',
        tempId: 'tmp-b',
        entity: 'event',
        serverId: 'e-b',
        mappedAt: 0,
      } satisfies IdMapRecord);
    });
    setCacheUser(ANA);

    await remap('event', 'tmp-a', 'e-a', { id: 'e-a' });

    await expect(getAllByUser<IdMapRecord>(STORES.idMap, 'bea')).resolves.toHaveLength(1);
  });
});

describe('outbox-ids · el remapeo no cruza usuarias', () => {
  it('no reescribe las filas encoladas por otra docente', async () => {
    setCacheUser('bea');
    await enqueuePostLike(1e12 + 1);
    setCacheUser(ANA);

    await remap('post', 1e12 + 1, '88', { id: 88 });

    const deBea = await getAllByUser<OutboxRecord>(STORES.outbox, 'bea');
    expect(deBea[0].payload).toMatchObject({ postId: 1e12 + 1 });
    expect(deBea[0].chainKey).toBe(`post:${1e12 + 1}`);
  });

  it('no cose la caché de otra docente', async () => {
    setCacheUser('bea');
    await writeCache(cacheKeys.events(), [{ id: 'tmp-compartido' }]);
    setCacheUser(ANA);

    await remap('event', 'tmp-compartido', 'e-99', { id: 'e-99' });

    setCacheUser('bea');
    const entry = await readCacheEntry<{ id: string }[]>(cacheKeys.events());
    expect(entry!.data).toEqual([{ id: 'tmp-compartido' }]);
  });
});

describe('outbox-ids · caché sin lista', () => {
  it('coser una clave que no existe no rompe nada', async () => {
    await expect(remap('event', 'tmp-1', 'e-9', { id: 'e-9' })).resolves.toBeUndefined();
  });

  it('coser una entrada que no es una lista la deja en paz', async () => {
    await writeCache(cacheKeys.events(), { noEsUnaLista: true } as never);
    await remap('event', 'tmp-1', 'e-9', { id: 'e-9' });
    const entry = await readCacheEntry(cacheKeys.events());
    expect(entry!.data).toEqual({ noEsUnaLista: true });
  });

  it('el ApiCacheRecord conserva su forma tras la costura', async () => {
    await writeCache(cacheKeys.events(), [{ id: 'tmp-1' }]);
    await remap('event', 'tmp-1', 'e-9', { id: 'e-9' });
    const rows = await getAllByUser<ApiCacheRecord>(STORES.apiCache, ANA);
    expect(rows[0]).toMatchObject({ userId: ANA, cacheKey: cacheKeys.events() });
  });
});
