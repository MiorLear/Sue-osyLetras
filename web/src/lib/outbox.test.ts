import { beforeEach, describe, expect, it } from 'vitest';

import { STORES, clearEverything, closeDb, getAllByUser, putRecord, type OutboxRecord } from '@/lib/idb';
import { setCacheUser } from '@/lib/offline-cache';
import { __resetSyncStatus } from '@/lib/sync-status';
import {
  __resetOutbox,
  chainKeyOf,
  coalesce,
  enqueueEventCreate,
  enqueueEventRemove,
  enqueueEventUpdate,
  enqueuePostComment,
  enqueuePostCreate,
  enqueuePostLike,
  enqueueProfileUpdate,
  listPending,
  refreshPendingCount,
  toMutation,
  toRecord,
  type Mutation,
} from '@/lib/outbox';

// La bandeja de salida guarda trabajo que la docente cree hecho y que el
// servidor todavía no tiene. Lo que se prueba aquí es lo que hace que no se le
// pierda: que dos cambios sobre lo mismo se fundan en uno, que un cambio que
// ella deshizo no llegue a salir, y que la fila de una docente sea invisible
// para la sesión de otra en la misma tablet.

const ANA = 'ana';

beforeEach(async () => {
  await clearEverything();
  __resetOutbox();
  __resetSyncStatus();
  setCacheUser(ANA);
});

const rowsOf = () => getAllByUser<OutboxRecord>(STORES.outbox, ANA);
const record = (m: Mutation, seq?: number): OutboxRecord => ({ ...toRecord(m, ANA), seq });

describe('outbox · chainKey', () => {
  it('agrupa por instancia de entidad, no por tipo de cambio', () => {
    expect(chainKeyOf({ kind: 'profile.update', input: {} })).toBe('profile');
    expect(chainKeyOf({ kind: 'event.create', tempId: 'tmp-1', input: {} as never })).toBe('event:tmp-1');
    expect(chainKeyOf({ kind: 'event.update', targetId: 'e9', input: {} })).toBe('event:e9');
    expect(chainKeyOf({ kind: 'event.remove', targetId: 'e9' })).toBe('event:e9');
    expect(chainKeyOf({ kind: 'post.create', tempId: 5, input: { text: 'x' } })).toBe('post:5');
    expect(chainKeyOf({ kind: 'post.like', postId: 7 })).toBe('post:7');
    expect(chainKeyOf({ kind: 'post.comment', postId: 7, input: { text: 'a' } })).toBe('post:7');
  });

  it('dos eventos distintos son dos cadenas independientes', () => {
    const a = chainKeyOf({ kind: 'event.update', targetId: 'e1', input: {} });
    const b = chainKeyOf({ kind: 'event.update', targetId: 'e2', input: {} });
    expect(a).not.toBe(b);
  });
});

describe('outbox · fusión de cambios (pura)', () => {
  it('el perfil se queda con la última edición', () => {
    const previous = record({ kind: 'profile.update', input: { name: 'A' } }, 1);
    const next = record({ kind: 'profile.update', input: { name: 'B' } });
    expect(coalesce([previous], next)).toEqual([
      { type: 'delete', seq: 1 },
      { type: 'put', record: next },
    ]);
  });

  it('un me gusta pulsado dos veces se anula', () => {
    const previous = record({ kind: 'post.like', postId: 7 }, 4);
    const next = record({ kind: 'post.like', postId: 7 });
    expect(coalesce([previous], next)).toEqual([{ type: 'delete', seq: 4 }]);
  });

  it('dos comentarios son dos comentarios', () => {
    const previous = record({ kind: 'post.comment', postId: 7, input: { text: 'a' } }, 4);
    const next = record({ kind: 'post.comment', postId: 7, input: { text: 'b' } });
    expect(coalesce([previous], next)).toEqual([{ type: 'put', record: next }]);
  });

  it('editar un evento con su alta pendiente pliega la edición dentro del alta', () => {
    const create = record(
      { kind: 'event.create', tempId: 'tmp-1', input: { title: 'Viejo', startTime: '10:00' } as never },
      2,
    );
    const update = record({ kind: 'event.update', targetId: 'tmp-1', input: { title: 'Nuevo' } });
    const ops = coalesce([create], update);
    expect(ops).toHaveLength(1);
    const [op] = ops;
    expect(op.type).toBe('put');
    if (op.type !== 'put') throw new Error('esperaba un put');
    // Sigue siendo un alta, con su seq: así no adelanta a su propia cadena.
    expect(op.record.kind).toBe('event.create');
    expect(op.record.seq).toBe(2);
    expect(op.record.payload).toMatchObject({ input: { title: 'Nuevo', startTime: '10:00' } });
  });

  it('dos ediciones seguidas se funden conservando su seq', () => {
    const first = record({ kind: 'event.update', targetId: 'e9', input: { title: 'A' } }, 3);
    const second = record({ kind: 'event.update', targetId: 'e9', input: { completed: true } });
    const ops = coalesce([first], second);
    expect(ops).toHaveLength(1);
    const [op] = ops;
    if (op.type !== 'put') throw new Error('esperaba un put');
    expect(op.record.seq).toBe(3);
    expect(op.record.payload).toMatchObject({ input: { title: 'A', completed: true } });
  });

  it('borrar un evento con su alta pendiente cancela la cadena entera', () => {
    const create = record({ kind: 'event.create', tempId: 'tmp-1', input: {} as never }, 1);
    const update = record({ kind: 'event.update', targetId: 'tmp-1', input: {} }, 2);
    const remove = record({ kind: 'event.remove', targetId: 'tmp-1' });
    expect(coalesce([create, update], remove)).toEqual([
      { type: 'delete', seq: 1 },
      { type: 'delete', seq: 2 },
    ]);
  });

  it('borrar un evento real descarta sus ediciones pendientes', () => {
    const update = record({ kind: 'event.update', targetId: 'e9', input: {} }, 5);
    const remove = record({ kind: 'event.remove', targetId: 'e9' });
    expect(coalesce([update], remove)).toEqual([
      { type: 'delete', seq: 5 },
      { type: 'put', record: remove },
    ]);
  });
});

describe('outbox · encolado sobre IndexedDB', () => {
  it('guardar el perfil cinco veces deja un cambio, no cinco', async () => {
    for (const name of ['A', 'B', 'C', 'D', 'E']) {
      await enqueueProfileUpdate({ name });
    }
    const rows = await rowsOf();
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toMatchObject({ input: { name: 'E' } });
  });

  it('crear un evento y corregirlo cuatro veces es una sola llamada al reconectar', async () => {
    await enqueueEventCreate('tmp-1', { title: 'Uno' } as never);
    for (const title of ['Dos', 'Tres', 'Cuatro', 'Cinco']) {
      await enqueueEventUpdate('tmp-1', { title });
    }
    const rows = await rowsOf();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('event.create');
    expect(rows[0].payload).toMatchObject({ input: { title: 'Cinco' } });
  });

  it('crear un evento y borrarlo sin conexión no llega nunca al servidor', async () => {
    await enqueueEventCreate('tmp-1', { title: 'Uno' } as never);
    await enqueueEventUpdate('tmp-1', { title: 'Dos' });
    await enqueueEventRemove('tmp-1');
    await expect(rowsOf()).resolves.toEqual([]);
  });

  it('el me gusta pulsado dos veces no deja rastro', async () => {
    await enqueuePostLike(7);
    await enqueuePostLike(7);
    await expect(rowsOf()).resolves.toEqual([]);
  });

  it('no cancela un me gusta que ya salió por la red', async () => {
    // Una fila en vuelo no se puede deshacer localmente: el servidor la va a
    // recibir igual, y borrarla aquí dejaría la pantalla diciendo lo contrario
    // que él. El toggle se encola detrás, y el servidor recibe like → unlike.
    await putRecord(STORES.outbox, {
      ...toRecord({ kind: 'post.like', postId: 7 }, ANA),
      status: 'inflight',
      leaseOwner: 'otra-pestaña',
      leaseUntil: Date.now() + 60_000,
    });
    await enqueuePostLike(7);
    const rows = await rowsOf();
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.status === 'inflight')).toHaveLength(1);
  });

  it('conserva el orden de llegada entre cadenas distintas', async () => {
    await enqueueProfileUpdate({ name: 'A' });
    await enqueuePostComment(7, { text: 'hola' });
    await enqueueEventCreate('tmp-9', { title: 'Sesión' } as never);
    const pending = await listPending();
    expect(pending.map((p) => p.mutation.kind)).toEqual([
      'profile.update',
      'post.comment',
      'event.create',
    ]);
  });

  it('publica el número de cambios que espera el aviso de arriba', async () => {
    await enqueuePostCreate(1e12 + 1, { text: 'hola' });
    await enqueuePostComment(3, { text: 'qué tal' });
    await expect(refreshPendingCount()).resolves.toBe(2);
  });
});

describe('outbox · ámbito por usuaria (tablets compartidas)', () => {
  it('las filas de una docente son invisibles para la sesión de otra', async () => {
    await enqueueProfileUpdate({ name: 'Ana' });
    setCacheUser('bea');
    await expect(listPending()).resolves.toEqual([]);

    await enqueueProfileUpdate({ name: 'Bea' });
    const deBea = await listPending();
    expect(deBea).toHaveLength(1);
    expect(deBea[0].mutation).toMatchObject({ input: { name: 'Bea' } });

    setCacheUser(ANA);
    const deAna = await listPending();
    expect(deAna).toHaveLength(1);
    expect(deAna[0].mutation).toMatchObject({ input: { name: 'Ana' } });
  });

  it('el perfil de una no se funde con el de la otra aunque compartan cadena', async () => {
    await enqueueProfileUpdate({ name: 'Ana' });
    setCacheUser('bea');
    await enqueueProfileUpdate({ name: 'Bea' });
    await expect(getAllByUser<OutboxRecord>(STORES.outbox, ANA)).resolves.toHaveLength(1);
    await expect(getAllByUser<OutboxRecord>(STORES.outbox, 'bea')).resolves.toHaveLength(1);
  });
});

describe('outbox · persistencia', () => {
  it('los cambios sobreviven a cerrar y reabrir la base', async () => {
    await enqueuePostComment(7, { text: 'sigo aquí' });
    closeDb();
    const pending = await listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].mutation).toMatchObject({ postId: 7 });
  });

  it('una fila con forma desconocida no se reensambla y no revienta la lista', async () => {
    // Una guardada por una versión anterior de la app. Vale más apartarla que
    // dejar que tire abajo toda la pasada.
    await putRecord(STORES.outbox, {
      id: 'm-rara',
      userId: ANA,
      kind: 'post.reaccion-que-ya-no-existe',
      payload: { loQueSea: true },
      chainKey: 'post:1',
      createdAt: 0,
      attempts: 0,
      nextAttemptAt: 0,
      status: 'pending',
    } satisfies OutboxRecord);
    await enqueuePostComment(7, { text: 'válido' });

    const pending = await listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].mutation.kind).toBe('post.comment');
    // Pero la fila sigue en la base: apartarla es trabajo del replay, no de leer.
    await expect(rowsOf()).resolves.toHaveLength(2);
  });

  it('toMutation rechaza un payload al que le faltan campos', () => {
    const broken: OutboxRecord = {
      id: 'm1',
      userId: ANA,
      kind: 'event.update',
      payload: { input: {} },
      chainKey: 'event:e1',
      createdAt: 0,
      attempts: 0,
      nextAttemptAt: 0,
      status: 'pending',
    };
    expect(toMutation(broken)).toBeNull();
  });
});
