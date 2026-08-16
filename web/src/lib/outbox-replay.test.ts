import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@explorarte/shared';

// El código más arriesgado de la app: guarda trabajo que la docente cree hecho
// y falla en silencio. Cada bloque de aquí fija una regresión concreta.

const api = vi.hoisted(() => ({
  profile: { update: vi.fn() },
  events: { create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  posts: { create: vi.fn(), toggleLike: vi.fn(), addComment: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api }));

const net = vi.hoisted(() => ({
  isOnline: vi.fn(() => true),
  checkReachability: vi.fn(async () => true),
  subscribeNetwork: vi.fn(() => () => undefined),
}));
vi.mock('@/lib/useNetworkStatus', () => net);

import {
  STORES,
  clearEverything,
  getAllByUser,
  putRecord,
  type DeadLetterRecord,
  type OutboxRecord,
} from '@/lib/idb';
import { readCache, setCacheUser, writeCache } from '@/lib/offline-cache';
import { __resetDeadSession, onDeadSession } from '@/lib/offline-errors';
import { cacheKeys } from '@/lib/cache-keys';
import { MAX_ATTEMPTS } from '@/lib/outbox-errors';
import { __resetSyncStatus, lastSyncTime } from '@/lib/sync-status';
import {
  __resetOutbox,
  enqueueEventUpdate,
  enqueuePostComment,
  enqueuePostCreate,
  enqueuePostLike,
  enqueueProfileUpdate,
  listRows,
  replayPass,
  sweepStale,
  toRecord,
  type Mutation,
} from '@/lib/outbox';

const ANA = 'ana';
const httpError = (status: number) => new ApiError(status, `falló: ${status}`);

const rows = (userId = ANA) => getAllByUser<OutboxRecord>(STORES.outbox, userId);
const dead = (userId = ANA) => getAllByUser<DeadLetterRecord>(STORES.deadLetter, userId);

/** Siembra una fila saltándose el encolado, para fijar un estado concreto. */
const seed = (mutation: Mutation, patch: Partial<OutboxRecord> = {}) =>
  putRecord(STORES.outbox, { ...toRecord(mutation, ANA), ...patch });

beforeEach(async () => {
  vi.clearAllMocks();
  await clearEverything();
  __resetOutbox();
  __resetSyncStatus();
  __resetDeadSession();
  // Sin esto, el manejador por defecto intenta navegar a /login y jsdom llena
  // la salida de "Not implemented: navigation".
  onDeadSession(() => undefined);
  setCacheUser(ANA);
  net.isOnline.mockReturnValue(true);
  net.checkReachability.mockResolvedValue(true);
  api.profile.update.mockResolvedValue({ id: 1 });
  api.events.create.mockResolvedValue({ id: 'e-99' });
  api.events.update.mockResolvedValue({ id: 'e-99' });
  api.events.remove.mockResolvedValue(undefined);
  api.posts.create.mockResolvedValue({ id: 88 });
  api.posts.toggleLike.mockResolvedValue({ id: 88 });
  api.posts.addComment.mockResolvedValue({ text: 'ok' });
});

describe('replay · lo normal', () => {
  it('vacía la bandeja y la deja limpia', async () => {
    await enqueueProfileUpdate({ name: 'Ana' });
    await enqueuePostComment(7, { text: 'hola' });

    const result = await replayPass();

    expect(result).toMatchObject({ dispatched: 2, dead: 0, stopped: 'drained' });
    await expect(rows()).resolves.toEqual([]);
    expect(api.profile.update).toHaveBeenCalledWith({ name: 'Ana' });
    expect(api.posts.addComment).toHaveBeenCalledWith(7, { text: 'hola' });
  });

  it('no intenta nada sin conexión', async () => {
    net.isOnline.mockReturnValue(false);
    await enqueueProfileUpdate({ name: 'Ana' });

    await expect(replayPass()).resolves.toMatchObject({ stopped: 'skipped' });
    expect(api.profile.update).not.toHaveBeenCalled();
    await expect(rows()).resolves.toHaveLength(1);
  });

  it('respeta el orden dentro de una misma cadena', async () => {
    const order: string[] = [];
    api.posts.create.mockImplementation(async () => {
      order.push('create');
      return { id: 88 };
    });
    api.posts.addComment.mockImplementation(async () => {
      order.push('comment');
      return { text: 'ok' };
    });
    const temp = 1e12 + 1;
    await enqueuePostCreate(temp, { text: 'nueva' });
    await enqueuePostComment(temp, { text: 'mío' });

    await replayPass();

    expect(order).toEqual(['create', 'comment']);
  });

  it('el comentario de una publicación creada sin conexión sale con el id real', async () => {
    // BUG-06.
    const temp = 1e12 + 1;
    await enqueuePostCreate(temp, { text: 'nueva' });
    await enqueuePostLike(temp);

    await replayPass();

    expect(api.posts.toggleLike).toHaveBeenCalledWith(88);
    await expect(rows()).resolves.toEqual([]);
  });

  it('marca "sincronizando" una vez por pasada, no una por petición', async () => {
    await enqueueProfileUpdate({ name: 'Ana' });
    expect(lastSyncTime()).toBeNull();
    await replayPass();
    expect(lastSyncTime()).not.toBeNull();
  });

  it('una pasada con la cola vacía no enciende el aviso', async () => {
    await replayPass();
    expect(lastSyncTime()).toBeNull();
  });
});

describe('replay · independencia entre cadenas (BUG-03)', () => {
  it('un evento atascado no retiene al perfil', async () => {
    // La versión RN cortaba la pasada entera al primer fallo pasajero, así que
    // una edición de evento con un 500 dejaba de rehén a una de perfil durante
    // horas. Esa es la forma real de BUG-03.
    api.events.update.mockRejectedValue(httpError(500));
    await enqueueEventUpdate('e-1', { title: 'Atascado' });
    await enqueueProfileUpdate({ name: 'Ana' });

    const result = await replayPass();

    expect(api.profile.update).toHaveBeenCalledTimes(1);
    expect(result.dispatched).toBe(1);
    const left = await rows();
    expect(left).toHaveLength(1);
    expect(left[0].kind).toBe('event.update');
    expect(left[0].attempts).toBe(1);
  });

  it('reparte por turnos: el perfil no espera detrás de cinco comentarios', async () => {
    const order: string[] = [];
    api.posts.addComment.mockImplementation(async () => {
      order.push('comment');
      return { text: 'ok' };
    });
    api.profile.update.mockImplementation(async () => {
      order.push('profile');
      return { id: 1 };
    });
    for (const text of ['a', 'b', 'c', 'd', 'e']) {
      await enqueuePostComment(7, { text });
    }
    await enqueueProfileUpdate({ name: 'Ana' });

    await replayPass();

    // Sale en la primera vuelta, no la sexta.
    expect(order.indexOf('profile')).toBe(1);
    expect(order.filter((o) => o === 'comment')).toHaveLength(5);
  });

  it('una cadena envenenada no impide que las demás drenen', async () => {
    api.events.update.mockImplementation(async (id: string) => {
      if (id === 'e-1') throw httpError(400);
      return { id };
    });
    await enqueueEventUpdate('e-1', { title: 'Imposible' });
    await enqueueEventUpdate('e-2', { title: 'Buena' });
    await enqueueProfileUpdate({ name: 'Ana' });

    const result = await replayPass();

    expect(result.dead).toBe(1);
    expect(result.dispatched).toBe(2);
    expect(api.profile.update).toHaveBeenCalledTimes(1);
    await expect(rows()).resolves.toEqual([]);
    await expect(dead()).resolves.toHaveLength(1);
  });
});

describe('replay · lo que el servidor no va a aceptar', () => {
  it('aparta un cambio que esta versión ya no sabe leer, sin gastar una petición', async () => {
    await putRecord(STORES.outbox, {
      id: 'm-antigua',
      userId: ANA,
      kind: 'post.reaccion-retirada',
      payload: { loQueSea: true },
      chainKey: 'post:1',
      createdAt: Date.now(),
      attempts: 0,
      nextAttemptAt: 0,
      status: 'pending',
    } satisfies OutboxRecord);
    await enqueueProfileUpdate({ name: 'Ana' });

    await replayPass();

    expect(api.posts.toggleLike).not.toHaveBeenCalled();
    expect(api.profile.update).toHaveBeenCalledTimes(1);
    const apartadas = await dead();
    expect(apartadas).toHaveLength(1);
    expect(apartadas[0].reason).toContain('versión anterior');
  });

  it('si el alta muere, se lleva consigo lo que dependía de ella', async () => {
    api.posts.create.mockRejectedValue(httpError(400));
    const temp = 1e12 + 1;
    await enqueuePostCreate(temp, { text: 'nueva' });
    await enqueuePostLike(temp);
    await enqueuePostComment(temp, { text: 'mío' });

    await replayPass();

    // Sin id de servidor que mapear, replicar el resto solo daría 404 contra
    // algo que nunca existió.
    expect(api.posts.toggleLike).not.toHaveBeenCalled();
    expect(api.posts.addComment).not.toHaveBeenCalled();
    await expect(rows()).resolves.toEqual([]);
    const apartadas = await dead();
    expect(apartadas).toHaveLength(3);
    expect(apartadas.filter((d) => d.reason === 'La publicación no se pudo crear.')).toHaveLength(2);
  });

  it('un 404 se lleva lo que venía detrás en su cadena', async () => {
    api.events.update.mockRejectedValue(httpError(404));
    // Sembradas, no encoladas: encolar un borrado sobre una edición pendiente
    // la descartaría de entrada, que es otra regla y ya tiene su test.
    await seed({ kind: 'event.update', targetId: 'e-1', input: { title: 'X' } });
    await seed({ kind: 'event.remove', targetId: 'e-1' });

    await replayPass();

    expect(api.events.remove).not.toHaveBeenCalled();
    await expect(dead()).resolves.toHaveLength(2);
  });

  it('un 409 muere solo: lo de detrás sigue siendo válido', async () => {
    api.events.update.mockRejectedValue(httpError(409));
    await seed({ kind: 'event.update', targetId: 'e-1', input: { title: 'X' } });
    await seed({ kind: 'event.remove', targetId: 'e-1' });

    await replayPass();

    expect(api.events.remove).toHaveBeenCalledWith('e-1');
    await expect(dead()).resolves.toHaveLength(1);
    await expect(rows()).resolves.toEqual([]);
  });

  it('al agotar los intentos, el cambio pasa a la lista de fallidos', async () => {
    api.profile.update.mockRejectedValue(httpError(500));
    await seed({ kind: 'profile.update', input: { name: 'Ana' } }, {
      attempts: MAX_ATTEMPTS - 1,
      nextAttemptAt: 0,
    });

    await replayPass();

    await expect(rows()).resolves.toEqual([]);
    const apartadas = await dead();
    expect(apartadas[0].reason).toBe('No se pudo enviar tras varios intentos.');
    expect(apartadas[0].attempts).toBe(MAX_ATTEMPTS - 1);
  });

  it('un cambio nunca queda en cero stores ni en dos', async () => {
    api.profile.update.mockRejectedValue(httpError(400));
    await enqueueProfileUpdate({ name: 'Ana' });

    await replayPass();

    await expect(rows()).resolves.toHaveLength(0);
    await expect(dead()).resolves.toHaveLength(1);
  });
});

describe('replay · sesión muerta (no se pierde el trabajo)', () => {
  it('un 401 corta la pasada sin gastar intento', async () => {
    api.profile.update.mockRejectedValue(httpError(401));
    await enqueueProfileUpdate({ name: 'Ana' });
    await enqueuePostComment(7, { text: 'hola' });

    const result = await replayPass();

    expect(result.stopped).toBe('session');
    const left = await rows();
    expect(left).toHaveLength(2);
    expect(left.every((r) => r.attempts === 0)).toBe(true);
    expect(left.every((r) => r.nextAttemptAt === 0)).toBe(true);
  });

  it('la purga se lleva la caché y DEJA el trabajo sin sincronizar', async () => {
    // Este es el test que impide que alguien "arregle" la purga volviendo a
    // borrarlo todo: un token caducado destruiría trabajo que la docente cree
    // guardado, y el criterio de PWA-3.2 —"reanuda tras volver a entrar"— sería
    // imposible de cumplir.
    api.profile.update.mockRejectedValue(httpError(403));
    await writeCache(cacheKeys.events(), [{ id: 'e-1' }]);
    await enqueueProfileUpdate({ name: 'Ana' });

    await replayPass();
    await new Promise((r) => setTimeout(r, 0)); // reportDeadSession purga en segundo plano

    await expect(readCache(cacheKeys.events())).resolves.toBeUndefined();
    await expect(rows()).resolves.toHaveLength(1);
  });

  it('vuelve a entrar y los cambios replican', async () => {
    api.profile.update.mockRejectedValueOnce(httpError(401));
    await enqueueProfileUpdate({ name: 'Ana' });
    await replayPass();

    api.profile.update.mockResolvedValue({ id: 1 });
    const second = await replayPass();

    expect(second.dispatched).toBe(1);
    await expect(rows()).resolves.toEqual([]);
  });
});

describe('replay · sin salida a la red', () => {
  it('un fallo de transporte con el punto de acceso muerto no gasta intento', async () => {
    // Ocho de estos en un aula sin internet matarían el trabajo de la docente
    // sin que ningún servidor lo hubiera rechazado.
    api.profile.update.mockRejectedValue(new TypeError('Failed to fetch'));
    net.checkReachability.mockResolvedValue(false);
    await enqueueProfileUpdate({ name: 'Ana' });

    const result = await replayPass();

    expect(result.stopped).toBe('unreachable');
    const left = await rows();
    expect(left[0].attempts).toBe(0);
  });

  it('con salida a la red, el fallo sí es de esta petición y cuenta', async () => {
    api.profile.update.mockRejectedValue(new TypeError('Failed to fetch'));
    net.checkReachability.mockResolvedValue(true);
    await enqueueProfileUpdate({ name: 'Ana' });

    await replayPass();

    const left = await rows();
    expect(left[0].attempts).toBe(1);
    expect(left[0].nextAttemptAt).toBeGreaterThan(Date.now());
  });
});

describe('replay · ámbito por usuaria', () => {
  it('no despacha los cambios de otra docente de la tablet', async () => {
    setCacheUser('bea');
    await enqueueProfileUpdate({ name: 'Bea' });
    setCacheUser(ANA);
    await enqueuePostComment(7, { text: 'de Ana' });

    await replayPass();

    expect(api.profile.update).not.toHaveBeenCalled();
    expect(api.posts.addComment).toHaveBeenCalledTimes(1);
    await expect(rows('bea')).resolves.toHaveLength(1);
  });
});

describe('replay · lo que quedó en vuelo', () => {
  it('reenvía lo que se puede reenviar y descarta el me gusta', async () => {
    // Una pestaña que murió a mitad de despacho. No sabemos si el servidor lo
    // recibió; reenviar un me gusta lo INVERTIRÍA.
    const vencido = { status: 'inflight' as const, leaseOwner: 'muerta', leaseUntil: Date.now() - 1 };
    await seed({ kind: 'post.like', postId: 7 }, vencido);
    await seed({ kind: 'post.comment', postId: 9, input: { text: 'hola' } }, vencido);

    await replayPass();

    expect(api.posts.toggleLike).not.toHaveBeenCalled();
    expect(api.posts.addComment).toHaveBeenCalledTimes(1);
    await expect(rows()).resolves.toEqual([]);
  });

  it('no toca una reclama que sigue viva en otra pestaña', async () => {
    await seed({ kind: 'post.comment', postId: 9, input: { text: 'hola' } }, {
      status: 'inflight',
      leaseOwner: 'otra-pestaña',
      leaseUntil: Date.now() + 60_000,
    });

    await replayPass();

    expect(api.posts.addComment).not.toHaveBeenCalled();
    await expect(rows()).resolves.toHaveLength(1);
  });
});

describe('replay · dos pasadas a la vez', () => {
  it('cada cambio se despacha exactamente una vez', async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => {
      resolve = r;
    });
    api.profile.update.mockImplementation(async () => {
      await gate;
      return { id: 1 };
    });
    await enqueueProfileUpdate({ name: 'Ana' });

    const first = replayPass();
    const second = replayPass();
    resolve();
    await Promise.all([first, second]);

    expect(api.profile.update).toHaveBeenCalledTimes(1);
    await expect(rows()).resolves.toEqual([]);
  });
});

describe('replay · limpieza por antigüedad', () => {
  it('lo que lleva un mes sin poder salir pasa a la lista de fallidos', async () => {
    await seed({ kind: 'profile.update', input: { name: 'Ana' } }, {
      createdAt: Date.now() - 31 * 24 * 60 * 60_000,
    });

    await sweepStale();

    await expect(rows()).resolves.toEqual([]);
    const apartadas = await dead();
    expect(apartadas[0].reason).toContain('demasiado tiempo');
  });

  it('lo apartado hace un trimestre se borra', async () => {
    await putRecord(STORES.deadLetter, {
      id: 'd-vieja',
      userId: ANA,
      kind: 'profile.update',
      payload: { input: {} },
      chainKey: 'profile',
      createdAt: 0,
      attempts: 8,
      nextAttemptAt: 0,
      failedAt: Date.now() - 91 * 24 * 60 * 60_000,
      reason: 'lo que sea',
    } satisfies Omit<DeadLetterRecord, 'seq'>);

    await sweepStale();

    await expect(dead()).resolves.toEqual([]);
  });

  it('no toca lo reciente', async () => {
    await enqueueProfileUpdate({ name: 'Ana' });
    await sweepStale();
    await expect(rows()).resolves.toHaveLength(1);
  });

  it('no toca lo de otra docente', async () => {
    setCacheUser('bea');
    await seed({ kind: 'profile.update', input: {} }, {
      userId: 'bea',
      createdAt: Date.now() - 31 * 24 * 60 * 60_000,
    });
    setCacheUser(ANA);

    await sweepStale();

    await expect(listRows('bea')).resolves.toHaveLength(1);
  });
});
